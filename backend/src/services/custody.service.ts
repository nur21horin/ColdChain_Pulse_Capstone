import { v4 as uuidv4 } from 'uuid';
import { inMemoryStore, prisma, isPrismaConnected, calculateCustodyHash } from '../db';
import {
  CustodyRecord,
  CustodyStage,
  ConditionStatus,
  Role,
  ShipmentStatus
} from '../types';
import { AppError } from '../middleware/errorHandler';
import { ShipmentService } from './shipment.service';
import { SSEService } from './sse.service';

export interface CreateCustodyHandoffDTO {
  id?: string; // Client-generated UUID for offline sync idempotency
  shipmentId: string;
  stage: CustodyStage;
  actorId: string;
  actorRole: Role;
  qrCodeData?: string;
  pinCode?: string;
  signature?: string;
  conditionStatus: ConditionStatus;
  notes?: string;
  latitude?: number;
  longitude?: number;
  recordedAt?: string;
  supersedesId?: string; // For corrections referencing an old record
}

export class CustodyService {
  /**
   * Record a chain-of-custody handoff (Pickup, Checkpoint, Delivery)
   * Append-only with cryptographic hash chaining and corrections support.
   */
  public static async recordHandoff(data: CreateCustodyHandoffDTO): Promise<{
    record: CustodyRecord;
    isDuplicate: boolean;
  }> {
    const custodyId = data.id || uuidv4();

    // 1. Idempotency Check
    const existing = inMemoryStore.custodyById.get(custodyId);
    if (existing) {
      return { record: existing, isDuplicate: true };
    }

    // 2. Shipment validation
    const shipment = await ShipmentService.getShipmentById(data.shipmentId);
    if (!shipment) {
      throw new AppError(`Shipment with ID ${data.shipmentId} does not exist`, 404, 'ShipmentNotFound');
    }

    // 3. Security verification: QR code or PIN or signature must be provided for handoff
    if (!data.qrCodeData && !data.pinCode && !data.signature) {
      throw new AppError(
        'Handoff verification failed: Must provide at least one proof of handoff (QR Code, PIN, or Signature)',
        400,
        'HandoffVerificationMissing'
      );
    }

    // 4. If this is a correction, verify the superseded record exists
    if (data.supersedesId) {
      const oldRecord = inMemoryStore.custodyById.get(data.supersedesId);
      if (!oldRecord) {
        throw new AppError(
          `Cannot correct record: Target record ${data.supersedesId} not found`,
          404,
          'SupersededRecordNotFound'
        );
      }
    }

    // 5. Build Cryptographic Hash Chain
    const history = inMemoryStore.custodyRecords.get(data.shipmentId) || [];
    const prevHash = history.length > 0 ? history[history.length - 1].hash : 'GENESIS';

    const recordedAt = data.recordedAt || new Date().toISOString();
    const receivedAt = new Date().toISOString();

    const hash = calculateCustodyHash(
      prevHash,
      data.shipmentId,
      data.stage,
      data.actorId,
      recordedAt,
      data.conditionStatus,
      data.qrCodeData,
      data.pinCode,
      data.supersedesId
    );

    const record: CustodyRecord = {
      id: custodyId,
      shipmentId: data.shipmentId,
      stage: data.stage,
      actorId: data.actorId,
      actorRole: data.actorRole,
      qrCodeData: data.qrCodeData,
      pinCode: data.pinCode,
      signature: data.signature,
      conditionStatus: data.conditionStatus,
      notes: data.notes,
      latitude: data.latitude,
      longitude: data.longitude,
      recordedAt,
      receivedAt,
      prevHash,
      hash,
      supersedesId: data.supersedesId
    };

    // 6. Append to storage (immutable, append-only)
    history.push(record);
    inMemoryStore.custodyRecords.set(data.shipmentId, history);
    inMemoryStore.custodyById.set(custodyId, record);

    // 7. Update shipment status based on handoff stage
    if (data.stage === CustodyStage.PICKUP) {
      await ShipmentService.updateStatus(data.shipmentId, ShipmentStatus.IN_TRANSIT);
    } else if (data.stage === CustodyStage.DELIVERY) {
      if (data.conditionStatus === ConditionStatus.SEALED_INTACT) {
        await ShipmentService.updateStatus(data.shipmentId, ShipmentStatus.DELIVERED);
      } else {
        await ShipmentService.updateStatus(data.shipmentId, ShipmentStatus.COMPROMISED);
      }
    }

    // 8. DB persistence if connected
    if (isPrismaConnected) {
      try {
        await prisma.chainOfCustody.create({
          data: {
            id: record.id,
            shipmentId: record.shipmentId,
            stage: record.stage as any,
            actorId: record.actorId,
            actorRole: record.actorRole as any,
            qrCodeData: record.qrCodeData,
            pinCode: record.pinCode,
            signature: record.signature,
            conditionStatus: record.conditionStatus as any,
            notes: record.notes,
            latitude: record.latitude,
            longitude: record.longitude,
            recordedAt: new Date(record.recordedAt),
            receivedAt: new Date(record.receivedAt),
            prevHash: record.prevHash,
            hash: record.hash,
            supersedesId: record.supersedesId
          }
        });
      } catch (err) {
        console.error('[CustodyService] Error persisting custody record to DB:', err);
      }
    }

    SSEService.broadcast('custody_handoff', record, data.shipmentId);

    return { record, isDuplicate: false };
  }

  /**
   * Get all custody records for a shipment
   */
  public static async getShipmentHistory(shipmentId: string): Promise<CustodyRecord[]> {
    return inMemoryStore.custodyRecords.get(shipmentId) || [];
  }

  /**
   * Get a single custody record by ID
   */
  public static async getRecordById(id: string): Promise<CustodyRecord | null> {
    return inMemoryStore.custodyById.get(id) || null;
  }
}
