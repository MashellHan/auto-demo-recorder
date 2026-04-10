# Review 018 — 2026-04-11 05:40 UTC+8

## Status: BRAINSTORM

## Score: 93/100

## Summary

Project is feature-complete and stable. Last change was `record()` decomposition into 6 focused functions. All 50 tests pass, 89.4% statement coverage, TypeScript compiles clean. No regressions since review 017. A few minor code hygiene items discovered during deep scan. Entering brainstorm phase with concrete implementation proposals.

## Delta from Review 017
- **No code changes** since last review
- **Score**: unchanged at 93/100
- **New findings**: 2 LOW issues discovered (unused import, missing examples dir)

## What's Working
- Full CLI: 6 commands (`record`, `list`, `validate`, `last`, `init`, `serve`)
- Ad-hoc recording mode with smart step parsing
- MCP server with `demo_recorder_record` tool
- Pipeline: tape-builder → VHS runner → frame-extractor → annotator → post-processor
- Config: Zod validation with sensible defaults
- AI annotation: Claude Vision with retry/backoff, API key guard
- Post-processing: ffmpeg drawtext overlay with correct fps-aware timing
- Decomposed `record()` — 6 focused functions, main function 30 lines
- 50 tests across 10 files, 89.4% coverage
- TypeScript strict mode, zero `any`

## Issues Found

### CRITICAL
- None

### HIGH
- None

### MEDIUM
- None

### LOW
1. **Unused `existsSync` import in `src/index.ts:5`** — imported but never used after the `record()` decomposition. Should be removed.
2. **`examples/` directory missing** — README references `examples/demo-recorder.yaml` but the directory doesn't exist. Either create the directory with a sample config or remove the reference.
3. **`language` config field unused** — `AnnotationConfig` accepts a `language` field (design doc shows `language: "zh"`) but the annotator prompt doesn't include it. Annotations will always be in English regardless of the config.
4. **`console.log` throughout src/** — acceptable for v1 CLI output format per design doc section 4.2, but a structured logger would be better for library consumers who import `record()` programmatically.

## Design Doc Compliance

All Phase 1 and Phase 2 features are implemented. Phase 3 partial:

| Phase 3 Feature | Status |
|---|---|
| 3.1 Multi-scenario recording | **DONE** (records all scenarios when no `--scenario` flag) |
| 3.2 Regression detection | NOT STARTED |
| 3.3 Improved annotation overlay | NOT STARTED (fade, status indicator, red border) |
| 3.4 Unit + integration tests | **DONE** (89.4% coverage) |
| 3.5 README + example configs | PARTIAL (README exists, examples/ dir missing) |
| 3.6 npm publish setup | NOT STARTED |

## Test Coverage

```
All files        89.4% stmts | 81.1% branch | 100% funcs | 89.4% lines
src/config/      100%  stmts | 87.5% branch | 100% funcs | 100%  lines
src/pipeline/    94.8% stmts | 79.3% branch | 100% funcs | 94.8% lines
src/index.ts     99.3% stmts | 97.2% branch | 100% funcs | 99.3% lines
src/mcp/         85.3% stmts | 71.4% branch | 100% funcs | 85.3% lines
src/cli.ts       75.5% stmts | 67.9% branch | 100% funcs | 75.5% lines
```

## Action Items for Work Agent

### Quick Fixes (5 min)
1. Remove unused `existsSync` import from `src/index.ts:5`
2. Pass `config.language` to the annotator Claude prompt (e.g., add `Respond in ${config.language}.` to the prompt)
3. Create `examples/demo-recorder.yaml` with the sample config from the design doc (section 6.1)

### Phase 3 Features (brainstorm below)
4. Implement regression detection (Phase 3.2)
5. Add npm publish setup (Phase 3.6)
6. Add GIF output option

## Code Quality Notes
- Architecture is clean and well-separated — each pipeline module has a single responsibility
- Zod schemas provide excellent runtime validation with type inference
- Retry logic in annotator is clean with exponential backoff
- `record()` decomposition improved readability significantly
- MCP server follows standard SDK patterns
- Error handling is explicit with descriptive messages throughout

## Brainstorm: Implementation Proposals

### Proposal 1: Language-Aware Annotations (LOW effort, HIGH value)
The `language` field exists in config but isn't used. Add it to the prompt:
```
Respond in ${config.language}. All text fields should be in ${config.language}.
```
This enables Chinese/Japanese/Korean annotations for non-English projects — a key differentiator since the design doc explicitly shows `language: "zh"`.

### Proposal 2: GIF Output (MEDIUM effort, HIGH value)
Add `--format gif` flag. VHS natively supports GIF via `Output "file.gif"`. Changes:
- Add `format` field to `RecordingConfig` schema (default: `mp4`)
- Modify `tape-builder.ts` to use `.gif` extension when format is `gif`
- Skip post-processing for GIF (annotation overlay on GIF is complex)
- Most README demo videos are GIFs — this enables direct embedding

### Proposal 3: Regression Detection (HIGH effort, HIGH value — Phase 3.2)
Compare consecutive recording reports to detect regressions:
- `demo-recorder diff <report-a> <report-b>` CLI command
- Compare frame annotations: new bugs, quality degradation, missing features
- Output diff report with severity scoring
- Could use Claude to compare two frame sets and identify changes

### Proposal 4: npm Publish Setup (LOW effort, MEDIUM value — Phase 3.6)
- Add `files` field to package.json: `["dist/", "README.md", "LICENSE"]`
- Add `prepublishOnly: "npm run build"` script
- Add `.npmignore` or rely on `files` field
- Test with `npm pack --dry-run`
- Verify `bin` field works after build

### Proposal 5: CI/CD Recording GitHub Action (HIGH effort, HIGH value)
- Create `.github/workflows/demo-record.yml`
- On PR: record scenarios, upload annotated video as artifact
- Post video preview as PR comment using `gh api`
- Enables visual regression review in PRs

### Priority Recommendation
1. **Language-aware annotations** — 10 minutes, fixes a design doc gap
2. **npm publish setup** — 15 minutes, makes package distributable
3. **GIF output** — 30 minutes, high-impact for README embedding
4. **Regression detection** — 2+ hours, most complex but Phase 3 goal
5. **CI/CD action** — 2+ hours, best after npm publish is ready
