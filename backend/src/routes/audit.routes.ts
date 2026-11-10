import { Router } from 'express';
import { AuditController } from '../controllers/audit.controller';
import { authenticateJWT } from '../middleware/auth';
import { requireRoles } from '../middleware/rbac';
import { Role } from '../types';

const router = Router();

router.use(authenticateJWT);

router.get(
  '/shipments/:id/verify-ledger',
  requireRoles(Role.ADMIN, Role.DISPATCHER, Role.EXTERNAL_AUDITOR),
  AuditController.verifyLedger
);

router.get(
  '/reports/:shipmentId/pdf',
  requireRoles(Role.ADMIN, Role.DISPATCHER, Role.EXTERNAL_AUDITOR),
  AuditController.downloadPDF
);

router.get(
  '/reports/:shipmentId/csv',
  requireRoles(Role.ADMIN, Role.DISPATCHER, Role.EXTERNAL_AUDITOR),
  AuditController.downloadCSV
);

router.get(
  '/failed-logins',
  requireRoles(Role.ADMIN, Role.EXTERNAL_AUDITOR),
  AuditController.getFailedLogins
);

export default router;
