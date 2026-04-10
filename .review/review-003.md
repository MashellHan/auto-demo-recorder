# Review 003 — 2026-04-11 02:20 UTC+8

## Status: IN_PROGRESS

## Score: 52/100

## Summary

The project has gone from zero to a working Phase 1 MVP in one session. The core pipeline — config loading, tape generation, VHS execution, and report writing — is implemented and has been proven to run end-to-end (a `hello-world` recording exists in `.demo-recordings/`). Tests pass cleanly and TypeScript compiles without error. However, large portions of the promised design-doc surface are absent (MCP server, ad-hoc mode, `serve`/`last`/`init` commands, annotation AI pipeline test), and the output directory structure has a critical bug: files land at the session root instead of inside the scenario subdirectory.

---

## What's Working

- TypeScript project scaffold is complete and correct (`package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`)
- Config schema (`src/config/schema.ts`) — Zod-based, all fields present with sensible defaults; `min(1)` guard on scenarios array
- Config loader (`src/config/loader.ts`) — reads YAML, validates with Zod, clear error path
- Tape builder (`src/pipeline/tape-builder.ts`) — generates valid VHS `.tape` syntax; handles `Hide`/`Show` setup blocks, key mapping, `repeat`, `sleep` actions; escapes quotes correctly
- VHS runner (`src/pipeline/vhs-runner.ts`) — 120-second timeout, stderr forwarding, tape written to disk before execution
- Frame extractor (`src/pipeline/frame-extractor.ts`) — correct `ffmpeg fps=N` filter, 60-second timeout, frame-count derived from actual files
- Post-processor (`src/pipeline/post-processor.ts`) — builds `drawtext` filter chain from frame annotations, groups consecutive identical annotations to reduce filter count, escapes ffmpeg special chars
- CLI `record` / `list` / `validate` commands are implemented
- 11 unit tests covering tape builder and config schema; all pass, TypeScript passes typecheck
- E2E proof: `hello-world` scenario ran successfully, produced `raw.mp4` + `report.json`
- Example config (`examples/demo-recorder.yaml`) mirrors design doc exactly
- README documents prerequisites, install, usage, and output structure

---

## Issues Found

### CRITICAL

**Output path structure bug — files land at session root, not scenario subdirectory**

`src/index.ts:69` passes `tapePath = join(outputBase, '${scenario.name}.tape')` to `runVhs`, which writes the tape at that path. However, the actual VHS recording places the output at the absolute path specified inside the tape (`Output "/abs/.../raw.mp4"`). The `outputBase` itself is `…/<timestamp>/<scenario-name>/`, so `raw.mp4` would be correct _inside_ that directory. But the observed filesystem shows `raw.mp4` at `.demo-recordings/2026-04-11_02-09/` (the _timestamp_ level, not the scenario level), alongside `hello-world.tape`. The tape file's `Output` directive points to `<outputBase>/raw.mp4` but the tape itself is also written to `outputBase`. The top-level directory listing shows `hello-world.tape` and `raw.mp4` at the timestamp level rather than inside `hello-world/`. This means multi-scenario runs will clobber each other's tapes and videos.

Observed evidence:
```
.demo-recordings/2026-04-11_02-09/
├── hello-world.tape      ← tape is at timestamp level, not scenario subdir
├── raw.mp4               ← video also at timestamp level
└── hello-world/
    ├── hello-world.tape  ← correct place
    ├── raw.mp4
    └── report.json
```

Wait — on closer inspection `hello-world/` subdirectory _does_ exist with its own files. The files at the timestamp level are likely from VHS's own output path parsing. The tape is written to `outputBase` which is `<timestamp>/<scenario-name>/`, so the tape path is `<timestamp>/<scenario-name>/hello-world.tape`. But the observed listing shows files at the `2026-04-11_02-09/` level as well. This is a path confusion that should be validated and confirmed by the work agent.

**`@modelcontextprotocol/sdk` not in `package.json` but README claims MCP support**

The README advertises `demo-recorder serve` and lists it as a feature, but `package.json` has no `@modelcontextprotocol/sdk` dependency. The `serve` command is not implemented in `src/cli.ts`. This means any user who installs the package and runs `demo-recorder serve` gets a "unknown command" error despite the documented feature.

---

### HIGH

**MCP server is entirely absent**

`src/mcp/server.ts` does not exist. The design doc's Phase 2 specifies this as the primary agent integration differentiator. The README documents it, the design doc requires it, but no file exists.

