/**
 * Re-export barrel for analytics modules.
 *
 * Split from exports.ts to keep each barrel file under the 400-line limit.
 * Consumers should continue importing from the package root (`index.ts`)
 * which re-exports everything from both barrel files.
 */

/** Session comparison reports. */
export { generateComparisonReport, formatComparisonReport } from './analytics/comparison-report.js';
export type { ComparisonReport, ScenarioComparison } from './analytics/comparison-report.js';

/** Recording history log. */
export { appendHistoryEntry, readHistory, historyStats, formatHistoryTable } from './analytics/history.js';
export type { HistoryEntry, HistoryFilter } from './analytics/history.js';

/** Annotation cost estimator. */
export { estimateCost, getEstimateModels, formatCostEstimate } from './analytics/cost-estimator.js';
export type { ModelPricing, ScenarioCostEstimate, CostEstimate, EstimateScenarioInput } from './analytics/cost-estimator.js';

/** Recording timeline visualization. */
export { generateTimeline, formatTimeline } from './analytics/timeline.js';
export type { TimelineEntry, TimelineResult } from './analytics/timeline.js';

/** Step distribution and scenario complexity analysis. */
export { analyzeSteps, formatStepAnalysis } from './analytics/step-analysis.js';
export type { StepTypeStats, ScenarioComplexity, StepAnalysis } from './analytics/step-analysis.js';

/** Recording history search. */
export { searchHistory, formatSearchResults } from './analytics/search.js';
export type { SearchHit, SearchResult, SearchOptions } from './analytics/search.js';

/** Recording heat map visualization. */
export { generateHeatMap, formatHeatMap } from './analytics/heatmap.js';
export type { HeatMapCell, HeatMapResult } from './analytics/heatmap.js';

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

/** Recording outlier detection. */
export { detectOutliers, detectOutliersPerScenario, formatOutliers, formatOutliersPerScenario } from './analytics/outliers.js';
export type { Outlier, OutlierResult, PerScenarioOutlierResult } from './analytics/outliers.js';

/** Scenario correlation analysis. */
export { computeCorrelations, formatCorrelations } from './analytics/correlation.js';
export type { CorrelationPair, CorrelationResult } from './analytics/correlation.js';

/** Recording duplicate detection. */
export { detectDuplicates, formatDuplicates } from './analytics/duplicates.js';
export type { DuplicateGroup, DuplicateResult } from './analytics/duplicates.js';

/** Recording session grouping. */
export { groupRecordings, formatGrouping } from './analytics/grouping.js';
export type { GroupBy, RecordingGroup, GroupingResult } from './analytics/grouping.js';

/** Scenario health alerts. */
export { generateAlerts, formatAlerts } from './analytics/alerts.js';
export type { AlertSeverity, HealthAlert, AlertThresholds, AlertResult } from './analytics/alerts.js';

/** SLA compliance monitoring. */
export { checkSla, formatSla } from './analytics/sla.js';
export type { SlaTarget, SlaCheck, SlaResult } from './analytics/sla.js';

/** Recording retention policy. */
export { evaluateRetention, formatRetention } from './analytics/retention.js';
export type { RetentionPolicy, RetentionCandidate, RetentionResult, ScenarioRetention } from './analytics/retention.js';

/** Session diff summary. */
export { diffSessionEntries, formatSessionDiffSummary } from './analytics/session-diff-summary.js';
export type { StatusTransition, ScenarioDiffEntry, SessionDiffSummary } from './analytics/session-diff-summary.js';

/** Performance benchmarks. */
export { computeBenchmarks, formatBenchmarks } from './analytics/benchmarks.js';
export type { ScenarioBenchmark, BenchmarkResult } from './analytics/benchmarks.js';

/** Recording freshness index. */
export { computeFreshness, formatFreshness } from './analytics/freshness.js';
export type { FreshnessGrade, ScenarioFreshness, FreshnessResult } from './analytics/freshness.js';

/** Scenario coverage report. */
export { computeCoverage, formatCoverage } from './analytics/coverage.js';
export type { CoverageStatus, ScenarioCoverage, CoverageReport } from './analytics/coverage.js';

/** Scenario complexity scorer. */
export { scoreComplexity, formatComplexity } from './analytics/complexity.js';
export type { ComplexityScore, ComplexityResult, ComplexityScenario } from './analytics/complexity.js';

