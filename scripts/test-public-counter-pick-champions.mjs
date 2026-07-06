import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const optionsModule = await import("../src/features/league/public-counter-pick-options.ts");
const statisticsModule = await import("../src/features/league/counter-pick-statistics.ts");
const confidenceModule = await import("../src/features/league/counter-pick-confidence.ts");

const { getPublicCounterPickChampionSearchText, matchesPublicCounterPickChampionSearch } =
  optionsModule;
const {
  compareCounterPickStatistics,
  getPublicCounterResultsForSelectedChampionStats,
  hasPublicCounterResultLabel,
  isCounterIntoSelectedChampion,
  isCounterPickStatisticsPubliclyRanked,
  isCounterPickStatisticsTrusted,
  isSelectedChampionGoodInto,
  publicCounterPickLowSampleThreshold,
  toPublicCounterPickResult,
} = statisticsModule;
const { calculateCounterPickConfidence } = confidenceModule;

const championRows = [
  champion("Ahri", "Ahri", "the Nine-Tailed Fox", ["Mage", "Assassin"], true),
  champion("Kaisa", "Kai'Sa", "Daughter of the Void", ["Marksman"], true),
  champion("Khazix", "Kha'Zix", "the Voidreaver", ["Assassin"], true),
  champion("MonkeyKing", "Wukong", "the Monkey King", ["Fighter"], true),
  champion("Fiddlesticks", "Fiddlesticks", "the Ancient Fear", ["Mage"], true),
  champion("Nunu", "Nunu & Willump", "the Boy and His Yeti", ["Tank"], true),
  champion("DrMundo", "Dr. Mundo", "the Madman of Zaun", ["Fighter", "Tank"], true),
  champion("Velkoz", "Vel'Koz", "the Eye of the Void", ["Mage"], true),
  champion("RekSai", "Rek'Sai", "the Void Burrower", ["Fighter"], true),
  champion("KSante", "K'Sante", "the Pride of Nazumah", ["Tank"], true),
  champion("OldAatrox", "Old Aatrox", "inactive fixture", ["Fighter"], false),
];

const activeOptions = championRows
  .filter((row) => row.is_active)
  .sort((left, right) => left.name.localeCompare(right.name));

assert.equal(activeOptions.length, championRows.filter((row) => row.is_active).length);
assert.equal(new Set(activeOptions.map((row) => row.id)).size, activeOptions.length);
assert.equal(
  activeOptions.some((row) => row.id === "OldAatrox"),
  false,
);

for (const [query, expectedId] of [
  ["Ahri", "Ahri"],
  ["kaisa", "Kaisa"],
  ["khazix", "Khazix"],
  ["wukong", "MonkeyKing"],
  ["monkeyking", "MonkeyKing"],
  ["FiddleSticks", "Fiddlesticks"],
  ["nunu willump", "Nunu"],
  ["Dr Mundo", "DrMundo"],
  ["velkoz", "Velkoz"],
  ["reksai", "RekSai"],
  ["ksante", "KSante"],
]) {
  const matches = activeOptions.filter((row) =>
    matchesPublicCounterPickChampionSearch(row, query, ["Mid"]),
  );

  assert.equal(matches[0]?.id, expectedId, `${query} should resolve to ${expectedId}`);
}

const kaisaSearchText = getPublicCounterPickChampionSearchText(
  activeOptions.find((row) => row.id === "Kaisa"),
  ["ADC"],
);
assert.equal(kaisaSearchText.includes("kaisadaughterofthevoidmarksmanadc"), false);
assert.equal(kaisaSearchText.includes("kaisa"), true);
assert.equal(kaisaSearchText.includes("adc"), true);

const worstRows = [
  stat({ games: 80, winRate: 44.2 }),
  stat({ games: 140, winRate: 47.1 }),
  stat({ games: 80, winRate: 44.2, tier: "C" }),
].sort((left, right) => compareCounterPickStatistics(left, right, "asc"));

assert.equal(worstRows[0].winRate, 44.2);
assert.equal(worstRows[0].games, 80);

const bestRows = [
  stat({ games: 20, winRate: 54.8 }),
  stat({ games: 200, winRate: 52.1 }),
  stat({ games: 9, winRate: 60.5 }),
].sort((left, right) => compareCounterPickStatistics(left, right, "desc"));

