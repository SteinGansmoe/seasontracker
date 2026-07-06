import type { LeagueCounterPick } from "@/src/features/league/counter-picks";
import type { LeagueCounterPickMatchStatistic } from "@/src/features/league/counter-pick-match-statistics";
import {
  calculateCounterPickConfidence,
  lowCounterPickConfidenceGames,
  minimumPublicCounterPickGames,
  type CounterPickConfidence,
} from "./counter-pick-confidence.ts";
import { counterRankingV2PublicApprovedReviewStatuses } from "./counter-ranking-v2.ts";

export type CounterPickStatisticsTier = "A" | "B" | "C" | "D" | "S" | "S+";
export type CounterPickSampleConfidence = "high" | "low" | "low_sample" | "medium";
export type CounterPickStatisticsSource =
  | "league_counter_picks"
  | "manual"
  | "match_statistics_cache"
  | "provider";
export type PublicCounterResultLabel =
  | "design_counter"
  | "hard_countered"
  | "high_mastery"
  | "low_sample"
  | "mechanically_countered"
  | "strong_stats_design_counter"
  | "verified_counter";

export type CounterPickStatistics = {
  confidence: CounterPickConfidence;
  games: number | null;
  lastUpdatedAt: string | null;
  patch: string | null;
  rankFilter: string | null;
  region: string | null;
  sampleConfidence: CounterPickSampleConfidence | null;
  source: CounterPickStatisticsSource;
  tier: CounterPickStatisticsTier | null;
  publicLabels?: PublicCounterResultLabel[];
  winRate: number | null;
  wins: number | null;
};

export type PublicCounterResult = {
  games: number;
  listedChampionId: string;
  listedChampionWinRate: number;
  losses: number;
  selectedChampionId: string;
  selectedChampionWinRate: number;
  statistics: CounterPickStatistics;
  tier: CounterPickStatisticsTier | null;
  wins: number;
};

export type PublicCounterResultBuckets = {
  countersIntoSelectedChampion: PublicCounterResult[];
  selectedChampionGoodInto: PublicCounterResult[];
};

export type PublicReviewedMechanicalCounter = {
  counterChampionId: string;
  direction?: "counter_into_selected" | "selected_good_into";
  enemyChampionId: string;
  highMasteryRequired?: boolean;
  publicEligible: boolean;
  reviewStatus: "verified_soft_counter" | "verified_strong_counter" | string;
};

export type DirectedCounterPickAggregateForPublicResult = {
  counter_champion_id: string;
  enemy_champion_id: string;
  games: number;
  losses: number;
  patch: string;
  rank_bracket?: string | null;
  role: string;
  tier: CounterPickStatisticsTier;
  updated_at: string;
  win_rate: number;
  wins: number;
};

// Stored public rows are loaded with enemy_champion_id equal to the selected champion.
// In that orientation, wins/losses/win_rate describe the selected enemy champion,
// so the listed counter champion's public WR is the inverse of the stored WR.
export type CounterPickStatisticsTierThreshold = {
  minimumWinRate: number;
  tier: CounterPickStatisticsTier;
};

export const counterPickStatisticsTierThresholds: CounterPickStatisticsTierThreshold[] = [
  { minimumWinRate: 55, tier: "S+" },
  { minimumWinRate: 53, tier: "S" },
  { minimumWinRate: 51, tier: "A" },
  { minimumWinRate: 49, tier: "B" },
  { minimumWinRate: 47, tier: "C" },
  { minimumWinRate: 0, tier: "D" },
];

export const minimumTrustedCounterPickGames = 100;
export const publicCounterPickLowSampleThreshold = lowCounterPickConfidenceGames;
export const publicCounterPickMinimumRankedGames = minimumPublicCounterPickGames;
export const EVEN_MATCHUP_MIN_WIN_RATE = 48;
export const EVEN_MATCHUP_MAX_WIN_RATE = 52;

const counterPickStatisticsTierSortValues = {
  "S+": 5,
  S: 4,
  A: 3,
  B: 2,
  C: 1,
  D: 0,
} as const satisfies Record<CounterPickStatisticsTier, number>;

