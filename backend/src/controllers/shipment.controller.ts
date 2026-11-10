import { Response, NextFunction } from 'express';
import { ShipmentService } from '../services/shipment.service';
import { AuthenticatedRequest } from '../middleware/auth';
import { ShipmentStatus, Role } from '../types';

export class ShipmentController {
  public static async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const shipment = await ShipmentService.createShipment({
        ...req.body,
        dispatcherId: req.user?.id
      });

      res.status(201).json({
        success: true,
        message: 'Shipment created and route scheduled successfully',
        data: shipment
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, driverId, receiverId } = req.query;

      // If Driver, automatically default to their assigned shipments if not specified
      let filterDriverId = driverId as string | undefined;
      if (req.user?.role === Role.DRIVER && !filterDriverId) {
        filterDriverId = req.user.id;
      }

      const shipments = await ShipmentService.getShipments({
        status: status as ShipmentStatus | undefined,
        driverId: filterDriverId,
        receiverId: receiverId as string | undefined
      });

      res.status(200).json({
        success: true,
        count: shipments.length,
        data: shipments
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const shipment = await ShipmentService.getShipmentById(id);
      if (!shipment) {
        res.status(404).json({
          success: false,
          error: 'ShipmentNotFound',
          message: `Shipment with id ${id} was not found`
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: shipment
      });
    } catch (err) {
      next(err);
    }
  }

  public static async assign(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const { vehicleId, driverId } = req.body;
      const updated = await ShipmentService.assignVehicleAndDriver(id, vehicleId, driverId);

      res.status(200).json({
        success: true,
        message: 'Vehicle and driver assignment updated',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  public static async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const { status } = req.body;
      const updated = await ShipmentService.updateStatus(id, status);

      res.status(200).json({
        success: true,
        message: `Shipment status updated to ${status}`,
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }
}
