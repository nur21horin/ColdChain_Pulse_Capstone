import PDFDocument from 'pdfkit';
import { inMemoryStore, calculateTelemetryHash, calculateCustodyHash, computeSha256 } from '../db';
import { ShipmentService } from './shipment.service';
import { TelemetryService } from './telemetry.service';
import { CustodyService } from './custody.service';
import { AppError } from '../middleware/errorHandler';

export interface LedgerVerificationResult {
  shipmentId: string;
  isTampered: boolean;
  telemetryVerifiedCount: number;
  custodyVerifiedCount: number;
  integrityStatus: 'VALID' | 'COMPROMISED';
  tamperDetails?: string[];
  chainHeadHash?: string;
  verifiedAt: string;
}

export class AuditService {
  /**
   * Cryptographically audit and verify the hash chain integrity of a shipment's
   * telemetry readings and custody handoffs.
   */
  public static async verifyShipmentLedger(shipmentId: string): Promise<LedgerVerificationResult> {
    const shipment = await ShipmentService.getShipmentById(shipmentId);
    if (!shipment) {
      throw new AppError(`Shipment ${shipmentId} not found`, 404, 'ShipmentNotFound');
    }

    const telemetry = await TelemetryService.getReadings(shipmentId);
    const custody = await CustodyService.getShipmentHistory(shipmentId);

    const tamperDetails: string[] = [];
    let isTampered = false;

    // 1. Audit Telemetry Hash Chain
    for (let i = 0; i < telemetry.length; i++) {
      const reading = telemetry[i];
      const expectedPrevHash = i === 0 ? 'GENESIS' : telemetry[i - 1].hash;

      if (reading.prevHash !== expectedPrevHash) {
        isTampered = true;
        tamperDetails.push(
          `Telemetry chain break at index ${i} (ID: ${reading.id}): expected prevHash "${expectedPrevHash}", found "${reading.prevHash}"`
        );
      }

      const recomputedHash = calculateTelemetryHash(
        reading.prevHash,
        reading.shipmentId,
        reading.recordedAt,
        reading.temperature,
        reading.humidity,
        reading.latitude,
        reading.longitude
      );

      if (recomputedHash !== reading.hash) {
        isTampered = true;
        tamperDetails.push(
          `Telemetry hash mismatch at index ${i} (ID: ${reading.id}): data has been modified! Stored: "${reading.hash}", Recomputed: "${recomputedHash}"`
        );
      }
    }

    // 2. Audit Chain of Custody Hash Chain
    for (let i = 0; i < custody.length; i++) {
      const record = custody[i];
      const expectedPrevHash = i === 0 ? 'GENESIS' : custody[i - 1].hash;

      if (record.prevHash !== expectedPrevHash) {
        isTampered = true;
        tamperDetails.push(
          `Custody chain break at index ${i} (ID: ${record.id}): expected prevHash "${expectedPrevHash}", found "${record.prevHash}"`
        );
      }

      const recomputedHash = calculateCustodyHash(
        record.prevHash,
        record.shipmentId,
        record.stage,
        record.actorId,
        record.recordedAt,
        record.conditionStatus,
        record.qrCodeData,
        record.pinCode,
        record.supersedesId
      );

      if (recomputedHash !== record.hash) {
        isTampered = true;
        tamperDetails.push(
          `Custody record hash mismatch at index ${i} (ID: ${record.id}): data modified! Stored: "${record.hash}", Recomputed: "${recomputedHash}"`
        );
      }
    }

    const latestHash = telemetry.length > 0 ? telemetry[telemetry.length - 1].hash : 'GENESIS';

    return {
      shipmentId,
      isTampered,
      telemetryVerifiedCount: telemetry.length,
      custodyVerifiedCount: custody.length,
      integrityStatus: isTampered ? 'COMPROMISED' : 'VALID',
      tamperDetails: tamperDetails.length > 0 ? tamperDetails : undefined,
      chainHeadHash: latestHash,
      verifiedAt: new Date().toISOString()
    };
  }

  /**
   * Generate a cryptographic batch hash for audit reports
   */
  public static generateBatchFingerprint(
    shipment: any,
    telemetry: any[],
    custody: any[],
    alerts: any[]
  ): string {
    const payload = JSON.stringify({
      shipment: { id: shipment.id, trackingNumber: shipment.trackingNumber, status: shipment.status },
      telemetryHashes: telemetry.map(t => t.hash),
      custodyHashes: custody.map(c => c.hash),
      alerts: alerts.map(a => ({ id: a.id, type: a.type, triggeredAt: a.triggeredAt }))
    });
    return computeSha256(payload);
  }

