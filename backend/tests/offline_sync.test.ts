import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { inMemoryStore } from '../src/db';
import { seedInitialData } from '../src/prisma/seed';
import { AuthService } from '../src/services/auth.service';

describe('Offline Sync Support & Idempotency Tests', () => {
  let driverToken: string;
  const demoShipmentId = 'shipment-medswift-demo-01';

  beforeEach(async () => {
    inMemoryStore.clear();
    await seedInitialData();

    const driverLogin = await AuthService.login({ email: 'driver@medswift.com', password: 'DriverPass123!' });
    driverToken = driverLogin.token;
  });

  it('should process batch of queued telemetry readings and remain strictly idempotent on retries', async () => {
    const batchPayload = {
      batch: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          shipmentId: demoShipmentId,
          temperature: 4.1,
          humidity: 48.0,
          latitude: 23.8100,
          longitude: 90.4100,
          recordedAt: '2026-11-10T09:00:00.000Z'
        },
        {
          id: '22222222-2222-2222-2222-222222222222',
          shipmentId: demoShipmentId,
          temperature: 4.3,
          humidity: 49.0,
          latitude: 23.8200,
          longitude: 90.4200,
          recordedAt: '2026-11-10T09:00:30.000Z'
        }
      ]
    };

    // First attempt: both inserted
    const res1 = await request(app)
      .post('/api/v1/sync/telemetry/batch')
      .set('Authorization', `Bearer ${driverToken}`)
      .send(batchPayload);

    expect(res1.status).toBe(200);
    expect(res1.body.data.newInserted).toBe(2);
    expect(res1.body.data.duplicatesSkipped).toBe(0);

    // Second attempt (driver app retried due to mobile network reconnect)
    const res2 = await request(app)
      .post('/api/v1/sync/telemetry/batch')
      .set('Authorization', `Bearer ${driverToken}`)
      .send(batchPayload);

    expect(res2.status).toBe(200);
    expect(res2.body.data.newInserted).toBe(0);
    expect(res2.body.data.duplicatesSkipped).toBe(2); // Perfectly deduplicated!

    // Verify stored count is still exactly 2
    const readings = inMemoryStore.telemetry.get(demoShipmentId)!;
    expect(readings.length).toBe(2);
  });
});
