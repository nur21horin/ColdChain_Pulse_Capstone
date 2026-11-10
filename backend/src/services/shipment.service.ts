import { v4 as uuidv4 } from 'uuid';
import { inMemoryStore, prisma, isPrismaConnected } from '../db';
import { ShipmentRecord, ShipmentStatus, Role } from '../types';
import { AppError } from '../middleware/errorHandler';

export interface CreateShipmentDTO {
  origin: string;
  destination: string;
  vehicleId?: string;
  driverId?: string;
  receiverId?: string;
  dispatcherId?: string;
  minTemp?: number;
  maxTemp?: number;
  minHumidity?: number;
  maxHumidity?: number;
  distanceKm?: number;
  estimatedDurationHours?: number;
}

export class ShipmentService {
  /**
   * Generate human-readable tracking number
   */
  public static generateTrackingNumber(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = Math.floor(1000 + Math.random() * 9000).toString();
    return `MED-${dateStr}-${randomHex}`;
  }

  /**
   * Calculate estimated arrival time (ETA) given distance or duration
   */
  public static calculateETA(distanceKm: number = 120, avgSpeedKmh: number = 40): Date {
    const hours = distanceKm / avgSpeedKmh;
    const etaMs = Date.now() + hours * 60 * 60 * 1000;
    return new Date(etaMs);
  }

  /**
   * Create a new cold-chain shipment
   */
  public static async createShipment(data: CreateShipmentDTO): Promise<ShipmentRecord> {
    const id = uuidv4();
    const trackingNumber = this.generateTrackingNumber();
    const now = new Date().toISOString();

    const distance = data.distanceKm || 150;
    const eta = data.estimatedDurationHours
      ? new Date(Date.now() + data.estimatedDurationHours * 3600 * 1000).toISOString()
      : this.calculateETA(distance).toISOString();

    const shipment: ShipmentRecord = {
      id,
      trackingNumber,
      origin: data.origin,
      destination: data.destination,
      vehicleId: data.vehicleId,
      dispatcherId: data.dispatcherId,
      driverId: data.driverId,
      receiverId: data.receiverId,
      minTemp: data.minTemp !== undefined ? data.minTemp : 2.0,
      maxTemp: data.maxTemp !== undefined ? data.maxTemp : 8.0,
      minHumidity: data.minHumidity !== undefined ? data.minHumidity : 30.0,
      maxHumidity: data.maxHumidity !== undefined ? data.maxHumidity : 65.0,
      status: ShipmentStatus.PENDING,
      distanceKm: distance,
      eta,
      createdAt: now,
      updatedAt: now
    };

    inMemoryStore.shipments.set(id, shipment);

    if (isPrismaConnected) {
      try {
        await prisma.shipment.create({
          data: {
            id: shipment.id,
            trackingNumber: shipment.trackingNumber,
            origin: shipment.origin,
            destination: shipment.destination,
            vehicleId: shipment.vehicleId,
            dispatcherId: shipment.dispatcherId,
            driverId: shipment.driverId,
            receiverId: shipment.receiverId,
            minTemp: shipment.minTemp,
            maxTemp: shipment.maxTemp,
            minHumidity: shipment.minHumidity,
            maxHumidity: shipment.maxHumidity,
            status: shipment.status as any,
            distanceKm: shipment.distanceKm,
            eta: new Date(shipment.eta!),
            createdAt: new Date(shipment.createdAt),
            updatedAt: new Date(shipment.updatedAt)
          }
        });
      } catch (err) {
        console.error('[ShipmentService] Error persisting shipment to DB:', err);
      }
    }

    return shipment;
  }

  /**
   * List shipments with optional filtering
   */
  public static async getShipments(filters?: {
    status?: ShipmentStatus;
    driverId?: string;
    receiverId?: string;
  }): Promise<ShipmentRecord[]> {
    let list = Array.from(inMemoryStore.shipments.values());

    if (filters?.status) {
      list = list.filter(s => s.status === filters.status);
    }
    if (filters?.driverId) {
      list = list.filter(s => s.driverId === filters.driverId);
    }
    if (filters?.receiverId) {
      list = list.filter(s => s.receiverId === filters.receiverId);
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Get shipment by ID or tracking number
   */
  public static async getShipmentById(idOrTracking: string): Promise<ShipmentRecord | null> {
    const direct = inMemoryStore.shipments.get(idOrTracking);
    if (direct) return direct;

    for (const s of inMemoryStore.shipments.values()) {
      if (s.trackingNumber === idOrTracking) {
        return s;
      }
    }
    return null;
  }

  /**
   * Update shipment vehicle/driver assignment
   */
  public static async assignVehicleAndDriver(
    shipmentId: string,
    vehicleId?: string,
    driverId?: string
  ): Promise<ShipmentRecord> {
    const shipment = await this.getShipmentById(shipmentId);
    if (!shipment) {
      throw new AppError('Shipment not found', 404, 'ShipmentNotFound');
    }

    if (vehicleId) shipment.vehicleId = vehicleId;
    if (driverId) shipment.driverId = driverId;
    shipment.updatedAt = new Date().toISOString();

    inMemoryStore.shipments.set(shipment.id, shipment);

    if (isPrismaConnected) {
      try {
        await prisma.shipment.update({
          where: { id: shipment.id },
          data: {
            vehicleId: shipment.vehicleId,
            driverId: shipment.driverId,
            updatedAt: new Date(shipment.updatedAt)
          }
        });
      } catch (err) {
        console.error('[ShipmentService] Error updating shipment assignment in DB:', err);
      }
    }

    return shipment;
  }

  /**
   * Update status of shipment (e.g. IN_TRANSIT, DELIVERED, COMPROMISED)
   */
  public static async updateStatus(shipmentId: string, status: ShipmentStatus): Promise<ShipmentRecord> {
    const shipment = await this.getShipmentById(shipmentId);
    if (!shipment) {
      throw new AppError('Shipment not found', 404, 'ShipmentNotFound');
    }

    shipment.status = status;
    const now = new Date().toISOString();
    shipment.updatedAt = now;

    if (status === ShipmentStatus.IN_TRANSIT && !shipment.dispatchedAt) {
      shipment.dispatchedAt = now;
    }
    if (status === ShipmentStatus.DELIVERED) {
      shipment.deliveredAt = now;
    }

    inMemoryStore.shipments.set(shipment.id, shipment);

    if (isPrismaConnected) {
      try {
        await prisma.shipment.update({
          where: { id: shipment.id },
          data: {
            status: shipment.status as any,
            dispatchedAt: shipment.dispatchedAt ? new Date(shipment.dispatchedAt) : undefined,
            deliveredAt: shipment.deliveredAt ? new Date(shipment.deliveredAt) : undefined,
            updatedAt: new Date(shipment.updatedAt)
          }
        });
      } catch (err) {
        console.error('[ShipmentService] Error updating shipment status in DB:', err);
      }
    }

    return shipment;
  }
}
