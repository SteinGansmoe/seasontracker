import assert from "node:assert/strict";

import {
  getDirectedAggregateRows,
  persistObservationsAndRebuildStats,
} from "./lib/riot-counter-pick-aggregation.mjs";
import { attributeMatchupObservation } from "./lib/riot-matchup-rank-attribution.mjs";
import { createObservationValidationContext } from "./lib/riot-observation-validation.mjs";

const validationContext = createObservationValidationContext({
  activeChampionIds: ["ahri", "sylas", "zed"],
});

async function testDuplicateObservationIsNotCountedTwice() {
  const supabase = new FakeSupabaseClient();
  const observation = createObservation({
    champion_a: "ahri",
    champion_a_won: false,
    champion_b: "zed",
    match_id: "EUW1_100",
    winner_champion: "zed",
  });

  const result = await persistObservationsAndRebuildStats({
    observations: [observation, { ...observation }],
    scanJobId: 246,
    supabase,
    validationContext,
  });

  assert.equal(result.observationsFound, 1, "duplicate match/role observations are deduped first");
  assert.equal(result.insertedObservations, 1);
  assert.equal(result.duplicateObservationsSkipped, 0);
  assert.equal(result.observationsAggregated, 1);
  assert.equal(supabase.tables.riot_matchup_observations.length, 1);
  assert.equal(getCounterPickStat(supabase, "ahri", "zed", "all").games, 1);
}

async function testDuplicateObservationKeyIncludesRole() {
  const supabase = new FakeSupabaseClient();
  const result = await persistObservationsAndRebuildStats({
    observations: [
      createObservation({
        champion_a: "ahri",
        champion_a_won: false,
        champion_b: "zed",
        match_id: "EUW1_100",
        role: "mid",
        winner_champion: "zed",
      }),
      createObservation({
        champion_a: "ahri",
        champion_a_won: true,
        champion_b: "zed",
        match_id: "EUW1_100",
        role: "top",
        winner_champion: "ahri",
      }),
    ],
    scanJobId: 246,
    supabase,
    validationContext,
  });

  assert.equal(result.observationsFound, 2, "same match in different roles should not dedupe");
  assert.equal(result.insertedObservations, 2);
  assert.equal(result.duplicateObservationsSkipped, 0);
  assert.equal(result.observationsAggregated, 2);
  assert.equal(supabase.tables.riot_matchup_observations.length, 2);
  assert.equal(getCounterPickStat(supabase, "ahri", "zed", "all", "mid").games, 1);
  assert.equal(getCounterPickStat(supabase, "zed", "ahri", "all", "top").games, 1);
}

async function testInvalidObservationIsNotAggregated() {
  const supabase = new FakeSupabaseClient();
  const result = await withSilencedConsole(() =>
    persistObservationsAndRebuildStats({
      observations: [
        createObservation({
          champion_a: "ahri",
          champion_a_won: true,
          champion_b: "ahri",
          match_id: "EUW1_101",
          winner_champion: "ahri",
        }),
      ],
      scanJobId: 246,
      supabase,
      validationContext,
    }),
  );

  assert.equal(result.matchupObservationsRejected, 1);
  assert.equal(result.insertedObservations, 0);
  assert.equal(supabase.tables.riot_matchup_observations.length, 0);
  assert.equal(supabase.tables.counter_pick_stats.length, 0);
}

function testExpectedRankBracketAttribution() {
  const gameStartAt = "2026-06-15T12:00:00.000Z";
  const result = attributeMatchupObservation({
    observation: createObservation({
      champion_a: "ahri",
      champion_a_puuid: "puuid-a",
      champion_a_won: true,
      champion_b: "zed",
      champion_b_puuid: "puuid-b",
      game_start_at: gameStartAt,
      match_id: "EUW1_102",
      winner_champion: "ahri",
    }),
    snapshotsByPuuid: new Map([
      [
        "puuid-a",
        [
          {
            division: "II",
            id: "rank-a",
            observed_at: gameStartAt,
            tier: "GOLD",
          },
        ],
      ],
      [
        "puuid-b",
        [
          {
            division: "IV",
            id: "rank-b",
            observed_at: gameStartAt,
            tier: "EMERALD",
          },
        ],
      ],
    ]),
  });

  assert.equal(result.method, "two-player-average");
  assert.equal(result.rankBracket, "gold-emerald");
}

