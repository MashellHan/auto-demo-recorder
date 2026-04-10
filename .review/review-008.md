# Review 008 — 2026-04-11T03:35 UTC+8

## Status: IN_PROGRESS

## Score: 52/100

## Summary

This is the **sixth consecutive stagnation cycle** (reviews 003–008). The most recent commit remains "review: v007 — score 52/100" at 03:22. All project source files are still **untracked and uncommitted**. File modification timestamps confirm the source tree is byte-for-byte identical to what was present in reviews 003–007 — every `.ts` file was last written at 02:06–02:09, well before the first reviewer commit ran at 02:23. No source file has been touched, no new file has been created, no commit has been staged. The work agent remains completely inactive across six complete review cycles.

The codebase is architecturally sound where code exists. The score ceiling is entirely determined by absent, unstarted, or uncommitted features. Score is held at 52/100 — identical to reviews 003–007.

## Delta from Review 007

- Fixed: **nothing** — no source changes between review-007 and review-008
- New issues: none (identical codebase, no new code)
- Score change: 52 → 52
- Stagnation: **6 consecutive cycles with zero work agent commits (003, 004, 005, 006, 007, 008)**

---

## What's Working

The following has been true since review-003 and remains unchanged:

- TypeScript scaffold: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore` structurally sound
- Config schema (`src/config/schema.ts`) — Zod-based, proper defaults, `min(1)` guard on scenarios, strict TS, zero `any`
- Config loader (`src/config/loader.ts`) — async YAML read, Zod parse, clear error on missing scenario
- Tape builder (`src/pipeline/tape-builder.ts`) — valid VHS `.tape` syntax, Hide/Show setup blocks, key mapping, `repeat`, `sleep`, quote escaping
- VHS runner (`src/pipeline/vhs-runner.ts`) — async `execFile`, 120s timeout, stderr forwarding
- Frame extractor (`src/pipeline/frame-extractor.ts`) — correct `ffmpeg fps=N` filter, 60s timeout, async `execFile`
- Post-processor (`src/pipeline/post-processor.ts`) — `drawbox` + `drawtext` filter chain, `groupFramesByAnnotation` optimization, ffmpeg special-char escaping
- CLI `record` / `list` / `validate` commands wired
- 11 unit tests (5 tape-builder, 6 config-schema) — all pass via `npm test`
- Output directory structure: `<output.dir>/<timestamp>/<scenario>/`, `latest` symlink logic
- `dist/` compiled output present (compiled from current source)

---

## Issues Found

All issues below carry over unchanged from review-007 (and reviews 003–006). None have been addressed.

### CRITICAL

**`serve` command documented but entirely absent — broken advertised contract**

Files: `/Users/mengxionghan/.superset/projects/Tmp/auto-demo-recorder/src/cli.ts`, `/Users/mengxionghan/.superset/projects/Tmp/auto-demo-recorder/README.md`

`README.md` lists `demo-recorder serve` and "MCP server for agent integration" as a feature. `src/cli.ts` registers only `record`, `list`, and `validate`. There is no `src/mcp/` directory. `@modelcontextprotocol/sdk` is absent from `package.json`. Running `demo-recorder serve` currently produces "unknown command 'serve'". This has been open and unresolved for 6 consecutive review cycles.

---

### HIGH

**MCP server (`src/mcp/server.ts`) entirely absent — primary agent integration path not started**

Design doc section 5 defines the full interface including `demo_recorder_record` tool, inputSchema, and response format. No `server.ts`, no SDK dependency, no stub. The key differentiator of the project (agent invocability via MCP) has not been started after 6 cycles.

**Ad-hoc recording mode (`--adhoc`) not implemented**

Files: `/Users/mengxionghan/.superset/projects/Tmp/auto-demo-recorder/README.md`, `/Users/mengxionghan/.superset/projects/Tmp/auto-demo-recorder/src/cli.ts`

`README.md` documents `demo-recorder record --adhoc --command "..." --steps "..."`. The `record` command in `src/cli.ts` accepts only `--config`, `--scenario`, and `--no-annotate`. Configless usage — the primary path for ad-hoc agent invocation — is completely unavailable.

**`last` and `init` commands not implemented**

`README.md` documents both. Neither is registered in `src/cli.ts`. Both return "unknown command" errors at runtime.

**No `ANTHROPIC_API_KEY` guard before Anthropic SDK instantiation**

File: `/Users/mengxionghan/.superset/projects/Tmp/auto-demo-recorder/src/pipeline/annotator.ts:32`

`const client = new Anthropic()` is unconditional. If `ANTHROPIC_API_KEY` is missing, the SDK throws an opaque internal error with no user-actionable guidance. A guard must be added before instantiation with a clear message like "ANTHROPIC_API_KEY environment variable is required for annotation".

**`execSync` blocks the Node.js event loop for build command execution**

File: `/Users/mengxionghan/.superset/projects/Tmp/auto-demo-recorder/src/index.ts:63–64`

```typescript
const { execSync } = await import('node:child_process');
execSync(config.project.build_command, { cwd: projectDir, stdio: 'inherit' });
```

This is the only synchronous subprocess call in the entire pipeline. All other subprocess calls use async `execFile`. This blocks the event loop for the entire duration of the build command.

**No retry logic in annotator API call loop**

File: `/Users/mengxionghan/.superset/projects/Tmp/auto-demo-recorder/src/pipeline/annotator.ts:58–103`

`client.messages.create(...)` makes a bare API call with no retry. A single transient network error or 429 response on any frame aborts the entire annotation pass and discards all already-processed frames. The `catch` at line 80 handles JSON parse failures only — network errors and API rejections propagate uncaught up through the pipeline.

---

### MEDIUM

**`drawtext` timing incorrect when `extract_fps != 1`**

File: `/Users/mengxionghan/.superset/projects/Tmp/auto-demo-recorder/src/pipeline/post-processor.ts:49–50`

Frame `index` values are used directly as seconds in `between(t, startIndex, endIndex)`. At `extract_fps = 2`, frame index 10 represents second 5. `extractFps` is not threaded into `PostProcessOptions` or `buildDrawTextFilters`. The bug produces misaligned annotations on any config that changes `extract_fps` from its default of 1.

**`handlebars` in production dependencies but unused**

File: `/Users/mengxionghan/.superset/projects/Tmp/auto-demo-recorder/package.json:29`

`handlebars` is listed as a production dependency. `src/pipeline/tape-builder.ts` uses string concatenation. `templates/` is empty. Either remove the dependency (`npm uninstall handlebars`) and delete the empty `templates/` directory, or implement `templates/tape.hbs`.

**Root `demo-recorder.yaml` is an unguarded test artifact**

File: `/Users/mengxionghan/.superset/projects/Tmp/auto-demo-recorder/demo-recorder.yaml`

This `e2e-test` config at the repo root is not gitignored. When any user runs `demo-recorder` from this repo's root, `loadConfig` will resolve to this file rather than their own config. Move to `examples/` or add to `.gitignore`.

**`record()` function is 126 lines — exceeds 50-line project guideline**

File: `/Users/mengxionghan/.superset/projects/Tmp/auto-demo-recorder/src/index.ts:37–163`

The `record()` function performs directory setup, build execution, tape generation, VHS recording, frame extraction, annotation, post-processing, report writing, symlink management, and console output in a single body. Each phase should be extracted into a named helper.

**`config.annotation.enabled` mutated in-place in CLI handler**

File: `/Users/mengxionghan/.superset/projects/Tmp/auto-demo-recorder/src/cli.ts:24`

```typescript
config.annotation.enabled = false;  // direct mutation
```

This violates the project's immutability rule. Replace with an immutable spread at the call site to `record()`.

**No `utils/logger.ts` — `console.log`/`console.error` used throughout pipeline**

Design doc specifies `src/utils/logger.ts`. All pipeline stages write directly to stdout/stderr. Library callers (e.g., MCP server) cannot suppress or redirect output.

**`test:coverage` script broken — `@vitest/coverage-v8` not in devDependencies**

File: `/Users/mengxionghan/.superset/projects/Tmp/auto-demo-recorder/package.json`

`"test:coverage": "vitest run --coverage"` is defined but `@vitest/coverage-v8` is absent from `devDependencies`. Running it fails with a missing dependency error.

---

### LOW

**README does not mention `ANTHROPIC_API_KEY` requirement** — Users hit a cryptic SDK error on first annotated run.

**`src/utils/` directory not created** — `ffmpeg.ts` and `logger.ts` specified in design doc §3 are absent.

**`package.json` missing `author` field** — Required for npm publish.

**No `.nvmrc`** — `engines.node >= 20` is declared without a lockfile companion for version pinning.

---

## Action Items for Work Agent

**ESCALATION NOTICE: 6 consecutive cycles with no commits. Work agent must begin executing immediately.**

Items are ordered by priority. Commit after each item is complete.

0. **[IMMEDIATE] Commit all existing source files**

```bash
cd /Users/mengxionghan/.superset/projects/Tmp/auto-demo-recorder
git add src/ bin/ test/ package.json package-lock.json tsconfig.json vitest.config.ts \
        .gitignore README.md examples/ demo-recorder.yaml
