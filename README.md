# ColdChain Pulse

**Pharmaceutical & Vaccine Cold-Chain Monitoring Platform**  
**Client:** MedSwift Logistics Ltd.  
**Capstone Company:** 41_A2 (DS Major) | **CTO:** CR | **Tech Lead:** Co_CR  
**Department:** Backend & Data Engineering + Frontend Web/PWA Squad  

---

## 📋 Overview

ColdChain Pulse is a complete cold-chain monitoring system ensuring unbroken custody, live IoT temperature/humidity tracking, automated alert escalation, offline-first driver PWA operations, and regulator-ready tamper-evident audit trails.

### Project Directory Structure

```text
ColdChain_Pulse_Capstone_1/
├── backend/                       # Express + TypeScript REST API, Alert Engine, Hash Chaining, Prisma
│   ├── src/                       # Controllers, Services, Middleware, Simulator, Swagger Docs
│   ├── prisma/                    # Schema (schema.prisma) & Append-Only Triggers (triggers.sql)
│   ├── tests/                     # 16 Unit & Integration Tests (100% passing)
│   ├── postman/                   # ColdChain_Pulse_API.postman_collection.json
│   ├── docs/                      # Final Database Schema (ERD) & Frontend API Contract
│   └── vercel.json                # Vercel serverless deployment config
├── frontend/                      # Next.js 14 + React 18 + TypeScript PWA Web App
│   ├── src/                       # Dispatcher Board, Driver Handoff, Auditor Portal, Offline Outbox
│   └── public/                    # Service Worker (sw.js) & Web App Manifest
├── design/                        # 7 UI Prototype Mockups (.dc.html)
└── docs/                          # Product Requirements Document (PRD.md)
```

---

## 🔑 System Credentials & Demo Accounts

### 1. Backend REST API Accounts (JWT + Bcrypt Authentication)
Use these credentials for API calls, Postman, Swagger UI, or when running the frontend in `live` mode:

