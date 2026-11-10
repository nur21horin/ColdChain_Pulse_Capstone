import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthenticatedRequest } from '../middleware/auth';

export class AuthController {
  public static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.register(req.body);
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  public static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await AuthService.login({
        email: req.body.email,
        password: req.body.password,
        ipAddress,
        userAgent
      });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  public static async me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        data: req.user
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getFailedLogins(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const logs = await AuthService.getFailedLoginLogs();
      res.status(200).json({
        success: true,
        count: logs.length,
        data: logs
      });
    } catch (err) {
      next(err);
    }
  }
}
