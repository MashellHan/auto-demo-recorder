# Review 005 — 2026-04-10 18:52 UTC (2026-04-11 02:52 UTC+8)

## Status: IN_PROGRESS

## Score: 52/100

## Summary

No work agent commits have been made since review-004. The git log shows only four commits total, the most recent being "review: v004 — score 52/100". All project files (src/, bin/, test/, package.json, README.md, etc.) remain untracked, and the source is byte-for-byte identical to the state reviewed in cycles 003 and 004. Every issue from review-004 carries forward without modification. Score is held at 52/100.

## Delta from Review 004

- Fixed: nothing — no source changes between review-004 and review-005
- New issues: none (same codebase)
- Score change: 52 → 52 (no change)

---

## What's Working

- TypeScript project scaffold: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore` all correct
- Config schema (`src/config/schema.ts`) — Zod-based with proper defaults; `min(1)` guard on scenarios array; strict mode TypeScript, zero `any`
- Config loader (`src/config/loader.ts`) — reads YAML, validates with Zod, throws clear error on missing file
- Tape builder (`src/pipeline/tape-builder.ts`) — generates valid VHS `.tape` syntax; handles `Hide`/`Show` setup blocks, key mapping, `repeat`, `sleep` actions; escapes quotes correctly
- VHS runner (`src/pipeline/vhs-runner.ts`) — async `execFile`, 120s timeout, stderr forwarding
- Frame extractor (`src/pipeline/frame-extractor.ts`) — correct `ffmpeg fps=N` filter, 60s timeout
- Post-processor (`src/pipeline/post-processor.ts`) — `drawbox` + `drawtext` filter chain; `groupFramesByAnnotation` reduces filter count; ffmpeg special-char escaping
- CLI `record` / `list` / `validate` commands wired and functional
- 11 unit tests (5 tape-builder, 6 config-schema) — all 11 pass via `npm test`
- Output directory structure is correct: `<output.dir>/<timestamp>/<scenario.name>/`; `latest` symlink updated after each run
- `examples/demo-recorder.yaml` exists with two realistic scenarios

---

## Issues Found

### CRITICAL

**`serve` command documented but not implemented — MCP server absent**

File: `/Users/mengxionghan/.superset/projects/Tmp/auto-demo-recorder/src/cli.ts`, `/Users/mengxionghan/.superset/projects/Tmp/auto-demo-recorder/README.md`

`README.md` advertises `demo-recorder serve` and lists "MCP server for agent integration" as a feature. `src/cli.ts` registers only `record`, `list`, and `validate`. `src/mcp/` is an empty directory. `@modelcontextprotocol/sdk` is not in `package.json`. Any user or agent that runs `demo-recorder serve` receives an "unknown command" error. This is a shipped broken interface claim.

---

### HIGH

**MCP server (`src/mcp/`) is entirely absent**

The directory exists but contains no files. The design doc Phase 2 makes MCP the primary agent integration path. `@modelcontextprotocol/sdk` is not a dependency. No stub, TODO, or partial implementation exists.

**Ad-hoc recording mode (`--adhoc`) not implemented**

`README.md` and design doc §4.1 both document `demo-recorder record --adhoc --command "..." --steps "..."`. There is no `--adhoc` option in `src/cli.ts` and no code to support configless recording. Agents calling this tool without a committed `demo-recorder.yaml` have no path to use the tool.

**`last` and `init` commands not implemented**

`README.md` documents `demo-recorder last` and `demo-recorder init`. Neither command is registered in `src/cli.ts`. `serve`, `last`, `init`, and the `record --adhoc` variant are all missing; only `record`, `list`, and `validate` exist.

**No `ANTHROPIC_API_KEY` guard before SDK instantiation**

File: `/Users/mengxionghan/.superset/projects/Tmp/auto-demo-recorder/src/pipeline/annotator.ts:32`

`const client = new Anthropic()` is called unconditionally. If `ANTHROPIC_API_KEY` is not set the SDK throws an opaque internal error. An explicit guard is required before instantiation:

```typescript
// Current (bad)
const client = new Anthropic();