git commit -m "feat: initial implementation — Phase 1 pipeline complete"
```

The source tree has existed untracked through 6 complete review cycles. This must be done before any other work.

1. **[CRITICAL] Implement MCP server** — Create `src/mcp/server.ts`, add `@modelcontextprotocol/sdk` to `package.json`, register `serve` subcommand in `src/cli.ts` that starts the server in stdio transport mode. Use the inputSchema from design doc §5.1.

2. **[HIGH] Add `ANTHROPIC_API_KEY` guard** — In `annotateFrames` in `src/pipeline/annotator.ts`, before `new Anthropic()`, check `process.env.ANTHROPIC_API_KEY` and throw `new Error('ANTHROPIC_API_KEY environment variable is required')` if absent.

3. **[HIGH] Replace `execSync` with async exec** — In `src/index.ts:64`, replace `execSync` with a Promise-wrapped `execFile` call matching the pattern already used in `vhs-runner.ts`.

4. **[HIGH] Add retry logic to annotator** — Wrap `client.messages.create` in a 3-attempt retry loop with exponential backoff (500ms base). The outer `catch` should re-throw on exhaustion, not silently push a warning frame.

5. **[HIGH] Implement `--adhoc` recording mode** — Add `--adhoc`, `--command`, `--steps` options to the `record` command in `src/cli.ts`. Parse comma-separated step tokens into `Step[]`. Construct a minimal in-memory `Config` and call `record()`.

6. **[HIGH] Implement `last` and `init` commands** — `last`: read `latest/` symlink, print paths and summary from `report.json`. `init`: write a templated `demo-recorder.yaml` to cwd.

7. **[MEDIUM] Fix `drawtext` timing** — Add `extractFps: number` to `PostProcessOptions`; divide frame indices by `extractFps` when computing seconds for `between(t, ...)`.

8. **[MEDIUM] Install `@vitest/coverage-v8`** — `npm install -D @vitest/coverage-v8`.

9. **[MEDIUM] Remove or implement `handlebars`** — Either `npm uninstall handlebars && rm -rf templates/` or implement `templates/tape.hbs`.

10. **[MEDIUM] Move root `demo-recorder.yaml`** to `examples/e2e-test.yaml` and add the root file to `.gitignore`.

11. **[MEDIUM] Fix in-place mutation** in `src/cli.ts:24` — use immutable object spread.

12. **[MEDIUM] Increase test coverage** — Add tests for `vhs-runner`, `frame-extractor`, `post-processor`, `annotator` (mock SDK), and CLI handlers. Target ≥ 80%.

---

## Code Quality Notes

Code quality where code exists is genuinely solid: strict TypeScript with zero `any`, consistent async `execFile` pattern throughout, Zod schema validation with inferred types, `groupFramesByAnnotation` correctly deduplicates consecutive identical annotations to reduce redundant ffmpeg drawtext filters, proper ffmpeg special-character escaping. The score is limited entirely by what has not been implemented or committed.

`record()` in `src/index.ts` at 126 lines is the main structural concern in the existing code. The `execSync` inline import on line 63 is the only quality regression relative to the rest of the pipeline.

---

## Test Coverage

- Covered: `buildTape` (5 tests), `ConfigSchema` (6 tests) — 11 tests, all pass
- Not covered: `loadConfig`, `findScenario`, `runVhs`, `extractFrames`, `annotateFrames`, `postProcess`, `record()` orchestrator, all CLI handlers
- Coverage tooling broken: `@vitest/coverage-v8` absent; `npm run test:coverage` fails at startup
- Estimated statement coverage: ~15–20%
- Required minimum: 80%

---

## Review Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 1     | block  |
| HIGH     | 5     | warn   |
| MEDIUM   | 7     | info   |
| LOW      | 4     | note   |

Verdict: BLOCK — 1 CRITICAL (MCP server/`serve` command advertised but entirely absent), 5 HIGH issues unaddressed, and **6 consecutive stagnation cycles** with zero work agent commits. Source code has never been committed to git. Work agent must execute item 0 immediately, then proceed through the action items in priority order.
