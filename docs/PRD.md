# ColdChain Pulse — Product Requirements Document

Draft v1.0 · 10 Nov 2026 · Team 41_A2 (DS Major) · CTO: CR · Tech Lead: Co_CR

Live, editable version: https://claude.ai/artifact/GrRSgS4h2J5vQVjNLG5Q3p

## 1. Summary

ColdChain Pulse is a web + mobile PWA that lets MedSwift Logistics watch every vaccine shipment's temperature live, prove who held it at each handoff, and hand regulators a tamper-evident report. The MVP must ship inside one 2.5-hour capstone sprint, so this PRD fixes a narrow, demo-able scope and defers the rest to Phase 2.

| Field | Value |
| --- | --- |
| Client | MedSwift Logistics Ltd. |
| Product | ColdChain Pulse — pharmaceutical & vaccine cold-chain tracking platform |
| Delivery team | 41_A2 (DS Major) |
| CTO | CR |
| Tech Lead | Co_CR |
| Delivery target | MVP demo at end of the 2.5-hour capstone sprint |
| Deployment | Vercel (web + API) or Streamlit; no custom DevOps infrastructure |
| Document status | Draft v1.0 — for PM, design and engineering sign-off |

**The MVP is done when** a dispatcher can create a 2–8 °C shipment, watch simulated sensor data stream in, see a Critical alert fire after a breach lasts more than 10 minutes, a driver can complete a QR + PIN handoff while offline and have it sync, and an auditor can download a CSV/PDF report whose hash chain verifies.

## 2. Problem, goals and success metrics

Drivers log temperatures on paper today, so a spoiled batch is only found at the clinic door — after the vaccine is already lost. ColdChain Pulse moves detection from delivery time to the moment of the excursion.

**Goals**

1. Detect temperature excursions in real time and alert the right people within one telemetry cycle (30 s).
2. Create an unbroken, digitally signed chain of custody from warehouse to clinic.
3. Keep the driver workflow working with no cellular signal, with zero data loss on reconnect.
4. Produce regulator-ready, tamper-evident batch reports on demand.

**Non-goals for the MVP**

- Real IoT hardware integration (simulated sensors only).
- Route optimisation or turn-by-turn navigation.
- Native iOS/Android apps (a PWA covers mobile).
- Billing, invoicing or inventory management.
- Multi-tenant support for other logistics companies.

**Success metrics (measured at the demo)**

| Metric | Target | How it is verified |
| --- | --- | --- |
| Alert latency | Warning/Critical shown ≤ 30 s after the triggering reading | Simulator injects a scripted breach; QA times it |
| Critical accuracy | 0 false Critical alerts; fires only after > 10 continuous min out of range | Unit tests on the alert engine with fixed timestamps |
| Offline sync | 100% of queued handoffs and logs synced, 0 duplicates | Toggle DevTools offline, perform 3 handoffs, reconnect, check DB |
| Dashboard load | 500 active shipments render, UI stays responsive (< 100 ms interactions) | Load script seeds 500 shipments; Lighthouse / Performance panel |
| RBAC coverage | 100% of API endpoints reject unauthorised roles | Automated RBAC test matrix |
| Report integrity | Editing any exported row breaks hash verification | Audit verify endpoint returns `valid: false` |

## 3. Users and access control

Five roles, each with the least privilege it needs. Every role check happens on the server; the UI only hides what the server already blocks.

| Role | Who they are | Primary device | Core job |
| --- | --- | --- | --- |
| Admin | MedSwift IT / ops lead | Desktop | Manage users, vehicles, clinics; view everything |
| Dispatcher | Control-room operator | Desktop, large screen | Create shipments, watch the live board, acknowledge alerts |
| Driver | Refrigerated-truck driver, often gloved, often offline | Phone (PWA) | Pickup/delivery handoffs, see own shipment temperature |
| Clinic Receiver | Pharmacist or nurse at a rural clinic | Phone or clinic PC | Scan QR, confirm condition, sign delivery |
| External Auditor | Regulator, read-only | Desktop | Browse history, download and verify reports |

**Permission matrix** (R = read, W = create, own = only records assigned to them, — = denied)