| Role | Email | Password | Primary Permissions |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@medswift.com` | `AdminPass123!` | Full administrative access, user management, security audit log |
| **Dispatcher** | `dispatcher@medswift.com` | `DispatchPass123!` | Create shipments, configure thresholds (2°C - 8°C), assign vehicles/drivers, ack alerts |
| **Driver** | `driver@medswift.com` | `DriverPass123!` | Ingest telemetry readings, record pickup/in-transit custody handoffs, sync offline queue |
| **Clinic Receiver** | `receiver@medswift.com` | `ReceiverPass123!` | Verify clinic delivery, inspect physical condition, confirm handoff with PIN / Signature |
| **External Auditor** | `auditor@medswift.com` | `AuditorPass123!` | **Strictly read-only**: Verify hash chain ledger integrity, download tamper-evident PDF/CSV reports |

---

### 2. Frontend Mock Mode Accounts (`NEXT_PUBLIC_API_MODE=mock`)
When running the frontend in self-contained demo mock mode, log in with password `demo1234`:

| Role | Username / Email | Password | Notes |
| :--- | :--- | :--- | :--- |
| **Dispatcher** | `dispatch@demo.coldchain` | `demo1234` | Full live board overview with search and filter |
| **Driver (Normal)** | `driver@demo.coldchain` | `demo1234` | Assigned to shipment MED-8821 in safe temperature range |
| **Driver (Critical)** | `driver2@demo.coldchain` | `demo1234` | Demonstrates the full-screen Critical Takeover warning screen |
| **Clinic Receiver** | `clinic@demo.coldchain` | `demo1234` | Delivery confirmation and intake inspection |
| **External Auditor** | `auditor@demo.coldchain` | `demo1234` | Audit portal with simulated tampering detection (Demo step 7) |
| **Admin** | `admin@demo.coldchain` | `demo1234` | Full administrative preview |

---

## 🚀 Running the Full Stack

### 1. Start the Backend API (Port 3000)
```bash
cd backend
npm install
npm test            # Runs 16 unit & integration tests
npm start           # Starts server on http://localhost:3000
```
* **Swagger UI:** [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
* **Health Check:** [http://localhost:3000/health](http://localhost:3000/health)
* **Real-time SSE Live Stream:** [http://localhost:3000/api/v1/live/stream](http://localhost:3000/api/v1/live/stream)

### 2. Start the IoT Telemetry Simulator
Simulates a vehicle traveling the Dhaka–Chittagong highway, streaming temperature and humidity readings every 30 seconds into the backend:
```bash
cd backend
npm run simulator
```

### 3. Start the Frontend Web Application (Port 3001)
```bash
cd frontend
npm install
npm test            # Runs 22 unit tests
npm run dev -- -p 3001
```
Open [http://localhost:3001](http://localhost:3001) in your browser.

* To switch frontend from **mock** to **live backend**, edit `frontend/.env.local`:
  ```env
  NEXT_PUBLIC_API_MODE=live
  NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
  ```

---

## 🛡️ Core Features & Technical Highlights

### 1. Cryptographic Tamper-Evident Hash Chaining
* Every telemetry reading and custody handoff is chained using SHA-256:
  $$\text{hash}_n = \text{SHA-256}(\text{prevHash} \parallel \text{shipmentId} \parallel \text{recordedAt} \parallel \text{payload})$$
* **Ledger Verification:** `GET /api/v1/audit/shipments/:id/verify-ledger` recalculates the chain from genesis. If any database record is modified, the audit flags `isTampered: true` and identifies the compromised record.
* **Database Triggers:** PostgreSQL trigger functions in `prisma/triggers.sql` strictly block `UPDATE` and `DELETE` queries at the database engine level.

### 2. Alert Engine (No False Positives)
* **Warning Alert:** Fires immediately when temperature enters within 0.5°C of the limit (e.g. 7.5°C for an 8.0°C upper bound).
* **Critical Breach Alert:** Fires only when an excursion lasts **longer than 10 continuous minutes**, avoiding false positives from transient door openings.
* **Auto-Resolution:** Automatically clears the active breach timer when temperatures normalize back into range.

### 3. Offline-First PWA & Idempotent Sync
* The driver application queues handoffs and manual readings in IndexedDB when offline.
* On reconnection, `POST /api/v1/sync/telemetry/batch` and `POST /api/v1/sync/custody/batch` process queued records using client-generated UUIDs. Replays are deduplicated idempotently with 0 duplicate records.

### 4. Tamper-Evident Batch Reports (PDF & CSV)
* Generates audit reports sealed with a top-level cryptographic SHA-256 fingerprint covering the shipment, custody logs, telemetry, and alerts.
* Endpoints:
  - PDF: `GET /api/v1/audit/reports/:shipmentId/pdf`
  - CSV: `GET /api/v1/audit/reports/:shipmentId/csv`

---

## 🧪 Test Suites

### Backend Tests (Vitest)
```bash
cd backend && npm test
```
* `tests/auth.test.ts` (3 tests) - Login, bcrypt password hashing, failed login audit logs
* `tests/rbac.test.ts` (4 tests) - Role boundaries and auditor read-only enforcement
* `tests/telemetry_and_alerts.test.ts` (4 tests) - Hash chaining, warning logic, 10-min breach logic
* `tests/custody_and_integrity.test.ts` (4 tests) - QR handoff, signature, supersedesId, tamper detection
* `tests/offline_sync.test.ts` (1 test) - Idempotent batch deduplication
* **Result:** **16 passed (100%)**

### Frontend Tests (Vitest)
```bash
cd frontend && npm test
```
* `src/lib/rbac.test.ts` (3 tests) - Route guarding and role claims
* `src/lib/offline/outbox.test.ts` (6 tests) - Offline queue, retry backoff, and sync
* `src/lib/alerts.test.ts` (13 tests) - Level classification, sparkline derivation, 10-min duration tracking
* **Result:** **22 passed (100%)**

---

## 📦 Deployment

* **Backend:** Configured with `vercel.json` and `api/index.ts` for Vercel Serverless deployment and Neon / Supabase PostgreSQL.
* **Frontend:** Standard Next.js Vercel 1-click deployment.
* **Postman:** Import [`backend/postman/ColdChain_Pulse_API.postman_collection.json`](backend/postman/ColdChain_Pulse_API.postman_collection.json) to test all REST endpoints.
