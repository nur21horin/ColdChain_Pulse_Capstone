import { Response, NextFunction } from 'express';
import { AuditService } from '../services/audit.service';
import { AuthService } from '../services/auth.service';
import { AuthenticatedRequest } from '../middleware/auth';

export class AuditController {
  public static async verifyLedger(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const result = await AuditService.verifyShipmentLedger(id);
      res.status(200).json({
        success: true,
        message: result.isTampered
          ? 'TAMPER_ALERT: Cryptographic ledger verification failed. Unauthorized modifications detected!'
          : 'Cryptographic ledger verified. All hash chains and signatures intact.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  public static async downloadPDF(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const shipmentId = req.params.shipmentId as string;
      const auditorName = req.user?.name || 'Authorized Auditor';
      const { buffer, sha256Hash } = await AuditService.generatePDFReport(shipmentId, auditorName);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="coldchain_audit_${shipmentId}.pdf"`);
      res.setHeader('X-Report-SHA256', sha256Hash);

      res.status(200).send(buffer);
    } catch (err) {
      next(err);
    }
  }

  public static async downloadCSV(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const shipmentId = req.params.shipmentId as string;
      const { csv, sha256Hash } = await AuditService.generateCSVReport(shipmentId);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="coldchain_telemetry_${shipmentId}.csv"`);
      res.setHeader('X-Report-SHA256', sha256Hash);

      res.status(200).send(csv);
    } catch (err) {
      next(err);
    }
  }

  public static async getFailedLogins(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const logs = await AuthService.getFailedLoginLogs();
      res.status(200).json({
        success: true,
        count: logs.length,
        data: logs
      });
    } catch (err) {
      next(err);
    }
  }
}
