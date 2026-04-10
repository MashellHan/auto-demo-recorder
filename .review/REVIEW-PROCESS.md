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
- Are all pipeline stages working: tape generation, recording, frame extraction, AI annotation, post-processing?
- Are scenarios configurable via YAML?
- Is error handling comprehensive?

### Code Quality
- Clean, readable code with consistent style
- No hardcoded values — use config/constants
- Proper error handling at every level
- No dead code or unused variables
- Functions < 50 lines, files < 800 lines

### Design
- Separation of concerns between pipeline stages
- Each script/module has a single responsibility
- Configuration is externalized (YAML)
- Storage structure matches the design doc

### Testing
- Unit tests for core logic (tape generation, config parsing)
- Integration tests for pipeline stages
- Test coverage >= 80%
- Tests are deterministic and isolated

### Git & CI
- Every change committed with conventional commit messages
- Pushed to GitHub remote after each review cycle
- Repository includes README, LICENSE, .gitignore

## Review Lifecycle

```
1. INITIAL  — Project scaffold, no implementation yet
2. MVP      — Core pipeline implemented, basic functionality
3. GROWING  — Storage, history, scheduling added
4. MATURE   — Multi-scenario, regression detection, polished
5. BRAINSTORM — Implementation solid, proposing new features/refactors
```

## When Implementation Is Solid

Once no functional or quality issues remain:
1. Brainstorm new features, extensions, or architectural improvements
2. Propose refactoring opportunities
3. Suggest integration with other projects in the workspace
4. Continue review cycle on new changes
