# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] — 2026-04-11

### Highlights

- **56 CLI commands** covering recording, analytics, configuration, and developer tooling
- **86 test files** with **996 tests** — all passing
- **Terminal + browser** dual recording backends (VHS + Playwright)
- **AI-powered annotation** with multi-language support
- **MCP server** for IDE integration

---

### Features — Core Recording

- **Terminal recording** via VHS with MP4/GIF output
- **Browser recording** via Playwright with screenshot capture
- **Ad-hoc recording** mode with `--command` and `--steps` flags
- **Parallel recording** with configurable concurrency limiter (F-030)
- **Recording retry** with exponential backoff (F-034)
- **Dry-run mode** for recording plan preview (F-024)
- **GIF output format** support
- **Recording profiles** — built-in presets (quick, standard, hd, 4k) + custom profiles (F-032, F-049)
- **Theme support** — 18 VHS themes with `--theme` override and gallery CLI (F-003)
- **Session reports** for multi-scenario recording runs
- **Scenario lifecycle hooks** for setup/teardown commands (F-023)
- **Scenario dependencies** with topological ordering (F-033)
- **Scenario tagging** and `--tag` filter for selective recording (F-022)
- **Scenario cloning** for creating test variants (F-068)
- **Config inheritance** via `extends` field (F-021)
- **Step comments** for human-readable report labels (F-044)
- **Screenshot step action** for terminal VHS (F-015)
- **Window frame decorations** and wait/assert steps (F-005, F-009)
- **Idle time limit** for pause compression (F-002)
- **Retain-on-failure** recording mode (F-001)
- **Watch mode** — auto-record on source file changes

### Features — AI Annotation

- **AI annotation overlay** with frame analysis
- **Multi-language presets** — 20+ languages (F-045)
- **AI chapter generation** and table of contents (F-014)
- **AI documentation generator** from recording reports (F-008)
- **Annotation cost estimator** for budgeting (F-061)
- **Graceful fallback** when ffmpeg lacks freetype

### Features — Analytics & Reporting (21 modules)

- **Recording stats** — success rate, duration, bug counts (F-020)
- **Session diff** — compare two recording sessions (F-026)
- **Changelog generation** from recording history (F-029)
- **Step timing analysis** with optimization suggestions (F-037)
- **Recording baselines** for regression detection (F-042)
- **Quality metrics** with stability and trend analysis (F-048)
- **Visual diff** for frame description comparison (F-047)
- **Session summary dashboard** (F-050)
- **Comparison matrix** for sessions × scenarios (F-052)
- **Tag-level analytics** with best/worst/buggiest indicators (F-053)
- **Session comparison report** combining diff and visual analysis (F-051)
- **Recording history** log with filtering and trend queries (F-053)
- **Recording timeline** with duration bars (F-069)
- **Step distribution analysis** and complexity scoring (F-070)
- **History search** with relevance scoring (F-071)
- **Recording heatmap** — 7×24 frequency grid with ASCII blocks (F-073)
- **Quality scorecard** — 5-dimension weighted grading (A–F) (F-075)
- **Tag suggestion engine** — pattern-based inference (F-076)
- **Status overview** — per-scenario health dashboard (F-077)
- **Quality trends** — direction detection (improving/stable/declining) (F-078)
- **Outlier detection** — Z-score analysis for duration, bugs, status (F-080)

### Features — Configuration (23 modules)

- **YAML config** with Zod schema validation
- **Config validation** with detailed error messages
- **Validation hints** with typo detection (F-052)
- **Config migration** for upgrading deprecated schemas (F-038)
- **Config inheritance** via `extends` chain resolution (F-051)
- **Config linter** — 11 best-practice rules (F-062, F-067)
- **Pre-flight checks** combining validation, lint, and health (F-064)
- **Config diff** for comparing YAML files (F-060)
- **Config merge** — deep-merge base + override (F-065)
- **Config doctor** — deep diagnostic analysis (F-074)
- **Config export** to JSON and TOML (F-079)
- **Config scaffold** — 5 starter templates (cli-basic, cli-advanced, web-app, api-demo, monorepo) (F-072)
- **JSON Schema export** for IDE autocompletion (F-043)
- **Scenario templates** — 8 reusable workflows (F-046)
- **Cleanup policies** with keep_last_n, max_age, max_disk (F-054)
- **Dependency graph** visualization (F-066)
- **Environment snapshot** with tool version detection (F-036)

### Features — Pipeline & Infrastructure

- **MCP server** for IDE integration via stdio transport
- **Plugin system** — extensible actions and output formats (F-057)
- **Recording snapshots** for checkpoint and restore (F-058)
- **Rate limiter** — sliding-window with preset support (F-059, F-063)
- **Recording export** to zip/tar.gz archives (F-027)
- **Notification system** for post-recording alerts (F-035)
- **CI config generator** for GitHub Actions, GitLab CI, CircleCI (F-040)
- **Doctor command** for system health checks (F-041)
- **Session prune** with keep-count and max-age (F-039)
- **Shell completions** for bash, zsh, and fish (F-056)
- **Interactive replay** mode for recorded sessions (F-031)

### Features — Output Formats

- **Multi-format output** — MP4, GIF, WebM (F-004)
- **HTML player** with annotation captions (F-007)
- **HTML report dashboard** with metrics and frame analysis (F-010)
- **SVG terminal image** generator (F-006)
- **Slide-style presentation** generator (F-013)
- **Asciicast v2** format for asciinema compatibility (F-011)
- **Bundle manifest** for shareable recording packages (F-012)

### Bug Fixes (19)

- Fix ad-hoc recordings not logged to history
- Fix recording pipeline not appending history entries
- Fix custom profiles not loaded from config YAML
- Fix changelog duplicate date headers
- Fix dependency validation not integrated into validate command
- Fix path double-prefix in session-diff, replay, and export
- Fix theme aliases for Monokai, Gruvbox, and Ayu Dark
- Fix theme display names not resolved to VHS identifiers
- Fix `--theme` override not passed to ad-hoc mode
- Fix shared timestamp for multi-scenario sessions
- Fix thumbnail path shown when no frames analyzed
- Fix timestamp extraction for parallel symlink
- Fix symlink update for parallel-safe recording
- Fix immutable config in MCP server + parallel recording
- Fix loadReport validation + diff --quiet support
- Fix immutable config and clean realpath import
- Fix MCP logger injection, quiet mode leak, language test
- Fix unused import and language-aware annotations
- Fix MEDIUM/LOW issues from review cycles

### Refactoring

- Split CLI into 8-file architecture (cli.ts + cli-utils.ts + cli-handlers.ts + cli-commands.ts + cli-config-commands.ts + cli-config-tools-commands.ts + cli-analytics-commands.ts + cli-analytics-extra-commands.ts)
- Extract re-export barrel (exports.ts) from index.ts
- Decompose record() into smaller pipeline functions
- Remove parsePause duplication in timing.ts

### Architecture

```
src/
├── analytics/     21 modules — stats, diff, search, heatmap, trends, ...
├── config/        23 modules — schema, loader, linter, scaffold, ...
├── mcp/            1 module  — MCP server
├── pipeline/      27 modules — recording, annotation, replay, ...
├── cli*.ts         8 files   — CLI command registration
├── exports.ts                — re-export barrel
└── index.ts                  — main entry point
```

- **56 CLI commands** across 8 command files
- **86 test files** with **996 tests**
- **~16,000 lines** of source code
- **~15,000 lines** of test code

---

*Released with 175 commits in a single development session.*
