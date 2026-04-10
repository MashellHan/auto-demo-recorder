# Review 004 — 2026-04-11 02:40 UTC+8

## Status: IN_PROGRESS

## Score: 52/100

## Summary

The project is entirely unchanged from review-003. All source files, configuration, and tests are identical to the state before the previous review was written. The git log shows only review documents have been committed; no work agent has run since the code was initially written. Every issue from review-003 carries over without modification.

## Delta from Review 003

- Fixed: nothing — no source changes between review-003 and review-004
- New issues: none (same codebase)
- Score change: 52 → 52 (no change)

---

## What's Working

- TypeScript project scaffold is complete and correct (`package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`)
- Config schema (`src/config/schema.ts`) — Zod-based, all fields present with sensible defaults; `min(1)` guard on scenarios array
- Config loader (`src/config/loader.ts`) — reads YAML, validates with Zod, clear error path
- Tape builder (`src/pipeline/tape-builder.ts`) — generates valid VHS `.tape` syntax; handles `Hide`/`Show` setup blocks, key mapping, `repeat`, `sleep` actions; escapes quotes correctly
- VHS runner (`src/pipeline/vhs-runner.ts`) — 120-second timeout, stderr forwarding, async `execFile`
- Frame extractor (`src/pipeline/frame-extractor.ts`) — correct `ffmpeg fps=N` filter, 60-second timeout
- Post-processor (`src/pipeline/post-processor.ts`) — builds `drawtext` filter chain from frame annotations, groups consecutive identical annotations, escapes ffmpeg special chars
- CLI `record` / `list` / `validate` commands are implemented
- 11 unit tests covering tape builder and config schema — all pass; TypeScript typechecks cleanly
- Output directory structure is correct: files land in `<output.dir>/<timestamp>/<scenario.name>/` and `latest` symlink points to the `<timestamp>/` directory
- The previous CRITICAL "path clobber" concern from review-003 was a partial misread: the actual on-disk layout (`hello-world/hello-world.tape`, `hello-world/raw.mp4`, `hello-world/report.json`) is correct for single-scenario runs

---

## Issues Found

### CRITICAL

**`serve` command documented but not implemented — MCP server absent**

File: `src/cli.ts`, `README.md`

`README.md` documents `demo-recorder serve` and lists "MCP server for agent integration" as a feature. `src/cli.ts` registers only `record`, `list`, and `validate`. Neither `src/mcp/server.ts` nor the `@modelcontextprotocol/sdk` dependency exists. Any user who runs `demo-recorder serve` receives an "unknown command" error despite the advertised feature. This constitutes a false-claim in the published interface.

---

### HIGH

**MCP server (`src/mcp/`) is entirely absent**

The directory `src/mcp/` exists but is empty. The design doc Phase 2 makes MCP the primary agent integration path. The `@modelcontextprotocol/sdk` package is not in `package.json`. No stub, TODO, or partial implementation exists.

**Ad-hoc recording mode (`--adhoc`) not implemented**

The design doc (§4.1, Phase 2.2) and README both document `demo-recorder record --adhoc --command "..." --steps "..."`. There is no `--adhoc` option anywhere in `src/cli.ts` and no code supporting configless recording. The gap is especially important because agents calling this tool ad-hoc (without a committed `demo-recorder.yaml`) have no path to use the tool.

**`serve`, `last`, and `init` commands not implemented**

`src/cli.ts` registers three commands: `record`, `list`, `validate`. Four commands (`serve`, `last`, `init`, and the full `record --adhoc` variant) are documented in both the README and design doc without any implementation, stub, or error message indicating the feature is pending.

**No `ANTHROPIC_API_KEY` guard before SDK instantiation**

File: `src/pipeline/annotator.ts:33`

`const client = new Anthropic()` is called unconditionally at the start of `annotateFrames`. If `ANTHROPIC_API_KEY` is not set, the Anthropic SDK throws an opaque internal error that gives the user no actionable guidance. Per the project's TypeScript security rule and the design doc, the check should be explicit:

```typescript
// BAD (current)
const client = new Anthropic();

// GOOD
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error('ANTHROPIC_API_KEY environment variable is not set. Required for AI annotation.');
}
const client = new Anthropic({ apiKey });
```