function testDirectedAggregateRowsIncludeStoredObservation() {
  const rows = getDirectedAggregateRows([
    createObservation({
      champion_a: "ahri",
      champion_a_won: false,
      champion_b: "zed",
      match_id: "EUW1_103",
      rank_bracket: "gold-emerald",
      winner_champion: "zed",
    }),
  ]);

  assert.equal(rows.length, 4, "one ranked observation fans out to bracket and all aggregates");
  assert.equal(getAggregateRow(rows, "ahri", "zed", "all").win_rate, 100);
  assert.equal(getAggregateRow(rows, "ahri", "zed", "gold-emerald").games, 1);
}

async function testValidOneOffChampionGameCountsAsObservation() {
  const supabase = new FakeSupabaseClient();
  const result = await persistObservationsAndRebuildStats({
    observations: [
      createObservation({
        champion_a: "ahri",
        champion_a_won: false,
        champion_b: "zed",
        match_id: "EUW1_104",
        winner_champion: "zed",
      }),
    ],
    scanJobId: 246,
    supabase,
    validationContext,
  });

  assert.equal(result.insertedObservations, 1);
  assert.equal(result.observationsAggregated, 1);
  assert.equal(getCounterPickStat(supabase, "ahri", "zed", "all").games, 1);
}

async function testResolvedNonMainRoleGameCountsAsObservation() {
  const supabase = new FakeSupabaseClient();
  const result = await persistObservationsAndRebuildStats({
    observations: [
      createObservation({
        champion_a: "ahri",
        champion_a_won: true,
        champion_b: "zed",
        match_id: "EUW1_105",
        role: "top",
        winner_champion: "ahri",
      }),
    ],
    scanJobId: 246,
    supabase,
    validationContext,
  });
  const stat = getCounterPickStat(supabase, "zed", "ahri", "all");

  assert.equal(result.insertedObservations, 1);
  assert.equal(result.observationsAggregated, 1);
  assert.equal(stat.games, 1);
  assert.equal(stat.role, "top");
}

async function testPublicCounterPickQueryReadsExpectedRow() {
  const supabase = new FakeSupabaseClient();

  await persistObservationsAndRebuildStats({
    observations: [
      createObservation({
        champion_a: "ahri",
        champion_a_won: false,
        champion_b: "zed",
        match_id: "EUW1_106",
        winner_champion: "zed",
      }),
    ],
    scanJobId: 246,
    supabase,
    validationContext,
  });

  const result = await fetchPublicStatsByEnemyAndRoleForTest({
    client: supabase,
    enemyChampionId: "ahri",
    rankBracket: "all",
    role: "mid",
  });

  assert.equal(result.error, null);
  assert.equal(result.stats.length, 1);
  assert.equal(result.stats[0].counter_champion_id, "zed");
  assert.equal(result.stats[0].games, 1);
}

async function testFailedAggregationIsVisible() {
  const supabase = new FakeSupabaseClient({ failCounterPickStatsUpsert: true });
  const result = await withSilencedConsole(() =>
    persistObservationsAndRebuildStats({
      observations: [
        createObservation({
          champion_a: "ahri",
          champion_a_won: false,
          champion_b: "zed",
          match_id: "EUW1_107",
          winner_champion: "zed",
        }),
      ],
      scanJobId: 246,
      supabase,
      validationContext,
    }),
  );

  assert.equal(result.insertedObservations, 1);
  assert.ok(result.counterPickAggregateInsertFailures > 0);
  assert.equal(result.statsRowsUpdated, 0);
  assert.ok(result.counterPickAggregatePersistenceErrorGroups.length > 0);
}

