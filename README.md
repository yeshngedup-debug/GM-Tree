# The Living Tree of GMC

A local hackathon app for the GMC Experience Centre: scan one QR, share an anonymous aspiration, watch a leaf join the reception tree, and discover a related chamber.

**Next.js 16, React 19, TypeScript, Tailwind 4, shadcn-style components with Radix, Three.js, local SQLite, an OpenAI-compatible chat provider.** One Node server serves phones, display, staff console and API.

## Start

Use **Node 22.13+ in the 22.x line**, or a newer supported release. The built-in SQLite warning on Node 22 is expected.

```powershell
npm install
npm run setup
npm run dev
```

Open http://localhost:3000. Setup creates `.env.local` with a random staff password in `ADMIN_PASSWORD`. It preserves an existing password and does not print it. SQLite initializes and migrates automatically, keeping existing starter leaves.

| Route        | Experience                                                       |
| ------------ | ---------------------------------------------------------------- |
| `/`          | Introduction, live tree preview, theme shortcuts                 |
| `/join`      | Theme selection, aspiration, consent, result                     |
| `/voices`    | Optional CID + PIN sign-in and private previous notes/replies    |
| `/display`   | Reception tree, QR, queued leaf arrivals, reflection, fullscreen |
| `/tree`      | Full-screen interactive Tree Studio, growth previews and exports |
| `/leaf/[id]` | Public keepsake, sharing/copy fallback, downloadable SVG         |
| `/chambers`  | Four-chamber guide and suggested thematic pathways               |
| `/privacy`   | Participation, external processing, cookies and retention        |
| `/admin`     | Staff sign-in, hide/restore, demo data, counts and reflection    |

## Procedural tree and TV display

