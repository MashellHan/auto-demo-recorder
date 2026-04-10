# Review 036 — 2026-04-11 07:50 UTC+8

## Status: BRAINSTORM

## Score: 99/100

## Summary

Fixed the MEDIUM bug from review-035: MCP server parallel-mode symlink now extracts timestamp from the first result's `reportPath` using `basename(dirname(dirname(...)))` instead of generating a mismatched ISO-format string. Test updated to verify the exact timestamp argument. All 95 tests pass, `tsc --noEmit` clean, 91.83% statement coverage.

## Delta from Review 035
- **Fixed MEDIUM #1 (broken symlink in parallel mode)**: `src/mcp/server.ts:144` replaced `new Date().toISOString().replace(...)` with `basename(dirname(dirname(results[0].reportPath)))` to extract the actual timestamp directory created by `record()`. Added `dirname, basename` imports.
- **Test updated**: `test/mcp-server.test.ts` parallel test now verifies `updateLatestSymlink` is called with the exact timestamp `'2026-04-11_07-30'` matching the mock result path. Mock `reportPath` changed to realistic path format.
- **server.ts**: 216 lines (unchanged count, changed content)
- **Score**: 98 → 99 (MEDIUM resolved)

## What's Working
- Full pipeline: config → tape → VHS → frames → AI annotation → overlay → report
- CLI: 7 commands (record, list, validate, last, init, diff, serve)
- MCP server: `demo_recorder_record` tool with config-based and adhoc modes, **correct** parallel multi-scenario recording
- GIF output: `--format gif` skips overlay, annotations in report only
- Quiet mode: `--quiet` flag on `record` and `diff` commands, injectable Logger
- Language-aware annotations
- Regression detection: `demo-recorder diff` CLI + auto-regression in `record()` pipeline
- Report validation in `loadReport()` with field checks
- Shared adhoc config builder
- Immutable config handling in both CLI and MCP server
- `skipSymlinkUpdate` option + correct timestamp extraction for parallel safety
- Phase 3.3 overlay: status dots (green/yellow/red), red bug border, fade transitions
- npm publish setup (`files`, `prepublishOnly`, `types`, `main`, `bin`)
- README documents all features
- 95 tests across 12 files, 91.83% statement coverage

## Issues Found

### CRITICAL
- None

### HIGH
- None

### MEDIUM
- None

### LOW
1. **`bin/demo-recorder.ts` at 0% coverage** — 5-line entry point, acceptable.

## Design Doc Compliance

| Phase 3 Feature | Status |
|---|---|
| 3.1 Multi-scenario recording | **DONE** |
| 3.2 Regression detection | **DONE** |
| 3.3 Improved annotation overlay | **DONE** |
| 3.4 Unit + integration tests | **DONE** (91.83% coverage) |
| 3.5 README + example configs | **DONE** |
| 3.6 npm publish setup | **DONE** |

**Phase 3 is 6/6 complete.** All design doc phases implemented.

## Action Items for Work Agent

### Priority 1: Beyond design doc
1. **CI/CD recording GitHub Action** — HIGH effort, HIGH value. Create `.github/workflows/demo-record.yml` that runs on PR, records demos, and posts annotated preview as PR comment.
2. **Watch mode** — MEDIUM effort. `demo-recorder watch` monitors source files and auto-records on change.
3. **`demo-recorder init --from-existing`** — LOW effort. Scan project for binaries/scripts and auto-generate config.

## Code Quality Notes
- Source: 1,649 lines across 13 files (avg 127 lines/file)
- Tests: 2,135 lines across 12 test files (ratio 1.29:1)
- All functions under 50 lines
- All modules under 300 lines
- Clean module boundaries: config, pipeline, MCP, CLI all separated
- Parallel symlink now uses actual timestamp from result path — no format mismatch possible
- Zod schema validation at config boundary, field validation at report boundary
- Logger injection threaded from CLI → record() → annotator
- MCP server correctly uses stderr for logging (stdio transport)
- No hardcoded secrets, no console.log in production code (except CLI output)

## Test Coverage

```
All files        91.83% stmts | 84.42% branch | 92.59% funcs | 91.83% lines
12 test files, 95 tests, all passing

Per-module:
- adhoc.ts: 100% / 100% / 100% / 100%
- regression.ts: 100% / 91.11% / 100% / 100%
- schema.ts: 100% / 100% / 100% / 100%
- loader.ts: 100% / 87.5% / 100% / 100%
- post-processor.ts: 99.11% / 94.59% / 100% / 99.11%
- index.ts: 96.95% / 93.44% / 91.66% / 96.95%
- tape-builder.ts: 95.77% / 86.95% / 100% / 95.77%
- frame-extractor.ts: 96.29% / 80% / 100% / 96.29%
- annotator.ts: 93.84% / 68.75% / 80% / 93.84%
- server.ts: 91.90% / 80.95% / 50% / 91.90%
- vhs-runner.ts: 90% / 80% / 100% / 90%
- cli.ts: 73.33% / 65.90% / 100% / 73.33%
```

## Brainstorm: Updated Priority

1. ~~Language-aware annotations~~ — **DONE**
2. ~~GIF output~~ — **DONE**
3. ~~Quiet/verbose mode~~ — **DONE**
4. ~~Regression detection (Phase 3.2)~~ — **DONE**
5. ~~Auto-regression in `record`~~ — **DONE**
6. ~~Extract shared adhoc builder~~ — **DONE**
7. ~~Immutable config + README docs~~ — **DONE**
8. ~~Improved annotation overlay (Phase 3.3)~~ — **DONE**
9. ~~Fix remaining LOWs~~ — **DONE**
10. ~~MCP server immutable config~~ — **DONE**
11. ~~Parallel scenario recording~~ — **DONE**
12. ~~Extract symlink update for parallel safety~~ — **DONE**
13. ~~Fix parallel symlink timestamp mismatch~~ — **DONE**
14. **CI/CD recording GitHub Action** — HIGH effort, HIGH value.
15. **Watch mode** — MEDIUM effort. `demo-recorder watch`.
16. **`demo-recorder init --from-existing`** — LOW effort.