export const emptyCounterPickStatistics: CounterPickStatistics = {
  confidence: calculateCounterPickConfidence(0),
  games: null,
  lastUpdatedAt: null,
  patch: null,
  rankFilter: null,
  region: null,
  sampleConfidence: null,
  source: "manual",
  tier: null,
  winRate: null,
  wins: null,
};

export function getCounterPickStatisticsFromCounterPick(
  counterPick: Pick<LeagueCounterPick, "games" | "patch" | "rank_filter" | "region" | "win_rate">,
): CounterPickStatistics {
  const sampleConfidence = getCounterPickSampleConfidence(counterPick.games);

  return {
    confidence: calculateCounterPickConfidence(counterPick.games ?? 0),
    games: counterPick.games,
    lastUpdatedAt: null,
    patch: counterPick.patch,
    rankFilter: counterPick.rank_filter,
    region: counterPick.region,
    sampleConfidence,
    source: "league_counter_picks",
    tier: getCounterPickStatisticsTier(counterPick.win_rate, counterPick.games, sampleConfidence),
    winRate: counterPick.win_rate,
    wins: null,
  };
}

export function getCounterPickStatisticsFromMatchStatistic(
  statistic: LeagueCounterPickMatchStatistic,
): CounterPickStatistics {
  return {
    confidence: calculateCounterPickConfidence(statistic.games),
    games: statistic.games,
    lastUpdatedAt: statistic.last_updated_at,
    patch: statistic.patch,
    rankFilter: null,
    region: null,
    sampleConfidence: statistic.sample_confidence,
    source: "match_statistics_cache",
    tier: getCounterPickStatisticsTier(
      statistic.win_rate,
      statistic.games,
      statistic.sample_confidence,
    ),
    winRate: statistic.win_rate,
    wins: statistic.wins,
  };
}

export function getCounterPickSampleConfidence(games: number | null) {
  if (games === null || games < publicCounterPickLowSampleThreshold) {
    return "low_sample";
  }

  if (games < 500) {
    return "low";
  }

  if (games < 1000) {
    return "medium";
  }

  return "high";
}

export function getCounterPickStatisticsTier(
  winRate: number | null,
  games: number | null = null,
  sampleConfidence: CounterPickSampleConfidence | null = null,
) {
  if (winRate === null || games === null || games < minimumTrustedCounterPickGames) {
    return null;
  }

  const tier =
    counterPickStatisticsTierThresholds.find((threshold) => winRate >= threshold.minimumWinRate)
      ?.tier ?? "D";

  if (
    sampleConfidence === "low" &&
    counterPickStatisticsTierSortValues[tier] > counterPickStatisticsTierSortValues.A
  ) {
    return "A";
  }

  return tier;
}

export function hasCounterPickStatistics(statistics: CounterPickStatistics) {
  return statistics.winRate !== null || statistics.games !== null;
}

export function isCounterPickStatisticsTrusted(statistics: CounterPickStatistics) {
  return statistics.winRate !== null && statistics.games !== null;
}

export function isCounterPickStatisticsPubliclyRanked(statistics: CounterPickStatistics) {
  return isCounterPickStatisticsTrusted(statistics) && statistics.confidence.publiclyRanked;
}

export function hasPublicCounterResultLabel(
  statistics: Pick<CounterPickStatistics, "publicLabels">,
  label: PublicCounterResultLabel,
) {
  return Boolean(statistics.publicLabels?.includes(label));
}