/** Recording rate analysis. */
export { analyzeRates, formatRateAnalysis } from './analytics/rate-analysis.js';
export type { PeriodRate, RateAnalysis } from './analytics/rate-analysis.js';

/** Recording health dashboard. */
export { computeHealthDashboard, formatHealthDashboard } from './analytics/health-dashboard.js';
export type { HealthGrade, HealthDashboard, ScenarioHealth } from './analytics/health-dashboard.js';

/** Recording streak tracker. */
export { analyzeStreaks, formatStreaks } from './analytics/streaks.js';
export type { Streak, StreakResult } from './analytics/streaks.js';

/** Dependency impact analysis. */
export { analyzeImpact, analyzeFailureImpact, formatImpactAnalysis } from './analytics/impact-analysis.js';
export type { ImpactScenario, ScenarioImpact, ImpactLayer, ImpactAnalysis } from './analytics/impact-analysis.js';

/** Recording distribution analysis. */
export { analyzeDistribution, formatDistribution } from './analytics/distribution.js';
export type { ScenarioDistribution, DistributionResult } from './analytics/distribution.js';

/** Scenario risk scoring. */
export { computeRiskScores, formatRiskScores } from './analytics/risk-score.js';
export type { RiskLevel, ScenarioRisk, RiskResult } from './analytics/risk-score.js';

/** Recording efficiency metrics. */
export { computeEfficiency, formatEfficiency } from './analytics/efficiency.js';
export type { EfficiencyResult, IdleAnalysis, HourlyBucket } from './analytics/efficiency.js';

/** Recording velocity tracker. */
export { analyzeVelocity, formatVelocity } from './analytics/velocity.js';
export type { VelocityWindow, VelocityResult } from './analytics/velocity.js';

/** Recording capacity planner. */
export { analyzeCapacity, formatCapacity } from './analytics/capacity.js';
export type { ScenarioThroughput, TargetEstimate, CapacityResult } from './analytics/capacity.js';

/** Recording quality trend analyzer. */
export { analyzeQualityTrends, formatQualityTrends } from './analytics/quality-trends.js';
export type { QualityDirection, QualitySnapshot, DimensionTrend, QualityTrendResult } from './analytics/quality-trends.js';

/** Recording anomaly detector. */
export { detectAnomalies, formatAnomalies } from './analytics/anomaly.js';
export type { AnomalyType, AnomalySeverity, Anomaly, AnomalyResult } from './analytics/anomaly.js';

/** Recording session fingerprinting. */
export { fingerprintSessions, formatFingerprints } from './analytics/fingerprint.js';
export type { SessionFingerprint, SimilarityMatch, FingerprintResult } from './analytics/fingerprint.js';

/** Recording summary digest. */
export { generateDigest, formatDigest } from './analytics/digest.js';
export type { DigestPeriod, DigestItem, DigestResult } from './analytics/digest.js';

/** Recording forecast. */
export { buildDailyObservations, generateForecast, formatForecast } from './analytics/forecast.js';
export type { ForecastMethod, DataQuality, ForecastPoint, DailyObservation, ForecastResult } from './analytics/forecast.js';

/** Recording cohort analysis. */
export { analyzeCohorts, formatCohorts } from './analytics/cohort.js';
export type { CohortGranularity, CohortPeriodData, Cohort, CohortResult } from './analytics/cohort.js';

/** Recording burndown chart. */
export { computeBurndown, formatBurndown } from './analytics/burndown.js';
export type { BurndownDay, BurndownResult } from './analytics/burndown.js';

/** Composite recording health score. */
export { computeHealthScore, formatHealthScore } from './analytics/health-score.js';
export type { HealthDimension, HealthScoreGrade, HealthScoreResult } from './analytics/health-score.js';

/** Recording funnel analysis. */
export { analyzeFunnel, formatFunnel } from './analytics/funnel.js';
export type { FunnelStage, ScenarioFunnel, FunnelResult } from './analytics/funnel.js';

/** Recording comparison radar. */
export { computeRadar, formatRadar, RADAR_DIMENSIONS } from './analytics/radar.js';
export type { RadarDimensionName, RadarValue, RadarProfile, RadarResult } from './analytics/radar.js';

/** Recording Pareto analysis. */
export { analyzePareto, formatPareto } from './analytics/pareto.js';
export type { ParetoCategory, ParetoItem, ParetoAnalysis, ParetoResult } from './analytics/pareto.js';

/** Shared analytics utilities. */
export { round2 } from './analytics/utils.js';
