# Review 010 — 2026-04-11T04:30 UTC+8

## Status: IN_PROGRESS

## Score: 55/100

## Summary

No new commits since review 009. The work agent has not acted on any of the 11 open issues. The codebase is byte-for-byte identical to commit `5a55a88` ("feat: initial project scaffold with Phase 1 MVP pipeline"). Score holds at 55/100 — no regression, no progress.

This is the second consecutive cycle where the source code is committed but nothing has been fixed. The action list below is identical to review 009 and must be completed before the score can advance.

---

## Delta from Review 009

- Fixed: nothing
- New issues: none
- Regressions: none
- Score change: 55 → 55 (no change)

---

## What's Working

Same as review 009:

- Phase 1 pipeline is architecturally sound (tape-builder → vhs-runner → frame-extractor → annotator → post-processor)
- Config schema (Zod-based, strict types, zero `any`, correct defaults)
- Config loader (async YAML read, Zod parse, useful missing-scenario error)
- Tape builder generates correct VHS `.tape` syntax, handles Hide/Show, repeat, key mapping
- VHS runner: async `execFile`, 120s timeout, stderr forwarding
- Frame extractor: correct `ffmpeg fps=N` filter, 60s timeout, async `execFile`
- AI annotator: Claude Vision SDK, base64 encoding, graceful JSON parse fallback per frame
- Post-processor: `drawbox` + `drawtext` filter chain, frame grouping for efficiency
- CLI `record`, `list`, `validate` commands correctly wired
- 11 unit tests (5 tape-builder, 6 config-schema) pass
- TypeScript compiles clean (`tsc --noEmit`)
- `dist/` compiled output present

---

## Issues Found

### CRITICAL

**[CRITICAL] `serve` command advertised but not implemented**

File: `src/cli.ts`, `README.md:49`

`README.md` documents `demo-recorder serve` as a working command. `src/cli.ts` registers only `record`, `list`, and `validate`. Running `demo-recorder serve` causes commander to print an error and exit 1. The MCP server file `src/mcp/server.ts` does not exist.

```
// README.md advertises:
demo-recorder serve      # Start MCP server

// src/cli.ts registers:
program.command('record') ...
program.command('list') ...
program.command('validate') ...
// serve is absent
```

This is a broken public contract. Every agent or human who reads the README and runs `serve` gets an error. Either implement the `serve` command and `src/mcp/server.ts`, or remove the references from the README until it is ready.

---

### HIGH

**[HIGH] `--adhoc` flag documented but not implemented**

File: `src/cli.ts`, `README.md:38-41`

`README.md` documents:
```bash
demo-recorder record --adhoc \
  --command "./my-tui" \
  --steps "j,j,j,Enter,sleep:2s,q"
```

The `record` command in `src/cli.ts` defines only `-c/--config`, `-s/--scenario`, and `--no-annotate`. There is no `--adhoc`, `--command`, or `--steps` option. Running with these flags silently ignores them. Per the design doc (section 2.2), ad-hoc mode is a first-class invocation path.

**[HIGH] `last` CLI command missing**

File: `src/cli.ts`, `README.md:49`

`demo-recorder last` is documented in the README but not registered in `src/cli.ts`. Commander will error.

**[HIGH] No `ANTHROPIC_API_KEY` guard in annotator**

File: `src/pipeline/annotator.ts:32`

```typescript
const client = new Anthropic();
```

`new Anthropic()` will throw an opaque SDK error when `ANTHROPIC_API_KEY` is not set. There is no early check with a user-friendly message. The fix is a startup guard:

```typescript
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required for annotation');
}
const client = new Anthropic();
```

**[HIGH] `execSync` blocks the event loop in `src/index.ts`**

File: `src/index.ts:63-65`

```typescript
const { execSync } = await import('node:child_process');
execSync(config.project.build_command, { cwd: projectDir, stdio: 'inherit' });
```

`execSync` is synchronous and blocks the Node.js event loop for the full duration of the build command. All other async modules in the codebase use async `execFile`. Replace with the already-imported `execFile` wrapped in a Promise, matching the pattern used by `vhs-runner.ts` and `frame-extractor.ts`.

**[HIGH] No retry logic in annotator for API failures**

File: `src/pipeline/annotator.ts:58-73`

The annotator makes one API call per frame in a bare `await client.messages.create(...)` with no retry on transient failures (rate limit, 529, network timeout). A recording with 60 frames at 1fps results in 60 serial API calls; a single transient failure aborts the entire annotation run. Add exponential backoff with at least 3 retries for 429/529/network errors.

