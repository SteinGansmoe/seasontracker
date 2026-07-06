import type { SupabaseClient } from "@supabase/supabase-js";

import {
  calculateCounterPickStatTier,
  fetchCounterPickStatsByCounterAndRole,
  fetchCounterPickStatsByEnemyRoleAndCounters,
  fetchCounterPickStatsByEnemyAndRole,
  type CounterPickStat,
} from "./counter-pick-stats";
import {
  getPublicCounterResultsForSelectedChampionStats,
  type CounterPickStatistics,
  type CounterPickStatisticsTier,
  minimumTrustedCounterPickGames,
  type PublicReviewedMechanicalCounter,
} from "./counter-pick-statistics";
import {
  counterRankingV2PublicApprovedReviewStatuses,
  isChampionSupportedInRole,
} from "./counter-ranking-v2";
import { calculateCounterPickConfidence } from "./counter-pick-confidence";
import type { LeagueRole } from "./roles";
import { supabase } from "@/src/lib/supabase";

export type CounterPickStatsConfidence = "high" | "low" | "medium" | "not_enough_data";

export type CounterPickMatchupStats = {
  confidence: CounterPickStatsConfidence;
  counterChampion: string;
  enemyChampion: string;
  games: number;
  lastUpdatedAt: string;
  patch: string;
  role: LeagueRole;
  tier: CounterPickStatisticsTier;
  winRate: number;
  wins: number;
};

type CounterPickStatsProviderClient = SupabaseClient;

type CounterPickStatsInput = {
  counterChampion: string;
  enemyChampion: string;
  patch?: string | null;
  role: LeagueRole;
};

type FetchCounterPickStatsInput = {
  client?: CounterPickStatsProviderClient | null;
  enemyChampion: string;
  patch?: string | null;
  role: LeagueRole;
};

type CounterPickStatsResult = {
  countersIntoSelectedChampion: Map<string, CounterPickStatistics>;
  error: string | null;
  selectedChampionGoodInto: Map<string, CounterPickStatistics>;
  /** @deprecated Use selectedChampionGoodInto. */
  selectedChampionStatsByEnemyChampion: Map<string, CounterPickStatistics>;
  /** @deprecated Use countersIntoSelectedChampion. */
  statisticsByCounterChampion: Map<string, CounterPickStatistics>;
};

type CounterRankingV2PublicReviewRow = {
  counter_champion_id: string;
  enemy_champion_id: string;
  high_mastery_required: boolean | null;
  public_eligible: boolean;
  review_status: string;
};

type PublicEligibleCounterRankingV2ReviewsResult = {
  fetchedReviewRows: CounterRankingV2PublicReviewRow[];
  filteredReviewRows: CounterRankingV2PublicReviewRow[];
  inverseFilteredReviewRows: CounterRankingV2PublicReviewRow[];
  inverseReviewedMechanicalCounters: PublicReviewedMechanicalCounter[];
  selectedCounterReviewRowsBeforePublicFiltering: CounterRankingV2PublicReviewRow[];
  selectedEnemyReviewRowsBeforePublicFiltering: CounterRankingV2PublicReviewRow[];
  reviewedMechanicalCounters: PublicReviewedMechanicalCounter[];
};

type CalculateCounterTierInput = {
  confidence: CounterPickStatsConfidence;
  games: number;
  winRate: number;
};

type MockCounterPickStatsSeed = Omit<
  CounterPickMatchupStats,
  "confidence" | "lastUpdatedAt" | "tier" | "wins"
> & {
  lastUpdatedAt?: string;
};

const defaultMockPatch = "15.12";
const mockLastUpdatedAt = "2026-06-14T00:00:00.000Z";
const counterRankingV2PublicReviewSelect = [
  "counter_champion_id",
  "enemy_champion_id",
  "high_mastery_required",
  "public_eligible",
  "review_status",
].join(", ");
const confidenceSortValue = {
  high: 3,
  medium: 2,
  low: 1,
  not_enough_data: 0,
} as const satisfies Record<CounterPickStatsConfidence, number>;

const tierSortValue = {
  "S+": 5,
  S: 4,
  A: 3,
  B: 2,
  C: 1,
  D: 0,
} as const satisfies Record<CounterPickStatisticsTier, number>;

