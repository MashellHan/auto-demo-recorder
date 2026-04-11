# Review 045 — 2026-04-11 08:50 UTC+8

## Status: BRAINSTORM

## Score: 99/100

## Summary

Full scan confirming state after commit `3331955` (annotator function extraction). The refactor cleanly split `annotateFrames()` (112 lines) into 6 functions all under 50 lines: `annotateFrames` (35), `processFrame` (40), `buildFramePrompt` (30), `parseFrameResponse` (31), `buildSummary` (15), `retryWithBackoff` (18). All 120 tests pass, `tsc --noEmit` clean, 97.01% statement coverage. No issues introduced by the refactor.

## Delta from Review 044
- No new commits since review-044.
- Full scan confirms: annotator refactor is behavior-preserving, all existing tests continue to pass with identical coverage numbers.

## What's Working
- Full pipeline: config → tape → VHS → frames → AI annotation → overlay → report
- CLI: 7 commands (record, list, validate, last, init, diff, serve)
- `init --from-existing`: auto-detect project type (Node/Rust/Go/Python/Make)
- Drawtext fallback: gracefully degrades when ffmpeg lacks freetype
- MCP server: `demo_recorder_record` tool with config-based and adhoc modes, parallel multi-scenario recording
- GIF output, quiet mode, language-aware annotations
- Regression detection: `demo-recorder diff` CLI + auto-regression in `record()` pipeline
- All safety features: immutable config, symlink parallel safety, report validation
- Phase 3.3 overlay: status dots, red bug border, fade transitions
- npm publish setup
- 120 tests across 13 files, 97.01% statement coverage
- All functions under 50 lines (no exceptions)

## Issues Found

### CRITICAL
- None

### HIGH
- None

### MEDIUM
- None

### LOW
1. **`bin/demo-recorder.ts` at 0% coverage** — 5-line entry point, acceptable.
2. **`cli.ts` uncovered lines 144-146, 258-260** — error catch/process.exit paths. Minor.
3. **`server.ts` function coverage 50%** — v8 tooling artifact; 99.42% statement coverage.
4. **`annotator.ts` uncovered lines 200-204, 206-207** — retry backoff inner branch and `throw new Error('Unreachable')`. These are defensive code paths that don't fire under mocked tests.

## Design Doc Compliance

| Phase 3 Feature | Status |
|---|---|
| 3.1 Multi-scenario recording | **DONE** |
| 3.2 Regression detection | **DONE** |
| 3.3 Improved annotation overlay | **DONE** |
| 3.4 Unit + integration tests | **DONE** (97.01% coverage) |
| 3.5 README + example configs | **DONE** |
| 3.6 npm publish setup | **DONE** |

**Phase 3 is 6/6 complete.**

## Action Items for Work Agent

### Priority 1: Beyond design doc

1. **Programmatic API documentation** — LOW effort. Add JSDoc to exported types and functions in `index.ts`. Exports needing docs: `record()`, `updateLatestSymlink()`, `RecordOptions`, `RecordResult`, `loadConfig()`, `findScenario()`, `ConfigSchema`, `detectRegressions()`, `compareReports()`, `loadReport()`. Also add JSDoc to `FrameAnalysis`, `AnnotationResult`, `Logger` in `annotator.ts` since they're re-exported.

2. **Watch mode** — MEDIUM effort. Add `demo-recorder watch` that monitors source files and auto-records on change. Requirements: debounce (500ms), configurable include/exclude patterns, graceful re-record. Use `node:fs/promises` `watch()` (Node 18.11+) or `chokidar`.

3. **CI/CD recording GitHub Action** — HIGH effort, HIGH value. Create `.github/workflows/demo-record.yml` with VHS + ffmpeg setup, recording on PR, artifact upload, PR comment with annotated preview link.

## Code Quality Notes
- Source: 2,471 lines across 14 files (avg 176 lines/file)
- Tests: 2,713 lines across 13 test files (ratio 1.10:1)
- All source files under 310 lines (max: `cli.ts` at 306, `index.ts` at 275)
- All functions under 50 lines — zero exceptions
- Clean module boundaries: config (4 files), pipeline (5 files), MCP (1 file), CLI (1 file), core (1 file), bin (1 file)
- Zod schema validation at config boundary
- Logger injection pattern throughout pipeline
- Immutable config patterns (spread operators)
- No hardcoded secrets, no console.log in production code
- Proper MCP stdio transport isolation

## Test Coverage

```
All files        97.01% stmts | 87.15% branch | 94.11% funcs | 97.01% lines
13 test files, 120 tests, all passing

Per-module:
- adhoc.ts:         100%   / 100%   / 100%   / 100%
- loader.ts:        100%   / 87.5%  / 100%   / 100%
- regression.ts:    100%   / 93.47% / 100%   / 100%
- scanner.ts:       100%   / 89.79% / 100%   / 100%
- schema.ts:        100%   / 100%   / 100%   / 100%
- server.ts:        99.42% / 83.33% / 50%    / 99.42%
- post-processor.ts:97.77% / 88.63% / 100%   / 97.77%
- index.ts:         96.95% / 93.44% / 91.66% / 96.95%
- frame-extractor:  96.29% / 80%    / 100%   / 96.29%
- tape-builder.ts:  95.77% / 86.95% / 100%   / 95.77%
- annotator.ts:     94.83% / 72.22% / 87.5%  / 94.83%
- cli.ts:           94.44% / 82.45% / 100%   / 94.44%
- vhs-runner.ts:    90%    / 80%    / 100%   / 90%
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
14. ~~`demo-recorder init --from-existing`~~ — **DONE**
15. ~~Update README for `init --from-existing`~~ — **DONE**
16. ~~CLI test coverage~~ — **DONE** (73% → 94%)
17. ~~MCP server `handleAdhocMcp` test~~ — **DONE** (91.90% → 99.42%)
18. ~~Annotator function extraction~~ — **DONE** (112 → 6 functions, all <50 lines)
19. **Programmatic API documentation** — LOW effort. JSDoc on all exports.
20. **Watch mode** — MEDIUM effort. `demo-recorder watch`.
21. **CI/CD recording GitHub Action** — HIGH effort, HIGH value.