---

### MEDIUM

**[MEDIUM] `handlebars` dependency unused, `templates/` directory empty**

File: `package.json:29`, `templates/`

`handlebars` is listed as a production dependency (adds ~1.5 MB to install) but is never imported anywhere in `src/`. The `templates/` directory is empty. Either use it (the tape builder currently builds strings manually) or remove the dependency and directory.

**[MEDIUM] `test:coverage` script will fail — `@vitest/coverage-v8` not installed**

File: `package.json:17`, `package.json:33-36`

```json
"test:coverage": "vitest run --coverage"
```

Running coverage requires `@vitest/coverage-v8` or `@vitest/coverage-istanbul` as a dev dependency. Neither is present. The script will fail with a "missing coverage provider" error.

**[MEDIUM] Test coverage is approximately 15% — far below the 80% minimum**

File: `test/`

Only 11 tests exist across 2 files (`tape-builder.test.ts`, `config-schema.test.ts`). The following source modules have zero test coverage:

- `src/cli.ts`
- `src/index.ts` (the main `record` orchestration function)
- `src/pipeline/vhs-runner.ts`
- `src/pipeline/frame-extractor.ts`
- `src/pipeline/annotator.ts`
- `src/pipeline/post-processor.ts`
- `src/config/loader.ts`

The project rules require 80% minimum. Tests for the pipeline modules should use mocked child_process and filesystem calls.

**[MEDIUM] `drawtext` timing is wrong when `extract_fps != 1`**

File: `src/pipeline/post-processor.ts:49-53`

```typescript
const startTime = group.startIndex;
const endTime = group.endIndex + 1;
```

`frame.index` is a zero-based frame sequence number, not a time in seconds. `between(t, startTime, endTime)` in ffmpeg's `drawtext` filter interprets the values as **seconds**. When `extract_fps = 1` (default), frame index happens to equal seconds, so this works by coincidence. When `extract_fps = 0.5` (one frame every 2 seconds), frame 0 → t=0s, frame 1 → t=2s, etc. — but the filter will use `between(t,0,1)` and `between(t,1,2)` instead of `between(t,0,2)` and `between(t,2,4)`. The correct conversion is:

```typescript
const startTime = group.startIndex / extractFps;
const endTime = (group.endIndex + 1) / extractFps;
```

`extractFps` needs to be threaded through from the annotation config to `buildDrawTextFilters`.

**[MEDIUM] `annotator.ts` timestamp calculation assumes `extract_fps = 1`**

File: `src/pipeline/annotator.ts:39`

```typescript
const timestamp = `${Math.floor((i - 1) / 60)}:${String((i - 1) % 60).padStart(2, '0')}`;
```

This assumes one frame per second (treating frame index as seconds). If `extract_fps = 2`, frame 120 is actually at t=60s, but the formula gives `2:00` (correct by coincidence) only because `(i-1)/60` is the minute component assuming 1fps. The correct calculation is:

```typescript
const secondsElapsed = (i - 1) / config.extract_fps;
const minutes = Math.floor(secondsElapsed / 60);
const seconds = Math.floor(secondsElapsed % 60);
const timestamp = `${minutes}:${String(seconds).padStart(2, '0')}`;
```

**[MEDIUM] Unnecessary dynamic `readdir` import in `frame-extractor.ts`**

File: `src/pipeline/frame-extractor.ts:34`

```typescript
const { readdir } = await import('node:fs/promises');
```

`readdir` is a stable Node.js built-in. There is no reason for a dynamic import here. `readdir` should be added to the static import at line 2 alongside `mkdir`.

**[MEDIUM] Double sleep on `sleep` action in `tape-builder.ts`**

File: `src/pipeline/tape-builder.ts:48-51`

```typescript
case 'sleep':
  lines.push(`Sleep ${step.value}`);
  break;
// falls through to:
lines.push(`Sleep ${step.pause}`);
```

Every action unconditionally appends `Sleep ${step.pause}` after the switch block. For a `sleep` action, this produces two consecutive `Sleep` directives — e.g., `Sleep 3s` followed by `Sleep 500ms`. This is almost certainly unintended; a sleep action is itself a pause and adding `step.pause` on top doubles it. The `sleep` case should either skip emitting the extra pause line or `step.pause` should be zero/empty for sleep steps.

---

### LOW

**[LOW] Profuse `console.log` in production code**

