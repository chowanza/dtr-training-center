# DTR Training Center — demo build

Dream Team Roofing's internal training and certification system. Content is organized the way
Trainual organizes it — Subjects (modules) made of Topics (chapters) made of Steps (pages), each
with its own knowledge check — with a quiz → practical → manager-approval certification chain and
real people/role/group management layered on top.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Use the account chip in the top bar to switch between seeded people
(Owen, Luis, Armando, Maria Lopez) — there's no login yet, this is a same-day demo shortcut.
Owen and Luis are admins; Armando and Maria are regular CSRs.

## What's real vs. simplified for today's demo

- **Persistence**: a JSON file at `.data/db.json` (gitignored), regenerated from `src/lib/seed.ts`
  on first run. Stands in for Postgres/Supabase — swapping it for Drizzle + Postgres later is a
  self-contained follow-up, since every read/write already goes through `src/lib/actions.ts` and
  `src/lib/derive.ts`.
- **Auth**: an account switcher instead of Supabase magic-link auth. Every content-authoring and
  admin server action still re-checks `isAdmin`/`isManager` server-side, not just in the UI.
- **Content model**: a module ("subject") is a list of Topics, each with ordered Steps. A step has
  a body plus optional embeds (video/image/link — YouTube, Vimeo, and Loom URLs render as inline
  players, anything else as a link-out card). A knowledge check (quiz) can be attached to any
  topic. Publishing requires every step to have real content plus at least one checklist item and
  one quiz question somewhere in the module — templates and new modules seed a starter outline of
  topics with guidance placeholders, never pre-filled content, so completeness always reflects
  real authored work.
- **Learner flow**: steps unlock strictly in order (can't skip ahead) via a `stepProgress` table.
  Once every step is done the module auto-advances to "Ready for Test" and shows every topic's
  knowledge check; the module counts as passed once every knowledge check in it has a passing
  attempt. Certified/passed learners get an unlocked, ungated view of the whole module as a
  reference — Trainual's "becomes their knowledge hub" idea.
- **People/roles/groups**: admins can add, edit, deactivate, or permanently delete people from the
  UI (`/people`) — nothing is hardcoded. Roles have a `parentRoleId` for the org tree (`/people/roles`,
  Trainual's Role Chart) with per-role responsibilities. Groups (`/groups`) are a separate,
  flatter way to organize people.
- **Not built yet**: real Cloudflare Stream/file uploads (embeds are link/URL-based only), email
  notifications, the nightly expiry sweep, AI-assisted outline/compose (the "starter outline" is a
  static list, not a live AI call), flowcharts, and e-signatures.

## Screens

- `/` — Home, with a Dashboard/Training toggle depending on who's viewing
- `/builder` — Content (author Topics/Steps/quizzes, scripts, checklist; publish versions)
- `/builder/templates` — starter outlines for new modules
- `/people`, `/people/roles` — People directory and Role Chart (admin CRUD for people & roles)
- `/groups` — Groups directory and membership
- `/certify` — Evaluation & Certification (rubric scoring, then the explicit Certify action)
- `/matrix` — the full grid view (everyone × every module), linked from `/people`
- `/cert/[certId]` — the permanent, shareable certification record