export function getPublicCounterResultsForSelectedChampionStats(
  stats: DirectedCounterPickAggregateForPublicResult[],
  selectedChampionId: string,
  options: {
    reviewedMechanicalCounters?: PublicReviewedMechanicalCounter[];
    useReviewedMechanicalCounters?: boolean;
  } = {},
): PublicCounterResultBuckets {
  const countersIntoSelectedChampion: PublicCounterResult[] = [];
  const selectedChampionGoodInto: PublicCounterResult[] = [];
  const allObservedResultsByChampionId = new Map<string, PublicCounterResult>();
  const countersIntoSelectedChampionByChampionId = new Map<string, PublicCounterResult>();
  const selectedChampionGoodIntoByChampionId = new Map<string, PublicCounterResult>();
  const listedChampionIds = new Set<string>();

  for (const stat of stats) {
    const result = toPublicCounterPickResult(stat, selectedChampionId);

    if (!result) {
      continue;
    }

    const listedChampionKey = getPublicCounterResultIdentityKey(result.listedChampionId);
    allObservedResultsByChampionId.set(listedChampionKey, result);

    if (listedChampionIds.has(listedChampionKey)) {
      continue;
    }

    if (isCounterIntoSelectedChampion(result)) {
      countersIntoSelectedChampion.push(result);
      countersIntoSelectedChampionByChampionId.set(listedChampionKey, result);
      listedChampionIds.add(listedChampionKey);
    } else if (isSelectedChampionGoodInto(result)) {
      selectedChampionGoodInto.push(result);
      selectedChampionGoodIntoByChampionId.set(listedChampionKey, result);
      listedChampionIds.add(listedChampionKey);
    }
  }

  if (options.useReviewedMechanicalCounters) {
    for (const reviewedCounter of options.reviewedMechanicalCounters ?? []) {
      const reviewedCounterDirection = getPublicReviewedMechanicalCounterDirection(
        reviewedCounter,
        selectedChampionId,
      );

      if (!reviewedCounterDirection) {
        continue;
      }

      const isInverseCounter = reviewedCounterDirection === "selected_good_into";
      const listedChampionId = isInverseCounter
        ? reviewedCounter.enemyChampionId
        : reviewedCounter.counterChampionId;
      const listedChampionKey = getPublicCounterResultIdentityKey(listedChampionId);
      const targetBucket = isInverseCounter
        ? selectedChampionGoodInto
        : countersIntoSelectedChampion;
      const targetBucketByChampionId = isInverseCounter
        ? selectedChampionGoodIntoByChampionId
        : countersIntoSelectedChampionByChampionId;
      const existingCounter = targetBucketByChampionId.get(listedChampionKey);

      if (existingCounter) {
        existingCounter.statistics.publicLabels = getPublicReviewedMechanicalCounterLabels({
          direction: reviewedCounterDirection,
          highMasteryRequired: reviewedCounter.highMasteryRequired,
          reviewStatus: reviewedCounter.reviewStatus,
          statistics: existingCounter.statistics,
        });
        continue;
      }

      const observedResult = allObservedResultsByChampionId.get(listedChampionKey);
      const designCounterResult = observedResult
        ? clonePublicCounterResultWithLabels(observedResult, {
            direction: reviewedCounterDirection,
            highMasteryRequired: reviewedCounter.highMasteryRequired,
            reviewStatus: reviewedCounter.reviewStatus,
          })
        : createDesignCounterPublicResult({
            direction: reviewedCounterDirection,
            highMasteryRequired: reviewedCounter.highMasteryRequired,
            listedChampionId,
            reviewStatus: reviewedCounter.reviewStatus,
            selectedChampionId,
          });

      targetBucket.push(designCounterResult);
      targetBucketByChampionId.set(listedChampionKey, designCounterResult);
    }
  }

  return {
    countersIntoSelectedChampion: sortPublicCounterResults(
      countersIntoSelectedChampion,
      "best-counter",
    ),
    selectedChampionGoodInto: sortPublicCounterResults(
      selectedChampionGoodInto,
      "countered-by",
    ),
  };
}

function sortPublicCounterResults(
  results: PublicCounterResult[],
  direction: "best-counter" | "countered-by",
) {
  const statisticDirection = direction === "best-counter" ? "desc" : "asc";

  return [...results].sort((left, right) => {
    const mechanicalSort =
      getPublicMechanicalCounterSortValue(right.statistics) -
      getPublicMechanicalCounterSortValue(left.statistics);

    if (mechanicalSort !== 0) {
      return mechanicalSort;
    }

    const statisticsSort = compareCounterPickStatistics(
      left.statistics,
      right.statistics,
      statisticDirection,
    );

    if (statisticsSort !== 0) {
      return statisticsSort;
    }

    return left.listedChampionId.localeCompare(right.listedChampionId);
  });
}

function getPublicMechanicalCounterSortValue(
  statistics: Pick<CounterPickStatistics, "publicLabels">,
) {
  if (
    hasPublicCounterResultLabel(statistics, "hard_countered") ||
    hasPublicCounterResultLabel(statistics, "strong_stats_design_counter")
  ) {
    return 2;
  }

  if (
    hasPublicCounterResultLabel(statistics, "design_counter") ||
    hasPublicCounterResultLabel(statistics, "mechanically_countered")
  ) {
    return 1;
  }

  return 0;
}

