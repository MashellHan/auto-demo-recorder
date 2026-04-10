# Review 009 — 2026-04-11T03:51 UTC+8

## Status: IN_PROGRESS

## Score: 55/100

## Summary

The stagnation streak is finally broken. Commit `5a55a88` ("feat: initial project scaffold with Phase 1 MVP pipeline") was pushed after review-008, giving this review access to proper git diff for the first time. The source code is now fully committed and the Phase 1 pipeline is verifiably correct.

However, this commit contains exactly the same source tree that has existed since reviews 003–008 — no new features were added beyond what was already visible to previous reviewers. Every HIGH and MEDIUM issue carried over from review-008 remains open. The work agent committed, but did not implement any of the repair items from the previous cycle's action list. Score moves from 52 → 55 (+3) solely for the git commit resolving the untracked-source blocker and allowing proper diff-based review.

---

## Delta from Review 008

- Fixed: source code committed to git (commit `5a55a88`) — stagnation streak broken
- New work agent changes: none beyond the initial commit itself
- All 11 issues from review-008 remain open
- Score change: 52 → 55 (+3 for commit hygiene only)

---

## What's Working

The Phase 1 pipeline is architecturally sound and the happy-path record flow is coherent end-to-end:

- Config schema (`src/config/schema.ts`) — Zod-based, proper defaults, `min(1)` guard on scenarios, strict TS, zero `any`
- Config loader (`src/config/loader.ts`) — async YAML read, Zod parse, useful error on missing scenario
- Tape builder (`src/pipeline/tape-builder.ts`) — correct VHS `.tape` syntax, Hide/Show setup blocks, key mapping, `repeat`, `sleep`, quote escaping
- VHS runner (`src/pipeline/vhs-runner.ts`) — async `execFile`, 120s timeout, stderr forwarding, regex-based output path extraction
- Frame extractor (`src/pipeline/frame-extractor.ts`) — correct `ffmpeg fps=N` filter, 60s timeout, async `execFile`, frame count from `readdir`
- AI annotator (`src/pipeline/annotator.ts`) — Claude Vision SDK integration, proper base64 encoding, correct content block filtering, graceful JSON parse fallback per frame
- Post-processor (`src/pipeline/post-processor.ts`) — `drawbox` + `drawtext` filter chain, `groupFramesByAnnotation` correctly deduplicates consecutive identical annotations for ffmpeg efficiency, `escapeFfmpegText` handles single-quotes, colons, and percent signs
- CLI `record` / `list` / `validate` commands correctly wired
- 11 unit tests (5 tape-builder, 6 config-schema) pass cleanly
- TypeScript compiles with zero errors (`tsc --noEmit` clean)
- Output directory structure: `<output.dir>/<timestamp>/<scenario>/`, `latest` symlink
- `dist/` compiled output present

---

## Issues Found

### CRITICAL

**`serve` command advertised but absent — broken public contract**

File: `src/cli.ts`, `README.md`

`README.md` advertises `demo-recorder serve` as a first-class command and "MCP server for agent integration" as a headline feature. `src/cli.ts` registers only `record`, `list`, and `validate`. The `src/mcp/` directory is empty. `@modelcontextprotocol/sdk` is absent from `package.json`. Running `demo-recorder serve` produces "unknown command 'serve'" — a crash at the published API boundary.

This is the primary agent-integration path and the key differentiator of the project. It has been absent for all 7 review cycles since the design doc was written.

---

### HIGH

**MCP server entirely absent — `src/mcp/server.ts` not started**

Design doc §5 defines the full `demo_recorder_record` tool interface, inputSchema, and response format. No file exists in `src/mcp/`, no SDK dependency is installed, no stub or placeholder is present. The "Invocation Mode 2" from the design doc is completely unimplemented.

**Ad-hoc recording mode (`--adhoc`) not implemented**

File: `src/cli.ts`, `README.md`

`README.md` documents `demo-recorder record --adhoc --command "./my-tui" --steps "..."`. The `record` command in `src/cli.ts` accepts only `--config`, `--scenario`, and `--no-annotate`. There is no `--adhoc`, `--command`, or `--steps` option. The configless invocation path used by agents who don't have a pre-existing `demo-recorder.yaml` is completely unavailable.

**`last` and `init` commands not implemented**

`README.md` documents `demo-recorder last` (show last recording info) and `demo-recorder init` (generate a starter config). Neither is registered in `src/cli.ts`. Both return "unknown command" errors at runtime.

