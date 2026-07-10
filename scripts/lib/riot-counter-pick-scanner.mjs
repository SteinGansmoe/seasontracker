import {
  createChampionNormalizationStats,
  getChampionDisplayName,
  getChampionNormalizationSummary,
  normalizeChampionIdentifier,
  normalizeParticipantChampionIdentifiers,
} from "./league-champion-normalizer.mjs";

export const rankedSoloDuoQueueId = 420;

export const roleToTeamPosition = {
  adc: "BOTTOM",
  jungle: "JUNGLE",
  mid: "MIDDLE",
  support: "UTILITY",
  top: "TOP",
};

export const fullMatchObservationRoles = ["top", "jungle", "mid", "adc", "support"];

export const positionToRole = {
  BOTTOM: "adc",
  JUNGLE: "jungle",
  MIDDLE: "mid",
  TOP: "top",
  UTILITY: "support",
};

export async function scanRiotCounterPickMatchups({
  championRegistry,
  discover = false,
  logger = null,
  matchIds: storedMatchIds = null,
  matchCount = 20,
  maxMatchesToScan = null,
  onProgress = null,
  patch = null,
  platformRegion = "EUW1",
  processedMatchIds = [],
  queue = rankedSoloDuoQueueId,
  regionalRouting = "EUROPE",
  riot,
  role,
  seedPuuids,
  shouldContinue = null,
  focusChampionId = null,
  target = null,
}) {
  const normalizedRole = normalizeRole(role);

  if (!riot) {
    throw new Error("Riot API client is required.");
  }

  if (!championRegistry) {
    throw new Error("Champion registry is required before Riot scanning can start.");
  }

  if (!normalizedRole) {
    throw new Error("Invalid role. Use top, jungle, mid, adc, or support.");
  }

  const uniqueSeedPuuids = uniqueValues(seedPuuids ?? []);

  if (uniqueSeedPuuids.length === 0) {
    throw new Error("Provide at least one seed PUUID.");
  }

  const normalizedTarget = target
    ? {
        counterChampion: normalizeChampionIdentifier(target.counterChampionId, championRegistry),
        enemyChampion: normalizeChampionIdentifier(target.enemyChampionId, championRegistry),
      }
    : null;
  const normalizedFocusChampion =
    discover && focusChampionId
      ? normalizeChampionIdentifier(focusChampionId, championRegistry)
      : null;

  if (!discover && (!normalizedTarget?.enemyChampion || !normalizedTarget?.counterChampion)) {
    throw new Error("Target scans require valid enemy and counter champions.");
  }

  if (discover && focusChampionId && !normalizedFocusChampion) {
    throw new Error("Discovery focus champion must resolve to an active champion.");
  }

  if (
    !discover &&
    normalizedTarget.enemyChampion.canonicalKey === normalizedTarget.counterChampion.canonicalKey
  ) {
    throw new Error("Enemy and counter champion cannot be the same.");
  }

  await assertScanShouldContinue(shouldContinue);
  await emitProgress(onProgress, {
    currentStage: "initializing",
    lastProgressAt: new Date().toISOString(),
    seedCount: uniqueSeedPuuids.length,
  });

  const persistedMatchIds = Array.isArray(storedMatchIds) ? uniqueValues(storedMatchIds) : [];
  const matchIdResult =
    persistedMatchIds.length > 0
      ? {
          totalFetched: persistedMatchIds.length,
          uniqueMatchIds: persistedMatchIds,
        }
      : await fetchUniqueMatchIds({
          count: matchCount,
          logger,
          onProgress,
          puuids: uniqueSeedPuuids,
          queue,
          riot,
          shouldContinue,
        });
  const matchIds = matchIdResult.uniqueMatchIds;
  const completedMatchIds = new Set(uniqueValues(processedMatchIds ?? []));
  const unfinishedMatchIds = matchIds.filter((matchId) => !completedMatchIds.has(matchId));
  const boundedMatchLimit =
    Number.isInteger(maxMatchesToScan) && Number(maxMatchesToScan) > 0
      ? Number(maxMatchesToScan)
      : null;
  const matchIdsForThisInvocation =
    boundedMatchLimit === null ? unfinishedMatchIds : unfinishedMatchIds.slice(0, boundedMatchLimit);
  const candidateObservations = [];
  const aggregate = {
    candidateDiscoverySkipped: 0,
    candidateObservationsFound: 0,
    championPairMatched: 0,
    discoveryPairs: new Map(),
    fetchedMatchIds: matchIdResult.totalFetched,
    focusChampionDisplayName: normalizedFocusChampion
      ? getChampionDisplayName(championRegistry, normalizedFocusChampion.canonicalKey)
      : null,
    focusChampionId: normalizedFocusChampion?.canonicalKey ?? null,
    focusChampionLosses: 0,
    focusChampionMatchesFound: 0,
    focusChampionObservationsDuplicate: 0,
    focusChampionObservationsNew: 0,
    focusChampionWins: 0,
    focusMatchupPairsDiscovered: 0,
    games: 0,
    losses: 0,
    matchesFetched: 0,
    matchesScanned: completedMatchIds.size,
    matchesSkippedInvalidData: 0,
    matchesSkippedUnsupportedRoleChampion: 0,
    observationsByRole: createEmptyObservationCountsByRole(),
    observationsCreated: 0,
    observationsSkippedTechnicalInvalid: 0,
    allRoleObservationsAttempted: 0,
    patch,
    patchSkipped: 0,
    queueSkipped: 0,
    role: normalizedRole,
    roleSkipped: 0,
    selectedRoleMatchupsFound: 0,
    targetMatches: 0,
    uniqueMatchIds: matchIds.length,
    wins: 0,
    ...createChampionNormalizationStats(),
  };
  const observations = [];

  await emitProgress(onProgress, {
    ...getSummary(aggregate),
    currentStage: "fetching-matches",
    lastProgressAt: new Date().toISOString(),
    matchesTotal: matchIds.length,
    storedMatchIds: matchIds,
    completedMatchIds: Array.from(completedMatchIds),
    workerBatchSize: boundedMatchLimit ?? matchIds.length,
    workerRemainingMatches: unfinishedMatchIds.length,
  });

  for (const matchId of matchIdsForThisInvocation) {
    const matchIndex = matchIds.indexOf(matchId);
    await assertScanShouldContinue(shouldContinue);
    await emitProgress(onProgress, {
      ...getSummary(aggregate),
      completedMatchIds: Array.from(completedMatchIds),
      currentMatchIdPreview: getSafeIdentifierPreview(matchId),
      currentMatchIndex: matchIndex + 1,
      currentStage: "fetching-matches",
      lastProgressAt: new Date().toISOString(),
      matchesTotal: matchIds.length,
      storedMatchIds: matchIds,
      workerBatchSize: boundedMatchLimit ?? matchIds.length,
      workerRemainingMatches: Math.max(matchIds.length - completedMatchIds.size, 0),
    });
    const match = await riot.fetchMatch(matchId);
    completedMatchIds.add(matchId);
    aggregate.matchesFetched += 1;
    aggregate.matchesScanned += 1;

    if (patch && getPatchFromMatch(match) !== patch) {
      aggregate.patchSkipped += 1;
      await emitProgress(
        onProgress,
        createLiveScanProgress(aggregate, matchId, matchIndex, matchIds),
      );
      continue;
    }

    if (Number(match?.info?.queueId) !== queue) {
      aggregate.queueSkipped += 1;
      await emitProgress(
        onProgress,
        createLiveScanProgress(aggregate, matchId, matchIndex, matchIds),
      );
      continue;
    }

    if (!Array.isArray(match?.info?.participants)) {
      aggregate.matchesSkippedInvalidData += 1;
      await emitProgress(
        onProgress,
        createLiveScanProgress(aggregate, matchId, matchIndex, matchIds),
      );
      continue;
    }

    const normalizedParticipants = normalizeMatchParticipants({
      aggregate,
      match,
      matchId,
      participants: match?.info?.participants,
      registry: championRegistry,
    });

    const candidateObservationResult = getCandidateObservationsFromMatch({
      match,
      patch: getPatchFromMatch(match),
      platformRegion,
      participants: normalizedParticipants,
      queue,
      regionalRouting,
    });
    candidateObservations.push(...candidateObservationResult.observations);
    aggregate.candidateDiscoverySkipped += candidateObservationResult.skipped;
    aggregate.candidateObservationsFound = candidateObservations.length;

    const selectedRoleMatchups = getRoleMatchupsForRole(normalizedParticipants, normalizedRole);
    const allRoleMatchups = getAllRoleMatchups(normalizedParticipants);

    aggregate.selectedRoleMatchupsFound += selectedRoleMatchups.length;

    if (selectedRoleMatchups.length === 0) {
      aggregate.roleSkipped += 1;
      aggregate.matchesSkippedUnsupportedRoleChampion += 1;
    }

    if (allRoleMatchups.length === 0) {
      await emitProgress(
        onProgress,
        createLiveScanProgress(aggregate, matchId, matchIndex, matchIds),
      );
      continue;
    }

    aggregate.allRoleObservationsAttempted += allRoleMatchups.length;

    for (const matchup of allRoleMatchups) {
      const observation = getMatchupObservation({
        match,
        matchId,
        matchup,
        patch: getPatchFromMatch(match),
        queue,
        role: matchup.role,
      });

      if (observation) {
        observations.push(observation);
        incrementObservationCountByRole(aggregate.observationsByRole, matchup.role);
      } else {
        aggregate.observationsSkippedTechnicalInvalid += 1;
      }
    }
    aggregate.observationsCreated = observations.length;

    if (discover) {
      selectedRoleMatchups.forEach((matchup) =>
        addDiscoveryPair(aggregate.discoveryPairs, matchup, championRegistry),
      );
      updateFocusedDiscoveryAggregate({
        aggregate,
        observations,
        registry: championRegistry,
        role: normalizedRole,
      });
      aggregate.observationsFound = observations.length;
      await emitProgress(
        onProgress,
        createLiveScanProgress(aggregate, matchId, matchIndex, matchIds),
      );
      continue;
    }

    const result = getTargetMatchupResult(selectedRoleMatchups, normalizedTarget);

    if (!result) {
      aggregate.observationsFound = observations.length;
      await emitProgress(
        onProgress,
        createLiveScanProgress(aggregate, matchId, matchIndex, matchIds),
      );
      continue;
    }

    aggregate.championPairMatched += 1;
    aggregate.targetMatches += 1;
    aggregate.games += 1;

    if (result.didCounterWin) {
      aggregate.wins += 1;
    } else {
      aggregate.losses += 1;
    }

    aggregate.observationsFound = observations.length;
    await emitProgress(
      onProgress,
      createLiveScanProgress(aggregate, matchId, matchIndex, matchIds),
    );
  }

  updateFocusedDiscoveryAggregate({
    aggregate,
    observations,
    registry: championRegistry,
    role: normalizedRole,
  });
  const summary = {
    ...getSummary(aggregate),
    completedMatchIds: Array.from(completedMatchIds),
    currentMatchIdPreview: null,
    currentStage: completedMatchIds.size >= matchIds.length ? "scan-complete" : "chunk-complete",
    isComplete: completedMatchIds.size >= matchIds.length,
    lastProgressAt: new Date().toISOString(),
    matchesTotal: matchIds.length,
    storedMatchIds: matchIds,
    workerBatchSize: boundedMatchLimit ?? matchIds.length,
    workerRemainingMatches: Math.max(matchIds.length - completedMatchIds.size, 0),
  };
  const targetResult = discover
    ? null
    : getTargetResult({
        aggregate,
        registry: championRegistry,
        target: normalizedTarget,
      });

  return {
    discoveryResults: discover
      ? normalizedFocusChampion
        ? getFocusedDiscoveryResultsFromObservations({
            focusChampion: normalizedFocusChampion.canonicalKey,
            observations,
            registry: championRegistry,
            role: normalizedRole,
          })
        : getDiscoveryResults({
            discoveryPairs: aggregate.discoveryPairs,
            role: normalizedRole,
          })
      : [],
    candidateObservations,
    focusObservationKeys: normalizedFocusChampion
      ? getFocusedObservationKeys({
          focusChampion: normalizedFocusChampion.canonicalKey,
          observations,
          role: normalizedRole,
        })
      : [],
    observations,
    summary,
    targetResult,
  };
}