function getPublicReviewedMechanicalCounterDirection(
  reviewedCounter: PublicReviewedMechanicalCounter,
  selectedChampionId: string,
) {
  if (!isPublicReviewedMechanicalCounterEligible(reviewedCounter)) {
    return null;
  }

  const selectedChampionKey = getPublicCounterResultIdentityKey(selectedChampionId);
  const enemyChampionKey = getPublicCounterResultIdentityKey(reviewedCounter.enemyChampionId);
  const counterChampionKey = getPublicCounterResultIdentityKey(reviewedCounter.counterChampionId);

  if (enemyChampionKey === selectedChampionKey) {
    return "counter_into_selected";
  }

  if (counterChampionKey === selectedChampionKey) {
    return "selected_good_into";
  }

  return null;
}

function isPublicReviewedMechanicalCounterEligible(
  reviewedCounter: PublicReviewedMechanicalCounter,
) {
  return (
    reviewedCounter.publicEligible &&
    counterRankingV2PublicApprovedReviewStatuses.includes(
      reviewedCounter.reviewStatus as (typeof counterRankingV2PublicApprovedReviewStatuses)[number],
    )
  );
}

function clonePublicCounterResultWithLabels(
  result: PublicCounterResult,
  {
    direction,
    highMasteryRequired,
    reviewStatus,
  }: {
    direction: "counter_into_selected" | "selected_good_into";
    highMasteryRequired?: boolean;
    reviewStatus: PublicReviewedMechanicalCounter["reviewStatus"];
  },
): PublicCounterResult {
  return {
    ...result,
    statistics: {
      ...result.statistics,
      winRate:
        result.statistics.winRate ?? (result.games > 0 ? result.listedChampionWinRate : null),
      publicLabels: getPublicReviewedMechanicalCounterLabels({
        direction,
        highMasteryRequired,
        reviewStatus,
        statistics: result.statistics,
      }),
    },
  };
}

function createDesignCounterPublicResult({
  direction,
  highMasteryRequired,
  listedChampionId,
  reviewStatus,
  selectedChampionId,
}: {
  direction: "counter_into_selected" | "selected_good_into";
  highMasteryRequired?: boolean;
  listedChampionId: string;
  reviewStatus: PublicReviewedMechanicalCounter["reviewStatus"];
  selectedChampionId: string;
}): PublicCounterResult {
  const confidence = calculateCounterPickConfidence(0);
  const statistics: CounterPickStatistics = {
    ...emptyCounterPickStatistics,
    confidence,
    games: 0,
    publicLabels: getPublicReviewedMechanicalCounterLabels({
      direction,
      highMasteryRequired,
      reviewStatus,
      statistics: {
        ...emptyCounterPickStatistics,
        confidence,
      },
    }),
    sampleConfidence: "low_sample",
    source: "provider",
  };

  return {
    games: 0,
    listedChampionId,
    listedChampionWinRate: 0,
    losses: 0,
    selectedChampionId,
    selectedChampionWinRate: 0,
    statistics,
    tier: null,
    wins: 0,
  };
}

function getPublicReviewedMechanicalCounterLabels({
  direction,
  highMasteryRequired,
  reviewStatus,
  statistics,
}: {
  direction: "counter_into_selected" | "selected_good_into";
  highMasteryRequired?: boolean;
  reviewStatus: PublicReviewedMechanicalCounter["reviewStatus"];
  statistics: Pick<CounterPickStatistics, "confidence" | "publicLabels">;
}): PublicCounterResultLabel[] {
  const labels = new Set<PublicCounterResultLabel>(statistics.publicLabels ?? []);

  labels.delete("design_counter");
  labels.delete("strong_stats_design_counter");
  labels.delete("verified_counter");
  labels.delete("hard_countered");
  labels.delete("high_mastery");
  labels.delete("mechanically_countered");

  if (direction === "selected_good_into") {
    if (reviewStatus === "verified_strong_counter") {
      labels.add("hard_countered");
    } else {
      labels.add("mechanically_countered");
    }
  } else {
    if (reviewStatus === "verified_strong_counter") {
      labels.add("strong_stats_design_counter");
    } else {
      labels.add("design_counter");
    }
  }

  if (!statistics.confidence.publiclyRanked) {
    labels.add("low_sample");
  }

  if (highMasteryRequired) {
    labels.add("high_mastery");
  }

  return Array.from(labels);
}