**No `ANTHROPIC_API_KEY` guard in annotator**

File: `src/pipeline/annotator.ts:32`

```typescript
const client = new Anthropic();  // throws opaque internal error if key absent
```

`new Anthropic()` is called unconditionally. When `ANTHROPIC_API_KEY` is missing from the environment, the SDK throws an internal error with no user-actionable message. A check must be added before instantiation:

```typescript
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required for annotation');
}
const client = new Anthropic();
```

**`execSync` blocks the event loop for build command execution**

File: `src/index.ts:63–64`

```typescript
const { execSync } = await import('node:child_process');
execSync(config.project.build_command, { cwd: projectDir, stdio: 'inherit' });
```

This is the only synchronous subprocess call in the entire pipeline. Every other subprocess call (VHS, ffmpeg) uses async `execFile`. Build commands can take 10–30 seconds; blocking the event loop for that duration is incorrect. Replace with a Promise-wrapped `execFile` or `execa`.

**No retry logic in annotator API call loop**

File: `src/pipeline/annotator.ts:58–103`

`client.messages.create(...)` has no retry handling. A single transient 429, 529, or network error on any frame aborts the entire annotation pass and discards all previously-processed results. The `catch` at line 80 handles only JSON parse failures — API-level errors propagate uncaught up through the pipeline. A 3-attempt retry with exponential backoff (500ms base) is required for production reliability.

---

### MEDIUM

**`drawtext` timing incorrect when `extract_fps != 1`**

File: `src/pipeline/post-processor.ts:49–50`

```typescript
const startTime = group.startIndex;   // treated as seconds
const endTime = group.endIndex + 1;
```

Frame index values are used directly as seconds in `between(t, startIndex, endIndex)`. At `extract_fps = 2` (default in many real-world configs), frame index 10 represents second 5. `extract_fps` is not a field in `PostProcessOptions`. The bug produces double-speed annotation misalignment on any config with `extract_fps != 1`. The design doc's example config uses `extract_fps: 1`, masking this defect in development.

Fix: add `extractFps: number` to `PostProcessOptions` and divide: `startTime = group.startIndex / extractFps`.

**`handlebars` in production dependencies but unused**

File: `package.json:29`

`handlebars` is listed as a production dependency. No file in `src/`, `bin/`, or `test/` imports or references it. `templates/` is an empty directory. The design doc listed Handlebars as the tape template engine, but `tape-builder.ts` uses string array concatenation instead. Either remove the dependency (`npm uninstall handlebars` + delete `templates/`) or implement `templates/tape.hbs` and switch the tape builder to use it. Carrying an unused 470KB production dependency is MEDIUM severity.

**Root `demo-recorder.yaml` is a committed test artifact that hijacks user config discovery**

File: `demo-recorder.yaml` (project root)

This `e2e-test` config at the repo root is committed to git and not gitignored. When any user clones this repo and runs `demo-recorder` from the project root without a `--config` flag, `loadConfig()` resolves this file instead of their own config. It should be moved to `examples/e2e-test.yaml` and the root path added to `.gitignore`.

**`record()` function is 126 lines — exceeds 50-line project guideline**

File: `src/index.ts:37–163`

The `record()` function performs directory setup, build execution, tape generation, VHS recording, frame extraction, annotation, post-processing, report writing, symlink management, and console output in a single body. Each numbered phase (1–8 in the inline comments) should be extracted into a private named helper function.

**In-place mutation of `config.annotation.enabled` in CLI handler**

File: `src/cli.ts:24`

```typescript
config.annotation.enabled = false;  // direct mutation of validated config object
```

This violates the immutability principle. Replace with an immutable spread at the `record()` call site:

```typescript
await record({
  config: { ...config, annotation: { ...config.annotation, enabled: false } },
  scenario,
  projectDir,
});
```

**No structured logger — `console.log`/`console.error` used throughout pipeline**

Design doc §3 specifies `src/utils/logger.ts`. All pipeline stages write directly to stdout/stderr. When the MCP server is implemented, library callers will have no way to suppress or redirect noisy pipeline output. `src/utils/` is an empty directory.

**`test:coverage` script broken — `@vitest/coverage-v8` not installed**

File: `package.json`

`"test:coverage": "vitest run --coverage"` is defined, but `@vitest/coverage-v8` is absent from `devDependencies`. Running it fails immediately: `MISSING DEPENDENCY Cannot find dependency '@vitest/coverage-v8'`. Fix: `npm install -D @vitest/coverage-v8`.

