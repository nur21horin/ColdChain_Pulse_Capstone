import { Router } from 'express';
import { z } from 'zod';
import { OfflineSyncController } from '../controllers/offlineSync.controller';
import { authenticateJWT } from '../middleware/auth';
import { requireRoles } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { Role, CustodyStage, ConditionStatus } from '../types';

const router = Router();

const telemetryBatchSchema = z.object({
  body: z.object({
    batch: z.array(
      z.object({
        id: z.string().uuid({ message: 'Each queued telemetry record must have a client-generated UUID id' }),
        shipmentId: z.string().min(1),
        temperature: z.number(),
        humidity: z.number(),
        batteryLevel: z.number().min(0).max(100).optional(),
        latitude: z.number(),
        longitude: z.number(),
        recordedAt: z.string().datetime()
      })
    ).min(1, 'Batch array cannot be empty')
  })
});

const custodyBatchSchema = z.object({
  body: z.object({
    batch: z.array(
      z.object({
        id: z.string().uuid({ message: 'Each queued custody record must have a client-generated UUID id' }),
        shipmentId: z.string().min(1),
        stage: z.nativeEnum(CustodyStage),
        conditionStatus: z.nativeEnum(ConditionStatus),
        qrCodeData: z.string().optional(),
        pinCode: z.string().optional(),
        signature: z.string().optional(),
        notes: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        recordedAt: z.string().datetime(),
        supersedesId: z.string().uuid().optional()
      })
    ).min(1, 'Batch array cannot be empty')
  })
});

router.use(authenticateJWT);

router.post(
  '/telemetry/batch',
  requireRoles(Role.ADMIN, Role.DISPATCHER, Role.DRIVER),
  validate(telemetryBatchSchema),
  OfflineSyncController.syncTelemetryBatch
);

router.post(
  '/custody/batch',
  requireRoles(Role.ADMIN, Role.DISPATCHER, Role.DRIVER, Role.CLINIC_RECEIVER),
  validate(custodyBatchSchema),
  OfflineSyncController.syncCustodyBatch
);

export default router;
