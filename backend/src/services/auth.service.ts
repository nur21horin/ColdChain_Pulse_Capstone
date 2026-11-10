import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { inMemoryStore, prisma, isPrismaConnected } from '../db';
import { Role, UserPayload, FailedLoginRecord } from '../types';
import { AppError } from '../middleware/errorHandler';

export interface RegisterDTO {
  email: string;
  password: string;
  name: string;
  role?: Role;
}

export interface LoginDTO {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AuthService {
  /**
   * Log failed login attempt for security auditing
   */
  public static async logFailedLogin(
    email: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<FailedLoginRecord> {
    const record: FailedLoginRecord = {
      id: uuidv4(),
      email,
      ipAddress: ipAddress || 'unknown',
      userAgent: userAgent || 'unknown',
      reason,
      attemptedAt: new Date().toISOString()
    };

    inMemoryStore.failedLogins.push(record);

    if (isPrismaConnected) {
      try {
        await prisma.failedLoginLog.create({
          data: {
            id: record.id,
            email: record.email,
            ipAddress: record.ipAddress,
            userAgent: record.userAgent,
            reason: record.reason,
            attemptedAt: new Date(record.attemptedAt)
          }
        });
      } catch (err) {
        console.error('[AuthService] Error persisting failed login log to DB:', err);
      }
    }

    return record;
  }

  /**
   * Get all failed login attempts (for security auditing)
   */
  public static async getFailedLoginLogs(): Promise<FailedLoginRecord[]> {
    if (isPrismaConnected) {
      try {
        const logs = await prisma.failedLoginLog.findMany({
          orderBy: { attemptedAt: 'desc' }
        });
        return logs.map(l => ({
          id: l.id,
          email: l.email,
          ipAddress: l.ipAddress || undefined,
          userAgent: l.userAgent || undefined,
          reason: l.reason,
          attemptedAt: l.attemptedAt.toISOString()
        }));
      } catch (err) {
        console.error('[AuthService] Falling back to memory for failed login logs:', err);
      }
    }
    return [...inMemoryStore.failedLogins].reverse();
  }

  /**
   * Register a new user
   */
  public static async register(data: RegisterDTO) {
    const existing = inMemoryStore.users.get(data.email.toLowerCase());
    if (existing) {
      throw new AppError('User with this email already exists', 400, 'UserAlreadyExists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);
    const id = uuidv4();
    const now = new Date().toISOString();

    const userEntity = {
      id,
      email: data.email.toLowerCase(),
      passwordHash,
      name: data.name,
      role: data.role || Role.DRIVER,
      isActive: true,
      createdAt: now,
      updatedAt: now
    };

    inMemoryStore.users.set(userEntity.email, userEntity);

    if (isPrismaConnected) {
      try {
        await prisma.user.create({
          data: {
            id: userEntity.id,
            email: userEntity.email,
            passwordHash: userEntity.passwordHash,
            name: userEntity.name,
            role: userEntity.role,
            isActive: userEntity.isActive,
            createdAt: new Date(userEntity.createdAt),
            updatedAt: new Date(userEntity.updatedAt)
          }
        });
      } catch (err) {
        console.error('[AuthService] Error syncing registered user to Postgres:', err);
      }
    }

    const token = this.generateToken(userEntity);

    return {
      user: {
        id: userEntity.id,
        email: userEntity.email,
        name: userEntity.name,
        role: userEntity.role
      },
      token
    };
  }

  /**
   * Login with email and password
   */
  public static async login(data: LoginDTO) {
    const emailKey = data.email.toLowerCase();
    const user = inMemoryStore.users.get(emailKey);

    if (!user) {
      await this.logFailedLogin(data.email, 'AccountNotFound', data.ipAddress, data.userAgent);
      throw new AppError('Invalid email or password credentials', 401, 'InvalidCredentials');
    }

    if (!user.isActive) {
      await this.logFailedLogin(data.email, 'AccountDeactivated', data.ipAddress, data.userAgent);
      throw new AppError('User account has been deactivated', 403, 'AccountInactive');
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      await this.logFailedLogin(data.email, 'IncorrectPassword', data.ipAddress, data.userAgent);
      throw new AppError('Invalid email or password credentials', 401, 'InvalidCredentials');
    }

    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    };
  }

  /**
   * Generate signed JWT
   */
  public static generateToken(user: { id: string; email: string; name: string; role: Role }): string {
    const payload: UserPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };

    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any
    });
  }

  /**
   * Find user by ID
   */
  public static async findById(id: string) {
    for (const u of inMemoryStore.users.values()) {
      if (u.id === id) return u;
    }
    return null;
  }
}
