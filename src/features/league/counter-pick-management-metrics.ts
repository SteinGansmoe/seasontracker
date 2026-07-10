import type { LeagueRole } from "./roles";
import type { RiotScanStatus } from "./riot-scan-jobs";

export type CounterPickManagementMetric = {
  error: string | null;
  value: number | null;
};

export type CounterPickLatestSuccessfulScan = {
  completedAt: string | null;
  id: number;
  observationsInserted: number | null;
  statRowsUpdated: number | null;
  uniqueMatches: number | null;
};

export type CounterPickLatestCollection = {
  id: number;
  platform: string | null;
  rankBracket: string | null;
  resolvedPatch: string | null;
  role: string | null;
  status: string;
  updatedAt: string | null;
};

export type CounterPickManagementMetrics = {
  editorial: {
    reviewedGuides: CounterPickManagementMetric;
    totalGuides: CounterPickManagementMetric;
    visibleDrafts: CounterPickManagementMetric;
  };
  latestSuccessfulScan: {
    error: string | null;
    value: CounterPickLatestSuccessfulScan | null;
  };
  pipeline: {
    counterPickStatRows: CounterPickManagementMetric;
    matchupObservations: CounterPickManagementMetric;
    uniqueMatchupGroups: CounterPickManagementMetric;
  };
  review: {
    publicCounters: CounterPickManagementMetric;
    reviewedCounterRows: CounterPickManagementMetric;
    unreviewedSuggestions: CounterPickManagementMetric;
  };
  operations: {
    activeCollectionJobs: CounterPickManagementMetric;
    latestCollection: {
      error: string | null;
      value: CounterPickLatestCollection | null;
    };
    seedCandidates: CounterPickManagementMetric;
  };
};

