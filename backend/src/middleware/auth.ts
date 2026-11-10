import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserPayload, Role } from '../types';

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      success: false,
      error: 'AuthenticationRequired',
      message: 'Authorization header is missing. Bearer token required.'
    });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({
      success: false,
      error: 'InvalidTokenFormat',
      message: 'Token format must be "Bearer <token>"'
    });
    return;
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as UserPayload;
    req.user = decoded;
    next();
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: 'TokenExpiredOrInvalid',
      message: 'The access token provided is invalid or has expired.'
    });
  }
}
