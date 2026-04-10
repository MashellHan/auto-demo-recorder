# Review 011 — 2026-04-11 04:26 UTC+8

## Status: IN_PROGRESS

## Score: 55/100

## Summary

No work agent commits since the source scaffold (5a55a88). Codebase unchanged for 8 consecutive review cycles (003–011). Phase 1 MVP skeleton is architecturally sound but incomplete — missing MCP server, ad-hoc mode, and several CLI commands. Test coverage well below the 80% target.

## Delta from Review 010
- Fixed: nothing
- New issues: none
- Score change: 55 → 55 (unchanged)
- Stagnation: 8 cycles with no work agent commits

## What's Working
- TypeScript compiles cleanly (strict mode, zero `any`)
- Zod config schema with proper type inference
- Pipeline architecture: tape-builder → vhs-runner → frame-extractor → annotator → post-processor
- CLI: `record`, `list`, `validate` commands functional
- 11 unit tests pass (config schema + tape builder)
- Source code committed to git and pushed to GitHub

## Issues Found

### CRITICAL
1. **MCP server absent** — `src/mcp/server.ts` doesn't exist, `serve` command not in CLI, `@modelcontextprotocol/sdk` not in package.json. README advertises `demo-recorder serve` which errors at runtime.

### HIGH
2. **Ad-hoc mode missing** — `--adhoc`, `--command`, `--steps` flags documented but not implemented in `src/cli.ts`
3. **`last` and `init` commands missing** — documented in README and design doc
4. **No ANTHROPIC_API_KEY guard** — `src/pipeline/annotator.ts` instantiates SDK without checking for key; throws opaque error
5. **`execSync` blocks event loop** — `src/index.ts:63` uses sync child process for build command in async pipeline
6. **No retry logic in annotator** — serial API calls with no retry; single failure aborts entire run

### MEDIUM
7. **Double-sleep bug** — `src/pipeline/tape-builder.ts`: `sleep` action emits both `Sleep ${value}` and `Sleep ${pause}`
8. **`drawtext` timing bug** — `src/pipeline/post-processor.ts`: frame index used as seconds, breaks at `extract_fps != 1`
9. **`annotator.ts` timestamp calc** — implicit `extract_fps=1` assumption in `Math.floor((i-1)/60)` 
10. **Test coverage ~15%** — 11 tests for config+tape-builder only; pipeline modules have zero tests
11. **`test:coverage` broken** — `@vitest/coverage-v8` missing from devDependencies
12. **`handlebars` unused** — in package.json but never imported; `templates/` dir empty
13. **Unnecessary dynamic import** — `frame-extractor.ts` dynamically imports `readdir` inside function body

### LOW
14. **`record()` function 126 lines** — `src/index.ts` main function exceeds 50-line guideline
15. **No LICENSE file** — open source repo without license

## Action Items for Work Agent (URGENT — prioritized)

> **8 cycles with no progress.** If a work agent is running, it should check this file for priorities.

1. **[CRITICAL]** Implement `src/mcp/server.ts` — create MCP server with `demo_recorder_record` tool per design doc Section 5. Install `@modelcontextprotocol/sdk`. Wire `serve` command in `src/cli.ts`.
2. **[HIGH]** Add `--adhoc` mode to `record` command — accept `--command`, `--steps`, `--width`, `--height` flags. Generate tape on-the-fly without config file.
3. **[HIGH]** Add `ANTHROPIC_API_KEY` check at start of `annotate()` — throw descriptive error if missing.
4. **[HIGH]** Replace `execSync` with `execFile` (promisified) in `src/index.ts:63`.
5. **[HIGH]** Add retry with exponential backoff to `client.messages.create` calls in annotator.
6. **[HIGH]** Implement `last` and `init` CLI commands.
7. **[MEDIUM]** Fix double-sleep in tape-builder for `sleep` action type.
8. **[MEDIUM]** Fix `drawtext` timing to use `frameIndex / extract_fps` instead of raw frame index.
9. **[MEDIUM]** Add tests for pipeline modules — target 80% coverage.
10. **[MEDIUM]** Install `@vitest/coverage-v8` and fix `test:coverage` script.
11. **[LOW]** Remove unused `handlebars` dependency or implement template-based tape generation.
12. **[LOW]** Add MIT LICENSE file.

## Code Quality Notes
- Architecture is clean — single-responsibility modules, proper async patterns
- Zero `any` usage is excellent
- Zod schema provides good runtime validation
- Error handling exists but is inconsistent (some modules throw, some return)
- Main `record()` function should be decomposed

## Test Coverage
- **Estimated: ~15%** (11 tests covering config schema and tape builder only)
- **Target: 80%**
- Pipeline modules (annotator, vhs-runner, frame-extractor, post-processor) have zero tests
- Coverage tooling broken — `@vitest/coverage-v8` not installed

## Next Review
- In 15 minutes. If still no changes, will consider switching to implementation mode.
