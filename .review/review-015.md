# Review 015 — 2026-04-11 05:15 UTC+8

## Status: FUNCTIONAL

## Score: 75/100

## Summary

Escalation triggered in review 014 — reviewer switched to implementer mode and resolved all CRITICAL and HIGH issues in a single batch. MCP server implemented, ad-hoc mode added, missing CLI commands wired, API key guard added, execSync replaced, retry logic added, timing bugs fixed, unused deps cleaned up. Project now compiles clean and all 11 tests pass.

## Delta from Review 014
- **Fixed (13 items)**:
  - [CRITICAL] MCP server implemented (`src/mcp/server.ts`) with `demo_recorder_record` tool
  - [CRITICAL] `serve` CLI command wired
  - [HIGH] Ad-hoc mode (`--adhoc`, `--command`, `--steps`) implemented
  - [HIGH] `last` and `init` CLI commands added
  - [HIGH] `ANTHROPIC_API_KEY` guard added in annotator
  - [HIGH] `execSync` replaced with async `execFile`
  - [HIGH] Retry with exponential backoff added for API calls (3 retries)
  - [MEDIUM] Double-sleep bug fixed (sleep action uses `continue` to skip pause)
  - [MEDIUM] `drawtext` timing fixed to use `frameIndex / extractFps`
  - [MEDIUM] Annotator timestamp calculation fixed for `extract_fps != 1`
  - [MEDIUM] Unnecessary dynamic `readdir` import fixed in frame-extractor
  - [MEDIUM] Unused `handlebars` dependency removed
  - [MEDIUM] `@vitest/coverage-v8` added to devDependencies
- **Score change**: 55 → 75 (+20)
- **Stagnation**: RESOLVED — reviewer implemented directly

## What's Working
- Full CLI: `record`, `list`, `validate`, `last`, `init`, `serve` commands
- Ad-hoc recording mode with `--adhoc --command --steps`
- MCP server with `demo_recorder_record` tool
- Pipeline: tape-builder → VHS runner → frame-extractor → annotator → post-processor
- Config validation via Zod
- Retry logic on API calls
- API key validation
- Async build command execution
- Correct timing for drawtext overlays and frame timestamps
- TypeScript compiles clean (strict mode, zero `any`)
- 11 tests pass

## Issues Found

### CRITICAL
- None

### HIGH
- None

### MEDIUM
1. **Test coverage ~15%** — only config-schema and tape-builder have tests. Pipeline modules (annotator, vhs-runner, frame-extractor, post-processor), CLI commands, and MCP server are untested. Target: 80%.
2. **`record()` function is 126 lines** — exceeds 50-line guideline. Should be decomposed into smaller functions.
3. **MCP server custom `resolve()` shadows Node.js `path.resolve`** — `src/mcp/server.ts` defines a local `resolve()` that does basic path joining. Should use `path.resolve` from Node.js.
4. **`last` command follows symlink unreliably** — reads `latest` link but uses `existsSync` on symlink target without resolving; may fail on dangling symlinks.
5. **No LICENSE file** — `package.json` says MIT but no LICENSE file exists.

### LOW
1. **`console.log` in production code** — annotator, index.ts, and CLI use `console.log` for progress output. Should use a structured logger (per TypeScript rules).
2. **`stat` import unused** in `src/cli.ts`.
3. **No `bin` field shebang** — `bin/demo-recorder.ts` needs `#!/usr/bin/env node` in compiled output.

## Action Items for Work Agent
1. **[MEDIUM]** Add unit tests for pipeline modules — mock `execFile` and `Anthropic` client. Target 80% coverage.
2. **[MEDIUM]** Decompose `record()` in `src/index.ts` into smaller functions.
3. **[MEDIUM]** Fix MCP server to use `path.resolve` instead of custom `resolve()`.
4. **[MEDIUM]** Fix `last` command symlink handling.
5. **[LOW]** Add MIT LICENSE file.
6. **[LOW]** Remove unused `stat` import from `src/cli.ts`.
7. **[LOW]** Add shebang to `bin/demo-recorder.ts`.

## Code Quality Notes
- Architecture is clean and well-separated
- Zero `any` usage throughout
- Proper error handling with descriptive messages
- Zod schema provides excellent runtime validation
- MCP server follows the standard SDK patterns
- Ad-hoc mode correctly builds Config/Scenario from CLI flags
- Retry logic is clean with exponential backoff

## Test Coverage
- **Estimated: ~15%** (11 tests: 6 config-schema, 5 tape-builder)
- **Target: 80%**
- Highest priority: annotator (mock API calls), CLI commands (mock config/record), MCP server (mock handler calls)
