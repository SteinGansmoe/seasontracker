import assert from "node:assert/strict";

import { buildChampionRegistry } from "./lib/league-champion-normalizer.mjs";
import {
  fullMatchObservationRoles,
  getAllRoleMatchups,
  scanRiotCounterPickMatchups,
} from "./lib/riot-counter-pick-scanner.mjs";

const championRows = [
  champion("Ezreal", "81"),
  champion("Janna", "40"),
  champion("Kaisa", "145"),
  champion("LeeSin", "64", "Lee Sin", "lee-sin"),
  champion("Lulu", "117"),
  champion("Lux", "99"),
  champion("Nidalee", "76"),
  champion("Thresh", "412"),
  champion("Yuumi", "350"),
  champion("Zed", "238"),
];
const championRegistry = buildChampionRegistry(championRows);

await testFullMatchProducesAllRoleObservations();
await testMissingSelectedRoleDoesNotBlockOtherRoles();
await testDiscoveryFocusKeysStaySelectedRoleScoped();

console.log("Riot full-match observation extraction regression tests passed.");

async function testFullMatchProducesAllRoleObservations() {
  const match = createFullRoleMatch();
  const result = await scanRiotCounterPickMatchups({
    championRegistry,
    matchIds: ["EUW1_100"],
    riot: createRiotClient({ EUW1_100: match }),
    role: "mid",
    seedPuuids: ["seed-puuid"],
    target: {
      counterChampionId: "Lux",
      enemyChampionId: "Zed",
    },
  });

  assert.deepEqual(
    result.observations.map((observation) => observation.role),
    fullMatchObservationRoles,
    "A Mid scan should persist every valid role observation from the fetched match.",
  );
  assert.equal(result.observations.length, 5);
  assert.equal(result.summary.matchesFetched, 1);
  assert.equal(result.summary.matchesScanned, 1);
  assert.equal(result.summary.selectedRoleMatchupsFound, 1);
  assert.equal(result.summary.allRoleObservationsAttempted, 5);
  assert.equal(result.summary.observationsCreated, 5);
  assert.equal(result.summary.observationsFound, 5);
  assert.deepEqual(result.summary.observationsByRole, {
    adc: 1,
    jungle: 1,
    mid: 1,
    support: 1,
    top: 1,
  });
  assert.equal(result.summary.roleSkipped, 0);
  assert.equal(result.targetResult.games, 1);
  assert.equal(result.targetResult.role, "mid");
  assert.equal(result.targetResult.wins, 1);

  const roleMatchups = getAllRoleMatchups(
    match.info.participants.map((row) => ({
      ...row,
      canonicalChampionId: championRegistry.byRiotNumericKey.get(String(row.championId))
        .canonicalKey,
    })),
  );

  assert.equal(roleMatchups.length, 5, "A normal full match can form up to five role pairings.");
}

async function testDiscoveryFocusKeysStaySelectedRoleScoped() {
  const match = createFullRoleMatch();
  const result = await scanRiotCounterPickMatchups({
    championRegistry,
    discover: true,
    focusChampionId: "Lulu",
    matchIds: ["EUW1_102"],
    riot: createRiotClient({ EUW1_102: match }),
    role: "mid",
    seedPuuids: ["seed-puuid"],
  });

  assert.equal(result.observations.length, 5);
  assert.deepEqual(
    result.focusObservationKeys,
    [],
    "Focus observation summary keys stay scoped to the selected role.",
  );
  assert.deepEqual(result.discoveryResults, []);
}