  /**
   * Generate tamper-evident PDF audit report buffer
   */
  public static async generatePDFReport(shipmentId: string, auditorName: string): Promise<{
    buffer: Buffer;
    sha256Hash: string;
  }> {
    const shipment = await ShipmentService.getShipmentById(shipmentId);
    if (!shipment) {
      throw new AppError(`Shipment ${shipmentId} not found`, 404, 'ShipmentNotFound');
    }

    const telemetry = await TelemetryService.getReadings(shipmentId);
    const custody = await CustodyService.getShipmentHistory(shipmentId);
    const alerts = await TelemetryService.getAlerts(shipmentId);
    const verification = await this.verifyShipmentLedger(shipmentId);

    const sha256Hash = this.generateBatchFingerprint(shipment, telemetry, custody, alerts);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve({ buffer: pdfData, sha256Hash });
      });
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text('MEDSWIFT LOGISTICS LTD.', { align: 'center' });
      doc.fontSize(14).text('ColdChain Pulse - Cryptographic Audit Report', { align: 'center' });
      doc.moveDown();

      // Integrity Badge & Hash
      doc.fontSize(10).fillColor('#0052cc').text(`REPORT SHA-256 FINGERPRINT:`, { underline: true });
      doc.fontSize(9).font('Courier').text(sha256Hash);
      doc.font('Helvetica').moveDown(0.5);

      doc.fontSize(10).fillColor(verification.isTampered ? '#cc0000' : '#008800')
        .text(`LEDGER INTEGRITY STATUS: ${verification.integrityStatus} (${verification.telemetryVerifiedCount} readings, ${verification.custodyVerifiedCount} custody records verified)`);
      doc.fillColor('#000000').moveDown();

      // Shipment Metadata
      doc.fontSize(12).text('1. Shipment Information', { underline: true });
      doc.fontSize(10);
      doc.text(`Tracking Number: ${shipment.trackingNumber}`);
      doc.text(`Origin: ${shipment.origin} -> Destination: ${shipment.destination}`);
      doc.text(`Allowed Temperature Range: ${shipment.minTemp}°C to ${shipment.maxTemp}°C`);
      doc.text(`Current Status: ${shipment.status}`);
      doc.text(`Audited By: ${auditorName} on ${new Date().toISOString()}`);
      doc.moveDown();

      // Chain of Custody Handoffs
      doc.fontSize(12).text('2. Chain of Custody Verification', { underline: true });
      doc.fontSize(9);
      if (custody.length === 0) {
        doc.text('No handoffs recorded yet.');
      } else {
        custody.forEach((c, idx) => {
          doc.text(`[${idx + 1}] ${c.stage} | Actor: ${c.actorRole} | Condition: ${c.conditionStatus} | Time: ${c.recordedAt}`);
          doc.font('Courier').fontSize(8).text(`     Record Hash: ${c.hash}`).font('Helvetica').fontSize(9);
        });
      }
      doc.moveDown();

      // Alert Summary
      doc.fontSize(12).text('3. Excursions and Alerts', { underline: true });
      doc.fontSize(9);
      if (alerts.length === 0) {
        doc.text('No warnings or critical breaches were triggered during transit. Cold chain maintained 100%.');
      } else {
        alerts.forEach((a, idx) => {
          const color = a.severity === 'CRITICAL' ? '#cc0000' : '#cc8800';
          doc.fillColor(color).text(`[${idx + 1}] ${a.severity}: ${a.message} (${a.triggeredAt})`);
        });
      }
      doc.fillColor('#000000').moveDown();

      // Telemetry Summary
      doc.fontSize(12).text('4. IoT Telemetry Log Samples', { underline: true });
      doc.fontSize(8);
      const sampleReadings = telemetry.slice(-10); // Last 10 readings
      if (sampleReadings.length === 0) {
        doc.text('No telemetry readings recorded.');
      } else {
        sampleReadings.forEach(r => {
          doc.text(`${r.recordedAt} | Temp: ${r.temperature.toFixed(2)}°C | Humidity: ${r.humidity.toFixed(1)}% | GPS: (${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}) | Hash: ${r.hash.substring(0, 16)}...`);
        });
      }

      // Footer
      doc.fontSize(8).text('Tamper-Evident Report generated by MedSwift ColdChain Pulse Backend Engine', 40, doc.page.height - 50, {
        align: 'center',
        width: doc.page.width - 80
      });

      doc.end();
    });
  }

  /**
   * Generate tamper-evident CSV string export
   */
  public static async generateCSVReport(shipmentId: string): Promise<{
    csv: string;
    sha256Hash: string;
  }> {
    const shipment = await ShipmentService.getShipmentById(shipmentId);
    if (!shipment) {
      throw new AppError(`Shipment ${shipmentId} not found`, 404, 'ShipmentNotFound');
    }

    const telemetry = await TelemetryService.getReadings(shipmentId);
    const custody = await CustodyService.getShipmentHistory(shipmentId);
    const alerts = await TelemetryService.getAlerts(shipmentId);

    const sha256Hash = this.generateBatchFingerprint(shipment, telemetry, custody, alerts);

    const lines: string[] = [
      `# MedSwift Logistics Ltd. - ColdChain Pulse Telemetry Export`,
      `# Shipment Tracking: ${shipment.trackingNumber}`,
      `# Status: ${shipment.status}`,
      `# SHA256 Batch Fingerprint: ${sha256Hash}`,
      `# Export Timestamp: ${new Date().toISOString()}`,
      `reading_id,shipment_id,recorded_at,temperature_c,humidity_pct,latitude,longitude,is_warning,is_critical,prev_hash,record_hash`
    ];

    for (const r of telemetry) {
      lines.push([
        r.id,
        r.shipmentId,
        r.recordedAt,
        r.temperature.toFixed(2),
        r.humidity.toFixed(1),
        r.latitude.toFixed(6),
        r.longitude.toFixed(6),
        r.isWarning,
        r.isCritical,
        r.prevHash,
        r.hash
      ].join(','));
    }

    return {
      csv: lines.join('\n'),
      sha256Hash
    };
  }
}
