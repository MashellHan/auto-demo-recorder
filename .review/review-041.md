# Review 041 — 2026-04-11 08:24 UTC+8

## Status: BRAINSTORM

## Score: 99/100

## Summary

Confirming state after commits `bb8edea` (drawtext fallback) and `defe8ab` (CLI test coverage boost). The graceful drawtext fallback detects ffmpeg freetype at runtime and skips text overlays when unavailable — clean implementation with cache + reset for testing. CLI coverage jumped 73% → 94%. All 116 tests pass, `tsc --noEmit` clean, 95.99% statement coverage. No code issues found.

## Delta from Review 040
- **Commit `bb8edea`**: `src/pipeline/post-processor.ts` added `checkDrawtextSupport()` with module-level cache, `resetDrawtextCache()` export for testing, and conditional `hasDrawtext` gate on drawtext+status dot filters. Bug border filters remain always-on. `test/post-processor.test.ts` updated mock to simulate drawtext support via `-filters` response. `README.md` updated with `--from-existing` docs.
- **Commit `defe8ab`**: `test/cli.test.ts` added 7 tests (init overwrite, init --from-existing, last no-recordings, last with-recordings, record --format gif, record --no-annotate, diff with regressions).
- Tests stable: ran full suite multiple times with zero non-deterministic failures.

## What's Working
- Full pipeline: config → tape → VHS → frames → AI annotation → overlay → report
- CLI: 7 commands (record, list, validate, last, init, diff, serve)
- `init --from-existing`: auto-detect project type and generate config (documented in README)
- **Drawtext fallback**: gracefully degrades when ffmpeg lacks freetype — keeps drawbox bar and bug borders, skips text overlays
- MCP server: `demo_recorder_record` tool with config-based and adhoc modes, correct parallel multi-scenario recording
- GIF output, quiet mode, language-aware annotations
- Regression detection: `demo-recorder diff` CLI + auto-regression in `record()` pipeline
- All safety features: immutable config, symlink parallel safety, report validation
- Phase 3.3 overlay: status dots, red bug border, fade transitions (when ffmpeg supports drawtext)
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
2. **`cli.ts` remaining uncovered lines 144-146, 258-260** — error catch/process.exit paths for `last` and `serve` commands. Minor.

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

1. **Watch mode** — MEDIUM effort. Add `demo-recorder watch` that uses `fs.watch` to monitor source files and auto-record on change. Useful for iterative TUI development where developers want to see recording updates as they code.

2. **CI/CD recording GitHub Action** — HIGH effort, HIGH value. Create `.github/workflows/demo-record.yml` that runs on PR, records demos, uploads artifacts, and posts annotated preview as PR comment. Requires VHS + ffmpeg in CI.

3. **Programmatic API documentation** — LOW effort. Add JSDoc to all exported types and functions in `index.ts` for library consumers. Current exports are clean but undocumented.

4. **MCP server test coverage for `handleAdhocMcp`** — LOW effort. `server.ts` function coverage is 50% — the `handleAdhocMcp` helper isn't directly tested beyond the integration in the adhoc call test. Adding a focused test would raise function coverage.

## Code Quality Notes
- Source: 1,870 lines across 14 files (avg 134 lines/file)
- Tests: 2,575 lines across 13 test files (ratio 1.38:1)
- All functions under 50 lines
- All modules under 310 lines
- Clean module boundaries: config (4 files), pipeline (5 files), MCP (1 file), CLI (1 file), core (1 file)
- Drawtext cache pattern is clean: module-level boolean with null sentinel, exposed reset for testing
- Post-processor degrades gracefully: draws bar + bug borders always, text overlays only when freetype available
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
20. **MCP server `handleAdhocMcp` test** — LOW effort. Boost function coverage.
