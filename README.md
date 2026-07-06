# myctf v0.33

A Next.js app for GZCTF — 3D globe, countdown, CTFtime integration.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **3D Rendering**: Three.js / React Three Fiber
- **UI**: shadcn/ui + Tailwind CSS
- **Authentication**: NextAuth.js
- **API Integration**: CTFtime API
- **State**: Zustand

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
app/          — Next.js App Router pages
  layout.tsx  — Shell (navbar, footer, auth)
  page.tsx    — Home
  globe/      — Globe page & layout
  api/        — API routes
components/   — Shared components
  ui/         — shadcn/ui primitives
  nav/        — Navigation components
  globe/      — Globe-specific components
  countdown/  — Countdown-specific components
lib/           — Utilities
services/      — External API services
hooks/         — Custom React hooks
stores/        — Zustand stores
public/        — Static assets
```

## Deployment

Deployed on Vercel.

## Branch Strategy

- `main` — production
- `develop` — active development
- `feature/*` — feature branches
