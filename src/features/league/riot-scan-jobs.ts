import type { LeagueRole } from "./roles";
import type { CounterPickManagementMetricsResult } from "./counter-pick-management-metrics";
import type {
  RiotCollectionInventoryResult,
  RiotCollectionJobResult,
  RiotCollectionJobsResult,
  StartRiotCollectionJobInput,
} from "./riot-collection-jobs";
import type {
  SeedCandidateLifecycle,
  SeedCandidateLifecycleState,
} from "./riot-seed-candidate-lifecycle";
import type {
  PaginatedSeedCandidates,
  RiotSeedCandidateGroupPageRequest,
  RiotSeedCandidateRankGroupId,
} from "./riot-seed-candidate-rank-groups";

export type RiotScanMode = "target" | "discovery";
export type RiotScanStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type RiotObservationRoleCounts = Partial<Record<LeagueRole, number>>;

export type RiotScanSummary = {
  allRoleObservationsAttempted?: number;
  candidateDiscoverySkipped?: number;
  candidateIdLookupChunkFailures?: number;
  candidateIdLookupChunks?: number;
  candidateIdResolutionFailures?: number;
  candidateIdsResolved?: number;
  candidateObservationDuplicatesSkipped?: number;
  candidateObservationInsertFailures?: number;
  candidateObservationBatchAttempts?: number;
  candidateObservationSuccessfulBatches?: number;
  candidateObservationFailedBatchAttempts?: number;
  candidateObservationBatchSplits?: number;
  candidateObservationTransientRetries?: number;
  candidateObservationIsolatedFailures?: number;
  candidateObservationUnresolvedBatchFailures?: number;
  candidateObservationPersistenceFailureSamples?: RiotPersistenceFailureSample[];
  candidateObservationPersistenceErrorGroups?: RiotPersistenceErrorGroup[];
  candidateObservationResolutionFailures?: number;
  candidateObservationValidationFailures?: number;
  candidateObservationValidationSummary?: RiotValidationIssueSummary;
  candidateObservationsFound?: number;
  candidateObservationsInserted?: number;
  candidateObservationsRejected?: number;
  candidateObservationsValidated?: number;
  candidateProfileFailures?: number;
  candidateProfilesRebuilt?: number;
  candidateUniqueIdResolutionFailures?: number;
  championPairMatched?: number;
  champion_aliases_resolved?: number;
  champion_identifier_conflicts?: number;
  champion_identifiers_normalized?: number;
  champion_identifiers_processed?: number;
  champion_normalization_failures?: number;
  counterPickAggregateValidationFailures?: number;
  counterPickAggregateValidationSummary?: RiotValidationIssueSummary;
  counterPickAggregatesValidated?: number;
  counterPickAggregateInsertFailures?: number;
  counterPickAggregateBatchAttempts?: number;
  counterPickAggregateSuccessfulBatches?: number;
  counterPickAggregateFailedBatchAttempts?: number;
  counterPickAggregateBatchSplits?: number;
  counterPickAggregateTransientRetries?: number;
  counterPickAggregateIsolatedFailures?: number;
  counterPickAggregateUnresolvedBatchFailures?: number;
  counterPickAggregatePersistenceFailureSamples?: RiotPersistenceFailureSample[];
  counterPickAggregatePersistenceErrorGroups?: RiotPersistenceErrorGroup[];
  existingCandidatesUpdated?: number;
  fetchedMatchIds?: number;
  focusChampionDisplayName?: string | null;
  focusChampionId?: string | null;
  focus_champion_losses?: number;
  focus_champion_matches_found?: number;
  focus_champion_observations_duplicate?: number;
  focus_champion_observations_new?: number;
  focus_champion_wins?: number;
  focus_matchup_pairs_discovered?: number;
  games?: number;
  losses?: number;
  currentMatchIdPreview?: string | null;
  currentMatchIndex?: number;
  currentSeedIndex?: number;
  currentSeedPuuidPreview?: string | null;
  currentPatchOnly?: boolean;
  currentStage?:
    | "cancelled"
    | "chunk-complete"
    | "fetching-match-ids"
    | "fetching-matches"
    | "initializing"
    | "persisting"
    | "riot-authentication-failed"
    | "scan-complete"
    | "waiting-for-rate-limit";
  aggregationSkippedReason?: string | null;
  isComplete?: boolean;
  lastProgressAt?: string;
  storedMatchIds?: string[];
  completedMatchIds?: string[];
  workerHeartbeatAt?: string;
  workerInvocationId?: string;
  workerLeaseExpiresAt?: string;
  workerState?: "idle" | "running" | "stalled";
  workerBatchSize?: number;
  workerRemainingMatches?: number;
  lastRiotRequestAt?: string | null;
  rateLimitLongWindowLimit?: number;
  rateLimitLongWindowUsage?: number;
  rateLimitReason?: string | null;
  rateLimitRetries?: number;
  rateLimitRequestsDelayed?: number;
  rateLimitShortWindowLimit?: number;
  rateLimitShortWindowUsage?: number;
  rateLimitWaitEpisodes?: number;
  rateLimitWaitMs?: number;
  rateLimitWaitUntil?: string | null;
  rateLimitWaits?: number;
  riot429Responses?: number;
  riotApiFailure?: {
    aggregationSkipped: boolean;
    code: "riot-authentication-failed" | "riot-access-denied" | string;
    detectedAt: string;
    endpointGroup: string;
    message: string;
    responseSummary: string | null;
    retryable: boolean;
    stage: string;
    status: number | null;
  };
  riotApiFailureCode?: string | null;
  riotApiFailureDetectedAt?: string | null;
  riotApiFailureEndpointGroup?: string | null;
  riotApiFailureStatus?: number | null;
  riotRateLimitTotalWaitMs?: number;
  matchesTotal?: number;
  matchesFetched?: number;
  matchesScanned?: number;
  matchesSkippedInvalidData?: number;
  matchesSkippedUnsupportedRoleChampion?: number;
  matchupPairsDiscovered?: number;
  maxDisplayedResults?: number;
  newCandidatesCreated?: number;
  patch?: string | null;
  patchSkipped?: number;
  queueSkipped?: number;
  role?: LeagueRole;
  roleSkipped?: number;
  seedCount?: number;
  participantPuuidsObserved?: number;
  observationDuplicatesSkipped?: number;
  observationInsertFailures?: number;
  observationsAggregated?: number;
  observationsByRole?: RiotObservationRoleCounts;
  observationsCreated?: number;
  observationsFound?: number;
  observationsInserted?: number;
  observationsSkippedTechnicalInvalid?: number;
  matchupObservationBatchAttempts?: number;
  matchupObservationSuccessfulBatches?: number;
  matchupObservationFailedBatchAttempts?: number;
  matchupObservationBatchSplits?: number;
  matchupObservationTransientRetries?: number;
  matchupObservationIsolatedFailures?: number;
  matchupObservationUnresolvedBatchFailures?: number;
  matchupObservationPersistenceFailureSamples?: RiotPersistenceFailureSample[];
  matchupObservationPersistenceErrorGroups?: RiotPersistenceErrorGroup[];
  matchupObservationValidationFailures?: number;
  matchupObservationValidationSummary?: RiotValidationIssueSummary;
  matchupObservationsRejected?: number;
  matchupObservationsValidated?: number;
  matchupRankAttributionFailures?: number;
  matchupRankAttributionsAttempted?: number;
  matchupRankAttributionsSinglePlayer?: number;
  matchupRankAttributionsTwoPlayer?: number;
  matchupRankAttributionsUnknown?: number;
  matchupRankParticipantsNotFound?: number;
  matchupRankSnapshotTooOld?: number;
  seedCandidatesCreatedOrUpdated?: number;
  selectedRoleMatchupsFound?: number;
  statsRowsUpdated?: number;
  targetMatches?: number;
  uniqueCandidatesEncountered?: number;
  uniqueMatchIds?: number;
  wins?: number;
};

