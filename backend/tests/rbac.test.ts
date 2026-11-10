import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { inMemoryStore } from '../src/db';
import { seedInitialData } from '../src/prisma/seed';
import { AuthService } from '../src/services/auth.service';

describe('RBAC Middleware & Permissions Tests', () => {
  let adminToken: string;
  let driverToken: string;
  let auditorToken: string;

  beforeEach(async () => {
    inMemoryStore.clear();
    await seedInitialData();

    const adminLogin = await AuthService.login({ email: 'admin@medswift.com', password: 'AdminPass123!' });
    adminToken = adminLogin.token;

    const driverLogin = await AuthService.login({ email: 'driver@medswift.com', password: 'DriverPass123!' });
    driverToken = driverLogin.token;

    const auditorLogin = await AuthService.login({ email: 'auditor@medswift.com', password: 'AuditorPass123!' });
    auditorToken = auditorLogin.token;
  });

  it('Admin should be permitted to create shipments', async () => {
    const res = await request(app)
      .post('/api/v1/shipments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        origin: 'Bogura Warehouse',
        destination: 'Rajshahi Clinic',
        minTemp: 2.0,
        maxTemp: 8.0
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('Driver should be forbidden from creating shipments', async () => {
    const res = await request(app)
      .post('/api/v1/shipments')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        origin: 'Bogura Warehouse',
        destination: 'Rajshahi Clinic'
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('External Auditor should have read-only access to verify ledger', async () => {
    const res = await request(app)
      .get('/api/v1/audit/shipments/shipment-medswift-demo-01/verify-ledger')
      .set('Authorization', `Bearer ${auditorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('External Auditor must be blocked from any mutation endpoints (POST/PUT/PATCH/DELETE)', async () => {
    const res = await request(app)
      .post('/api/v1/shipments')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({
        origin: 'Illegal Auditor Attempt',
        destination: 'Nowhere'
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('AuditorReadOnlyAccess');
  });
});