async function withSilencedConsole(callback) {
  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = () => {};
  console.warn = () => {};

  try {
    return await callback();
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
}

async function fetchPublicStatsByEnemyAndRoleForTest({
  client,
  enemyChampionId,
  rankBracket,
  role,
}) {
  const { data, error } = await client
    .from("counter_pick_stats")
    .select(
      [
        "counter_champion_id",
        "enemy_champion_id",
        "games",
        "id",
        "losses",
        "patch",
        "rank_bracket",
        "role",
        "tier",
        "updated_at",
        "win_rate",
        "wins",
      ].join(", "),
    )
    .eq("enemy_champion_id", enemyChampionId)
    .eq("rank_bracket", rankBracket)
    .eq("role", role)
    .order("patch", { ascending: false })
    .order("games", { ascending: false });

  return {
    error: error?.message ?? null,
    stats: data ?? [],
  };
}

function createObservation(overrides) {
  return {
    champion_a: "ahri",
    champion_a_puuid: null,
    champion_a_tier: null,
    champion_a_won: true,
    champion_b: "zed",
    champion_b_puuid: null,
    champion_b_tier: null,
    game_duration_seconds: 1800,
    game_start_at: "2026-06-15T12:00:00.000Z",
    match_id: "EUW1_1",
    patch: "15.12",
    queue_id: 420,
    rank_attribution_method: "unknown",
    rank_bracket: "unknown",
    role: "mid",
    winner_champion: "ahri",
    ...overrides,
  };
}

function getCounterPickStat(
  supabase,
  enemyChampionId,
  counterChampionId,
  rankBracket,
  role = null,
) {
  const row = supabase.tables.counter_pick_stats.find(
    (stat) =>
      stat.enemy_champion_id === enemyChampionId &&
      stat.counter_champion_id === counterChampionId &&
      stat.rank_bracket === rankBracket &&
      (role === null || stat.role === role),
  );

  assert.ok(row, `Expected ${counterChampionId} into ${enemyChampionId} ${rankBracket} stat`);
  return row;
}

function getAggregateRow(rows, enemyChampionId, counterChampionId, rankBracket) {
  const row = rows.find(
    (stat) =>
      stat.enemy_champion_id === enemyChampionId &&
      stat.counter_champion_id === counterChampionId &&
      stat.rank_bracket === rankBracket,
  );

  assert.ok(row, `Expected ${counterChampionId} into ${enemyChampionId} ${rankBracket} aggregate`);
  return row;
}

class FakeSupabaseClient {
  constructor(options = {}) {
    this.failCounterPickStatsUpsert = Boolean(options.failCounterPickStatsUpsert);
    this.nextObservationId = 1;
    this.nextStatId = 1;
    this.tables = {
      counter_pick_stats: [],
      riot_matchup_observations: [],
      riot_seed_candidate_rank_snapshots: [],
      riot_seed_candidates: [],
    };
  }

  from(table) {
    return new FakeQuery(this, table);
  }
}

class FakeQuery {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.filters = [];
    this.operation = "select";
    this.ordering = [];
    this.limitValue = null;
    this.payload = null;
    this.upsertOptions = {};
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  eq(field, value) {
    this.filters.push({ field, type: "eq", value });
    return this;
  }

  in(field, values) {
    this.filters.push({ field, type: "in", values });
    return this;
  }

  limit(value) {
    this.limitValue = value;
    return this;
  }

  order(field, options = {}) {
    this.ordering.push({ field, options });
    return this;
  }

  returns() {
    return this;
  }

  select() {
    return this;
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  update(payload) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  upsert(payload, options = {}) {
    this.operation = "upsert";
    this.payload = Array.isArray(payload) ? payload : [payload];
    this.upsertOptions = options;
    return this;
  }

  async execute() {
    if (this.operation === "upsert") {
      return this.executeUpsert();
    }

    if (this.operation === "update") {
      return this.executeUpdate();
    }

    if (this.operation === "delete") {
      return this.executeDelete();
    }

    return {
      data: this.applyReadFilters(this.client.tables[this.table] ?? []),
      error: null,
    };
  }

  executeDelete() {
    const rows = this.client.tables[this.table] ?? [];
    this.client.tables[this.table] = rows.filter((row) => !this.matches(row));

    return {
      data: null,
      error: null,
    };
  }

  executeUpdate() {
    const rows = this.client.tables[this.table] ?? [];

    for (const row of rows) {
      if (this.matches(row)) {
        Object.assign(row, this.payload);
      }
    }

    return {
      data: null,
      error: null,
    };
  }

  executeUpsert() {
    if (this.table === "counter_pick_stats" && this.client.failCounterPickStatsUpsert) {
      return {
        data: null,
        error: {
          code: "23514",
          message: "Injected aggregate write failure",
        },
      };
    }

    if (this.table === "riot_matchup_observations") {
      return this.upsertMatchupObservations();
    }

    if (this.table === "counter_pick_stats") {
      return this.upsertCounterPickStats();
    }

    return {
      data: [],
      error: null,
    };
  }

  upsertMatchupObservations() {
    const insertedRows = [];

    for (const row of this.payload) {
      const existing = this.client.tables.riot_matchup_observations.find(
        (stored) => stored.match_id === row.match_id && stored.role === row.role,
      );

      if (existing && this.upsertOptions.ignoreDuplicates) {
        continue;
      }

      const storedRow = {
        id: `observation-${this.client.nextObservationId++}`,
        rank_attributed_at: null,
        ...row,
      };

      if (existing) {
        Object.assign(existing, storedRow);
        insertedRows.push(existing);
      } else {
        this.client.tables.riot_matchup_observations.push(storedRow);
        insertedRows.push(storedRow);
      }
    }

    return {
      data: insertedRows,
      error: null,
    };
  }

  upsertCounterPickStats() {
    const rows = [];

    for (const row of this.payload) {
      const existing = this.client.tables.counter_pick_stats.find(
        (stored) =>
          stored.enemy_champion_id === row.enemy_champion_id &&
          stored.counter_champion_id === row.counter_champion_id &&
          stored.role === row.role &&
          stored.patch === row.patch &&
          stored.rank_bracket === row.rank_bracket,
      );
      const storedRow = {
        id: existing?.id ?? this.client.nextStatId++,
        updated_at: "2026-06-17T00:00:00.000Z",
        ...row,
      };

      if (existing) {
        Object.assign(existing, storedRow);
        rows.push(existing);
      } else {
        this.client.tables.counter_pick_stats.push(storedRow);
        rows.push(storedRow);
      }
    }

    return {
      data: rows,
      error: null,
    };
  }

  applyReadFilters(rows) {
    let result = rows.filter((row) => this.matches(row));

    for (const { field, options } of this.ordering.toReversed()) {
      result = [...result].sort((left, right) => {
        const leftValue = left[field];
        const rightValue = right[field];

        if (leftValue === rightValue) {
          return 0;
        }

        const direction = options.ascending === false ? -1 : 1;

        return leftValue > rightValue ? direction : -direction;
      });
    }

    if (this.limitValue !== null) {
      result = result.slice(0, this.limitValue);
    }

    return result;
  }

  matches(row) {
    return this.filters.every((filter) => {
      if (filter.type === "eq") {
        return row[filter.field] === filter.value;
      }

      if (filter.type === "in") {
        return filter.values.includes(row[filter.field]);
      }

      return true;
    });
  }
}

await testDuplicateObservationIsNotCountedTwice();
await testDuplicateObservationKeyIncludesRole();
await testInvalidObservationIsNotAggregated();
testExpectedRankBracketAttribution();
testDirectedAggregateRowsIncludeStoredObservation();
await testValidOneOffChampionGameCountsAsObservation();
await testResolvedNonMainRoleGameCountsAsObservation();
await testPublicCounterPickQueryReadsExpectedRow();
await testFailedAggregationIsVisible();

console.log("Counter Pick data pipeline audit regression tests passed.");
