# auto-demo-recorder

On-demand terminal & browser demo recording + AI annotation CLI tool, callable by agents or humans.

## Features

- **Terminal recording**: Record CLI/TUI sessions as MP4 or GIF using VHS
- **Browser recording**: Record web UI sessions using Playwright (chromium/firefox/webkit)
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
# For terminal recording
brew install vhs ffmpeg

# For browser recording (install Playwright browsers)
npx playwright install
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
demo-recorder init                 # terminal recording template
demo-recorder init --browser       # browser recording template
demo-recorder init --from-existing # auto-detect project type
```

Supported auto-detection: Node.js (package.json), Rust (Cargo.toml), Go (go.mod), Python (pyproject.toml/setup.py), Make (Makefile).

### Terminal Recording

```bash
# In your project directory (with demo-recorder.yaml)
demo-recorder record
demo-recorder record --scenario basic-navigation
demo-recorder record --format gif          # GIF for README embedding
demo-recorder record --no-annotate         # skip AI annotation
demo-recorder record --quiet               # suppress progress output
```

### Browser Recording

```bash
# Using config file with browser_scenarios
demo-recorder record --backend browser
demo-recorder record --backend browser --scenario homepage

# Ad-hoc browser recording
demo-recorder record --adhoc --backend browser \
  --url "http://localhost:3000" \
  --steps "click:#login-btn,fill:#email=user@test.com,click:#submit,sleep:2s"
```

### Ad-hoc recording (terminal)

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
demo-recorder list       # List available scenarios (terminal + browser)
demo-recorder validate   # Validate config file
demo-recorder last       # Show last recording info
demo-recorder serve      # Start MCP server for agent integration
```

## Configuration

### Terminal Recording Config

```yaml
project:
  name: my-cli-tool
  description: "My CLI/TUI project"
  build_command: "make build"

recording:
  backend: vhs          # default
  width: 1200
  height: 800
  font_size: 16
  theme: "Catppuccin Mocha"
  fps: 25
  max_duration: 60

scenarios:
  - name: "basic"
    description: "Basic interaction"
    setup:
      - "./my-tool init"
    steps:
      - { action: "type", value: "./my-tool", pause: "2s" }
      - { action: "key", value: "j", pause: "500ms" }
      - { action: "key", value: "q", pause: "500ms" }
```

### Browser Recording Config

```yaml
project:
  name: my-web-app
  description: "My web application"
  build_command: "npm run build"

recording:
  backend: browser
  browser:
    headless: true
    browser: chromium    # or firefox, webkit
    viewport_width: 1280
    viewport_height: 720
    timeout_ms: 30000
    device_scale_factor: 1
    record_video: true

browser_scenarios:
  - name: "login-flow"
    description: "User login flow"
    url: "http://localhost:3000"
    steps:
      - { action: "click", value: "#login-btn", pause: "1s" }
      - { action: "fill", value: "#email", text: "user@test.com", pause: "500ms" }
      - { action: "fill", value: "#password", text: "secret", pause: "500ms" }
      - { action: "click", value: "#submit", pause: "2s" }
      - { action: "wait", value: ".dashboard", pause: "1s" }
      - { action: "screenshot", value: "dashboard.png" }
```

### Browser Step Actions

| Action | Value | Text | Description |
|--------|-------|------|-------------|
| `navigate` | URL | — | Navigate to a URL |
| `click` | CSS selector | — | Click an element |
| `fill` | CSS selector | text to fill | Fill an input field |
| `type` | text | — | Type text via keyboard |
| `key` | key name | — | Press a key (Enter, Tab, etc.) |
| `sleep` | duration | — | Wait (e.g., "2s", "500ms") |
| `scroll` | pixels | — | Scroll vertically |
| `hover` | CSS selector | — | Hover over an element |
| `select` | CSS selector | option value | Select from dropdown |
| `screenshot` | filename | — | Take a screenshot |
| `wait` | CSS selector | — | Wait for element to appear |

See [examples/demo-recorder.yaml](examples/demo-recorder.yaml) for a complete example.

## Output

Recordings are saved to `.demo-recordings/` with this structure:

```
.demo-recordings/
├── latest -> 2026-04-11_14-30/
└── 2026-04-11_14-30/
    ├── session-report.json          # combined report (multi-scenario runs)
    ├── basic-navigation/
    │   ├── raw.mp4                  # terminal: mp4/gif, browser: webm
    │   ├── annotated.mp4
    │   ├── thumbnail.png
    │   └── report.json
    └── login-flow/
        ├── raw.webm
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

The MCP tool `demo_recorder_record` supports both `vhs` and `browser` backends via the `backend` parameter.

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

Go to Actions > Demo Recording > Run workflow. Optionally specify a scenario name.

## Programmatic API

```typescript
import { record, recordBrowser, loadConfig } from 'auto-demo-recorder';

// Terminal recording
const config = await loadConfig('demo-recorder.yaml');
const result = await record({ config, scenario: config.scenarios[0], projectDir: '.' });

// Browser recording
const browserResult = await recordBrowser({
  config,
  scenario: config.browser_scenarios[0],
  projectDir: '.',
});
```

## License

MIT
