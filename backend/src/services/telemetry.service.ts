import { v4 as uuidv4 } from 'uuid';
import { inMemoryStore, prisma, isPrismaConnected, calculateTelemetryHash } from '../db';
import {
  TelemetryReadingRecord,
  AlertRecord,
  AlertSeverity,
  AlertType,
  ShipmentStatus
} from '../types';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { ShipmentService } from './shipment.service';
import { SSEService } from './sse.service';

export interface IngestReadingDTO {
  id?: string; // client-generated UUID for offline idempotency
  shipmentId: string;
  temperature: number;
  humidity: number;
  batteryLevel?: number;
  latitude: number;
  longitude: number;
  recordedAt?: string;
}

export class TelemetryService {
  /**
   * Ingest a single telemetry reading with hash chaining, warning calculation,
   * and 10-minute breach critical alert evaluation.
   */
  public static async ingestReading(data: IngestReadingDTO): Promise<{
    reading: TelemetryReadingRecord;
    alertsTriggered: AlertRecord[];
    isDuplicate: boolean;
  }> {
    const readingId = data.id || uuidv4();

    // 1. Idempotency Check: if reading ID already exists, return existing
    const existing = inMemoryStore.telemetryById.get(readingId);
    if (existing) {
      return {
        reading: existing,
        alertsTriggered: [],
        isDuplicate: true
      };
    }

    // 2. Shipment validation
    const shipment = await ShipmentService.getShipmentById(data.shipmentId);
    if (!shipment) {
      throw new AppError(`Shipment with id ${data.shipmentId} does not exist`, 404, 'ShipmentNotFound');
    }

    // 3. Cryptographic Hash Chain construction
    const readingsForShipment = inMemoryStore.telemetry.get(data.shipmentId) || [];
    const prevHash = readingsForShipment.length > 0
      ? readingsForShipment[readingsForShipment.length - 1].hash
      : 'GENESIS';

    const recordedAt = data.recordedAt || new Date().toISOString();
    const receivedAt = new Date().toISOString();

    const hash = calculateTelemetryHash(
      prevHash,
      data.shipmentId,
      recordedAt,
      data.temperature,
      data.humidity,
      data.latitude,
      data.longitude
    );

    // 4. Alert Engine Logic:
    // Warning when approaching limits; Critical when breach lasts > 10 minutes without false positives
    const minTemp = shipment.minTemp;
    const maxTemp = shipment.maxTemp;
    const buffer = env.WARNING_TEMP_BUFFER; // 0.5°C
    const criticalThresholdMinutes = env.CRITICAL_BREACH_DURATION_MINUTES; // 10 minutes

    let isWarning = false;
    let isCritical = false;
    let warningReason: string | undefined;
    let criticalReason: string | undefined;
    const alertsTriggered: AlertRecord[] = [];

    const isExcursion = data.temperature < minTemp || data.temperature > maxTemp;
    const isApproachingUpper = data.temperature >= (maxTemp - buffer) && data.temperature <= maxTemp;
    const isApproachingLower = data.temperature <= (minTemp + buffer) && data.temperature >= minTemp;

    // A. Check Approaching Warning
    if (isApproachingUpper) {
      isWarning = true;
      warningReason = `Temperature (${data.temperature.toFixed(2)}°C) approaching upper limit of ${maxTemp.toFixed(2)}°C`;
      const alert = this.createAlert({
        shipmentId: data.shipmentId,
        readingId,
        severity: AlertSeverity.WARNING,
        type: AlertType.TEMP_HIGH_WARNING,
        message: warningReason,
        breachDurationMinutes: 0
      });
      alertsTriggered.push(alert);
    } else if (isApproachingLower) {
      isWarning = true;
      warningReason = `Temperature (${data.temperature.toFixed(2)}°C) approaching lower limit of ${minTemp.toFixed(2)}°C`;
      const alert = this.createAlert({
        shipmentId: data.shipmentId,
        readingId,
        severity: AlertSeverity.WARNING,
        type: AlertType.TEMP_LOW_WARNING,
        message: warningReason,
        breachDurationMinutes: 0
      });
      alertsTriggered.push(alert);
    }

    // B. Check Sustained Breach Duration (> 10 minutes)
    const activeBreach = inMemoryStore.activeBreaches.get(data.shipmentId);
    const readingTime = new Date(recordedAt).getTime();

    if (isExcursion) {
      const breachType = data.temperature > maxTemp ? AlertType.TEMP_HIGH_WARNING : AlertType.TEMP_LOW_WARNING;

      if (!activeBreach) {
        // Excursion just started
        inMemoryStore.activeBreaches.set(data.shipmentId, {
          startTime: new Date(recordedAt),
          type: breachType,
          peakTemp: data.temperature
        });

        isWarning = true;
        const initialWarning = this.createAlert({
          shipmentId: data.shipmentId,
          readingId,
          severity: AlertSeverity.WARNING,
          type: breachType,
          message: `Temperature breach initiated: ${data.temperature.toFixed(2)}°C (Limit: ${minTemp}°C - ${maxTemp}°C). Monitoring duration.`,
          breachDurationMinutes: 0
        });
        alertsTriggered.push(initialWarning);
      } else {
        // Excursion continuing
        const durationMinutes = (readingTime - activeBreach.startTime.getTime()) / (1000 * 60);

        if (durationMinutes >= criticalThresholdMinutes) {
          isCritical = true;
          criticalReason = `CRITICAL BREACH: Temperature (${data.temperature.toFixed(2)}°C) has sustained out of bounds for ${durationMinutes.toFixed(1)} minutes (Limit: ${minTemp}°C - ${maxTemp}°C).`;

          const criticalAlert = this.createAlert({
            shipmentId: data.shipmentId,
            readingId,
            severity: AlertSeverity.CRITICAL,
            type: AlertType.TEMP_BREACH_CRITICAL,
            message: criticalReason,
            breachDurationMinutes: Math.round(durationMinutes * 10) / 10
          });
          alertsTriggered.push(criticalAlert);

          // Mark shipment compromised
          ShipmentService.updateStatus(data.shipmentId, ShipmentStatus.COMPROMISED).catch(() => {});
        } else {
          // Under 10 minutes, still warning without false positive critical
          isWarning = true;
          warningReason = `Ongoing temperature excursion: ${durationMinutes.toFixed(1)} mins elapsed.`;
        }
      }
    } else {
      // Temperature returned to safe range! Reset active breach
      if (activeBreach) {
        const resolvedAlert = this.createAlert({
          shipmentId: data.shipmentId,
          readingId,
          severity: AlertSeverity.WARNING,
          type: AlertType.TEMP_HIGH_WARNING,
          message: `Temperature normalized to ${data.temperature.toFixed(2)}°C. Active excursion resolved.`,
          breachDurationMinutes: 0,
          resolvedAt: new Date().toISOString()
        });
        alertsTriggered.push(resolvedAlert);
        inMemoryStore.activeBreaches.delete(data.shipmentId);
      }
    }

    // 5. Store reading in ledger (append-only)
    const reading: TelemetryReadingRecord = {
      id: readingId,
      shipmentId: data.shipmentId,
      temperature: data.temperature,
      humidity: data.humidity,
      batteryLevel: data.batteryLevel,
      latitude: data.latitude,
      longitude: data.longitude,
      recordedAt,
      receivedAt,
      prevHash,
      hash,
      isWarning,
      isCritical,
      details: criticalReason || warningReason
    };

    readingsForShipment.push(reading);
    inMemoryStore.telemetry.set(data.shipmentId, readingsForShipment);
    inMemoryStore.telemetryById.set(readingId, reading);

    // 6. DB persistence if connected
    if (isPrismaConnected) {
      try {
        await prisma.telemetryReading.create({
          data: {
            id: reading.id,
            shipmentId: reading.shipmentId,
            temperature: reading.temperature,
            humidity: reading.humidity,
            batteryLevel: reading.batteryLevel,
            latitude: reading.latitude,
            longitude: reading.longitude,
            recordedAt: new Date(reading.recordedAt),
            receivedAt: new Date(reading.receivedAt),
            prevHash: reading.prevHash,
            hash: reading.hash,
            isWarning: reading.isWarning,
            isCritical: reading.isCritical,
            details: reading.details
          }
        });
      } catch (err) {
        console.error('[TelemetryService] Error persisting telemetry to DB:', err);
      }
    }

    // 7. Broadcast via Server-Sent Events (SSE)
    SSEService.broadcast('telemetry', reading, data.shipmentId);
    for (const alert of alertsTriggered) {
      SSEService.broadcast('alert', alert, data.shipmentId);
    }

    return {
      reading,
      alertsTriggered,
      isDuplicate: false
    };
  }