| Capability | Admin | Dispatcher | Driver | Clinic Receiver | Auditor |
| --- | --- | --- | --- | --- | --- |
| Manage users & roles | W | — | — | — | — |
| Manage vehicles & clinics | W | R | — | — | R |
| Create / assign shipment | W | W | — | — | — |
| View shipments | R all | R all | R own | R own (inbound) | R all |
| Ingest telemetry | Service token only | — | W own (offline log) | — | — |
| View telemetry | R | R | R own | R own | R |
| Acknowledge alert | W | W | W own | — | — |
| Pickup handoff | — | — | W own | — | — |
| Delivery handoff | — | — | W own | W own | — |
| Generate / download report | W | W | — | — | W |
| View auth audit log | R | — | — | — | R |
| Edit or delete telemetry / handoffs | — | — | — | — | — |

The last row is deliberate: nobody, including Admin, can edit or delete telemetry or handoff records. Corrections are new append-only records that reference the original.

## 4. Scope: MVP vs Phase 2

With 2.5 hours and a possibly reduced team, every one of the five modules must work end-to-end in its thinnest form, rather than two modules polished and three missing. Anything below "Must" is the PM team's ready-made answer to scope creep.

| Module | Must (MVP demo) | Should (if time remains) | Phase 2 (negotiated out) |
| --- | --- | --- | --- |
| 1. Dispatch & Route | Create shipment, assign vehicle + driver, set min/max °C, status list | Static ETA from distance ÷ avg speed | Live map, ETA from real GPS, route editing |
| 2. Telemetry & Alerts | Simulator posts temp/humidity every 30 s; Warning + Critical rules; in-app alert banner | Alert acknowledge flow; sound on Critical | SMS/email/push alerts, escalation chains |
| 3. Chain of Custody | QR scan (or manual code fallback) + 4-digit PIN; timestamp, GPS, condition saved | Canvas signature capture | Photo evidence, biometric sign-off |
| 4. Offline Driver Mode | IndexedDB queue for handoffs + logs, auto-sync on `online`, idempotent IDs | Offline banner + pending-count badge | Background Sync API, conflict UI |
| 5. Compliance & Audit | CSV export per shipment with SHA-256 hash chain; verify endpoint | PDF export | Scheduled reports, digital signatures (PKI) |
| Cross-cutting | JWT auth, bcrypt passwords, RBAC middleware, failed-login log, HTTPS | 500-shipment load test | SSO, MFA, full pen-test report |

**Change-request protocol.** Any new ask during the sprint goes to the PM team, who size it in story points, state what it would displace, and offer a Phase 2 slot by default. Only the CTO can move an item into Must.

## 5. Functional requirements

Each story is sized in Fibonacci points (1 point ≈ 10 focused minutes for this sprint) and tagged with the owning squad: PM, UX, FE, BE, QA.

### 5.1 Dispatch & Route Management

| ID | User story | Acceptance criteria | Pts | Squad | Depends on |
| --- | --- | --- | --- | --- | --- |
| DSP-1 | As a Dispatcher, I create a shipment so that a batch is tracked from origin to clinic. | Form requires batch no., product, origin warehouse, destination clinic, min °C, max °C (default 2 / 8). Server rejects min ≥ max. New shipment status = `CREATED`. | 3 | BE + FE | AUTH-1 |
| DSP-2 | As a Dispatcher, I assign a refrigerated vehicle and driver. | Only vehicles with `refrigerated = true` and not on an active shipment are selectable. Status → `ASSIGNED`. Driver sees it in the PWA on next sync. | 2 | BE + FE | DSP-1 |
| DSP-3 | As a Dispatcher, I see all active shipments on one board. | Table shows ID, clinic, driver, latest °C, status, alert level, ETA. Rows with Critical sort to top. Virtualised for 500+ rows. | 5 | FE | TEL-1 |
| DSP-4 | As a Dispatcher, I see an ETA for each shipment. | MVP: ETA = now + remaining distance ÷ 40 km/h, recomputed on each GPS ping. Shown as clock time. | 2 | BE | TEL-1 |

### 5.2 Telemetry & Excursion Alerts

