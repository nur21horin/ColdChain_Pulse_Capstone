import { Router } from 'express';
import { z } from 'zod';
import { CustodyController } from '../controllers/custody.controller';
import { authenticateJWT } from '../middleware/auth';
import { requireRoles } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { Role, CustodyStage, ConditionStatus } from '../types';

const router = Router();

const handoffSchema = z.object({
  body: z.object({
    id: z.string().uuid().optional(),
    shipmentId: z.string().min(1, 'shipmentId is required'),
    stage: z.nativeEnum(CustodyStage),
    conditionStatus: z.nativeEnum(ConditionStatus),
    qrCodeData: z.string().optional(),
    pinCode: z.string().optional(),
    signature: z.string().optional(),
    notes: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    recordedAt: z.string().datetime().optional(),
    supersedesId: z.string().uuid().optional()
  })
});

router.use(authenticateJWT);

router.post(
  '/handoff',
  requireRoles(Role.ADMIN, Role.DISPATCHER, Role.DRIVER, Role.CLINIC_RECEIVER),
  validate(handoffSchema),
  CustodyController.recordHandoff
);

router.get(
  '/:shipmentId',
  requireRoles(Role.ADMIN, Role.DISPATCHER, Role.DRIVER, Role.CLINIC_RECEIVER, Role.EXTERNAL_AUDITOR),
  CustodyController.getShipmentHistory
);

export default router;
