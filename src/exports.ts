/**
 * Re-export barrel for all public modules.
 *
 * Extracted from index.ts to keep the main entry file focused on the core
 * record/recordBrowser pipeline implementation. Consumers should continue
 * importing from the package root (`index.ts`) which re-exports everything
 * from this file.
 */

/** Load and validate a demo-recorder.yaml config file. */
export { loadConfig, findScenario, deepMerge } from './config/loader.js';
/** Zod schema for validating demo-recorder config objects. */
export { ConfigSchema } from './config/schema.js';
export type { Config, Scenario, BrowserScenario, RateLimitConfigSchema } from './config/schema.js';
export type { Logger } from './pipeline/annotator.js';
/** Regression detection utilities for comparing recording reports. */
export { detectRegressions, compareReports, loadReport, writeSessionReport } from './pipeline/regression.js';
export type { RegressionResult, RegressionChange, Report, SessionReport } from './pipeline/regression.js';
/** File watcher for auto-recording on source changes. */
export { startWatcher, matchesGlobs } from './pipeline/watcher.js';
export type { WatchOptions, WatchHandle } from './pipeline/watcher.js';
/** Browser recording utilities. */
export { runBrowser } from './pipeline/browser-runner.js';
export { executeStep, executeAllSteps, parsePause, mapKeyName } from './pipeline/browser-step-executor.js';
/** Theme gallery utilities. */
export { VHS_THEMES, findTheme, getThemeNames, resolveThemeId } from './config/themes.js';
export type { ThemeInfo } from './config/themes.js';
/** HTML player generator. */
export { generatePlayer } from './pipeline/player-generator.js';
export type { PlayerOptions } from './pipeline/player-generator.js';
/** AI documentation generator. */
export { generateDocs } from './pipeline/doc-generator.js';
export type { DocGeneratorOptions } from './pipeline/doc-generator.js';
/** SVG terminal image generator. */
export { generateSvg, generateSvgFromReport } from './pipeline/svg-generator.js';
export type { SvgGeneratorOptions, SvgTheme } from './pipeline/svg-generator.js';
/** HTML report dashboard generator. */
export { generateReport } from './pipeline/report-generator.js';
export type { ReportDashboardOptions } from './pipeline/report-generator.js';
/** AI chapter and table of contents generator. */
export { generateChapters, generateTableOfContents, renderTocMarkdown, renderChaptersHtml } from './pipeline/chapter-generator.js';
export type { Chapter, TableOfContents } from './pipeline/chapter-generator.js';
/** Asciicast v2 interop (import/export). */
export { parseAsciicast, serializeAsciicast, loadAsciicast, saveAsciicast, reportToAsciicast, asciicastToReport } from './pipeline/asciicast.js';
export type { Asciicast, AsciicastHeader, AsciicastEvent } from './pipeline/asciicast.js';
/** Presentation generator. */
export { generatePresentation } from './pipeline/presentation-generator.js';
export type { PresentationOptions } from './pipeline/presentation-generator.js';
/** Bundle manifest generator for shareable recording packages. */
export { createBundleManifest, writeBundleManifest, formatManifestSummary } from './pipeline/bundler.js';
export type { BundleOptions, BundleManifest, BundleFile } from './pipeline/bundler.js';
/** Recording analytics and statistics. */
export { computeStats, formatStats } from './analytics/stats.js';
export type { RecordingStats, QualityDataPoint } from './analytics/stats.js';
/** Recording session comparison. */
export { diffSessions, formatSessionDiff } from './analytics/diff.js';
export type { SessionDiffResult, ScenarioDiff } from './analytics/diff.js';
/** Changelog generation from recording history. */
export { generateChangelog, formatChangelog } from './analytics/changelog.js';
export type { ChangelogEntry, SessionData } from './analytics/changelog.js';
/** Concurrency limiter for parallel recording. */
export { pLimit } from './pipeline/concurrency.js';
/** Recording session export/archive utilities. */
export { createArchive, listSessionArtifacts } from './pipeline/exporter.js';
export type { ArchiveResult, SessionArtifacts } from './pipeline/exporter.js';
/** Recording replay utilities. */
export { buildReplayPlan, formatReplayStep, formatReplayHeader } from './pipeline/replay.js';
export type { ReplayPlan, ReplayStep } from './pipeline/replay.js';
/** Recording profiles. */
export { BUILT_IN_PROFILES, getProfile, getProfileNames, applyProfile, getAllProfiles, parseCustomProfiles } from './config/profiles.js';
export type { RecordingProfile } from './config/profiles.js';
/** Retry utility for recording resilience. */
export { withRetry } from './pipeline/retry.js';
export type { RetryOptions } from './pipeline/retry.js';
/** Post-recording notification utilities. */
export { buildNotification, formatNotificationSummary, sendWebhook, runNotificationCommand } from './pipeline/notifier.js';
export type { NotificationPayload } from './pipeline/notifier.js';
/** Scenario dependency resolution. */
export { buildDependencyOrder, validateDependencies, buildDependencyGraph, formatDependencyGraph } from './config/dependencies.js';
export type { DependencyScenario, DependencyEdge, DependencyGraph } from './config/dependencies.js';
/** Utility to resolve user-supplied session paths, stripping output dir prefix. */
export { resolveSessionPath } from './cli-utils.js';
/** Step timing analysis for recorded scenarios. */
export { analyzeTimingFromReport, analyzeTimingFromData, renderTimingChart, formatTimingReport } from './analytics/timing.js';
export type { StepTiming, TimingAnalysis } from './analytics/timing.js';
/** Environment snapshot capture. */
export { captureEnvironmentSnapshot, formatEnvironmentSnapshot } from './pipeline/environment.js';
export type { EnvironmentSnapshot } from './pipeline/environment.js';
/** Config migration utilities. */
export { migrateConfig, formatMigrationReport } from './config/migration.js';
export type { MigrationStep, MigrationResult } from './config/migration.js';
/** Recording session pruning. */
export { pruneRecordings, formatPruneReport } from './pipeline/prune.js';
export type { PruneOptions, PruneResult } from './pipeline/prune.js';
/** CI configuration generation. */
export { generateCIConfig, getSupportedProviders } from './config/ci-generator.js';
export type { CIProvider, CIConfigOptions, CIConfigResult } from './config/ci-generator.js';
/** Health check for tool availability. */
export { runHealthCheck, formatHealthCheck } from './pipeline/health-check.js';
export type { HealthCheckItem, HealthCheckResult } from './pipeline/health-check.js';
/** Recording baseline management. */
export { saveBaseline, checkBaseline, listBaselines, formatBaselineComparison } from './analytics/baseline.js';
export type { BaselineComparison, BaselineChange, BaselineData } from './analytics/baseline.js';
/** JSON Schema export for IDE autocomplete. */
export { exportJsonSchema } from './config/schema-export.js';
/** Multi-language annotation presets. */
export { ANNOTATION_LANGUAGES, findLanguage, getLanguageInstruction, listLanguages } from './config/languages.js';
export type { AnnotationLanguage } from './config/languages.js';
/** Scenario templates library. */
export { SCENARIO_TEMPLATES, findTemplate, listTemplates, listTemplatesByCategory, getTemplateCategories } from './config/templates.js';
export type { ScenarioTemplate } from './config/templates.js';
/** Visual diff for frame descriptions. */
export { visualDiff, compareFrameDescriptions, formatVisualDiff } from './analytics/visual-diff.js';
export type { FrameDiff, VisualDiffResult } from './analytics/visual-diff.js';
/** Recording quality metrics. */
export { computeMetrics, formatMetrics } from './analytics/metrics.js';
export type { ScenarioMetric, QualityMetrics } from './analytics/metrics.js';
/** Recording session summary dashboard. */
export { generateSessionSummary, summarizeSession, formatSessionSummary } from './pipeline/summary.js';
export type { ScenarioSummary, SessionSummary } from './pipeline/summary.js';
/** Comparison matrix across sessions. */
export { generateComparisonMatrix, formatComparisonMatrix } from './analytics/comparison-matrix.js';
export type { MatrixCell, MatrixRow, ComparisonMatrix } from './analytics/comparison-matrix.js';
/** Tag-level analytics. */
export { computeTagStats, formatTagStats } from './analytics/tag-stats.js';
export type { TagStat, TagAnalytics } from './analytics/tag-stats.js';
/** Config extends chain resolution. */
export { resolveExtendsChain, validateExtends, formatExtendsChain } from './config/extends-resolver.js';
export type { ExtendsResolution } from './config/extends-resolver.js';
/** Configurable cleanup policies. */
export { evaluateCleanupPolicy, formatCleanupEvaluation, CleanupPolicySchema } from './config/cleanup-policy.js';
export type { CleanupPolicy, CleanupEvaluation, SessionInfo } from './config/cleanup-policy.js';

