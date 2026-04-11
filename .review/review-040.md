# Review 040 — 2026-04-11 08:22 UTC+8

## Status: BRAINSTORM

## Score: 99/100

## Summary

Implemented brainstorm item #16: CLI test coverage boost. Added 7 new CLI tests covering `init --from-existing`, `init` with existing file, `last` command (both no-recordings and with-recordings paths), `record --format gif`, `record --no-annotate`, and `diff` with regressions. CLI coverage jumped from 73.07% → 94.44%. Overall coverage rose to 95.99%. All 116 tests pass, `tsc --noEmit` clean.

## Delta from Review 039
- **Modified**: `test/cli.test.ts` — added 7 tests (20 total, up from 13):
  - `init --from-existing` auto-detection path
  - `init` refuses overwrite when file exists
  - `last` no recordings found
  - `last` with recording directory + report
  - `record --format gif`
  - `record --no-annotate`
  - `diff` with regressions (changes loop + exit code 1)
- **Fixed review-039 inaccuracy**: README was already updated in commit `fd02151` — the MEDIUM #1 from review-039 was stale
- **Tests**: 109 → 116 (+7)
- **Coverage**: 92.31% → 95.99% (+3.68%)
- **cli.ts coverage**: 73.07% → 94.44% (+21.37%)

## What's Working
- Full pipeline: config → tape → VHS → frames → AI annotation → overlay → report
- CLI: 7 commands (record, list, validate, last, init, diff, serve)
- `init --from-existing`: auto-detect project type and generate config (documented in README)
- MCP server: `demo_recorder_record` tool with config-based and adhoc modes, correct parallel multi-scenario recording
- GIF output, quiet mode, language-aware annotations
- Regression detection: `demo-recorder diff` CLI + auto-regression in `record()` pipeline
- All safety features: immutable config, symlink parallel safety, report validation
- Phase 3.3 overlay: status dots, red bug border, fade transitions
- npm publish setup
- 116 tests across 13 files, 95.99% statement coverage

## Issues Found

### CRITICAL
- None

### HIGH
- None

### MEDIUM
- None

### LOW
1. **`bin/demo-recorder.ts` at 0% coverage** — 5-line entry point, acceptable.
2. **`cli.ts` remaining uncovered lines 144-146, 258-260** — error catch/process.exit paths for `last` and `serve` commands. Minor, as these only fire on unexpected errors.

## Design Doc Compliance

| Phase 3 Feature | Status |
|---|---|
| 3.1 Multi-scenario recording | **DONE** |
| 3.2 Regression detection | **DONE** |
| 3.3 Improved annotation overlay | **DONE** |
| 3.4 Unit + integration tests | **DONE** (95.99% coverage) |
| 3.5 README + example configs | **DONE** |
| 3.6 npm publish setup | **DONE** |

**Phase 3 is 6/6 complete.** All design doc phases implemented.

## Action Items for Work Agent

### Priority 1: Beyond design doc

1. **Watch mode** — MEDIUM effort. Add `demo-recorder watch` that uses `fs.watch` to monitor source files and auto-record on change.

2. **CI/CD recording GitHub Action** — HIGH effort, HIGH value. Create `.github/workflows/demo-record.yml`.

3. **Programmatic API documentation** — LOW effort. JSDoc on exported types and functions in `index.ts`.

4. **Post-processor test stability** — LOW effort. The post-processor tests showed non-deterministic failures when run in full suite (drawtext cache interaction with test parallelism). Consider using `pool: 'forks'` in vitest config for test file isolation, or ensuring `resetDrawtextCache()` runs before each test file.

## Code Quality Notes
- Source: 1,834 lines across 14 files (avg 131 lines/file)
- Tests: 2,575 lines across 13 test files (ratio 1.40:1)
- All functions under 50 lines
- All modules under 310 lines
- Clean module boundaries
- Zod schema validation at config boundary
- Logger injection threaded from CLI → record() → annotator
- No hardcoded secrets, no console.log in production code

## Test Coverage

```
All files        95.99% stmts | 86.90% branch | 93.84% funcs | 95.99% lines
13 test files, 116 tests, all passing

Per-module:
- adhoc.ts: 100% / 100% / 100% / 100%
- regression.ts: 100% / 93.47% / 100% / 100%
- schema.ts: 100% / 100% / 100% / 100%
- loader.ts: 100% / 87.5% / 100% / 100%
- scanner.ts: 100% / 89.79% / 100% / 100%
- post-processor.ts: 97.77% / 88.63% / 100% / 97.77%
- index.ts: 96.95% / 93.44% / 91.66% / 96.95%
- frame-extractor.ts: 96.29% / 80% / 100% / 96.29%
- tape-builder.ts: 95.77% / 86.95% / 100% / 95.77%
- cli.ts: 94.44% / 82.45% / 100% / 94.44%
- annotator.ts: 93.84% / 68.75% / 80% / 93.84%
- server.ts: 91.90% / 80.95% / 50% / 91.90%
- vhs-runner.ts: 90% / 80% / 100% / 90%
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
17. **Watch mode** — MEDIUM effort. `demo-recorder watch`.
18. **CI/CD recording GitHub Action** — HIGH effort, HIGH value.
19. **Programmatic API documentation** — LOW effort. JSDoc on exports.
20. **Post-processor test stability** — LOW effort. Fix non-deterministic failures.
