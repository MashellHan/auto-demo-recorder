# Review 007 — 2026-04-11T03:00 UTC+8

## Status: IN_PROGRESS

## Score: 52/100

## Summary

This is the **fifth consecutive stagnation cycle** (reviews 003–007). The git log shows only five commits, the most recent being "review: v006 — score 52/100". All project source files remain **untracked and uncommitted**. File modification timestamps on every `.ts` file confirm the source tree predates review-006 — nothing has changed. The codebase is byte-for-byte identical to the state reviewed in cycles 003–006. Every issue from review-006 carries forward unresolved. Score remains at 52/100.

**The work agent has not produced a single commit in five complete review cycles.**

## Delta from Review 006

- Fixed: **nothing** — no source changes between review-006 and review-007
- New issues: none (identical codebase)
- Score change: 52 → 52 (no change)
- Stagnation: **5 consecutive cycles with zero work agent commits (003, 004, 005, 006, 007)**

---

## What's Working

The following has been true since review-003 and remains true unchanged:

- TypeScript scaffold: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore` all structurally sound
- Config schema (`src/config/schema.ts`) — Zod-based validation, proper defaults, `min(1)` guard on scenarios, strict TypeScript, zero `any`
- Config loader (`src/config/loader.ts`) — async YAML read, Zod parse, clear error on missing scenario
- Tape builder (`src/pipeline/tape-builder.ts`) — valid VHS `.tape` syntax, Hide/Show setup blocks, key mapping, `repeat`, `sleep`, quote escaping
- VHS runner (`src/pipeline/vhs-runner.ts`) — async `execFile`, 120s timeout, stderr forwarding
- Frame extractor (`src/pipeline/frame-extractor.ts`) — correct `ffmpeg fps=N` filter, 60s timeout
- Post-processor (`src/pipeline/post-processor.ts`) — `drawbox` + `drawtext` filter chain, `groupFramesByAnnotation` optimization, ffmpeg special-char escaping
- CLI `record` / `list` / `validate` commands wired and functional
- 11 unit tests present (5 tape-builder, 6 config-schema) that pass via `npm test`
- Output directory structure: `<output.dir>/<timestamp>/<scenario>/`, `latest` symlink logic

---

## Issues Found

All issues below are unchanged from review-006. Re-reported verbatim because none have been addressed in five cycles.

### CRITICAL

**`serve` command documented and advertised but entirely absent**

Files: `src/cli.ts`, `README.md`

`README.md` lists `demo-recorder serve` as a documented command and "MCP server for agent integration" as a feature. `src/cli.ts` registers only `record`, `list`, `validate`. `src/mcp/` contains no files. `@modelcontextprotocol/sdk` is absent from `package.json`. Running `demo-recorder serve` produces an "unknown command 'serve'" error. This has been open and unaddressed for 5 cycles. This is a broken contract with documented users and agents.

---

### HIGH

**MCP server (`src/mcp/server.ts`) entirely absent — primary agent integration path not started**

No `server.ts`, no SDK dependency, no stub. Design doc §5 defines the full interface. This is the key differentiator for agent use and has not been started after 5 cycles.

**Ad-hoc recording mode (`--adhoc`) not implemented**

`README.md` and design doc §4.1 document `demo-recorder record --adhoc --command "..." --steps "..."`. No `--adhoc` option in `src/cli.ts`. Agents without a committed `demo-recorder.yaml` cannot use the tool at all.

**`last` and `init` commands not implemented**

`README.md` documents both commands. Neither is registered in `src/cli.ts`. Both return "unknown command" errors.

**No `ANTHROPIC_API_KEY` guard before SDK instantiation**

File: `src/pipeline/annotator.ts:32`

`const client = new Anthropic()` is unconditional. Missing env var causes an opaque SDK-internal error with no user-actionable message. Guard required before instantiation.

**`execSync` blocks the event loop for build command execution**

File: `src/index.ts:63-64`

`execSync(config.project.build_command, ...)` is the only blocking call in the entire pipeline. All other subprocess calls use async `execFile`. Must be converted to async.

**No retry logic in annotator API call loop**

File: `src/pipeline/annotator.ts:58-73`

`client.messages.create(...)` has no retry. A transient error or 429 on any frame aborts the entire annotation pass and discards all already-processed frames. The `catch` at line 80 handles JSON parse failures only — network errors and API rejections propagate uncaught and kill the pipeline.

---

### MEDIUM

**`drawtext` timing incorrect when `extract_fps != 1`**

File: `src/pipeline/post-processor.ts:49-50`

Frame indices are used directly as seconds in `between(t, ...)`. At `extract_fps = 2`, frame index 10 represents second 5. `extractFps` is not threaded into `PostProcessOptions` or `buildDrawTextFilters`.

**`handlebars` in production dependencies but unused — `templates/` is empty**

`package.json` ships `handlebars` as a production dep. `tape-builder.ts` uses string concatenation. The `templates/` directory is empty. Either remove the dependency and directory, or implement the Handlebars template.

**Root `demo-recorder.yaml` is an unguarded test artifact**

The `e2e-test` config at the repo root is not gitignored. When any user runs `demo-recorder` from this repo's root directory, `loadConfig` will resolve to this artifact rather than their own config.

**`record()` function is 126 lines — exceeds 50-line project guideline**

File: `src/index.ts:37-163`

The function performs directory setup, build execution, tape generation, VHS recording, frame extraction, annotation, post-processing, report writing, symlink management, and console output in one body.

**`config.annotation.enabled` mutated in-place in CLI handler**

File: `src/cli.ts:24`

`config.annotation.enabled = false` is a direct in-place mutation, violating the project's immutability rule. Replace with object spread.

**No `utils/logger.ts` — `console.log`/`console.error` used throughout pipeline modules**

Design doc specifies `src/utils/logger.ts`. Pipeline stages write directly to stdout/stderr. Library callers cannot suppress or redirect output.

**`test:coverage` script broken — `@vitest/coverage-v8` not installed**

`package.json` defines `"test:coverage": "vitest run --coverage"` but `@vitest/coverage-v8` is absent from `devDependencies`.

---

### LOW

**README does not mention `ANTHROPIC_API_KEY` requirement** — Users hit a cryptic SDK error on any annotated run.

**`src/utils/` directory is not created** — `ffmpeg.ts` and `logger.ts` specified in design doc are absent.

**`package.json` missing `author` field** — Required for npm publish.

**No `.nvmrc`** — `engines.node >= 20` specified without a lockfile companion.

---

## Action Items for Work Agent

**ESCALATION NOTICE: 5 consecutive cycles with no commits. The following items must be actioned immediately. Begin with item 0 and commit after each item.**

0. **[IMMEDIATE] Commit all existing source files** — `git add src/ bin/ test/ package.json tsconfig.json vitest.config.ts .gitignore README.md examples/ demo-recorder.yaml` then `git commit -m "feat: initial implementation skeleton"`. The source has existed untracked for 5 review cycles and must be committed first.

1. **[CRITICAL] Implement MCP server** — Create `src/mcp/server.ts` with the `demo_recorder_record` tool (inputSchema per design doc §5.1). Add `@modelcontextprotocol/sdk` to `package.json`. Register `serve` command in `src/cli.ts` to start the server in stdio mode.

2. **[HIGH] Add `ANTHROPIC_API_KEY` guard** — Top of `annotateFrames` in `src/pipeline/annotator.ts`: check `process.env.ANTHROPIC_API_KEY`; throw a clear error if absent before instantiating the Anthropic client.

3. **[HIGH] Replace `execSync` with async exec** — In `src/index.ts:64`, replace `execSync` with a Promise-wrapped `execFile` call.

4. **[HIGH] Add retry logic to annotator** — Wrap `client.messages.create` in a 3-attempt loop with exponential backoff (500ms → 1s → 2s) covering both network errors and API errors, not just JSON parse failures.

5. **[HIGH] Implement `--adhoc` recording mode** — Add `--adhoc`, `--command`, `--steps` options to the `record` command in `src/cli.ts`. Parse comma-separated step strings into `Step[]`. Construct a minimal in-memory `Config` and pass to `record()`.

6. **[HIGH] Implement `last` and `init` commands** — `last`: read `latest/` symlink, print recording paths and summaries from `report.json`. `init`: scaffold `demo-recorder.yaml` in cwd.

7. **[MEDIUM] Fix `drawtext` timing** — Thread `extractFps` through `PostProcessOptions` and `buildDrawTextFilters`; divide frame indices by `extractFps` for `between(t, ...)` values.

8. **[MEDIUM] Add `@vitest/coverage-v8` to devDependencies** — Run `npm install -D @vitest/coverage-v8`.

9. **[MEDIUM] Remove or implement `handlebars`** — Either `npm uninstall handlebars` and delete `templates/`, or implement `templates/tape.hbs`.

10. **[MEDIUM] Move root `demo-recorder.yaml`** to `examples/e2e-test.yaml` or add `demo-recorder.yaml` to `.gitignore`.

11. **[MEDIUM] Fix in-place config mutation** in `src/cli.ts:24` — Replace with immutable object spread.

12. **[MEDIUM] Split `record()` into helpers** — Extract `setupOutputDirs`, `runBuild`, `runAnnotationPipeline`, `writeReport`, `updateLatestSymlink` from `src/index.ts`.

13. **[MEDIUM] Add tests for pipeline modules** — Mock `execFile` for `vhs-runner` and `frame-extractor`; test post-processor pure functions; mock Anthropic SDK for annotator. Target >= 80% coverage.

---

## Code Quality Notes

TypeScript quality remains high where code exists: strict mode, zero `any`, Zod-inferred types, consistent async error propagation, `groupFramesByAnnotation` optimization in post-processor, clean escaping for both VHS tape and ffmpeg drawtext. The code surface that has been written is solid and could be reviewed favorably in isolation.

The score ceiling is held down entirely by: missing MCP server (advertised as a feature), missing ad-hoc mode, missing guards, missing async conversion, no retry logic in the annotator, and — fundamentally — the fact that the entire source tree has never landed in git after **5 review cycles**.

---

## Test Coverage

- Covered: `buildTape` (5 tests), `ConfigSchema` (6 tests) — 11 tests total, all pass
- Not covered: `loadConfig`, `findScenario`, `runVhs`, `extractFrames`, `annotateFrames`, `postProcess`, `record` orchestrator, all CLI handlers
- Coverage tooling broken: `@vitest/coverage-v8` not installed; `npm run test:coverage` fails
- Estimated coverage: ~15-20%
- Required minimum: 80%

---

## Review Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 1     | block  |
| HIGH     | 5     | warn   |
| MEDIUM   | 7     | info   |
| LOW      | 4     | note   |

Verdict: BLOCK — 1 CRITICAL (MCP server advertised but absent), 5 HIGH issues, and **5 consecutive stagnation cycles** with no work agent activity. Source code has never been committed to git. Work agent must begin with item 0 immediately.