assert.equal(bestRows[0].winRate, 60.5);
assert.equal(bestRows[0].games, 9);
assert.equal(publicCounterPickLowSampleThreshold, 20);
assert.equal(isCounterPickStatisticsTrusted(bestRows[0]), true);
assert.equal(bestRows[0].games < publicCounterPickLowSampleThreshold, true);

await testPublicCounterPickDirectionMapping();
await testReviewedMechanicalCountersBypassPublicMinimumGames();

console.log("Public Counter Pick champion coverage passed.");

function champion(id, name, title, tags, isActive) {
  return {
    id,
    image_filename: null,
    image_url: `/league/champions/icons/${id.toLowerCase()}.png`,
    is_active: isActive,
    name,
    riot_data_key: id,
    riot_key: id,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    tags,
    title,
    version: "15.12.1",
  };
}

function stat({ games, tier = "B", winRate }) {
  return {
    games,
    confidence: calculateCounterPickConfidence(games),
    lastUpdatedAt: "2026-06-15T00:00:00.000Z",
    patch: "15.12",
    rankFilter: "all",
    region: null,
    sampleConfidence: games < publicCounterPickLowSampleThreshold ? "low_sample" : "low",
    source: "provider",
    tier,
    winRate,
    wins: Math.round(games * (winRate / 100)),
  };
}

