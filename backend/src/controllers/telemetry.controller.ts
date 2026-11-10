import { Response, NextFunction } from 'express';
import { TelemetryService } from '../services/telemetry.service';
import { AuthenticatedRequest } from '../middleware/auth';
import { AlertSeverity } from '../types';

export class TelemetryController {
  public static async ingest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await TelemetryService.ingestReading(req.body);

      const statusCode = result.isDuplicate ? 200 : 201;
      res.status(statusCode).json({
        success: true,
        message: result.isDuplicate
          ? 'Duplicate reading received; idempotently acknowledged.'
          : 'Telemetry reading successfully recorded into tamper-evident hash chain.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getShipmentReadings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const shipmentId = req.params.shipmentId as string;
      const readings = await TelemetryService.getReadings(shipmentId);
      res.status(200).json({
        success: true,
        count: readings.length,
        data: readings
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getAlerts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { shipmentId, severity } = req.query;
      const alerts = await TelemetryService.getAlerts(
        shipmentId as string | undefined,
        severity as AlertSeverity | undefined
      );

      res.status(200).json({
        success: true,
        count: alerts.length,
        data: alerts
      });
    } catch (err) {
      next(err);
    }
  }

  public static async acknowledgeAlert(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const alertId = req.params.alertId as string;
      const alert = await TelemetryService.acknowledgeAlert(alertId, req.user!.id);
      res.status(200).json({
        success: true,
        message: 'Alert acknowledged',
        data: alert
      });
    } catch (err) {
      next(err);
    }
  }
}