| ID | User story | Acceptance criteria | Pts | Squad | Depends on |
| --- | --- | --- | --- | --- | --- |
| TEL-1 | As the system, I ingest a sensor reading every 30 s per active shipment. | `POST /telemetry` accepts shipment_id, temp_c, humidity_pct, lat, lng, recorded_at, reading_id. Duplicate `reading_id` returns 200 without inserting. Stored append-only. | 3 | BE | DSP-1 |
| TEL-2 | As QA/demo lead, I run a simulator that streams realistic data for N shipments. | CLI: `--shipments 500 --interval 30`. Normal drift ±0.3 °C around 5 °C; scenarios: `warning`, `breach-5min`, `breach-12min`. | 3 | BE | TEL-1 |
| TEL-3 | As a Dispatcher and Driver, I get a Warning when temperature approaches a limit. | Warning when reading is within 0.5 °C of min or max (configurable). Amber banner + row badge within one cycle. | 2 | BE + FE | TEL-1 |
| TEL-4 | As a Dispatcher and Driver, I get a Critical alert when a breach lasts > 10 min. | Critical fires only when every reading for a continuous window > 10 min is outside [min, max]. A breach of 9 min 59 s fires nothing Critical. One alert per episode. Red banner, distinct icon, not colour alone. | 5 | BE + FE | TEL-1 |
| TEL-5 | As a Dispatcher, I acknowledge an alert so the team knows it is being handled. | Ack stores user + time; alert stays in history; ack never edits or deletes the alert. | 2 | BE + FE | TEL-4 |

### 5.3 Chain-of-Custody Handoff

| ID | User story | Acceptance criteria | Pts | Squad | Depends on |
| --- | --- | --- | --- | --- | --- |
| COC-1 | As a Driver, I sign off pickup at the warehouse. | Scan shipment QR (fallback: type 8-char code) + PIN. Record `PICKUP`, timestamp, GPS, condition (`OK` / `DAMAGED` / `TEMP_SUSPECT`), actor. Status → `IN_TRANSIT`. | 3 | FE + BE | DSP-2 |
| COC-2 | As a Clinic Receiver, I confirm delivery. | QR + receiver PIN; driver PIN also required. Record `DELIVERY`. Status → `DELIVERED`. If any Critical alert exists, condition defaults to `TEMP_SUSPECT` and needs explicit acceptance. | 3 | FE + BE | COC-1 |
| COC-3 | As an Auditor, I see the ordered handoff log for a shipment. | Every handoff shows who, when, where, condition, and its hash. Never updated in place. | 2 | BE + FE | COC-1 |
| COC-4 | As a Driver, I add a signature (Should). | Canvas signature saved as PNG data URL linked to the handoff. | 2 | FE | COC-1 |

### 5.4 Offline-First Driver Mode

| ID | User story | Acceptance criteria | Pts | Squad | Depends on |
| --- | --- | --- | --- | --- | --- |
| OFF-1 | As a Driver, the app loads with no signal. | Service worker caches the app shell and my assigned shipments. Second load in airplane mode shows the shipment. | 3 | FE | DSP-2 |
| OFF-2 | As a Driver, my handoffs and logs are queued while offline. | Writes go to an IndexedDB outbox with a client UUID and `created_at`. UI confirms "Saved — will sync". | 3 | FE | COC-1 |
| OFF-3 | As a Driver, the queue syncs itself when signal returns. | On `online` (and every 30 s), outbox items POST in order. Server dedupes by UUID. Item removed only after 2xx. No duplicates after 3 offline/online cycles. | 5 | FE + BE | OFF-2 |
| OFF-4 | As a Driver, I always know my connection and sync state. | Persistent banner: Online / Offline / Syncing N. High contrast, ≥ 48 px targets. | 1 | UX + FE | OFF-2 |

### 5.5 Compliance & Audit Portal

| ID | User story | Acceptance criteria | Pts | Squad | Depends on |
| --- | --- | --- | --- | --- | --- |
| AUD-1 | As an Auditor, I download a batch report as CSV. | Shipment header, full temperature history, alerts with durations, handoff log, SLA breaches. Each row carries `prev_hash` and `hash`. | 3 | BE | TEL-1, COC-1 |
| AUD-2 | As an Auditor, I download the report as PDF (Should). | Same data plus final chain hash and generation time in the footer. | 3 | BE | AUD-1 |
| AUD-3 | As an Auditor, I verify a report has not been tampered with. | `GET /reports/:id/verify` recomputes the chain; returns `valid` and the first broken row. | 2 | BE | AUD-1 |
| AUD-4 | As an Admin/Auditor, I review failed logins. | Every failed login stores email tried, IP, user agent, time. Read-only. | 1 | BE | AUTH-1 |

### 5.6 Platform