---

### LOW

**README does not document the `ANTHROPIC_API_KEY` prerequisite**

Users running annotated recording for the first time will hit an opaque SDK error with no guidance. A Prerequisites section should mention `export ANTHROPIC_API_KEY=...`.

**`src/utils/` and `src/mcp/` directories are empty placeholders**

Both exist as empty directories (git committed). They should either contain the files described in the design doc or be removed.

**`package.json` missing `author` field** — required for `npm publish`.

**No `.nvmrc`** — `engines.node >= 20` is declared but without a companion version lockfile for `nvm`/`fnm` users.

**`src/config/types.ts` absent** — design doc §3 lists it as a separate file, but types are currently inlined into `schema.ts`. Not a blocker; just undone design doc alignment.

---

## Action Items for Work Agent (prioritized)

Each item should be a separate commit. In priority order:

1. **[CRITICAL] Implement `src/mcp/server.ts` and `serve` CLI command**
   - `npm install @modelcontextprotocol/sdk`
   - Create `src/mcp/server.ts` implementing `demo_recorder_record` tool (inputSchema from design doc §5.1, response from §5.2)
   - Register `serve` command in `src/cli.ts` that starts the server in stdio transport
   - This unblocks agent integration via MCP and resolves the CRITICAL broken-contract issue

2. **[HIGH] Add `ANTHROPIC_API_KEY` guard in `annotateFrames`**
   - In `src/pipeline/annotator.ts` before `new Anthropic()`, throw if `ANTHROPIC_API_KEY` is absent
   - One-liner fix with immediate UX impact

3. **[HIGH] Replace `execSync` with async in `src/index.ts:63–64`**
   - Copy the Promise-wrapped `execFile` pattern already used in `vhs-runner.ts`

4. **[HIGH] Add retry logic to `annotateFrames`**
   - Wrap `client.messages.create()` in a 3-attempt loop with 500ms/1000ms/2000ms backoff
   - Re-throw on exhaustion

5. **[HIGH] Implement `--adhoc` recording mode**
   - Add `--adhoc`, `--command`, `--steps` to the `record` command parser in `src/cli.ts`
   - Parse comma-separated step tokens (e.g., `"j,j,Enter,sleep:2s,q"`) into `Step[]`
   - Construct a minimal in-memory `Config` with the provided command/steps

6. **[HIGH] Implement `last` and `init` commands**
   - `last`: read `config.output.dir/latest` symlink, print paths and summary from `report.json`
   - `init`: write a templated `demo-recorder.yaml` starter to cwd (copy from `examples/`)

7. **[MEDIUM] Fix `drawtext` timing for non-default `extract_fps`**
   - Add `extractFps: number` to `PostProcessOptions`
   - Pass `config.annotation.extract_fps` at the call site in `src/index.ts`
   - Divide frame indices by `extractFps` in `buildDrawTextFilters`

8. **[MEDIUM] Install `@vitest/coverage-v8` and add tests**
   - `npm install -D @vitest/coverage-v8`
   - Add tests for `loadConfig`/`findScenario`, `annotateFrames` (mock SDK), `postProcess`, `runVhs`, CLI handlers
   - Target ≥ 80% statement coverage

9. **[MEDIUM] Remove or implement `handlebars`**
   - Either `npm uninstall handlebars && rmdir templates/` or implement `templates/tape.hbs` and wire it into `tape-builder.ts`

10. **[MEDIUM] Move root `demo-recorder.yaml` to `examples/e2e-test.yaml`**
    - Add `demo-recorder.yaml` to `.gitignore`
    - Prevents config hijacking for repo cloners

11. **[MEDIUM] Fix in-place mutation in `src/cli.ts:24`**
    - Replace `config.annotation.enabled = false` with immutable spread

12. **[MEDIUM] Create `src/utils/logger.ts`**
    - Simple structured logger abstraction over `console.log`/`console.error`
    - Use throughout the pipeline so MCP callers can suppress output

---

## Code Quality Notes

### `src/config/schema.ts` — Excellent
Zod schema with proper typed exports, sensible defaults, correct `min(1)` guard on scenarios. Zero `any`. The Zod-inferred types are well-named and complete. 61 lines, focused.

### `src/config/loader.ts` — Good
Async file read, clean Zod parse, useful `findScenario` with available-names feedback. 26 lines, minimal. The only concern is no handling for YAML parse errors from the `yaml` library (they bubble up as raw YAML error messages, not user-friendly).

