import { Router } from 'express';
import { z } from 'zod';
import { AuthController } from '../controllers/auth.controller';
import { authenticateJWT } from '../middleware/auth';
import { requireRoles } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { Role } from '../types';

const router = Router();

const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(2),
    role: z.nativeEnum(Role).optional()
  })
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1, 'Password is required')
  })
});

// Public endpoints
router.post('/register', validate(registerSchema), AuthController.register);
router.post('/login', validate(loginSchema), AuthController.login);

// Protected endpoints
router.get('/me', authenticateJWT, AuthController.me);
router.get('/failed-logins', authenticateJWT, requireRoles(Role.ADMIN, Role.EXTERNAL_AUDITOR), AuthController.getFailedLogins);

export default router;
