# Review 029 — 2026-04-11 06:51 UTC+8

## Status: BRAINSTORM

## Score: 99/100

## Summary

Independent audit confirming review-028 changes. All three fixes verified: `realpath` is top-level imported, config uses immutable spread pattern, README is comprehensive at 126 lines. Codebase is 1,552 production lines + 1,872 test lines (82 tests, 90.23% statement coverage). No new issues. Three carried LOW issues remain. Phase 3 is 5/6 complete.

## Delta from Review 028
- Independent audit — no new commits since review-028 (commit `94bb940`)
- Verified `realpath` import at `src/index.ts:1` — clean, no dynamic import
- Verified immutable config at `src/cli.ts:46-56` — spread with conditional overrides, no mutation
- Verified README at 126 lines — covers API key, all 7 commands, GIF, regression, MCP setup
- Re-ran tests: 82 pass, 90.23% coverage, `tsc --noEmit` clean

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
The design doc (section 7.2) specifies three overlay improvements, all in `src/pipeline/post-processor.ts`:

1. **Status dot indicator** — Add `drawtext` with colored dot character (green/yellow/red circle: `\u25cf`) in top-right corner based on frame status (`ok`/`warning`/`error`). Use `fontcolor` conditional on status. For each frame group, emit a separate filter with the appropriate color.

2. **Red border for bug frames** — When frame `status === 'error'` or `bugs_detected.length > 0`, add `drawbox=x=0:y=0:w=iw:h=ih:color=red@0.5:t=4` with `enable='between(t,start,end)'` scoped to those frames.

3. **Fade transitions** — On annotation text, add alpha fade-in over 0.3s at segment start and fade-out over 0.3s at segment end. Use `alpha='if(lt(t-{start},0.3),(t-{start})/0.3,if(lt({end}-t,0.3),({end}-t)/0.3,1))'` in the drawtext filter.

These are purely additive changes to `buildDrawTextFilters()` and require adding a new `buildStatusDotFilters()` and `buildBugBorderFilters()` function. Tests in `test/post-processor.test.ts` should cover the new filter output.

### Priority 2: Remaining LOWs
4. Add basic field check in `loadReport()` — verify `project`, `scenario`, and `frames` fields exist after parse.
5. Add `--quiet` support to `diff` command.

## Code Quality Notes
- Test-to-source ratio: 1.21:1 (1,872 test / 1,552 source) — excellent
- All modules under 300 lines, most under 200
- post-processor.ts is 100 lines — room for Phase 3.3 additions while staying under 200
- Clean functional decomposition in post-processor: `postProcess` -> `buildBarFilter` + `buildDrawTextFilters` + `groupFramesByAnnotation` + `escapeFfmpegText` + `runFfmpeg`
- No hardcoded secrets, conventional commits throughout

## Test Coverage

```
All files        90.23% stmts | 82.44% branch | 92% funcs | 90.23% lines
12 test files, 82 tests, all passing

Top gaps:
- cli.ts: 72.97% stmts (diff error paths, last/init error paths)
- server.ts: 83.43% stmts (multi-result response, error handler)
- annotator.ts: 93.84% stmts (retry backoff edge cases)
```

## Brainstorm: Updated Priority

1. ~~Language-aware annotations~~ — **DONE**
2. ~~GIF output~~ — **DONE**
3. ~~Quiet/verbose mode~~ — **DONE**
4. ~~Regression detection (Phase 3.2)~~ — **DONE**
5. ~~Auto-regression in `record`~~ — **DONE**
6. ~~Extract shared adhoc builder~~ — **DONE**
7. ~~Immutable config + README docs~~ — **DONE**
8. **Improved annotation overlay (Phase 3.3)** — MEDIUM effort. Last Phase 3 item. Status dots, red border, fade transitions. Detailed implementation spec above.
9. **CI/CD recording GitHub Action** — HIGH effort, HIGH value.
10. **Watch mode** — MEDIUM effort. `demo-recorder watch`.
11. **`demo-recorder init --from-existing`** — LOW effort.