async function testPublicCounterPickDirectionMapping() {
  const zed = publicResultFromStoredStat(
    {
      counterChampionId: "Zed",
      enemyChampionId: "Ahri",
      games: 10,
      winRate: 30,
    },
    "Ahri",
  );
  const syndra = publicResultFromStoredStat(
    {
      counterChampionId: "Syndra",
      enemyChampionId: "Ahri",
      games: 8,
      winRate: 50,
    },
    "Ahri",
  );
  const sylas = publicResultFromStoredStat(
    {
      counterChampionId: "Sylas",
      enemyChampionId: "Ahri",
      games: 5,
      winRate: 80,
    },
    "Ahri",
  );
  const zedInverse = publicResultFromStoredStat(
    {
      counterChampionId: "Ahri",
      enemyChampionId: "Zed",
      games: 10,
      winRate: 70,
    },
    "Ahri",
  );
  const talon = publicResultFromStoredStat(
    {
      counterChampionId: "Talon",
      enemyChampionId: "Ahri",
      games: 4,
      winRate: 25,
    },
    "Ahri",
  );
  assert.ok(zed.result);
  assert.ok(syndra.result);
  assert.ok(sylas.result);
  assert.equal(zedInverse.result, null);
  assert.ok(talon.result);

  const publicResults = [zed.result, syndra.result, sylas.result, talon.result];
  const bestIds = publicResults
    .filter(isCounterIntoSelectedChampion)
    .map((result) => result.listedChampionId.toLowerCase())
    .sort();
  const badIds = publicResults
    .filter(isSelectedChampionGoodInto)
    .map((result) => result.listedChampionId.toLowerCase())
    .sort();
  const duplicateIds = bestIds.filter((id) => badIds.includes(id));
  const buckets = getPublicCounterResultsForSelectedChampionStats(
    [
      zed.stat,
      syndra.stat,
      sylas.stat,
      zedInverse.stat,
      storedStat({
        counterChampionId: "Ahri",
        enemyChampionId: "Sylas",
        games: 5,
        winRate: 20,
      }),
      talon.stat,
    ],
    "Ahri",
  );
  const bucketBestIds = buckets.countersIntoSelectedChampion
    .map((result) => result.listedChampionId.toLowerCase())
    .sort();
  const bucketBadIds = buckets.selectedChampionGoodInto
    .map((result) => result.listedChampionId.toLowerCase())
    .sort();
  const bucketZed = buckets.countersIntoSelectedChampion.find(
    (result) => result.listedChampionId === "Zed",
  );
  const bucketSylas = buckets.selectedChampionGoodInto.find(
    (result) => result.listedChampionId === "Sylas",
  );

  assert.equal(zed.result.statistics.winRate, 70);
  assert.equal(sylas.result.statistics.winRate, 20);
  assert.equal(isCounterIntoSelectedChampion(zed.result), true);
  assert.equal(isSelectedChampionGoodInto(zed.result), false);
  assert.notEqual(zed.result.statistics.winRate, 30);
  assert.notEqual(sylas.result.statistics.winRate, 80);
  assert.deepEqual(bestIds, ["talon", "zed"]);
  assert.deepEqual(badIds, ["sylas"]);
  assert.deepEqual(duplicateIds, []);
  assert.equal(syndra.result.statistics.winRate, 50);
  assert.equal(isCounterIntoSelectedChampion(syndra.result), false);
  assert.equal(isSelectedChampionGoodInto(syndra.result), false);
  assert.equal(sylas.result.statistics.confidence.warningVisible, true);
  assert.equal(isCounterPickStatisticsPubliclyRanked(talon.result.statistics), false);
  assert.deepEqual(bucketBestIds, ["talon", "zed"]);
  assert.deepEqual(bucketBadIds, ["sylas"]);
  assert.equal(bucketZed?.statistics.winRate, 70);
  assert.equal(bucketSylas?.statistics.winRate, 20);

  const disabledDesignBuckets = getPublicCounterResultsForSelectedChampionStats(
    [zed.stat],
    "Ahri",
    {
      reviewedMechanicalCounters: [
        reviewedMechanicalCounter({
          counterChampionId: "Annie",
          enemyChampionId: "Ahri",
          publicEligible: true,
          reviewStatus: "verified_strong_counter",
        }),
      ],
      useReviewedMechanicalCounters: false,
    },
  );
  assert.deepEqual(
    disabledDesignBuckets.countersIntoSelectedChampion.map((result) => result.listedChampionId),
    ["Zed"],
    "Feature flag disabled should keep current public output unchanged.",
  );

  const enabledDesignBuckets = getPublicCounterResultsForSelectedChampionStats(
    [
      zed.stat,
      talon.stat,
      storedStat({
        counterChampionId: "Vex",
        enemyChampionId: "Ahri",
        games: 4,
        winRate: 50,
      }),
    ],
    "Ahri",
    {
      reviewedMechanicalCounters: [
        reviewedMechanicalCounter({
          counterChampionId: "Zed",
          enemyChampionId: "Ahri",
          publicEligible: true,
          reviewStatus: "verified_strong_counter",
        }),
        reviewedMechanicalCounter({
          counterChampionId: "Annie",
          enemyChampionId: "Ahri",
          highMasteryRequired: true,
          publicEligible: true,
          reviewStatus: "verified_soft_counter",
        }),
        reviewedMechanicalCounter({
          counterChampionId: "Talon",
          enemyChampionId: "Ahri",
          publicEligible: true,
          reviewStatus: "verified_strong_counter",
        }),
        reviewedMechanicalCounter({
          counterChampionId: "Vex",
          enemyChampionId: "Ahri",
          publicEligible: true,
          reviewStatus: "verified_strong_counter",
        }),
        reviewedMechanicalCounter({
          counterChampionId: "Brand",
          enemyChampionId: "Ahri",
          publicEligible: false,
          reviewStatus: "verified_soft_counter",
        }),
        reviewedMechanicalCounter({
          counterChampionId: "Lux",
          enemyChampionId: "Ahri",
          publicEligible: true,
          reviewStatus: "incorrect_suggestion",
        }),
        reviewedMechanicalCounter({
          counterChampionId: "Orianna",
          enemyChampionId: "Ahri",
          publicEligible: true,
          reviewStatus: "unreviewed",
        }),
        reviewedMechanicalCounter({
          counterChampionId: "Viktor",
          enemyChampionId: "Ahri",
          publicEligible: true,
          reviewStatus: "needs_more_data",
        }),
        reviewedMechanicalCounter({
          counterChampionId: "Akali",
          enemyChampionId: "Ahri",
          highMasteryRequired: true,
          publicEligible: true,
          reviewStatus: "needs_more_data",
        }),
        reviewedMechanicalCounter({
          counterChampionId: "Syndra",
          enemyChampionId: "Ahri",
          publicEligible: true,
          reviewStatus: "not_a_counter",
        }),
      ],
      useReviewedMechanicalCounters: true,
    },
  );
  const enabledDesignIds = enabledDesignBuckets.countersIntoSelectedChampion.map(
    (result) => result.listedChampionId,
  );
  const enabledZedRows = enabledDesignBuckets.countersIntoSelectedChampion.filter(
    (result) => result.listedChampionId === "Zed",
  );
  const enabledAnnie = enabledDesignBuckets.countersIntoSelectedChampion.find(
    (result) => result.listedChampionId === "Annie",
  );
  const enabledTalon = enabledDesignBuckets.countersIntoSelectedChampion.find(
    (result) => result.listedChampionId === "Talon",
  );
  const enabledVex = enabledDesignBuckets.countersIntoSelectedChampion.find(
    (result) => result.listedChampionId === "Vex",
  );

  assert.equal(enabledDesignIds.includes("Annie"), true);
  assert.equal(enabledDesignIds.includes("Vex"), true);
  assert.equal(
    enabledZedRows.length,
    1,
    "Existing observed counters should be enhanced, not duplicated.",
  );
  assert.equal(
    hasPublicCounterResultLabel(enabledZedRows[0].statistics, "strong_stats_design_counter"),
    true,
  );
  assert.equal(hasPublicCounterResultLabel(enabledAnnie.statistics, "design_counter"), true);
  assert.equal(hasPublicCounterResultLabel(enabledAnnie.statistics, "high_mastery"), true);
  assert.equal(hasPublicCounterResultLabel(enabledAnnie.statistics, "low_sample"), true);
  assert.equal(hasPublicCounterResultLabel(enabledTalon.statistics, "low_sample"), true);
  assert.equal(enabledVex.games, 4);
  assert.equal(enabledVex.statistics.winRate, 50);
  assert.equal(hasPublicCounterResultLabel(enabledVex.statistics, "low_sample"), true);
  assert.equal(
    hasPublicCounterResultLabel(enabledVex.statistics, "strong_stats_design_counter"),
    true,
  );
  assert.equal(enabledDesignIds.includes("Brand"), false);
  assert.equal(enabledDesignIds.includes("Lux"), false);
  assert.equal(enabledDesignIds.includes("Orianna"), false);
  assert.equal(enabledDesignIds.includes("Viktor"), false);
  assert.equal(enabledDesignIds.includes("Akali"), false);
  assert.equal(enabledDesignIds.includes("Syndra"), false);
  assert.equal("calculatedMechanicalScore" in enabledAnnie, false);
  assert.equal("manualAdjustment" in enabledAnnie, false);
  assert.equal("finalReviewedScore" in enabledAnnie, false);

  const melFizzReview = reviewedMechanicalCounter({
    counterChampionId: "Fizz",
    enemyChampionId: "Mel",
    publicEligible: true,
    reviewStatus: "verified_strong_counter",
  });
  const melBuckets = getPublicCounterResultsForSelectedChampionStats([], "Mel", {
    reviewedMechanicalCounters: [melFizzReview],
    useReviewedMechanicalCounters: true,
  });
  const fizzBuckets = getPublicCounterResultsForSelectedChampionStats([], "Fizz", {
    reviewedMechanicalCounters: [melFizzReview],
    useReviewedMechanicalCounters: true,
  });
  const disabledFizzBuckets = getPublicCounterResultsForSelectedChampionStats([], "Fizz", {
    reviewedMechanicalCounters: [melFizzReview],
    useReviewedMechanicalCounters: false,
  });

  assert.deepEqual(
    melBuckets.countersIntoSelectedChampion.map((result) => result.listedChampionId),
    ["Fizz"],
    "Mel Mid reviewed row should render Fizz in Best Counters.",
  );
  assert.deepEqual(
    fizzBuckets.selectedChampionGoodInto.map((result) => result.listedChampionId),
    ["Mel"],
    "The same reviewed row should render Mel in Fizz Bad Into.",
  );
  assert.deepEqual(
    fizzBuckets.countersIntoSelectedChampion.map((result) => result.listedChampionId),
    [],
    "The inverse reviewed row should not appear in Fizz Best Counters.",
  );
  assert.deepEqual(
    disabledFizzBuckets.selectedChampionGoodInto.map((result) => result.listedChampionId),
    [],
    "Feature flag disabled should hide inverse reviewed rows.",
  );
  assert.equal(fizzBuckets.selectedChampionGoodInto[0].games, 0);
  assert.equal(fizzBuckets.selectedChampionGoodInto[0].statistics.winRate, null);
  assert.equal(
    hasPublicCounterResultLabel(
      fizzBuckets.selectedChampionGoodInto[0].statistics,
      "hard_countered",
    ),
    true,
  );
  assert.equal(
    hasPublicCounterResultLabel(fizzBuckets.selectedChampionGoodInto[0].statistics, "low_sample"),
    true,
  );

  const melAnnieSoftReview = reviewedMechanicalCounter({
    counterChampionId: "Annie",
    enemyChampionId: "Mel",
    publicEligible: true,
    reviewStatus: "verified_soft_counter",
  });
  const melSoftBuckets = getPublicCounterResultsForSelectedChampionStats([], "Mel", {
    reviewedMechanicalCounters: [melAnnieSoftReview],
    useReviewedMechanicalCounters: true,
  });
  const annieSoftInverseBuckets = getPublicCounterResultsForSelectedChampionStats([], "Annie", {
    reviewedMechanicalCounters: [melAnnieSoftReview],
    useReviewedMechanicalCounters: true,
  });
  const nonPublicSoftBuckets = getPublicCounterResultsForSelectedChampionStats([], "Mel", {
    reviewedMechanicalCounters: [
      reviewedMechanicalCounter({
        counterChampionId: "Brand",
        enemyChampionId: "Mel",
        publicEligible: false,
        reviewStatus: "verified_soft_counter",
      }),
    ],
    useReviewedMechanicalCounters: true,
  });
  const incorrectSuggestionBuckets = getPublicCounterResultsForSelectedChampionStats([], "Mel", {
    reviewedMechanicalCounters: [
      reviewedMechanicalCounter({
        counterChampionId: "Lux",
        enemyChampionId: "Mel",
        publicEligible: true,
        reviewStatus: "incorrect_suggestion",
      }),
    ],
    useReviewedMechanicalCounters: true,
  });
  const needsMoreDataBuckets = getPublicCounterResultsForSelectedChampionStats([], "Mel", {
    reviewedMechanicalCounters: [
      reviewedMechanicalCounter({
        counterChampionId: "Orianna",
        enemyChampionId: "Mel",
        highMasteryRequired: true,
        publicEligible: true,
        reviewStatus: "needs_more_data",
      }),
    ],
    useReviewedMechanicalCounters: true,
  });
  const notCounterBuckets = getPublicCounterResultsForSelectedChampionStats([], "Mel", {
    reviewedMechanicalCounters: [
      reviewedMechanicalCounter({
        counterChampionId: "Syndra",
        enemyChampionId: "Mel",
        publicEligible: true,
        reviewStatus: "not_a_counter",
      }),
    ],
    useReviewedMechanicalCounters: true,
  });
  const notCounterInverseBuckets = getPublicCounterResultsForSelectedChampionStats([], "Syndra", {
    reviewedMechanicalCounters: [
      reviewedMechanicalCounter({
        counterChampionId: "Syndra",
        enemyChampionId: "Mel",
        publicEligible: true,
        reviewStatus: "not_a_counter",
      }),
    ],
    useReviewedMechanicalCounters: true,
  });

  assert.deepEqual(
    melSoftBuckets.countersIntoSelectedChampion.map((result) => result.listedChampionId),
    ["Annie"],
    "Verified soft public-eligible reviews should render in Best Counters.",
  );
  assert.equal(
    hasPublicCounterResultLabel(melSoftBuckets.countersIntoSelectedChampion[0].statistics, "design_counter"),
    true,
  );
  assert.deepEqual(
    annieSoftInverseBuckets.selectedChampionGoodInto.map((result) => result.listedChampionId),
    ["Mel"],
    "Verified soft public-eligible reviews should render inversely in Bad Into.",
  );
  assert.equal(
    hasPublicCounterResultLabel(
      annieSoftInverseBuckets.selectedChampionGoodInto[0].statistics,
      "mechanically_countered",
    ),
    true,
  );
  assert.deepEqual(nonPublicSoftBuckets.countersIntoSelectedChampion, []);
  assert.deepEqual(incorrectSuggestionBuckets.countersIntoSelectedChampion, []);
  assert.deepEqual(
    needsMoreDataBuckets.countersIntoSelectedChampion,
    [],
    "High-mastery needs-more-data rows should not render as public counters.",
  );
  assert.deepEqual(
    notCounterBuckets.countersIntoSelectedChampion,
    [],
    "Not-a-counter public-eligible rows should not render in Best Counters.",
  );
  assert.deepEqual(
    notCounterInverseBuckets.selectedChampionGoodInto,
    [],
    "Not-a-counter public-eligible rows should not render inversely in Bad Into.",
  );
  assert.equal(
    hasPublicCounterResultLabel(
      fizzBuckets.selectedChampionGoodInto[0].statistics,
      "strong_stats_design_counter",
    ),
    false,
    "Bad Into reviewed rows should not use green best-counter mechanical labels.",
  );
  assert.equal(
    hasPublicCounterResultLabel(fizzBuckets.selectedChampionGoodInto[0].statistics, "verified_counter"),
    false,
    "Reviewed mechanical rows should avoid the generic verified counter badge.",
  );
  assert.equal(
    hasPublicCounterResultLabel(fizzBuckets.selectedChampionGoodInto[0].statistics, "low_sample"),
    true,
  );

  const fizzBucketsWithObservedBadRows = getPublicCounterResultsForSelectedChampionStats(
    [
      storedStat({
        counterChampionId: "Syndra",
        enemyChampionId: "Fizz",
        games: 900,
        winRate: 65,
      }),
    ],
    "Fizz",
    {
      reviewedMechanicalCounters: [melFizzReview],
      useReviewedMechanicalCounters: true,
    },
  );

  assert.deepEqual(
    fizzBucketsWithObservedBadRows.selectedChampionGoodInto.map(
      (result) => result.listedChampionId,
    ),
    ["Mel", "Syndra"],
    "Verified strong inverse rows should be promoted above normal observed bad-into rows.",
  );

  const observedFizzIntoMelBuckets = getPublicCounterResultsForSelectedChampionStats(
    [
      storedStat({
        counterChampionId: "Mel",
        enemyChampionId: "Fizz",
        games: 220,
        winRate: 55,
      }),
    ],
    "Fizz",
    {
      reviewedMechanicalCounters: [melFizzReview],
      useReviewedMechanicalCounters: true,
    },
  );
  const observedFizzMelRows = observedFizzIntoMelBuckets.selectedChampionGoodInto.filter(
    (result) => result.listedChampionId === "Mel",
  );

  assert.equal(
    observedFizzMelRows.length,
    1,
    "Existing inverse observed rows should be labeled, not duplicated.",
  );
  assert.equal(observedFizzMelRows[0].games, 220);
  assert.equal(observedFizzMelRows[0].statistics.winRate, 45);
  assert.equal(
    hasPublicCounterResultLabel(
      observedFizzMelRows[0].statistics,
      "hard_countered",
    ),
    true,
  );

  const lowSampleFizzIntoMelBuckets = getPublicCounterResultsForSelectedChampionStats(
    [
      storedStat({
        counterChampionId: "Mel",
        enemyChampionId: "Fizz",
        games: 4,
        winRate: 55,
      }),
    ],
    "Fizz",
    {
      reviewedMechanicalCounters: [melFizzReview],
      useReviewedMechanicalCounters: true,
    },
  );
  const lowSampleFizzMel = lowSampleFizzIntoMelBuckets.selectedChampionGoodInto.find(
    (result) => result.listedChampionId === "Mel",
  );

  assert.ok(lowSampleFizzMel);
  assert.equal(lowSampleFizzMel.games, 4);
  assert.equal(hasPublicCounterResultLabel(lowSampleFizzMel.statistics, "low_sample"), true);
}

