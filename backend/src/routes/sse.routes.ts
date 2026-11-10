import { Router } from 'express';
import { SSEController } from '../controllers/sse.controller';

const router = Router();

// Public or token-authenticated SSE stream endpoint
router.get('/stream', SSEController.stream);

export default router;
