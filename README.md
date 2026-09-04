# DTR Training Center — demo build

Working demo of the certification system from the Training Center spec: SOP authoring, a
mobile-first module viewer, a quiz → practical → manager-approval certification chain, and a
training matrix.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Use the **Viewing as** switcher in the top nav to jump between Owen,
Luis, Armando, and Maria — there's no login yet, this is a same-day demo shortcut.

## What's real vs. simplified for today's demo

- **Persistence**: a JSON file at `.data/db.json` (gitignored), typed to the same shape as the
  spec's schema (§05). It regenerates from `src/lib/seed.ts` on first run. This stands in for
  Postgres/Supabase until we're past the demo — swapping it for Drizzle + Postgres is a
  self-contained follow-up (the `src/lib/actions.ts` call sites don't change shape).
- **Auth**: a role switcher instead of Supabase magic-link auth.
- **Content**: New Lead Handling is fully authored (13 SOP sections, scripts, checklist, a 5-question
  quiz, one practical scenario) and published as v1, with Armando already certified and Maria
  partway through, so the matrix and cert record have real data to show. The other seven CSR
  modules are empty draft shells — intentionally, per §01's point that an empty schema is the
  stop-work signal, not a bug.
- **Not built yet**: video upload/playback (Cloudflare Stream), email notifications (Resend),
  the nightly expiry sweep (Vercel Cron), and the Phase 3 execution tables (`checklist_runs`).
  These are backlog per §08 — "explicitly not in v1" plus the sprint-4 items we haven't reached.

## Screens

- `/builder` — Module Builder (Luis authors the SOP, scripts, checklist, quiz; publishes versions)
- `/learn` — My Training (mobile-first viewer + quiz, per logged-in user)
- `/certify` — Evaluation & Certification (rubric scoring, then the explicit Certify action)
- `/matrix` — Training Matrix (everyone × every module, one screen)
- `/cert/[certId]` — the permanent, shareable certification record