export type RiotValidationIssueSummary = {
  issuesByCode: Record<string, number>;
  samples: Array<{
    code: string;
    field: string;
    matchId: string | null;
    safeValue: string | null;
  }>;
  totalRejected: number;
};

export type RiotPersistenceFailureSample = {
  errorClass: string;
  errorCode: string | null;
  message: string;
  rowIdentity: string;
  safeFields: Record<string, string | number | boolean | null>;
  table: string;
};

export type RiotPersistenceErrorGroup = {
  errorClass: string;
  errorCode: string | null;
  failureCount: number;
  httpStatus: number | null;
  messageFingerprint: string;
};

export type RiotSeedCandidateSource =
  | "ladder_import"
  | "manual"
  | "match_discovery"
  | "matchup_rank_coverage"
  | "riot_id_resolver";
export type RiotSeedCandidateStatus =
  | "active"
  | "approved"
  | "candidate"
  | "cooldown"
  | "failed"
  | "ignored"
  | "queued";

export type RiotSeedCandidateRankEnrichmentStatus =
  | "failed"
  | "not_found"
  | "pending"
  | "queued"
  | "ranked"
  | "rate_limited"
  | "running"
  | "unranked";

export type RiotSeedCandidateTopChampion = {
  champion: string;
  games: number;
  lastPlayedAt: string | null;
  losses: number;
  role: LeagueRole;
  share: number;
  wins: number;
};

