# Review 028 — 2026-04-11 06:49 UTC+8

## Status: BRAINSTORM

## Score: 99/100

## Summary

Three cleanup items from review-027 action items implemented: (1) dynamic `realpath` import replaced with top-level import, (2) config mutation in CLI replaced with immutable spread pattern, (3) README expanded from 73 to 107 lines documenting API key, all 7 commands, GIF format, regression detection, and MCP setup. All 82 tests pass, coverage rose to 90.23%. Two of the five carried LOW issues are now resolved.

## Delta from Review 027
- **Fixed LOW #1 (config mutation)**: `src/cli.ts:46-55` now uses spread operator to clone config before overriding annotation/format. No mutation of parsed config.
- **Fixed LOW #5 (dynamic realpath)**: `src/index.ts:1` now imports `realpath` at top level alongside other fs/promises imports. Removed dynamic `await import()` on former line 226.
- **README enhanced**: Added ANTHROPIC_API_KEY prerequisite, `init` command, `diff` command with CI exit code note, `--format gif`, `--no-annotate`, `--quiet` flags, auto-regression description, MCP server config example. 73 → 107 lines.
- **Score change**: 98 → 99 (+1)

## What's Working
- Full pipeline: config -> tape -> VHS -> frames -> AI annotation -> overlay -> report
- CLI: 7 commands (record, list, validate, last, init, diff, serve)
- MCP server: `demo_recorder_record` tool with config-based and adhoc modes
- GIF output: `--format gif` skips overlay, annotations in report only
- Quiet mode: `--quiet` flag, injectable Logger for library consumers
- Language-aware annotations
- Regression detection: `demo-recorder diff` CLI + auto-regression in `record()` pipeline
- Shared adhoc config builder: single source of truth for defaults
- Unified Report type across regression.ts and index.ts
- Immutable config handling in CLI (spread, no mutation)
- npm publish setup: `files`, `prepublishOnly`, `types`, `main`, `bin`
- README documents all features, prerequisites, and MCP setup
- 82 tests across 12 files, 90.23% statement coverage, all passing

## Issues Found

### CRITICAL
- None

### HIGH
- None

### MEDIUM
- None

### LOW
1. **`loadReport` has no schema validation** — `src/pipeline/regression.ts:43-46` does `JSON.parse() as Report` with no runtime validation. (Carried since review-025)
2. **`diff` command doesn't respect `--quiet`** — `src/cli.ts:203-236` always writes to console.log. (Carried since review-025)
3. **`bin/demo-recorder.ts` at 0% coverage** — 5-line entry point, acceptable.

## Design Doc Compliance

| Phase 3 Feature | Status |
|---|---|
| 3.1 Multi-scenario recording | **DONE** |
| 3.2 Regression detection | **DONE** |
| 3.3 Improved annotation overlay | NOT STARTED |
| 3.4 Unit + integration tests | **DONE** (90% coverage) |
| 3.5 README + example configs | **DONE** |
| 3.6 npm publish setup | **DONE** |

Phase 3 is **5/6 complete**. Only 3.3 (fade effects, status indicator, red border for bug frames) remains.

## Action Items for Work Agent

### Priority 1: Phase 3.3 — Improved annotation overlay
1. **Status dot indicator** — Add colored dot (green/yellow/red) in top-right corner of video based on frame status. Lives in `src/pipeline/post-processor.ts` `buildDrawTextFilters()`.
2. **Red border for bug frames** — When `status === 'error'` or `bugs_detected.length > 0`, add `drawbox` with red border via ffmpeg filter.
3. **Fade transitions** — Add `alpha` fade-in/fade-out on annotation text between segments, using ffmpeg `enable` with fade expression.

### Priority 2: Remaining LOWs
4. Add basic field validation in `loadReport()` — check that required fields (`project`, `scenario`, `frames`) exist before returning.
5. Add `--quiet` flag to `diff` command for CI consistency.

## Code Quality Notes
- Config handling is now fully immutable — spread pattern in CLI
- `realpath` import is clean — no more dynamic import workaround
- README comprehensively covers all features and prerequisites
- Test-to-source ratio: 1.21:1 (1,872 test / 1,546 source)
- All modules under 300 lines, most under 200
- 90.23% statement coverage exceeds 80% target

## Test Coverage

```
All files        90.23% stmts | 82.37% branch | 92% funcs | 90.23% lines
12 test files, 82 tests, all passing

Per-module:
- adhoc.ts: 100% / 100% / 100% / 100%
- regression.ts: 100% / 90% / 100% / 100%
- schema.ts: 100% / 100% / 100% / 100%
- loader.ts: 100% / 87.5% / 100% / 100%
- post-processor.ts: 98.41% / 90% / 100% / 98.41%
- index.ts: 96.92% / 93.33% / 91.66% / 96.92%
- tape-builder.ts: 95.77% / 86.95% / 100% / 95.77%
- annotator.ts: 93.84% / 68.75% / 80% / 93.84%
- frame-extractor.ts: 96.29% / 80% / 100% / 96.29%
- vhs-runner.ts: 90% / 80% / 100% / 90%
- server.ts: 83.43% / 70.58% / 50% / 83.43%
- cli.ts: 72.97% / 65.11% / 100% / 72.97%
```

## Brainstorm: Updated Priority

1. ~~Language-aware annotations~~ — **DONE**
2. ~~GIF output~~ — **DONE**
3. ~~Quiet/verbose mode~~ — **DONE**
4. ~~Regression detection (Phase 3.2)~~ — **DONE**
5. ~~Auto-regression in `record`~~ — **DONE**
6. ~~Extract shared adhoc builder~~ — **DONE**
7. ~~Immutable config + README docs~~ — **DONE**
8. **Improved annotation overlay (Phase 3.3)** — MEDIUM effort. Last Phase 3 item. Status dots, red border, fade transitions.
9. **CI/CD recording GitHub Action** — HIGH effort, HIGH value.
10. **Watch mode** — MEDIUM effort. `demo-recorder watch`.
11. **`demo-recorder init --from-existing`** — LOW effort.
