export enum Role {
  ADMIN = 'ADMIN',
  DISPATCHER = 'DISPATCHER',
  DRIVER = 'DRIVER',
  CLINIC_RECEIVER = 'CLINIC_RECEIVER',
  EXTERNAL_AUDITOR = 'EXTERNAL_AUDITOR'
}

export enum ShipmentStatus {
  PENDING = 'PENDING',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  COMPROMISED = 'COMPROMISED',
  CANCELLED = 'CANCELLED'
}

export enum AlertSeverity {
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}

export enum AlertType {
  TEMP_HIGH_WARNING = 'TEMP_HIGH_WARNING',
  TEMP_LOW_WARNING = 'TEMP_LOW_WARNING',
  TEMP_BREACH_CRITICAL = 'TEMP_BREACH_CRITICAL',
  HUMIDITY_WARNING = 'HUMIDITY_WARNING',
  HUMIDITY_CRITICAL = 'HUMIDITY_CRITICAL',
  SENSOR_OFFLINE = 'SENSOR_OFFLINE'
}

export enum CustodyStage {
  PICKUP = 'PICKUP',
  IN_TRANSIT_CHECKPOINT = 'IN_TRANSIT_CHECKPOINT',
  DELIVERY = 'DELIVERY'
}

export enum ConditionStatus {
  SEALED_INTACT = 'SEALED_INTACT',
  DAMAGED = 'DAMAGED',
  TEMP_COMPROMISED = 'TEMP_COMPROMISED',
  LABEL_DAMAGED = 'LABEL_DAMAGED'
}

export interface UserPayload {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface FailedLoginRecord {
  id: string;
  email: string;
  ipAddress?: string;
  userAgent?: string;
  reason: string;
  attemptedAt: string;
}

export interface TelemetryReadingRecord {
  id: string;
  shipmentId: string;
  temperature: number;
  humidity: number;
  batteryLevel?: number;
  latitude: number;
  longitude: number;
  recordedAt: string;
  receivedAt: string;
  prevHash: string;
  hash: string;
  isWarning: boolean;
  isCritical: boolean;
  details?: string;
}

export interface AlertRecord {
  id: string;
  shipmentId: string;
  readingId?: string;
  severity: AlertSeverity;
  type: AlertType;
  message: string;
  breachDurationMinutes: number;
  triggeredAt: string;
  resolvedAt?: string;
  acknowledgedById?: string;
}

export interface CustodyRecord {
  id: string;
  shipmentId: string;
  stage: CustodyStage;
  actorId: string;
  actorRole: Role;
  qrCodeData?: string;
  pinCode?: string;
  signature?: string;
  conditionStatus: ConditionStatus;
  notes?: string;
  latitude?: number;
  longitude?: number;
  recordedAt: string;
  receivedAt: string;
  prevHash: string;
  hash: string;
  supersedesId?: string;
}

export interface ShipmentRecord {
  id: string;
  trackingNumber: string;
  origin: string;
  destination: string;
  vehicleId?: string;
  dispatcherId?: string;
  driverId?: string;
  receiverId?: string;
  minTemp: number;
  maxTemp: number;
  minHumidity?: number;
  maxHumidity?: number;
  status: ShipmentStatus;
  distanceKm?: number;
  eta?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}
