import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { inMemoryStore } from '../src/db';
import { seedInitialData } from '../src/prisma/seed';
import { AuthService } from '../src/services/auth.service';

describe('Auth & Security Audit Tests', () => {
  beforeEach(async () => {
    inMemoryStore.clear();
    await seedInitialData();
  });

  it('should successfully log in with seeded admin credentials and receive JWT token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@medswift.com',
        password: 'AdminPass123!'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('ADMIN');
  });

  it('should reject invalid password and log failed login attempt for security auditing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@medswift.com',
        password: 'WrongPassword999!'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);

    // Verify security audit log
    const failedLogs = await AuthService.getFailedLoginLogs();
    expect(failedLogs.length).toBeGreaterThan(0);
    expect(failedLogs[0].email).toBe('admin@medswift.com');
    expect(failedLogs[0].reason).toBe('IncorrectPassword');
  });

  it('should register a new driver user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Rahim Transport',
        email: 'rahim.driver@medswift.com',
        password: 'SecurePassword2026!',
        role: 'DRIVER'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('rahim.driver@medswift.com');
  });
});