const mockCounterPickStats = [
  createMockCounterPickStats({
    counterChampion: "Yasuo",
    enemyChampion: "Ahri",
    games: 12481,
    patch: defaultMockPatch,
    role: "mid",
    winRate: 53.4,
  }),
  createMockCounterPickStats({
    counterChampion: "Lissandra",
    enemyChampion: "Ahri",
    games: 18492,
    patch: defaultMockPatch,
    role: "mid",
    winRate: 54.1,
  }),
  createMockCounterPickStats({
    counterChampion: "Malzahar",
    enemyChampion: "Ahri",
    games: 9328,
    patch: defaultMockPatch,
    role: "mid",
    winRate: 52.2,
  }),
  createMockCounterPickStats({
    counterChampion: "Syndra",
    enemyChampion: "Ahri",
    games: 3275,
    patch: defaultMockPatch,
    role: "mid",
    winRate: 51.4,
  }),
  createMockCounterPickStats({
    counterChampion: "Lissandra",
    enemyChampion: "Yone",
    games: 9176,
    patch: defaultMockPatch,
    role: "mid",
    winRate: 54.8,
  }),
  createMockCounterPickStats({
    counterChampion: "Pantheon",
    enemyChampion: "Yone",
    games: 6410,
    patch: defaultMockPatch,
    role: "mid",
    winRate: 53.2,
  }),
  createMockCounterPickStats({
    counterChampion: "Renekton",
    enemyChampion: "Yone",
    games: 1372,
    patch: defaultMockPatch,
    role: "mid",
    winRate: 52.6,
  }),
] satisfies CounterPickMatchupStats[];

const mockCounterPickStatsByKey = new Map(
  mockCounterPickStats.map((stats) => [getCounterPickStatsKey(stats), stats]),
);

