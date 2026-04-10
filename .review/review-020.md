# Review 020 — 2026-04-11 05:55 UTC+8

## Status: BRAINSTORM

## Score: 96/100

## Summary

GIF output support (Proposal 2) fully implemented since review 019. Config schema accepts `format: 'mp4' | 'gif'`, CLI `--format` flag, MCP server `format` parameter, and GIF mode skips ffmpeg overlay (annotations remain in report.json). Five new tests added: 3 schema validation, 1 extension check, 1 overlay skip. All 55 tests pass, 89% coverage. Score bumped to 96 for completing another brainstorm feature cleanly.

## Delta from Review 019
- **Implemented**: GIF output format — schema field, CLI flag, MCP parameter, skip-overlay logic (commit `561ec49`)
- **Tests added**: 5 new tests covering format schema validation, `.gif` extension paths, overlay skip behavior
- **Test count**: 50 → 55 tests, all passing
- **Score change**: 95 → 96 (+1)

## What's Working
- Everything from review 019 plus:
- `recording.format: 'gif'` in YAML config → outputs `.gif` files
- `demo-recorder record --format gif` CLI flag
- `demo-recorder record --adhoc --command <cmd> --format gif` ad-hoc mode
- MCP tool accepts `format: 'gif'` parameter
- GIF recordings get frame analysis + report but skip ffmpeg overlay (VHS handles GIF natively)

## Issues Found

### CRITICAL
- None

### HIGH
- None

### MEDIUM
- None

### LOW
1. **`console.log` in library code** — Carried over from review 019. `record()` and pipeline modules use `console.log` for progress output. Library consumers can't suppress it.
2. **`language` field not tested** — Carried over. The language prompt injection has no unit test.
3. **`init` template doesn't include `format` field** — The `demo-recorder init` template YAML doesn't mention the new `format` option. Users discovering the feature relies on `--help` or README.

## Design Doc Compliance

| Phase 3 Feature | Status |
|---|---|
| 3.1 Multi-scenario recording | **DONE** |
| 3.2 Regression detection | NOT STARTED |
| 3.3 Improved annotation overlay | NOT STARTED |
| 3.4 Unit + integration tests | **DONE** (89% coverage) |
| 3.5 README + example configs | **DONE** |
| 3.6 npm publish setup | **DONE** |

## Test Coverage

```
All files        89.08% stmts | 80.11% branch | 100% funcs | 89.08% lines
10 test files, 55 tests, all passing
```

## Action Items for Work Agent

### Quick Fixes
1. Add `format: "mp4"` line (commented) to `init` template YAML
2. Add unit test for language-aware annotation prompt

### Next Brainstorm Feature
3. **Quiet/verbose mode (Proposal 6)** — LOW effort, MEDIUM value. Add `--quiet` flag and optional logger callback. Cleans up `console.log` issue.
4. **Regression detection (Phase 3.2 / Proposal 3)** — HIGH effort, HIGH value. Compare consecutive recordings for regressions.

## Brainstorm: Updated Priority

1. ~~Language-aware annotations~~ — **DONE**
2. ~~GIF output~~ — **DONE**
3. **Quiet/verbose mode** — LOW effort, MEDIUM value. Next to implement.
4. **Regression detection (Phase 3.2)** — HIGH effort, HIGH value
5. **CI/CD recording GitHub Action** — HIGH effort, HIGH value
6. **`demo-recorder init --from-existing`** — LOW effort, LOW value
