# Auto Demo Recorder — Review Process

## Reviewer Role

This `.review/` directory is managed by a **Reviewer Agent** that continuously evaluates the implementation quality of `auto-demo-recorder`.

## Review Cadence

- Every **15 minutes**, the reviewer checks the current state of the project
- Reviews are saved as `review-NNN.md` with timestamps
- Reviews continue for **24 hours**

## Review Criteria

### Functionality
- Does the implementation match the design doc (`.brainstorm/auto-demo-recorder.md`)?
- **CLI commands**: `record`, `list`, `last`, `validate`, `serve`, `init`
- **3 invocation modes**: CLI, MCP Server, Programmatic import
- **Pipeline stages**: tape builder → VHS runner → frame extractor → AI annotator → post-processor
- **Ad-hoc recording**: `--adhoc` flag for configless recording
- **MCP Server**: `demo_recorder_record` tool for agent integration
- Config validation via Zod schemas
- Is error handling comprehensive?

### Code Quality
- Clean, readable TypeScript with consistent style
- No hardcoded values — use config/constants
- Proper error handling at every level
- No dead code or unused variables
- Functions < 50 lines, files < 800 lines
- Immutable patterns preferred

### Design
- Separation of concerns between pipeline stages
- Each module has a single responsibility
- Project structure matches design doc:
  - `src/config/` — loader, schema, types
  - `src/pipeline/` — tape-builder, vhs-runner, frame-extractor, annotator, post-processor
  - `src/mcp/` — MCP server
  - `src/utils/` — ffmpeg helpers, logger
  - `templates/` — Handlebars tape template
- Configuration externalized via YAML + Zod validation
- Simplified storage: timestamped dirs + `latest` symlink (no gallery, no retention policy)

### Testing
- Unit tests for core logic (tape builder, config loader/schema)
- Integration tests for pipeline stages
- Test coverage >= 80%
- Tests are deterministic and isolated

### Git & CI
- Every change committed with conventional commit messages
- Pushed to GitHub remote after each review cycle
- Repository includes README, LICENSE, .gitignore

## Review Lifecycle

```
1. INITIAL    — Project scaffold, no implementation yet
2. MVP        — Core pipeline: record + annotate (Phase 1)
3. GROWING    — Full CLI + MCP server (Phase 2)
4. MATURE     — Multi-scenario, regression detection, tests, docs (Phase 3)
5. BRAINSTORM — Implementation solid, proposing new features/refactors
```

## When Implementation Is Solid

Once no functional or quality issues remain:
1. Brainstorm new features, extensions, or architectural improvements
2. Propose refactoring opportunities
3. Suggest integration with other projects in the workspace
4. Continue review cycle on new changes
