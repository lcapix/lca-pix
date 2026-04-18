# How to Execute the API Integration Plan (Human-in-the-Loop)

**Target plan:** `docs/plans/2026-04-13-api-integration-implementation.md`
**Design reference:** `docs/plans/2026-04-13-api-integration-design.md`

---

## For the new Claude session — START HERE

You are continuing work on LCAPIX v3. A detailed 26-task implementation plan has already been written and committed. Your job is to execute it task-by-task using the `superpowers:executing-plans` skill.

**First thing to do:**

```
Invoke the skill: superpowers:executing-plans
Point it at: /Users/kavishpandit/Desktop/lca/lca project v3/docs/plans/2026-04-13-api-integration-implementation.md
```

---

## Pre-flight: Before you start Task 0

### 1. Confirm the dev environment

```bash
# Check Node version (should be 18+)
/opt/homebrew/bin/node --version

# Check pnpm
/opt/homebrew/bin/pnpm --version

# Check MySQL client (used only for verification, not required for tests)
/opt/homebrew/bin/mysql --version
```

### 2. Start the SSH tunnel to AWS RDS (keep this running in its own terminal)

```bash
/opt/homebrew/bin/aws ssm start-session \
  --target i-055b91c4baf230251 \
  --profile lca-pix \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com"],"portNumber":["3306"],"localPortNumber":["3307"]}'
```

Expected output:
```
Starting session with SessionId: ...
Port 3307 opened for sessionId ...
Waiting for connections...
```

If it fails: AWS credentials live at `~/.aws/credentials` under profile `lca-pix`. Confirm `/opt/homebrew/bin/aws sts get-caller-identity --profile lca-pix` works.

### 3. Start the dev server (separate terminal)

```bash
cd "/Users/kavishpandit/Desktop/lca/lca project v3"
/opt/homebrew/bin/pnpm run dev
```

Expected:
```
▲ Next.js 15.2.4
- Local:   http://localhost:3002
✅ Database connected successfully
```

### 4. Confirm login works

```bash
curl -sL -X POST http://localhost:3002/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"john@lcaproject.com","password":"Lcapix@guerry123"}' \
  | python3 -m json.tool
```

Expected: JSON with `"success": true` and a `token`.

If any pre-flight step fails, **STOP** and fix it before touching the plan.

---

## Execution rules (for the Claude session)

1. **One task at a time.** Do not batch. Commit before moving on.
2. **TDD discipline.** For each task:
   - Write the failing test first.
   - Run it, confirm it fails.
   - Implement the minimum code to make it pass.
   - Run the test, confirm it passes.
   - Then commit.
3. **Manual verification checkpoint at the end of each task.** After you commit, summarize for the human:
   - What you changed (files)
   - How to verify manually (1-3 specific clicks/curls)
   - What to look for (expected vs. actual)
   - Then **wait** for the human to say "proceed" or "fix X".
4. **No pushing to remote.** Commits stay local until the human explicitly asks to push.
5. **No schema changes beyond what the plan specifies.** If you think something is needed, raise it — do not silently add it.
6. **If a test passes first try, be suspicious.** Verify the test actually exercises the code path.
7. **Use `superpowers:verification-before-completion` before marking anything done.**
8. **Use `superpowers:systematic-debugging` if anything breaks unexpectedly.**

---

## Human-in-the-loop verification checklist

After each task, Kavish will verify using these lanes:

### Lane A: Unit tests (fast, automated)

```bash
cd "/Users/kavishpandit/Desktop/lca/lca project v3"
/opt/homebrew/bin/pnpm test
```

Green = good. Any red = stop and debug.

### Lane B: Type + lint check

```bash
/opt/homebrew/bin/pnpm build     # TypeScript errors surface here
/opt/homebrew/bin/pnpm lint
```

### Lane C: API smoke tests (live AWS data)

The plan provides a `curl` command after every API task. Kavish will:

1. Copy the curl block
2. Replace `$TOKEN` with a fresh token from `/api/auth/login/`
3. Run it
4. Eyeball the JSON response

### Lane D: UI spot-check (visual)

For every UI task, Kavish will:

1. Open the relevant page at `http://localhost:3002/...`
2. Click the new control
3. Confirm it does what the task description said

