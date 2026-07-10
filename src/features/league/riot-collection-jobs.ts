import type { LeagueRole } from "./roles";
import type { RiotScanJobView, RiotScanSummary } from "./riot-scan-jobs";
import type {
  SeedCandidateLifecycleState,
  SeedCandidateRankBracket,
} from "./riot-seed-candidate-lifecycle";

export type RiotCollectionRankBracket = Exclude<SeedCandidateRankBracket, "unknown">;
export type RiotCollectionRole = LeagueRole | "any";
export type RiotCollectionStatus =
  | "aggregating"
  | "cancelled"
  | "completed"
  | "completed-partial"
  | "discovering-seeds"
  | "failed"
  | "paused"
  | "queued"
  | "scanning"
  | "selecting-seeds";

export type RiotCollectionStopReason =
  | "aggregation-failed"
  | "api-budget-reached"
  | "cancelled-by-admin"
  | "discovery-disabled"
  | "discovery-exhausted"
  | "error-budget-reached"
  | "manual-pause"
  | "no-new-data"
  | "no-ready-seeds"
  | "rate-limited"
  | "riot-api-authentication-failed"
  | "runtime-limit-reached"
  | "target-reached";

export type RiotCollectionTarget = 100 | 200 | 300 | 500;

export type RiotCollectionJobProgress = {
  activeScanJobId?: number | null;
  activeScanProgress?: RiotScanSummary | null;
  activeScanProgressAt?: string | null;
  lastAdvancedAt?: string;
  lastMessage?: string;
  recordedScanJobIds?: number[];
  safetyLimits?: RiotCollectionSafetyLimits;
};

export type RiotCollectionSafetyLimits = {
  maxCandidatesInspectedPerDiscovery: number;
  maxIdentifierLookupsPerJob: number;
  maxLadderEntriesPerJob: number;
  maxLadderPagesPerJob: number;
  maxNoProgressDiscoveryIterations: number;
  maxNewCandidatesPerJob: number;
  maxSeedBatchSize: number;
};

export type RiotCollectionDiscoveryDiagnostics = {
  api: {
    failures: number;
    rateLimited: boolean;
    requestCount: number;
    retryCount: number;
  };
  candidates: {
    created: number;
    enriched: number;
    existingMatched: number;
    missingEnrichment: number;
    persistenceFailures: number;
    rankSnapshotFailures: number;
    rankSnapshotsInserted: number;
    reused: number;
  };
  candidateIds: string[];
  entriesFetched: number;
  identifiers: {
    directPuuids: number;
    failed: number;
    lookupsAttempted: number;
    missing: number;
    resolved: number;
  };
  invocation: {
    collectionJobId: number;
    event: "ladder-discovery-started";
    rankBracket: RiotCollectionRankBracket;
    readySeedsBeforeDiscovery: number;
    remainingTargetMatches: number;
    role: RiotCollectionRole;
  } | null;
  lifecycle: Record<SeedCandidateLifecycleState, number> & {
    eligibleSeedsProduced: number;
  };
  eligibility: {
    candidatesEvaluated: number;
    candidatesRejected: number;
    candidatesSelectedAsSeeds: number;
    hardRejections: Record<string, number>;
    rejectionSamples: Array<{
      hardReasons: string[];
      id: string;
      rank: string;
      role: string;
      warnings: string[];
    }>;
    warnings: Record<string, number>;
  };
  pipeline: {
    candidateRowsFetchedAfterEnrichment: number;
    discoveredPuuids: number;
    eligibilityResults: number;
    eligibleCandidates: number;
    enrichedCandidateIds: number;
    invariantErrors: string[];
    persistedCandidateIds: number;
    qualificationInput: number;
    rejectedCandidates: number;
    selectedSeeds: number;
  };
  progress: {
    currentPage: number | null;
    currentSource: string | null;
    currentSourceIndex: number;
    duplicatePuuidsSkipped: number;
    duplicateCandidatesSkipped: number;
    evaluatedCandidateIds: string[];
    exhaustedSourceKeys: string[];
    iterations: Array<{
      candidatesEvaluated: number;
      duplicateCandidatesSkipped: number;
      duplicatePuuidsSkipped: number;
      entriesReturned: number;
      iteration: number;
      newCandidates: number;
      page: number;
      readySeedsFound: number;
      rejectedRecentlyScanned: number;
      rejectedTooFewObservations: number;
      remainingSeedsNeeded: number;
      reusedCandidates: number;
      source: string;
      uniqueCandidatesFound: number;
      uniquePuuidsFound: number;
    }>;
    readySeedIds: string[];
    readySeedsFound: number;
    remainingSeedsNeeded: number;
    selectedSeedIds: string[];
    stopReason: string | null;
    targetReadySeeds: number;
    uniqueCandidatesInspected: number;
  };
  pagesFetched: number;
  reasonCodes: string[];
  sourcesAttempted: number;
};