export type RiotSeedCandidateRoleDistribution = Partial<
  Record<
    LeagueRole,
    {
      games: number;
      share: number;
    }
  >
>;

export type RiotSeedCandidateView = {
  consecutive_scan_failures: number;
  created_at: string;
  estimated_primary_role: LeagueRole | null;
  estimated_secondary_role: LeagueRole | null;
  failed_scan_count: number;
  first_seen_at: string;
  first_seen_match_id: string | null;
  first_seen_scan_job_id: number | null;
  id: string;
  last_scan_candidate_observations_discovered: number | null;
  last_scan_duplicate_matches_skipped: number | null;
  last_scan_error_at: string | null;
  last_scan_error_code: string | null;
  last_scan_match_ids_fetched: number | null;
  last_scan_matchup_observations_inserted: number | null;
  last_scan_unique_matches_found: number | null;
  last_profiled_at: string | null;
  last_scanned_at: string | null;
  last_successful_scan_at: string | null;
  last_seen_at: string;
  latest_scan_job_id: number | null;
  latest_match_seen_at: string | null;
  lifecycle: SeedCandidateLifecycle;
  manually_rejected_at: string | null;
  manually_rejected_by: string | null;
  next_eligible_scan_at: string | null;
  next_retry_at: string | null;
  observed_games: number;
  platform_region: string;
  primary_champion: string | null;
  primary_champion_games: number;
  primary_champion_role: LeagueRole | null;
  primary_champion_share: number | null;
  primary_role_share: number | null;
  puuid: string;
  rank_division: string | null;
  rank_enrichment_attempts: number;
  rank_enrichment_error_code: string | null;
  rank_enrichment_error_message: string | null;
  rank_enrichment_failures: number;
  rank_enrichment_status: RiotSeedCandidateRankEnrichmentStatus;
  rank_fresh_blood: boolean | null;
  rank_hot_streak: boolean | null;
  rank_inactive: boolean | null;
  rank_last_attempted_at: string | null;
  rank_last_success_at: string | null;
  rank_league_points: number | null;
  rank_losses: number | null;
  rank_next_eligible_at: string | null;
  rank_queue_type: string | null;
  rank_tier: string | null;
  rank_veteran: boolean | null;
  rank_win_rate: number | null;
  rank_wins: number | null;
  ranked_at: string | null;
  regional_routing: string;
  rejection_reason: string | null;
  role_distribution: RiotSeedCandidateRoleDistribution;
  secondary_role_share: number | null;
  source: RiotSeedCandidateSource;
  status: RiotSeedCandidateStatus;
  successful_scan_count: number;
  times_scanned: number;
  top_champions: RiotSeedCandidateTopChampion[];
};

