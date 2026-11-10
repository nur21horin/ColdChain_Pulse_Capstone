import { Router } from 'express';
import { z } from 'zod';
import { TelemetryController } from '../controllers/telemetry.controller';
import { authenticateJWT } from '../middleware/auth';
import { requireRoles } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { Role, AlertSeverity } from '../types';

const router = Router();

const ingestSchema = z.object({
  body: z.object({
    id: z.string().uuid().optional(),
    shipmentId: z.string().min(1, 'shipmentId is required'),
    temperature: z.number({ required_error: 'temperature is required' }),
    humidity: z.number({ required_error: 'humidity is required' }),
    batteryLevel: z.number().min(0).max(100).optional(),
    latitude: z.number({ required_error: 'latitude is required' }),
    longitude: z.number({ required_error: 'longitude is required' }),
    recordedAt: z.string().datetime().optional()
  })
});

const ackSchema = z.object({
  params: z.object({
    alertId: z.string().min(1)
  })
});

router.use(authenticateJWT);

router.post(
  '/ingest',
  requireRoles(Role.ADMIN, Role.DISPATCHER, Role.DRIVER),
  validate(ingestSchema),
  TelemetryController.ingest
);

router.get(
  '/alerts',
  requireRoles(Role.ADMIN, Role.DISPATCHER, Role.DRIVER, Role.CLINIC_RECEIVER, Role.EXTERNAL_AUDITOR),
  TelemetryController.getAlerts
);

router.patch(
  '/alerts/:alertId/ack',
  requireRoles(Role.ADMIN, Role.DISPATCHER, Role.CLINIC_RECEIVER),
  validate(ackSchema),
  TelemetryController.acknowledgeAlert
);

router.get(
  '/:shipmentId',
  requireRoles(Role.ADMIN, Role.DISPATCHER, Role.DRIVER, Role.CLINIC_RECEIVER, Role.EXTERNAL_AUDITOR),
  TelemetryController.getShipmentReadings
);

export default router;
