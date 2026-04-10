# Review 022 — 2026-04-11 06:11 UTC+8

## Status: BRAINSTORM

## Score: 97/100

## Summary

Quiet mode and logger injection (Proposal 3) cleanly implemented since review 020. Logger interface threads through `record()` → pipeline → annotator. CLI `--quiet/-q` suppresses output. GIF output (Proposal 2) also complete. 58 tests pass, 89.23% coverage. Codebase is mature at 1,256 lines of production code with 1,388 lines of tests. Two new minor issues found this review.

## Delta from Review 021
- No new implementation commits since review 021.
- This is an independent audit confirming review 021 findings and catching two additional issues.

## What's Working
- Full pipeline: config → tape → VHS → frames → AI annotation → overlay → report
- CLI: record, list, validate, last, init, serve commands
- MCP server: `demo_recorder_record` tool with config-based and adhoc modes
- GIF output: `--format gif` skips overlay, annotations in report only
- Quiet mode: `--quiet` flag, injectable Logger for library consumers
- Language-aware annotations: `config.language` passed to Claude prompt
- npm publish setup: `files`, `prepublishOnly`, clean tarball
- Multi-scenario recording
- 58 tests across 10 files, 89.23% coverage

## Issues Found

### CRITICAL
- None

### HIGH
- None

### MEDIUM
1. **MCP server doesn't pass logger to `record()`** — `src/mcp/server.ts:120` and `214` call `record()` without a logger. Since MCP uses stdio transport, `console.log` from the default logger will corrupt the MCP protocol stream. MCP recordings should use a noop logger (or a stderr-only logger).

### LOW
1. **`console.log('')` leaks in quiet mode** — `src/cli.ts:60` prints an empty line between scenarios even when `--quiet` is active. Should be gated on `!opts.quiet`.
2. **`language` field not tested** — Carried over since review 019. The language prompt injection in annotator has no unit test verifying the prompt includes language instructions when `config.language !== 'en'`.
3. **`console.warn` in `retryWithBackoff`** — `src/pipeline/annotator.ts:171` still uses raw `console.warn` instead of the injected logger. Minor because retries are rare, but inconsistent with the logger pattern.
4. **`config.annotation` mutated in CLI** — `src/cli.ts:47` does `config.annotation.enabled = false` and line 50 does `config.recording.format = 'gif'`, mutating the parsed config object. Functionally fine but violates immutability principles.

## Design Doc Compliance

| Phase 3 Feature | Status |
|---|---|
| 3.1 Multi-scenario recording | **DONE** |
| 3.2 Regression detection | NOT STARTED |
| 3.3 Improved annotation overlay | NOT STARTED |
| 3.4 Unit + integration tests | **DONE** (89% coverage) |
| 3.5 README + example configs | **DONE** |
| 3.6 npm publish setup | **DONE** |

## Code Quality Notes
- Clean separation of concerns: 8 pipeline modules, each <200 lines
- Zod schemas provide runtime validation with TypeScript type inference
- Logger injection is a good pattern — properly threaded through 4 levels
- Test-to-source ratio is 1.1:1 (1,388 test lines / 1,256 source lines)
- No hardcoded secrets, proper ANTHROPIC_API_KEY validation
- Retry with exponential backoff for API calls
- All files well under 300 lines (largest: src/cli.ts at 283)
- Conventional commit messages throughout git history

## Test Coverage

```
All files        89.23% stmts | 80.95% branch | 94.59% funcs | 89.23% lines
10 test files, 58 tests, all passing

Coverage gaps:
- bin/demo-recorder.ts: 0% (entry point, acceptable)
- src/cli.ts: 75% (last, init error paths uncovered)
- src/mcp/server.ts: 85% (multi-result path, error handling uncovered)
- src/pipeline/annotator.ts: 92.85% (retry logic, defaultLogger uncovered)
```

## Action Items for Work Agent

### Priority 1: Fix MEDIUM issue
1. **MCP logger fix** — Pass a noop logger (or stderr-only logger) to all `record()` calls in `src/mcp/server.ts`. This prevents console.log from corrupting stdio MCP transport.

### Priority 2: Quick fixes
2. Gate `console.log('')` at `src/cli.ts:60` on `!opts.quiet`
3. Add language prompt unit test to `test/annotator.test.ts`
4. Pass logger through to `retryWithBackoff` for consistency

### Priority 3: Next brainstorm feature
5. **Regression detection (Phase 3.2)** — Compare consecutive report.json files for the same scenario. Detect new bugs, lost features, status changes. Output a diff report. This is the last major Phase 3 feature.

## Brainstorm: Updated Priority

1. ~~Language-aware annotations~~ — **DONE**
2. ~~GIF output~~ — **DONE**
3. ~~Quiet/verbose mode~~ — **DONE**
4. **Regression detection (Phase 3.2)** — HIGH effort, HIGH value. Last Phase 3 feature.
5. **CI/CD recording GitHub Action** — HIGH effort, HIGH value
6. **`demo-recorder init --from-existing`** — LOW effort, LOW value
7. **`demo-recorder diff` command** — Companion to regression detection. Show diff between two recordings' reports.