/** Session comparison reports. */
export { generateComparisonReport, formatComparisonReport } from './analytics/comparison-report.js';
export type { ComparisonReport, ScenarioComparison } from './analytics/comparison-report.js';

/** Config validation hints with typo detection. */
export { generateValidationHints, formatValidationHints } from './config/validation-hints.js';
export type { ValidationHint } from './config/validation-hints.js';

/** Recording history log. */
export { appendHistoryEntry, readHistory, historyStats, formatHistoryTable } from './analytics/history.js';
export type { HistoryEntry, HistoryFilter } from './analytics/history.js';

/** Shell completion scripts. */
export { generateBashCompletion, generateZshCompletion, generateFishCompletion, generateCompletion, detectShell } from './config/completions.js';

/** Plugin system. */
export { PluginRegistry, formatPluginList } from './pipeline/plugin-system.js';
export type { Plugin, StepAction, OutputFormat, PluginHooks, PluginRegistration } from './pipeline/plugin-system.js';

/** Recording snapshots. */
export { saveSnapshot, listSnapshots, restoreSnapshot, deleteSnapshot, formatSnapshotList } from './pipeline/snapshots.js';
export type { Snapshot, SaveSnapshotResult } from './pipeline/snapshots.js';

/** Recording rate limiter. */
export { RateLimiter, createRateLimiter, createRateLimiterFromConfig, formatRateLimitResult } from './pipeline/rate-limiter.js';
export type { RateLimitConfig, RateLimitResult, RateLimiterSnapshot } from './pipeline/rate-limiter.js';

