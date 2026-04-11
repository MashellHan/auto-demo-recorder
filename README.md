# auto-demo-recorder

On-demand terminal demo recording + AI annotation CLI tool, callable by agents or humans.

## Features

- Record terminal/TUI sessions as MP4 or GIF videos using VHS
- AI-powered frame analysis and annotation via Claude Vision
- Configurable scenarios via YAML
- CLI tool + MCP server for agent integration
- Ad-hoc recording mode (no config needed)
- Regression detection between recordings
- Session report: combined `session-report.json` for multi-scenario runs
- Language-aware annotations (configurable via `annotation.language`)
- Watch mode: auto-record on source file changes
- CI/CD GitHub Action: record demos on PR, upload artifacts, post regression summary

## Prerequisites

```bash
brew install vhs ffmpeg
```

Set your Anthropic API key for AI annotation:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Annotation can be disabled with `--no-annotate` if no API key is available.

## Install

```bash
npm install -g auto-demo-recorder
```

## Usage

### Initialize a project

```bash
demo-recorder init                 # generates demo-recorder.yaml template
demo-recorder init --from-existing # auto-detect project type and generate config
```

Supported auto-detection: Node.js (package.json), Rust (Cargo.toml), Go (go.mod), Python (pyproject.toml/setup.py), Make (Makefile).

### Record with config

```bash
# In your project directory (with demo-recorder.yaml)
demo-recorder record
demo-recorder record --scenario basic-navigation
demo-recorder record --format gif          # GIF for README embedding
demo-recorder record --no-annotate         # skip AI annotation
demo-recorder record --quiet               # suppress progress output
```

### Ad-hoc recording

```bash
demo-recorder record --adhoc \
  --command "./my-tui" \
  --steps "j,j,j,Enter,sleep:2s,q"
```

### Compare recordings for regressions

```bash
demo-recorder diff path/to/baseline/report.json path/to/current/report.json
```

Exit code 1 if regressions detected — suitable for CI pipelines.

### Watch mode

```bash
demo-recorder watch                        # watch all scenarios
demo-recorder watch --scenario basic       # watch specific scenario
```

Monitors source files for changes and auto-records. Configure patterns in `demo-recorder.yaml`:

```yaml
watch:
  include: ["src/**/*"]
  exclude: ["node_modules/**", "dist/**", ".demo-recordings/**"]
  debounce_ms: 500
```

### Other commands

```bash
demo-recorder list       # List available scenarios
demo-recorder validate   # Validate config file
demo-recorder last       # Show last recording info
demo-recorder serve      # Start MCP server for agent integration
```

## Configuration

Create `demo-recorder.yaml` in your project root:

```bash
demo-recorder init
```

See [examples/demo-recorder.yaml](examples/demo-recorder.yaml) for a complete example.

## Output

Recordings are saved to `.demo-recordings/` with this structure:

```
.demo-recordings/
├── latest -> 2026-04-11_14-30/
└── 2026-04-11_14-30/
    ├── session-report.json          # combined report (multi-scenario runs)
    ├── basic-navigation/
    │   ├── raw.mp4
    │   ├── annotated.mp4
    │   ├── thumbnail.png
    │   └── report.json
    └── advanced-features/
        ├── raw.mp4
        ├── annotated.mp4
        ├── thumbnail.png
        └── report.json
```

When multiple scenarios are recorded in a single run, a `session-report.json` is written at the timestamp directory level with combined metrics (overall status, total bugs, total duration, per-scenario summaries).

Auto-regression: when a previous recording exists for the same scenario, `record` automatically compares reports and includes regression info in the result.

## MCP Server

For agent integration (Claude Code, Cursor, etc.):

```json
{
  "mcpServers": {
    "demo-recorder": {
      "command": "npx",
      "args": ["auto-demo-recorder", "serve"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

## CI/CD Integration

A ready-to-use GitHub Actions workflow is included at `.github/workflows/demo-record.yml`.

### Setup

1. Add `ANTHROPIC_API_KEY` as a repository secret (optional — annotation is skipped if missing)
2. The workflow runs on every PR (opened, synchronized) and can be triggered manually

### What it does

- Installs VHS + ffmpeg on Ubuntu runner
- Runs `demo-recorder record` for all scenarios (or a specific one via manual trigger)
- Runs regression checks against previous recordings
- Uploads recordings as GitHub Actions artifacts (14-day retention)
- Posts a sticky PR comment with recording results and regression summary

### Manual trigger

Go to Actions → Demo Recording → Run workflow. Optionally specify a scenario name.

## License

MIT
