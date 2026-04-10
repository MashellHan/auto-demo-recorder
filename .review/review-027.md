# Review 027 — 2026-04-11 06:46 UTC+8

## Status: BRAINSTORM

## Score: 98/100

## Summary

Independent audit after shared adhoc builder, auto-regression, and Report type unification. All three MEDIUM issues from review-025 are confirmed resolved. Codebase is 1,549 production lines + 1,872 test lines across 13 source files and 12 test files (82 tests, 89.93% statement coverage). No new CRITICAL or HIGH issues. Five carried LOW issues remain unchanged. Phase 3 is 5/6 complete.

## Delta from Review 026
- Independent audit — no new commits since review-026 (commit `caefb39`)
- Full re-read of all 13 source files, 12 test files, package.json, README
- Verified timestamp calculation in annotator.ts is correct (frame 1 = t=0s, frame 2 = t=1s at 1fps)
- Confirmed adhoc builder eliminates all duplication — CLI and MCP both delegate cleanly
- Confirmed auto-regression test coverage: 2 tests in index.test.ts (with/without previous report)

## What's Working
- Full pipeline: config -> tape -> VHS -> frames -> AI annotation -> overlay -> report
- CLI: 7 commands (record, list, validate, last, init, diff, serve)
- MCP server: `demo_recorder_record` tool with config-based and adhoc modes
- GIF output: `--format gif` skips overlay, annotations in report only
- Quiet mode: `--quiet` flag, injectable Logger for library consumers
- Language-aware annotations: language instruction appended to Claude prompt
- Regression detection: `demo-recorder diff` CLI + auto-regression in `record()` pipeline
- Shared adhoc config builder (`src/config/adhoc.ts`): single source of truth for defaults
- Unified Report type across regression.ts and index.ts
- npm publish setup: `files`, `prepublishOnly`, `types`, `main`, `bin`
- 82 tests across 12 files, 89.93% statement coverage, all passing

## Issues Found

### CRITICAL
- None

### HIGH
- None

### MEDIUM
- None

### LOW
1. **`config.annotation` mutated in CLI** — `src/cli.ts:48-52` directly mutates the parsed config object (`config.annotation.enabled = false`). Functionally fine since config is consumed once, but violates immutability principle. (Carried since review-022)
2. **`loadReport` has no schema validation** — `src/pipeline/regression.ts:43-46` does `JSON.parse() as Report` with no runtime validation. Malformed JSON files would fail at property access. (Carried since review-025)
3. **`diff` command doesn't respect `--quiet`** — `src/cli.ts:199-232` always writes to console.log. Minor inconsistency with the quiet pattern used by `record`. (Carried since review-025)
4. **`bin/demo-recorder.ts` at 0% coverage** — 5-line entry point, acceptable.
5. **Dynamic import of `realpath`** — `src/index.ts:226` uses `await import('node:fs/promises')` for `realpath` despite `readFile` already being imported from the same module at the top. Works but unnecessary indirection.

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

### Priority 1: Quick fixes (LOW effort, improves cleanliness)
1. **Remove dynamic import of `realpath`** — Add `realpath` to the existing `import { ... } from 'node:fs/promises'` at the top of `src/index.ts`. Remove the `await import('node:fs/promises')` on line 226.
2. **Clone config before mutation in CLI** — Replace `config.annotation.enabled = false` with `const cfg = { ...config, annotation: { ...config.annotation, enabled: false } }` pattern. Similarly for format mutation.

### Priority 2: Next brainstorm feature
3. **Improved annotation overlay (Phase 3.3)** — Last remaining Phase 3 item. Design doc specifies: fade transitions between annotations, colored status dot (green/yellow/red) in top-right corner, red border for bug frames. This lives entirely in `src/pipeline/post-processor.ts`.

### Priority 3: README enhancement
4. **Document ANTHROPIC_API_KEY requirement** — README doesn't mention that annotation requires `ANTHROPIC_API_KEY`. Add a section under Prerequisites or Usage.
5. **Document `diff` and `init` commands** — README shows 4 commands but the CLI has 7. Add `init`, `diff`, and `--format gif` examples.

## Code Quality Notes
- Test-to-source ratio: 1.21:1 (1,872 test / 1,549 source) — excellent
- All modules under 300 lines, most under 200
- Clean pipeline decomposition: 6 pipeline modules + 3 config modules + 1 MCP module
- Zod schema provides compile-time + runtime validation for config
- Logger injection properly threaded from CLI/MCP through record() into pipeline
- Auto-regression wrapped in try/catch — never breaks the recording pipeline
- `compareReports()` is pure function with 100% coverage — easy to extend
- No hardcoded secrets, ANTHROPIC_API_KEY validated at annotation time
- Conventional commit messages throughout git history

## Test Coverage

```
All files        89.93% stmts | 83.01% branch | 92% funcs | 89.93% lines
12 test files, 82 tests, all passing

Per-module:
- adhoc.ts: 100% / 100% / 100% / 100%
- regression.ts: 100% / 90% / 100% / 100%
- schema.ts: 100% / 100% / 100% / 100%
- loader.ts: 100% / 87.5% / 100% / 100%
- post-processor.ts: 98.41% / 90% / 100% / 98.41%
- index.ts: 96.93% / 93.33% / 91.66% / 96.93%
- tape-builder.ts: 95.77% / 86.95% / 100% / 95.77%
- annotator.ts: 93.84% / 68.75% / 80% / 93.84%
- frame-extractor.ts: 96.29% / 80% / 100% / 96.29%
- vhs-runner.ts: 90% / 80% / 100% / 90%
- server.ts: 83.43% / 70.58% / 50% / 83.43%
- cli.ts: 70.96% / 68.29% / 100% / 70.96%

Gaps worth closing:
- cli.ts: diff error paths, last/init error paths, format edge cases
- server.ts: multi-result response path, handleAdhocMcp function not directly tested
- annotator.ts: retry backoff edge cases
```

## Brainstorm: Updated Priority

1. ~~Language-aware annotations~~ — **DONE**
2. ~~GIF output~~ — **DONE**
3. ~~Quiet/verbose mode~~ — **DONE**
4. ~~Regression detection (Phase 3.2)~~ — **DONE**
5. ~~Auto-regression in `record`~~ — **DONE**
6. ~~Extract shared adhoc builder~~ — **DONE**
7. **Improved annotation overlay (Phase 3.3)** — MEDIUM effort. Last Phase 3 item. Fade effects, status dots, red border for bug frames. All changes in post-processor.ts.
8. **README enhancements** — LOW effort. Document API key, diff/init commands, GIF format.
9. **CI/CD recording GitHub Action** — HIGH effort, HIGH value. Auto-record on PR, post annotated preview as comment.
10. **Watch mode** — MEDIUM effort. `demo-recorder watch` monitors source files and auto-records on change.
11. **`demo-recorder init --from-existing`** — LOW effort. Scan project to auto-generate config.
