# ColdChain Pulse – Final Database Schema (ERD) & Data Integrity Architecture

**Client:** MedSwift Logistics Ltd.  
**Department:** Backend & Data Engineering  
**Version:** 1.0.0 (Production Candidate)

---

## 1. Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    User ||--o{ Shipment : "dispatches / drives / receives"
    User ||--o{ ChainOfCustody : "signs / records handoffs"
    User ||--o{ Alert : "acknowledges alerts"
    User ||--o{ AuditReport : "generates audit reports"

    Shipment ||--o{ TelemetryReading : "has append-only telemetry"
    Shipment ||--o{ Alert : "triggers condition alerts"
    Shipment ||--o{ ChainOfCustody : "has custody audit trail"
    Shipment ||--o{ AuditReport : "subject of audit reports"

    TelemetryReading ||--o{ Alert : "triggers warning or critical alert"
    ChainOfCustody ||--o| ChainOfCustody : "supersedes / corrects"

    User {
        string id PK "UUID"
        string email UK "Unique email address"
        string passwordHash "Bcrypt hashed credentials"
        string name "User full name"
        enum role "ADMIN | DISPATCHER | DRIVER | CLINIC_RECEIVER | EXTERNAL_AUDITOR"
        boolean isActive "Account active status"
        datetime createdAt
        datetime updatedAt
    }

    FailedLoginLog {
        string id PK "UUID"
        string email "Target email"
        string ipAddress "Remote IP address"
        string userAgent "Client User-Agent"
        string reason "AccountNotFound | IncorrectPassword"
        datetime attemptedAt
    }

    Shipment {
        string id PK "UUID"
        string trackingNumber UK "e.g. MED-20261110-XXXX"
        string origin "Origin cold-store or clinic"
        string destination "Target clinic or hospital"
        string vehicleId "Assigned reefer vehicle"
        string dispatcherId FK "User reference"
        string driverId FK "User reference"
        string receiverId FK "User reference"
        float minTemp "Minimum temperature (default 2.0C)"
        float maxTemp "Maximum temperature (default 8.0C)"
        float minHumidity "Minimum humidity (default 30%)"
        float maxHumidity "Maximum humidity (default 65%)"
        enum status "PENDING | IN_TRANSIT | DELIVERED | COMPROMISED | CANCELLED"
        float distanceKm "Route distance"
        datetime eta "Calculated ETA"
        datetime dispatchedAt
        datetime deliveredAt
        datetime createdAt
        datetime updatedAt
    }

    TelemetryReading {
        string id PK "Client-generated UUID for offline idempotency"
        string shipmentId FK "Shipment reference"
        float temperature "Sensor reading in Celsius"
        float humidity "Relative humidity percentage"
        float batteryLevel "IoT sensor battery %"
        float latitude "GPS latitude"
        float longitude "GPS longitude"
        datetime recordedAt "Client-recorded timestamp"
        datetime receivedAt "Server ingestion timestamp"
        string prevHash "SHA-256 of preceding reading (or GENESIS)"
        string hash "SHA-256(prevHash + shipmentId + recordedAt + temp + hum + lat + lng)"
        boolean isWarning "Approaching threshold flag"
        boolean isCritical "Sustained >10 min breach flag"
        string details "Excursion diagnostics"
    }

    Alert {
        string id PK "UUID"
        string shipmentId FK "Shipment reference"
        string readingId FK "Triggering reading reference"
        enum severity "WARNING | CRITICAL"
        enum type "TEMP_HIGH_WARNING | TEMP_LOW_WARNING | TEMP_BREACH_CRITICAL"
        string message "Human-readable diagnostic alert"
        float breachDurationMinutes "Duration of sustained excursion"
        datetime triggeredAt
        datetime resolvedAt
        string acknowledgedById FK "User reference"
    }

    ChainOfCustody {
        string id PK "Client-generated UUID for offline idempotency"
        string shipmentId FK "Shipment reference"
        enum stage "PICKUP | IN_TRANSIT_CHECKPOINT | DELIVERY"
        string actorId FK "User reference"
        enum actorRole "Role of custodian"
        string qrCodeData "Scanned QR code payload"
        string pinCode "PIN verification code"
        string signature "Digital signature or Base64"
        enum conditionStatus "SEALED_INTACT | DAMAGED | TEMP_COMPROMISED"
        string notes "Handoff condition inspection notes"
        float latitude "GPS latitude"
        float longitude "GPS longitude"
        datetime recordedAt "Client-recorded timestamp"
        datetime receivedAt "Server ingestion timestamp"
        string prevHash "SHA-256 of preceding custody record"
        string hash "SHA-256(prevHash + shipmentId + stage + actorId + timestamp + condition + qr + pin)"
        string supersedesId FK "References prior record if this is a correction"
    }

    AuditReport {
        string id PK "UUID"
        string shipmentId FK "Shipment reference"
        string generatedById FK "Auditor User reference"
        string reportType "PDF | CSV"
        string sha256Hash "Cryptographic batch fingerprint of complete record set"
        string dataSummaryJson "JSON summary of audited parameters"
        datetime generatedAt
    }
```

---

## 2. Data Integrity Architecture & Cryptographic Hash Chaining

The backend enforces two layers of data integrity:

### Layer 1: Cryptographic Hash Chaining (Blockchain-like Ledger)
- Every `TelemetryReading` calculates:
  $$\text{hash}_n = \text{SHA-256}(\text{prevHash} \parallel \text{shipmentId} \parallel \text{recordedAt} \parallel \text{temperature} \parallel \text{humidity} \parallel \text{lat} \parallel \text{lng})$$
  where $\text{prevHash}_0 = \text{"GENESIS"}$ and $\text{prevHash}_n = \text{hash}_{n-1}$.
- Every `ChainOfCustody` record calculates:
  $$\text{hash}_n = \text{SHA-256}(\text{prevHash} \parallel \text{shipmentId} \parallel \text{stage} \parallel \text{actorId} \parallel \text{recordedAt} \parallel \text{conditionStatus} \parallel \text{qrCodeData} \parallel \text{pinCode} \parallel \text{supersedesId})$$
- The audit endpoint (`/api/v1/audit/shipments/:id/verify-ledger`) recomputes the hash chain from genesis to head. If any value in the database has been modified, deleted, or inserted out of order, the verification halts and flags `isTampered: true` with the exact record ID.

### Layer 2: Append-Only Database Triggers (PostgreSQL)
In accordance with MedSwift Logistics specification:
- `telemetry_readings` and `chain_of_custody` are strictly append-only.
- The PostgreSQL triggers in `prisma/triggers.sql` abort any `UPDATE` or `DELETE` attempt at the database engine level with a `TAMPER_ALERT` exception.
- Corrections are made by adding a new record that references `supersedesId`.