async function testMissingSelectedRoleDoesNotBlockOtherRoles() {
  const match = createMatch({
    participants: [
      participant({
        championId: "Lulu",
        participantId: 1,
        position: "TOP",
        teamId: 100,
        won: true,
      }),
      participant({
        championId: "LeeSin",
        participantId: 2,
        position: "JUNGLE",
        teamId: 100,
        won: true,
      }),
      participant({
        championId: "Kaisa",
        participantId: 3,
        position: "BOTTOM",
        teamId: 100,
        won: true,
      }),
      participant({
        championId: "Janna",
        participantId: 4,
        position: "UTILITY",
        teamId: 100,
        won: true,
      }),
      participant({
        championId: "Thresh",
        participantId: 5,
        position: "TOP",
        teamId: 200,
        won: false,
      }),
      participant({
        championId: "Nidalee",
        participantId: 6,
        position: "JUNGLE",
        teamId: 200,
        won: false,
      }),
      participant({
        championId: "Ezreal",
        participantId: 7,
        position: "BOTTOM",
        teamId: 200,
        won: false,
      }),
      participant({
        championId: "Yuumi",
        participantId: 8,
        position: "UTILITY",
        teamId: 200,
        won: false,
      }),
    ],
  });
  const result = await scanRiotCounterPickMatchups({
    championRegistry,
    matchIds: ["EUW1_101"],
    riot: createRiotClient({ EUW1_101: match }),
    role: "mid",
    seedPuuids: ["seed-puuid"],
    target: {
      counterChampionId: "Lux",
      enemyChampionId: "Zed",
    },
  });

  assert.deepEqual(
    result.observations.map((observation) => observation.role),
    ["top", "jungle", "adc", "support"],
  );
  assert.equal(result.summary.selectedRoleMatchupsFound, 0);
  assert.equal(result.summary.roleSkipped, 1);
  assert.equal(result.summary.matchesSkippedUnsupportedRoleChampion, 1);
  assert.equal(result.summary.allRoleObservationsAttempted, 4);
  assert.equal(result.summary.observationsCreated, 4);
  assert.equal(result.summary.observationsFound, 4);
  assert.equal(result.targetResult.games, 0);
}

function champion(id, riotKey, name = id, slug = id.toLowerCase()) {
  return {
    id,
    name,
    riot_data_key: id,
    riot_key: riotKey,
    slug,
  };
}

function createMatch({ participants }) {
  return {
    info: {
      gameDuration: 1800,
      gameStartTimestamp: Date.parse("2026-06-15T12:00:00.000Z"),
      gameVersion: "15.12.123.456",
      participants,
      queueId: 420,
    },
  };
}

function createFullRoleMatch() {
  return createMatch({
    participants: [
      participant({
        championId: "Lulu",
        participantId: 1,
        position: "TOP",
        teamId: 100,
        won: true,
      }),
      participant({
        championId: "LeeSin",
        participantId: 2,
        position: "JUNGLE",
        teamId: 100,
        won: true,
      }),
      participant({
        championId: "Lux",
        participantId: 3,
        position: "MIDDLE",
        teamId: 100,
        won: true,
      }),
      participant({
        championId: "Kaisa",
        participantId: 4,
        position: "BOTTOM",
        teamId: 100,
        won: true,
      }),
      participant({
        championId: "Janna",
        participantId: 5,
        position: "UTILITY",
        teamId: 100,
        won: true,
      }),
      participant({
        championId: "Thresh",
        participantId: 6,
        position: "TOP",
        teamId: 200,
        won: false,
      }),
      participant({
        championId: "Nidalee",
        participantId: 7,
        position: "JUNGLE",
        teamId: 200,
        won: false,
      }),
      participant({
        championId: "Zed",
        participantId: 8,
        position: "MIDDLE",
        teamId: 200,
        won: false,
      }),
      participant({
        championId: "Ezreal",
        participantId: 9,
        position: "BOTTOM",
        teamId: 200,
        won: false,
      }),
      participant({
        championId: "Yuumi",
        participantId: 10,
        position: "UTILITY",
        teamId: 200,
        won: false,
      }),
    ],
  });
}

function participant({ championId, participantId, position, teamId, won }) {
  const championEntry = championRegistry.byCanonicalKey.get(championId);

  return {
    championId: Number(championEntry.riotNumericKey),
    championName: championEntry.riotDataKey,
    individualPosition: position,
    participantId,
    puuid: `puuid-${participantId}`,
    teamId,
    teamPosition: position,
    win: won,
  };
}

function createRiotClient(matchesById) {
  return {
    async fetchMatch(matchId) {
      const match = matchesById[matchId];

      assert.ok(match, `Unexpected match id ${matchId}`);
      return match;
    },
    async fetchRecentRankedMatchIdsByPuuid() {
      throw new Error("Stored match IDs should be used in this test.");
    },
  };
}
