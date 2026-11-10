import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { inMemoryStore } from '../src/db';
import { seedInitialData } from '../src/prisma/seed';
import { AuthService } from '../src/services/auth.service';
import { TelemetryService } from '../src/services/telemetry.service';
import { AlertSeverity } from '../src/types';

describe('Telemetry Ingestion & Alert Engine (Warning/Critical Logic)', () => {
  let driverToken: string;
  const demoShipmentId = 'shipment-medswift-demo-01';

  beforeEach(async () => {
    inMemoryStore.clear();
    await seedInitialData();

    const driverLogin = await AuthService.login({ email: 'driver@medswift.com', password: 'DriverPass123!' });
    driverToken = driverLogin.token;
  });

  it('should ingest telemetry reading and link into SHA-256 hash chain with GENESIS prevHash', async () => {
    const res = await request(app)
      .post('/api/v1/telemetry/ingest')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        shipmentId: demoShipmentId,
        temperature: 4.5,
        humidity: 50.0,
        batteryLevel: 98.0,
        latitude: 23.8103,
        longitude: 90.4125
      });

    expect(res.status).toBe(201);
    expect(res.body.data.reading.prevHash).toBe('GENESIS');
    expect(res.body.data.reading.hash).toBeDefined();

    // Ingest second reading to verify chain linking
    const res2 = await request(app)
      .post('/api/v1/telemetry/ingest')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        shipmentId: demoShipmentId,
        temperature: 4.6,
        humidity: 50.5,
        latitude: 23.8200,
        longitude: 90.4200
      });

    expect(res2.status).toBe(201);
    expect(res2.body.data.reading.prevHash).toBe(res.body.data.reading.hash);
  });

  it('should trigger WARNING alert when temperature approaches upper threshold (e.g. 7.7°C when max is 8.0°C)', async () => {
    const res = await request(app)
      .post('/api/v1/telemetry/ingest')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        shipmentId: demoShipmentId,
        temperature: 7.7,
        humidity: 50.0,
        latitude: 23.8103,
        longitude: 90.4125
      });

    expect(res.status).toBe(201);
    expect(res.body.data.reading.isWarning).toBe(true);
    expect(res.body.data.alertsTriggered.length).toBeGreaterThan(0);
    expect(res.body.data.alertsTriggered[0].severity).toBe(AlertSeverity.WARNING);
  });

  it('should NOT trigger false-positive Critical alert if excursion is under 10 minutes', async () => {
    const now = new Date();

    // 1st excursion reading at T=0
    const res1 = await request(app)
      .post('/api/v1/telemetry/ingest')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        shipmentId: demoShipmentId,
        temperature: 9.2, // Breached (> 8.0°C)
        humidity: 50.0,
        latitude: 23.8103,
        longitude: 90.4125,
        recordedAt: now.toISOString()
      });

    expect(res1.body.data.reading.isCritical).toBe(false);
    expect(res1.body.data.reading.isWarning).toBe(true); // Warning initiated

    // 2nd excursion reading at T = 5 minutes (still < 10 mins)
    const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);
    const res2 = await request(app)
      .post('/api/v1/telemetry/ingest')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        shipmentId: demoShipmentId,
        temperature: 9.3,
        humidity: 50.0,
        latitude: 23.8103,
        longitude: 90.4125,
        recordedAt: fiveMinutesLater.toISOString()
      });

    expect(res2.body.data.reading.isCritical).toBe(false); // No false positive!
  });

  it('should trigger CRITICAL alert when breach duration exceeds 10 minutes', async () => {
    const now = new Date();

    // Excursion starts at T=0
    await TelemetryService.ingestReading({
      shipmentId: demoShipmentId,
      temperature: 9.5,
      humidity: 50.0,
      latitude: 23.8103,
      longitude: 90.4125,
      recordedAt: now.toISOString()
    });

    // Excursion continues at T = 11 minutes (> 10 min threshold)
    const elevenMinsLater = new Date(now.getTime() + 11 * 60 * 1000);
    const outcome = await TelemetryService.ingestReading({
      shipmentId: demoShipmentId,
      temperature: 9.6,
      humidity: 52.0,
      latitude: 23.8500,
      longitude: 90.4500,
      recordedAt: elevenMinsLater.toISOString()
    });

    expect(outcome.reading.isCritical).toBe(true);
    expect(outcome.alertsTriggered.some(a => a.severity === AlertSeverity.CRITICAL)).toBe(true);

    const shipment = inMemoryStore.shipments.get(demoShipmentId);
    expect(shipment?.status).toBe('COMPROMISED');
  });
});