export type RiotCollectionJobView = {
  api_requests_used: number;
  automatic_seed_discovery: boolean;
  cancelled_at: string | null;
  completed_at: string | null;
  created_at: string;
  current_patch_only: boolean;
  duplicate_match_ids: number;
  error_count: number;
  failed_at: string | null;
  focus_champion_id: string | null;
  id: number;
  latest_scan_job: RiotScanJobView | null;
  new_matchup_observations: number;
  platform: string;
  progress: RiotCollectionJobProgress;
  queue_type: string;
  rank_bracket: RiotCollectionRankBracket;
  regional_route: string;
  resolved_patch: string | null;
  role: RiotCollectionRole;
  scan_batches_completed: number;
  scan_batches_started: number;
  seeds_discovered: number;
  seeds_used: number;
  started_at: string | null;
  stat_rows_updated: number;
  status: RiotCollectionStatus;
  stop_detail: string | null;
  stop_reason: RiotCollectionStopReason | null;
  summary: Record<string, unknown>;
  target_unique_matches: RiotCollectionTarget;
  unique_matches_processed: number;
  updated_at: string;
  warning_count: number;
};

export type StartRiotCollectionJobInput = {
  accessToken: string;
  automaticSeedDiscovery: boolean;
  currentPatchOnly: boolean;
  focusChampionId?: string | null;
  platform?: string;
  rankBracket: RiotCollectionRankBracket;
  regionalRoute?: string;
  role: RiotCollectionRole;
  targetUniqueMatches: RiotCollectionTarget;
};

