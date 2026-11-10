import { Router } from 'express';
import { z } from 'zod';
import { ShipmentController } from '../controllers/shipment.controller';
import { authenticateJWT } from '../middleware/auth';
import { requireRoles } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { Role, ShipmentStatus } from '../types';

const router = Router();

const createShipmentSchema = z.object({
  body: z.object({
    origin: z.string().min(2, 'Origin location is required'),
    destination: z.string().min(2, 'Destination is required'),
    vehicleId: z.string().optional(),
    driverId: z.string().optional(),
    receiverId: z.string().optional(),
    minTemp: z.number().optional().default(2.0),
    maxTemp: z.number().optional().default(8.0),
    minHumidity: z.number().optional().default(30.0),
    maxHumidity: z.number().optional().default(65.0),
    distanceKm: z.number().positive().optional(),
    estimatedDurationHours: z.number().positive().optional()
  })
});

const assignSchema = z.object({
  params: z.object({
    id: z.string().min(1)
  }),
  body: z.object({
    vehicleId: z.string().optional(),
    driverId: z.string().optional()
  })
});

const updateStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1)
  }),
  body: z.object({
    status: z.nativeEnum(ShipmentStatus)
  })
});

router.use(authenticateJWT);

router.post(
  '/',
  requireRoles(Role.ADMIN, Role.DISPATCHER),
  validate(createShipmentSchema),
  ShipmentController.create
);

router.get(
  '/',
  requireRoles(Role.ADMIN, Role.DISPATCHER, Role.DRIVER, Role.CLINIC_RECEIVER, Role.EXTERNAL_AUDITOR),
  ShipmentController.getAll
);

router.get(
  '/:id',
  requireRoles(Role.ADMIN, Role.DISPATCHER, Role.DRIVER, Role.CLINIC_RECEIVER, Role.EXTERNAL_AUDITOR),
  ShipmentController.getById
);

router.patch(
  '/:id/assign',
  requireRoles(Role.ADMIN, Role.DISPATCHER),
  validate(assignSchema),
  ShipmentController.assign
);

router.patch(
  '/:id/status',
  requireRoles(Role.ADMIN, Role.DISPATCHER, Role.DRIVER),
  validate(updateStatusSchema),
  ShipmentController.updateStatus
);

export default router;
