# ColdChain Pulse

**Pharmaceutical & Vaccine Cold-Chain Tracking Platform**

Software Engineering Design Capstone Project  |  25-Student Agency Simulation  
Client: **MedSwift Logistics Ltd.**

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Company Structure](#company-structure)
3. [Core Functional Requirements](#core-functional-requirements)
4. [Non-Functional & Technical Constraints](#non-functional--technical-constraints)
5. [Architecture & Technology Stack](#architecture--technology-stack)
6. [Department Responsibilities](#department-responsibilities)
7. [Grading & Evaluation Rubric](#grading--evaluation-rubric)
8. [Getting Started](#getting-started)
9. [Deployment](#deployment)

---

## Project Overview

MedSwift Logistics Ltd. transports temperature-sensitive biologics and vaccines from central warehouses to rural clinics. Currently, drivers log temperatures on paper, and spoiled batches are only discovered upon delivery. This platform provides a real-time monitoring solution to:

- Monitor shipments in real time
- Enforce chain-of-custody handoffs
- Automate compliance reporting

**Target Delivery:** 2.5-hour Capstone project class Sprint (MVP)

---

## Company Structure (25-Student Agency)

| Department | Students | Focus Area |
|---|---|---|
| Product & Project Management | 3 | Backlog, user stories, sprint management, client liaison |
| UI/UX Design | 2 | Wireframes, component library, driver mobile-first flows |
| Frontend Engineering | 6 | Dispatcher Dashboard, Audit Portal, Driver PWA |
| Backend & Data Engineering | 7 | REST/GraphQL APIs, RBAC, database schema, IoT telemetry simulator |
| QA, DevOps & Security | 7 | CI/CD pipelines, automated integration/load tests, security/penetration testing |

---

## Core Functional Requirements

### 1. Dispatch & Route Management
- Create shipments
- Assign refrigerated vehicles
- Set target temperature thresholds (e.g., 2°C to 8°C)
- Track live ETA

### 2. Telemetry & Excursion Alerts
- Ingest simulated IoT sensor data (temp/humidity every 30s)
- Trigger Warning (approaching limit) alerts
- Trigger Critical (breach > 10 mins) alerts to dispatchers and drivers

### 3. Chain-of-Custody Handoff
- Digital sign-off at pickup and clinic delivery
- QR code scans + PIN/signature
- Record timestamp, GPS coordinates, and condition status

### 4. Offline-First Driver Mode
- Queue handoffs and temperature logs locally when offline
- Auto-sync when connectivity returns

### 5. Compliance & Audit Portal
- Generate tamper-evident PDF/CSV batch reports
- Show full temperature history, handoff logs, and SLA breaches

---

## Non-Functional & Technical Constraints

- **RBAC:** Distinct permissions for Admin, Dispatcher, Driver, Clinic Receiver, and External Auditor (read-only)
- **Data Integrity:** Temperature logs and handoff records must be append-only
- **Performance:** Dashboard must handle 500+ concurrent simulated active shipments without UI lag
- **Security:** Encrypted API communication, hashed credentials, audit logging of all failed login attempts

---

## Architecture & Technology Stack

### Frontend
- **Dispatcher Dashboard & Audit Portal:** NEXTjS + TypeScript
- **State Management:** Redux or Zustand for efficient state updates

### Backend
- **API:** REST or GraphQL
- **Authentication:** JWT-based RBAC
- **Database:** PostgreSQL


### DevOps & Deployment
- **Frontend Hosting:** Vercel
- **Backend Hosting:** Vercel Serverless Functions
- **CI/CD:** Automated pipelines for testing and deployment

---

## Department Responsibilities

### Product & Project Management (3 Students)
- Own the backlog
- Write user stories with clear acceptance criteria
- Manage sprints and track burndown/velocity
- Act as client liaison

### UI/UX Design (2 Students)
- Design wireframes and component library
- Create driver mobile-first flows
- Establish design system with spacing, states, and dev handoff

### Frontend Engineering (6 Students)
- Build Dispatcher Dashboard
- Build Audit Portal
- Build Driver PWA with offline-first support
- Ensure smooth rendering of 500+ concurrent shipments
- Strict adherence to RBAC UI rules

### Backend & Data Engineering (7 Students)
- Build REST/GraphQL APIs
- Implement RBAC
- Design database schema
- Build IoT telemetry simulator
- Enforce append-only data integrity

### QA, DevOps & Security (7 Students)
- Set up CI/CD pipelines
- Write automated integration/load tests
- Perform security/penetration testing
- Verify RBAC bypasses, SQLi/XSS, and tamper-evident audit logs

---

## Grading & Evaluation Rubric

### Shared Company Grade (40%)
- Final MVP demo
- System integration
- Overall stability

### Individual Grade (60%)
- Verified via Git commit history, Jira/Trello tickets
- Bi-weekly 360° peer reviews

---

## Getting Started

### Prerequisites
- Node.js (v16+)
- npm or yarn
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/nur21horin/ColdChain_Pulse_Capstone.git
cd ColdChain_Pulse_Capstone
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the development server:
```bash
npm run dev
```

---

## Deployment

This project is designed for deployment on **Vercel** or similar platforms.

### Frontend (Vercel)
```bash
vercel --prod
```

### Backend (Vercel Serverless)
```bash
vercel --functions
```

See [Deployment Guide](docs/deployment.md) for detailed instructions.

---

## Contributing

Please follow the department-specific workflows. Each department should maintain its own branch and submit pull requests for integration.

---

## License

Proprietary - MedSwift Logistics Ltd. Capstone Project