The tree reuses the procedural branch/species/age algorithms from [Mike Fernandez's just-a-simple-tree](https://github.com/MikeFernandez-Pro/just-a-simple-tree). Adapted MIT-licensed modules and the retained licence are in `src/vendor/just-a-simple-tree/`. The source revision and changes are documented in [UPSTREAM.md](src/vendor/just-a-simple-tree/UPSTREAM.md).

Our renderer adds GMC palettes, wind, foliage, deterministic visitor markers, queued arrivals, accessible leaf selection and an adaptive camera. The full-viewport layout keeps the tree, QR and message panel visible in either orientation. Tested viewport sizes include 1080×1920, 2160×3840, 1920×1080, 3840×2160, 1280×720 and phones. The physical TV and browser still need an on-site check.

Portrait keeps a vertical sequence: title, tree, controls, horizontal themes, centered story and QR. The camera frames the tree in the upper area while keeping a continuous full-screen sky/ground canvas, so zoomed branches can extend behind transparent content. Stories have a fixed area: public leaves are limited to 100 characters and displayed reflections to 160, with graceful truncation. Landscape retains its existing overlay positions.

Submitted receipts add a sourced, theme-related GMC fact, a larger chamber recommendation, the current tree with the visitor's leaf highlighted, a tree PNG download (standalone SVG without WebGL), and a separate leaf SVG. Downloads contain only public tree/leaf content.

### Optional returning visitors

Visitors choose first or returning without adding a required note step. After submitting, **Add my CID (optional)** offers private history protected by an 11-digit CID and private 6-digit PIN. Open `/voices` or **My voices** on the join screen on a later visit. While signed in, subsequent submissions are linked automatically. Sign out on shared devices; this also clears the current tab's receipt and draft.

Raw CIDs and PINs are never stored or sent to AI. CID lookup uses a keyed HMAC; PINs use salted scrypt. Only the browser that submitted a note can initially link it. History reads require a 12-hour HttpOnly session and are not cached. Sign-in is rate limited. A forgotten PIN cannot be recovered. Removing a visit profile deletes credentials, links and sessions while preserving anonymous leaves and staff records. This is self-asserted visit history, not government identity verification. Existing leaves from before ownership tracking cannot be claimed by entering a public leaf ID.

In **Admin → Tree & display → Display title**, enter up to 90 characters and choose **Save display title**. This saves the title independently of other appearance edits and updates connected displays.

3D uses WebGL2; WebGPU is not required. If WebGL is unavailable or the context is lost, the interactive illustrated tree takes over. Staff can choose illustration explicitly. Automatic quality caps pixel density and foliage work; reduced-motion mode renders only when the view changes. Tree visuals are generated locally without external image, font or music downloads.

### Interactive Tree Studio

Open `/tree`, or choose **Customize tree** on the reception screen. Drag the tree to orbit; scroll or pinch to zoom. The view also has zoom/reset buttons and keyboard arrows, plus/minus, and Home. Press H to hide/show the panel, or Space to choose a new seed while not editing a field.

The studio follows the reference project's layout: six species on the left, five palettes across the top, and a collapsible customization panel. Controls cover branching, trunk/root shape, spread, crookedness, leaf shape/size, season, custom colours, wind/flutter, camera rotation, lighting, grass and performance. Manual age mode uses the upstream leaf-cluster painters for a full reference-style canopy.

Everyone can experiment locally; **Save to reception** requires staff sign-in. Preview counts never create visitor records and are never saved with the settings. PNG, GLB and configuration exports capture the current preview. JSON import validates the same settings schema before applying a local preview. GLB is a static snapshot of the currently grown geometry, without live wind or future arrivals.

### Growth from visitor hopes

The default `growthMode` is `contributions`. At zero approved hopes the tree is a small bare sapling, with **zero decorative leaves**. Each accepted contribution adds a leaf. Its growth attributes unfold and thicken the same branch geometry continuously, and branches extend as the count increases. The initial camera frame stays fixed so growth is visibly larger rather than being cancelled by automatic zoom.

`leavesForMaturity` controls the pace (48 by default). At higher counts the tree continues to expand gradually. Hidden leaves stop contributing; rejected and duplicate submissions do not add growth. Existing approved contributions still count; this update does not delete or reset event data. The studio's **Bare** preview shows the empty start without changing records.

The live renderer draws individual contribution leaves, capped at 2,400 in low quality and 6,000 in high quality. Above those limits, the canopy is an aggregate visual sample; every accepted record remains in SQLite and total counts still drive growth. Up to 120 recent leaves remain individually selectable. The illustration fallback also starts bare and scales with contributions.

## Enable a chat provider

Set `OPENAI_API_KEY` in `.env.local`, leave `AI_MODE=auto`, and restart. Any endpoint implementing `POST {OPENAI_BASE_URL}/chat/completions` works — for example BazaarLink, OpenRouter or OpenAI itself. `OPENAI_BASE_URL` defaults to `https://api.openai.com/v1` when blank, and `OPENAI_MODEL` defaults to `gpt-6-luna`.

Free text passes local checks, provider moderation when available, structured generation, schema validation and final output moderation before persistence. Keys stay server-side.

Generation asks for a strict `json_schema` response and unwraps it defensively, because providers differ in how firmly they honour that parameter: the reply is parsed, validated against the leaf schema and retried once with a corrective message. `/moderations` is treated as optional — `404`/`405` disables the provider check and the request continues on the local checks plus the model's own `safe`, `moderation_flags` and `confidence` verdict. Any other provider error still fails closed.

The request shapes follow the [Chat Completions](https://developers.openai.com/api/docs/api-reference/chat) and [Moderation](https://developers.openai.com/api/docs/guides/moderation) references.

No key, `AI_MODE=offline`, provider failure, malformed output or timeout activates the **curated offline fallback**. It uses keywords and the chosen theme to select a prewritten safe leaf. It never publishes raw input and labels its mode on the result. Moderation rejections never become fallback approvals. Local patterns are conservative and do not replace semantic moderation; curated output avoids exposing arbitrary visitor text.

Automated tests exercise the integration using a local protocol mock. Verify live account/model access using your own key before presenting.

## Phones and display

1. Connect the host laptop, phones and display to the same Wi-Fi.
2. Find the laptop's Wi-Fi IPv4 address using `ipconfig`.
3. Open `http://YOUR-LAPTOP-IP:3000/display` on the display. The QR derives its address from that browser URL.
4. Scan from a phone. Allow Node through the private-network firewall if Windows prompts.
5. Optionally set `NEXT_PUBLIC_APP_URL` to a fixed browser-reachable address and restart/rebuild. Leave it blank for automatic origin detection.

`localhost` on a phone means the phone itself. Use the laptop IP. UUID generation and the share-link fallback work on LAN HTTP; native sharing/clipboard depend on browser support and a secure context.

For a stable presentation:

```powershell
npm run build
npm start
```

Run one Node server and one SQLite file. Static export cannot run the backend. Keep the database on the host disk, not a shared network drive. The offline experience needs no internet after dependencies are installed.

## Staff tools

Sign into `/admin` using `ADMIN_PASSWORD` from `.env.local`. Signed HttpOnly SameSite sessions expire after eight hours. Changing the password and restarting invalidates sessions. Login attempts are limited.

- Load 24 labelled demo leaves; repeated loading preserves that demo set.
- Hide/restore a leaf; hidden leaves return 404 publicly and disappear from connected displays.
- Remove demo leaves while keeping visitor contributions.
- Search/filter recent leaves, view theme and AI/fallback counts, and refresh reflection.
- **Tree & display:** preview oak, pine, willow or cypress; choose spring, blossom, autumn or night colours; set seed, maturity, density, angle, breeze, quality and headline. Save to update connected displays. Pause new submissions while keeping the existing tree visible.
- **Visitor messages:** search and paginate original words, public interpretations and moderation outcomes. Hide/restore a linked leaf, or delete private words and hide it. Contact details are redacted and private messages encrypted before storage. Older leaves have no recoverable original words.

Setup also generates a server-only `MESSAGE_ENCRYPTION_KEY`. Keep it stable and back it up alongside the database; changing or losing it can make private history unreadable. Setup preserves existing keys, passwords and provider configuration. Staff authentication protects private history; public leaf fields are unchanged.

Staff operations are audited locally. The console shows up to 500 recent records. The public tree renders up to 120 leaves; older approved leaves remain in SQLite and can be retrieved with cursor pagination or keepsake URLs.

## Reliability and privacy

- Unique request keys and fingerprints protect retries. Changed content with an old key returns 409. Concurrent retries share one in-flight task in the single server process.
- SSE sends database snapshots when the revision changes, with 15-second reconciliation. The display queues arrivals and reconciles removals.
- Display caching stores approved public data for up to a day. Connection loss keeps the tree visible. A disconnected screen learns about removals after reconnecting.
- Default rate limits: five attempts per signed browser cookie per ten minutes, plus 60 global attempts per minute. Cookies can be cleared, so this is hackathon abuse control rather than bot-proof identity.
- After form consent, redacted original words and moderation outcomes are encrypted and stored privately for staff review. Public reads contain only approved leaf fields. Application code stores no visitor IP addresses. See `/privacy` for processing and retention details.
- Phone drafts and retry keys survive refresh in tab-local session storage. Successful receipts recover after refresh. Short leaf codes connect a phone result to the public display.
- WAL, transactions, constraints and server timestamps protect persistence. Day counts use Asia/Thimphu.
- Reflections describe participating visitors' themes, not a representative survey. Demo leaves are flagged throughout.
- Chamber numbers and locations follow the supplied blueprint. Thematic pathways remain project recommendations. GMC facts in private replies link to the official city information that supports them.

## Code map

```text
src/app/                 Pages and API routes
src/features/home/       Introduction and live preview
src/features/join/       Guided mobile submission
src/features/display/    Growing branch model, orbit camera, 3D/fallback and kiosk
src/features/studio/     Full-screen authoring, controls, growth previews and exports
src/features/leaf/       Result, share and SVG download
src/features/admin/      Staff console
src/components/ui/       Local shadcn-style components
src/lib/                 Types, catalog, schemas and browser helpers
src/hooks/use-tree.ts    SSE, reconciliation, offline state and cache
src/server/db/           SQLite migration, queries and transactions
src/server/services/     OpenAI, moderation, fallback and reflection
src/server/auth.ts       Signed sessions and authorization
src/server/http.ts       Bounded body parsing and origin checks
src/vendor/just-a-simple-tree/  Adapted geometry and retained MIT licence
scripts/                 Setup, smoke test and isolated test servers
tests/                   Browser, API and mocked OpenAI tests
data/                    Ignored SQLite files
docs/                    API, team ownership and demonstration guide
```

`components.json` configures shadcn aliases. Use `npx shadcn@latest add ...` to extend the component library.

## Validate

```powershell
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

The suite starts isolated servers on 3100/3101, a provider mock on 3102, and timestamped databases under `data/tests/`. It never uses the real API key or event database. Ports must be free. Reports and screenshots are ignored in `playwright-report/` and `test-results/`.

`npm run test:smoke` runs against an existing server (`TEST_BASE_URL` overrides localhost:3000). It creates six real test leaves in that database. Prefer the isolated suite for clean event data.

## Project reference

- **Repository:** https://github.com/yeshngedup-debug/GM-Tree.git
- **Live website:** https://gm-tree.vercel.app/
- **Git branch:** `main` (single branch only)

See [API contract](docs/API.md), [team ownership](docs/TEAM_TASKS.md), and [demo guide](docs/DEMO.md).
