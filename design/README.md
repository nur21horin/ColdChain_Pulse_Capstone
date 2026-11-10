# Design mockups

Interactive canvas (view, comment, edit): https://claude.ai/artifact/L4EPqgdSDuL3wquLWAzD38

These `.dc.html` files are the source of each artboard on that canvas. They need the canvas runtime to render, so open the link above rather than the files directly. The React components in `frontend/` implement these screens.

| File | Screen | Implemented in |
| --- | --- | --- |
| `Main.dc.html` | Dispatcher live board | `frontend/src/app/board/page.tsx` |
| `Audit.dc.html` | Auditor compliance portal | `frontend/src/app/reports/page.tsx` |
| `Driver-Home.dc.html` | Driver home (offline state) | `frontend/src/app/driver/page.tsx` |
| `Driver-Handoff.dc.html` | Delivery handoff — QR + condition + PIN | `frontend/src/app/driver/handoff/page.tsx` |
| `Driver-Critical.dc.html` | Driver critical alert takeover | `frontend/src/features/alerts/CriticalTakeover.tsx` |
| `Login.dc.html` | Sign in | `frontend/src/app/login/page.tsx` |
| `Components.dc.html` | Tokens, components and states | `frontend/src/components/ui/*`, `frontend/src/app/globals.css` |

## Tokens

| Token | Hex | Use |
| --- | --- | --- |
| `--ink` | `#0F1B2A` | Text, top bar |
| `--slate` | `#3D4B5C` | Secondary text |
| `--canvas` | `#F3F5F8` | Page background |
| `--border` | `#DCE2E9` | Card borders |
| `--brand` | `#0A6A94` | Primary actions, links |
| `--critical` | `#B42318` | Critical alerts (white text) |
| `--warning` | `#F0A500` | Warnings (ink text) |
| `--normal` | `#17694F` | In range |
| `--stale` | `#8995A3` | No recent data (dashed border) |

Fonts: Inter (UI) and JetBrains Mono (temperatures, IDs, times, hashes).