| ID | User story | Acceptance criteria | Pts | Squad | Depends on |
| --- | --- | --- | --- | --- | --- |
| AUTH-1 | As any user, I log in and get my role's view. | bcrypt (cost ≥ 10); JWT with role claim, 8 h expiry; redirect by role. 5 failed tries in 15 min → 15-min lockout. | 3 | BE + FE | — |
| AUTH-2 | As the system, every endpoint enforces role and ownership. | `requireRole(...)` middleware + ownership check. Unauthorised → 403, logged. | 3 | BE | AUTH-1 |
| SEED-1 | As the team, we have demo data on first deploy. | 1 user per role, 10 vehicles, 5 clinics, 3 demo shipments. Credentials in README, not code. | 1 | BE | — |

## 6. Non-functional requirements

| ID | Area | Requirement | Verified by |
| --- | --- | --- | --- |
| NFR-1 | Data integrity | `telemetry_readings`, `handoffs`, `alerts`, `auth_events` are append-only; no UPDATE/DELETE routes; DB trigger raises on UPDATE/DELETE. | PATCH/DELETE → 405; direct SQL UPDATE → error |
| NFR-2 | Tamper evidence | `hash = SHA-256(prev_hash + canonical_json(row))` per shipment. | AUD-3 verify; edited row → `valid: false` |
| NFR-3 | Performance | Dashboard handles 500 active shipments with interactions < 100 ms. | Load test + Performance panel |
| NFR-4 | Performance | `POST /telemetry` p95 < 300 ms at 20 req/s; batches up to 100 readings. | k6 / Locust |
| NFR-5 | Security | HTTPS only; HSTS header. | Header check in CI |
| NFR-6 | Security | bcrypt passwords; no plaintext in code, logs or seeds. | Review + CI grep |
| NFR-7 | Security | Every failed login written to `auth_events` with IP and user agent. | AUD-4 test |
| NFR-8 | Security | Parameterised queries / ORM; schema validation (Zod/Pydantic); no `dangerouslySetInnerHTML`. | SQLi/XSS tests |
| NFR-9 | Availability | Driver PWA usable offline for ≥ 8 h (≥ 1,000 outbox items). | Offline soak test |
| NFR-10 | Usability | Driver targets ≥ 48 px, contrast ≥ 4.5:1, handoff ≤ 3 taps after scan, glove-friendly. | UX checklist |
| NFR-11 | Accessibility | Alert severity = icon + text + colour, never colour alone. | UX review |
| NFR-12 | Time | UTC ISO-8601 storage; breach duration from sensor `recorded_at`. | Alert engine tests |
| NFR-13 | Maintainability | No mock data in production builds; env-var config; typed API client. | Code review |

## 7. Architecture and tech stack

One TypeScript codebase (Next.js) serves the dashboard, audit portal, driver PWA and REST API, deployed to Vercel with managed Postgres.

```
IoT simulator ──POST /telemetry──┐
Driver PWA ────sync on reconnect─┼──► Next.js API on Vercel ──► PostgreSQL
Web app (dispatcher, auditor) ───┘    (auth+RBAC, alert engine,    (mutable tables +
                                       report service)              append-only ledgers)
```

| Layer | Choice | Why |
| --- | --- | --- |
| Web + API | Next.js (App Router, TypeScript) | One deploy target; shared types |
| Dashboard scale | Windowed table; dashboard reads `shipment_state` only | 500+ rows stay smooth |
| Driver PWA | Service worker, IndexedDB outbox, BarcodeDetector QR, Geolocation | Offline shell + queue |
| Validation & auth | Zod, `jose` (JWT), `bcryptjs` | Same schema client + server |
| Database | PostgreSQL (Supabase or Neon), Prisma | Free tier, migrations |
| Real-time | Supabase Realtime; 5 s polling fallback | Vercel functions can't hold WebSockets |
| Reports | Streamed CSV; PDF via `pdfkit` | Simple, server-side |
| Simulator | Node or Python CLI run from a laptop | Vercel cron too coarse for 30 s |
| Testing | Vitest, Supertest, Playwright, k6 | Unit, RBAC, offline E2E, load |

**Python-first alternative.** FastAPI + SQLAlchemy/Alembic for the API and Streamlit for the Audit Portal only. The Driver PWA and Dispatcher Dashboard must stay a JavaScript front end: Streamlit cannot run a service worker or work offline.

## 8. Data model

