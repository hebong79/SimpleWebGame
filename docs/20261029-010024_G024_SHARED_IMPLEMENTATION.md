# G024 shared integration — implementation and verification handoff

## Scope / candidate

- Task: `G024-SHARED`, sequential Builder09 shared role; implementer self-verification, **not independent acceptance**.
- Working root: `E:/Work2/Project/SimpleGames/worktrees/g024-ten-game-release`.
- Branch: `feature/g024-ten-game-release`; input HEAD `c0a08a55dd39c0c32440d9aaab37eccc85cf85f4`.
- Game09 commit `9ad8ca2c13a498bd5ccdc27deda560feefdb92bc` and game10 commit `0476a0032ad8cc51908829318bd9749549847c01` remain frozen. No game source, game unit test, builder evidence, old runtime, dependency, lockfile, PM-owned coordination document, service or Git main change was made.
- PM's subsequent notice: independent QA10 found Low `QA10-L01` (inherited direction string → pure-engine TypeError). Builder10 owns private fix1; **this candidate does not contain that fix**. Final game10 acceptance awaits PM intake + fresh independent delta + new build and affected reruns. QA09 and shared independent review are separate PM gates. No rollout/main merge is authorized at this stage.

## Implementation / owned files

| File | Change |
|---|---|
| `src/client/library.ts` | Preserve all37 literal records and favorite storage behavior; add exactly `chick-picnic` and `hamster-depot`, suitable Korean/English search tags, own launch URLs and original fixed SVG primitive miniatures |
| `package.json` | Description only; no scripts/dependencies/lock writes |
| `ecosystem.config.cjs` | Only script `artifacts/g022-build/src/server/index.js` → `artifacts/g024-build/src/server/index.js`; app/interpreter/host/port remain identical; **not executed** |
| `tests/e2e/{live-server,library-integration,multi-game-integration,breakout-integration,runner-jumper}.spec.ts` | Only 39/10/29 counts, pagination final39 and exact ten-link/home expectations; original game cases and security checks retained |
| `tests/e2e/g024-new-games.spec.ts` | Two unfrozen trusted80ms card/start/input/pause/resume/mute/wardrobe/home flows; public-control creation of all eight old profiles and old upcoming favorites, two new completed records, preservation and reload checks |
| `tests/g024-playwright.config.ts` | Current-task guarded config, desktop Chromium / 320px touch Chromium / mobile WebKit, one worker, retries0, no skipped cases/no webServer |
| `scripts/g024-verify.mjs` | Candidate/live runner, guarded origins, fresh unique reports, hash-matched build, real HTTP byte/CSP check, separate discovery/execution, scoped unit/launcher execution, history preservation and candidate cleanup |
| `artifacts/g024-integration/browser-gate.py` | Blocking named Win32 mutex wrapper shared with QA09/QA10; actual HANDLE/DWORD signatures; ReleaseMutex and CloseHandle in finally |
| `docs/20261029-010024_G024_SHARED_IMPLEMENTATION.md` | This handoff |

The actual home stylesheet is `public/home.css`, outside the explicitly named stylesheet paths. It was left untouched. New card art reuses existing miniature geometry/background classes and adds no inline style/script, external asset or game dependency. Vectors are original fixed `rect/ellipse/circle/path` compositions; no third-party asset/license/download. The existing cover framing crops the top of the chick's straw hat slightly; title, chick/road identity and action remain readable. Chromium PC/320 captures were inspected; WebKit functional/CSP/layout observations deliberately use no screenshotter.

Catalog result: **39 total / 10 available / 29 upcoming**. `memory-pieces` and `leisure-line` remain upcoming. `simplegames.library.favorites.v1` and old valid IDs are unchanged. Self-review programmatically compares every old catalog line, package fields excluding description and ecosystem text excluding the sole script delta.

## Reproducible runner commands

Run at the exact candidate/PM-authorized source root, using installed junction dependencies read-only:

