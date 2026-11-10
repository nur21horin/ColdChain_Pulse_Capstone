import type { Role } from '@/types/domain';

/** Mock-mode sign-ins. Password for all: demo1234. Not used when API mode is "live". */
export const DEMO_ACCOUNTS: { email: string; role: Role; note: string }[] = [
  { email: 'dispatch@demo.coldchain', role: 'DISPATCHER', note: 'Live board' },
  { email: 'driver@demo.coldchain', role: 'DRIVER', note: 'In-range shipment' },
  { email: 'driver2@demo.coldchain', role: 'DRIVER', note: 'Critical shipment' },
  { email: 'clinic@demo.coldchain', role: 'CLINIC_RECEIVER', note: 'Delivery sign-off' },
  { email: 'auditor@demo.coldchain', role: 'AUDITOR', note: 'Reports' },
  { email: 'admin@demo.coldchain', role: 'ADMIN', note: 'Everything' },
];
