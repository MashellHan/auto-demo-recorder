# Review 006 — 2026-04-11T02:00 UTC+8

## Status: IN_PROGRESS

## Score: 52/100

## Summary

Four consecutive review cycles (003–006) have produced zero work agent commits. The git log shows only five commits, the most recent being "review: v005 — score 52/100". All project source files (src/, bin/, test/, package.json, README.md, vitest.config.ts, tsconfig.json, demo-recorder.yaml, .gitignore) remain **untracked** — they have never been committed to the repository. The source code is byte-for-byte identical to the state reviewed in cycles 003–005. Every issue from review-005 carries forward with no change. Score is held at 52/100.

This is the fourth consecutive stagnation cycle. The work agent has not executed. The outstanding issues are not ambiguous technical blockers; they are clearly specified, prioritized, and scoped. The work agent must begin committing changes immediately.

## Delta from Review 005

- Fixed: **nothing** — no source changes whatsoever between review-005 and review-006
- New issues: none (same codebase; no new code to introduce new issues)
- Score change: 52 → 52 (no change)
- Stagnation alert: **YES** — source has not changed in 4 review cycles (003, 004, 005, 006)

---

## What's Working

The following has been true since review-003 and remains true unchanged:

- TypeScript scaffold: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore` all structurally sound
- Config schema (`src/config/schema.ts`) — Zod-based validation, proper defaults, `min(1)` guard on scenarios, strict TypeScript, zero `any`
- Config loader (`src/config/loader.ts`) — async YAML read, Zod parse, clear error on missing file
- Tape builder (`src/pipeline/tape-builder.ts`) — valid VHS `.tape` syntax, Hide/Show setup blocks, key mapping, `repeat`, `sleep`, quote escaping
- VHS runner (`src/pipeline/vhs-runner.ts`) — async `execFile`, 120 s timeout, stderr forwarding
- Frame extractor (`src/pipeline/frame-extractor.ts`) — correct `ffmpeg fps=N` filter, 60 s timeout
- Post-processor (`src/pipeline/post-processor.ts`) — `drawbox` + `drawtext` filter chain, `groupFramesByAnnotation` optimization, ffmpeg special-char escaping
- CLI `record` / `list` / `validate` commands wired and functional
- 11 unit tests (5 tape-builder, 6 config-schema) all pass via `npm test`
- Output directory structure: `<output.dir>/<timestamp>/<scenario>/`, `latest` symlink updated after each run

---

## Issues Found

All issues below are unchanged from review-005. They are re-reported verbatim as none have been addressed.

### CRITICAL

**`serve` command documented but not implemented — MCP server absent**

Files: `src/cli.ts`, `README.md`

`README.md` advertises `demo-recorder serve` and lists "MCP server for agent integration" as a feature. `src/cli.ts` registers only `record`, `list`, and `validate`. `src/mcp/` contains no files. `@modelcontextprotocol/sdk` is not in `package.json`. Running `demo-recorder serve` produces an "unknown command" error. This is a shipped broken interface claim that has been open for 4 cycles with no action.

---

### HIGH

**MCP server (`src/mcp/`) entirely absent — Phase 2 core feature not started**

The directory exists but is empty. No `server.ts`, no SDK dependency, no stub. This is the primary agent integration path per design doc §5.

**Ad-hoc recording mode (`--adhoc`) not implemented**

`README.md` and design doc §4.1 document `demo-recorder record --adhoc --command "..." --steps "..."`. No `--adhoc` option exists in `src/cli.ts`. Agents without a committed `demo-recorder.yaml` cannot use this tool.

**`last` and `init` commands not implemented**

`README.md` documents `demo-recorder last` and `demo-recorder init`. Neither is registered in `src/cli.ts`. These are documented public interface commands that return errors.

**No `ANTHROPIC_API_KEY` guard before SDK instantiation**

File: `src/pipeline/annotator.ts:32`

`const client = new Anthropic()` is unconditional. If the env var is absent, the SDK throws an opaque internal error rather than a clear, user-actionable message. An explicit check is required before instantiation.

**`execSync` blocks the Node.js event loop for build command execution**

File: `src/index.ts:63-64`

`execSync(config.project.build_command, ...)` is used here while every other child-process call (`runVhs`, `extractFrames`, `postProcess`) uses async `execFile`. This is the only synchronous blocking call and must be made async.

**No retry logic in annotator's per-frame API call loop**

File: `src/pipeline/annotator.ts:58-73`

`client.messages.create(...)` is called once per frame with no retry. A transient network error or 429 on any frame aborts the entire annotation pass and discards all already-processed frames. The `catch` at line 80 handles JSON parse failures only — API rejections propagate uncaught. A 3-attempt exponential-backoff wrapper is required.

---

### MEDIUM

**`drawtext` timing incorrect when `extract_fps != 1`**

File: `src/pipeline/post-processor.ts:49-50`

Frame indices are passed directly as seconds to `between(t, ...)`. At `extract_fps = 2`, frame index 10 represents second 5. The calculation must divide by `extractFps`. The value is not threaded through the call chain.

**`handlebars` in production `dependencies` but unused — `templates/` is empty**

`package.json` ships `handlebars` to end users. `tape-builder.ts` uses string concatenation. Either remove the dependency and the empty `templates/` directory, or implement the Handlebars template as specified.

**`demo-recorder.yaml` at repo root is an unguarded test artifact**

The `e2e-test` config at the repo root is not in `.gitignore`. When `demo-recorder` runs from this repo root, `loadConfig` will resolve to this artifact rather than the user's own config.

**`record()` function is 126 lines — above 50-line project guideline**

File: `src/index.ts:37-163`

The function performs directory creation, build execution, tape generation, VHS recording, frame extraction, annotation, post-processing, report writing, symlink management, and output formatting in one body. Per the project coding-style rule, functions must be under 50 lines.

**`config.annotation.enabled` mutated in-place in CLI handler**

File: `src/cli.ts:24`

`config.annotation.enabled = false` violates the project's immutability rule. Must use object spread.

**No `utils/logger.ts` — `console.log`/`console.error` used throughout pipeline modules**

Design doc specifies `src/utils/logger.ts`. All pipeline stages write directly to stdout/stderr. When `record()` is used as a library, callers cannot suppress or redirect logs.

**`test:coverage` script broken — `@vitest/coverage-v8` not installed**

`package.json` defines `"test:coverage": "vitest run --coverage"` but `@vitest/coverage-v8` is absent from `devDependencies`. The command fails immediately.

---

### LOW

**README does not mention `ANTHROPIC_API_KEY` requirement** — Users hit a cryptic SDK error on any annotated run.

**`src/utils/` directory is empty** — `ffmpeg.ts` and `logger.ts` were specified in the design doc structure.

**`package.json` missing `author` field** — Required for a publishable npm package.

**No `.nvmrc`** — `engines.node >= 20` is specified but `.nvmrc` is absent.

---

## Action Items for Work Agent (URGENT — prioritized)

These action items are identical to review-005. None have been started. The work agent must begin immediately with item 1 and commit after each item.

1. **[CRITICAL] Implement MCP server** — Create `src/mcp/server.ts` with the `demo_recorder_record` tool (inputSchema per design doc §5.1). Add `@modelcontextprotocol/sdk` to `package.json`. Register `serve` command in `src/cli.ts` that starts the MCP server in stdio mode. Commit.

2. **[HIGH] Add `ANTHROPIC_API_KEY` guard** — At the top of `annotateFrames` in `src/pipeline/annotator.ts`, check `process.env.ANTHROPIC_API_KEY` and throw a clear error if absent before instantiating the Anthropic client.

3. **[HIGH] Replace `execSync` with async exec** — In `src/index.ts:64`, replace `execSync` with a Promise-wrapped `execFile` call.

4. **[HIGH] Add retry logic to annotator** — Wrap `client.messages.create` in a 3-attempt loop with exponential backoff (500ms → 1s → 2s) covering API errors, not just JSON parse failures.

5. **[HIGH] Implement `--adhoc` recording mode** — Add `--adhoc`, `--command`, `--steps` options to the `record` command. Parse comma-separated step strings into `Step[]`. Construct a minimal in-memory `Config` and pass to `record()`.

6. **[HIGH] Implement `last` and `init` commands** — `last`: read `latest/` symlink, print recording paths and summaries. `init`: scaffold `demo-recorder.yaml` in cwd.

7. **[MEDIUM] Fix `drawtext` timing** — Thread `extractFps` through `postProcess` options and `buildDrawTextFilters`; divide frame indices by `extractFps` for `between(t, ...)` values.

8. **[MEDIUM] Add `@vitest/coverage-v8` to devDependencies** — Run `npm install -D @vitest/coverage-v8`.

9. **[MEDIUM] Remove or implement `handlebars`** — Either `npm uninstall handlebars` + delete `templates/`, or implement `templates/tape.hbs`.

10. **[MEDIUM] Move root `demo-recorder.yaml`** — Move to `examples/e2e-test.yaml` or add to `.gitignore`.

11. **[MEDIUM] Fix in-place config mutation** — Replace `config.annotation.enabled = false` with immutable spread in `src/cli.ts:24`.

12. **[MEDIUM] Split `record()` into helpers** — Extract `setupOutputDirs`, `runBuild`, `runAnnotationPipeline`, `writeReport`, `updateLatestSymlink` from `src/index.ts:37-163`.

13. **[MEDIUM] Add tests for pipeline modules** — Mock `execFile` for `vhs-runner` and `frame-extractor`; test pure functions in `post-processor` (`buildDrawTextFilters`, `groupFramesByAnnotation`); mock Anthropic SDK for `annotator`. Target >= 80% coverage.

14. **[IMMEDIATE] Commit all source files** — `git add src/ bin/ test/ package.json tsconfig.json vitest.config.ts .gitignore README.md demo-recorder.yaml examples/` and commit. The source has never been committed in 6 review cycles.

---

## Code Quality Notes

Unchanged from review-005. TypeScript quality remains high where code exists: strict mode, zero `any`, Zod-inferred types, consistent async error propagation, correct escape implementations, clean `groupFramesByAnnotation` optimization.

The quality ceiling for this review is held down entirely by missing features (MCP server, ad-hoc mode, retry logic) and the fundamental issue that the entire source tree has never been committed to git.

---

## Test Coverage

- Covered: `buildTape` (5 tests), `ConfigSchema` (6 tests) — 11 tests total, all pass
- Not covered: `loadConfig`, `findScenario`, `runVhs`, `extractFrames`, `annotateFrames`, `postProcess`, `record` orchestrator, all CLI command handlers
- Coverage tooling broken: `@vitest/coverage-v8` not installed; `npm run test:coverage` fails immediately
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

Verdict: BLOCK — 1 CRITICAL issue (MCP server advertised but absent), 5 HIGH issues, and 4 consecutive stagnation cycles with no work agent activity. Source code has never been committed to git. Work agent must act immediately.
