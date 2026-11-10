import { Response, NextFunction } from 'express';
import { OfflineSyncService } from '../services/offlineSync.service';
import { AuthenticatedRequest } from '../middleware/auth';

export class OfflineSyncController {
  public static async syncTelemetryBatch(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { batch } = req.body;
      const result = await OfflineSyncService.syncTelemetryBatch(batch);

      res.status(200).json({
        success: true,
        message: `Offline telemetry batch processed: ${result.newInserted} new inserted, ${result.duplicatesSkipped} duplicates skipped (idempotent).`,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  public static async syncCustodyBatch(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { batch } = req.body;
      const enrichedBatch = batch.map((item: any) => ({
        ...item,
        actorId: req.user!.id,
        actorRole: req.user!.role
      }));

      const result = await OfflineSyncService.syncCustodyBatch(enrichedBatch);

      res.status(200).json({
        success: true,
        message: `Offline custody batch processed: ${result.newInserted} new inserted, ${result.duplicatesSkipped} duplicates skipped (idempotent).`,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}
