# Review 033 — 2026-04-11 07:20 UTC+8

## Status: BRAINSTORM

## Score: 99/100

## Summary

Full project scan verifying commit `c3ae15c` which fixed MCP server config mutation (now immutable spread) and added parallel scenario recording via `Promise.all`. All 92 tests pass, `tsc --noEmit` clean, 91.07% statement coverage. All design doc phases complete. Two LOWs carried from review-032 are now resolved; one new LOW identified (symlink race in parallel mode). Codebase is 1,634 production lines + 2,081 test lines.

## Delta from Review 032
- **Fixed LOW #1 (MCP config mutation)**: `src/mcp/server.ts:113-124` now uses immutable spread pattern identical to CLI convention. No more direct property assignment on loaded config.
- **Parallel scenario recording**: `src/mcp/server.ts:130-134` uses `Promise.all` when recording multiple scenarios. Scenarios write to independent subdirectories so output paths don't collide.
- **Server.ts**: 198 → 203 lines (+5)
- **Coverage**: 90.70% → 91.07% (+0.37%). Server coverage rose 83.43% → 86.41% due to shorter code path from spread pattern.
- **Score**: 99 → 99 (unchanged)

## What's Working
- Full pipeline: config → tape → VHS → frames → AI annotation → overlay → report
- CLI: 7 commands (record, list, validate, last, init, diff, serve)
- MCP server: `demo_recorder_record` tool with config-based and adhoc modes, **parallel** multi-scenario recording
- GIF output: `--format gif` skips overlay, annotations in report only
- Quiet mode: `--quiet` flag on `record` and `diff` commands, injectable Logger
- Language-aware annotations
- Regression detection: `demo-recorder diff` CLI + auto-regression in `record()` pipeline
- Report validation in `loadReport()` with field checks
- Shared adhoc config builder
- Immutable config handling in **both** CLI and MCP server
- Phase 3.3 overlay: status dots (green/yellow/red), red bug border, fade transitions
- npm publish setup (`files`, `prepublishOnly`, `types`, `main`, `bin`)
- README documents all features
- 92 tests across 12 files, 91.07% statement coverage

## Issues Found

### CRITICAL
- None

### HIGH
- None

### MEDIUM
- None

### LOW
1. **Symlink race in parallel mode** — `src/index.ts:176-184` `updateLatestSymlink()` does `unlink` then `symlink`. When `Promise.all` runs multiple scenarios, concurrent calls to this function race on the symlink. The result is correct (last writer wins, all scenarios share the same timestamp dir), but the `unlink` can throw if another call already deleted it. The `catch` block swallows this, so it's not a crash — but it's technically a race condition. Consider moving symlink update out of `record()` into the caller when parallel mode is used.
2. **`bin/demo-recorder.ts` at 0% coverage** — 5-line entry point, acceptable.

## Design Doc Compliance

| Phase 3 Feature | Status |
|---|---|
| 3.1 Multi-scenario recording | **DONE** |
| 3.2 Regression detection | **DONE** |
| 3.3 Improved annotation overlay | **DONE** |
| 3.4 Unit + integration tests | **DONE** (91.07% coverage) |
| 3.5 README + example configs | **DONE** |
| 3.6 npm publish setup | **DONE** |

**Phase 3 is 6/6 complete.** All design doc phases implemented.

## Action Items for Work Agent

### Priority 1: Quick win
1. **Extract symlink update from `record()`** — Create an optional `skipSymlinkUpdate` parameter on `RecordOptions`. When MCP server uses parallel recording, pass `skipSymlinkUpdate: true` and call `updateLatestSymlink()` once after `Promise.all` resolves. This eliminates the race and is a clean API improvement. LOW effort.

### Priority 2: Beyond design doc
2. **CI/CD recording GitHub Action** — HIGH effort, HIGH value. Create `.github/workflows/demo-record.yml` that runs on PR, records demos, and posts annotated preview as PR comment.
3. **Watch mode** — MEDIUM effort. `demo-recorder watch` monitors source files and auto-records on change.
4. **`demo-recorder init --from-existing`** — LOW effort. Scan project for binaries/scripts and auto-generate config.

## Code Quality Notes
- Source: 1,634 lines across 13 files (avg 126 lines/file)
- Tests: 2,081 lines across 12 test files (ratio 1.27:1)
- All functions under 50 lines
- All modules under 300 lines
- Both CLI and MCP server now use consistent immutable spread pattern
- `Promise.all` parallelism is safe for independent scenario dirs
- Zod schema validation at config boundary, field validation at report boundary
- Logger injection threaded from CLI → record() → annotator
- MCP server correctly uses stderr for logging (stdio transport)
- No hardcoded secrets, no console.log in production code (except CLI output)

## Test Coverage

```
All files        91.07% stmts | 83.74% branch | 92.59% funcs | 91.07% lines
12 test files, 92 tests, all passing

Per-module:
- adhoc.ts: 100% / 100% / 100% / 100%
- regression.ts: 100% / 91.11% / 100% / 100%
- schema.ts: 100% / 100% / 100% / 100%
- loader.ts: 100% / 87.5% / 100% / 100%
- post-processor.ts: 99.11% / 94.59% / 100% / 99.11%
- index.ts: 96.92% / 93.33% / 91.66% / 96.92%
- tape-builder.ts: 95.77% / 86.95% / 100% / 95.77%
- annotator.ts: 93.84% / 68.75% / 80% / 93.84%
- frame-extractor.ts: 96.29% / 80% / 100% / 96.29%
- vhs-runner.ts: 90% / 80% / 100% / 90%
- server.ts: 86.41% / 68.75% / 50% / 86.41%
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
11. ~~Parallel scenario recording~~ — **DONE** (MCP server)
12. **Extract symlink update for parallel safety** — LOW effort.
13. **CI/CD recording GitHub Action** — HIGH effort, HIGH value.
14. **Watch mode** — MEDIUM effort. `demo-recorder watch`.
15. **`demo-recorder init --from-existing`** — LOW effort.