export async function fetchCurrentPatch() {
  const response = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");

  if (!response.ok) {
    throw new Error(`Could not fetch current League patch (${response.status}).`);
  }

  const versions = await response.json();
  const version = Array.isArray(versions) ? versions[0] : null;

  if (typeof version !== "string") {
    throw new Error("Data Dragon did not return a current patch version.");
  }

  const [major, minor] = version.split(".");

  if (!major || !minor) {
    throw new Error(`Could not parse current patch from ${version}.`);
  }

  return `${major}.${minor}`;
}

export function normalizeRole(value) {
  const role = String(value).trim().toLowerCase();

  if (role === "bottom" || role === "bot") {
    return "adc";
  }

  return Object.hasOwn(roleToTeamPosition, role) ? role : null;
}

export function uniqueValues(values) {
  return Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean)));
}

export function calculateWinRate({ games, wins }) {
  if (games <= 0) {
    return 0;
  }

  return Number(((wins / games) * 100).toFixed(2));
}

export function calculateTier({ games, winRate }) {
  if (games <= 0) {
    return "C";
  }

  if (winRate >= 56) {
    return "S+";
  }

  if (winRate >= 53) {
    return "S";
  }

  if (winRate >= 51) {
    return "A";
  }

  if (winRate >= 49) {
    return "B";
  }

  return "C";
}

