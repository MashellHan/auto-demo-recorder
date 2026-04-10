# Review 024 — 2026-04-11 06:24 UTC+8

## Status: BRAINSTORM

## Score: 98/100

## Summary

Regression detection (Phase 3.2) implemented. New `src/pipeline/regression.ts` module (155 lines) compares two `report.json` files, detecting: status changes, new/resolved bugs, lost/gained features, and visual quality changes. CLI `diff` command added. 14 new tests (12 regression + 2 CLI). All 73 tests pass across 11 files with 90.06% coverage. Regression module at 100% coverage. Production code: 1,406 lines. Test code: 1,733 lines (1.23:1 ratio). This completes the last major Phase 3 feature from the design doc.

## Delta from Review 023
- New file: `src/pipeline/regression.ts` (155 lines) — regression detection module
- New file: `test/regression.test.ts` (12 tests) — full coverage of comparison logic
- Modified: `src/cli.ts` — added `diff` command with positional args `<baseline> <current>`
- Modified: `src/index.ts` — exports `detectRegressions`, `compareReports`, `loadReport`, types
- Modified: `test/cli.test.ts` — added 2 tests for diff command

## What's Working
- **Full pipeline**: config → tape → VHS → frames → AI annotation → overlay → report
- **CLI**: record, list, validate, last, init, serve, **diff** commands
- **MCP server**: `demo_recorder_record` tool with config-based and adhoc modes
- **GIF output**: `--format gif` skips overlay, annotations in report only
- **Quiet mode**: `--quiet` flag, injectable Logger for library consumers
- **Language-aware annotations**: unit tested
- **Regression detection**: `demo-recorder diff <baseline> <current>` — detects 6 change types
- **npm publish setup**: `files`, `prepublishOnly`
- 73 tests across 11 files, 90.06% coverage

## Regression Detection Feature Details

### Change Types Detected
| Type | Severity | Description |
|---|---|---|
| `new_bug` | critical | Bug appears that wasn't in baseline |
| `resolved_bug` | info | Bug from baseline no longer present |
| `status_change` | critical/info | Overall status worsened or improved |
| `feature_lost` | warning | Feature demonstrated in baseline but missing |
| `feature_gained` | info | New feature demonstrated |
| `quality_change` | warning/info | Visual quality degraded or improved |

### CLI Usage
```bash
demo-recorder diff path/to/baseline/report.json path/to/current/report.json
```
Exits with code 1 if regressions (critical or warning changes) found — CI-friendly.

### Programmatic Usage
```typescript
import { detectRegressions, compareReports } from 'auto-demo-recorder';
const result = await detectRegressions('baseline.json', 'current.json');
if (result.has_regressions) { /* handle */ }
```

## Issues Found

### CRITICAL
- None

### HIGH
- None

### MEDIUM
- None

### LOW
1. **`config.annotation` mutated in CLI** — `src/cli.ts:47,50` mutates parsed config. Functionally fine but violates immutability. (Carried)
2. **`bin/demo-recorder.ts` at 0% coverage** — Entry point, acceptable for a 5-line file.

## Design Doc Compliance

| Phase 3 Feature | Status |
|---|---|
| 3.1 Multi-scenario recording | **DONE** |
| 3.2 Regression detection | **DONE** |
| 3.3 Improved annotation overlay | NOT STARTED |
| 3.4 Unit + integration tests | **DONE** (90% coverage) |
| 3.5 README + example configs | **DONE** |
| 3.6 npm publish setup | **DONE** |

**Phase 3 is 5/6 complete.** Only Phase 3.3 (improved annotation overlay) remains.

## Test Coverage

```
All files        90.06% stmts | 81.62% branch | 91.48% funcs | 90.06% lines
11 test files, 73 tests, all passing

Coverage highlights:
- regression.ts: 100% stmts, 100% funcs
- index.ts: 99.35%
- schema.ts: 100%
- loader.ts: 100%
```

## Code Quality Notes
- Regression module is pure functions — no side effects, easy to test
- `compareReports` works on in-memory Report objects (unit-testable)
- `detectRegressions` handles file I/O (integration-testable)
- `diff` command exits with code 1 on regressions — CI pipeline compatible
- All exported from `src/index.ts` for library consumers
- Test-to-source ratio improved to 1.23:1

## Brainstorm: Updated Priority

1. ~~Language-aware annotations~~ — **DONE**
2. ~~GIF output~~ — **DONE**
3. ~~Quiet/verbose mode~~ — **DONE**
4. ~~Regression detection (Phase 3.2)~~ — **DONE**
5. **Improved annotation overlay (Phase 3.3)** — MEDIUM effort. Fade effects, status indicator, red border for bug frames.
6. **CI/CD recording GitHub Action** — HIGH effort, HIGH value
7. **Auto-regression in `record`** — When recording, auto-compare with previous report for same scenario. LOW effort, builds on regression module.
8. **`demo-recorder init --from-existing`** — LOW effort, LOW value
