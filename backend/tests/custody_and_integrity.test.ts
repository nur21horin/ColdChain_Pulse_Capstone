import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { inMemoryStore } from '../src/db';
import { seedInitialData } from '../src/prisma/seed';
import { AuthService } from '../src/services/auth.service';
import { TelemetryService } from '../src/services/telemetry.service';
import { AuditService } from '../src/services/audit.service';
import { CustodyService } from '../src/services/custody.service';
import { CustodyStage, ConditionStatus, Role } from '../src/types';

describe('Chain of Custody & Cryptographic Tamper Detection', () => {
  let driverToken: string;
  let receiverToken: string;
  const demoShipmentId = 'shipment-medswift-demo-01';

  beforeEach(async () => {
    inMemoryStore.clear();
    await seedInitialData();

    const driverLogin = await AuthService.login({ email: 'driver@medswift.com', password: 'DriverPass123!' });
    driverToken = driverLogin.token;

    const receiverLogin = await AuthService.login({ email: 'receiver@medswift.com', password: 'ReceiverPass123!' });
    receiverToken = receiverLogin.token;
  });

  it('should record pickup handoff with QR code and transition shipment to IN_TRANSIT', async () => {
    const res = await request(app)
      .post('/api/v1/custody/handoff')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        shipmentId: demoShipmentId,
        stage: 'PICKUP',
        conditionStatus: 'SEALED_INTACT',
        qrCodeData: 'QR-MED-DHAKA-CENTRAL',
        notes: 'Loaded into reefer unit'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.record.hash).toBeDefined();

    const shipment = inMemoryStore.shipments.get(demoShipmentId);
    expect(shipment?.status).toBe('IN_TRANSIT');
  });

  it('should record delivery handoff with signature and transition shipment to DELIVERED', async () => {
    const res = await request(app)
      .post('/api/v1/custody/handoff')
      .set('Authorization', `Bearer ${receiverToken}`)
      .send({
        shipmentId: demoShipmentId,
        stage: 'DELIVERY',
        conditionStatus: 'SEALED_INTACT',
        pinCode: '4421',
        signature: 'Sig_Dr_Yeamin_Chittagong_Clinic',
        notes: 'Vaccines received in sound condition'
      });

    expect(res.status).toBe(201);
    const shipment = inMemoryStore.shipments.get(demoShipmentId);
    expect(shipment?.status).toBe('DELIVERED');
  });

  it('should support corrections by referencing old record supersedesId', async () => {
    // 1st record with minor typo
    const original = await CustodyService.recordHandoff({
      shipmentId: demoShipmentId,
      stage: CustodyStage.IN_TRANSIT_CHECKPOINT,
      actorId: 'driver-id',
      actorRole: Role.DRIVER,
      pinCode: '1111',
      conditionStatus: ConditionStatus.SEALED_INTACT,
      notes: 'Checkpoint Comilla - temp 4.0C'
    });

    // Correction referencing supersedesId
    const res = await request(app)
      .post('/api/v1/custody/handoff')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        shipmentId: demoShipmentId,
        stage: 'IN_TRANSIT_CHECKPOINT',
        conditionStatus: 'SEALED_INTACT',
        pinCode: '1111',
        notes: 'CORRECTION: Checkpoint Feni (was mislabeled Comilla)',
        supersedesId: original.record.id
      });

    expect(res.status).toBe(201);
    expect(res.body.data.record.supersedesId).toBe(original.record.id);
  });

  it('should detect unauthorized tampering if a record is modified in storage', async () => {
    // Ingest 3 readings
    await TelemetryService.ingestReading({
      shipmentId: demoShipmentId,
      temperature: 4.0,
      humidity: 50.0,
      latitude: 23.81,
      longitude: 90.41
    });
    await TelemetryService.ingestReading({
      shipmentId: demoShipmentId,
      temperature: 4.2,
      humidity: 51.0,
      latitude: 23.82,
      longitude: 90.42
    });

    // Verify ledger is initially valid
    const audit1 = await AuditService.verifyShipmentLedger(demoShipmentId);
    expect(audit1.isTampered).toBe(false);
    expect(audit1.integrityStatus).toBe('VALID');

    // Simulate malicious tampering: attacker modifies temperature of the 1st reading
    const readings = inMemoryStore.telemetry.get(demoShipmentId)!;
    readings[0].temperature = 18.5; // Tampered!

    // Verify ledger detects tampering immediately!
    const audit2 = await AuditService.verifyShipmentLedger(demoShipmentId);
    expect(audit2.isTampered).toBe(true);
    expect(audit2.integrityStatus).toBe('COMPROMISED');
    expect(audit2.tamperDetails).toBeDefined();
    expect(audit2.tamperDetails![0]).toContain('hash mismatch');
  });
});
