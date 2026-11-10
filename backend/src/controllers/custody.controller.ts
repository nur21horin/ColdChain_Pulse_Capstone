import { Response, NextFunction } from 'express';
import { CustodyService } from '../services/custody.service';
import { AuthenticatedRequest } from '../middleware/auth';

export class CustodyController {
  public static async recordHandoff(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await CustodyService.recordHandoff({
        ...req.body,
        actorId: req.user!.id,
        actorRole: req.user!.role
      });

      const statusCode = result.isDuplicate ? 200 : 201;
      res.status(statusCode).json({
        success: true,
        message: result.isDuplicate
          ? 'Duplicate handoff record received; idempotently acknowledged.'
          : 'Chain of custody handoff recorded successfully into tamper-evident hash chain.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getShipmentHistory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const shipmentId = req.params.shipmentId as string;
      const history = await CustodyService.getShipmentHistory(shipmentId);
      res.status(200).json({
        success: true,
        count: history.length,
        data: history
      });
    } catch (err) {
      next(err);
    }
  }
}