export async function fetchCounterPickStatsForEnemy({
  client,
  enemyChampion,
  patch = null,
  role,
}: FetchCounterPickStatsInput): Promise<CounterPickStatsResult> {
  const countersIntoSelectedChampion = new Map<string, CounterPickStatistics>();
  const selectedChampionGoodInto = new Map<string, CounterPickStatistics>();
  const counteredByResult = await fetchCounterPickStatsByEnemyAndRole({
    client,
    enemyChampionId: enemyChampion,
    patch,
    rankBracket: "all",
    role,
  });
  const useReviewedMechanicalCounters = getReviewedMechanicalCountersPublicFeatureFlag();
  const reviewResult = useReviewedMechanicalCounters
    ? await fetchPublicEligibleCounterRankingV2Reviews({
        client,
        enemyChampion,
        role,
      })
    : createEmptyPublicEligibleCounterRankingV2ReviewsResult();
  const reviewedMechanicalCounters = reviewResult.reviewedMechanicalCounters;
  const inverseReviewedMechanicalCounters = reviewResult.inverseReviewedMechanicalCounters;
  const reviewedMechanicalCounterStats =
    reviewedMechanicalCounters.length > 0
      ? await fetchCounterPickStatsByEnemyRoleAndCounters({
          client,
          counterChampionIds: reviewedMechanicalCounters.map(
            (counter) => counter.counterChampionId,
          ),
          enemyChampionId: enemyChampion,
          patch,
          rankBracket: "all",
          role,
        })
      : { error: null, stats: [] };
  const inverseReviewedMechanicalCounterStats =
    inverseReviewedMechanicalCounters.length > 0
      ? await fetchCounterPickStatsByCounterAndRole({
          client,
          counterChampionId: enemyChampion,
          patch,
          rankBracket: "all",
          role,
        })
      : { error: null, stats: [] };
  const inverseReviewedMechanicalCounterEnemyIds = new Set(
    inverseReviewedMechanicalCounters.map((counter) =>
      normalizeCounterPickStatsKey(counter.enemyChampionId),
    ),
  );
  const orientedInverseReviewedMechanicalCounterStats =
    inverseReviewedMechanicalCounterStats.stats
      .filter((stat) =>
        inverseReviewedMechanicalCounterEnemyIds.has(
          normalizeCounterPickStatsKey(stat.enemy_champion_id),
        ),
      )
      .map((stat) => orientCounterPickStatForSelectedChampionGoodInto(stat, enemyChampion));
  const statsForPublicResults = mergeCounterPickStatsForPublicResults(
    counteredByResult.stats,
    [
      ...reviewedMechanicalCounterStats.stats,
      ...orientedInverseReviewedMechanicalCounterStats,
    ],
  );
  const publicResults = getPublicCounterResultsForSelectedChampionStats(
    statsForPublicResults,
    enemyChampion,
    {
      reviewedMechanicalCounters: [
        ...reviewedMechanicalCounters,
        ...inverseReviewedMechanicalCounters,
      ],
      useReviewedMechanicalCounters,
    },
  );

  logPublicReviewedMechanicalCountersDebug({
    fetchedReviewRows: reviewResult.fetchedReviewRows,
    featureFlagValue: useReviewedMechanicalCounters,
    finalPublicCounterIds: publicResults.countersIntoSelectedChampion.map(
      (result) => result.listedChampionId,
    ),
    finalPublicGoodIntoIds: publicResults.selectedChampionGoodInto.map(
      (result) => result.listedChampionId,
    ),
    inverseFilteredReviewRows: reviewResult.inverseFilteredReviewRows,
    inverseReviewedCounterChampionIds: inverseReviewedMechanicalCounters.map(
      (counter) => counter.enemyChampionId,
    ),
    mergedBestCounterIdsBeforeFinalSorting: statsForPublicResults.map(
      (stat) => stat.counter_champion_id,
    ),
    mergedGoodIntoIdsBeforeFinalSorting: orientedInverseReviewedMechanicalCounterStats.map(
      (stat) => stat.counter_champion_id,
    ),
    reviewedCounterChampionIds: reviewedMechanicalCounters.map(
      (counter) => counter.counterChampionId,
    ),
    reviewedCountersRenderedWithoutStats: getReviewedCountersWithoutStats(
      reviewedMechanicalCounters,
      statsForPublicResults,
    ),
    role,
    selectedEnemyChampionId: enemyChampion,
    selectedCounterReviewRowsBeforePublicFiltering:
      reviewResult.selectedCounterReviewRowsBeforePublicFiltering,
    selectedEnemyReviewRowsBeforePublicFiltering:
      reviewResult.selectedEnemyReviewRowsBeforePublicFiltering,
    statsRowsFetchedForInverseReviewedCounterIds:
      inverseReviewedMechanicalCounterStats.stats.map(getCounterPickStatDebugSnapshot),
    statsRowsFetchedForReviewedCounterIds: reviewedMechanicalCounterStats.stats.map(
      getCounterPickStatDebugSnapshot,
    ),
    filteredReviewRows: reviewResult.filteredReviewRows,
  });

  for (const result of publicResults.countersIntoSelectedChampion) {
    countersIntoSelectedChampion.set(
      normalizeCounterPickStatsKey(result.listedChampionId),
      result.statistics,
    );
  }

  for (const result of publicResults.selectedChampionGoodInto) {
    selectedChampionGoodInto.set(
      normalizeCounterPickStatsKey(result.listedChampionId),
      result.statistics,
    );
  }

  return {
    countersIntoSelectedChampion,
    error: counteredByResult.error,
    selectedChampionGoodInto,
    selectedChampionStatsByEnemyChampion: selectedChampionGoodInto,
    statisticsByCounterChampion: countersIntoSelectedChampion,
  };
}

function mergeCounterPickStatsForPublicResults(
  observedStats: CounterPickStat[],
  reviewedCounterStats: CounterPickStat[],
) {
  const mergedStats = [...observedStats];
  const observedCounterIds = new Set(
    observedStats.map((stat) => normalizeCounterPickStatsKey(stat.counter_champion_id)),
  );

  for (const stat of reviewedCounterStats) {
    const counterChampionKey = normalizeCounterPickStatsKey(stat.counter_champion_id);

    if (observedCounterIds.has(counterChampionKey)) {
      continue;
    }

    mergedStats.push(stat);
    observedCounterIds.add(counterChampionKey);
  }

  return mergedStats;
}