export function getPatchFromMatch(match) {
  const gameVersion = String(match?.info?.gameVersion ?? "");
  const [major, minor] = gameVersion.split(".");

  return major && minor ? `${major}.${minor}` : null;
}

export function normalizeChampionKey(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function getParticipantRole(participant) {
  const position = String(participant?.teamPosition || participant?.individualPosition || "")
    .trim()
    .toUpperCase();

  return positionToRole[position] ?? null;
}

async function fetchUniqueMatchIds({
  count,
  logger,
  onProgress,
  puuids,
  queue,
  riot,
  shouldContinue,
}) {
  const matchIds = new Set();
  let totalFetched = 0;

  for (const [seedIndex, puuid] of puuids.entries()) {
    await assertScanShouldContinue(shouldContinue);
    await emitProgress(onProgress, {
      currentSeedIndex: seedIndex + 1,
      currentSeedPuuidPreview: getSafeIdentifierPreview(puuid),
      currentStage: "fetching-match-ids",
      fetchedMatchIds: totalFetched,
      lastProgressAt: new Date().toISOString(),
      seedCount: puuids.length,
      uniqueMatchIds: matchIds.size,
    });

    const ids = await riot.fetchRecentRankedMatchIdsByPuuid({
      count,
      puuid,
      queue,
    });

    if (Array.isArray(ids)) {
      totalFetched += ids.length;
      ids.forEach((id) => matchIds.add(id));
    }

    logger?.log(`Fetched ${Array.isArray(ids) ? ids.length : 0} match IDs for one seed PUUID.`);
    await emitProgress(onProgress, {
      currentSeedIndex: seedIndex + 1,
      currentSeedPuuidPreview: getSafeIdentifierPreview(puuid),
      currentStage: "fetching-match-ids",
      fetchedMatchIds: totalFetched,
      lastProgressAt: new Date().toISOString(),
      seedCount: puuids.length,
      uniqueMatchIds: matchIds.size,
    });
  }

  logger?.log(`Fetched Match IDs: ${totalFetched}`);
  logger?.log(`Unique Match IDs: ${matchIds.size}`);

  return {
    totalFetched,
    uniqueMatchIds: Array.from(matchIds),
  };
}

async function assertScanShouldContinue(shouldContinue) {
  if (typeof shouldContinue !== "function") {
    return;
  }

  const result = await shouldContinue();

  if (result === false) {
    throw new Error("Riot scan stopped by control state.");
  }
}

function createLiveScanProgress(aggregate, matchId, matchIndex, matchIds) {
  return {
    ...getSummary(aggregate),
    currentMatchIdPreview: getSafeIdentifierPreview(matchId),
    currentMatchIndex: matchIndex + 1,
    currentStage: "fetching-matches",
    lastProgressAt: new Date().toISOString(),
    matchesTotal: matchIds.length,
  };
}

function getSafeIdentifierPreview(value) {
  const text = String(value ?? "").trim();

  if (text.length <= 12) {
    return text || null;
  }

  return `${text.slice(0, 6)}...${text.slice(-4)}`;
}

function getTargetMatchupResult(roleMatchups, target) {
  for (const matchup of roleMatchups) {
    const leftChampionKey = matchup.left.canonicalChampionId;
    const rightChampionKey = matchup.right.canonicalChampionId;
    const enemyChampionKey = target.enemyChampion.canonicalKey;
    const counterChampionKey = target.counterChampion.canonicalKey;
    const isLeftTarget =
      leftChampionKey === counterChampionKey && rightChampionKey === enemyChampionKey;
    const isRightTarget =
      rightChampionKey === counterChampionKey && leftChampionKey === enemyChampionKey;

    if (isLeftTarget) {
      return {
        didCounterWin: Boolean(matchup.left.win),
      };
    }

    if (isRightTarget) {
      return {
        didCounterWin: Boolean(matchup.right.win),
      };
    }
  }

  return null;
}

export function getRoleMatchupsForRole(participants, role) {
  const teamPosition = roleToTeamPosition[role];
  const roleParticipants = participants.filter(
    (participant) =>
      participant.teamPosition === teamPosition || participant.individualPosition === teamPosition,
  );
  const participantsByTeam = new Map(
    roleParticipants.map((participant) => [participant.teamId, participant]),
  );

  if (participantsByTeam.size !== 2) {
    return [];
  }

  const [left, right] = Array.from(participantsByTeam.values());

  return [
    {
      left,
      role,
      right,
    },
  ];
}

export function getAllRoleMatchups(participants) {
  return fullMatchObservationRoles.flatMap((role) => getRoleMatchupsForRole(participants, role));
}

function normalizeMatchParticipants({ aggregate, match, matchId, participants, registry }) {
  if (!Array.isArray(participants)) {
    return [];
  }

  const normalizedParticipants = [];
  const gameStartTimestamp = Number(match?.info?.gameStartTimestamp);
  const gameDurationSeconds = Number(match?.info?.gameDuration);

  for (const participant of participants) {
    const result = normalizeParticipantChampionIdentifiers(participant, registry);

    aggregate.processed += 1;

    if (result.conflict) {
      aggregate.conflicts += 1;
      logChampionNormalizationIssue("Champion identifier conflict", {
        matchId,
        ...result.inputs,
        role: getParticipantRole(participant),
      });
      continue;
    }

    if (result.failure || !result.entry) {
      aggregate.failures += 1;
      logChampionNormalizationIssue("Champion identifier could not be normalized", {
        matchId,
        ...result.inputs,
        role: getParticipantRole(participant),
      });
      continue;
    }

    aggregate.normalized += 1;

    if (result.usedAlias) {
      aggregate.aliasesResolved += 1;
    }

    normalizedParticipants.push({
      ...participant,
      canonicalChampionId: result.entry.canonicalKey,
      championDisplayName: result.entry.displayName,
      gameDurationSeconds: Number.isFinite(gameDurationSeconds) ? gameDurationSeconds : null,
      gameStartAt: Number.isFinite(gameStartTimestamp)
        ? new Date(gameStartTimestamp).toISOString()
        : null,
      matchId,
    });
  }

  return normalizedParticipants;
}

function getCandidateObservationsFromMatch({
  patch,
  platformRegion,
  participants,
  queue,
  regionalRouting,
}) {
  const observations = [];
  const seenPuuids = new Set();
  let skipped = 0;

  for (const participant of participants) {
    const puuid = typeof participant?.puuid === "string" ? participant.puuid.trim() : "";
    const champion = participant.canonicalChampionId;
    const role = getParticipantRole(participant);

    if (!puuid || !champion || !role || seenPuuids.has(puuid)) {
      skipped += 1;
      continue;
    }

    seenPuuids.add(puuid);
    observations.push({
      champion,
      game_duration_seconds: Number.isFinite(Number(participant.gameDurationSeconds))
        ? Number(participant.gameDurationSeconds)
        : null,
      game_start_at: participant.gameStartAt ?? null,
      match_id: participant.matchId,
      patch,
      platform_region: platformRegion,
      puuid,
      queue_id: queue,
      regional_routing: regionalRouting,
      role,
      won: Boolean(participant.win),
    });
  }

  return {
    observations,
    skipped,
  };
}

function addDiscoveryPair(discoveryPairs, matchup, registry) {
  const champions = [matchup.left.canonicalChampionId, matchup.right.canonicalChampionId].sort(
    (left, right) => left.localeCompare(right),
  );
  const key = `${champions[0]}::${champions[1]}`;
  const championAParticipant =
    matchup.left.canonicalChampionId === champions[0] ? matchup.left : matchup.right;
  const championBParticipant = championAParticipant === matchup.left ? matchup.right : matchup.left;
  const currentPair = discoveryPairs.get(key) ?? {
    championA: champions[0],
    championADisplayName: getChampionDisplayName(registry, champions[0]),
    championAWins: 0,
    championB: champions[1],
    championBDisplayName: getChampionDisplayName(registry, champions[1]),
    championBWins: 0,
    games: 0,
  };

  currentPair.games += 1;

  if (championAParticipant.win) {
    currentPair.championAWins += 1;
  } else if (championBParticipant.win) {
    currentPair.championBWins += 1;
  }

  discoveryPairs.set(key, currentPair);
}

function getMatchupObservation({ match, matchId, matchup, patch, queue, role }) {
  const leftChampion = matchup.left.canonicalChampionId;
  const rightChampion = matchup.right.canonicalChampionId;

  if (!leftChampion || !rightChampion || leftChampion === rightChampion) {
    return null;
  }

  const orderedParticipants = [matchup.left, matchup.right].sort((left, right) => {
    const leftKey = left.canonicalChampionId;
    const rightKey = right.canonicalChampionId;
    const keyOrder = leftKey.localeCompare(rightKey);

    if (keyOrder !== 0) {
      return keyOrder;
    }

    return String(left.championName).localeCompare(String(right.championName));
  });
  const [championA, championB] = orderedParticipants;
  const championAWon = Boolean(championA.win);
  const winnerChampion = championAWon
    ? championA.canonicalChampionId
    : championB.canonicalChampionId;
  const gameStartTimestamp = Number(match?.info?.gameStartTimestamp);
  const gameDurationSeconds = Number(match?.info?.gameDuration);

  // TODO: Decide explicit remake/min-duration filtering separately from full-role extraction.
  return {
    champion_a: championA.canonicalChampionId,
    champion_a_puuid: championA.puuid ?? null,
    champion_a_tier: null,
    champion_a_won: championAWon,
    champion_b: championB.canonicalChampionId,
    champion_b_puuid: championB.puuid ?? null,
    champion_b_tier: null,
    game_duration_seconds: Number.isFinite(gameDurationSeconds) ? gameDurationSeconds : null,
    game_start_at: Number.isFinite(gameStartTimestamp)
      ? new Date(gameStartTimestamp).toISOString()
      : null,
    match_id: matchId,
    patch,
    queue_id: queue,
    rank_attribution_method: "unknown",
    rank_bracket: "unknown",
    role,
    winner_champion: winnerChampion,
  };
}

function getDiscoveryResults({ discoveryPairs, role }) {
  return Array.from(discoveryPairs.values())
    .map((pair) => ({
      championA: pair.championA,
      championADisplayName: pair.championADisplayName,
      championAWins: pair.championAWins,
      championAWinRate: calculateWinRate({
        games: pair.games,
        wins: pair.championAWins,
      }),
      championB: pair.championB,
      championBDisplayName: pair.championBDisplayName,
      championBWins: pair.championBWins,
      championBWinRate: calculateWinRate({
        games: pair.games,
        wins: pair.championBWins,
      }),
      games: pair.games,
      role,
    }))
    .sort((left, right) => {
      if (left.games !== right.games) {
        return right.games - left.games;
      }

      return `${left.championA} ${left.championB}`.localeCompare(
        `${right.championA} ${right.championB}`,
      );
    });
}

export function getFocusedDiscoveryResultsFromObservations({
  focusChampion,
  observations,
  registry,
  role,
}) {
  const focusChampionId = String(focusChampion ?? "").trim();

  if (!focusChampionId) {
    return [];
  }

  const pairsByOpponent = new Map();

  for (const observation of observations ?? []) {
    if (observation.role !== role) {
      continue;
    }

    const championA = observation.champion_a;
    const championB = observation.champion_b;
    const hasFocusAsA = championA === focusChampionId;
    const hasFocusAsB = championB === focusChampionId;

    if (!hasFocusAsA && !hasFocusAsB) {
      continue;
    }

    const opponentChampion = hasFocusAsA ? championB : championA;

    if (!opponentChampion || opponentChampion === focusChampionId) {
      continue;
    }

    const currentPair = pairsByOpponent.get(opponentChampion) ?? {
      championA: focusChampionId,
      championADisplayName: getChampionDisplayName(registry, focusChampionId),
      championAWins: 0,
      championAWinRate: 0,
      championB: opponentChampion,
      championBDisplayName: getChampionDisplayName(registry, opponentChampion),
      championBWins: 0,
      championBWinRate: 0,
      focusChampion: focusChampionId,
      focusChampionDisplayName: getChampionDisplayName(registry, focusChampionId),
      focusChampionWinRate: 0,
      focusChampionWins: 0,
      games: 0,
      opponentChampion,
      opponentChampionDisplayName: getChampionDisplayName(registry, opponentChampion),
      opponentWins: 0,
      role,
    };
    const focusWon = hasFocusAsA
      ? Boolean(observation.champion_a_won)
      : !Boolean(observation.champion_a_won);

    currentPair.games += 1;

    if (focusWon) {
      currentPair.championAWins += 1;
      currentPair.focusChampionWins += 1;
    } else {
      currentPair.championBWins += 1;
      currentPair.opponentWins += 1;
    }

    currentPair.championAWinRate = calculateWinRate({
      games: currentPair.games,
      wins: currentPair.championAWins,
    });
    currentPair.focusChampionWinRate = currentPair.championAWinRate;
    currentPair.championBWinRate = calculateWinRate({
      games: currentPair.games,
      wins: currentPair.championBWins,
    });
    pairsByOpponent.set(opponentChampion, currentPair);
  }

  return Array.from(pairsByOpponent.values()).sort((left, right) => {
    if (left.games !== right.games) {
      return right.games - left.games;
    }

    return String(left.opponentChampionDisplayName ?? left.opponentChampion).localeCompare(
      String(right.opponentChampionDisplayName ?? right.opponentChampion),
    );
  });
}

function updateFocusedDiscoveryAggregate({ aggregate, observations, registry, role }) {
  if (!aggregate.focusChampionId) {
    return;
  }

  const focusedResults = getFocusedDiscoveryResultsFromObservations({
    focusChampion: aggregate.focusChampionId,
    observations,
    registry,
    role,
  });

  aggregate.focusChampionMatchesFound = focusedResults.reduce(
    (total, result) => total + result.games,
    0,
  );
  aggregate.focusMatchupPairsDiscovered = focusedResults.length;
  aggregate.focusChampionWins = focusedResults.reduce(
    (total, result) => total + result.focusChampionWins,
    0,
  );
  aggregate.focusChampionLosses = focusedResults.reduce(
    (total, result) => total + result.opponentWins,
    0,
  );
}

function getFocusedObservationKeys({ focusChampion, observations, role }) {
  return (observations ?? [])
    .filter(
      (observation) =>
        observation.role === role &&
        (observation.champion_a === focusChampion || observation.champion_b === focusChampion),
    )
    .map((observation) => `${observation.match_id}::${observation.role}`);
}

function getTargetResult({ aggregate, registry, target }) {
  const winRate = calculateWinRate({
    games: aggregate.games,
    wins: aggregate.wins,
  });

  return {
    counterChampion: target.counterChampion.canonicalKey,
    counterChampionDisplayName: getChampionDisplayName(
      registry,
      target.counterChampion.canonicalKey,
    ),
    enemyChampion: target.enemyChampion.canonicalKey,
    enemyChampionDisplayName: getChampionDisplayName(registry, target.enemyChampion.canonicalKey),
    games: aggregate.games,
    losses: aggregate.losses,
    role: aggregate.role,
    tier: calculateTier({
      games: aggregate.games,
      winRate,
    }),
    wasWrittenToStats: false,
    winRate,
    wins: aggregate.wins,
  };
}

function getSummary(aggregate) {
  return {
    allRoleObservationsAttempted: aggregate.allRoleObservationsAttempted ?? 0,
    candidateDiscoverySkipped: aggregate.candidateDiscoverySkipped ?? 0,
    candidateObservationsFound: aggregate.candidateObservationsFound ?? 0,
    championPairMatched: aggregate.championPairMatched,
    fetchedMatchIds: aggregate.fetchedMatchIds,
    focusChampionDisplayName: aggregate.focusChampionDisplayName,
    focusChampionId: aggregate.focusChampionId,
    focus_champion_losses: aggregate.focusChampionLosses ?? 0,
    focus_champion_matches_found: aggregate.focusChampionMatchesFound ?? 0,
    focus_champion_observations_duplicate: aggregate.focusChampionObservationsDuplicate ?? 0,
    focus_champion_observations_new: aggregate.focusChampionObservationsNew ?? 0,
    focus_champion_wins: aggregate.focusChampionWins ?? 0,
    focus_matchup_pairs_discovered: aggregate.focusMatchupPairsDiscovered ?? 0,
    games: aggregate.games,
    losses: aggregate.losses,
    matchesFetched: aggregate.matchesFetched,
    matchesScanned: aggregate.matchesScanned,
    matchesSkippedInvalidData: aggregate.matchesSkippedInvalidData,
    matchesSkippedUnsupportedRoleChampion: aggregate.matchesSkippedUnsupportedRoleChampion,
    observationsByRole: { ...aggregate.observationsByRole },
    observationsCreated: aggregate.observationsCreated ?? 0,
    observationsSkippedTechnicalInvalid: aggregate.observationsSkippedTechnicalInvalid ?? 0,
    patch: aggregate.patch,
    patchSkipped: aggregate.patchSkipped,
    queueSkipped: aggregate.queueSkipped,
    role: aggregate.role,
    roleSkipped: aggregate.roleSkipped,
    selectedRoleMatchupsFound: aggregate.selectedRoleMatchupsFound ?? 0,
    targetMatches: aggregate.targetMatches,
    uniqueMatchIds: aggregate.uniqueMatchIds,
    observationsFound: aggregate.observationsFound ?? 0,
    matchupPairsDiscovered: aggregate.discoveryPairs.size,
    wins: aggregate.wins,
    ...getChampionNormalizationSummary(aggregate),
  };
}

function createEmptyObservationCountsByRole() {
  return Object.fromEntries(fullMatchObservationRoles.map((role) => [role, 0]));
}

function incrementObservationCountByRole(countsByRole, role) {
  if (!Object.hasOwn(countsByRole, role)) {
    return;
  }

  countsByRole[role] += 1;
}

async function emitProgress(onProgress, progress) {
  if (!onProgress) {
    return;
  }

  await onProgress(progress);
}

function logChampionNormalizationIssue(label, context) {
  console.warn(label, {
    championId: context.championId ?? null,
    championKey: context.championKey ?? null,
    championName: context.championName ?? null,
    matchId: context.matchId,
    role: context.role,
  });
}