export type RiotCollectionJobResult =
  | {
      job: RiotCollectionJobView;
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

export type RiotCollectionJobsResult =
  | {
      jobs: RiotCollectionJobView[];
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

export type RiotCollectionInventoryResult =
  | {
      inventory: {
        estimatedAdditionalSeedsNeeded: string;
        readySeeds: number;
      };
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

export type RiotCollectionLadderSource =
  | {
      route: "high-tier";
      tier: "CHALLENGER" | "GRANDMASTER" | "MASTER";
    }
  | {
      divisions: readonly ["IV", "III", "II", "I"];
      route: "tier-division";
      tier: "BRONZE" | "DIAMOND" | "EMERALD" | "GOLD" | "IRON" | "PLATINUM" | "SILVER";
    };

export const riotCollectionStatuses = [
  "queued",
  "discovering-seeds",
  "selecting-seeds",
  "scanning",
  "aggregating",
  "completed",
  "completed-partial",
  "failed",
  "cancelled",
  "paused",
] as const satisfies readonly RiotCollectionStatus[];

export const riotCollectionTerminalStatuses = [
  "cancelled",
  "completed",
  "completed-partial",
  "failed",
] as const satisfies readonly RiotCollectionStatus[];

export const riotCollectionRankBrackets = [
  "iron-silver",
  "gold-emerald",
  "diamond",
  "master-plus",
] as const satisfies readonly RiotCollectionRankBracket[];

export const riotCollectionTargets = [
  100, 200, 300, 500,
] as const satisfies readonly RiotCollectionTarget[];

export const maxRiotCollectionTargetUniqueMatches = 500;

export function isRiotCollectionTarget(value: unknown): value is RiotCollectionTarget {
  return riotCollectionTargets.includes(Number(value) as RiotCollectionTarget);
}

export function getRiotCollectionTargetValidationError() {
  const options = riotCollectionTargets.join(", ").replace(/, 500$/, ", or 500");

  return `Target unique matches must be ${options}.`;
}

export const defaultRiotCollectionSafetyLimits = {
  maxCandidatesInspectedPerDiscovery: 5000,
  maxIdentifierLookupsPerJob: 150,
  maxLadderEntriesPerJob: 5000,
  maxLadderPagesPerJob: 50,
  maxNoProgressDiscoveryIterations: 3,
  maxNewCandidatesPerJob: 5000,
  maxSeedBatchSize: 20,
} as const satisfies RiotCollectionSafetyLimits;

export const minRiotCollectionSeedsPerBatch = 1;
export const maxRiotCollectionSeedsPerBatch = 20;
export const defaultDevKeyRiotCollectionSeedsPerBatch = 3;
export const defaultDevKeyEstimatedRiotRequestsPerSeed = 21;

export const riotCollectionDiscoveryReasonLabels = {
  "api-failure": "One or more Riot ladder API requests failed.",
  "all-candidates-rejected": "All evaluated candidates were rejected by eligibility rules.",
  "eligible-candidates-selected": "Eligible candidates were selected for the next scan.",
  "identifier-resolution-failed": "Ladder players were found, but PUUID resolution failed.",
  "missing-riot-api-key": "Missing Riot API configuration.",
  "no-candidates-after-enrichment-refetch":
    "Candidates were enriched, but none could be refetched for qualification.",
  "no-eligible-seeds": "Ladder candidates were stored, but none were eligible for the next scan.",
  "no-qualification-input": "No candidates reached eligibility evaluation.",
  "no-ladder-entries": "Ladder discovery returned no entries from the requested pages.",
  "no-ladder-sources": "No ladder sources are configured for the selected rank bracket.",
  "no-ready-seeds-after-discovery":
    "Discovery finished, but selection found no ready unused seeds.",
  "candidate-inspection-cap-reached": "Discovery stopped at the candidate inspection safety cap.",
  "discovery-page-cap-reached": "Discovery stopped at the ladder page safety cap.",
  "discovery-sources-exhausted": "All configured discovery sources were exhausted.",
  "no-new-candidates-after-n-iterations":
    "Discovery stopped after multiple iterations found no new candidates.",
  "persistence-failed": "Ladder players were resolved, but candidate persistence failed.",
  "rate-limited": "Riot rate limit reached; resume later.",
  "riot-budget-exhausted": "Discovery stopped at the configured Riot request budget.",
  "target-ready-seeds-reached": "Discovery found enough ready seeds for the next scan.",
} as const;

const standardDivisions = ["IV", "III", "II", "I"] as const;

export const riotCollectionLadderSourcesByBracket = {
  diamond: [{ divisions: standardDivisions, route: "tier-division", tier: "DIAMOND" }],
  "gold-emerald": [
    { divisions: standardDivisions, route: "tier-division", tier: "GOLD" },
    { divisions: standardDivisions, route: "tier-division", tier: "PLATINUM" },
    { divisions: standardDivisions, route: "tier-division", tier: "EMERALD" },
  ],
  "iron-silver": [
    { divisions: standardDivisions, route: "tier-division", tier: "IRON" },
    { divisions: standardDivisions, route: "tier-division", tier: "BRONZE" },
    { divisions: standardDivisions, route: "tier-division", tier: "SILVER" },
  ],
  "master-plus": [
    { route: "high-tier", tier: "MASTER" },
    { route: "high-tier", tier: "GRANDMASTER" },
    { route: "high-tier", tier: "CHALLENGER" },
  ],
} as const satisfies Record<RiotCollectionRankBracket, readonly RiotCollectionLadderSource[]>;

export const riotCollectionStatusLabels = {
  aggregating: "Aggregating",
  cancelled: "Cancelled",
  completed: "Completed",
  "completed-partial": "Completed · Partial",
  "discovering-seeds": "Discovering seeds",
  failed: "Failed",
  paused: "Paused",
  queued: "Queued",
  scanning: "Scanning",
  "selecting-seeds": "Selecting seeds",
} as const satisfies Record<RiotCollectionStatus, string>;

export const riotCollectionStopReasonLabels = {
  "aggregation-failed": "Aggregation failed; review the child scan before continuing.",
  "api-budget-reached": "The configured Riot API budget was reached.",
  "cancelled-by-admin": "Cancelled by an administrator.",
  "discovery-disabled": "No eligible seeds remained and automatic discovery is disabled.",
  "discovery-exhausted": "Discovery complete · qualification produced 0 seeds.",
  "error-budget-reached": "The collection stopped after too many errors.",
  "manual-pause": "Paused by an administrator.",
  "no-new-data": "The last batch did not add new target matches.",
  "no-ready-seeds": "No eligible seeds remain for this rank bracket.",
  "rate-limited": "Riot rate limit reached; resume later.",
  "riot-api-authentication-failed":
    "Riot authentication failed; update the API key before resuming this scan.",
  "runtime-limit-reached": "The runtime safety limit was reached.",
  "target-reached": "The target unique-match count was reached.",
} as const satisfies Record<RiotCollectionStopReason, string>;

export function isRiotCollectionTerminalStatus(status: RiotCollectionStatus) {
  return riotCollectionTerminalStatuses.includes(
    status as (typeof riotCollectionTerminalStatuses)[number],
  );
}

export function getRiotCollectionProgressPercent({
  targetUniqueMatches,
  uniqueMatchesProcessed,
}: {
  targetUniqueMatches: number;
  uniqueMatchesProcessed: number;
}) {
  if (targetUniqueMatches <= 0) {
    return 0;
  }

  return Math.min(Math.round((uniqueMatchesProcessed / targetUniqueMatches) * 100), 100);
}

export function normalizeCollectionScanSummary(summary: RiotScanSummary | null | undefined) {
  return {
    duplicates: Number(summary?.observationDuplicatesSkipped ?? 0),
    newObservations: Number(summary?.observationsInserted ?? 0),
    statRowsUpdated: Number(summary?.statsRowsUpdated ?? 0),
    uniqueMatchIds: Number(summary?.uniqueMatchIds ?? 0),
  };
}

export function getAdaptiveRiotCollectionSeedBatchSize({
  maxSeedBatchSize = defaultRiotCollectionSafetyLimits.maxSeedBatchSize,
  seedsUsed,
  targetUniqueMatches,
  uniqueMatchesProcessed,
}: {
  maxSeedBatchSize?: number;
  seedsUsed: number;
  targetUniqueMatches: number;
  uniqueMatchesProcessed: number;
}) {
  const remainingTargetMatches = Math.max(targetUniqueMatches - uniqueMatchesProcessed, 1);
  const observedMatchesPerSeed = seedsUsed > 0 ? uniqueMatchesProcessed / seedsUsed : 0;
  const requestBudgetSeedLimit = defaultDevKeyRiotCollectionSeedsPerBatch + 1;
  const estimatedMatchesPerSeed =
    Number.isFinite(observedMatchesPerSeed) && observedMatchesPerSeed > 0
      ? Math.min(Math.max(observedMatchesPerSeed, 1), 20)
      : Math.ceil(remainingTargetMatches / requestBudgetSeedLimit);
  const adaptiveSize = Math.ceil(remainingTargetMatches / estimatedMatchesPerSeed);

  return Math.min(
    Math.max(adaptiveSize, minRiotCollectionSeedsPerBatch),
    maxSeedBatchSize,
    maxRiotCollectionSeedsPerBatch,
  );
}

export function createEmptyRiotCollectionDiscoveryDiagnostics(
  invocation: RiotCollectionDiscoveryDiagnostics["invocation"] = null,
): RiotCollectionDiscoveryDiagnostics {
  return {
    api: {
      failures: 0,
      rateLimited: false,
      requestCount: 0,
      retryCount: 0,
    },
    candidates: {
      created: 0,
      enriched: 0,
      existingMatched: 0,
      missingEnrichment: 0,
      persistenceFailures: 0,
      rankSnapshotFailures: 0,
      rankSnapshotsInserted: 0,
      reused: 0,
    },
    candidateIds: [],
    entriesFetched: 0,
    identifiers: {
      directPuuids: 0,
      failed: 0,
      lookupsAttempted: 0,
      missing: 0,
      resolved: 0,
    },
    invocation,
    lifecycle: {
      "cooling-down": 0,
      failed: 0,
      "low-signal": 0,
      "needs-rank-enrichment": 0,
      observed: 0,
      "ready-to-scan": 0,
      "recently-scanned": 0,
      rejected: 0,
      eligibleSeedsProduced: 0,
    },
    eligibility: {
      candidatesEvaluated: 0,
      candidatesRejected: 0,
      candidatesSelectedAsSeeds: 0,
      hardRejections: {},
      rejectionSamples: [],
      warnings: {},
    },
    pipeline: {
      candidateRowsFetchedAfterEnrichment: 0,
      discoveredPuuids: 0,
      eligibilityResults: 0,
      eligibleCandidates: 0,
      enrichedCandidateIds: 0,
      invariantErrors: [],
      persistedCandidateIds: 0,
      qualificationInput: 0,
      rejectedCandidates: 0,
      selectedSeeds: 0,
    },
    progress: {
      currentPage: null,
      currentSource: null,
      currentSourceIndex: 0,
      duplicatePuuidsSkipped: 0,
      duplicateCandidatesSkipped: 0,
      evaluatedCandidateIds: [],
      exhaustedSourceKeys: [],
      iterations: [],
      readySeedIds: [],
      readySeedsFound: 0,
      remainingSeedsNeeded: 0,
      selectedSeedIds: [],
      stopReason: null,
      targetReadySeeds: 0,
      uniqueCandidatesInspected: 0,
    },
    pagesFetched: 0,
    reasonCodes: [],
    sourcesAttempted: 0,
  };
}

export function shouldContinueRiotCollectionSeedDiscovery({
  apiRequestCount,
  maxApiRequests,
  maxCandidatesInspected,
  maxNoProgressIterations,
  maxPages,
  noProgressIterations,
  pagesFetched,
  rateLimited,
  readySeedsFound,
  sourcesExhausted,
  targetReadySeeds,
  uniqueCandidatesInspected,
}: {
  apiRequestCount: number;
  maxApiRequests: number;
  maxCandidatesInspected: number;
  maxNoProgressIterations: number;
  maxPages: number;
  noProgressIterations: number;
  pagesFetched: number;
  rateLimited: boolean;
  readySeedsFound: number;
  sourcesExhausted: boolean;
  targetReadySeeds: number;
  uniqueCandidatesInspected: number;
}) {
  if (readySeedsFound >= targetReadySeeds) {
    return { shouldContinue: false, stopReason: "target-ready-seeds-reached" };
  }

  if (rateLimited) {
    return { shouldContinue: false, stopReason: "rate-limited" };
  }

  if (apiRequestCount >= maxApiRequests) {
    return { shouldContinue: false, stopReason: "riot-budget-exhausted" };
  }

  if (pagesFetched >= maxPages) {
    return { shouldContinue: false, stopReason: "discovery-page-cap-reached" };
  }

  if (uniqueCandidatesInspected >= maxCandidatesInspected) {
    return { shouldContinue: false, stopReason: "candidate-inspection-cap-reached" };
  }

  if (noProgressIterations >= maxNoProgressIterations) {
    return { shouldContinue: false, stopReason: "no-new-candidates-after-n-iterations" };
  }

  if (sourcesExhausted) {
    return { shouldContinue: false, stopReason: "discovery-sources-exhausted" };
  }

  return { shouldContinue: true, stopReason: null };
}

export function getRiotCollectionDiscoveryStopDetail(
  diagnostics: RiotCollectionDiscoveryDiagnostics | null | undefined,
) {
  if (!diagnostics) {
    return "Discovery diagnostics are unavailable.";
  }

  if (diagnostics.api.rateLimited) {
    return "Discovery paused because the Riot API rate limit was reached.";
  }

  if (diagnostics.entriesFetched === 0) {
    return `Ladder discovery returned no entries from ${diagnostics.pagesFetched} requested ${diagnostics.pagesFetched === 1 ? "page" : "pages"}.`;
  }

  if (diagnostics.identifiers.resolved === 0) {
    return `${diagnostics.entriesFetched} ladder ${diagnostics.entriesFetched === 1 ? "player was" : "players were"} found, but no PUUIDs could be resolved.`;
  }

  if (diagnostics.candidates.created + diagnostics.candidates.reused === 0) {
    return `${diagnostics.identifiers.resolved} PUUIDs were resolved, but no seed candidates could be persisted.`;
  }

  if (diagnostics.lifecycle.eligibleSeedsProduced === 0) {
    const topReason = getTopDiscoveryRejectionReason(diagnostics.eligibility.hardRejections);

    if (diagnostics.pipeline.qualificationInput === 0) {
      return `${diagnostics.candidates.created} candidates were created and ${diagnostics.candidates.reused} existing candidates were refreshed, but 0 candidates reached eligibility evaluation.`;
    }

    return `${diagnostics.candidates.created} candidates were created and ${diagnostics.candidates.reused} existing candidates were refreshed, but none were eligible for the next scan${topReason ? `; top rejection: ${topReason}` : ""}.`;
  }

  return `${diagnostics.lifecycle.eligibleSeedsProduced} eligible ${diagnostics.lifecycle.eligibleSeedsProduced === 1 ? "seed was" : "seeds were"} produced, but seed selection still found no unused candidate.`;
}

function getTopDiscoveryRejectionReason(rejections: Record<string, number>) {
  const [topReason] = Object.entries(rejections).sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  )[0] ?? [null];

  return topReason;
}
