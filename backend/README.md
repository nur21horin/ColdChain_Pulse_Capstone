# ColdChain Pulse – Backend API & IoT Telemetry Engine

**Client:** MedSwift Logistics Ltd.  
**Department:** Backend & Data Engineering  
**Technology Stack:** TypeScript (Node.js), Express, PostgreSQL (Neon / Supabase), Prisma ORM, JWT, Bcrypt, Zod, PDFKit, Vitest.

---

## 🌟 Overview & Key Features

1. **Authentication & Strict RBAC:**
   - Hashed credentials using `bcrypt` and signed JWT access tokens with role claims.
   - Comprehensive security auditing logging all failed login attempts with IP and timestamp.
   - 5 RBAC Roles: `Admin`, `Dispatcher`, `Driver`, `Clinic Receiver`, and `External Auditor` (strictly read-only).

2. **Tamper-Evident Cryptographic Hash Chaining:**
   - Blockchain-like cryptographic ledger: Every IoT telemetry reading and chain-of-custody handoff calculates a SHA-256 hash chained to the preceding record (`prevHash`).
   - Append-only architecture: Database triggers abort any `UPDATE` or `DELETE` attempt at the database engine level.
   - Real-time audit endpoint (`/api/v1/audit/shipments/:id/verify-ledger`) verifies chain integrity from genesis to head and detects any tampering.

3. **Intelligent IoT Telemetry & Alert Engine:**
   - Ingests temperature, humidity, battery, and GPS coordinates every 30s.
   - **Warning Logic:** Automatically triggers a warning when temperature approaches within 0.5°C of threshold boundaries.
   - **Critical Breach Logic:** Evaluates sustained duration and triggers a `CRITICAL` alert only when an excursion lasts **more than 10 minutes** consecutively, eliminating false positives from transient temperature spikes.
   - Automatic normalization and recovery tracking.

4. **Chain of Custody & Offline Sync Support:**
   - Verification via QR Code, PIN, or digital signature at pickup, checkpoints, and delivery.
   - Offline sync endpoints (`/api/v1/sync/telemetry/batch` and `/api/v1/sync/custody/batch`) accepting client-generated UUIDs with 100% idempotent deduplication.

5. **Tamper-Evident Audit Reports:**
   - Generates batch audit reports in **PDF** and **CSV** formats, sealed with a top-level SHA-256 cryptographic fingerprint for non-repudiation.

6. **Interactive Documentation & Live Simulator:**
   - Interactive OpenAPI / Swagger UI at `/api/docs`.
   - Standalone IoT Telemetry Simulator (`npm run simulator`) generating realistic temperature profiles and highway route movements.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js (v20+ or v26+)
- npm

### 2. Installation
```bash
npm install
```

### 3. Environment Configuration
Inspect or adjust `.env` (defaults are pre-configured):
```env
PORT=3000
NODE_ENV=development
JWT_SECRET=super-secret-jwt-key-coldchain-pulse-2026-medswift
DATABASE_URL=postgresql://postgres:password@localhost:5432/coldchain_pulse?schema=public
```

### 4. Running the Development Server
```bash
npm run dev
```
The server will start on `http://localhost:3000`.

### 5. Running the Test Suite
```bash
npm test
```
Runs 16 unit and integration test suites covering Auth, Security Audit, RBAC, Alert Engine, Hash Chaining, Offline Sync Idempotency, and Tamper Detection.

### 6. Running the IoT Telemetry Simulator
```bash
npm run simulator
```

### 7. Interactive API Documentation (Swagger)
Open your browser at:
`http://localhost:3000/api/docs`

---

## 👥 Seeded Test Credentials (5 RBAC Roles)

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@medswift.com` | `AdminPass123!` |
| **Dispatcher** | `dispatcher@medswift.com` | `DispatchPass123!` |
| **Driver** | `driver@medswift.com` | `DriverPass123!` |
| **Clinic Receiver** | `receiver@medswift.com` | `ReceiverPass123!` |
| **External Auditor** | `auditor@medswift.com` | `AuditorPass123!` |

---

## ☁️ Deployment

### Vercel Deployment
The repository includes `vercel.json` and `api/index.ts`. Deploy instantly with:
```bash
vercel --prod
```

### PostgreSQL (Neon / Supabase)
1. Add your Neon or Supabase connection string to `DATABASE_URL` in `.env` or Vercel Environment Variables.
2. Run database migration and triggers:
```bash
npx prisma db push
psql $DATABASE_URL -f prisma/triggers.sql
```
