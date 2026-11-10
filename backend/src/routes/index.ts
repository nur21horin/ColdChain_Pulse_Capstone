import { Router } from 'express';
import authRoutes from './auth.routes';
import shipmentRoutes from './shipment.routes';
import telemetryRoutes from './telemetry.routes';
import custodyRoutes from './custody.routes';
import offlineSyncRoutes from './offlineSync.routes';
import auditRoutes from './audit.routes';
import sseRoutes from './sse.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/shipments', shipmentRoutes);
router.use('/telemetry', telemetryRoutes);
router.use('/custody', custodyRoutes);
router.use('/sync', offlineSyncRoutes);
router.use('/audit', auditRoutes);
router.use('/live', sseRoutes);

export default router;