export function toPublicCounterPickResult(
  stat: DirectedCounterPickAggregateForPublicResult,
  selectedChampionId: string,
): PublicCounterResult | null {
  if (
    getPublicCounterResultIdentityKey(stat.enemy_champion_id) !==
    getPublicCounterResultIdentityKey(selectedChampionId)
  ) {
    return null;
  }

  const listedChampionId = stat.counter_champion_id;
  const selectedChampionWinRate = Number(stat.win_rate);
  const listedChampionWinRate =
    stat.games > 0 ? getReverseCounterPickWinRate(selectedChampionWinRate) : 0;
  const wins = stat.losses;
  const losses = stat.wins;
  const confidence = calculateCounterPickConfidence(stat.games);
  const sampleConfidence = getCounterPickSampleConfidence(stat.games);
  const isRanked = confidence.publiclyRanked;
  const tier = getCounterPickStatisticsTier(listedChampionWinRate, stat.games, sampleConfidence);

  return {
    games: stat.games,
    listedChampionId,
    listedChampionWinRate,
    losses,
    selectedChampionId,
    selectedChampionWinRate,
    statistics: {
      confidence,
      games: stat.games,
      lastUpdatedAt: stat.updated_at,
      patch: stat.patch,
      rankFilter: stat.rank_bracket ?? null,
      region: null,
      sampleConfidence,
      source: "provider",
      tier,
      winRate: isRanked ? listedChampionWinRate : null,
      wins,
    },
    tier,
    wins,
  };
}

export function isCounterIntoSelectedChampion(
  result: Pick<PublicCounterResult, "listedChampionWinRate">,
) {
  return result.listedChampionWinRate > EVEN_MATCHUP_MAX_WIN_RATE;
}

export function isSelectedChampionGoodInto(
  result: Pick<PublicCounterResult, "listedChampionWinRate">,
) {
  return result.listedChampionWinRate < EVEN_MATCHUP_MIN_WIN_RATE;
}

export function getReverseCounterPickWinRate(winRate: number) {
  return Number((100 - Number(winRate)).toFixed(2));
}

function getPublicCounterResultIdentityKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function getCounterPickPublicTierLabel(statistics: CounterPickStatistics) {
  if (!isCounterPickStatisticsTrusted(statistics) || !statistics.confidence.tierVisible) {
    return statistics.confidence.level === "very_low" ? "Preliminary" : "Not enough data";
  }

  return statistics.tier ? `${statistics.tier} Tier` : "Not enough data";
}

export function compareCounterPickStatistics(
  left: CounterPickStatistics,
  right: CounterPickStatistics,
  direction: "asc" | "desc",
) {
  const isLeftTrusted = isCounterPickStatisticsTrusted(left);
  const isRightTrusted = isCounterPickStatisticsTrusted(right);

  if (isLeftTrusted && isRightTrusted) {
    const leftWinRate = left.winRate ?? 0;
    const rightWinRate = right.winRate ?? 0;

    if (leftWinRate !== rightWinRate) {
      return direction === "desc" ? rightWinRate - leftWinRate : leftWinRate - rightWinRate;
    }

    const gamesSort = (right.games ?? 0) - (left.games ?? 0);

    if (gamesSort !== 0) {
      return gamesSort;
    }

    const leftTier = getCounterPickStatisticsTierSortValue(left);
    const rightTier = getCounterPickStatisticsTierSortValue(right);
    const tierSort = direction === "desc" ? rightTier - leftTier : leftTier - rightTier;

    if (tierSort !== 0) {
      return tierSort;
    }
  }

  if (isLeftTrusted && !isRightTrusted) {
    return -1;
  }

  if (isRightTrusted && !isLeftTrusted) {
    return 1;
  }

  return (right.games ?? 0) - (left.games ?? 0);
}

function getCounterPickStatisticsTierSortValue(statistics: CounterPickStatistics) {
  return statistics.tier
    ? counterPickStatisticsTierSortValues[statistics.tier]
    : counterPickStatisticsTierSortValues.D;
}
