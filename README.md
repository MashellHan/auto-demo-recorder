# auto-demo-recorder

On-demand terminal demo recording + AI annotation CLI tool, callable by agents or humans.

## Features

- Record terminal/TUI sessions as MP4 videos using VHS
- AI-powered frame analysis and annotation via Claude Vision
- Configurable scenarios via YAML
- CLI tool + MCP server for agent integration
- Ad-hoc recording mode (no config needed)

## Prerequisites

```bash
brew install vhs ffmpeg
```

## Install

```bash
npm install -g auto-demo-recorder
```

## Usage

### Record with config

```bash
# In your project directory (with demo-recorder.yaml)
demo-recorder record
demo-recorder record --scenario basic-navigation
```

### Ad-hoc recording

```bash
demo-recorder record --adhoc \
  --command "./my-tui" \
  --steps "j,j,j,Enter,sleep:2s,q"
```

### Other commands

```bash
demo-recorder list       # List available scenarios
demo-recorder validate   # Validate config file
demo-recorder last       # Show last recording info
demo-recorder serve      # Start MCP server
```

## Configuration

Create `demo-recorder.yaml` in your project root. See [examples/demo-recorder.yaml](examples/demo-recorder.yaml).

## Output

Recordings are saved to `.demo-recordings/` with this structure:

```
.demo-recordings/
├── latest -> 2026-04-11_14-30/
└── 2026-04-11_14-30/
    └── basic-navigation/
        ├── raw.mp4
        ├── annotated.mp4
        ├── thumbnail.png
        └── report.json
```

## License

MIT