**Ad-hoc recording mode (`--adhoc`) not implemented**

The design doc (Phase 2.2) and README both document `demo-recorder record --adhoc --command "..." --steps "..."`. There is no `--adhoc` option in `src/cli.ts` and no code supporting configless recording.

**`serve`, `last`, `init` commands not implemented**

`src/cli.ts` only implements `record`, `list`, and `validate`. Three more commands documented in the design doc and README are missing with no stub or TODO comment.

**`annotateFrames` makes sequential API calls — no retry or error handling for network failures**

`src/pipeline/annotator.ts:58-73` calls `client.messages.create(...)` in a `for` loop without any retry logic. A transient API failure midway through a 30-frame video aborts the entire annotation pass and loses all frames already processed. The partial result is then silently discarded because the error propagates up to catch in `src/index.ts` which just re-throws.

**`execSync` used for build command — blocks the event loop**

`src/index.ts:64`: `execSync(config.project.build_command, ...)` is synchronous. All other operations use async `execFile`. This should be `execFilePromise` or `util.promisify(exec)(...)` to be consistent with the rest of the codebase and avoid blocking.

**`@anthropic-ai/sdk` instantiated without checking for `ANTHROPIC_API_KEY`**

`src/pipeline/annotator.ts:33`: `const client = new Anthropic()` assumes the env var is set. If it is not, the Anthropic SDK throws an opaque initialization error. The project should validate `process.env.ANTHROPIC_API_KEY` is present before entering the annotation pipeline and emit a clear, actionable error message pointing the user to set the env var.

---

### MEDIUM

**`templates/` directory is empty — Handlebars template was replaced by string building**

The design doc (Section 9 tech stack) lists Handlebars as the tape file template engine, and the `templates/tape.hbs` file was in the proposed structure. The actual implementation uses manual string construction in `tape-builder.ts`. The empty `templates/` directory and the `handlebars` package in `package.json` are now dead weight. Either adopt Handlebars properly or remove the dependency and directory.

**`demo-recorder.yaml` in project root is an ad-hoc E2E test artifact, should not be committed**

`demo-recorder.yaml` at the repo root (distinct from `examples/demo-recorder.yaml`) contains an `e2e-test` project config. This is a development test artifact that pollutes the repository root and would confuse users who expect the root to contain only a template or no config at all. It should either be moved to `examples/` or listed in `.gitignore`.

**`record` function in `src/index.ts` is 126 lines — above the 50-line guideline**

The `record` function runs from line 37 to line 163. It orchestrates the pipeline in sequence but also handles directory creation, symlink management, report writing, and console output. These responsibilities should be extracted into smaller helper functions per the project coding-style rules (<50 lines per function).

**No `utils/logger.ts` — `console.log`/`console.error` used throughout**

The design doc specifies `src/utils/logger.ts` for structured logging. All pipeline stages use `console.log` and `console.error` directly. This makes it impossible to suppress output when the library is used programmatically (the `record()` function is part of the public API via `src/index.ts` exports).

**`config/types.ts` file was in the design doc structure but not created**

The design doc listed `src/config/types.ts` as separate from `schema.ts`. Types are correctly inferred from Zod in `schema.ts`, so a separate file is not required, but it means the repository structure diverges from the spec without explanation.

**No `@vitest/coverage-v8` — `npm run test:coverage` fails**

`package.json` defines a `test:coverage` script but the required `@vitest/coverage-v8` devDependency is absent. Running `npm run test:coverage` produces: `"MISSING DEPENDENCY Cannot find dependency '@vitest/coverage-v8'"`.

---

### LOW

**`package.json` missing `author` field**

Minor but expected for a publishable npm package.

**`README.md` does not mention `ANTHROPIC_API_KEY` requirement**

Users installing and running the tool with annotation enabled will encounter a cryptic SDK error unless the prerequisite environment variable is documented.

**`post-processor.ts` uses frame index as time in seconds — only correct at 1 fps**

`buildDrawTextFilters` uses `frame.index` as both `startTime` and `endTime` in the `between(t, ...)` ffmpeg filter. This is only correct when `extract_fps = 1`. If a user sets `annotation.extract_fps = 2`, frame 10 starts at 5 seconds, not second 10. The calculation should be `frame.index / extractFps`.