Files: `src/index.ts` (8+ calls), `src/pipeline/annotator.ts:105`, `src/pipeline/vhs-runner.ts:26`

The project rules prohibit `console.log` in production code. A proper logger (pino, winston) or a simple structured log utility should be used instead.

**[LOW] `bin/demo-recorder.ts` compiled as TypeScript but shipped as `.js`**

File: `package.json:7`, `bin/demo-recorder.ts`

`package.json` maps the `bin` entry to `./dist/bin/demo-recorder.js`, which is the compiled output — this is correct. The source file is `bin/demo-recorder.ts`. Confirm `tsconfig.json` includes `bin/` in its output directory.

---

## Action Items for Work Agent (prioritized)

1. **[CRITICAL]** Implement `src/mcp/server.ts` and register the `serve` command in `src/cli.ts`, OR remove `serve` from `README.md` if MCP is out of scope for the current milestone.

2. **[HIGH]** Implement `--adhoc` mode in the `record` command: parse `--command` and `--steps` args, synthesize a Scenario object from them, and pass it to `record()`.

3. **[HIGH]** Register the `last` command in `src/cli.ts`: reads `.demo-recordings/latest/` and prints the summary from `report.json`.

4. **[HIGH]** Add `ANTHROPIC_API_KEY` guard at the top of `annotateFrames` in `src/pipeline/annotator.ts`.

5. **[HIGH]** Replace `execSync` in `src/index.ts:63-65` with async `execFile` (wrapped in a Promise), matching the pattern in `vhs-runner.ts`.

6. **[HIGH]** Add retry logic (3 retries, exponential backoff) to the API call in `src/pipeline/annotator.ts:58-73`.

7. **[MEDIUM]** Fix double-sleep bug in `src/pipeline/tape-builder.ts`: skip appending `Sleep ${step.pause}` when `step.action === 'sleep'`.

8. **[MEDIUM]** Fix `drawtext` timing in `src/pipeline/post-processor.ts`: divide frame indices by `extract_fps` to get seconds.

9. **[MEDIUM]** Fix timestamp calculation in `src/pipeline/annotator.ts:39` to use `extract_fps` from config.

10. **[MEDIUM]** Add `@vitest/coverage-v8` to `devDependencies` so `test:coverage` works.

11. **[MEDIUM]** Write tests for untested modules (target: 80% overall coverage). Highest value: `tape-builder` edge cases, `config/loader.ts`, `post-processor` filter building, `annotator` response parsing.

12. **[MEDIUM]** Remove `handlebars` from `package.json` dependencies (unused, `templates/` is empty).

13. **[MEDIUM]** Replace dynamic `import('node:fs/promises')` in `frame-extractor.ts:34` with a static import.

---

## Code Quality Notes

- All existing source files are within the 800-line limit (largest is `src/index.ts` at 169 lines)
- TypeScript types are well-defined with no `any` usage
- Zod schema pattern is correct and idiomatic
- The `groupFramesByAnnotation` function in `post-processor.ts` correctly avoids mutation — current object is replaced, not mutated in place
- The double-sleep issue in `tape-builder.ts` is a logic bug, not a style issue

---

## Test Coverage

| Module | Tests | Coverage estimate |
|--------|-------|-------------------|
| `src/config/schema.ts` | 6 (config-schema.test.ts) | ~85% |
| `src/pipeline/tape-builder.ts` | 5 (tape-builder.test.ts) | ~80% |
| `src/config/loader.ts` | 0 | 0% |
| `src/cli.ts` | 0 | 0% |
| `src/index.ts` | 0 | 0% |
| `src/pipeline/vhs-runner.ts` | 0 | 0% |
| `src/pipeline/frame-extractor.ts` | 0 | 0% |
| `src/pipeline/annotator.ts` | 0 | 0% |
| `src/pipeline/post-processor.ts` | 0 | 0% |

**Overall estimated coverage: ~15%** (requirement: 80%)

---

## Review Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 1     | block  |
| HIGH     | 5     | warn   |
| MEDIUM   | 7     | info   |
| LOW      | 2     | note   |

**Verdict: BLOCK — 1 CRITICAL issue (missing `serve` command breaks public contract) + 5 HIGH issues must be resolved before merge.**

Score: **55/100** — unchanged from review 009. No work has been done since the initial scaffold commit. The pipeline architecture is sound, but advertised features are unimplemented, test coverage is far below threshold, and several correctness bugs remain open.