async function fetchPublicEligibleCounterRankingV2Reviews({
  client = supabase,
  enemyChampion,
  role,
}: {
  client?: CounterPickStatsProviderClient | null;
  enemyChampion: string;
  role: LeagueRole;
}): Promise<PublicEligibleCounterRankingV2ReviewsResult> {
  if (!client) {
    return createEmptyPublicEligibleCounterRankingV2ReviewsResult();
  }

  const { data, error } = await client
    .from("counter_ranking_v2_mechanical_reviews")
    .select(counterRankingV2PublicReviewSelect)
    .eq("role", role)
    .returns<CounterRankingV2PublicReviewRow[]>();

  if (error || !data) {
    return createEmptyPublicEligibleCounterRankingV2ReviewsResult();
  }

  const selectedEnemyReviewRowsBeforePublicFiltering = data.filter((row) =>
    hasMatchingCounterRankingV2ReviewEnemy(row, enemyChampion),
  );
  const selectedCounterReviewRowsBeforePublicFiltering = data.filter((row) =>
    hasMatchingCounterRankingV2ReviewCounter(row, enemyChampion),
  );
  const filteredReviewRows = selectedEnemyReviewRowsBeforePublicFiltering.filter((row) =>
    isPublicEligibleCounterRankingV2ReviewRow(row, role),
  );
  const inverseFilteredReviewRows = selectedCounterReviewRowsBeforePublicFiltering.filter((row) =>
    isPublicEligibleCounterRankingV2ReviewRow(row, role),
  );

  return {
    fetchedReviewRows: data,
    filteredReviewRows,
    inverseFilteredReviewRows,
    inverseReviewedMechanicalCounters: inverseFilteredReviewRows.map((row) => ({
      counterChampionId: row.counter_champion_id,
      direction: "selected_good_into",
      enemyChampionId: row.enemy_champion_id,
      highMasteryRequired: Boolean(row.high_mastery_required),
      publicEligible: row.public_eligible,
      reviewStatus: row.review_status,
    })),
    selectedCounterReviewRowsBeforePublicFiltering,
    selectedEnemyReviewRowsBeforePublicFiltering,
    reviewedMechanicalCounters: filteredReviewRows.map((row) => ({
      counterChampionId: row.counter_champion_id,
      direction: "counter_into_selected",
      enemyChampionId: row.enemy_champion_id,
      highMasteryRequired: Boolean(row.high_mastery_required),
      publicEligible: row.public_eligible,
      reviewStatus: row.review_status,
    })),
  };
}

function createEmptyPublicEligibleCounterRankingV2ReviewsResult(): PublicEligibleCounterRankingV2ReviewsResult {
  return {
    fetchedReviewRows: [],
    filteredReviewRows: [],
    inverseFilteredReviewRows: [],
    inverseReviewedMechanicalCounters: [],
    selectedCounterReviewRowsBeforePublicFiltering: [],
    selectedEnemyReviewRowsBeforePublicFiltering: [],
    reviewedMechanicalCounters: [],
  };
}

function hasMatchingCounterRankingV2ReviewEnemy(
  row: CounterRankingV2PublicReviewRow,
  enemyChampion: string,
) {
  return normalizeCounterPickStatsKey(row.enemy_champion_id) ===
    normalizeCounterPickStatsKey(enemyChampion);
}

function hasMatchingCounterRankingV2ReviewCounter(
  row: CounterRankingV2PublicReviewRow,
  counterChampion: string,
) {
  return normalizeCounterPickStatsKey(row.counter_champion_id) ===
    normalizeCounterPickStatsKey(counterChampion);
}

function isPublicEligibleCounterRankingV2ReviewRow(
  row: CounterRankingV2PublicReviewRow,
  role: LeagueRole,
) {
  return (
    row.public_eligible &&
    isChampionSupportedInRole(row.counter_champion_id, role) &&
    isChampionSupportedInRole(row.enemy_champion_id, role) &&
    counterRankingV2PublicApprovedReviewStatuses.includes(
      row.review_status as (typeof counterRankingV2PublicApprovedReviewStatuses)[number],
    )
  );
}

function orientCounterPickStatForSelectedChampionGoodInto(
  stat: CounterPickStat,
  selectedChampionId: string,
): CounterPickStat {
  return {
    ...stat,
    counter_champion_id: stat.enemy_champion_id,
    enemy_champion_id: selectedChampionId,
    losses: stat.wins,
    win_rate: Number((100 - Number(stat.win_rate)).toFixed(2)),
    wins: stat.losses,
  };
}

