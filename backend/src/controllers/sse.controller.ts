import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { SSEService } from '../services/sse.service';

export class SSEController {
  public static stream(req: Request, res: Response): void {
    const shipmentId = req.query.shipmentId as string | undefined;
    const clientId = uuidv4();
    SSEService.addClient(clientId, res, shipmentId);
  }
}