### Lane E: End-of-phase regression

After Phase 1a, 1b, 1c each complete, run the full CRUD test script that already exists (40/40 must still pass):

```bash
# (From earlier session — the comprehensive CRUD test)
# Regenerate it if needed from docs/plans/ or ask.
```

---

## Phase boundaries (checkpoints for Kavish)

### ✅ End of Phase 1a (after Task 12)

Verify on the v3 app running at http://localhost:3002:

- [ ] `/admin/integrations` renders 3 status cards
- [ ] Clicking "Import openLCA CML 2001" returns a success JSON blob
- [ ] Coverage card shows non-zero factors for "CML 2001"
- [ ] Clicking "Enrich substances from PubChem" progresses (may take ~10s)
- [ ] Coverage card shows substances enriched > 0
- [ ] Log viewer shows the 2 actions you just ran
- [ ] Run an assessment on case 19 (EV Battery) — still returns valid results
- [ ] Number of impact categories in results is ≥ the pre-integration baseline

If all ✅ → commit a verification note and move to Phase 1b.

### ✅ End of Phase 1b (after Task 21)

- [ ] Case edit page has a region dropdown
- [ ] "Run Assessment" button opens a modal with Method + Region dropdowns
- [ ] Running on EV Battery with `region=US-NY` produces different numbers than `region=FR`
- [ ] "Auto-fill costs" button populates `labor_cost` and `energy_cost` from API data
- [ ] `cost_rates` table has rows for labor + electricity
- [ ] `integration_log` has rows for bls, eia, electricity_maps actions

### ✅ End of Phase 1c (after Task 26)

- [ ] 3 valuation methods available in the modal (CML, ReCiPe, TRACI)
- [ ] Metal flows (Steel, Aluminum, Copper) get real material costs
- [ ] PDF export includes a "Data Sources" section
- [ ] Impact values in PDF tables have source attribution

---

## Emergency commands

If something goes badly wrong mid-task:

```bash
# Revert uncommitted changes to a specific file
git restore path/to/file

# Roll back the last commit (keeps changes staged)
git reset --soft HEAD~1

# Roll back the last commit and discard changes (DANGEROUS)
git reset --hard HEAD~1

# See what changed since last commit
git diff

# Run the dev server from scratch
lsof -ti:3002 | xargs kill -9 2>/dev/null ; /opt/homebrew/bin/pnpm run dev
```

---

## Kavish's role during execution

- Read each task summary the Claude session gives you after it commits.
- Run the verification commands (Lane A–D above).
- If output matches expected → say "proceed" or "next task".
- If output is wrong → paste the actual output back; the session will debug.
- At phase boundaries (end of 1a, 1b, 1c), do the end-of-phase checklist before greenlighting the next phase.

---

## Useful reference data

**Login credentials:** `john@lcaproject.com` / `Lcapix@guerry123`
**Password for all seeded accounts:** `Lcapix@guerry123`

**AWS Console:** https://117852575520.signin.aws.amazon.com/console
**AWS Console user:** `KavishPandit`
**AWS Profile (CLI):** `lca-pix`
**RDS host:** `lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com`
**EC2 instance:** `i-055b91c4baf230251`

**Demo projects in AWS RDS:**
- Project 8: Electric Vehicle Manufacturing (cases 19 base, 20 comparative)
- Project 10: Nutroleum vs Petroleum Jelly (cases 21 base, 22 comparative)

**API keys you need to register for during Phase 1b:**
- Electricity Maps: https://www.electricitymaps.com/free-tier-api (free tier, 1 zone)
- EIA: https://www.eia.gov/opendata/ (free, instant key)
- BLS v2 (optional): https://data.bls.gov/registrationEngine/ (free, higher rate limits)

Add these to `.env.local` as `ELECTRICITY_MAPS_API_KEY`, `EIA_API_KEY`, `BLS_API_KEY` — the plan flags when each is needed.

---

## When everything is green

At the very end, Kavish does a final gut check:

1. `/admin/integrations` dashboard is healthy
2. Full assessment with region+method produces believable numbers
3. PDF export looks professional
4. CRUD test script still passes 40/40
5. No `TODO` or `FIXME` comments left behind

Then decide: merge + push, or iterate further.