async function testReviewedMechanicalCountersBypassPublicMinimumGames() {
  const disabledLowSampleBuckets = getPublicCounterResultsForSelectedChampionStats(
    [
      storedStat({
        counterChampionId: "Vex",
        enemyChampionId: "Yone",
        games: 4,
        winRate: 50,
      }),
    ],
    "Yone",
    {
      reviewedMechanicalCounters: [
        reviewedMechanicalCounter({
          counterChampionId: "Vex",
          enemyChampionId: "Yone",
          publicEligible: true,
          reviewStatus: "verified_strong_counter",
        }),
      ],
      useReviewedMechanicalCounters: false,
    },
  );

  assert.equal(
    disabledLowSampleBuckets.countersIntoSelectedChampion.some(
      (result) => result.listedChampionId === "Vex",
    ),
    false,
    "Low-sample reviewed counters should not alter public output when the flag is disabled.",
  );

  const enabledZeroGameBuckets = getPublicCounterResultsForSelectedChampionStats([], "Yone", {
    reviewedMechanicalCounters: [
      reviewedMechanicalCounter({
        counterChampionId: "Vex",
        enemyChampionId: "Yone",
        publicEligible: true,
        reviewStatus: "verified_strong_counter",
      }),
    ],
    useReviewedMechanicalCounters: true,
  });
  const enabledZeroGameVex = enabledZeroGameBuckets.countersIntoSelectedChampion.find(
    (result) => result.listedChampionId === "Vex",
  );

  assert.ok(enabledZeroGameVex);
  assert.equal(enabledZeroGameVex.games, 0);
  assert.equal(hasPublicCounterResultLabel(enabledZeroGameVex.statistics, "low_sample"), true);
  assert.equal(
    hasPublicCounterResultLabel(enabledZeroGameVex.statistics, "strong_stats_design_counter"),
    true,
  );

  const enabledNormalizedDirectionBuckets = getPublicCounterResultsForSelectedChampionStats(
    [
      storedStat({
        counterChampionId: "vex",
        enemyChampionId: "yone",
        games: 4,
        winRate: 50,
      }),
    ],
    "Yone",
    {
      reviewedMechanicalCounters: [
        reviewedMechanicalCounter({
          counterChampionId: "vex",
          enemyChampionId: "yone",
          publicEligible: true,
          reviewStatus: "verified_strong_counter",
        }),
      ],
      useReviewedMechanicalCounters: true,
    },
  );
  const enabledNormalizedVex = enabledNormalizedDirectionBuckets.countersIntoSelectedChampion.find(
    (result) => result.listedChampionId === "vex",
  );

  assert.ok(enabledNormalizedVex);
  assert.equal(enabledNormalizedVex.games, 4);
  assert.equal(enabledNormalizedVex.statistics.winRate, 50);
  assert.equal(hasPublicCounterResultLabel(enabledNormalizedVex.statistics, "low_sample"), true);

  const wrongDirectionBuckets = getPublicCounterResultsForSelectedChampionStats([], "Yone", {
    reviewedMechanicalCounters: [
      reviewedMechanicalCounter({
        counterChampionId: "Yone",
        enemyChampionId: "Vex",
        publicEligible: true,
        reviewStatus: "verified_strong_counter",
      }),
    ],
    useReviewedMechanicalCounters: true,
  });

  assert.equal(
    wrongDirectionBuckets.countersIntoSelectedChampion.some(
      (result) => result.listedChampionId === "Yone",
    ),
    false,
    "A Vex target review should not render as a Yone target public counter.",
  );

  const providerSource = await readFile(
    new URL("../src/features/league/counter-pick-statistics-provider.ts", import.meta.url),
    "utf8",
  );
  const statSource = await readFile(
    new URL("../src/features/league/counter-pick-stats.ts", import.meta.url),
    "utf8",
  );
  const selectorSource = await readFile(
    new URL("../src/components/league/counter-pick-selector.tsx", import.meta.url),
    "utf8",
  );
  const rankingSource = await readFile(
    new URL("../src/features/league/counter-ranking-v2.ts", import.meta.url),
    "utf8",
  );

  assert.match(providerSource, /fetchCounterPickStatsByEnemyRoleAndCounters/);
  assert.match(providerSource, /fetchCounterPickStatsByCounterAndRole/);
  assert.match(providerSource, /import \{ supabase \} from "@\/src\/lib\/supabase"/);
  assert.match(providerSource, /client = supabase/);
  assert.match(providerSource, /counterChampionIds:\s*reviewedMechanicalCounters\.map/);
  assert.match(providerSource, /inverseReviewedMechanicalCounters/);
  assert.match(providerSource, /orientCounterPickStatForSelectedChampionGoodInto/);
  assert.match(providerSource, /mergeCounterPickStatsForPublicResults/);
  assert.match(providerSource, /\.eq\("role", role\)/);
  assert.doesNotMatch(providerSource, /\.eq\("enemy_champion_id", enemyChampion\)/);
  assert.match(providerSource, /console\.info\("\[Counter Pick\] reviewed mechanical counter public flow"/);
  assert.match(providerSource, /reviewRowsForSelectedEnemyBeforePublicFiltering/);
  assert.match(providerSource, /reviewRowsForSelectedCounterBeforePublicFiltering/);
  assert.match(providerSource, /fetchedReviewRowChampionIds/);
  assert.match(providerSource, /mergedBestCounterIdsBeforeFinalSorting/);
  assert.match(providerSource, /mergedGoodIntoIdsBeforeFinalSorting/);
  assert.match(providerSource, /finalPublicGoodIntoIds/);
  assert.match(statSource, /\.in\("counter_champion_id", counterChampionIds\)/);
  assert.match(selectorSource, /getMechanicalCounterPublicSortValue/);
  assert.match(selectorSource, /hasMechanicalCounterPublicLabel\(row\.stats\)/);
  assert.match(selectorSource, /text: "Hard Countered"/);
  assert.match(selectorSource, /text: "Strong Counter"/);
  assert.match(selectorSource, /text: "Counter"/);
  assert.match(selectorSource, /text: "Countered"/);
  assert.doesNotMatch(selectorSource, /text: "Strong mechanical counter"/);
  assert.doesNotMatch(selectorSource, /text: "Mechanical counter"/);
  assert.match(selectorSource, /border-rose-300\/25 bg-rose-500\/10 text-rose-100/);
  assert.match(selectorSource, /finalFullBestCounterIdsBeforeSlicing/);
  assert.match(selectorSource, /finalVisibleBestCounterIdsAfterSlicing/);
  assert.match(selectorSource, /finalFullBadIntoIdsBeforeSlicing/);
  assert.match(selectorSource, /finalVisibleBadIntoIdsAfterSlicing/);
  assert.match(selectorSource, /vexPresentBeforeSlicing/);
  assert.match(selectorSource, /vexPresentAfterSlicing/);
  assert.match(selectorSource, /const bestCounterIdsKey = useMemo/);
  assert.match(selectorSource, /const badIntoCounterIdsKey = useMemo/);
  assert.match(selectorSource, /const visibleBestCounterIdsKey = useMemo/);
  assert.match(selectorSource, /const visibleBadIntoCounterIdsKey = useMemo/);
  assert.match(
    selectorSource,
    /\}, \[\s*bestCounterIdsKey,\s*badIntoCounterIdsKey,\s*selectedChampion,\s*selectedRole,\s*visibleBadIntoCounterIdsKey,\s*visibleBestCounterIdsKey,\s*\]\);/,
  );
  assert.match(rankingSource, /counterRankingV2PublicApprovedReviewStatuses/);
  assert.match(rankingSource, /isCounterRankingV2ApprovedReviewPublicEligible/);
}

function publicResultFromStoredStat(input, selectedChampionId) {
  const statRow = storedStat(input);

  return {
    result: toPublicCounterPickResult(statRow, selectedChampionId),
    stat: statRow,
  };
}

function storedStat({
  counterChampionId,
  enemyChampionId,
  games,
  patch = "15.12",
  role = "mid",
  tier = "A",
  winRate,
}) {
  const wins = Math.round(games * (winRate / 100));

  return {
    counter_champion_id: counterChampionId,
    enemy_champion_id: enemyChampionId,
    games,
    id: `${enemyChampionId}-${counterChampionId}`,
    losses: games - wins,
    patch,
    rank_bracket: "all",
    role,
    tier,
    updated_at: "2026-06-15T00:00:00.000Z",
    win_rate: winRate,
    wins,
  };
}

function reviewedMechanicalCounter({
  counterChampionId,
  enemyChampionId,
  highMasteryRequired = false,
  publicEligible,
  reviewStatus,
}) {
  return {
    calculatedMechanicalScore: 99,
    counterChampionId,
    enemyChampionId,
    finalReviewedScore: 99,
    highMasteryRequired,
    manualAdjustment: 10,
    publicEligible,
    reviewStatus,
  };
}
