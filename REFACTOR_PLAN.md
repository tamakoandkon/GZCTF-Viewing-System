# Refactor Plan — myctfv0.33

## Core Principle
Self-contained pages, shared Shell. No page-pair CSS/JS coupling.

## Target Layout
```
app/
  layout.tsx          — Shell (navbar, footer, auth, fonts)
  page.tsx            — Route: /
  globe/
    page.tsx          — Route: /globe
    layout.tsx        — Future: scroll-based full-page Earth
  auth/
    callback/route.ts — NextAuth callback
  api/
    auth/[...nextauth]/route.ts
    ctftime/
      upcoming/route.ts
      top/route.ts
      event/[id]/route.ts
      submit/route.ts
      team/[id]/route.ts

components/
  ui/                 — shadcn/ui primitives
  nav/                — Shell-specific components
  globe/              — Globe-specific components (Earth, galaxy, particles)
  countdown/          — Countdown-specific components

lib/
  utils.ts

services/
  ctftime-service.ts
  ctftime-cache.ts
  ctftime-types.ts

hooks/
  use-scroll.ts

stores/
  globe-store.ts
  countdown-store.ts

public/
  textures/           — Globe textures
  fonts/              — Custom fonts
```

## Migration Strategy
1. Create `app/` route group structure
2. Move Shell to `app/layout.tsx`
3. Move globe page to `app/globe/page.tsx` (self-contained)
4. Delete old `pages/` and `Page/` directories
5. Flatten `components/` — no deep nesting
6. Consolidate `services/` — deduplicate CTFtime logic
7. Move stores to `stores/`
8. Clean up unused assets

## CTFtime API Refactor
- Split into: `ctftime-service.ts` (API calls), `ctftime-cache.ts` (caching), `ctftime-types.ts` (types)
- Remove duplicate CTFtime logic from `services/` and `stores/`
- Single source of truth

## Store Consolidation
- `globe-store.ts`: Earth rotation, starfield, view mode
- `countdown-store.ts`: Timer state, target dates
- Remove `use-game-store.ts` (merge into `globe-store.ts` if needed)

## Cleanup Checklist
- [x] Remove old layout duplicates
- [ ] Remove unused service files
- [ ] Flatten components directory
- [ ] Consolidate CTFtime services
- [ ] Move stores to `stores/`
- [ ] Remove unused public assets
