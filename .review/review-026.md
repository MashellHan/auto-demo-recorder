# Review 026 — 2026-04-11 06:40 UTC+8

## Status: BRAINSTORM

## Score: 98/100

## Summary

Three features implemented since review-025: (1) shared adhoc config builder extracted to `src/config/adhoc.ts`, eliminating code duplication between CLI and MCP, (2) auto-regression detection added to the `record()` pipeline, and (3) `Report` type unified by importing from `regression.ts`. All three MEDIUM issues from review-025 are resolved. 82 tests across 12 files, 89.93% statement coverage, all passing.

## Delta from Review 025
- **Fixed MEDIUM #1**: Extracted `src/config/adhoc.ts` with `buildAdhocConfig()` and `buildAdhocScenario()`. CLI `handleAdhocRecord` and MCP `handleAdhocMcp` now use shared builder. ~85 lines of duplication eliminated.
- **Fixed MEDIUM #2**: `Report` type in `src/index.ts` now imported from `src/pipeline/regression.ts`. Single source of truth for report schema.
- **New feature**: Auto-regression in `record()` pipeline — `checkPreviousReport()` compares with previous recording via `latest` symlink. Returns `regression` field on `RecordResult`.
- **New test file**: `test/adhoc.test.ts` — 7 tests for adhoc config builder
- **New tests**: 2 auto-regression tests added to `test/index.test.ts`
- **Score change**: 97 → 98 (+1)

## What's Working
- Full pipeline: config → tape → VHS → frames → AI annotation → overlay → report
- CLI: 7 commands (record, list, validate, last, init, serve, diff)
- MCP server: `demo_recorder_record` tool with config-based and adhoc modes
- GIF output: `--format gif` skips overlay, annotations in report only
- Quiet mode: `--quiet` flag, injectable Logger for library consumers
- Language-aware annotations
- Regression detection: `demo-recorder diff` CLI + auto-regression in `record()` pipeline
- Shared adhoc config builder: single source of truth for defaults
- Unified Report type across regression.ts and index.ts
- npm publish setup: `files`, `prepublishOnly`
- 82 tests across 12 files, 89.93% statement coverage

## Issues Found

### CRITICAL
- None

### HIGH
- None

### MEDIUM
- None

### LOW
1. **`config.annotation` mutated in CLI** — `src/cli.ts:47-51` mutates the parsed config object. Functionally fine but violates immutability principles. (Carried since review-022)
2. **`loadReport` has no schema validation** — `src/pipeline/regression.ts:43-46` does `JSON.parse() as Report` with no runtime validation. (Carried since review-025)
3. **`diff` command doesn't respect `--quiet`** — Inconsistent with quiet pattern. (Carried since review-025)
4. **`bin/demo-recorder.ts` at 0% coverage** — 5-line entry point, acceptable.
5. **Dynamic import of `realpath`** — `src/index.ts:226` uses `await import('node:fs/promises')` for `realpath` despite it already being importable at top level. Works but unnecessary.

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

## Code Quality Notes
- Shared adhoc builder eliminates a class of bugs where CLI and MCP defaults diverge
- Auto-regression uses existing `compareReports()` — no new logic needed, clean composition
- `checkPreviousReport()` wrapped in try/catch to never fail the recording pipeline
- `regression` field is optional on `RecordResult` — backward compatible
- Test-to-source ratio: 0.89:1 (1,872 test / 2,111 source including new adhoc.ts)
- All functions under 50-line guideline
- No hardcoded secrets, proper ANTHROPIC_API_KEY validation

## Test Coverage

```
All files        89.93% stmts | 83.01% branch | 92% funcs | 89.93% lines
12 test files, 82 tests, all passing

Highlights:
- adhoc.ts: 100% across all metrics
- regression.ts: 100% stmts, 100% funcs
- schema.ts: 100% across all metrics
- index.ts: 96.93%
- post-processor.ts: 98.41%

Gaps:
- cli.ts: 70.96% (diff error path, last/init error paths)
- mcp/server.ts: 83.43% (multi-result path, error handling)
- annotator.ts: 93.84% (retry logic paths)
```

## Brainstorm: Updated Priority

1. ~~Language-aware annotations~~ — **DONE**
2. ~~GIF output~~ — **DONE**
3. ~~Quiet/verbose mode~~ — **DONE**
4. ~~Regression detection (Phase 3.2)~~ — **DONE**
5. ~~Auto-regression in `record`~~ — **DONE**
6. ~~Extract shared adhoc builder~~ — **DONE**
7. **Improved annotation overlay (Phase 3.3)** — MEDIUM effort. Fade effects, status indicator, red border for bug frames. Last remaining Phase 3 item.
8. **CI/CD recording GitHub Action** — HIGH effort, HIGH value. Auto-record demos on PR, post as comment.
9. **`demo-recorder init --from-existing`** — LOW effort. Scan project to generate config.
10. **Watch mode** — `demo-recorder watch` monitors source files and auto-records on change.