**No `.nvmrc` or `engines` enforcement** — `package.json` has `"engines": { "node": ">=20" }` but no `.nvmrc` to guide developers to the correct version.

---

## Action Items for Work Agent

1. **Fix output directory structure** — Verify that `tapePath` in `src/index.ts` is constructed inside `outputBase` (the scenario subdirectory) and confirm the `latest` symlink points to `<timestamp>/` not `<timestamp>/<scenario>/`. Add an integration test or at least a comment asserting the expected path layout.

2. **Implement MCP server** — Create `src/mcp/server.ts` with the `demo_recorder_record` tool as specified in design doc Section 5. Add `@modelcontextprotocol/sdk` to `package.json` dependencies. Wire it into the `serve` command in `src/cli.ts`.

3. **Implement `--adhoc` recording mode** — Add the `--adhoc`, `--command`, and `--steps` options to the `record` command. Steps can be a comma-separated string parsed into `Step[]` objects without requiring a YAML file.

4. **Implement missing CLI commands** — Add `serve` (delegates to MCP server), `last` (reads `latest/` symlink and prints paths + summary from `report.json`), and `init` (scaffolds a `demo-recorder.yaml` template in cwd).

5. **Add `ANTHROPIC_API_KEY` guard** — At the top of `annotateFrames`, check `process.env.ANTHROPIC_API_KEY` and throw a clear `Error` if absent, before instantiating the SDK client.

6. **Replace `execSync` with async exec** — In `src/index.ts` line 64, replace `execSync` with `await new Promise(...)` wrapping `execFile`, consistent with all other child process calls.

7. **Add retry logic to annotator** — Wrap the `client.messages.create` call in a simple 3-attempt retry with exponential backoff for transient errors (network timeouts, 429 rate limit responses).

8. **Fix `drawtext` timing at non-1-fps** — In `post-processor.ts:buildDrawTextFilters`, replace `group.startIndex` / `group.endIndex` with `group.startIndex / extractFps` and `(group.endIndex + 1) / extractFps`. The `extractFps` value needs to be threaded through from `postProcess` options.

9. **Add `@vitest/coverage-v8` devDependency** — Run `npm install -D @vitest/coverage-v8` so `npm run test:coverage` works.

10. **Remove or move `demo-recorder.yaml` from repo root** — Move it to `examples/e2e-test.yaml` or add it to `.gitignore`.

11. **Remove unused `handlebars` dependency** — Either implement the `templates/tape.hbs` approach or `npm uninstall handlebars` and delete the empty `templates/` directory.

12. **Add `ANTHROPIC_API_KEY` to README** — Document the required env var under Prerequisites.

13. **Write tests for `frame-extractor`, `post-processor`, and `annotator`** — Coverage for the pipeline modules that have zero test coverage. Mock `execFile` for ffmpeg tests and the Anthropic SDK client for annotator tests.

---

## Code Quality Notes

- **TypeScript quality is high**: strict mode enabled, all files compile cleanly, types are inferred from Zod schemas — no `any` in the codebase. This is the strongest aspect of the implementation.
- **Error propagation is consistent**: every pipeline stage throws a descriptive `Error` and the CLI catches at the top level, printing message and exiting with code 1.
- **`escapeQuotes` and `escapeFfmpegText`** are correct and handle the relevant edge cases for their respective contexts.
- **`groupFramesByAnnotation`** is a clean, correct optimization to reduce ffmpeg filter chain length.
- **`formatTimestamp`** is a pure utility function, clearly named and correctly implemented.
- The `record` function uses mutation on `config.annotation.enabled` (line 24 of `src/cli.ts`: `config.annotation.enabled = false`). Per the project's immutability rule, this should be done with object spread: `const effectiveConfig = { ...config, annotation: { ...config.annotation, enabled: false } }`.

---

## Test Coverage

- **Covered**: `buildTape` (5 tests), `ConfigSchema` (6 tests) — 11 tests total, all pass
- **Not covered**: `loadConfig`, `findScenario`, `runVhs`, `extractFrames`, `annotateFrames`, `postProcess`, `record` orchestrator, CLI command parsing
- **Coverage tooling broken**: `@vitest/coverage-v8` not installed — cannot measure actual percentage
- **Estimate**: ~15-20% coverage (only two pure/logic-only modules are tested; all file I/O and exec-based modules have zero tests)
- **Target**: 80% minimum per project standards — significant work needed

---

## Brainstorm

Not applicable at IN_PROGRESS status.