**`execSync` used for build command — blocks the Node.js event loop**

File: `src/index.ts:63-64`

All other child process calls (`runVhs`, `extractFrames`, `postProcess`) use `execFile` wrapped in a Promise. The build command alone uses the synchronous `execSync`, blocking the event loop for the entire build duration. It should be replaced with `await new Promise(…)` wrapping `execFile` for consistency and correctness.

**No retry logic in the annotator's sequential API call loop**

File: `src/pipeline/annotator.ts:58-73`

`client.messages.create(...)` is called once per frame with no retry. A transient network error or a 429 rate-limit response on any frame aborts the entire annotation pass and discards all frames already processed. The call happens inside a `for` loop with no surrounding try-catch at the per-frame level; the `catch` block only handles JSON parse failures. A 3-attempt exponential-backoff wrapper is needed.

---

### MEDIUM

**`post-processor.ts` frame-index used as seconds — only correct at `extract_fps = 1`**

File: `src/pipeline/post-processor.ts:49-50`

`buildDrawTextFilters` passes `group.startIndex` and `group.endIndex + 1` directly as seconds to the `ffmpeg` `between(t, ...)` filter. This is only accurate when `extract_fps = 1`. At `extract_fps = 2`, frame index 10 represents second 5, not second 10. The `extractFps` value must be passed though from `postProcess` options (and threaded from `record()`) and the calculation must be:

```typescript
const startSec = group.startIndex / extractFps;
const endSec   = (group.endIndex + 1) / extractFps;
```

**`handlebars` dependency in `package.json` is unused — `templates/` directory is empty**

The design doc lists Handlebars as the tape template engine. The actual implementation builds tape content via string concatenation in `tape-builder.ts`. `handlebars` remains in `dependencies` and `templates/` is an empty directory — both are dead weight that will ship to end users via `npm install`.

**`demo-recorder.yaml` at repo root is a development test artifact**

The file at `/auto-demo-recorder/demo-recorder.yaml` (the `e2e-test` scenario) should not be in the repository root alongside the package's published surface. It is not listed in `.gitignore` (nor is it excluded by the `!examples/*.yaml` rule). If left in place, it will confuse users who expect the root to be clean and will override the default config lookup (`loadConfig` resolves to `process.cwd()/demo-recorder.yaml`) when running the CLI from the repo root.

**`record()` function is 126 lines — above 50-line guideline**

File: `src/index.ts:37-163`

The `record` function handles directory creation, build execution, tape generation, VHS, frame extraction, annotation, post-processing, report writing, symlink management, and console output all in one function. Per the project's coding-style rule (functions <50 lines), these responsibilities should be split into smaller helpers.

**`config.annotation.enabled` mutated in-place in CLI handler**

File: `src/cli.ts:24`

```typescript
config.annotation.enabled = false;  // MUTATION of validated config object
```

Per the project's immutability rule, this should use object spread:

```typescript
const effectiveConfig = {
  ...config,
  annotation: { ...config.annotation, enabled: false },
};
```

**No `utils/logger.ts` — `console.log`/`console.error` used throughout all pipeline modules**

The design doc specifies `src/utils/logger.ts`. All pipeline stages (annotator, index, cli) write directly to stdout/stderr via `console.log`. When `record()` is imported as a library (via `src/index.ts` exports), callers get uncontrollable console output with no way to suppress or redirect it.

**`test:coverage` script broken — `@vitest/coverage-v8` not installed**

`package.json` defines the `test:coverage` script but `@vitest/coverage-v8` is not in `devDependencies`. Running `npm run test:coverage` fails immediately with the "MISSING DEPENDENCY" error. Confirmed on the current codebase.

---

### LOW

**README does not mention `ANTHROPIC_API_KEY` requirement**

Users who install the package and run any scenario with `annotation.enabled: true` will hit a cryptic SDK error. The Prerequisites section should list:

```bash
export ANTHROPIC_API_KEY=sk-...
```

**`src/utils/` directory is empty**

`src/utils/` was mentioned in the design doc (for `ffmpeg.ts` and `logger.ts`) and the directory was created, but neither file exists.