/** Config diff tool. */
export { diffConfigs, formatConfigDiff } from './config/config-diff.js';
export type { ConfigDifference, ConfigDiffResult } from './config/config-diff.js';

/** Annotation cost estimator. */
export { estimateCost, getEstimateModels, formatCostEstimate } from './analytics/cost-estimator.js';
export type { ModelPricing, ScenarioCostEstimate, CostEstimate, EstimateScenarioInput } from './analytics/cost-estimator.js';

/** Config linter with best-practice rules. */
export { lintConfig, formatLintReport } from './config/linter.js';
export type { LintSeverity, LintWarning, LintResult } from './config/linter.js';

/** Pre-flight checks (validation + lint + health). */
export { runPreflightChecks, formatPreflightReport } from './config/preflight.js';
export type { PreflightCheck, PreflightResult } from './config/preflight.js';

/** Config merge utility. */
export { mergeConfigs, formatMergeReport } from './config/config-merge.js';
export type { MergeSource, MergeResolution, MergeResult } from './config/config-merge.js';

/** Scenario cloning utility. */
export { cloneScenario, cloneBrowserScenario, batchClone, formatCloneSummary } from './config/scenario-clone.js';
export type { CloneOptions, BatchCloneResult } from './config/scenario-clone.js';

/** Recording timeline visualization. */
export { generateTimeline, formatTimeline } from './analytics/timeline.js';
export type { TimelineEntry, TimelineResult } from './analytics/timeline.js';

/** Step distribution and scenario complexity analysis. */
export { analyzeSteps, formatStepAnalysis } from './analytics/step-analysis.js';
export type { StepTypeStats, ScenarioComplexity, StepAnalysis } from './analytics/step-analysis.js';

/** Recording history search. */
export { searchHistory, formatSearchResults } from './analytics/search.js';
export type { SearchHit, SearchResult, SearchOptions } from './analytics/search.js';

/** Config scaffold generator. */
export { listScaffolds, findScaffold, getScaffoldCategories, listScaffoldsByCategory, formatScaffoldList } from './config/scaffold.js';
export type { Scaffold } from './config/scaffold.js';

/** Recording heat map visualization. */
export { generateHeatMap, formatHeatMap } from './analytics/heatmap.js';
export type { HeatMapCell, HeatMapResult } from './analytics/heatmap.js';

/** Config doctor — deep diagnostics. */
export { diagnoseConfig, formatDoctorResult } from './config/config-doctor.js';
export type { Diagnostic, DoctorResult } from './config/config-doctor.js';

/** Recording quality score card. */
export { computeScoreCard, formatScoreCard } from './analytics/scorecard.js';
export type { ScoreDimension, ScoreCard } from './analytics/scorecard.js';

