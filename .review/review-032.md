# Review 032 — 2026-04-11 07:17 UTC+8

## Status: BRAINSTORM

## Score: 99/100

## Summary

Reviewing commit `ee6a058` which fixed the two carried LOWs from review-025: (1) `loadReport()` now validates `project`, `scenario`, `frames` fields after JSON.parse, and (2) `diff` command accepts `--quiet` flag. 4 new tests added (88→92). Coverage 90.70%. `tsc --noEmit` clean. Review-031 was inaccurately written before these fixes landed in the same commit — this review corrects the record.

## Delta from Review 031
- **Fixed LOW #1**: `src/pipeline/regression.ts:43-50` — `loadReport()` validates required fields (`project` string, `scenario` string, `frames` array) before returning. Throws descriptive error with file path.
- **Fixed LOW #2**: `src/cli.ts:205` — `diff` command now accepts `-q, --quiet` option. When set, all `console.log` output is suppressed; only exit code signals regression status.
- **3 new tests** in `test/regression.test.ts`: valid report load, missing project rejection, missing frames rejection
- **1 new test** in `test/cli.test.ts`: `diff --quiet` suppresses console output
- **Test count**: 88 → 92 (+4)
- **Coverage**: 90.64% → 90.70% (+0.06%)
- **Score**: 99 → 99 (unchanged — fixes were minor scope)

## What's Working
- Full pipeline: config → tape → VHS → frames → AI annotation → overlay → report
- CLI: 7 commands (record, list, validate, last, init, diff, serve)
- MCP server: `demo_recorder_record` tool with config-based and adhoc modes
- GIF output: `--format gif` skips overlay, annotations in report only
- Quiet mode: `--quiet` flag on `record` and `diff` commands, injectable Logger
- Language-aware annotations
- Regression detection: `demo-recorder diff` CLI + auto-regression in `record()` pipeline
- Shared adhoc config builder
- Immutable config handling in CLI
- Report validation in `loadReport()`
- **Phase 3.3 overlay**: status dots (green/yellow/red), red bug border, fade transitions
- npm publish setup (`files`, `prepublishOnly`, `types`, `main`, `bin`)
- README documents all features
- 92 tests across 12 files, 90.70% statement coverage

## Issues Found

### CRITICAL
- None

### HIGH
- None

### MEDIUM
- None

### LOW
1. **MCP server mutates config directly** — `src/mcp/server.ts:114-119` sets `config.annotation.enabled = false` and `config.recording.format = 'gif'` on the loaded config object. CLI was fixed to use immutable spread in `94bb940`, but server still mutates. Low risk since each request loads a fresh config, but inconsistent with project conventions.
2. **`bin/demo-recorder.ts` at 0% coverage** — 5-line entry point, acceptable.

## Design Doc Compliance

| Phase 3 Feature | Status |
|---|---|
| 3.1 Multi-scenario recording | **DONE** |
| 3.2 Regression detection | **DONE** |
| 3.3 Improved annotation overlay | **DONE** |
| 3.4 Unit + integration tests | **DONE** (90.70% coverage) |
| 3.5 README + example configs | **DONE** |
| 3.6 npm publish setup | **DONE** |

**Phase 3 is 6/6 complete.** All design doc phases implemented.

## Action Items for Work Agent

### Priority 1: Quick wins
1. Fix MCP server config mutation — use spread pattern like CLI does.
2. **Parallel scenario recording** — LOW effort. In `cli.ts` and `server.ts`, when recording all scenarios, use `Promise.all` for independent scenarios instead of sequential `for` loop.

### Priority 2: Beyond design doc
3. **CI/CD recording GitHub Action** — HIGH effort, HIGH value.
4. **Watch mode** — MEDIUM effort. `demo-recorder watch`.
5. **`demo-recorder init --from-existing`** — LOW effort.

## Code Quality Notes
- Source: 1,629 lines across 13 files (avg 125 lines/file)
- Tests: 2,081 lines across 12 test files (ratio 1.28:1)
- All functions under 50 lines
- All modules under 300 lines
- `loadReport` now validates at the parsing boundary — consistent with Zod usage elsewhere
- `diff --quiet` follows same pattern as `record --quiet`
- MCP server is the last holdout for config mutation

## Test Coverage

```
All files        90.70% stmts | 83.80% branch | 92.59% funcs | 90.70% lines
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
- server.ts: 83.43% / 70.58% / 50% / 83.43%
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
9. ~~Fix remaining LOWs~~ — **DONE** (loadReport validation + diff --quiet)
10. **Fix MCP server config mutation** — LOW effort. Consistency fix.
11. **Parallel scenario recording** — LOW effort. Use `Promise.all`.
12. **CI/CD recording GitHub Action** — HIGH effort, HIGH value.
13. **Watch mode** — MEDIUM effort. `demo-recorder watch`.
14. **`demo-recorder init --from-existing`** — LOW effort.