| Table | Kind | Key columns | Notes |
| --- | --- | --- | --- |
| `users` | Mutable | id, email, password_hash, role, pin_hash, clinic_id?, is_active | 5 roles |
| `vehicles` | Mutable | id, plate_no, refrigerated, sensor_id | |
| `clinics` | Mutable | id, name, lat, lng, district | |
| `warehouses` | Mutable | id, name, lat, lng | |
| `shipments` | Mutable | id, batch_no, product, origin_id, clinic_id, vehicle_id, driver_id, min_temp_c, max_temp_c, status, qr_token, eta_at, created_by | CREATED → ASSIGNED → IN_TRANSIT → DELIVERED / REJECTED |
| `shipment_state` | Mutable | shipment_id, last_reading_at, last_temp_c, out_of_range_since?, current_alert_level | Hot row for the dashboard |
| `telemetry_readings` | Append-only | id, reading_id (unique), shipment_id, recorded_at, received_at, temp_c, humidity_pct, lat, lng, source, prev_hash, hash | Index (shipment_id, recorded_at) |
| `alerts` | Append-only | id, shipment_id, level, episode_start, triggered_at, peak_temp_c, prev_hash, hash | One per episode per level |
| `alert_acks` | Append-only | id, alert_id, user_id, acked_at, note | |
| `handoffs` | Append-only | id, client_uuid (unique), shipment_id, type, actor_id, counterparty_id?, occurred_at, synced_at, lat, lng, condition, signature_url?, prev_hash, hash | |
| `reports` | Append-only | id, shipment_id, format, generated_by, generated_at, final_hash, file_url | |
| `auth_events` | Append-only | id, email_attempted, user_id?, success, ip, user_agent, at | |

```sql
CREATE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'append-only table: % on % is not allowed', TG_OP, TG_TABLE_NAME;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER telemetry_append_only
  BEFORE UPDATE OR DELETE ON telemetry_readings
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
-- repeat for alerts, alert_acks, handoffs, reports, auth_events
```

## 9. API contract (REST, v1)

All routes under `/api/v1`, JSON, `Authorization: Bearer <JWT>` except login. Error shape: `{ "error": { "code": "FORBIDDEN", "message": "..." } }`. Lists paginate with `?cursor=&limit=` (max 100).

| Method & path | Roles | Purpose | Notes |
| --- | --- | --- | --- |
| `POST /auth/login` | Public | Email + password → JWT | Logs failures; lockout after 5 in 15 min |
| `GET /me` | All | Current user + role | |
| `GET /shipments` | Admin, Dispatcher, Auditor (all); Driver, Receiver (own) | List with latest state | Filters: status, alert_level, clinic |
| `POST /shipments` | Admin, Dispatcher | Create | min < max |
| `PATCH /shipments/:id/assign` | Admin, Dispatcher | Assign vehicle + driver | Mutable fields only |
| `GET /shipments/:id` | Scoped | Detail + state + ETA | |
| `POST /telemetry` | Simulator token; Driver (own) | Ingest 1–100 readings | Idempotent on `reading_id` |
| `GET /shipments/:id/telemetry` | Scoped | Time series | `?from=&to=&bucket=1m` |
| `GET /alerts` | Admin, Dispatcher, Driver (own) | Active + recent | `?level=&since=` |
| `POST /alerts/:id/ack` | Admin, Dispatcher, Driver (own) | Acknowledge | Inserts `alert_acks` |
| `POST /handoffs` | Driver (own), Receiver (own) | Pickup / delivery | Idempotent on `client_uuid` |
| `GET /shipments/:id/handoffs` | Scoped | Custody log | |
| `POST /reports` | Admin, Dispatcher, Auditor | Generate | csv / pdf |
| `GET /reports/:id/download` | Admin, Dispatcher, Auditor | File | |
| `GET /reports/:id/verify` | Admin, Dispatcher, Auditor | Recompute chain | `{ valid, broken_at? }` |
| `GET /audit/auth-events` | Admin, Auditor | Failed logins | Read-only |

No `PUT`, `PATCH` or `DELETE` on telemetry, alerts, handoffs, reports or auth events — they return 405.

## 10. Core logic

### 10.1 Alert engine

| Reading (margin m = 0.5 °C) | Zone | Effect |
| --- | --- | --- |
| min + m ≤ temp ≤ max − m | Normal | Clear `out_of_range_since`; close episode |
| min ≤ temp < min + m, or max − m < temp ≤ max | Near limit | WARNING once per episode |
| outside [min, max], < 10 min | Breach | Set `out_of_range_since`; WARNING once |
| outside [min, max], > 10 min | Sustained breach | CRITICAL once per episode |