/** Tag suggestion engine. */
export { suggestTags, formatTagSuggestions } from './analytics/tag-suggestions.js';
export type { TagSuggestion, TagSuggestionResult } from './analytics/tag-suggestions.js';

/** Scenario status overview. */
export { computeStatusOverview, formatStatusOverview } from './analytics/status-overview.js';
export type { ScenarioStatus, StatusOverview } from './analytics/status-overview.js';

/** Recording trend analysis. */
export { analyzeTrends, formatTrendReport } from './analytics/trends.js';
export type { TrendWindow, TrendDirection, TrendResult } from './analytics/trends.js';

/** Config export to JSON/TOML. */
export { exportConfig, formatExportSummary } from './config/config-export.js';
export type { ExportFormat, ConfigExport } from './config/config-export.js';

/** Recording outlier detection. */
export { detectOutliers, detectOutliersPerScenario, formatOutliers, formatOutliersPerScenario } from './analytics/outliers.js';
export type { Outlier, OutlierResult, PerScenarioOutlierResult } from './analytics/outliers.js';

/** Scenario correlation analysis. */
export { computeCorrelations, formatCorrelations } from './analytics/correlation.js';
export type { CorrelationPair, CorrelationResult } from './analytics/correlation.js';

/** Recording duplicate detection. */
export { detectDuplicates, formatDuplicates } from './analytics/duplicates.js';
export type { DuplicateGroup, DuplicateResult } from './analytics/duplicates.js';

/** Config variable interpolation. */
export { interpolateConfig, listConfigVariables, formatInterpolationResult } from './config/interpolation.js';
export type { InterpolationResult } from './config/interpolation.js';

/** Recording session grouping. */
export { groupRecordings, formatGrouping } from './analytics/grouping.js';
export type { GroupBy, RecordingGroup, GroupingResult } from './analytics/grouping.js';

/** Scenario health alerts. */
export { generateAlerts, formatAlerts } from './analytics/alerts.js';
export type { AlertSeverity, HealthAlert, AlertThresholds, AlertResult } from './analytics/alerts.js';

/** SLA compliance monitoring. */
export { checkSla, formatSla } from './analytics/sla.js';
export type { SlaTarget, SlaCheck, SlaResult } from './analytics/sla.js';

/** Structured config comparison. */
export { compareConfigs, formatComparisonReport as formatConfigComparisonReport } from './config/config-comparison.js';
export type { ConfigChange, ComparisonReport as ConfigComparisonReport } from './config/config-comparison.js';

/** Recording retention policy. */
export { evaluateRetention, formatRetention } from './analytics/retention.js';
export type { RetentionPolicy, RetentionCandidate, RetentionResult, ScenarioRetention } from './analytics/retention.js';

/** Session diff summary. */
export { diffSessionEntries, formatSessionDiffSummary } from './analytics/session-diff-summary.js';
export type { StatusTransition, ScenarioDiffEntry, SessionDiffSummary } from './analytics/session-diff-summary.js';

/** Template preview. */
export { previewTemplate, formatTemplatePreview, formatCompactPreview } from './config/template-preview.js';
export type { TemplatePreview } from './config/template-preview.js';

/** Performance benchmarks. */
export { computeBenchmarks, formatBenchmarks } from './analytics/benchmarks.js';
export type { ScenarioBenchmark, BenchmarkResult } from './analytics/benchmarks.js';

/** Dependency depth analysis. */
export { analyzeDependencyDepth, formatDepthAnalysis } from './config/dependency-depth.js';
export type { ScenarioDepthInfo, DepthAnalysis } from './config/dependency-depth.js';

/** Recording freshness index. */
export { computeFreshness, formatFreshness } from './analytics/freshness.js';
export type { FreshnessGrade, ScenarioFreshness, FreshnessResult } from './analytics/freshness.js';

/** Scenario coverage report. */
export { computeCoverage, formatCoverage } from './analytics/coverage.js';
export type { CoverageStatus, ScenarioCoverage, CoverageReport } from './analytics/coverage.js';

/** Config snapshot diff. */
export { createConfigSnapshot, detectDrift, classifyDriftSeverity, formatDrift } from './config/config-snapshot-diff.js';
export type { ConfigSnapshot, DriftResult } from './config/config-snapshot-diff.js';

/** Scenario complexity scorer. */
export { scoreComplexity, formatComplexity } from './analytics/complexity.js';
export type { ComplexityScore, ComplexityResult, ComplexityScenario } from './analytics/complexity.js';