export type RiotSeedCandidateFilters = {
  lastScanned?: "all" | "never" | "recent" | "older";
  lifecycleState?: SeedCandidateLifecycleState | "all";
  minObservedGames?: number;
  minPrimaryChampionShare?: number;
  minPrimaryRoleShare?: number;
  platformRegion?: string;
  primaryChampion?: string;
  primaryRole?: LeagueRole | "all";
  rankLastRefreshed?: "all" | "never" | "recent" | "older";
  rankedState?: "all" | "ranked" | "unranked";
  rankStatus?: RiotSeedCandidateRankEnrichmentStatus | "all";
  rankTier?: string | "all";
  search?: string;
  source?: RiotSeedCandidateSource | "all";
  status?: RiotSeedCandidateStatus | "all";
};

export type RiotSeedCandidateSort =
  | "created_at"
  | "last_scanned_at"
  | "last_seen_at"
  | "observed_games"
  | "primary_champion_share"
  | "primary_role_share"
  | "rank_league_points"
  | "rank_last_success_at"
  | "rank_tier";

export type RiotSeedCandidatesResult =
  | {
      candidates: RiotSeedCandidateView[];
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

export type RiotSeedCandidateGroupedResult =
  | {
      counts: Record<RiotSeedCandidateRankGroupId, number>;
      groups: Partial<Record<RiotSeedCandidateRankGroupId, PaginatedSeedCandidates>>;
      lifecycleCounts: Record<SeedCandidateLifecycleState, number>;
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

export type RiotSeedCandidateGroupedQueryInput = {
  accessToken: string;
  filters?: RiotSeedCandidateFilters;
  groups: RiotSeedCandidateGroupPageRequest[];
};

export type RiotSeedCandidateLifecycleMutationResult =
  | {
      ok: true;
      updatedCount: number;
    }
  | {
      error: string;
      ok: false;
    };

export type MatchupRankAttributionMethod = "single-player" | "two-player-average" | "unknown";

export type MatchupRankCoverageSort =
  | "last_rank_refresh_at"
  | "latest_match_seen_at"
  | "observations_affected"
  | "priority_score"
  | "two_player_upgrade_potential"
  | "unknown_observations_affected";

export type MatchupRankCoverageFilters = {
  attributionMethod?: MatchupRankAttributionMethod | "all";
  champion?: string | null;
  hasCandidate?: "all" | "no" | "yes";
  lastRankRefresh?: "all" | "never" | "older" | "recent";
  minimumImpact?: number;
  minimumObservationsAffected?: number;
  patch?: string | null;
  platformRegion?: string | null;
  rankStatus?: RiotSeedCandidateRankEnrichmentStatus | "all" | "never_enriched";
  role?: LeagueRole | "all";
  twoPlayerUpgradeOnly?: boolean;
};

export type MatchupRankCoverageCandidate = {
  affectedMatchups: Array<{
    championA: string;
    championB: string;
    matchIdPreview: string;
    method: MatchupRankAttributionMethod;
    patch: string;
    role: LeagueRole;
  }>;
  candidateId: string | null;
  champions: string[];
  cooldownActive: boolean;
  existingCandidate: boolean;
  identityKey: string;
  isEligibleForRefresh: boolean;
  lastRankAttemptAt: string | null;
  lastRankRefreshAt: string | null;
  latestMatchSeenAt: string | null;
  nextEligibleAt: string | null;
  observationsAffected: number;
  platformRegion: string;
  priorityScore: number;
  puuid: string;
  puuidPreview: string;
  rankDivision: string | null;
  rankLeaguePoints: number | null;
  rankStatus: RiotSeedCandidateRankEnrichmentStatus | "never_enriched";
  rankTier: string | null;
  roles: LeagueRole[];
  sortPriorityScore: number;
  twoPlayerUpgradePotential: number;
  unknownObservationsAffected: number;
};

export type MatchupRankCoverageSummary = {
  anyRankCoveragePercent: number;
  singlePlayer: number;
  strictCoveragePercent: number;
  totalObservations: number;
  twoPlayerAverage: number;
  unknown: number;
};

export type MatchupRankCoverageProjectedImpact = {
  observationsAffected: number;
  twoPlayerUpgradePotential: number;
  unknownObservationsAffected: number;
};

export type MatchupRankCoverageQueueResult =
  | {
      candidates: MatchupRankCoverageCandidate[];
      ok: true;
      projectedImpact: MatchupRankCoverageProjectedImpact;
      summary: MatchupRankCoverageSummary;
    }
  | {
      error: string;
      ok: false;
    };

export type MatchupRankCoverageParticipantInput = {
  platformRegion: string;
  puuid: string;
};

export type RefreshMatchupRankCoverageParticipantsResult =
  | {
      candidatesRequested: number;
      createdCandidateCount: number;
      failedCount: number;
      notFoundCount: number;
      ok: true;
      rankedCount: number;
      rateLimitedCount: number;
      skippedCount: number;
      snapshotInsertedCount: number;
      total: number;
      unrankedCount: number;
    }
  | {
      error: string;
      ok: false;
    };

export type MatchupRankAttributionSummary = {
  alreadyAttributed: number;
  failures: number;
  participantsNotFound: number;
  processed: number;
  singlePlayer: number;
  snapshotTooOld: number;
  total: number;
  twoPlayerAverage: number;
  unknown: number;
};

export type MatchupRankCoverageAttributionResult =
  | {
      ok: true;
      summary: MatchupRankAttributionSummary;
    }
  | {
      error: string;
      ok: false;
    };

export type RiotSeedCandidateRankRefreshInput = {
  accessToken: string;
  candidateIds: string[];
  force?: boolean;
};

export type RiotSeedCandidateRankRefreshResult =
  | {
      failedCount: number;
      notFoundCount: number;
      ok: true;
      rankedCount: number;
      rateLimitedCount: number;
      skippedCount: number;
      snapshotInsertedCount: number;
      total: number;
      unrankedCount: number;
    }
  | {
      error: string;
      ok: false;
    };

export type RiotScanTargetResult = {
  counterChampion: string;
  counterChampionDisplayName?: string;
  enemyChampion: string;
  enemyChampionDisplayName?: string;
  games: number;
  losses: number;
  role: LeagueRole;
  tier: string;
  storedGamesAfterAggregation?: number;
  wasWrittenToStats: boolean;
  winRate: number;
  wins: number;
};

export type RiotScanDiscoveryResult = {
  championA: string;
  championADisplayName?: string;
  championAWins: number;
  championAWinRate: number;
  championB: string;
  championBDisplayName?: string;
  championBWins: number;
  championBWinRate: number;
  focusChampion?: string;
  focusChampionDisplayName?: string;
  focusChampionWinRate?: number;
  focusChampionWins?: number;
  games: number;
  opponentChampion?: string;
  opponentChampionDisplayName?: string;
  opponentWins?: number;
  representedInStats?: boolean;
  role: LeagueRole;
  storedGamesAfterAggregation?: number;
  storedTier?: string | null;
};

export type RiotScanJobView = {
  collection_job_id: number | null;
  collection_result_consumed_at: string | null;
  completed_at: string | null;
  counter_champion: string | null;
  created_at: string;
  enemy_champion: string | null;
  error_message: string | null;
  focus_champion_id: string | null;
  id: number;
  match_count: number;
  minimum_games: number;
  mode: RiotScanMode;
  progress: RiotScanSummary;
  results: RiotScanDiscoveryResult[] | RiotScanTargetResult | null;
  role: LeagueRole;
  seed_count: number;
  started_at: string | null;
  status: RiotScanStatus;
  summary: RiotScanSummary;
};

export type StartRiotScanJobInput = {
  accessToken: string;
  collectionJobId?: number | null;
  counterChampion?: string | null;
  currentPatchOnly: boolean;
  discoveryFocusChampion?: string | null;
  enemyChampion?: string | null;
  matchCount: number;
  maxDisplayedResults: number;
  minimumGames: number;
  mode: RiotScanMode;
  role: LeagueRole;
  seedPuuids: string[];
};

export type RiotScanJobResult =
  | {
      job: RiotScanJobView;
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

export type RiotScanJobsResult =
  | {
      jobs: RiotScanJobView[];
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

export type { CounterPickManagementMetricsResult };
export type {
  RiotCollectionInventoryResult,
  RiotCollectionJobResult,
  RiotCollectionJobsResult,
  StartRiotCollectionJobInput,
};
