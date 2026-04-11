# Review 039 — 2026-04-11 08:09 UTC+8

## Status: BRAINSTORM

## Score: 99/100

## Summary

Confirming commit `6350f9d` state. The `init --from-existing` feature (brainstorm item #14) was implemented: `src/config/scanner.ts` with 5 project detectors, CLI integration in `src/cli.ts`, and 14 new tests in `test/scanner.test.ts`. All 109 tests pass, `tsc --noEmit` clean, 92.31% statement coverage. One documentation gap: README does not document the `--from-existing` flag.

## Delta from Review 038
- No code changes since review-038. This is a fresh full-scan review confirming the `init --from-existing` implementation.

## What's Working
- Full pipeline: config → tape → VHS → frames → AI annotation → overlay → report
- CLI: 7 commands (record, list, validate, last, init, diff, serve)
- `init --from-existing`: auto-detect project type (node/rust/go/python/make) and generate tailored config
- MCP server: `demo_recorder_record` tool with config-based and adhoc modes, correct parallel multi-scenario recording
- GIF output: `--format gif` skips overlay, annotations in report only
- Quiet mode: `--quiet` flag on `record` and `diff` commands, injectable Logger
- Language-aware annotations
- Regression detection: `demo-recorder diff` CLI + auto-regression in `record()` pipeline
- Report validation in `loadReport()` with field checks
- Shared adhoc config builder
- Immutable config handling in both CLI and MCP server
- `skipSymlinkUpdate` option + correct timestamp extraction for parallel safety
- Phase 3.3 overlay: status dots (green/yellow/red), red bug border, fade transitions
- npm publish setup (`files`, `prepublishOnly`, `types`, `main`, `bin`)
- 109 tests across 13 files, 92.31% statement coverage

## Issues Found

### CRITICAL
- None

### HIGH
- None

### MEDIUM
1. **README does not document `--from-existing` flag** — `README.md:40` shows `demo-recorder init` but does not mention or explain `--from-existing`. Users won't discover the auto-detection feature without docs.

### LOW
1. **`bin/demo-recorder.ts` at 0% coverage** — 5-line entry point, acceptable.

## Design Doc Compliance

| Phase 3 Feature | Status |
|---|---|
| 3.1 Multi-scenario recording | **DONE** |
| 3.2 Regression detection | **DONE** |
| 3.3 Improved annotation overlay | **DONE** |
| 3.4 Unit + integration tests | **DONE** (92.31% coverage) |
| 3.5 README + example configs | **DONE** |
| 3.6 npm publish setup | **DONE** |

**Phase 3 is 6/6 complete.** All design doc phases implemented.

## Action Items for Work Agent

### Priority 1: Fix MEDIUM

1. **Update README for `init --from-existing`** — LOW effort. In the "Initialize a project" section (line 38-41), add the `--from-existing` flag with description and example. Mention supported project types (Node, Rust, Go, Python, Make).

### Priority 2: Beyond design doc

2. **Watch mode** — MEDIUM effort. Add `demo-recorder watch` that uses `fs.watch` to monitor source files and auto-record on change. Useful for iterative TUI development.

3. **CI/CD recording GitHub Action** — HIGH effort, HIGH value. Create `.github/workflows/demo-record.yml` that runs on PR, records demos, and posts annotated preview as PR comment.

4. **Programmatic API documentation** — LOW effort. JSDoc on exported types and functions in `index.ts`.

5. **CLI test coverage improvement** — MEDIUM effort. `cli.ts` at 73.07% statement coverage, lowest among modules. Add tests for `init --from-existing` path in CLI and the `diff --quiet` mode.

## Code Quality Notes
- Source: 1,834 lines across 14 files (avg 131 lines/file)
- Tests: 2,365 lines across 13 test files (ratio 1.29:1)
- All functions under 50 lines
- All modules under 310 lines
- Clean module boundaries: config (4 files, 317 lines), pipeline (5 files, 518 lines), MCP (1 file, 216 lines), CLI (1 file, 306 lines), core (1 file, 275 lines)
- Scanner detectors follow consistent pattern: check file → parse → return ProjectInfo
- `generateConfig()` produces valid YAML with correct field commenting
- Zod schema validation at config boundary, field validation at report boundary
- Logger injection threaded from CLI → record() → annotator
- MCP server correctly uses stderr for logging (stdio transport)
- No hardcoded secrets, no console.log in production code (except CLI output)
- Immutable spread pattern consistent across CLI and MCP server

## Test Coverage

```
All files        92.31% stmts | 84.95% branch | 93.54% funcs | 92.31% lines
13 test files, 109 tests, all passing

Per-module:
- adhoc.ts: 100% / 100% / 100% / 100%
- regression.ts: 100% / 91.11% / 100% / 100%
- schema.ts: 100% / 100% / 100% / 100%
- loader.ts: 100% / 87.5% / 100% / 100%
- scanner.ts: 100% / 89.79% / 100% / 100%
- post-processor.ts: 99.11% / 94.59% / 100% / 99.11%
- index.ts: 96.95% / 93.44% / 91.66% / 96.95%
- frame-extractor.ts: 96.29% / 80% / 100% / 96.29%
- tape-builder.ts: 95.77% / 86.95% / 100% / 95.77%
- annotator.ts: 93.84% / 68.75% / 80% / 93.84%
- server.ts: 91.90% / 80.95% / 50% / 91.90%
- vhs-runner.ts: 90% / 80% / 100% / 90%
- cli.ts: 73.07% / 64.44% / 100% / 73.07%
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
15. **Update README for `init --from-existing`** — LOW effort. Fix MEDIUM #1.
16. **CLI test coverage** — MEDIUM effort. Boost `cli.ts` from 73% → 85%+.
17. **Watch mode** — MEDIUM effort. `demo-recorder watch`.
18. **CI/CD recording GitHub Action** — HIGH effort, HIGH value.
19. **Programmatic API documentation** — LOW effort. JSDoc on exports.