**`package.json` missing `author` field** — expected for a publishable npm package.

**No `.nvmrc` file** — `package.json` specifies `"engines": { "node": ">=20" }` but there is no `.nvmrc` to guide developers to the correct Node version.

---

## Action Items for Work Agent

1. **Implement MCP server** — Create `src/mcp/server.ts` with the `demo_recorder_record` tool as specified in design doc §5. Add `@modelcontextprotocol/sdk` to `package.json` dependencies. Wire `serve` command into `src/cli.ts`.

2. **Implement `--adhoc` recording mode** — Add `--adhoc`, `--command`, and `--steps` options to the `record` command. Parse comma-separated steps into `Step[]` without requiring a YAML config file.

3. **Implement `last` and `init` commands** — `last`: read the `latest/` symlink, find `*/report.json` files, print recording paths and summaries. `init`: scaffold a `demo-recorder.yaml` template in cwd.

4. **Add `ANTHROPIC_API_KEY` guard** — At the top of `annotateFrames` in `src/pipeline/annotator.ts`, validate the env var is present before instantiating the Anthropic client and throw a clear, actionable error if absent.

5. **Replace `execSync` with async exec** — In `src/index.ts:64`, replace `execSync` with a `Promise`-wrapped `execFile` call, consistent with all other child process uses in the codebase.

6. **Add retry logic to the annotator** — Wrap `client.messages.create` in a 3-attempt loop with exponential backoff (500ms, 1000ms, 2000ms) to handle transient network errors and rate limits.

7. **Fix `drawtext` timing for non-1-fps extraction** — Thread `extractFps` through `postProcess` options and `buildDrawTextFilters`; divide frame indices by `extractFps` when computing `between(t, ...)` values.

8. **Add `@vitest/coverage-v8` to devDependencies** — Run `npm install -D @vitest/coverage-v8` so `npm run test:coverage` works.

9. **Remove `handlebars` or implement the template** — Either `npm uninstall handlebars` and delete the empty `templates/` directory, or implement `templates/tape.hbs` and use it in `tape-builder.ts`.

10. **Move or gitignore `demo-recorder.yaml` at repo root** — Either move it to `examples/e2e-test.yaml` or add the root `demo-recorder.yaml` to `.gitignore`.

11. **Fix in-place mutation of config object** — In `src/cli.ts:24`, replace the mutation with an immutable spread to comply with the project's coding-style rules.

12. **Write tests for pipeline modules** — Add tests for `frame-extractor` (mock `execFile`), `post-processor` (pure filter-building functions can be tested without ffmpeg), and `annotator` (mock the Anthropic SDK client). Target >= 80% coverage.

13. **Add `ANTHROPIC_API_KEY` prerequisite to README**.

---

## Code Quality Notes

- TypeScript quality remains high: strict mode, zero `any`, types inferred from Zod. No regressions here.
- Error propagation is consistent: every pipeline stage throws a typed `Error`; CLI catches at the top and exits with code 1.
- `escapeQuotes` and `escapeFfmpegText` are correct for their respective contexts.
- `groupFramesByAnnotation` is a clean optimization that correctly reduces the ffmpeg filter chain.
- The output directory structure observed on disk is correct for single-scenario runs — the earlier "CRITICAL" path-clobber concern from review-003 was overstated. The `hello-world/` subdirectory layout is as designed. That said, running two scenarios in the same `record` invocation would call `symlink` twice for the same `latest` path in the same minute — the `unlink + symlink` is non-atomic and the second scenario would clobber the first's symlink target point within the same timestamp bucket.

---

## Test Coverage

- Covered: `buildTape` (5 tests), `ConfigSchema` (6 tests) — 11 tests total, all pass
- Not covered: `loadConfig`, `findScenario`, `runVhs`, `extractFrames`, `annotateFrames`, `postProcess`, `record` orchestrator, all CLI command handlers
- Coverage tooling broken: `@vitest/coverage-v8` not installed
- Estimated coverage: ~15-20% (only pure-logic modules tested; all I/O and exec-dependent paths have zero tests)
- Required minimum: 80%
