import bcrypt from 'bcryptjs';
import { inMemoryStore, prisma, isPrismaConnected, checkPrismaConnection } from '../db';
import { Role, ShipmentStatus } from '../types';

export const TEST_USERS = [
  {
    name: 'Joy Chowdhury (Admin)',
    email: 'admin@medswift.com',
    password: 'AdminPass123!',
    role: Role.ADMIN
  },
  {
    name: 'Md Yeamin Mondol (Dispatcher)',
    email: 'dispatcher@medswift.com',
    password: 'DispatchPass123!',
    role: Role.DISPATCHER
  },
  {
    name: 'Gm Sabbir Ahmmed (Driver)',
    email: 'driver@medswift.com',
    password: 'DriverPass123!',
    role: Role.DRIVER
  },
  {
    name: 'Mollah Abu Saif Kiron (Clinic Receiver)',
    email: 'receiver@medswift.com',
    password: 'ReceiverPass123!',
    role: Role.CLINIC_RECEIVER
  },
  {
    name: 'External Health Auditor',
    email: 'auditor@medswift.com',
    password: 'AuditorPass123!',
    role: Role.EXTERNAL_AUDITOR
  }
];

export async function seedInitialData() {
  console.log('[Seed] Seeding initial test users for all 5 RBAC roles...');

  const seededUsers: Record<string, string> = {};

  for (const user of TEST_USERS) {
    const existing = inMemoryStore.users.get(user.email.toLowerCase());
    if (!existing) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(user.password, salt);
      const id = `user-${user.role.toLowerCase()}-01`;
      const now = new Date().toISOString();

      const entity = {
        id,
        email: user.email.toLowerCase(),
        passwordHash,
        name: user.name,
        role: user.role,
        isActive: true,
        createdAt: now,
        updatedAt: now
      };

      inMemoryStore.users.set(entity.email, entity);
      seededUsers[user.role] = id;
    } else {
      seededUsers[user.role] = existing.id;
    }
  }

  // Seed sample initial shipment
  const defaultShipmentId = 'shipment-medswift-demo-01';
  if (!inMemoryStore.shipments.has(defaultShipmentId)) {
    const now = new Date().toISOString();
    const shipment = {
      id: defaultShipmentId,
      trackingNumber: 'MED-20261110-DEMO',
      origin: 'Central Cold Storage, Dhaka',
      destination: 'Apex Vaccine Clinic, Chittagong',
      vehicleId: 'MED-REEFER-09',
      dispatcherId: seededUsers[Role.DISPATCHER],
      driverId: seededUsers[Role.DRIVER],
      receiverId: seededUsers[Role.CLINIC_RECEIVER],
      minTemp: 2.0,
      maxTemp: 8.0,
      minHumidity: 30.0,
      maxHumidity: 65.0,
      status: ShipmentStatus.IN_TRANSIT,
      distanceKm: 245,
      eta: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
      dispatchedAt: now,
      createdAt: now,
      updatedAt: now
    };
    inMemoryStore.shipments.set(defaultShipmentId, shipment);
  }

  console.log('[Seed] Successfully initialized 5 test users and sample shipment.');
}

if (require.main === module) {
  checkPrismaConnection().then(() => {
    seedInitialData().then(() => {
      console.log('Seed completed successfully.');
      process.exit(0);
    });
  });
}