// Required
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error('ANTHROPIC_API_KEY environment variable is not set. Required for AI annotation.');
}
const client = new Anthropic({ apiKey });
```

**`execSync` used for build command — blocks the Node.js event loop**

File: `/Users/mengxionghan/.superset/projects/Tmp/auto-demo-recorder/src/index.ts:63-64`

`execSync(config.project.build_command, ...)` is the only synchronous child-process call in the codebase. All other child-process calls (`runVhs`, `extractFrames`, `postProcess`) use async `execFile`. This blocks the event loop for the entire build duration. Must be replaced with a Promise-wrapped async exec.

**No retry logic in the annotator's sequential API call loop**

File: `/Users/mengxionghan/.superset/projects/Tmp/auto-demo-recorder/src/pipeline/annotator.ts:58-73`

`client.messages.create(...)` is called once per frame with no retry. A transient network failure or 429 on any frame aborts the entire annotation pass and discards all already-processed frames. The `catch` block at line 80 handles only JSON parse failures, not API errors. A 3-attempt exponential-backoff wrapper is needed around the `messages.create` call.

---

### MEDIUM

**`drawtext` timing incorrect at `extract_fps != 1`**

File: `/Users/mengxionghan/.superset/projects/Tmp/auto-demo-recorder/src/pipeline/post-processor.ts:49-50`

`group.startIndex` and `group.endIndex + 1` are passed directly as seconds to `between(t, ...)`. This is only accurate when `extract_fps = 1`. At `extract_fps = 2`, frame index 10 is at second 5, not second 10. `extractFps` must be threaded through `postProcess` options and used as a divisor:

```typescript
const startSec = group.startIndex / extractFps;
const endSec   = (group.endIndex + 1) / extractFps;
```

**`handlebars` dependency in `package.json` is unused — `templates/` directory is empty**

`handlebars` is listed in `dependencies` (ships to end users via `npm install`). `templates/` is empty. `tape-builder.ts` uses string concatenation, not Handlebars. Either remove the dependency and the empty directory, or implement the template as specified in the design doc.

**`demo-recorder.yaml` at repo root is a development test artifact**

File: `/Users/mengxionghan/.superset/projects/Tmp/auto-demo-recorder/demo-recorder.yaml`

This file (`e2e-test` scenario) is in the repository root alongside the package surface. It is not listed in `.gitignore`. When the CLI runs from this repo root, `loadConfig` resolves to `process.cwd()/demo-recorder.yaml` and picks up this artifact instead of the user's own config. It should be moved to `examples/` or added to `.gitignore`.

**`record()` function is 126 lines — above 50-line guideline**

File: `/Users/mengxionghan/.superset/projects/Tmp/auto-demo-recorder/src/index.ts:37-163`

The function handles directory creation, build execution, tape generation, VHS recording, frame extraction, annotation, post-processing, report writing, symlink management, and console output in one body. Per the project's coding-style rule (functions <50 lines), these responsibilities should be split into smaller helpers.

**`config.annotation.enabled` mutated in-place in CLI handler**

File: `/Users/mengxionghan/.superset/projects/Tmp/auto-demo-recorder/src/cli.ts:24`

```typescript
config.annotation.enabled = false;  // in-place mutation of validated config object
```

Per the project's immutability rule and TypeScript coding-style rule, this must use object spread:

```typescript
const effectiveConfig = {
  ...config,
  annotation: { ...config.annotation, enabled: false },
};
```

**No `utils/logger.ts` — `console.log`/`console.error` throughout all pipeline modules**

The design doc specifies `src/utils/logger.ts`. All pipeline stages write directly to stdout/stderr. When `record()` is imported as a library, callers receive uncontrollable console output with no way to suppress or redirect it. `src/utils/` remains empty.

**`test:coverage` script broken — `@vitest/coverage-v8` not installed**

`package.json` defines `"test:coverage": "vitest run --coverage"` but `@vitest/coverage-v8` is absent from `devDependencies`. Running `npm run test:coverage` fails with a missing-dependency error immediately.

---

### LOW

**README does not mention `ANTHROPIC_API_KEY` requirement**

Users who run any scenario with `annotation.enabled: true` will hit a cryptic SDK error. The Prerequisites section should include:

```bash
export ANTHROPIC_API_KEY=sk-...
```

**`src/utils/` directory is empty**

Created per the design doc structure but contains no files. `ffmpeg.ts` and `logger.ts` utilities were specified.

**`package.json` missing `author` field** — expected for a publishable npm package.

**No `.nvmrc` file** — `package.json` specifies `"engines": { "node": ">=20" }` but there is no `.nvmrc` to guide developers to the correct Node version.

---

## Action Items for Work Agent (prioritized)

1. **Implement MCP server** — Create `src/mcp/server.ts` with the `demo_recorder_record` tool as specified in design doc §5. Add `@modelcontextprotocol/sdk` to `package.json` dependencies. Register `serve` command in `src/cli.ts` that starts the MCP server in stdio transport mode.

2. **Implement `--adhoc` recording mode** — Add `--adhoc`, `--command`, and `--steps` options to the `record` command in `src/cli.ts`. Parse comma-separated steps (e.g., `"j,j,Enter,sleep:2s,q"`) into `Step[]` without requiring a YAML config file. Construct a minimal in-memory `Config` object and pass it to `record()`.

3. **Implement `last` and `init` commands** — `last`: read the `latest/` symlink, find `*/report.json` files, print recording paths and summaries. `init`: scaffold a `demo-recorder.yaml` template in cwd, refusing to overwrite an existing file.

4. **Add `ANTHROPIC_API_KEY` guard** — At the top of `annotateFrames` in `src/pipeline/annotator.ts`, check `process.env.ANTHROPIC_API_KEY` before instantiating the Anthropic client and throw a clear, actionable error with the env var name if absent.

5. **Replace `execSync` with async exec** — In `src/index.ts:64`, replace `execSync` with a `Promise`-wrapped `execFile` call, consistent with all other child-process calls in the codebase.

6. **Add retry logic to the annotator** — Wrap `client.messages.create` in a 3-attempt loop with exponential backoff (500ms, 1000ms, 2000ms) to handle transient network errors and 429 rate-limit responses.

7. **Fix `drawtext` timing for non-1-fps extraction** — Thread `extractFps` through `postProcess` options and `buildDrawTextFilters`; divide frame indices by `extractFps` when computing `between(t, ...)` values in `src/pipeline/post-processor.ts`.

8. **Add `@vitest/coverage-v8` to devDependencies** — Run `npm install -D @vitest/coverage-v8` so `npm run test:coverage` is operational.

9. **Remove `handlebars` or implement the template** — Either `npm uninstall handlebars` and delete the empty `templates/` directory, or implement `templates/tape.hbs` and use it in `tape-builder.ts`.

10. **Move or gitignore `demo-recorder.yaml` at repo root** — Either move it to `examples/e2e-test.yaml` or add the root `demo-recorder.yaml` to `.gitignore`.

11. **Fix in-place mutation of config object** — In `src/cli.ts:24`, replace mutation with an immutable spread.

12. **Write tests for pipeline modules** — Add tests for `frame-extractor` (mock `execFile`), `post-processor` (pure `buildDrawTextFilters`/`groupFramesByAnnotation` functions require no mocking), and `annotator` (mock the Anthropic SDK). Target >= 80% coverage overall.

13. **Add `ANTHROPIC_API_KEY` prerequisite to README** — Update the Prerequisites section.

---

## Code Quality Notes

- TypeScript quality remains high: strict mode, zero `any`, Zod-inferred types throughout.
- Error propagation is consistent: every pipeline stage throws `Error`; CLI catches at top and exits with code 1.
- `escapeQuotes` and `escapeFfmpegText` are correct escape implementations.
- `groupFramesByAnnotation` is a clean, correct optimization for reducing the ffmpeg filter chain length.
- `vhs-runner.ts` correctly reads the output path back from the tape content rather than recomputing it.
- The `formatTimestamp` helper uses `getMonth() + 1` correctly.
- The symlink update (`unlink` + `symlink`) is non-atomic: recording two scenarios in the same timestamp bucket would cause the second scenario's symlink call to follow the first's `unlink`, leaving a window where `latest` does not exist. A two-scenario invocation in the same minute will always clobber the symlink correctly, but briefly exposes a race window. This is LOW priority given the CLI use-case.

---

## Test Coverage

- Covered: `buildTape` (5 tests), `ConfigSchema` (6 tests) — 11 tests total, all pass
- Not covered: `loadConfig`, `findScenario`, `runVhs`, `extractFrames`, `annotateFrames`, `postProcess`, `record` orchestrator, all CLI command handlers
- Coverage tooling broken: `@vitest/coverage-v8` not installed; `npm run test:coverage` fails
- Estimated coverage: ~15-20% (only pure-logic modules tested; all I/O and exec-dependent paths have zero tests)
- Required minimum: 80%

---

## Review Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 1     | block  |
| HIGH     | 5     | warn   |
| MEDIUM   | 7     | info   |
| LOW      | 4     | note   |

Verdict: BLOCK — 1 CRITICAL issue (advertised MCP server does not exist) and 5 HIGH issues must be resolved before this tool can be considered functional for its stated purpose.
