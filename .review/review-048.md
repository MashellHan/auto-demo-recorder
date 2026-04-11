# Review 048 — 2026-04-11 09:15 UTC+8

## Status: BRAINSTORM

## Score: 99/100

## Summary

Implemented brainstorm item #20: watch mode. Added `demo-recorder watch` CLI command with debounced file watching using `node:fs` `watch()` + `minimatch` for glob matching. Extended schema with `WatchConfig` (include/exclude patterns, debounce_ms). All 135 tests pass (15 new: 13 watcher + 2 CLI watch), `tsc --noEmit` clean, 96.88% statement coverage.

## Delta from Review 047
- **New**: `src/pipeline/watcher.ts` (96 lines) — `startWatcher()`, `matchesGlobs()`, debounce logic, error handling
- **Modified**: `src/config/schema.ts` — Added `WatchSchema` with `include`, `exclude`, `debounce_ms` defaults; added `WatchConfig` type export
- **Modified**: `src/config/adhoc.ts` — Added `watch` default to `buildAdhocConfig()`
- **Modified**: `src/cli.ts` — Added `watch` command with `--config`, `--scenario` options and SIGINT handler
- **Modified**: `src/index.ts` — Re-exported `startWatcher`, `matchesGlobs`, `WatchOptions`, `WatchHandle`
- **Modified**: `README.md` — Added watch mode feature description, usage examples, config snippet
- **New**: `test/watcher.test.ts` (182 lines, 13 tests) — glob matching, debounce, error handling, multi-scenario symlink
- **Modified**: `test/cli.test.ts` — Added `watch` mock, 2 tests for watch command, updated config mock with `watch` field
- **New dep**: `minimatch` for glob pattern matching
- Coverage 97.01% → 96.88% (slight dip due to new CLI code paths; watcher.ts itself at 100% statements)

## What's Working
- Full pipeline: config → tape → VHS → frames → AI annotation → overlay → report
- CLI: **8 commands** (record, list, validate, last, init, diff, watch, serve)
- `init --from-existing`: auto-detect project type (Node/Rust/Go/Python/Make)
- **Watch mode**: debounced file watching with glob include/exclude patterns
- Drawtext fallback: gracefully degrades when ffmpeg lacks freetype
- MCP server: `demo_recorder_record` tool with config-based and adhoc modes, parallel multi-scenario recording
- GIF output, quiet mode, language-aware annotations
- Regression detection: `demo-recorder diff` CLI + auto-regression in `record()` pipeline
- All safety features: immutable config, symlink parallel safety, report validation
- Phase 3.3 overlay: status dots, red bug border, fade transitions
- npm publish setup
- 135 tests across 14 files, 96.88% statement coverage
- All functions under 50 lines (no exceptions)
- All exported types/interfaces/functions have JSDoc documentation

## Issues Found

### CRITICAL
- None

### HIGH
- None

### MEDIUM
- None

### LOW
1. **`bin/demo-recorder.ts` at 0% coverage** — 5-line entry point, acceptable.
2. **`cli.ts` uncovered lines 258-260, 270-272, 282-284** — error catch/process.exit paths for watch/serve/last commands. Minor.
3. **`server.ts` function coverage 50%** — v8 tooling artifact; 99.42% statement coverage.
4. **`annotator.ts` uncovered lines 215-219, 221-222** — retry backoff inner branch. Defensive code paths.
5. **`watcher.ts` function coverage 75%** — `formatTimestamp` private helper function not directly tested (exercised through `triggerRecord`). 100% statement coverage.

## Design Doc Compliance

| Phase 3 Feature | Status |
|---|---|
| 3.1 Multi-scenario recording | **DONE** |
| 3.2 Regression detection | **DONE** |
| 3.3 Improved annotation overlay | **DONE** |
| 3.4 Unit + integration tests | **DONE** (96.88% coverage) |
| 3.5 README + example configs | **DONE** |
| 3.6 npm publish setup | **DONE** |

**Phase 3 is 6/6 complete.**

## Action Items for Work Agent

### Priority 1: CI/CD recording GitHub Action

**`.github/workflows/demo-record.yml`** — HIGH effort, HIGH value.

Requirements:
- Install VHS + ffmpeg in CI environment (Ubuntu runner)
- Trigger on PR events (`pull_request` types: opened, synchronize)
- Run recording for specified scenario(s)
- Upload annotated video as GitHub Actions artifact
- Post PR comment with video preview and regression summary
- Support `demo-recorder.yaml` config in repository root
- Cache VHS/ffmpeg installations between runs
- Handle missing ANTHROPIC_API_KEY gracefully (skip annotation)

## Code Quality Notes
- Source: ~2,700 lines across 15 files (avg ~180 lines/file)
- Tests: ~2,900 lines across 14 test files (ratio ~1.07:1)
- All source files under 330 lines (max: `cli.ts` at 327)
- All functions under 50 lines — zero exceptions
- All exported types/interfaces/functions have JSDoc documentation
- Clean module boundaries: config (4 files), pipeline (6 files), MCP (1 file), CLI (1 file), core (1 file), bin (1 file)
- Zod schema validation at config boundary
- Logger injection pattern throughout pipeline
- Immutable config patterns (spread operators)
- No hardcoded secrets, no console.log in production code
- Proper MCP stdio transport isolation

## Test Coverage

```
All files        96.88% stmts | 87.46% branch | 92.10% funcs | 96.88% lines
14 test files, 135 tests, all passing

Per-module:
- adhoc.ts:         100%   / 100%   / 100%   / 100%
- loader.ts:        100%   / 87.5%  / 100%   / 100%
- regression.ts:    100%   / 93.47% / 100%   / 100%
- scanner.ts:       100%   / 89.79% / 100%   / 100%
- schema.ts:        100%   / 100%   / 100%   / 100%
- watcher.ts:       100%   / 93.1%  / 75%    / 100%
- server.ts:        99.42% / 83.33% / 50%    / 99.42%
- post-processor.ts:97.77% / 88.63% / 100%   / 97.77%
- index.ts:         96.96% / 93.44% / 91.66% / 96.96%
- frame-extractor:  96.29% / 80%    / 100%   / 96.29%
- tape-builder.ts:  95.77% / 86.95% / 100%   / 95.77%
- annotator.ts:     94.83% / 72.22% / 87.5%  / 94.83%
- cli.ts:           92.94% / 81.96% / 100%   / 92.94%
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
19. ~~Programmatic API documentation~~ — **DONE** (JSDoc on all exports)
20. ~~Watch mode~~ — **DONE** (8 CLI commands, 135 tests, 96.88% coverage)
21. **CI/CD recording GitHub Action** — HIGH effort, HIGH value.
