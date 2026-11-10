import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  public statusCode: number;
  public errorCode: string;

  constructor(message: string, statusCode: number = 500, errorCode: string = 'InternalServerError') {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const statusCode = err.statusCode || (err.status ? err.status : 500);
  const errorCode = err.errorCode || 'InternalServerError';
  const message = err.message || 'An unexpected error occurred processing your request.';

  if (process.env.NODE_ENV !== 'test') {
    console.error(`[Error] ${errorCode} (${statusCode}):`, err);
  }

  res.status(statusCode).json({
    success: false,
    error: errorCode,
    message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
}