function getReviewedCountersWithoutStats(
  reviewedMechanicalCounters: PublicReviewedMechanicalCounter[],
  stats: CounterPickStat[],
) {
  const statsChampionIds = new Set(
    stats.map((stat) => normalizeCounterPickStatsKey(stat.counter_champion_id)),
  );

  return reviewedMechanicalCounters
    .filter((counter) => !statsChampionIds.has(normalizeCounterPickStatsKey(counter.counterChampionId)))
    .map((counter) => counter.counterChampionId);
}

function getCounterPickStatDebugSnapshot(stat: CounterPickStat) {
  return {
    counterChampionId: stat.counter_champion_id,
    enemyChampionId: stat.enemy_champion_id,
    games: stat.games,
    role: stat.role,
    winRate: stat.win_rate,
  };
}

function getReviewedMechanicalCountersPublicFeatureFlag() {
  return process.env.NEXT_PUBLIC_USE_REVIEWED_MECHANICAL_COUNTERS_PUBLICLY === "true";
}

function logPublicReviewedMechanicalCountersDebug({
  fetchedReviewRows,
  featureFlagValue,
  filteredReviewRows,
  finalPublicCounterIds,
  finalPublicGoodIntoIds,
  inverseFilteredReviewRows,
  inverseReviewedCounterChampionIds,
  mergedBestCounterIdsBeforeFinalSorting,
  mergedGoodIntoIdsBeforeFinalSorting,
  reviewedCounterChampionIds,
  reviewedCountersRenderedWithoutStats,
  role,
  selectedEnemyChampionId,
  selectedCounterReviewRowsBeforePublicFiltering,
  selectedEnemyReviewRowsBeforePublicFiltering,
  statsRowsFetchedForInverseReviewedCounterIds,
  statsRowsFetchedForReviewedCounterIds,
}: {
  fetchedReviewRows: CounterRankingV2PublicReviewRow[];
  featureFlagValue: boolean;
  filteredReviewRows: CounterRankingV2PublicReviewRow[];
  finalPublicCounterIds: string[];
  finalPublicGoodIntoIds: string[];
  inverseFilteredReviewRows: CounterRankingV2PublicReviewRow[];
  inverseReviewedCounterChampionIds: string[];
  mergedBestCounterIdsBeforeFinalSorting: string[];
  mergedGoodIntoIdsBeforeFinalSorting: string[];
  reviewedCounterChampionIds: string[];
  reviewedCountersRenderedWithoutStats: string[];
  role: LeagueRole;
  selectedEnemyChampionId: string;
  selectedCounterReviewRowsBeforePublicFiltering: CounterRankingV2PublicReviewRow[];
  selectedEnemyReviewRowsBeforePublicFiltering: CounterRankingV2PublicReviewRow[];
  statsRowsFetchedForInverseReviewedCounterIds: ReturnType<typeof getCounterPickStatDebugSnapshot>[];
  statsRowsFetchedForReviewedCounterIds: ReturnType<typeof getCounterPickStatDebugSnapshot>[];
}) {
  const normalizedSelectedEnemyChampionId = normalizeCounterPickStatsKey(selectedEnemyChampionId);

  console.info("[Counter Pick] reviewed mechanical counter public flow", {
    featureFlagValue,
    selectedEnemyChampionId,
    normalizedSelectedEnemyChampionId,
    selectedRole: role,
    reviewQuery: {
      enemyChampionId: selectedEnemyChampionId,
      role,
      table: "counter_ranking_v2_mechanical_reviews",
    },
    fetchedReviewRowsBeforeFiltering: fetchedReviewRows,
    fetchedReviewRowChampionIds: fetchedReviewRows.map((row) => ({
      counterChampionId: row.counter_champion_id,
      enemyChampionId: row.enemy_champion_id,
      publicEligible: row.public_eligible,
      reviewStatus: row.review_status,
    })),
    reviewRowsForSelectedEnemyBeforePublicFiltering:
      selectedEnemyReviewRowsBeforePublicFiltering,
    reviewRowsForSelectedCounterBeforePublicFiltering:
      selectedCounterReviewRowsBeforePublicFiltering,
    reviewRowsAfterPublicEligibleStatusFiltering: filteredReviewRows,
    inverseReviewRowsAfterPublicEligibleStatusFiltering: inverseFilteredReviewRows,
    reviewedCounterChampionIds,
    inverseReviewedCounterChampionIds,
    statsRowsFetchedForReviewedCounterIds,
    statsRowsFetchedForInverseReviewedCounterIds,
    mergedBestCounterIdsBeforeFinalSorting,
    mergedGoodIntoIdsBeforeFinalSorting,
    reviewedCountersRenderedWithoutStats,
    finalPublicCounterIds,
    finalPublicGoodIntoIds,
  });
}