```bash
"C:/Program Files/nodejs/node.exe" scripts/g024-verify.mjs --target candidate --mode smoke
"C:/Program Files/nodejs/node.exe" scripts/g024-verify.mjs --target candidate --mode full
# Optional distinct checks; --list is discovery ONLY, not execution/PASS.
"C:/Program Files/nodejs/node.exe" scripts/g024-verify.mjs --target candidate --mode full --units-only
"C:/Program Files/nodejs/node.exe" scripts/g024-verify.mjs --target candidate --mode full --list
```

Full browser regression exceeds this tool transport's 420-second foreground limit. Launch the **same command** as a tracked background terminal job and await its completion (not artifact polling). Runner stdout/stderr for each child stream into its unique run folder, so an interruption cannot erase already-emitted raw diagnostics.

**Only after PM has accepted QA09/QA10 fix1 and the shared review, rebuilt/deployed the authorized current candidate and verified PID/script/LISTEN:**

```bash
"C:/Program Files/nodejs/node.exe" scripts/g024-verify.mjs --target live --mode smoke --origin http://192.168.0.195:3116
"C:/Program Files/nodejs/node.exe" scripts/g024-verify.mjs --target live --mode full --origin http://192.168.0.195:3116
# Discovery may be inspected without contacting/starting any server:
"C:/Program Files/nodejs/node.exe" scripts/g024-verify.mjs --target live --mode full --origin http://192.168.0.195:3116 --list
```

These live commands **do not build/start/reuse/restart/stop a LAN server**; config has no webServer. They fetch expected public bytes and exercise isolated browser contexts on the explicit origin. Browser interactions create only per-test localStorage records, not server writes. Live/full selects home/HTTP, old six lifecycle cases, Flappy input, Dino/Doodle cases and both new-game flows/storage preservation. Candidate/full additionally includes library, multi-game and Breakout integration suites. Existing library's loopback-only request observer is unmodified and is not misapplied to LAN.

### Build / mode safety

- Exact supported Node: v24.16.0, `C:/Program Files/nodejs/node.exe`; TypeScript7.0.2 / Playwright1.64.1 reused without installs.
- Fixed build home `artifacts/g024-build`. A missing build can be created **only in candidate execution**, using the unchanged build script. Live/list never builds. Existing build without `g024-build-manifest.json` or any runtime-source/output hash mismatch is BLOCKED, not silently rebuilt/reused.
- Manifest binds raw source bytes (`src`, `public`, build script, tsconfig, package/lock) and all output bytes. Moving to another physical root does not waive byte checks. For PM's accepted fix/new checkout, preserve/archive the old task build first, then run candidate smoke to produce a **new** current-task build/manifest; never reuse these old pre-fix build bytes as accepted fix evidence. This worker did not merge the fix or archive/rewrite the frozen current build.
- Parent sets `GAME_TEST_BUILD_DIR=artifacts/g024-build`, fresh `GAME_TEST_ARTIFACT_DIR=artifacts/g024-integration/runs/<UTC+UUID>`, target/mode/origin before any child/config import.
- No inherited live origin in candidate; live requires the exact explicit `--origin`. Bad/missing origins are rejected before network/process startup. No arbitrary target/port/shell interpolation.
- Every browser child, including discovery, goes through `Local\HermesG024BrowserGate`. Blocking `WaitForSingleObject(INFINITE)` accepts acquired/abandoned ownership, uses correct HANDLE types and always releases/closes. One Playwright worker; all browsers serialized across QA roles.
- Candidate checks free loopback3145, creates only its own real `createGameServer` against current build/public, never reuses an occupied port; finally closes connections and verifies ECONNREFUSED. No PM2/3116 lifecycle operation.
- Launcher test is unchanged but hardwrites `artifacts/g017-builder`. Runner copies the **same bytes** of `tests/launch-local.test.mjs`, `scripts/serve_local.mjs`, `package.json` into a fresh run-owned `launcher-snapshot` and records both SHA256 values. Its fixture/stub tests run there, not historical paths. Server unit fixtures use the existing Hermes scratch policy.
- Before/after hashes, sizes and mtimes cover all other existing artifact files; new/removed historical files also fail the preservation gate. Prior builder/QA evidence is not overwritten.

## Evidence / results