- Duration uses sensor `recorded_at`, never server receive time.
- One in-range reading ends the episode; a reading exactly on min/max is in range.
- No reading for > 90 s → "Sensor stale". A gap during a breach does not reset the timer (confirm with client).
- Acknowledging adds an `alert_acks` row; alerts are never edited.

The frontend mirror of this logic lives in `frontend/src/lib/alerts.ts` with unit tests.

### 10.2 Offline-first driver sync

1. Service worker caches the app shell; assigned shipments (with `qr_token`) are cached in IndexedDB.
2. Every handoff/log is written to an IndexedDB `outbox` first, then sent.
3. QR is validated offline against the cached token; PIN is verified by the server at sync time (wrong PIN → `REJECTED` record + dispatcher alert).
4. Sync on `online`, app start, and every 30 s.
5. FIFO; 2xx/duplicate → delete; 4xx → "Needs attention"; network/5xx → backoff 2 s … 60 s.
6. Server enforces unique `client_uuid` / `reading_id`, so replays are safe.
7. Server stores device `occurred_at` and server `synced_at`; flags skew > 5 min.

Implemented in `frontend/src/lib/offline/outbox.ts`.

## 11. Quality, security and deployment

- **Environments:** Vercel Preview per PR (staging); `main` → Production.
- **CI:** install → lint + typecheck → unit tests (see `.github/workflows/ci.yml`).
- **Branches:** protected `main`, 1 review, ticket ID in branch name (`feat/TEL-4-critical-alert`).
- **Secrets:** only in Vercel/GitHub secrets; `.env.example` committed.

| Security test | Expected |
| --- | --- |
| Driver reads another driver's shipment | 403, logged |
| Auditor calls `POST /shipments` | 403 |
| Tampered JWT | 401 |
| `' OR 1=1 --` in inputs | Validation error |
| `<script>` in text fields | Rendered as text |
| `DELETE /telemetry/:id` | 405 |
| Direct SQL UPDATE on ledger | Trigger error |
| Edited CSV row → verify | `valid: false` |
| 6 wrong passwords | Lockout + 6 `auth_events` rows |

## 12. Team and sprint plan

| Squad | 25 | ~18 | ~12 | Owns |
| --- | --- | --- | --- | --- |
| Product & Project Mgmt | 3 | 2 | 1 | Backlog, change requests, standups, demo script |
| UI/UX Design | 2 | 2 | 1 | Components + states, driver flow |
| Frontend | 6 | 5 | 4 | Board, PWA, offline sync, audit portal, login |
| Backend & Data | 7 | 6 | 4 | Auth, RBAC, APIs, schema, alert engine, simulator |
| QA, DevOps & Security | 7 (2–3 this run) | 3 | 2 | CI, Vercel, tests, load + security |

| Minutes | Milestone |
| --- | --- |
| 0–20 | Kickoff: freeze schema + API, scaffold repo, CI, Vercel |
| 20–50 | Build 1: auth, RBAC, shipments, ingest, dashboard shell |
| 50–90 | Build 2: alert engine, handoffs, simulator, driver PWA + sync |
| 90–115 | Build 3: reports + verify, audit portal, load + security tests |
| 115–130 | Freeze: bug fixes, deploy Production, smoke test |
| 130–150 | Rehearse, then demo |

**Demo script:** create shipment → simulator with 500 shipments → driver offline pickup → reconnect, one record → `breach-12min` shows Warning then Critical → delivery as `TEMP_SUSPECT` → auditor edits CSV, verify → `valid: false`.

## 13. Risks and open questions

| Risk | Mitigation |
| --- | --- |
| 10-min breach too long for a live demo | Simulator `--time-scale 20` (readings stamped 30 s apart, sent every 1.5 s) |
| No WebSockets on Vercel | Supabase Realtime or 5 s polling |
| Free-tier DB connection limits | Batched ingest, pooler, dashboard reads `shipment_state` |
| FE blocked on BE | API frozen at minute 20; FE uses typed mock mode (`NEXT_PUBLIC_API_MODE=mock`) |
| Offline duplicates | Client UUIDs + unique constraints |
| Scope creep | Change-request protocol (§4) |

Open questions for MedSwift:

- [ ] Does a data gap during a breach keep the timer running?
- [ ] Is a 0.5 °C Warning margin right for all products?
- [ ] Does delivery need both driver and receiver PINs?
- [ ] What counts as an "SLA breach" in reports?
- [ ] Which regulator format is expected, and does the PDF need a digital signature?
- [ ] How long must records be retained?
