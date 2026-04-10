# Review 025 — 2026-04-11 06:28 UTC+8

## Status: BRAINSTORM

## Score: 97/100

## Summary

Independent audit after regression detection (Phase 3.2) was added. The new module is well-designed: pure functions, clean interfaces, 100% test coverage, 12 dedicated tests. The codebase is now 1,490 production lines + 1,733 test lines across 11 test files with 73 tests and 90.06% statement coverage. Phase 3 is 5/6 complete — only Phase 3.3 (improved annotation overlay) remains. Two new MEDIUM issues discovered this review: adhoc config duplication between CLI and MCP, and Report type defined in two places (regression.ts interface vs index.ts inline object).

## Delta from Review 024
- Independent audit — no new commits since review-024
- Thorough read of all 12 source files and 11 test files
- Two new issues identified (see MEDIUM below)

## What's Working
- Full pipeline: config → tape → VHS → frames → AI annotation → overlay → report
- CLI: 7 commands (record, list, validate, last, init, serve, **diff**)
- MCP server: `demo_recorder_record` tool with config-based and adhoc modes
- GIF output: `--format gif` skips overlay, annotations in report only
- Quiet mode: `--quiet` flag, injectable Logger for library consumers
- Language-aware annotations: unit tested
- Regression detection: `demo-recorder diff <baseline> <current>` with CI exit code 1
- Regression module: 6 change types detected (new_bug, resolved_bug, status_change, feature_lost, feature_gained, quality_change)
- npm publish setup: `files`, `prepublishOnly`
- 73 tests across 11 files, 90.06% statement coverage

## Issues Found

### CRITICAL
- None

### HIGH
- None

### MEDIUM
1. **Adhoc config construction duplicated** — `src/cli.ts:280-318` (`handleAdhocRecord`) and `src/mcp/server.ts:170-222` (`handleAdhocMcp`) build nearly identical `Config` and `Scenario` objects with hardcoded defaults. If defaults change (font_size, theme, fps, model), both must be updated independently. Should extract to a shared `buildAdhocConfig()` helper.

2. **Report type defined in two places** — `src/pipeline/regression.ts:3-24` defines `Report` and `ReportFrame` interfaces. `src/index.ts:144-163` constructs the report object inline with matching shape but no shared type. If the report schema evolves, these will diverge. The `writeReport()` function should use the `Report` type from regression.ts.

### LOW
1. **`config.annotation` mutated in CLI** — `src/cli.ts:47-51` mutates the parsed config object. Functionally fine but violates immutability principles. (Carried since review-022)
2. **`loadReport` has no schema validation** — `src/pipeline/regression.ts:43-46` does `JSON.parse() as Report` with no runtime validation. Malformed report files will fail at property access, not at parse time.
3. **`diff` command doesn't respect `--quiet`** — New `diff` command always prints to console.log. Not critical since diff is typically run interactively, but inconsistent with the quiet pattern.
4. **`bin/demo-recorder.ts` at 0% coverage** — 5-line entry point, acceptable.

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

### Priority 1: Fix MEDIUM issues
1. **Extract shared adhoc config builder** — Create `src/config/adhoc.ts` with `buildAdhocConfig(opts)` and `buildAdhocScenario(command, steps)`. Use from both CLI and MCP server. Eliminates duplicated hardcoded defaults.
2. **Unify Report type** — Import `Report` type from `regression.ts` in `index.ts`. Use it as the return type of `writeReport()` to ensure schema compatibility.

### Priority 2: Quick fixes
3. Validate parsed JSON against Report shape in `loadReport()` (add Zod schema or basic field check)
4. Clone config before mutation in CLI: `const cfg = { ...config, annotation: { ...config.annotation } }`

### Priority 3: Next brainstorm feature
5. **Auto-regression in `record`** — LOW effort, builds on existing regression module. After recording, check if a previous report exists for the same scenario in the output dir. If so, auto-compare and include regression info in the RecordResult/report.json. This makes regression detection automatic without requiring manual `diff` invocations.

## Code Quality Notes
- regression.ts is excellent: pure functions, clean separation, 100% coverage
- Logger injection pattern properly threaded through 4 levels
- Pipeline modules are well-sized (all <200 lines except cli.ts at 321)
- Test-to-source ratio: 1.16:1 (1,733 test / 1,490 source)
- Zod schemas provide good config validation
- No hardcoded secrets, proper ANTHROPIC_API_KEY validation
- Conventional commit messages throughout

## Test Coverage

```
All files        90.06% stmts | 81.62% branch | 91.48% funcs | 90.06% lines
11 test files, 73 tests, all passing

Highlights:
- regression.ts: 100% stmts, 100% funcs
- schema.ts: 100% across all metrics
- index.ts: 99.35%
- post-processor.ts: 98.41%

Gaps:
- cli.ts: 74.39% (diff error path, last/init error paths)
- mcp/server.ts: 85.39% (multi-result path, error handling)
- annotator.ts: 93.84% (retry logic paths)
```

## Brainstorm: Updated Priority

1. ~~Language-aware annotations~~ — **DONE**
2. ~~GIF output~~ — **DONE**
3. ~~Quiet/verbose mode~~ — **DONE**
4. ~~Regression detection (Phase 3.2)~~ — **DONE**
5. **Auto-regression in `record`** — LOW effort. After recording, auto-compare with previous report. Builds on regression module. Good next step.
6. **Extract shared adhoc builder** — LOW effort. Eliminates code duplication between CLI and MCP.
7. **Improved annotation overlay (Phase 3.3)** — MEDIUM effort. Fade effects, status indicator, red border.
8. **CI/CD recording GitHub Action** — HIGH effort, HIGH value.
9. **`demo-recorder init --from-existing`** — LOW effort, LOW value.
