# Viewing Room design

Viewing Room is a focused, read-only competition viewer. A visitor signs in with an existing GZCTF team account, selects a competition, then follows its scoreboard. The interface should make those two choices immediate, without borrowing GZCTF's visual identity or adding a marketing journey.

## Principles

- One primary action per screen: log in, choose a team when required, or open a competition.
- Let grouping, alignment, and space explain the flow. Do not add an eyebrow, step number, subtitle, or duplicated action label when the heading and control already say enough.
- Keep facts needed for trust and decisions: team-seat limit, credential handling, competition status and times, error recovery. Remove decorative or repeated copy first.
- Keep utility actions available but quiet: search, status filters, refresh, log out, change account. Icon-only actions need accessible names and visible focus.
- Preserve the independent Viewing Room mark. This is a viewer, not a GZCTF-branded subproduct.

## Visual system

- Canvas: cool off-white `#f6f7f8`; text: ink navy `#19284a`; structural navy `#152b58`.
- Warm orange `#f2a45b` belongs to the mark and focus accents; avoid adding new saturated hues for decoration. Status colors are semantic only.
- Type uses the existing app font. A large page heading, medium competition title, and readable form/body text form the hierarchy. Avoid tiny ornamental all-caps.
- Use a 8px-based rhythm, 8px controls, and 12px competition cards. A border or a surface change is enough to separate areas; avoid stacked card shadows.
- Motion is limited to subtle hover feedback and loading indicators, and respects reduced-motion preferences.

## Interaction and responsive rules

- At narrow widths, stack the login introduction above the form and switch the competition grid to one column. Never hide required form labels or status information.
- On small scoreboard screens, put rankings before the 3D arena and bound the arena height. Scores should be reachable without scrolling through a large visual first.
- All controls have keyboard focus states. Password visibility, team selection, clear filters, refresh, retry, and logout must remain operable without a pointer.
- Loading, empty, error, and filtered-empty states each name the state; add a recovery action only when the visitor can act on it.
- Prefer a concise status + title + time range on cards. Do not repeat a summary or “enter” label on every card when the whole card is the link.

This project-specific direction applies the simplification and audit approach in [Impeccable](https://github.com/pbakaus/impeccable) and the token/guardrail structure in [Awesome DESIGN.md](https://github.com/VoltAgent/awesome-design-md), while retaining Viewing Room's own product identity.
