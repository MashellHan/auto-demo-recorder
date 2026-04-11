# Review 044 — 2026-04-11 08:48 UTC+8

## Status: BRAINSTORM

## Score: 99/100

## Summary

Implemented brainstorm item #21: annotator function extraction. Refactored `annotateFrames()` from 112 lines into 6 focused functions, all under 50 lines. Extracted `processFrame()` (40 lines), `buildFramePrompt()` (30 lines), and `parseFrameResponse()` (31 lines). The main `annotateFrames()` is now 35 lines. All 120 tests pass, `tsc --noEmit` clean, 97.01% statement coverage.

## Delta from Review 043
- **Modified**: `src/pipeline/annotator.ts` — refactored `annotateFrames()` (112 lines) into:
  - `annotateFrames()` (35 lines) — orchestration loop
  - `processFrame()` (40 lines) — single frame: read + prompt + API call + parse
  - `buildFramePrompt()` (30 lines) — prompt template construction
  - `parseFrameResponse()` (31 lines) — JSON parse with fallback
  - Existing: `buildSummary()` (15 lines), `retryWithBackoff()` (18 lines)
- File grew 181 → 207 lines (function signatures + separation)
- All 6 functions under 50 lines
- Coverage improved slightly: annotator 93.84% → 94.83% stmts, 68.75% → 72.22% branch, 80% → 87.5% funcs

## What's Working
- Full pipeline: config → tape → VHS → frames → AI annotation → overlay → report
- CLI: 7 commands (record, list, validate, last, init, diff, serve)
- `init --from-existing`: auto-detect project type and generate config
- Drawtext fallback: gracefully degrades when ffmpeg lacks freetype
- MCP server: `demo_recorder_record` tool with config-based and adhoc modes, parallel multi-scenario recording
- GIF output, quiet mode, language-aware annotations
- Regression detection: `demo-recorder diff` CLI + auto-regression in `record()` pipeline
- All safety features: immutable config, symlink parallel safety, report validation
- Phase 3.3 overlay: status dots, red bug border, fade transitions
- npm publish setup
- 120 tests across 13 files, 97.01% statement coverage
- **All functions under 50 lines** (previously one exception: annotateFrames at 112)

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
4. **`annotator.ts` remaining uncovered lines 200-204, 206-207** — retry backoff paths (unreachable in mocked tests). The `retryWithBackoff` retry branch and `throw new Error('Unreachable')` line.

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

1. **Programmatic API documentation** — LOW effort. Add JSDoc to exported types and functions in `index.ts`.

2. **Watch mode** — MEDIUM effort. `demo-recorder watch` with fs.watch + debounce.

3. **CI/CD recording GitHub Action** — HIGH effort, HIGH value.

## Code Quality Notes
- Source: 2,470 lines across 14 files (avg 176 lines/file)
- Tests: 2,713 lines across 13 test files (ratio 1.10:1)
- All source files under 310 lines
- **All functions under 50 lines** — no exceptions remaining
- Clean module boundaries: config (4), pipeline (5), MCP (1), CLI (1), core (1), bin (1)
- Zod schema validation at config boundary
- Logger injection threaded from CLI → record() → annotator
- No hardcoded secrets, no console.log in production code

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
18. ~~Annotator function extraction~~ — **DONE** (112 lines → 6 functions, all <50)
19. **Programmatic API documentation** — LOW effort. JSDoc on exports in `index.ts`.
20. **Watch mode** — MEDIUM effort. `demo-recorder watch` with fs.watch + debounce.
21. **CI/CD recording GitHub Action** — HIGH effort, HIGH value.
