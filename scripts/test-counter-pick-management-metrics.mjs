import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const metricsModule = await import("../src/features/league/counter-pick-management-metrics.ts");
const counterPickActionsSource = readFileSync(
  new URL("../src/app/admin/league/counter-picks/actions.ts", import.meta.url),
  "utf8",
);

const {
  countUniqueMatchupGroupsFromObservations,
  counterPickManagementMetricSources,
  createMetricValue,
  normalizeRiotScanJobMetrics,
  shouldRefreshCounterPickManagementMetricsForJobTransition,
} = metricsModule;

testMetricSources();
testPublicCounterMetricQuery();
testUniqueMatchupGroupsIgnoreOrientation();
testUniqueMatchupGroupsSplitRolesAndPatches();
testLatestSuccessfulScanNormalizer();
testLegacySummaryNormalizer();
testMissingLegacyFieldsStayUnavailable();
testFailedMetricIsNotZero();
testTerminalRefreshOnce();

console.log("Counter Pick management metrics regression tests passed.");

function testMetricSources() {
  assert.equal(counterPickManagementMetricSources.totalGuides.tableOrRpc, "league_counter_picks");
  assert.deepEqual(counterPickManagementMetricSources.reviewedGuides.filters, [
    "generation_status = reviewed",
  ]);
  assert.equal(
    counterPickManagementMetricSources.matchupObservations.tableOrRpc,
    "riot_matchup_observations",
  );
  assert.equal(
    counterPickManagementMetricSources.publicCounters.tableOrRpc,
    "counter_ranking_v2_mechanical_reviews",
  );
  assert.deepEqual(counterPickManagementMetricSources.publicCounters.filters, [
    "review_status in (verified_strong_counter, verified_soft_counter)",
    "public_eligible = true",
  ]);
  assert.deepEqual(counterPickManagementMetricSources.reviewedCounterRows.filters, [
    "review_status != unreviewed",
  ]);
  assert.deepEqual(counterPickManagementMetricSources.unreviewedSuggestions.filters, [
    "review_status = unreviewed",
  ]);
  assert.equal(
    counterPickManagementMetricSources.counterPickStatRows.tableOrRpc,
    "counter_pick_stats",
  );
  assert.equal(
    counterPickManagementMetricSources.uniqueMatchupGroups.tableOrRpc,
    "get_counter_pick_unique_matchup_group_count",
  );
  assert.equal(
    counterPickManagementMetricSources.latestSuccessfulScan.tableOrRpc,
    "riot_scan_jobs",
  );
  assert.deepEqual(counterPickManagementMetricSources.latestSuccessfulScan.filters, [
    "status = completed",
    "order completed_at desc",
  ]);
}

function testPublicCounterMetricQuery() {
  assert.match(
    counterPickActionsSource,
    /countRows\(supabase, "counter_ranking_v2_mechanical_reviews"[\s\S]*\.in\("review_status", \["verified_strong_counter", "verified_soft_counter"\]\)[\s\S]*\.eq\("public_eligible", true\)/,
    "Public counter dashboard count should only include public eligible verified strong/soft counters.",
  );
}

function testUniqueMatchupGroupsIgnoreOrientation() {
  const count = countUniqueMatchupGroupsFromObservations([
    observation({ championA: "ahri", championB: "zed" }),
    observation({ championA: "zed", championB: "ahri" }),
  ]);

  assert.equal(count, 1);
}

function testUniqueMatchupGroupsSplitRolesAndPatches() {
  const count = countUniqueMatchupGroupsFromObservations([
    observation({ championA: "ahri", championB: "zed", patch: "15.12", role: "mid" }),
    observation({ championA: "zed", championB: "ahri", patch: "15.12", role: "top" }),
    observation({ championA: "ahri", championB: "zed", patch: "15.13", role: "mid" }),
  ]);

  assert.equal(count, 3);
}

function testLatestSuccessfulScanNormalizer() {
  const metrics = normalizeRiotScanJobMetrics({
    completed_at: "2026-06-17T12:00:00.000Z",
    id: 42,
    summary: {
      observationsInserted: 19,
      statsRowsUpdated: 84,
      uniqueMatchIds: 20,
    },
  });

  assert.deepEqual(metrics, {
    completedAt: "2026-06-17T12:00:00.000Z",
    id: 42,
    observationsInserted: 19,
    statRowsUpdated: 84,
    uniqueMatches: 20,
  });
}

function testLegacySummaryNormalizer() {
  const metrics = normalizeRiotScanJobMetrics({
    completed_at: "2026-06-17T12:00:00.000Z",
    id: 43,
    progress: {
      counterPickStatRowsUpdated: 12,
      insertedObservations: 8,
      uniqueMatches: 10,
    },
    summary: {},
  });

  assert.equal(metrics.uniqueMatches, 10);
  assert.equal(metrics.observationsInserted, 8);
  assert.equal(metrics.statRowsUpdated, 12);
}

function testMissingLegacyFieldsStayUnavailable() {
  const metrics = normalizeRiotScanJobMetrics({
    completed_at: null,
    id: 44,
    summary: {},
  });

  assert.equal(metrics.completedAt, null);
  assert.equal(metrics.uniqueMatches, null);
  assert.equal(metrics.observationsInserted, null);
  assert.equal(metrics.statRowsUpdated, null);
}

function testFailedMetricIsNotZero() {
  const metric = createMetricValue(null, "RPC unavailable");

  assert.equal(metric.value, null);
  assert.equal(metric.error, "RPC unavailable");
}

function testTerminalRefreshOnce() {
  assert.equal(
    shouldRefreshCounterPickManagementMetricsForJobTransition({
      alreadyRefreshed: false,
      nextStatus: "completed",
      previousStatus: "running",
    }),
    true,
  );
  assert.equal(
    shouldRefreshCounterPickManagementMetricsForJobTransition({
      alreadyRefreshed: false,
      nextStatus: "completed",
      previousStatus: "completed",
    }),
    false,
  );
  assert.equal(
    shouldRefreshCounterPickManagementMetricsForJobTransition({
      alreadyRefreshed: true,
      nextStatus: "failed",
      previousStatus: "running",
    }),
    false,
  );
}

function observation({ championA, championB, patch = "15.12", role = "mid" }) {
  return {
    champion_a: championA,
    champion_b: championB,
    patch,
    role,
  };
}