### `src/pipeline/tape-builder.ts` — Good
String array join approach is clean and readable. Key mapping is explicit and correct. `escapeQuotes` is correct. The `sleep` action correctly emits `Sleep ${step.value}` (the explicit VHS duration) then also `Sleep ${step.pause}` — this double-sleep on `sleep` steps may or may not match intent (a `sleep` step plus a pause after it). This edge case should be considered: should `sleep` steps also emit `Sleep ${step.pause}`? At 88 lines it is slightly over the 50-line guideline but remains readable.

### `src/pipeline/vhs-runner.ts` — Good
Async `execFile` with 120s timeout, stderr forwarding, tape written before execution. The regex `/^Output\s+"?([^"]+)"?$/m` to extract the output path is slightly fragile (does not handle paths with internal quotes or unusual whitespace) but is fine for generated tape content.

### `src/pipeline/frame-extractor.ts` — Good
Async `execFile`, 60s timeout. Dynamic `import('node:fs/promises')` inside the function body (line 34) is unnecessary — `readdir` can be imported at the top of the file like `mkdir` already is. Minor: no error wrapper specifying which video path failed.

### `src/pipeline/annotator.ts` — Functional but fragile
The happy path is correct. Problems: (1) no `ANTHROPIC_API_KEY` guard; (2) no retry; (3) API errors are propagated raw (only JSON parse errors are caught). Frame count is passed but timestamp calculation (`Math.floor((i - 1) / 60)` for minutes) implicitly assumes `extract_fps = 1` — at fps=2, frame 120 represents second 60, not minute 2.

### `src/pipeline/post-processor.ts` — Good with one known bug
`buildBarFilter`, `escapeFfmpegText`, `groupFramesByAnnotation` are all well-factored helper functions. The `drawtext` timing bug (using frame index as seconds without dividing by `extractFps`) is clearly scoped and easy to fix. The `runFfmpeg` wrapper is clean and consistent with the pattern in other modules.

### `src/index.ts` — Functional but oversized
The `record()` function at 126 lines is the most structurally problematic file. The 8 inline phase comments act as natural refactor boundaries. `execSync` must be replaced. The `latest` symlink logic (try `unlink`, catch, then `symlink`) is correct but could be extracted. The `featuresDemo` dedup using `[...new Set(...)]` is idiomatic and correct.

### `src/cli.ts` — Partial
`record`, `list`, `validate` are correctly implemented. `--adhoc`, `last`, `init`, and `serve` are absent despite being in `README.md`. The in-place mutation at line 24 is a clear violation. Error handling is consistent: all commands use try/catch and `process.exit(1)`.

### `test/tape-builder.test.ts` — Good
5 tests covering setup/steps generation, setup absence, repeat, special key mapping, and sleep action. Well-structured `describe`/`it` blocks. Could benefit from an escape-quotes test case.

### `test/config-schema.test.ts` — Good
6 tests covering valid parse, defaults, scenarios validation, project name requirement, step action enum, and setup commands. Comprehensive for the schema layer.

---

## Test Coverage

- **Files with tests**: `src/pipeline/tape-builder.ts`, `src/config/schema.ts`
- **Files with no tests**: `src/config/loader.ts`, `src/pipeline/vhs-runner.ts`, `src/pipeline/frame-extractor.ts`, `src/pipeline/annotator.ts`, `src/pipeline/post-processor.ts`, `src/index.ts`, `src/cli.ts`
- **Test count**: 11 (all pass)
- **Coverage tooling**: broken — `@vitest/coverage-v8` absent, `npm run test:coverage` fails at startup
- **Estimated statement coverage**: ~15–20% (2 of 9 source files covered)
- **Required minimum**: 80%
- **Gap**: ~60–65 percentage points below minimum

---

## Review Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 1     | block  |
| HIGH     | 5     | warn   |
| MEDIUM   | 8     | info   |
| LOW      | 5     | note   |

Verdict: BLOCK — 1 CRITICAL (`serve` command/ MCP server advertised but absent), 5 HIGH issues unaddressed. Phase 1 core pipeline is solid and commits cleanly. Phase 2 features (MCP, ad-hoc, `last`, `init`) are entirely absent despite being documented in README as available. Work agent should immediately begin implementing MCP server (item 1) and the HIGH-severity fixes (items 2–6).
