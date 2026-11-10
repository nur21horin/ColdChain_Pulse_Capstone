import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import {
  Role,
  ShipmentStatus,
  AlertSeverity,
  AlertType,
  CustodyStage,
  ConditionStatus,
  UserPayload,
  FailedLoginRecord,
  TelemetryReadingRecord,
  AlertRecord,
  CustodyRecord,
  ShipmentRecord
} from '../types';

export interface UserEntity {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditReportRecord {
  id: string;
  shipmentId: string;
  generatedById: string;
  reportType: string;
  sha256Hash: string;
  dataSummaryJson: string;
  generatedAt: string;
}

// In-memory ledger storage for immediate local runtime, testing, and fallback
class InMemoryStore {
  public users: Map<string, UserEntity> = new Map();
  public failedLogins: FailedLoginRecord[] = [];
  public shipments: Map<string, ShipmentRecord> = new Map();
  public telemetry: Map<string, TelemetryReadingRecord[]> = new Map(); // shipmentId -> array
  public telemetryById: Map<string, TelemetryReadingRecord> = new Map();
  public alerts: AlertRecord[] = [];
  public custodyRecords: Map<string, CustodyRecord[]> = new Map(); // shipmentId -> array
  public custodyById: Map<string, CustodyRecord> = new Map();
  public auditReports: AuditReportRecord[] = [];

  // Breach tracking map for active shipments: shipmentId -> { breachStartTime: Date, breachType: AlertType }
  public activeBreaches: Map<string, { startTime: Date; type: AlertType; peakTemp: number }> = new Map();

  public clear() {
    this.users.clear();
    this.failedLogins = [];
    this.shipments.clear();
    this.telemetry.clear();
    this.telemetryById.clear();
    this.alerts = [];
    this.custodyRecords.clear();
    this.custodyById.clear();
    this.auditReports = [];
    this.activeBreaches.clear();
  }
}

export const inMemoryStore = new InMemoryStore();

// Cryptographic SHA-256 helper
export function computeSha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Compute hash for a telemetry reading chained to previous hash
export function calculateTelemetryHash(
  prevHash: string,
  shipmentId: string,
  recordedAt: string,
  temperature: number,
  humidity: number,
  latitude: number,
  longitude: number
): string {
  const payload = `${prevHash}|${shipmentId}|${recordedAt}|${temperature.toFixed(2)}|${humidity.toFixed(2)}|${latitude.toFixed(4)}|${longitude.toFixed(4)}`;
  return computeSha256(payload);
}

// Compute hash for a chain of custody record chained to previous hash
export function calculateCustodyHash(
  prevHash: string,
  shipmentId: string,
  stage: string,
  actorId: string,
  recordedAt: string,
  conditionStatus: string,
  qrCodeData?: string,
  pinCode?: string,
  supersedesId?: string
): string {
  const payload = `${prevHash}|${shipmentId}|${stage}|${actorId}|${recordedAt}|${conditionStatus}|${qrCodeData || ''}|${pinCode || ''}|${supersedesId || ''}`;
  return computeSha256(payload);
}

// Prisma Client instance
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export let isPrismaConnected = false;

export async function checkPrismaConnection(): Promise<boolean> {
  try {
    // Only attempt if not in test environment and URL looks reachable
    if (process.env.NODE_ENV === 'test') {
      isPrismaConnected = false;
      return false;
    }
    await prisma.$queryRaw`SELECT 1`;
    isPrismaConnected = true;
    console.log('[Database] Connected to PostgreSQL database via Prisma.');
    return true;
  } catch (err) {
    isPrismaConnected = false;
    console.log('[Database] PostgreSQL not connected. Utilizing in-memory tamper-evident cryptographic ledger store.');
    return false;
  }
}
