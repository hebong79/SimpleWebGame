# G024 — Independent acceptance and final candidate

## Scope and decision
- Original09 **병아리의 소풍** (`chick-picnic`, `/games/09-crossy/index.html`) and original10 **햄스터 택배 창고** (`hamster-depot`, `/games/10-sokoban/index.html`, 20 original levels).
- PM 대현자; two initial game builders, a separate independent tester for each game, sequential scoped shared integration and focused follow-up review. These were temporary Hermes workers, not existing native Cody console sessions.
- Existing 37 catalog records/IDs/favorites retained; exactly two added: **39 total / 10 playable / 29 upcoming**. `memory-pieces` and `leisure-line` remain upcoming; they are not originals09/10.
- User authorized local main merge and only the existing `number-garden-2048` application's LAN3116 build switch/restart. No remote push, global PM2 save/dump/startup, firewall, other service, installation or payment.

## Accepted source and review
- Initial09: `9ad8ca2c13a498bd5ccdc27deda560feefdb92bc`.
- Initial10: `0476a0032ad8cc51908829318bd9749549847c01`.
- Shared source: `ca0ea50a5e5990f346a0ab9734057e66cb8619ef` (13 shared files).
- Fixed10: `73907bec09c6a25acecd31f8e959e5ceaf3db349`; guard1 line + narrowly added regression42 cases. Original QA10-L01 FAIL remains unchanged in `G024_QA10.json`; inherited invalid direction names threw instead of no-op. New `G024_QA10_DELTA.json` resolves it with independent proof and actual re-execution.
- Combined final source candidate: `90d14128e93300e6ef7c2bc69406195337c57c85`. PM independently matched current source bytes, reviewed manifests and real test outputs.
- `G024_QA09.json`: PASS within explicit automated scope; baseline32, independent14, actualHTTP52, separately labeled hidden-handler environment fixtures3.
- `G024_QA10.json`: original FAIL retained; 20 maps independently solved/optimal bounds matched, 20 stages ×3 browser profiles =60 public-input HTTP clears. `G024_QA10_DELTA.json`: fresh PASS, original repro4/4, full unit106/106, independent focused115/115. Prior HTTP proof reused only with unchanged6-file hashes and independently demonstrated valid-input equivalence; no claim of browser rerun in that delta.
- `G024_SHARED_REVIEW.json`: independent PASS for13 shared files, no security/logic finding. Its parsed213 browser/438 unit/79HTTP records are explicitly PRE-FIX historical proof, not final reruns.

## Final execution after fix integration
- Node executable `C:/Program Files/nodejs/node.exe`, v24.16.0; installed TypeScript7.0.2 and Playwright1.64.1, no installation.
- Commands, from integration worktree:
  - `"C:/Program Files/nodejs/node.exe" scripts/g024-verify.mjs --target candidate --mode smoke`
  - `"C:/Program Files/nodejs/node.exe" scripts/g024-verify.mjs --target candidate --mode full`
- New build: `artifacts/g024-build`, manifest SHA256 `4b9f9c4d9927a84248d91797e8684eb646036f5a6bd4f5c8f8206a8a60c0f49b`. Prior pre-fix build retained at `artifacts/g024-build-pre-fix1`.
- Final smoke: **24/24**, new-source HTTP79 exact bytes/strict CSP/nosniff.
- Final full: **213 discovered / 213 actually passed**, each browser profile71; failure/skip/flaky/retry0. **480 unit tests passed**: common48 + game403 + launcher29; failure/skip/todo0. HTTP79/79 exact bytes and security headers. Historical426 files byte/size/mtime unchanged. Own candidate3145 stopped/refused.
- Final run: integration `artifacts/g024-integration/runs/20261028T161922799Z-0937816e/`, including raw JSON, TAP, command/env/exit manifests and hashes. UTC filename corresponds to October29 KST; it is not an earlier candidate.
- PM readback: original-root `artifacts/g024-pm/final-candidate-acceptance.json`.
- Runtime ZIP: original-root `artifacts/g024-delivery/SimpleGames_10Games_Runtime.zip`,83 entries; extracted into a fresh Hermes scratch directory with no node_modules/tests and actually served using Node only. All79 public files matched source bytes and strict security headers. Packaging is separate from deployment.

## Next release gates / limits
- This document authorizes the PM acceptance transition for this candidate, not a claim that deployment already happened. Main merge tree, exact PM2 script/PID/LISTEN, actual LAN3116 HTTP/UI and final board readback must be recorded in the final release report.
- Preserve pre-existing original-root dirty documents and unrelated untracked files; no stash/reset/clean or blanket staging.
- Physical Android/iPhone touch, audible sound listening, human play-time/difficulty goals, native OS/tab hide event delivery on this Windows runner, WebKit screenshot visual acceptance and Firefox remain unverified. Functional Chromium/mobile/WebKit, geometry/CSP, synthetic lifecycle and hidden environment fixtures are labeled separately.
- Saved PM2 dump's historical g016 restart risk is NOT repaired by an in-memory app switch; no PM2 global save or Windows startup edits are in scope.