- Build + initial HTTP79 and first smoke: `artifacts/g024-integration/runs/20261028T153143053Z-874407ae` — original observer FAIL retained (23 pass/1 fail).
- Corrected smoke: `artifacts/g024-integration/runs/20261028T153850989Z-89311da6` — **24 discovered / 24 actually passed**, failed/skipped/flaky0, HTTP79/79 exact-byte+CSP, historical178 unchanged, owned3145 stopped/refused.
- Unit-only: `artifacts/g024-integration/runs/20261028T154039285Z-2bf6e758` — **48 common + 361 game + 29 launcher = 438 actually passed**, fail/skip/todo0; typecheck exit0. Baseline totals were342; final game total is computed from current TAP, not assumed.
- Interrupted full foreground: `artifacts/g024-integration/runs/20261028T154057853Z-3a024740` — discovery213, transport interruption before completed report; **not an executed-pass total**.
- Full final run: `artifacts/g024-integration/runs/20261028T154903911Z-8db1851a` — **213 discovered / 213 actually passed**, failed/skipped/flaky0; **438 units actually passed** (48 common, 361 games, 29 unchanged-byte launcher), fail/skip/todo0; typecheck exit0; **79/79 HTTP bytes/CSP**; historical178 bytes/size/mtime unchanged; owned3145 stopped and ECONNREFUSED verified. Final runner exit0. Browser duration441018.914ms from actual JSON, not an estimated execution total.
- Authorized-origin live/full **discovery only**: `artifacts/g024-integration/runs/20261028T155751801Z-de51caca` — **171 discovered, zero executed**. No HTTP or LAN lifecycle action; this is not live runtime acceptance.
- `artifacts/g024-integration/diagnostic-history.json` — first smoke observer race, transport timeout and config CRLF-only observer diagnosis; no hidden product fix.
- `artifacts/g024-integration/origin-negative-guards.json` — missing/wrong live and candidate/live-origin confusion: three nonzero pre-network rejections.
- `artifacts/g024-integration/self-review.json` — staged allowlist and security-candidate review, literal37 preservation, package/config restriction, sixteen frozen game/test checkout bytes with actual raw SHA256. Implementer review, not independent verdict.

Each completed run records `invocation.json` (exact child commands/env/exit codes), `runtime-source-sha256.json`, `verification-input-sha256.json`, `http-bytecheck.json`, `discovery.json`, `playwright-results.json` when executed, raw stdout/stderr, historical-before/after and traces/attachments. Node phases add TAP logs, unit-summary and launcher same-byte proof. Discovery reporter's skipped fields do not count as execution; actual run stats must be zero skipped and match collected count.

The final `artifacts/g024-integration/handoff-manifest.json` records the exact feature commit after commit creation, owned-file raw SHA256, build/library hash, final input-hash correspondence and per-project/per-suite executed counts. It is task-owned evidence, not part of a self-referential tracked documentation commit. `artifacts/g024-build/g024-build-manifest.json` binds the pre-fix build; PM must not relabel it as accepted fix1 output.

## Staged/security review and limits

Staged explicit source/harness allowlist; `git diff --cached --check` and strict standalone new-spec/config TypeScript check exit0. Added production content is fixed catalog data and SVG DOM primitives; no credential, eval/HTML injection, shell:true, user-command interpolation, external request, new storage migration/deletion or relaxed CSP. Harness uses fixed exec+argument arrays and task-owned contained paths. Scan candidates retain file/line/category without secret values; existing DOM/canvas observations are not new production sinks. Original game rules/tests and strict security assertions are not weakened/skipped.

PM must perform the separate read-only shared review against these hashes. These are implementer self-tests only. Game09 independent result, game10 fix1 + independent delta, main merge, current accepted build/deployment, actual3116 runtime/PID/LISTEN and browser acceptance, final board/HANDOFF are **not complete here**. No remote push/global PM2 save/dump/startup/other-service changes. Physical phone input, audible listening and human duration/experience remain unverified; Chromium touch and WebKit are emulation. Old-suite virtual-clock checks are distinct from new unfrozen trusted80ms flows.
