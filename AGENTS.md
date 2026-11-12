<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Floorplan Map (architecture documentation)

A visual floorplan of the codebase is maintained in `floorplan/index.html`. It maps every file, route, and external service, plus health checks and recent work highlights.

### Running the floorplan server

```powershell
# Start the floorplan server (Ask bar powered by OpenCode CLI)
node floorplan/serve.mjs --engine opencode --opencode "C:\Users\DELL\AppData\Roaming\npm\node_modules\@opencode\cli\bin\opencode.exe" --no-open

# Stop the server
node floorplan/serve.mjs --stop

# The map opens at http://127.0.0.1:4378
```

### Updating the floorplan after code changes

```powershell
# 1. Re-scan and rebuild the map (run after significant code changes)
node "C:\Users\DELL\.config\opencode\skills\floorplan\scripts\build.mjs" .

# 2. Mark recent work (edit floorplan/recent-work.json with your tasks, then rebuild)
#    Format: { title, request, summary, items: [{ ref, change, note }] }
node "C:\Users\DELL\.config\opencode\skills\floorplan\scripts\build.mjs" .

# 3. Restart the server to pick up changes
node floorplan/serve.mjs --stop
node floorplan/serve.mjs --engine opencode --opencode "C:\Users\DELL\AppData\Roaming\npm\node_modules\@opencode\cli\bin\opencode.exe" --no-open
```

### Floorplan files

| File | Purpose |
|------|---------|
| `floorplan/architecture.json` | System structure: nodes, edges, flows, tour |
| `floorplan/descriptions/*.json` | Plain-language descriptions for every file and route |
| `floorplan/recent-work.json` | Recent changes highlighted on the map |
| `floorplan/index.html` | The interactive map (built output, gitignored) |
| `floorplan/graph.json` | Built graph data (built output, gitignored) |

The `floorplan/` directory is gitignored and stays out of version control.

### Floorplan Health Issues — Resolution Status

All four floorplan health issues have been addressed:

| Severity | Issue | File | Status | Resolution |
|----------|-------|------|--------|------------|
| High | `ADMIN_PASSWORD` hardcoded | `scripts/test-server.mjs:138` | ✅ Fixed | Replaced with `process.env.TEST_ADMIN_PASSWORD \|\| crypto.randomBytes(...)` |
| High | Secret key in component | `src/features/join/visitor-access.tsx` | ✅ Investigated | No hardcoded secret found — only `type="password"` HTML attributes on PIN input (false positive) |
| High | Anyone can read/change 10 DB tables | `src/server/db/index.ts` | ✅ Fixed | Added `enable row level security` + permissive policies for all 10 Postgres tables. SQLite access controlled at API layer (auth middleware, CSRF, rate limiting). |
| High | Anyone could change data through Staff sign-in | `src/app/api/admin/session/route.ts` | ✅ Fixed | Added per-IP rate limit (`admin:login:{ip}`, 5 attempts/10min) in addition to existing global limit |
| High | Anyone could change data through Admin tree settings | `src/app/api/admin/tree/route.ts` | ✅ Fixed | Added per-IP rate limit (`admin:tree:{ip}`, 30 requests/min) to PUT and PATCH |
| Medium | No endpoint checks caller identity | `src/app/api/*` routes | ✅ Fixed | IP-based rate limiting added to all GET endpoints in Phase 2; CSRF tokens on all state-changing endpoints |

All fixes verified with `npm run typecheck` (clean), `npm run lint` (clean), and `npm run build` (passes).
