---
name: frontend
description: Frontend best practices for the Orchestrator Next.js dashboard
---

# Frontend Skills — Orchestrator Dashboard

- Next.js 14 with App Router — pages in `packages/dashboard/src/app/`
- All interactive components must have `"use client"` directive at top
- Main UI: `virtual-office.tsx` (800+ lines) — single-file component with all state, styles, rendering
- Inline styles throughout (project convention) — no CSS modules, no Tailwind, no styled-components
- Dark theme: base `#080810`, panel `#0d0d1a`, card `#111122`, border `#1a1a33`
- Color palette per agent type defined in `AGENT_TYPES` constant — use `color` field for glows/badges
- State persistence: localStorage (`orchestrator-state` key) — load on mount, save on change
- Monospace font for terminal areas: `'SF Mono', Monaco, 'Fira Code', monospace`
- Status cycling: click badge to cycle `idle -> running -> done -> failed -> idle`
- Log simulation: `setInterval` with random messages from `LOG_MESSAGES` constant, cleanup on unmount
- Style helper functions: `S.btn(color)`, `S.badge(color)`, `S.skill(active)`, `S.tab(active)` — return `React.CSSProperties`
- Modals: fixed overlay with `onClick` on backdrop to close, `e.target === e.currentTarget` check
- Forms: controlled inputs, `useState` per form section, clear on submit
- Unicode escapes for emojis in TSX (e.g. `"\u{1F9E0}"` not raw emoji) — avoids encoding issues
- Server components for static pages, client components for interactive ones
- `@orchestrator/shared` types imported via workspace reference, transpiled via `next.config.js`