function getNotEnoughDataCounterPickStats({
  counterChampion,
  enemyChampion,
  patch,
  role,
}: Omit<CounterPickStatsInput, "patch"> & { patch: string }): CounterPickMatchupStats {
  return {
    confidence: "not_enough_data",
    counterChampion,
    enemyChampion,
    games: 0,
    lastUpdatedAt: "",
    patch,
    role,
    tier: "D",
    winRate: 0,
    wins: 0,
  };
}

export async function fetchCounterPickStatsForSelectedChampion({
  client,
  enemyChampion,
  patch = null,
  role,
}: FetchCounterPickStatsInput): Promise<CounterPickStatsResult> {
  return fetchCounterPickStatsForEnemy({
    client,
    enemyChampion,
    patch,
    role,
  });
}

export function getCounterPickStats({
  counterChampion,
  enemyChampion,
  patch = null,
  role,
}: CounterPickStatsInput): CounterPickMatchupStats {
  const requestedPatch = patch ?? defaultMockPatch;
  const stats = mockCounterPickStatsByKey.get(
    getCounterPickStatsKey({
      counterChampion,
      enemyChampion,
      patch: requestedPatch,
      role,
    }),
  );

  return (
    stats ??
    getNotEnoughDataCounterPickStats({
      counterChampion,
      enemyChampion,
      patch: requestedPatch,
      role,
    })
  );
}

export function calculateCounterTier({
  confidence,
  games,
  winRate,
}: CalculateCounterTierInput): CounterPickStatisticsTier {
  if (confidence === "not_enough_data" || games < minimumTrustedCounterPickGames) {
    return "D";
  }

  const baseTier = calculateCounterPickStatTier({ games, winRate });

  if (confidence === "low" && tierSortValue[baseTier] > tierSortValue.A) {
    return "A";
  }

  return baseTier;
}

export function compareCounterPickProviderStats(
  left: CounterPickMatchupStats,
  right: CounterPickMatchupStats,
  direction: "asc" | "desc",
) {
  const confidenceSort =
    confidenceSortValue[right.confidence] - confidenceSortValue[left.confidence];

  if (confidenceSort !== 0) {
    return confidenceSort;
  }

  const tierSort =
    direction === "desc"
      ? tierSortValue[right.tier] - tierSortValue[left.tier]
      : tierSortValue[left.tier] - tierSortValue[right.tier];

  if (tierSort !== 0) {
    return tierSort;
  }

  if (left.winRate !== right.winRate) {
    return direction === "desc" ? right.winRate - left.winRate : left.winRate - right.winRate;
  }

  return right.games - left.games;
}

function createMockCounterPickStats(seed: MockCounterPickStatsSeed): CounterPickMatchupStats {
  const wins = Math.round(seed.games * (seed.winRate / 100));
  const confidence = getCounterPickStatsConfidence(seed.games);

  return {
    ...seed,
    confidence,
    lastUpdatedAt: seed.lastUpdatedAt ?? mockLastUpdatedAt,
    tier: calculateCounterTier({
      confidence,
      games: seed.games,
      winRate: seed.winRate,
    }),
    wins,
  };
}

function getCounterPickStatsConfidence(games: number): CounterPickStatsConfidence {
  const confidence = calculateCounterPickConfidence(games);

  if (confidence.level === "insufficient") {
    return "not_enough_data";
  }

  if (confidence.level === "strong") {
    return "high";
  }

  if (confidence.level === "moderate") {
    return "medium";
  }

  return "low";
}

function getCounterPickStatsKey({
  counterChampion,
  enemyChampion,
  patch,
  role,
}: Pick<CounterPickMatchupStats, "counterChampion" | "enemyChampion" | "patch" | "role">) {
  return [
    normalizeCounterPickStatsKey(enemyChampion),
    normalizeCounterPickStatsKey(counterChampion),
    role,
    patch,
  ].join("::");
}

function normalizeCounterPickStatsKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}