  /**
   * Helper to create and store alert
   */
  private static createAlert(params: {
    shipmentId: string;
    readingId?: string;
    severity: AlertSeverity;
    type: AlertType;
    message: string;
    breachDurationMinutes: number;
    resolvedAt?: string;
  }): AlertRecord {
    const alert: AlertRecord = {
      id: uuidv4(),
      shipmentId: params.shipmentId,
      readingId: params.readingId,
      severity: params.severity,
      type: params.type,
      message: params.message,
      breachDurationMinutes: params.breachDurationMinutes,
      triggeredAt: new Date().toISOString(),
      resolvedAt: params.resolvedAt
    };

    inMemoryStore.alerts.push(alert);

    if (isPrismaConnected) {
      try {
        prisma.alert.create({
          data: {
            id: alert.id,
            shipmentId: alert.shipmentId,
            readingId: alert.readingId,
            severity: alert.severity as any,
            type: alert.type as any,
            message: alert.message,
            breachDurationMinutes: alert.breachDurationMinutes,
            triggeredAt: new Date(alert.triggeredAt),
            resolvedAt: alert.resolvedAt ? new Date(alert.resolvedAt) : undefined
          }
        }).catch(err => console.error('[TelemetryService] Error saving alert to DB:', err));
      } catch (err) {
        // silent catch
      }
    }

    return alert;
  }

  /**
   * Get all readings for a shipment
   */
  public static async getReadings(shipmentId: string): Promise<TelemetryReadingRecord[]> {
    return inMemoryStore.telemetry.get(shipmentId) || [];
  }

  /**
   * Get all alerts for a shipment or system-wide
   */
  public static async getAlerts(shipmentId?: string, severity?: AlertSeverity): Promise<AlertRecord[]> {
    let list = inMemoryStore.alerts;
    if (shipmentId) {
      list = list.filter(a => a.shipmentId === shipmentId);
    }
    if (severity) {
      list = list.filter(a => a.severity === severity);
    }
    return [...list].sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime());
  }

  /**
   * Acknowledge alert
   */
  public static async acknowledgeAlert(alertId: string, userId: string): Promise<AlertRecord> {
    const alert = inMemoryStore.alerts.find(a => a.id === alertId);
    if (!alert) {
      throw new AppError('Alert not found', 404, 'AlertNotFound');
    }
    alert.acknowledgedById = userId;
    alert.resolvedAt = new Date().toISOString();
    return alert;
  }
}
