# ColdChain Pulse – Frontend API Contract & Integration Guide

**Client:** MedSwift Logistics Ltd.  
**Delivered by:** Backend & Data Engineering Team  
**OpenAPI Swagger UI:** `http://localhost:3000/api/docs`  
**OpenAPI JSON:** `http://localhost:3000/api/docs.json`  

---

## 1. Test Users Across All 5 RBAC Roles

The backend seeds test accounts for all 5 roles upon startup:

| Role | Email | Password | Primary Permissions |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@medswift.com` | `AdminPass123!` | Full system management, user administration, security audit logs |
| **Dispatcher** | `dispatcher@medswift.com` | `DispatchPass123!` | Create shipments, assign vehicles/drivers, configure thresholds, acknowledge alerts |
| **Driver** | `driver@medswift.com` | `DriverPass123!` | Ingest telemetry, submit pickup/in-transit custody handoffs, batch sync offline queue |
| **Clinic Receiver** | `receiver@medswift.com` | `ReceiverPass123!` | Inspect deliveries, confirm delivery handoffs (PIN / Signature), condition verification |
| **External Auditor** | `auditor@medswift.com` | `AuditorPass123!` | **Strictly read-only access**: Verify ledger integrity, download tamper-evident PDF/CSV reports |

---

## 2. Authentication Contract

Send standard Bearer tokens in the HTTP `Authorization` header:
```http
Authorization: Bearer <jwt_token>
```

### `POST /api/v1/auth/login`
- **Request Body:**
  ```json
  {
    "email": "driver@medswift.com",
    "password": "DriverPass123!"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "user": {
        "id": "user-driver-01",
        "email": "driver@medswift.com",
        "name": "Gm Sabbir Ahmmed (Driver)",
        "role": "DRIVER"
      },
      "token": "eyJhbGciOi..."
    }
  }
  ```
*Note: Failed logins are automatically tracked in the security audit ledger.*

---

## 3. Core Endpoints Reference

### A. Shipments & Dispatch (`/api/v1/shipments`)
| Method | Endpoint | Roles Allowed | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/` | `ADMIN`, `DISPATCHER` | Create shipment, set temperature thresholds (e.g. 2.0°C - 8.0°C) and calculate ETA |
| `GET` | `/` | All roles | List shipments (Drivers automatically receive assigned shipments) |
| `GET` | `/:id` | All roles | Get detailed shipment metadata and tracking info |
| `PATCH`| `/:id/assign` | `ADMIN`, `DISPATCHER` | Assign vehicle ID and driver ID |
| `PATCH`| `/:id/status` | `ADMIN`, `DISPATCHER`, `DRIVER` | Update shipment status (`PENDING`, `IN_TRANSIT`, `DELIVERED`, `COMPROMISED`) |

### B. IoT Telemetry & Alert Engine (`/api/v1/telemetry`)
| Method | Endpoint | Roles Allowed | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/ingest` | `ADMIN`, `DISPATCHER`, `DRIVER` | Ingest IoT sensor reading into SHA-256 hash chain. Evaluates 10-minute breach logic. |
| `GET` | `/:shipmentId` | All roles | Get time-series telemetry log for shipment |
| `GET` | `/alerts` | All roles | List active/historical alerts (`WARNING`, `CRITICAL`) |
| `PATCH`| `/alerts/:alertId/ack` | `ADMIN`, `DISPATCHER`, `CLINIC_RECEIVER` | Acknowledge active alert |

#### Telemetry Ingestion Payload:
```json
{
  "id": "c0a80101-0000-0000-0000-000000000001",
  "shipmentId": "shipment-medswift-demo-01",
  "temperature": 7.8,
  "humidity": 48.5,
  "batteryLevel": 94.0,
  "latitude": 23.8103,
  "longitude": 90.4125,
  "recordedAt": "2026-11-10T10:45:00.000Z"
}
```

#### Alert Trigger Rules:
1. **Warning Alert:** Raised immediately when temperature approaches the boundary (within 0.5°C of `minTemp` or `maxTemp`).
2. **Critical Alert:** Raised when temperature excursion outside thresholds lasts **more than 10 minutes** consecutively without false positives. Transitions shipment status to `COMPROMISED`.
3. **Normalized Event:** Emitted when temperature returns to safe limits, automatically resetting active excursion timer.

### C. Chain of Custody (`/api/v1/custody`)
| Method | Endpoint | Roles Allowed | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/handoff` | `ADMIN`, `DISPATCHER`, `DRIVER`, `CLINIC_RECEIVER` | Record tamper-evident handoff (Pickup, Checkpoint, Delivery) with QR code, PIN, or Signature. |
| `GET` | `/:shipmentId` | All roles | View immutable custody audit trail |

#### Handoff Payload:
```json
{
  "id": "b3e02511-9a4f-4d3e-9081-301298410212",
  "shipmentId": "shipment-medswift-demo-01",
  "stage": "DELIVERY",
  "conditionStatus": "SEALED_INTACT",
  "pinCode": "8821",
  "signature": "data:image/png;base64,...",
  "notes": "Verified cold storage upon intake.",
  "supersedesId": null
}
```
*Corrections: In accordance with data integrity rules, if a handoff record requires correction, pass the previous record's ID in `supersedesId`.*

### D. Offline Sync Support (`/api/v1/sync`)
Driver mobile apps operating in remote areas with intermittent connectivity queue readings and sync them upon regaining cellular network.
| Method | Endpoint | Roles Allowed | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/telemetry/batch` | `DRIVER`, `ADMIN`, `DISPATCHER` | **Idempotent** batch upload of queued telemetry. Skips duplicates by client-generated `id`. |
| `POST` | `/custody/batch` | `DRIVER`, `CLINIC_RECEIVER`, `ADMIN` | **Idempotent** batch upload of queued custody handoffs. |

### E. Cryptographic Audit & Reports (`/api/v1/audit`)
| Method | Endpoint | Roles Allowed | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/shipments/:id/verify-ledger` | `ADMIN`, `DISPATCHER`, `EXTERNAL_AUDITOR` | Recomputes and verifies complete SHA-256 hash chains. Detects any tampering or database edits. |
| `GET` | `/reports/:shipmentId/pdf` | `ADMIN`, `DISPATCHER`, `EXTERNAL_AUDITOR` | Generates tamper-evident PDF report with SHA-256 batch fingerprint. |
| `GET` | `/reports/:shipmentId/csv` | `ADMIN`, `DISPATCHER`, `EXTERNAL_AUDITOR` | Downloads raw telemetry CSV with cryptographic summary header. |
| `GET` | `/failed-logins` | `ADMIN`, `EXTERNAL_AUDITOR` | Security audit log of failed login attempts. |

### F. Real-time Live Updates (`/api/v1/live`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/stream?shipmentId=<id>` | Server-Sent Events (SSE) stream for live telemetry and alert events. |

Events emitted:
- `event: telemetry` -> Data: TelemetryReading object
- `event: alert` -> Data: Alert object
- `event: custody_handoff` -> Data: CustodyRecord object
