import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { Role } from '../types';

/**
 * Middleware to restrict endpoints to specific roles.
 * Also enforces that EXTERNAL_AUDITOR is strictly read-only across the platform.
 */
export function requireRoles(...allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User authentication required.'
      });
      return;
    }

    // Role check
    const userRole = req.user.role;

    // Strict security rule: External Auditor is read-only
    if (userRole === Role.EXTERNAL_AUDITOR && req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      res.status(403).json({
        success: false,
        error: 'AuditorReadOnlyAccess',
        message: 'External Auditor role is strictly read-only. Mutation operations (POST, PUT, PATCH, DELETE) are prohibited.'
      });
      return;
    }

    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `Access denied. Role "${userRole}" lacks permissions for this operation. Allowed roles: [${allowedRoles.join(', ')}]`
      });
      return;
    }

    next();
  };
}

/**
 * Middleware ensuring endpoint is read-only for auditors
 */
export function enforceAuditorReadOnly(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.user && req.user.role === Role.EXTERNAL_AUDITOR) {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      res.status(403).json({
        success: false,
        error: 'AuditorReadOnlyAccess',
        message: 'External Auditor role is strictly read-only.'
      });
      return;
    }
  }
  next();
}