export type CounterPickManagementMetricsResult =
  | {
      metrics: CounterPickManagementMetrics;
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

export type CounterPickManagementMetricSource = {
  description: string;
  filters: string[];
  source: "rpc" | "table";
  tableOrRpc: string;
};

export const counterPickManagementMetricSources = {
  counterPickStatRows: {
    description: "Aggregated champion, role, patch, and rank rows.",
    filters: [],
    source: "table",
    tableOrRpc: "counter_pick_stats",
  },
  latestSuccessfulScan: {
    description: "Most recent persisted completed Riot scan job.",
    filters: ["status = completed", "order completed_at desc"],
    source: "table",
    tableOrRpc: "riot_scan_jobs",
  },
  activeCollectionJobs: {
    description: "Riot collection jobs that are not terminal.",
    filters: ["status not in terminal states"],
    source: "table",
    tableOrRpc: "riot_collection_jobs",
  },
  matchupObservations: {
    description: "Validated Riot match-role observations.",
    filters: [],
    source: "table",
    tableOrRpc: "riot_matchup_observations",
  },
  publicCounters: {
    description: "Reviewed mechanical counters eligible to appear publicly.",
    filters: [
      "review_status in (verified_strong_counter, verified_soft_counter)",
      "public_eligible = true",
    ],
    source: "table",
    tableOrRpc: "counter_ranking_v2_mechanical_reviews",
  },
  reviewedCounterRows: {
    description: "Mechanical review rows that have moved beyond the unreviewed state.",
    filters: ["review_status != unreviewed"],
    source: "table",
    tableOrRpc: "counter_ranking_v2_mechanical_reviews",
  },
  reviewedGuides: {
    description: "Editorial Counter Pick guide records marked reviewed.",
    filters: ["generation_status = reviewed"],
    source: "table",
    tableOrRpc: "league_counter_picks",
  },
  seedCandidates: {
    description: "Stored Riot seed candidate rows.",
    filters: [],
    source: "table",
    tableOrRpc: "riot_seed_candidates",
  },
  totalGuides: {
    description: "Editorial Counter Pick guide records.",
    filters: [],
    source: "table",
    tableOrRpc: "league_counter_picks",
  },
  uniqueMatchupGroups: {
    description: "Canonical champion pair + role + patch groups from Riot observations.",
    filters: [],
    source: "rpc",
    tableOrRpc: "get_counter_pick_unique_matchup_group_count",
  },
  visibleDrafts: {
    description: "Editorial Counter Pick guide records still in draft.",
    filters: ["generation_status = draft"],
    source: "table",
    tableOrRpc: "league_counter_picks",
  },
  unreviewedSuggestions: {
    description: "Mechanical review rows still waiting for review.",
    filters: ["review_status = unreviewed"],
    source: "table",
    tableOrRpc: "counter_ranking_v2_mechanical_reviews",
  },
} satisfies Record<string, CounterPickManagementMetricSource>;

export type CounterPickMatchupObservationIdentity = {
  champion_a: string;
  champion_b: string;
  patch: string;
  role: LeagueRole | string;
};

export type RiotScanJobMetricsSource = {
  completed_at?: string | null;
  id: number;
  progress?: unknown;
  summary?: unknown;
};

export type RiotScanJobTransitionRefreshInput = {
  alreadyRefreshed: boolean;
  nextStatus: RiotScanStatus;
  previousStatus?: RiotScanStatus | null;
};

export function createMetricValue(value: number | null, error: string | null = null) {
  return {
    error,
    value,
  } satisfies CounterPickManagementMetric;
}

export function createEmptyCounterPickManagementMetrics(): CounterPickManagementMetrics {
  return {
    editorial: {
      reviewedGuides: createMetricValue(null),
      totalGuides: createMetricValue(null),
      visibleDrafts: createMetricValue(null),
    },
    latestSuccessfulScan: {
      error: null,
      value: null,
    },
    pipeline: {
      counterPickStatRows: createMetricValue(null),
      matchupObservations: createMetricValue(null),
      uniqueMatchupGroups: createMetricValue(null),
    },
    review: {
      publicCounters: createMetricValue(null),
      reviewedCounterRows: createMetricValue(null),
      unreviewedSuggestions: createMetricValue(null),
    },
    operations: {
      activeCollectionJobs: createMetricValue(null),
      latestCollection: {
        error: null,
        value: null,
      },
      seedCandidates: createMetricValue(null),
    },
  };
}

export function countUniqueMatchupGroupsFromObservations(
  observations: CounterPickMatchupObservationIdentity[],
) {
  return getUniqueMatchupGroupKeys(observations).length;
}

export function getUniqueMatchupGroupKeys(observations: CounterPickMatchupObservationIdentity[]) {
  return Array.from(
    new Set(
      observations.map((observation) => {
        const championPair = [observation.champion_a, observation.champion_b].sort();

        return [championPair[0], championPair[1], observation.role, observation.patch].join(":");
      }),
    ),
  );
}

export function normalizeRiotScanJobMetrics(
  job: RiotScanJobMetricsSource,
): CounterPickLatestSuccessfulScan {
  const summary = asRecord(job.summary);
  const progress = asRecord(job.progress);

  return {
    completedAt: job.completed_at ?? null,
    id: job.id,
    observationsInserted:
      getFirstNumberMetric(summary, progress, [
        "observationsInserted",
        "insertedObservations",
        "matchupObservationsInserted",
      ]) ?? null,
    statRowsUpdated:
      getFirstNumberMetric(summary, progress, [
        "statsRowsUpdated",
        "counterPickStatRowsUpdated",
        "updatedStats",
      ]) ?? null,
    uniqueMatches:
      getFirstNumberMetric(summary, progress, ["uniqueMatchIds", "uniqueMatches"]) ?? null,
  };
}

export function shouldRefreshCounterPickManagementMetricsForJobTransition({
  alreadyRefreshed,
  nextStatus,
  previousStatus,
}: RiotScanJobTransitionRefreshInput) {
  return (
    !alreadyRefreshed &&
    !isRiotScanTerminalStatus(previousStatus) &&
    isRiotScanTerminalStatus(nextStatus)
  );
}

export function isRiotScanTerminalStatus(status: RiotScanStatus | null | undefined) {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function getFirstNumberMetric(
  summary: Record<string, unknown>,
  progress: Record<string, unknown>,
  keys: string[],
) {
  for (const source of [summary, progress]) {
    for (const key of keys) {
      const value = getNumberMetric(source[key]);

      if (value !== null) {
        return value;
      }
    }
  }

  return null;
}

function getNumberMetric(value: unknown) {
  if (Array.isArray(value)) {
    return value.length;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
