# Review 043 — 2026-04-11 08:36 UTC+8

## Status: BRAINSTORM

## Score: 99/100

## Summary

Full project scan after commit `8efcfd0` (MCP server handleAdhocMcp tests). All 120 tests pass, `tsc --noEmit` clean, 96.96% statement coverage. Source is 2,444 lines across 14 files, tests are 2,713 lines across 13 files (ratio 1.11:1). All design doc phases complete. No CRITICAL or HIGH issues. Project is mature, well-tested, and ready for feature extensions.

## Delta from Review 042
- **Commit `8efcfd0`**: `test/mcp-server.test.ts` added 4 tests (adhoc default pause, format/annotate passthrough, command-only adhoc, error response). Server statement coverage 91.90% → 99.42%. Overall 95.99% → 96.96%.
- No source changes — purely test additions.

## What's Working
- Full pipeline: config → tape → VHS → frames → AI annotation → overlay → report
- CLI: 7 commands (record, list, validate, last, init, diff, serve)
- `init --from-existing`: auto-detect project type and generate config (Node/Rust/Go/Python/Make)
- **Drawtext fallback**: gracefully degrades when ffmpeg lacks freetype — keeps drawbox bar and bug borders, skips text overlays
- MCP server: `demo_recorder_record` tool with config-based and adhoc modes, correct parallel multi-scenario recording
- GIF output, quiet mode, language-aware annotations
- Regression detection: `demo-recorder diff` CLI + auto-regression in `record()` pipeline
- All safety features: immutable config, symlink parallel safety, report validation
- Phase 3.3 overlay: status dots, red bug border, fade transitions (when ffmpeg supports drawtext)
- npm publish setup (package.json bin + main entries)
- 120 tests across 13 files, 96.96% statement coverage

## Issues Found

### CRITICAL
- None

### HIGH
- None

### MEDIUM
- None

### LOW
1. **`bin/demo-recorder.ts` at 0% coverage** — 5-line entry point, acceptable.
2. **`cli.ts` uncovered lines 144-146, 258-260** — error catch/process.exit paths for `last` and `serve` commands. Minor edge cases.
3. **`server.ts` function coverage 50%** — v8 counts `handleAdhocMcp` as a separate function. It's fully exercised (99.42% statement coverage), so this is a tooling artifact.
4. **`annotator.ts` branch coverage 68.75%** — lowest branch coverage in the project. The uncovered branches are in retry logic and JSON parse fallback paths (lines 73-77, 173-180). Not critical but could be improved.
5. **`annotateFrames()` is ~112 lines** — exceeds the 50-line function guideline. The frame loop + API call + JSON parse + retry logic is inherently complex, but could benefit from extracting the per-frame processing into a helper.

## Design Doc Compliance

| Phase 3 Feature | Status |
|---|---|
| 3.1 Multi-scenario recording | **DONE** |
| 3.2 Regression detection | **DONE** |
| 3.3 Improved annotation overlay | **DONE** |
| 3.4 Unit + integration tests | **DONE** (96.96% coverage) |
| 3.5 README + example configs | **DONE** |
| 3.6 npm publish setup | **DONE** |

**Phase 3 is 6/6 complete.** All design doc phases implemented.

## Action Items for Work Agent

### Priority 1: Beyond design doc

1. **Programmatic API documentation** — LOW effort. Add JSDoc to exported types and functions in `index.ts` for library consumers. Current exports (`record`, `updateLatestSymlink`, `RecordOptions`, `RecordResult`) are clean but undocumented. This is the lowest-hanging fruit remaining.

2. **Watch mode** — MEDIUM effort. Add `demo-recorder watch` that uses `fs.watch` or `chokidar` to monitor source files and auto-record on change. Useful for iterative TUI development. Would need: debouncing, configurable watch patterns, and graceful re-record on file change.

3. **CI/CD recording GitHub Action** — HIGH effort, HIGH value. Create `.github/workflows/demo-record.yml` that runs on PR, records demos, uploads artifacts, and posts annotated preview as PR comment. Requires VHS + ffmpeg in CI image.

4. **Annotator function extraction** — LOW effort. Extract the per-frame processing loop body from `annotateFrames()` (112 lines) into a `processFrame()` helper to bring the main function under 50 lines.

## Code Quality Notes
- Source: 2,444 lines across 14 files (avg 175 lines/file)
- Tests: 2,713 lines across 13 test files (ratio 1.11:1)
- All source files under 310 lines (max: `src/cli.ts` at 307)
- Most functions under 50 lines; one exception: `annotateFrames()` at ~112 lines
- Clean module boundaries: config (4 files), pipeline (5 files), MCP (1 file), CLI (1 file), core (1 file), bin (1 file)
- Zod schema validation at config boundary
- Logger injection threaded from CLI → record() → annotator
- Immutable config patterns (spread operators) in CLI and MCP server
- No hardcoded secrets, no console.log in production code
- Drawtext cache: module-level boolean with null sentinel, exposed reset for testing
- Proper MCP stdio transport isolation (logger writes to stderr, not stdout)

## Test Coverage

```
All files        96.96% stmts | 87.01% branch | 93.84% funcs | 96.96% lines
13 test files, 120 tests, all passing

Per-module (sorted by statement coverage):
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
- cli.ts:           94.44% / 82.45% / 100%   / 94.44%
- annotator.ts:     93.84% / 68.75% / 80%    / 93.84%
- vhs-runner.ts:    90%    / 80%    / 100%   / 90%

Test distribution:
- cli.test.ts:        20 tests (613 lines)
- regression.test.ts: 15 tests (292 lines)
- index.test.ts:      14 tests (354 lines)
- scanner.test.ts:    14 tests (225 lines)
- mcp-server.test.ts: 10 tests (265 lines)
- config-schema.test: 9 tests  (134 lines)
- post-processor.test:9 tests  (250 lines)
- adhoc.test.ts:      7 tests  (69 lines)
- config-loader.test: 7 tests  (81 lines)
- annotator.test.ts:  5 tests  (196 lines)
- tape-builder.test:  5 tests  (138 lines)
- frame-extractor:    3 tests  (57 lines)
- vhs-runner.test:    2 tests  (51 lines)
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
18. **Programmatic API documentation** — LOW effort. JSDoc on exports in `index.ts`.
19. **Watch mode** — MEDIUM effort. `demo-recorder watch` with fs.watch + debounce.
20. **CI/CD recording GitHub Action** — HIGH effort, HIGH value.
21. **Annotator function extraction** — LOW effort. Extract per-frame loop body from `annotateFrames()`.
