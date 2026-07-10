"use server";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  createEmptyCounterPickManagementMetrics,
  createMetricValue,
  normalizeRiotScanJobMetrics,
} from "@/src/features/league/counter-pick-management-metrics";
import {
  calculateMechanicalMatchupFit,
  counterRankingV2TraitDefinitionsById,
  createCounterRankingV2MechanicalReview,
  createCounterRankingV2GeneratedDraftChampionProfile,
  counterRankingV2GeneratedDraftProfileVersion,
  getCounterRankingV2ChampionProfile,
  getCounterRankingV2ProfileKey,
  isCounterRankingV2ProfileValueInBounds,
  isCounterRankingV2AdjustmentReason,
  isCounterRankingV2ManualAdjustmentInBounds,
  normalizeCounterRankingV2PublicEligible,
  normalizeCounterRankingV2TraitId,
  normalizeCounterRankingV2ProfileStatus,
  isCounterRankingV2ReviewStatus,
  type CounterRankingV2ChampionProfile,
  type CounterRankingV2AdjustmentReason,
  type CounterRankingV2MechanicalReview,
  type CounterRankingV2ProfileReview,
  type CounterRankingV2ProfileStatus,
  type CounterRankingV2ProfileTrait,
  type CounterRankingV2TraitId,
  type CounterRankingV2ReviewStatus,
} from "@/src/features/league/counter-ranking-v2";
import { getSupportedChampionRoles } from "@/src/features/league/champion-roles";
import { isChampionIdSupportedInRole } from "@/src/features/league/champion-role-registry";
import type { ChampionMasteryRequirementLevel } from "@/src/features/league/champion-mastery-requirements";
import {
  createEmptyRiotCollectionDiscoveryDiagnostics,
  defaultRiotCollectionSafetyLimits,
  getAdaptiveRiotCollectionSeedBatchSize,
  getRiotCollectionDiscoveryStopDetail,
  getRiotCollectionTargetValidationError,
  isRiotCollectionTarget,
  isRiotCollectionTerminalStatus,
  normalizeCollectionScanSummary,
  riotCollectionLadderSourcesByBracket,
  riotCollectionRankBrackets,
  riotCollectionStatusLabels,
  shouldContinueRiotCollectionSeedDiscovery,
  type RiotCollectionDiscoveryDiagnostics,
  type RiotCollectionInventoryResult,
  type RiotCollectionJobProgress,
  type RiotCollectionJobResult,
  type RiotCollectionJobsResult,
  type RiotCollectionJobView,
  type RiotCollectionLadderSource,
  type RiotCollectionRankBracket,
  type RiotCollectionRole,
  type RiotCollectionStatus,
  type RiotCollectionStopReason,
  type RiotCollectionTarget,
  type StartRiotCollectionJobInput,
} from "@/src/features/league/riot-collection-jobs";
import type {
  CounterPickManagementMetricsResult,
  MatchupRankCoverageAttributionResult,
  MatchupRankCoverageCandidate,
  MatchupRankCoverageFilters,
  MatchupRankCoverageParticipantInput,
  MatchupRankCoverageQueueResult,
  MatchupRankCoverageSort,
  RefreshMatchupRankCoverageParticipantsResult,
  RiotSeedCandidateGroupedQueryInput,
  RiotSeedCandidateGroupedResult,
  RiotSeedCandidateFilters,
  RiotSeedCandidateRankRefreshInput,
  RiotSeedCandidateRankRefreshResult,
  RiotSeedCandidateSort,
  RiotSeedCandidatesResult,
  RiotSeedCandidateLifecycleMutationResult,
  RiotSeedCandidateView,
  RiotScanDiscoveryResult,
  RiotScanJobResult,
  RiotScanJobsResult,
  RiotScanJobView,
  RiotScanMode,
  RiotScanStatus,
  RiotScanSummary,
  RiotScanTargetResult,
  StartRiotScanJobInput,
} from "@/src/features/league/riot-scan-jobs";
import {
  deriveSeedCandidateLifecycle,
  getSeedScanCooldownEligibleAt,
  getSeedScanRetryEligibleAt,
  MAX_CONSECUTIVE_SCAN_FAILURES,
  MIN_SEED_OBSERVATIONS,
  RECENTLY_SCANNED_WINDOW_HOURS,
  seedCandidateLifecycleStates,
  type SeedCandidateLifecycleState,
} from "@/src/features/league/riot-seed-candidate-lifecycle";
import {
  getRiotSeedCandidateTotalPages,
  normalizeRiotSeedCandidatePage,
  normalizeRiotSeedCandidatePageSize,
  riotSeedCandidateRankGroupIds,
  riotSeedCandidateRankGroupsById,
  sortRiotSeedCandidateRows,
  type PaginatedSeedCandidates,
  type RiotSeedCandidateRankGroupId,
} from "@/src/features/league/riot-seed-candidate-rank-groups";
import { leagueRoles, type LeagueRole } from "@/src/features/league/roles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const maxMatchCount = 50;
const maxDisplayedResultsLimit = 100;
const maxSeedCandidatesPerScan = 20;
const maxSeedCandidateRankRefreshBatch = 20;
const defaultRiotScanMatchBatchSize = 5;
const riotScanLeaseDurationMs = 2 * 60 * 1000;
const maxDiscoveryCandidateRefetchChunkSize = 100;
const recentSeedCandidateScanHours = RECENTLY_SCANNED_WINDOW_HOURS;
const recentSeedCandidateRankRefreshHours = 24;
const defaultRegionalRoute = "europe";
const defaultPlatformRegion = "EUW1";
const maxWarningOnlyPersistenceFailureCount = 5;
const maxWarningOnlyPersistenceFailureRate = 0.01;
const riotScanJobSelect =
  "id, collection_job_id, collection_result_consumed_at, mode, status, role, seed_puuids, enemy_champion, counter_champion, focus_champion_id, match_count, minimum_games, progress, summary, results, error_message, created_at, started_at, completed_at";
const riotSeedCandidateSelect = [
  "id",
  "last_scan_candidate_observations_discovered",
  "last_scan_duplicate_matches_skipped",
  "last_scan_error_at",
  "last_scan_error_code",
  "last_scan_match_ids_fetched",
  "last_scan_matchup_observations_inserted",
  "last_scan_unique_matches_found",
  "puuid",
  "platform_region",
  "regional_routing",
  "source",
  "status",
  "first_seen_match_id",
  "first_seen_scan_job_id",
  "first_seen_at",
  "last_seen_at",
  "observed_games",
  "estimated_primary_role",
  "estimated_secondary_role",
  "primary_role_share",
  "secondary_role_share",
  "primary_champion",
  "primary_champion_role",
  "primary_champion_games",
  "primary_champion_share",
  "rank_queue_type",
  "rank_tier",
  "rank_division",
  "rank_league_points",
  "rank_wins",
  "rank_losses",
  "rank_win_rate",
  "rank_hot_streak",
  "rank_veteran",
  "rank_fresh_blood",
  "rank_inactive",
  "ranked_at",
  "rank_last_attempted_at",
  "rank_last_success_at",
  "rank_next_eligible_at",
  "rank_enrichment_status",
  "rank_enrichment_error_code",
  "rank_enrichment_error_message",
  "rank_enrichment_attempts",
  "rank_enrichment_failures",
  "role_distribution",
  "top_champions",
  "last_profiled_at",
  "last_scanned_at",
  "last_successful_scan_at",
  "latest_scan_job_id",
  "next_eligible_scan_at",
  "next_retry_at",
  "manually_rejected_at",
  "manually_rejected_by",
  "rejection_reason",
  "times_scanned",
  "successful_scan_count",
  "failed_scan_count",
  "consecutive_scan_failures",
  "latest_match_seen_at",
  "created_at",
].join(", ");
const counterRankingV2MechanicalReviewSelect = [
  "adjustment_reason",
  "admin_review_note",
  "calculated_mechanical_score",
  "counter_champion_id",
  "created_at",
  "enemy_champion_id",
  "final_mechanical_score",
  "generated_at",
  "generated_by",
  "high_mastery_required",
  "manual_adjustment",
  "public_eligible",
  "review_status",
  "reviewed_at",
  "reviewed_by",
  "role",
  "updated_at",
].join(", ");
const counterRankingV2ProfileReviewSelect = [
  "champion_id",
  "role",
  "trait_profile_version",
  "vulnerability_profile_version",
  "status",
  "reviewed_by",
  "reviewed_at",
  "notes",
  "created_at",
  "updated_at",
].join(", ");
const counterRankingV2TraitProfileSelect = [
  "champion_id",
  "role",
  "profile_version",
  "strengths",
  "notes",
  "mastery_requirement",
  "identity_summary",
  "known_strengths",
  "created_at",
  "updated_at",
  "updated_by",
].join(", ");
const counterRankingV2VulnerabilityProfileSelect = [
  "champion_id",
  "role",
  "profile_version",
  "vulnerabilities",
  "notes",
  "known_weaknesses",
  "created_at",
  "updated_at",
  "updated_by",
].join(", ");

type AuthorizedClientResult =
  | {
      ok: true;
      userId: string;
    }
  | {
      error: string;
      ok: false;
    };

type RiotScanJobRow = {
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
  progress: RiotScanSummary | null;
  results: RiotScanDiscoveryResult[] | RiotScanTargetResult | null;
  role: LeagueRole;
  seed_puuids: string[] | null;
  started_at: string | null;
  status: RiotScanStatus;
  summary: RiotScanSummary | null;
};

type RiotCollectionJobRow = {
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
  new_matchup_observations: number;
  platform: string;
  progress: RiotCollectionJobProgress | null;
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
  summary: Record<string, unknown> | null;
  target_unique_matches: RiotCollectionTarget;
  unique_matches_processed: number;
  updated_at: string;
  warning_count: number;
};

type RiotCollectionSeedCandidateRow = RiotSeedCandidateView & {
  latest_scan_job_id: number | null;
};

type RiotScanJobMetricsRow = {
  completed_at: string | null;
  id: number;
  progress: RiotScanSummary | null;
  summary: RiotScanSummary | null;
};

type RiotCollectionMetricRow = {
  id: number;
  platform: string | null;
  rank_bracket: string | null;
  resolved_patch: string | null;
  role: string | null;
  status: string;
  updated_at: string | null;
};

type CounterRankingV2MechanicalReviewRow = {
  adjustment_reason: CounterRankingV2AdjustmentReason;
  admin_review_note: string | null;
  calculated_mechanical_score: number;
  counter_champion_id: string;
  created_at: string;
  enemy_champion_id: string;
  final_mechanical_score: number;
  generated_at: string | null;
  generated_by: string | null;
  high_mastery_required: boolean | null;
  manual_adjustment: number;
  public_eligible: boolean;
  review_status: CounterRankingV2ReviewStatus | "high_mastery_required";
  reviewed_at: string | null;
  reviewed_by: string | null;
  role: LeagueRole;
  updated_at: string;
};

type CounterRankingV2ProfileReviewRow = {
  champion_id: string;
  created_at: string;
  notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  role: LeagueRole;
  status: string;
  trait_profile_version: number;
  updated_at: string;
  vulnerability_profile_version: number;
};

type CounterRankingV2TraitProfileRow = {
  champion_id: string;
  created_at: string;
  identity_summary: string | null;
  known_strengths: unknown;
  mastery_requirement: string | null;
  notes: string | null;
  profile_version: number;
  role: LeagueRole;
  strengths: unknown;
  updated_at: string;
  updated_by: string | null;
};

type CounterRankingV2VulnerabilityProfileRow = {
  champion_id: string;
  created_at: string;
  known_weaknesses: unknown;
  notes: string | null;
  profile_version: number;
  role: LeagueRole;
  updated_at: string;
  updated_by: string | null;
  vulnerabilities: unknown;
};

type CounterRankingV2ActiveChampionRow = {
  id: string;
};

type RiotSeedCandidateQueryBuilder = {
  eq: (column: string, value: unknown) => RiotSeedCandidateQueryBuilder;
  gt: (column: string, value: unknown) => RiotSeedCandidateQueryBuilder;
  gte: (column: string, value: unknown) => RiotSeedCandidateQueryBuilder;
  in: (column: string, values: unknown[]) => RiotSeedCandidateQueryBuilder;
  is: (column: string, value: unknown) => RiotSeedCandidateQueryBuilder;
  lt: (column: string, value: unknown) => RiotSeedCandidateQueryBuilder;
  lte: (column: string, value: unknown) => RiotSeedCandidateQueryBuilder;
  not: (column: string, operator: string, value: unknown) => RiotSeedCandidateQueryBuilder;
  or: (filters: string) => RiotSeedCandidateQueryBuilder;
};

type CountQueryBuilder = PromiseLike<{
  count: number | null;
  error: { message?: string } | null;
}> & {
  eq: (column: string, value: unknown) => CountQueryBuilder;
  in: (column: string, values: unknown[]) => CountQueryBuilder;
  not: (column: string, operator: string, value: unknown) => CountQueryBuilder;
};

export type LeagueChampionRegistryAdminStatusResult =
  | {
      ok: true;
      status: {
        activeDatabaseChampionCount: number;
        conflictCount: number;
        conflicts: string[];
        databaseChampionCount: number;
        inactiveReturnedByRiotCount: number;
        inactiveReturnedByRiot: string[];
        lastSyncedAt: string | null;
        lastSyncError: string | null;
        lastSyncStatus: string;
        missing: string[];
        missingCount: number;
        nameMismatchCount: number;
        nameMismatches: string[];
        registryOk: boolean;
        sourceChampionCount: number;
        sourceVersion: string;
        unknown: string[];
        unknownCount: number;
      };
    }
  | {
      error: string;
      ok: false;
    };

export type CounterRankingV2MechanicalReviewsResult =
  | {
      ok: true;
      reviews: CounterRankingV2MechanicalReview[];
    }
  | {
      error: string;
      ok: false;
    };

export type SyncLeagueChampionRegistryAdminResult =
  | {
      ok: true;
      status: Extract<LeagueChampionRegistryAdminStatusResult, { ok: true }>["status"];
      summary: {
        deactivated: number;
        failed: number;
        failures: string[];
        inserted: number;
        remainingMissing: number;
        skipped: number;
        sourceVersion: string;
        updated: number;
      };
    }
  | {
      error: string;
      ok: false;
    };

export type CounterRankingV2ProfileReviewsResult =
  | {
      ok: true;
      reviews: CounterRankingV2ProfileReview[];
    }
  | {
      error: string;
      ok: false;
    };

export type CounterRankingV2EditableProfilesResult =
  | {
      ok: true;
      profiles: CounterRankingV2ChampionProfile[];
    }
  | {
      error: string;
      ok: false;
    };

export type BackfillCounterRankingV2ProfileDraftsResult =
  | {
      ok: true;
      summary: {
        activeChampions: number;
        createdProfiles: number;
        generatedDraftProfiles: number;
        invalidStoredProfiles: number;
        missingProfiles: number;
        needsRevisionProfiles: number;
        repairedProfiles: number;
        reviewedProfiles: number;
        roleCounts: Record<LeagueRole, number>;
        skippedProfiles: number;
        supportedChampionRoleProfiles: number;
        totalProfiles: number;
      };
    }
  | {
      error: string;
      ok: false;
    };

export type SaveCounterRankingV2MechanicalReviewInput = {
  accessToken: string;
  adjustmentReason: CounterRankingV2AdjustmentReason;
  adminReviewNote: string | null;
  counterChampionId: string;
  enemyChampionId: string;
  highMasteryRequired?: boolean;
  manualAdjustment: number;
  publicEligible: boolean;
  reviewStatus: CounterRankingV2ReviewStatus;
  role: LeagueRole;
};

export type SaveCounterRankingV2ProfileReviewInput = {
  accessToken: string;
  championId: string;
  reviewNote: string | null;
  role: LeagueRole;
  status: CounterRankingV2ProfileStatus;
};

export type SaveCounterRankingV2ProfileManagementInput = SaveCounterRankingV2ProfileReviewInput & {
  identitySummary: string | null;
  knownStrengths: string[];
  knownWeaknesses: string[];
  masteryRequirement: ChampionMasteryRequirementLevel | null;
  strengths: CounterRankingV2ProfileTrait[];
  vulnerabilities: CounterRankingV2ProfileTrait[];
};

export type MarkCounterRankingV2ProfileReviewedTarget = {
  championId: string;
  role: LeagueRole;
};

export type MarkCounterRankingV2ProfilesReviewedInput = {
  accessToken: string;
  profiles: MarkCounterRankingV2ProfileReviewedTarget[];
};

export type BatchCounterRankingV2MechanicalReviewAction =
  | "approve"
  | "needs_review"
  | "reject";

export type BatchSaveCounterRankingV2MechanicalReviewsInput = {
  accessToken: string;
  action: BatchCounterRankingV2MechanicalReviewAction;
  counterChampionIds: string[];
  enemyChampionId: string;
  publicEligible?: boolean;
  role: LeagueRole;
};

export type SaveCounterRankingV2MechanicalReviewResult =
  | {
      ok: true;
      review: CounterRankingV2MechanicalReview;
    }
  | {
      error: string;
      ok: false;
    };

export type SaveCounterRankingV2ProfileReviewResult =
  | {
      ok: true;
      review: CounterRankingV2ProfileReview;
    }
  | {
      error: string;
      ok: false;
    };

export type SaveCounterRankingV2ProfileManagementResult =
  | {
      ok: true;
      profile: CounterRankingV2ChampionProfile;
      review: CounterRankingV2ProfileReview;
    }
  | {
      error: string;
      ok: false;
    };

export type MarkCounterRankingV2ProfilesReviewedResult =
  | {
      ok: true;
      reviews: CounterRankingV2ProfileReview[];
      skipped: Array<MarkCounterRankingV2ProfileReviewedTarget & { reason: string }>;
    }
  | {
      error: string;
      ok: false;
    };

export type BatchSaveCounterRankingV2MechanicalReviewsResult =
  | {
      ok: true;
      reviews: CounterRankingV2MechanicalReview[];
    }
  | {
      error: string;
      ok: false;
    };

export async function startRiotScanJob(input: StartRiotScanJobInput): Promise<RiotScanJobResult> {
  const authResult = await getAuthorizedAdmin(input.accessToken, "run Riot match scans");

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const registryResult = await loadChampionRegistry(serviceClientResult.supabase);

  if (!registryResult.ok) {
    return registryResult;
  }

  const validation = validateStartInput(
    input,
    registryResult.registry,
    registryResult.normalizeChampionIdentifier,
  );

  if (!validation.ok) {
    return validation;
  }

  const { data: insertedJob, error: insertError } = await serviceClientResult.supabase
    .from("riot_scan_jobs")
    .insert({
      counter_champion: validation.mode === "target" ? validation.counterChampion : null,
      collection_job_id: input.collectionJobId ?? null,
      created_by: authResult.userId,
      enemy_champion: validation.mode === "target" ? validation.enemyChampion : null,
      focus_champion_id: validation.mode === "discovery" ? validation.discoveryFocusChampion : null,
      match_count: validation.matchCount,
      minimum_games: validation.minimumGames,
      mode: validation.mode,
      progress: {
        discoveryFocusChampion: validation.discoveryFocusChampion,
        maxDisplayedResults: validation.maxDisplayedResults,
        seedCount: validation.seedPuuids.length,
      },
      results: validation.mode === "discovery" ? [] : null,
      role: validation.role,
      seed_puuids: validation.seedPuuids,
      status: "queued",
      summary: {
        currentPatchOnly: validation.currentPatchOnly,
        discoveryFocusChampion: validation.discoveryFocusChampion,
        maxDisplayedResults: validation.maxDisplayedResults,
        seedCount: validation.seedPuuids.length,
      },
    })
    .select(riotScanJobSelect)
    .single<RiotScanJobRow>();

  if (insertError || !insertedJob) {
    return {
      error: "Database write failed while creating the scan job.",
      ok: false,
    };
  }

  await markSeedCandidatesQueued({
    jobId: insertedJob.id,
    seedPuuids: validation.seedPuuids,
    supabase: serviceClientResult.supabase,
  });

  if (!process.env.RIOT_API_KEY) {
    const failedJob = await failJob({
      errorMessage: "Missing Riot API configuration.",
      jobId: insertedJob.id,
      supabase: serviceClientResult.supabase,
    });
    await markSeedCandidatesScanFailed({
      errorCode: "missing_riot_api_key",
      scanJobId: insertedJob.id,
      seedPuuids: validation.seedPuuids,
      supabase: serviceClientResult.supabase,
    });

    return {
      job: failedJob ?? sanitizeJobRow(insertedJob),
      ok: true,
    };
  }

  await runRiotScanJob({
    collectionJobId: input.collectionJobId ?? null,
    input: validation,
    jobId: insertedJob.id,
    supabase: serviceClientResult.supabase,
  });

  return {
    job: sanitizeJobRow(insertedJob),
    ok: true,
  };
}

export async function getLeagueChampionRegistryAdminStatus({
  accessToken,
}: {
  accessToken: string;
}): Promise<LeagueChampionRegistryAdminStatusResult> {
  const authResult = await getAuthorizedAdmin(accessToken, "view League champion registry status");

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  try {
    const { getLeagueChampionRegistryStatus } =
      await import("@/scripts/lib/league-champion-registry.mjs");
    const status = await getLeagueChampionRegistryStatus({
      supabase: serviceClientResult.supabase,
    });

    return {
      ok: true,
      status: {
        activeDatabaseChampionCount: status.activeDatabaseChampionCount,
        conflictCount: status.conflicts.length,
        conflicts: status.conflicts.slice(0, 8),
        databaseChampionCount: status.databaseChampionCount,
        inactiveReturnedByRiot: status.inactiveReturnedByRiot.slice(0, 8).map(getRegistryRowLabel),
        inactiveReturnedByRiotCount: status.inactiveReturnedByRiot.length,
        lastSyncedAt: status.lastSyncedAt,
        lastSyncError: status.lastSyncError,
        lastSyncStatus: status.lastSyncStatus,
        missing: status.missing.slice(0, 8).map(getRegistryRowLabel),
        missingCount: status.missing.length,
        nameMismatchCount: status.nameMismatches.length,
        nameMismatches: status.nameMismatches.slice(0, 8).map((mismatch) => {
          return `${mismatch.id}: ${mismatch.databaseName} -> ${mismatch.sourceName}`;
        }),
        registryOk: status.ok,
        sourceChampionCount: status.sourceChampionCount,
        sourceVersion: status.sourceVersion,
        unknown: status.unknown.slice(0, 8).map(getRegistryRowLabel),
        unknownCount: status.unknown.length,
      },
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "League champion registry status could not be loaded.",
      ok: false,
    };
  }
}

export async function syncLeagueChampionRegistryAdmin({
  accessToken,
}: {
  accessToken: string;
}): Promise<SyncLeagueChampionRegistryAdminResult> {
  const authResult = await getAuthorizedAdmin(accessToken, "sync League champion registry");

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  try {
    const { getLeagueChampionRegistryStatus, syncLeagueChampionRegistry } =
      await import("@/scripts/lib/league-champion-registry.mjs");
    const beforeStatus = await getLeagueChampionRegistryStatus({
      supabase: serviceClientResult.supabase,
    });
    const summary = await syncLeagueChampionRegistry({
      supabase: serviceClientResult.supabase,
      version: beforeStatus.sourceVersion,
    });

    if (!summary.ok || summary.failures.length > 0) {
      console.warn("League champion registry sync completed with validation failures", {
        failures: summary.failures,
        sourceVersion: summary.sourceVersion,
      });
    }

    const afterStatus = await getLeagueChampionRegistryStatus({
      supabase: serviceClientResult.supabase,
      version: summary.sourceVersion,
    });

    return {
      ok: true,
      status: {
        activeDatabaseChampionCount: afterStatus.activeDatabaseChampionCount,
        conflictCount: afterStatus.conflicts.length,
        conflicts: afterStatus.conflicts.slice(0, 8),
        databaseChampionCount: afterStatus.databaseChampionCount,
        inactiveReturnedByRiot: afterStatus.inactiveReturnedByRiot
          .slice(0, 8)
          .map(getRegistryRowLabel),
        inactiveReturnedByRiotCount: afterStatus.inactiveReturnedByRiot.length,
        lastSyncedAt: afterStatus.lastSyncedAt,
        lastSyncError: afterStatus.lastSyncError,
        lastSyncStatus: afterStatus.lastSyncStatus,
        missing: afterStatus.missing.slice(0, 8).map(getRegistryRowLabel),
        missingCount: afterStatus.missing.length,
        nameMismatchCount: afterStatus.nameMismatches.length,
        nameMismatches: afterStatus.nameMismatches.slice(0, 8).map((mismatch) => {
          return `${mismatch.id}: ${mismatch.databaseName} -> ${mismatch.sourceName}`;
        }),
        registryOk: afterStatus.ok,
        sourceChampionCount: afterStatus.sourceChampionCount,
        sourceVersion: afterStatus.sourceVersion,
        unknown: afterStatus.unknown.slice(0, 8).map(getRegistryRowLabel),
        unknownCount: afterStatus.unknown.length,
      },
      summary: {
        deactivated: summary.championsDeactivated,
        failed: summary.failed,
        failures: summary.failures.slice(0, 8),
        inserted: summary.championsInserted,
        remainingMissing: afterStatus.missing.length,
        skipped: summary.championsUnchanged,
        sourceVersion: summary.sourceVersion,
        updated: summary.championsUpdated,
      },
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "League champion registry sync could not be completed.",
      ok: false,
    };
  }
}

export async function getRiotSeedCandidates({
  accessToken,
  filters = {},
  limit = 25,
  sort = "last_seen_at",
}: {
  accessToken: string;
  filters?: RiotSeedCandidateFilters;
  limit?: number;
  sort?: RiotSeedCandidateSort;
}): Promise<RiotSeedCandidatesResult> {
  const authResult = await getAuthorizedAdmin(accessToken, "view Riot seed candidates");

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const orderColumn = getCandidateSortColumn(sort);
  const { data, error } = await buildRiotSeedCandidateQuery({
    filters,
    supabase: serviceClientResult.supabase,
  })
    .order(orderColumn, { ascending: false, nullsFirst: false })
    .limit(sort === "rank_tier" ? 100 : Math.min(Math.max(limit, 1), 100))
    .returns<RiotSeedCandidateView[]>();

  if (error) {
    return {
      error: "Seed candidates could not be loaded.",
      ok: false,
    };
  }

  return {
    candidates: sortCandidateRows(data ?? [], sort)
      .slice(0, Math.min(Math.max(limit, 1), 100))
      .map(hydrateSeedCandidateLifecycle),
    ok: true,
  };
}

export async function getCounterPickManagementMetrics({
  accessToken,
}: {
  accessToken: string;
}): Promise<CounterPickManagementMetricsResult> {
  const authResult = await getAuthorizedAdmin(accessToken, "view Counter Pick management metrics");

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const supabase = serviceClientResult.supabase;
  const metrics = createEmptyCounterPickManagementMetrics();

  await Promise.all([
    loadCountMetric({
      label: "Counter Pick guides",
      loader: () => countRows(supabase, "league_counter_picks"),
      onLoaded: (metric) => {
        metrics.editorial.totalGuides = metric;
      },
    }),
    loadCountMetric({
      label: "Reviewed Counter Pick guides",
      loader: () =>
        countRows(supabase, "league_counter_picks", (query) =>
          query.eq("generation_status", "reviewed"),
        ),
      onLoaded: (metric) => {
        metrics.editorial.reviewedGuides = metric;
      },
    }),
    loadCountMetric({
      label: "Draft Counter Pick guides",
      loader: () =>
        countRows(supabase, "league_counter_picks", (query) =>
          query.eq("generation_status", "draft"),
        ),
      onLoaded: (metric) => {
        metrics.editorial.visibleDrafts = metric;
      },
    }),
    loadCountMetric({
      label: "Riot matchup observations",
      loader: () => countRows(supabase, "riot_matchup_observations"),
      onLoaded: (metric) => {
        metrics.pipeline.matchupObservations = metric;
      },
    }),
    loadCountMetric({
      label: "Counter Pick stat rows",
      loader: () => countRows(supabase, "counter_pick_stats"),
      onLoaded: (metric) => {
        metrics.pipeline.counterPickStatRows = metric;
      },
    }),
    loadCountMetric({
      label: "Public counters",
      loader: () =>
        countRows(supabase, "counter_ranking_v2_mechanical_reviews", (query) =>
          query
            .in("review_status", ["verified_strong_counter", "verified_soft_counter"])
            .eq("public_eligible", true),
        ),
      onLoaded: (metric) => {
        metrics.review.publicCounters = metric;
      },
    }),
    loadCountMetric({
      label: "Reviewed counter rows",
      loader: () =>
        countRows(supabase, "counter_ranking_v2_mechanical_reviews", (query) =>
          query.not("review_status", "eq", "unreviewed"),
        ),
      onLoaded: (metric) => {
        metrics.review.reviewedCounterRows = metric;
      },
    }),
    loadCountMetric({
      label: "Unreviewed suggestions",
      loader: () =>
        countRows(supabase, "counter_ranking_v2_mechanical_reviews", (query) =>
          query.eq("review_status", "unreviewed"),
        ),
      onLoaded: (metric) => {
        metrics.review.unreviewedSuggestions = metric;
      },
    }),
    loadCountMetric({
      label: "Unique matchup groups",
      loader: () => countUniqueMatchupGroups(supabase),
      onLoaded: (metric) => {
        metrics.pipeline.uniqueMatchupGroups = metric;
      },
    }),
    loadCountMetric({
      label: "Riot seed candidates",
      loader: () => countRows(supabase, "riot_seed_candidates"),
      onLoaded: (metric) => {
        metrics.operations.seedCandidates = metric;
      },
    }),
    loadCountMetric({
      label: "Active Riot collection jobs",
      loader: () =>
        countRows(supabase, "riot_collection_jobs", (query) =>
          query.not("status", "in", "(cancelled,completed,completed-partial,failed)"),
        ),
      onLoaded: (metric) => {
        metrics.operations.activeCollectionJobs = metric;
      },
    }),
    loadLatestSuccessfulScanMetric(supabase, metrics),
    loadLatestCollectionMetric(supabase, metrics),
  ]);

  return {
    metrics,
    ok: true,
  };
}

export async function getCounterRankingV2ProfileReviews({
  accessToken,
}: {
  accessToken: string;
}): Promise<CounterRankingV2ProfileReviewsResult> {
  const authResult = await getAuthorizedAdmin(
    accessToken,
    "view Counter Ranking V2 profile reviews",
  );

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const { data, error } = await serviceClientResult.supabase
    .from("counter_ranking_v2_profile_reviews")
    .select(counterRankingV2ProfileReviewSelect)
    .order("updated_at", { ascending: false })
    .returns<CounterRankingV2ProfileReviewRow[]>();

  if (error) {
    console.error("Counter Ranking V2 profile reviews load failed", {
      error: getSafeDatabaseError(error),
      table: "counter_ranking_v2_profile_reviews",
    });

    return {
      error: "Counter Ranking V2 profile reviews could not be loaded.",
      ok: false,
    };
  }

  return {
    ok: true,
    reviews: (data ?? []).map(toCounterRankingV2ProfileReview),
  };
}

export async function getCounterRankingV2EditableProfiles({
  accessToken,
}: {
  accessToken: string;
}): Promise<CounterRankingV2EditableProfilesResult> {
  const authResult = await getAuthorizedAdmin(
    accessToken,
    "view Counter Ranking V2 editable profiles",
  );

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const [traitResult, vulnerabilityResult] = await Promise.all([
    serviceClientResult.supabase
      .from("counter_ranking_v2_champion_trait_profiles")
      .select(counterRankingV2TraitProfileSelect)
      .returns<CounterRankingV2TraitProfileRow[]>(),
    serviceClientResult.supabase
      .from("counter_ranking_v2_champion_vulnerability_profiles")
      .select(counterRankingV2VulnerabilityProfileSelect)
      .returns<CounterRankingV2VulnerabilityProfileRow[]>(),
  ]);

  if (traitResult.error || vulnerabilityResult.error) {
    console.error("Counter Ranking V2 editable profiles load failed", {
      traitError: traitResult.error ? getSafeDatabaseError(traitResult.error) : null,
      vulnerabilityError: vulnerabilityResult.error
        ? getSafeDatabaseError(vulnerabilityResult.error)
        : null,
    });

    return {
      error: "Counter Ranking V2 editable profiles could not be loaded.",
      ok: false,
    };
  }

  return {
    ok: true,
    profiles: mergeCounterRankingV2EditableProfileRows({
      traitRows: traitResult.data ?? [],
      vulnerabilityRows: vulnerabilityResult.data ?? [],
    }),
  };
}

export async function backfillCounterRankingV2GeneratedDraftProfiles({
  accessToken,
}: {
  accessToken: string;
}): Promise<BackfillCounterRankingV2ProfileDraftsResult> {
  const authResult = await getAuthorizedAdmin(
    accessToken,
    "create Counter Ranking V2 generated draft profiles",
  );

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const supabase = serviceClientResult.supabase;
  const [championsResult, traitResult, vulnerabilityResult, reviewResult] = await Promise.all([
    supabase
      .from("league_champions")
      .select("id")
      .eq("is_active", true)
      .order("id", { ascending: true })
      .returns<CounterRankingV2ActiveChampionRow[]>(),
    supabase
      .from("counter_ranking_v2_champion_trait_profiles")
      .select("champion_id, role")
      .returns<Pick<CounterRankingV2TraitProfileRow, "champion_id" | "role">[]>(),
    supabase
      .from("counter_ranking_v2_champion_vulnerability_profiles")
      .select("champion_id, role")
      .returns<Pick<CounterRankingV2VulnerabilityProfileRow, "champion_id" | "role">[]>(),
    supabase
      .from("counter_ranking_v2_profile_reviews")
      .select("champion_id, role, status")
      .returns<Pick<CounterRankingV2ProfileReviewRow, "champion_id" | "role" | "status">[]>(),
  ]);

  if (
    championsResult.error ||
    traitResult.error ||
    vulnerabilityResult.error ||
    reviewResult.error
  ) {
    console.error("Counter Ranking V2 generated draft profile backfill load failed", {
      championsError: championsResult.error ? getSafeDatabaseError(championsResult.error) : null,
      reviewError: reviewResult.error ? getSafeDatabaseError(reviewResult.error) : null,
      traitError: traitResult.error ? getSafeDatabaseError(traitResult.error) : null,
      vulnerabilityError: vulnerabilityResult.error
        ? getSafeDatabaseError(vulnerabilityResult.error)
        : null,
    });

    return {
      error: "Counter Ranking V2 profile draft backfill could not load current profile rows.",
      ok: false,
    };
  }

  const activeChampionIds = (championsResult.data ?? [])
    .map((champion) => champion.id.trim())
    .filter(Boolean);
  const activeChampionIdSet = new Set(activeChampionIds);
  const supportedProfileTargets = getSupportedCounterRankingV2ProfileTargets(activeChampionIds);
  const supportedProfileKeys = new Set(
    supportedProfileTargets.map((target) =>
      getCounterRankingV2ProfileKey(target.championId, target.role),
    ),
  );
  const traitProfileKeys = new Set(
    (traitResult.data ?? []).map((row) => getCounterRankingV2ProfileKey(row.champion_id, row.role)),
  );
  const vulnerabilityProfileKeys = new Set(
    (vulnerabilityResult.data ?? []).map((row) =>
      getCounterRankingV2ProfileKey(row.champion_id, row.role),
    ),
  );
  const reviewRows = reviewResult.data ?? [];
  const reviewProfileKeys = new Set(
    reviewRows.map((row) => getCounterRankingV2ProfileKey(row.champion_id, row.role)),
  );
  const invalidStoredProfileIds = new Set(
    [...traitProfileKeys, ...vulnerabilityProfileKeys, ...reviewProfileKeys].filter(
      (profileKey) => {
        const [championId] = profileKey.split("::");

        return !activeChampionIdSet.has(championId) || !supportedProfileKeys.has(profileKey);
      },
    ),
  );
  const now = new Date().toISOString();
  const missingTraitRows: Array<Record<string, unknown>> = [];
  const missingVulnerabilityRows: Array<Record<string, unknown>> = [];
  const missingReviewRows: Array<Record<string, unknown>> = [];
  let createdProfiles = 0;
  let repairedProfiles = 0;
  let skippedProfiles = 0;

  for (const { championId, role } of supportedProfileTargets) {
    const profileKey = getCounterRankingV2ProfileKey(championId, role);
    const hasTraitProfile = traitProfileKeys.has(profileKey);
    const hasVulnerabilityProfile = vulnerabilityProfileKeys.has(profileKey);
    const hasReviewProfile = reviewProfileKeys.has(profileKey);
    const isCompleteProfile = hasTraitProfile && hasVulnerabilityProfile && hasReviewProfile;
    const isMissingAllProfileRows = !hasTraitProfile && !hasVulnerabilityProfile && !hasReviewProfile;

    if (isCompleteProfile) {
      skippedProfiles += 1;
      continue;
    }

    if (isMissingAllProfileRows) {
      createdProfiles += 1;
    } else {
      repairedProfiles += 1;
    }

    if (!hasTraitProfile) {
      missingTraitRows.push(createCounterRankingV2GeneratedTraitProfileRow(championId, role, now));
      traitProfileKeys.add(profileKey);
    }

    if (!hasVulnerabilityProfile) {
      missingVulnerabilityRows.push(
        createCounterRankingV2GeneratedVulnerabilityProfileRow(championId, role, now),
      );
      vulnerabilityProfileKeys.add(profileKey);
    }

    if (!hasReviewProfile) {
      missingReviewRows.push(createCounterRankingV2GeneratedReviewRow(championId, role, now));
      reviewProfileKeys.add(profileKey);
      reviewRows.push({
        champion_id: championId,
        role,
        status: "draft",
      });
    }
  }

  const [traitInsertResult, vulnerabilityInsertResult, reviewInsertResult] = await Promise.all([
    missingTraitRows.length > 0
      ? supabase
          .from("counter_ranking_v2_champion_trait_profiles")
          .upsert(missingTraitRows, { ignoreDuplicates: true, onConflict: "champion_id,role" })
      : Promise.resolve({ error: null }),
    missingVulnerabilityRows.length > 0
      ? supabase
          .from("counter_ranking_v2_champion_vulnerability_profiles")
          .upsert(missingVulnerabilityRows, {
            ignoreDuplicates: true,
            onConflict: "champion_id,role",
          })
      : Promise.resolve({ error: null }),
    missingReviewRows.length > 0
      ? supabase
          .from("counter_ranking_v2_profile_reviews")
          .upsert(missingReviewRows, { ignoreDuplicates: true, onConflict: "champion_id,role" })
      : Promise.resolve({ error: null }),
  ]);

  if (traitInsertResult.error || vulnerabilityInsertResult.error || reviewInsertResult.error) {
    console.error("Counter Ranking V2 generated draft profile backfill save failed", {
      reviewError: reviewInsertResult.error ? getSafeDatabaseError(reviewInsertResult.error) : null,
      traitError: traitInsertResult.error ? getSafeDatabaseError(traitInsertResult.error) : null,
      vulnerabilityError: vulnerabilityInsertResult.error
        ? getSafeDatabaseError(vulnerabilityInsertResult.error)
        : null,
    });

    return {
      error: "Counter Ranking V2 generated draft profiles could not be saved.",
      ok: false,
    };
  }

  const completeProfileCount = supportedProfileTargets.filter(({ championId, role }) => {
    const profileKey = getCounterRankingV2ProfileKey(championId, role);

    return (
      traitProfileKeys.has(profileKey) &&
      vulnerabilityProfileKeys.has(profileKey) &&
      reviewProfileKeys.has(profileKey)
    );
  }).length;
  const normalizedStatuses = reviewRows
    .filter((row) =>
      supportedProfileKeys.has(getCounterRankingV2ProfileKey(row.champion_id, row.role)),
    )
    .map((row) => normalizeCounterRankingV2ProfileStatus(row.status) ?? "draft");
  const roleCounts = Object.fromEntries(
    leagueRoles.map((role) => [
      role,
      supportedProfileTargets.filter((target) => target.role === role).length,
    ]),
  ) as Record<LeagueRole, number>;

  return {
    ok: true,
    summary: {
      activeChampions: activeChampionIds.length,
      createdProfiles,
      generatedDraftProfiles: normalizedStatuses.filter((status) => status === "draft").length,
      invalidStoredProfiles: invalidStoredProfileIds.size,
      missingProfiles: supportedProfileTargets.length - completeProfileCount,
      needsRevisionProfiles: normalizedStatuses.filter((status) => status === "needs_revision")
        .length,
      repairedProfiles,
      reviewedProfiles: normalizedStatuses.filter((status) => status === "reviewed").length,
      roleCounts,
      skippedProfiles,
      supportedChampionRoleProfiles: supportedProfileTargets.length,
      totalProfiles: completeProfileCount,
    },
  };
}

export async function getCounterRankingV2MechanicalReviews({
  accessToken,
  enemyChampionId,
  role,
}: {
  accessToken: string;
  enemyChampionId: string;
  role: LeagueRole;
}): Promise<CounterRankingV2MechanicalReviewsResult> {
  const authResult = await getAuthorizedAdmin(accessToken, "view Counter Ranking V2 reviews");

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  if (!enemyChampionId.trim()) {
    return {
      error: "Select an enemy champion before loading review rows.",
      ok: false,
    };
  }

  const registryResult = await loadChampionRegistry(serviceClientResult.supabase);

  if (!registryResult.ok) {
    return registryResult;
  }

  const resolvedEnemyChampion = registryResult.normalizeChampionIdentifier(
    normalizeChampionIdForReview(enemyChampionId),
    registryResult.registry,
  );

  if (!resolvedEnemyChampion) {
    console.error("Counter Ranking V2 review rows champion resolution failed", {
      enemyChampionId,
      normalizedEnemyChampionId: normalizeChampionIdForReview(enemyChampionId),
      table: "counter_ranking_v2_mechanical_reviews",
    });

    return {
      error: "Select a valid enemy champion before loading review rows.",
      ok: false,
    };
  }

  const { data, error } = await serviceClientResult.supabase
    .from("counter_ranking_v2_mechanical_reviews")
    .select(counterRankingV2MechanicalReviewSelect)
    .eq("enemy_champion_id", resolvedEnemyChampion.canonicalKey)
    .eq("role", role)
    .returns<CounterRankingV2MechanicalReviewRow[]>();

  if (error) {
    console.error("Counter Ranking V2 review rows load failed", {
      error: getSafeDatabaseError(error),
      enemyChampionId: resolvedEnemyChampion.canonicalKey,
      role,
      table: "counter_ranking_v2_mechanical_reviews",
    });

    return {
      error: "Counter Ranking V2 review rows could not be loaded.",
      ok: false,
    };
  }

  return {
    ok: true,
    reviews: (data ?? []).map(toCounterRankingV2MechanicalReview),
  };
}

export async function getCounterRankingV2AllMechanicalReviews({
  accessToken,
}: {
  accessToken: string;
}): Promise<CounterRankingV2MechanicalReviewsResult> {
  const authResult = await getAuthorizedAdmin(
    accessToken,
    "view Counter Ranking V2 review queue",
  );

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const reviews: CounterRankingV2MechanicalReviewRow[] = [];
  const pageSize = 1_000;

  for (let page = 0; ; page += 1) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await serviceClientResult.supabase
      .from("counter_ranking_v2_mechanical_reviews")
      .select(counterRankingV2MechanicalReviewSelect)
      .order("updated_at", { ascending: false })
      .range(from, to)
      .returns<CounterRankingV2MechanicalReviewRow[]>();

    if (error) {
      console.error("Counter Ranking V2 review queue load failed", {
        error: getSafeDatabaseError(error),
        page,
        table: "counter_ranking_v2_mechanical_reviews",
      });

      return {
        error: "Counter Ranking V2 review queue could not be loaded.",
        ok: false,
      };
    }

    const pageRows = data ?? [];

    reviews.push(...pageRows);

    if (pageRows.length < pageSize) {
      break;
    }
  }

  return {
    ok: true,
    reviews: reviews.map(toCounterRankingV2MechanicalReview),
  };
}

export async function saveCounterRankingV2ProfileReview(
  input: SaveCounterRankingV2ProfileReviewInput,
): Promise<SaveCounterRankingV2ProfileReviewResult> {
  const authResult = await getAuthorizedAdmin(
    input.accessToken,
    "save Counter Ranking V2 profile reviews",
  );

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const normalizedStatus = normalizeCounterRankingV2ProfileStatus(input.status);
  const role = input.role;

  if (!normalizedStatus) {
    return {
      error: "Select a valid profile status.",
      ok: false,
    };
  }

  const normalizedChampionId = normalizeChampionIdForReview(input.championId);

  if (!normalizedChampionId) {
    return {
      error: "Select a champion profile before saving review.",
      ok: false,
    };
  }

  const registryResult = await loadChampionRegistry(serviceClientResult.supabase);

  if (!registryResult.ok) {
    return registryResult;
  }

  const resolvedChampion = registryResult.normalizeChampionIdentifier(
    normalizedChampionId,
    registryResult.registry,
  );

  if (!resolvedChampion) {
    console.error("Counter Ranking V2 profile review champion resolution failed", {
      championId: input.championId,
      normalizedChampionId,
      table: "counter_ranking_v2_profile_reviews",
    });

    return {
      error: "Select a valid champion profile before saving review.",
      ok: false,
    };
  }

  const profile =
    getCounterRankingV2ChampionProfile(resolvedChampion.canonicalKey, undefined, undefined, role) ??
    createCounterRankingV2GeneratedDraftChampionProfile(resolvedChampion.canonicalKey, role);

  const now = new Date().toISOString();
  const isReviewed = normalizedStatus === "reviewed";
  const { data, error } = await serviceClientResult.supabase
    .from("counter_ranking_v2_profile_reviews")
    .upsert(
      {
        champion_id: resolvedChampion.canonicalKey,
        notes: nullableTrim(input.reviewNote),
        reviewed_at: isReviewed ? now : null,
        reviewed_by: isReviewed ? authResult.userId : null,
        role,
        status: normalizedStatus,
        trait_profile_version: profile.version,
        updated_at: now,
        vulnerability_profile_version: profile.version,
      },
      {
        onConflict: "champion_id,role",
      },
    )
    .select(counterRankingV2ProfileReviewSelect)
    .single<CounterRankingV2ProfileReviewRow>();

  if (error || !data) {
    console.error("Counter Ranking V2 profile review save failed", {
      championId: resolvedChampion.canonicalKey,
      error: error ? getSafeDatabaseError(error) : null,
      hasData: Boolean(data),
      role,
      table: "counter_ranking_v2_profile_reviews",
    });

    return {
      error: "Counter Ranking V2 profile review could not be saved.",
      ok: false,
    };
  }

  return {
    ok: true,
    review: toCounterRankingV2ProfileReview(data),
  };
}

export async function saveCounterRankingV2ProfileManagement(
  input: SaveCounterRankingV2ProfileManagementInput,
): Promise<SaveCounterRankingV2ProfileManagementResult> {
  const authResult = await getAuthorizedAdmin(
    input.accessToken,
    "save Counter Ranking V2 profile management",
  );

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const validation = validateCounterRankingV2ProfileManagementInput(input);

  if (!validation.ok) {
    return validation;
  }

  const registryResult = await loadChampionRegistry(serviceClientResult.supabase);

  if (!registryResult.ok) {
    return registryResult;
  }

  const resolvedChampion = registryResult.normalizeChampionIdentifier(
    validation.championId,
    registryResult.registry,
  );

  if (!resolvedChampion) {
    return {
      error: "Select a valid champion profile before saving profile edits.",
      ok: false,
    };
  }

  const baseProfile =
    getCounterRankingV2ChampionProfile(
      resolvedChampion.canonicalKey,
      undefined,
      undefined,
      validation.role,
    ) ?? createCounterRankingV2GeneratedDraftChampionProfile(resolvedChampion.canonicalKey, validation.role);
  const nextVersion = baseProfile.version;
  const now = new Date().toISOString();
  const isReviewed = validation.status === "reviewed";
  const [traitResult, vulnerabilityResult, reviewResult] = await Promise.all([
    serviceClientResult.supabase
      .from("counter_ranking_v2_champion_trait_profiles")
      .upsert(
        {
          champion_id: resolvedChampion.canonicalKey,
          identity_summary: validation.identitySummary,
          known_strengths: validation.knownStrengths,
          mastery_requirement: validation.masteryRequirement,
          notes: validation.identitySummary,
          profile_version: nextVersion,
          role: validation.role,
          strengths: validation.strengths,
          updated_at: now,
          updated_by: authResult.userId,
        },
        { onConflict: "champion_id,role" },
      )
      .select(counterRankingV2TraitProfileSelect)
      .single<CounterRankingV2TraitProfileRow>(),
    serviceClientResult.supabase
      .from("counter_ranking_v2_champion_vulnerability_profiles")
      .upsert(
        {
          champion_id: resolvedChampion.canonicalKey,
          known_weaknesses: validation.knownWeaknesses,
          notes: validation.knownWeaknesses.join("\n"),
          profile_version: nextVersion,
          role: validation.role,
          updated_at: now,
          updated_by: authResult.userId,
          vulnerabilities: validation.vulnerabilities,
        },
        { onConflict: "champion_id,role" },
      )
      .select(counterRankingV2VulnerabilityProfileSelect)
      .single<CounterRankingV2VulnerabilityProfileRow>(),
    serviceClientResult.supabase
      .from("counter_ranking_v2_profile_reviews")
      .upsert(
        {
          champion_id: resolvedChampion.canonicalKey,
          notes: validation.reviewNote,
          reviewed_at: isReviewed ? now : null,
          reviewed_by: isReviewed ? authResult.userId : null,
          role: validation.role,
          status: validation.status,
          trait_profile_version: nextVersion,
          updated_at: now,
          vulnerability_profile_version: nextVersion,
        },
        { onConflict: "champion_id,role" },
      )
      .select(counterRankingV2ProfileReviewSelect)
      .single<CounterRankingV2ProfileReviewRow>(),
  ]);

  if (
    traitResult.error ||
    vulnerabilityResult.error ||
    reviewResult.error ||
    !traitResult.data ||
    !vulnerabilityResult.data ||
    !reviewResult.data
  ) {
    console.error("Counter Ranking V2 profile management save failed", {
      championId: resolvedChampion.canonicalKey,
      reviewError: reviewResult.error ? getSafeDatabaseError(reviewResult.error) : null,
      role: validation.role,
      traitError: traitResult.error ? getSafeDatabaseError(traitResult.error) : null,
      vulnerabilityError: vulnerabilityResult.error
        ? getSafeDatabaseError(vulnerabilityResult.error)
        : null,
    });

    return {
      error: "Counter Ranking V2 profile edits could not be saved.",
      ok: false,
    };
  }

  const profile = mergeCounterRankingV2EditableProfileRows({
    traitRows: [traitResult.data],
    vulnerabilityRows: [vulnerabilityResult.data],
  })[0];

  return {
    ok: true,
    profile,
    review: toCounterRankingV2ProfileReview(reviewResult.data),
  };
}

export async function markCounterRankingV2ProfilesReviewed(
  input: MarkCounterRankingV2ProfilesReviewedInput,
): Promise<MarkCounterRankingV2ProfilesReviewedResult> {
  const authResult = await getAuthorizedAdmin(
    input.accessToken,
    "mark Counter Ranking V2 profiles reviewed",
  );

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const requestedProfiles = dedupeCounterRankingV2ProfileReviewTargets(input.profiles);

  if (requestedProfiles.length === 0) {
    return {
      error: "Select at least one mechanical profile to mark reviewed.",
      ok: false,
    };
  }

  const invalidRoleTarget = requestedProfiles.find((profile) => !leagueRoles.includes(profile.role));

  if (invalidRoleTarget) {
    return {
      error: `${invalidRoleTarget.championId || "Unknown profile"} has an invalid role.`,
      ok: false,
    };
  }

  const registryResult = await loadChampionRegistry(serviceClientResult.supabase);

  if (!registryResult.ok) {
    return registryResult;
  }

  const resolvedProfiles: MarkCounterRankingV2ProfileReviewedTarget[] = [];

  for (const profile of requestedProfiles) {
    const normalizedChampionId = normalizeChampionIdForReview(profile.championId);
    const resolvedChampion = normalizedChampionId
      ? registryResult.normalizeChampionIdentifier(normalizedChampionId, registryResult.registry)
      : null;

    if (!resolvedChampion) {
      return {
        error: `${profile.championId || "Unknown profile"} could not be resolved before approval.`,
        ok: false,
      };
    }

    resolvedProfiles.push({
      championId: resolvedChampion.canonicalKey,
      role: profile.role,
    });
  }

  const championIds = Array.from(new Set(resolvedProfiles.map((profile) => profile.championId)));
  const [traitResult, vulnerabilityResult, reviewResult] = await Promise.all([
    serviceClientResult.supabase
      .from("counter_ranking_v2_champion_trait_profiles")
      .select(counterRankingV2TraitProfileSelect)
      .in("champion_id", championIds)
      .returns<CounterRankingV2TraitProfileRow[]>(),
    serviceClientResult.supabase
      .from("counter_ranking_v2_champion_vulnerability_profiles")
      .select(counterRankingV2VulnerabilityProfileSelect)
      .in("champion_id", championIds)
      .returns<CounterRankingV2VulnerabilityProfileRow[]>(),
    serviceClientResult.supabase
      .from("counter_ranking_v2_profile_reviews")
      .select(counterRankingV2ProfileReviewSelect)
      .in("champion_id", championIds)
      .returns<CounterRankingV2ProfileReviewRow[]>(),
  ]);

  if (traitResult.error || vulnerabilityResult.error || reviewResult.error) {
    console.error("Counter Ranking V2 profile approval load failed", {
      reviewError: reviewResult.error ? getSafeDatabaseError(reviewResult.error) : null,
      traitError: traitResult.error ? getSafeDatabaseError(traitResult.error) : null,
      vulnerabilityError: vulnerabilityResult.error
        ? getSafeDatabaseError(vulnerabilityResult.error)
        : null,
    });

    return {
      error: "Counter Ranking V2 profiles could not be loaded before approval.",
      ok: false,
    };
  }

  const traitRows = (traitResult.data ?? []).filter((row) =>
    resolvedProfiles.some(
      (profile) => profile.championId === row.champion_id && profile.role === row.role,
    ),
  );
  const vulnerabilityRows = (vulnerabilityResult.data ?? []).filter((row) =>
    resolvedProfiles.some(
      (profile) => profile.championId === row.champion_id && profile.role === row.role,
    ),
  );
  const reviewRows = (reviewResult.data ?? []).filter((row) =>
    resolvedProfiles.some(
      (profile) => profile.championId === row.champion_id && profile.role === row.role,
    ),
  );
  const reviewRowsByProfileKey = new Map(
    reviewRows.map((row) => [getCounterRankingV2ProfileKey(row.champion_id, row.role), row] as const),
  );
  const editableProfilesByProfileKey = new Map(
    mergeCounterRankingV2EditableProfileRows({
      traitRows,
      vulnerabilityRows,
    }).map((profile) => [getCounterRankingV2ProfileKey(profile.championId, profile.role), profile] as const),
  );
  const now = new Date().toISOString();
  const approvalRows: Array<Record<string, unknown>> = [];
  const skipped: Array<MarkCounterRankingV2ProfileReviewedTarget & { reason: string }> = [];

  for (const target of resolvedProfiles) {
    const profileKey = getCounterRankingV2ProfileKey(target.championId, target.role);
    const currentReview = reviewRowsByProfileKey.get(profileKey) ?? null;
    const currentStatus = currentReview
      ? normalizeCounterRankingV2ProfileStatus(currentReview.status) ?? "draft"
      : "draft";

    if (!isChampionIdSupportedInRole(target.championId, target.role)) {
      skipped.push({ ...target, reason: "Unsupported or off-meta role." });
      continue;
    }

    if (currentStatus === "reviewed") {
      skipped.push({ ...target, reason: "Already reviewed." });
      continue;
    }

    if (currentStatus !== "draft" && currentStatus !== "needs_revision") {
      skipped.push({ ...target, reason: `Status ${currentStatus} is not eligible for approval.` });
      continue;
    }

    const profile =
      editableProfilesByProfileKey.get(profileKey) ??
      getCounterRankingV2ChampionProfile(target.championId, undefined, undefined, target.role);

    if (!profile) {
      return {
        error: `${target.championId} ${target.role} has no mechanical profile data to approve.`,
        ok: false,
      };
    }

    const validation = validateCounterRankingV2ProfileCanBeReviewed(profile);

    if (!validation.ok) {
      return {
        error: `${target.championId} ${target.role} cannot be marked reviewed: ${validation.error}`,
        ok: false,
      };
    }

    approvalRows.push({
      champion_id: target.championId,
      created_at: currentReview?.created_at ?? now,
      notes: currentReview?.notes ?? null,
      reviewed_at: now,
      reviewed_by: authResult.userId,
      role: target.role,
      status: "reviewed",
      trait_profile_version: profile.version,
      updated_at: now,
      vulnerability_profile_version: profile.version,
    });
  }

  if (approvalRows.length === 0) {
    return {
      ok: true,
      reviews: [],
      skipped,
    };
  }

  const { data, error } = await serviceClientResult.supabase
    .from("counter_ranking_v2_profile_reviews")
    .upsert(approvalRows, { onConflict: "champion_id,role" })
    .select(counterRankingV2ProfileReviewSelect)
    .returns<CounterRankingV2ProfileReviewRow[]>();

  if (error || !data) {
    console.error("Counter Ranking V2 profile approval save failed", {
      error: error ? getSafeDatabaseError(error) : null,
      profileCount: approvalRows.length,
      table: "counter_ranking_v2_profile_reviews",
    });

    return {
      error: "Counter Ranking V2 profiles could not be marked reviewed.",
      ok: false,
    };
  }

  return {
    ok: true,
    reviews: data.map(toCounterRankingV2ProfileReview),
    skipped,
  };
}

export async function saveCounterRankingV2MechanicalReview(
  input: SaveCounterRankingV2MechanicalReviewInput,
): Promise<SaveCounterRankingV2MechanicalReviewResult> {
  const authResult = await getAuthorizedAdmin(input.accessToken, "save Counter Ranking V2 reviews");

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const validation = validateCounterRankingV2MechanicalReviewInput(input);

  if (!validation.ok) {
    return validation;
  }

  const registryResult = await loadChampionRegistry(serviceClientResult.supabase);

  if (!registryResult.ok) {
    return registryResult;
  }

  const resolvedChampionIds = resolveCounterRankingV2ReviewChampionIds({
    counterChampionId: validation.counterChampionId,
    enemyChampionId: validation.enemyChampionId,
    registry: registryResult.registry,
    resolveChampion: registryResult.normalizeChampionIdentifier,
  });

  if (!resolvedChampionIds.ok) {
    console.error("Counter Ranking V2 review save champion resolution failed", {
      counterChampionId: validation.counterChampionId,
      enemyChampionId: validation.enemyChampionId,
      table: "counter_ranking_v2_mechanical_reviews",
    });

    return resolvedChampionIds;
  }

  const mechanicalResult = calculateMechanicalMatchupFit({
    candidateChampionId: validation.counterChampionId,
    enemyChampionId: validation.enemyChampionId,
    role: validation.role,
  });

  if (mechanicalResult.status !== "calculated") {
    return {
      error: "Counter Ranking V2 could not calculate a mechanical score for this matchup.",
      ok: false,
    };
  }

  const now = new Date().toISOString();
  const { data, error } = await serviceClientResult.supabase
    .from("counter_ranking_v2_mechanical_reviews")
    .upsert(
      {
        adjustment_reason: validation.adjustmentReason,
        admin_review_note: nullableTrim(input.adminReviewNote),
        calculated_mechanical_score: mechanicalResult.score,
        counter_champion_id: resolvedChampionIds.counterChampionId,
        enemy_champion_id: resolvedChampionIds.enemyChampionId,
        high_mastery_required: validation.highMasteryRequired,
        manual_adjustment: validation.manualAdjustment,
        public_eligible: validation.publicEligible,
        review_status: validation.reviewStatus,
        reviewed_at: now,
        reviewed_by: authResult.userId,
        role: validation.role,
        updated_at: now,
      },
      {
        onConflict: "enemy_champion_id,counter_champion_id,role",
      },
    )
    .select(counterRankingV2MechanicalReviewSelect)
    .single<CounterRankingV2MechanicalReviewRow>();

  if (error || !data) {
    console.error("Counter Ranking V2 review save failed", {
      error: error ? getSafeDatabaseError(error) : null,
      hasData: Boolean(data),
      keys: {
        counterChampionId: resolvedChampionIds.counterChampionId,
        enemyChampionId: resolvedChampionIds.enemyChampionId,
        role: validation.role,
      },
      table: "counter_ranking_v2_mechanical_reviews",
      upsertConflictTarget: "enemy_champion_id,counter_champion_id,role",
    });

    return {
      error: "Counter Ranking V2 review could not be saved.",
      ok: false,
    };
  }

  return {
    ok: true,
    review: toCounterRankingV2MechanicalReview(data),
  };
}

export async function batchSaveCounterRankingV2MechanicalReviews(
  input: BatchSaveCounterRankingV2MechanicalReviewsInput,
): Promise<BatchSaveCounterRankingV2MechanicalReviewsResult> {
  const authResult = await getAuthorizedAdmin(
    input.accessToken,
    "batch save Counter Ranking V2 reviews",
  );

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const normalizedEnemyChampionId = normalizeChampionIdForReview(input.enemyChampionId);
  const normalizedCounterChampionIds = Array.from(
    new Set(input.counterChampionIds.map(normalizeChampionIdForReview).filter(Boolean)),
  );

  if (!normalizedEnemyChampionId || normalizedCounterChampionIds.length === 0) {
    return {
      error: "Select an enemy champion and at least one candidate before batch saving reviews.",
      ok: false,
    };
  }

  if (!leagueRoles.includes(input.role)) {
    return {
      error: "Select a valid role before batch saving reviews.",
      ok: false,
    };
  }

  if (!isCounterRankingV2BatchAction(input.action)) {
    return {
      error: "Select a valid batch review action.",
      ok: false,
    };
  }

  const registryResult = await loadChampionRegistry(serviceClientResult.supabase);

  if (!registryResult.ok) {
    return registryResult;
  }

  const now = new Date().toISOString();
  const rowsToUpsert: Array<Record<string, unknown>> = [];

  for (const counterChampionId of normalizedCounterChampionIds) {
    const resolvedChampionIds = resolveCounterRankingV2ReviewChampionIds({
      counterChampionId,
      enemyChampionId: normalizedEnemyChampionId,
      registry: registryResult.registry,
      resolveChampion: registryResult.normalizeChampionIdentifier,
    });

    if (!resolvedChampionIds.ok) {
      console.error("Counter Ranking V2 batch review champion resolution failed", {
        counterChampionId,
        enemyChampionId: normalizedEnemyChampionId,
        table: "counter_ranking_v2_mechanical_reviews",
      });

      return resolvedChampionIds;
    }

    const mechanicalResult = calculateMechanicalMatchupFit({
      candidateChampionId: resolvedChampionIds.counterChampionId,
      enemyChampionId: resolvedChampionIds.enemyChampionId,
      role: input.role,
    });

    if (mechanicalResult.status !== "calculated") {
      return {
        error: "Counter Ranking V2 could not calculate one or more selected matchups.",
        ok: false,
      };
    }

    const reviewStatus = getCounterRankingV2BatchReviewStatus({
      action: input.action,
      mechanicalScore: mechanicalResult.score,
    });

    rowsToUpsert.push({
      adjustment_reason: "auto_generated",
      admin_review_note: getCounterRankingV2BatchReviewNote(input.action),
      calculated_mechanical_score: mechanicalResult.score,
      counter_champion_id: resolvedChampionIds.counterChampionId,
      enemy_champion_id: resolvedChampionIds.enemyChampionId,
      generated_at: now,
      generated_by: "system",
      high_mastery_required: false,
      manual_adjustment: 0,
      public_eligible: normalizeCounterRankingV2PublicEligible({
        publicEligible: Boolean(input.publicEligible) && input.action === "approve",
        reviewStatus,
      }),
      review_status: reviewStatus,
      reviewed_at: now,
      reviewed_by: authResult.userId,
      role: input.role,
      updated_at: now,
    });
  }

  const { data, error } = await serviceClientResult.supabase
    .from("counter_ranking_v2_mechanical_reviews")
    .upsert(rowsToUpsert, {
      onConflict: "enemy_champion_id,counter_champion_id,role",
    })
    .select(counterRankingV2MechanicalReviewSelect)
    .returns<CounterRankingV2MechanicalReviewRow[]>();

  if (error || !data) {
    console.error("Counter Ranking V2 batch review save failed", {
      action: input.action,
      error: error ? getSafeDatabaseError(error) : null,
      hasData: Boolean(data),
      selectedCount: normalizedCounterChampionIds.length,
      table: "counter_ranking_v2_mechanical_reviews",
      upsertConflictTarget: "enemy_champion_id,counter_champion_id,role",
    });

    return {
      error: "Counter Ranking V2 batch reviews could not be saved.",
      ok: false,
    };
  }

  return {
    ok: true,
    reviews: data.map(toCounterRankingV2MechanicalReview),
  };
}

export async function startRiotCollectionJob(
  input: StartRiotCollectionJobInput,
): Promise<RiotCollectionJobResult> {
  const authResult = await getAuthorizedAdmin(input.accessToken, "start Riot collection jobs");

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const validation = await validateCollectionInput(input, serviceClientResult.supabase);

  if (!validation.ok) {
    return validation;
  }

  const activeCollection = await fetchActiveCollectionJobForPlatform({
    platform: validation.platform,
    supabase: serviceClientResult.supabase,
  });

  if (activeCollection) {
    return {
      error: `A Riot collection job is already active for ${validation.platform} (#${activeCollection.id}, ${riotCollectionStatusLabels[activeCollection.status]}). Pause, cancel, or finish it before starting another collection.`,
      ok: false,
    };
  }

  const now = new Date().toISOString();
  const { data, error } = await serviceClientResult.supabase
    .from("riot_collection_jobs")
    .insert({
      automatic_seed_discovery: validation.automaticSeedDiscovery,
      created_by: authResult.userId,
      current_patch_only: validation.currentPatchOnly,
      focus_champion_id: validation.focusChampionId,
      platform: validation.platform,
      progress: {
        lastMessage: "Collection job created.",
        safetyLimits: defaultRiotCollectionSafetyLimits,
      },
      queue_type: "RANKED_SOLO_5x5",
      rank_bracket: validation.rankBracket,
      regional_route: validation.regionalRoute,
      role: validation.role,
      started_at: now,
      status: "queued",
      target_unique_matches: validation.targetUniqueMatches,
    })
    .select("*")
    .single<RiotCollectionJobRow>();

  if (error || !data) {
    if (error) {
      console.error("Riot collection job creation failed", getSafeDatabaseError(error));
    }

    return {
      error: isRiotCollectionTargetConstraintError(error)
        ? getRiotCollectionTargetValidationError()
        : "Collection job could not be created.",
      ok: false,
    };
  }

  return advanceRiotCollectionJob({
    accessToken: input.accessToken,
    job: sanitizeCollectionJobRow(data),
    supabase: serviceClientResult.supabase,
  });
}

export async function resumeRiotCollectionJob({
  accessToken,
  collectionJobId,
}: {
  accessToken: string;
  collectionJobId: number;
}): Promise<RiotCollectionJobResult> {
  const authResult = await getAuthorizedAdmin(accessToken, "resume Riot collection jobs");

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const jobResult = await fetchCollectionJob(serviceClientResult.supabase, collectionJobId);

  if (!jobResult.ok) {
    return jobResult;
  }

  if (jobResult.job.status === "paused") {
    const resumedJobResult = await updateCollectionJob({
      id: jobResult.job.id,
      patch: {
        completed_at: null,
        progress: getCollectionProgressPatch(jobResult.job, {
          activeScanJobId: null,
          lastMessage: "Resumed by administrator.",
        }),
        status: "queued",
        stop_detail: null,
        stop_reason: null,
      },
      supabase: serviceClientResult.supabase,
    });

    if (!resumedJobResult.ok) {
      return resumedJobResult;
    }

    return advanceRiotCollectionJob({
      accessToken,
      job: resumedJobResult.job,
      supabase: serviceClientResult.supabase,
    });
  }

  return advanceRiotCollectionJob({
    accessToken,
    job: jobResult.job,
    supabase: serviceClientResult.supabase,
  });
}

export async function pauseRiotCollectionJob({
  accessToken,
  collectionJobId,
}: {
  accessToken: string;
  collectionJobId: number;
}): Promise<RiotCollectionJobResult> {
  return updateCollectionJobControlState({
    accessToken,
    collectionJobId,
    stopReason: "manual-pause",
    status: "paused",
    timestampColumn: null,
  });
}

export async function cancelRiotCollectionJob({
  accessToken,
  collectionJobId,
}: {
  accessToken: string;
  collectionJobId: number;
}): Promise<RiotCollectionJobResult> {
  return updateCollectionJobControlState({
    accessToken,
    collectionJobId,
    stopReason: "cancelled-by-admin",
    status: "cancelled",
    timestampColumn: "cancelled_at",
  });
}

export async function getRecentRiotCollectionJobs({
  accessToken,
  limit = 5,
}: {
  accessToken: string;
  limit?: number;
}): Promise<RiotCollectionJobsResult> {
  const authResult = await getAuthorizedAdmin(accessToken, "view Riot collection jobs");

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const { data, error } = await serviceClientResult.supabase
    .from("riot_collection_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 10))
    .returns<RiotCollectionJobRow[]>();

  if (error) {
    return {
      error: "Collection jobs could not be loaded.",
      ok: false,
    };
  }

  const jobs = await hydrateCollectionJobs(serviceClientResult.supabase, data ?? []);

  return {
    jobs,
    ok: true,
  };
}

export async function getRiotCollectionJob({
  accessToken,
  collectionJobId,
}: {
  accessToken: string;
  collectionJobId: number;
}): Promise<RiotCollectionJobResult> {
  const authResult = await getAuthorizedAdmin(accessToken, "view Riot collection jobs");

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const jobResult = await fetchCollectionJob(serviceClientResult.supabase, collectionJobId);

  if (!jobResult.ok) {
    return jobResult;
  }

  const consistencyIssue = await getRiotCollectionConsistencyIssue({
    job: jobResult.job,
    supabase: serviceClientResult.supabase,
  });

  if (!consistencyIssue && jobResult.job.status === "scanning") {
    return advanceRiotCollectionJob({
      accessToken,
      job: jobResult.job,
      supabase: serviceClientResult.supabase,
    });
  }

  if (!consistencyIssue) {
    return jobResult;
  }

  console.warn("Recovering stalled Riot collection", {
    collectionJobId,
    reasonCode: consistencyIssue.reasonCode,
    scanJobId: consistencyIssue.scanJobId,
  });

  return advanceRiotCollectionJob({
    accessToken,
    job: jobResult.job,
    supabase: serviceClientResult.supabase,
  });
}

export async function getRiotCollectionInventory({
  accessToken,
  focusChampionId = null,
  rankBracket,
  role,
}: {
  accessToken: string;
  focusChampionId?: string | null;
  rankBracket: RiotCollectionRankBracket;
  role: RiotCollectionRole;
}): Promise<RiotCollectionInventoryResult> {
  const authResult = await getAuthorizedAdmin(accessToken, "preview Riot collection inventory");

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const candidates = await fetchReadyCollectionCandidates({
    focusChampionId,
    limit: 200,
    rankBracket,
    role,
    supabase: serviceClientResult.supabase,
    usedCandidateIds: new Set(),
  });

  if (!candidates.ok) {
    return {
      error: candidates.error,
      ok: false,
    };
  }

  const estimatedLow = Math.max(Math.ceil((50 - candidates.candidates.length * 10) / 10), 0);
  const estimatedHigh = Math.max(Math.ceil((200 - candidates.candidates.length * 10) / 10), 0);

  return {
    inventory: {
      estimatedAdditionalSeedsNeeded:
        estimatedHigh <= 0
          ? "0"
          : `${estimatedLow.toLocaleString()}-${estimatedHigh.toLocaleString()}`,
      readySeeds: candidates.candidates.length,
    },
    ok: true,
  };
}

export async function getPaginatedRiotSeedCandidates({
  accessToken,
  filters = {},
  groups,
}: RiotSeedCandidateGroupedQueryInput): Promise<RiotSeedCandidateGroupedResult> {
  const authResult = await getAuthorizedAdmin(accessToken, "view Riot seed candidates");

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const supabase = serviceClientResult.supabase;
  const counts = {} as Record<RiotSeedCandidateRankGroupId, number>;
  const lifecycleCounts = {} as Record<SeedCandidateLifecycleState, number>;
  const groupedResults: Partial<Record<RiotSeedCandidateRankGroupId, PaginatedSeedCandidates>> = {};

  for (const lifecycleState of seedCandidateLifecycleStates) {
    const { count, error } = await buildRiotSeedCandidateQuery({
      filters: {
        ...filters,
        lifecycleState,
      },
      selectOptions: { count: "exact", head: true },
      supabase,
    });

    if (error) {
      return {
        error: "Seed candidate lifecycle counts could not be loaded.",
        ok: false,
      };
    }

    lifecycleCounts[lifecycleState] = count ?? 0;
  }

  for (const rankGroup of riotSeedCandidateRankGroupIds) {
    const { count, error } = await buildRiotSeedCandidateQuery({
      filters,
      rankGroup,
      selectOptions: { count: "exact", head: true },
      supabase,
    });

    if (error) {
      return {
        error: "Seed candidate counts could not be loaded.",
        ok: false,
      };
    }

    counts[rankGroup] = count ?? 0;
  }

  for (const groupRequest of groups) {
    const pageSize = normalizeRiotSeedCandidatePageSize(groupRequest.pageSize);
    const totalCount = counts[groupRequest.rankGroup] ?? 0;
    const totalPages = getRiotSeedCandidateTotalPages(totalCount, pageSize);
    const page = Math.min(normalizeRiotSeedCandidatePage(groupRequest.page), totalPages);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const orderColumn = getCandidateSortColumn(groupRequest.sort);
    const pageResult =
      groupRequest.sort === "rank_tier"
        ? await fetchRankTierSortedSeedCandidatePage({
            filters,
            page,
            pageSize,
            rankGroup: groupRequest.rankGroup,
            sortDirection: groupRequest.sortDirection,
            supabase,
          })
        : await buildRiotSeedCandidateQuery({
            filters,
            rankGroup: groupRequest.rankGroup,
            supabase,
          })
            .order(orderColumn, {
              ascending: groupRequest.sortDirection === "asc",
              nullsFirst: false,
            })
            .range(from, to)
            .returns<RiotSeedCandidateView[]>();

    if (pageResult.error) {
      return {
        error: `Could not load ${getRiotSeedCandidateGroupLabel(groupRequest.rankGroup)} candidates.`,
        ok: false,
      };
    }

    groupedResults[groupRequest.rankGroup] = {
      candidates: sortRiotSeedCandidateRows(pageResult.data ?? [], {
        sort: groupRequest.sort,
        sortDirection: groupRequest.sortDirection,
      }).map(hydrateSeedCandidateLifecycle),
      page,
      pageSize,
      totalCount,
      totalPages,
    };
  }

  return {
    counts,
    groups: groupedResults,
    lifecycleCounts,
    ok: true,
  };
}

export async function refreshRiotSeedCandidateRanks(
  input: RiotSeedCandidateRankRefreshInput,
): Promise<RiotSeedCandidateRankRefreshResult> {
  const authResult = await getAuthorizedAdmin(
    input.accessToken,
    "refresh Riot seed candidate ranks",
  );

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const candidateIds = uniqueValues(input.candidateIds ?? []);

  if (candidateIds.length === 0) {
    return {
      error: "Select at least one seed candidate.",
      ok: false,
    };
  }

  if (candidateIds.length > maxSeedCandidateRankRefreshBatch) {
    return {
      error: `Refresh rank for up to ${maxSeedCandidateRankRefreshBatch} seed candidates at a time.`,
      ok: false,
    };
  }

  if (!process.env.RIOT_API_KEY) {
    return {
      error: "Missing Riot API configuration.",
      ok: false,
    };
  }

  try {
    const { RiotApiClient } = await import("@/scripts/lib/riot-api-client.mjs");
    const { createSupabaseRankRepository, enrichRiotSeedCandidateRanks } =
      await import("@/scripts/lib/riot-seed-rank-enrichment.mjs");
    const riot = new RiotApiClient({
      apiKey: process.env.RIOT_API_KEY,
      regionalRoute: process.env.RIOT_REGIONAL_ROUTING ?? defaultRegionalRoute,
      requestDelayMs: Number(process.env.RIOT_REQUEST_DELAY_MS ?? 1200),
    });
    const result = await enrichRiotSeedCandidateRanks({
      candidateIds,
      force: input.force ?? false,
      limit: candidateIds.length,
      repository: createSupabaseRankRepository(serviceClientResult.supabase),
      riot,
    });

    return {
      failedCount: result.failedCount,
      notFoundCount: result.notFoundCount,
      ok: true,
      rankedCount: result.rankedCount,
      rateLimitedCount: result.rateLimitedCount,
      skippedCount: result.skippedCount,
      snapshotInsertedCount: result.snapshotInsertedCount,
      total: result.total,
      unrankedCount: result.unrankedCount,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? getRiotRankRefreshErrorMessage(error) : "Rank refresh failed.",
      ok: false,
    };
  }
}

export async function rejectRiotSeedCandidates({
  accessToken,
  candidateIds,
  reason = null,
}: {
  accessToken: string;
  candidateIds: string[];
  reason?: string | null;
}): Promise<RiotSeedCandidateLifecycleMutationResult> {
  const authResult = await getAuthorizedAdmin(accessToken, "reject Riot seed candidates");

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const uniqueCandidateIds = uniqueValues(candidateIds);

  if (uniqueCandidateIds.length === 0) {
    return {
      error: "Select at least one seed candidate.",
      ok: false,
    };
  }

  const rejectedAt = new Date().toISOString();
  const { error } = await serviceClientResult.supabase
    .from("riot_seed_candidates")
    .update({
      manually_rejected_at: rejectedAt,
      manually_rejected_by: authResult.userId,
      rejection_reason: normalizeNullableText(reason),
    })
    .in("id", uniqueCandidateIds);

  if (error) {
    return {
      error: "Seed candidates could not be rejected.",
      ok: false,
    };
  }

  console.info("Riot seed candidate lifecycle updated", {
    rejected: uniqueCandidateIds.length,
    totalCandidates: uniqueCandidateIds.length,
  });

  return {
    ok: true,
    updatedCount: uniqueCandidateIds.length,
  };
}

export async function restoreRiotSeedCandidates({
  accessToken,
  candidateIds,
}: {
  accessToken: string;
  candidateIds: string[];
}): Promise<RiotSeedCandidateLifecycleMutationResult> {
  const authResult = await getAuthorizedAdmin(accessToken, "restore Riot seed candidates");

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const uniqueCandidateIds = uniqueValues(candidateIds);

  if (uniqueCandidateIds.length === 0) {
    return {
      error: "Select at least one seed candidate.",
      ok: false,
    };
  }

  const { error } = await serviceClientResult.supabase
    .from("riot_seed_candidates")
    .update({
      manually_rejected_at: null,
      manually_rejected_by: null,
      rejection_reason: null,
    })
    .in("id", uniqueCandidateIds);

  if (error) {
    return {
      error: "Seed candidates could not be restored.",
      ok: false,
    };
  }

  console.info("Riot seed candidate lifecycle updated", {
    restored: uniqueCandidateIds.length,
    totalCandidates: uniqueCandidateIds.length,
  });

  return {
    ok: true,
    updatedCount: uniqueCandidateIds.length,
  };
}

export async function resetRiotSeedCandidateFailures({
  accessToken,
  candidateIds,
}: {
  accessToken: string;
  candidateIds: string[];
}): Promise<RiotSeedCandidateLifecycleMutationResult> {
  const authResult = await getAuthorizedAdmin(accessToken, "reset Riot seed candidate failures");

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const uniqueCandidateIds = uniqueValues(candidateIds);

  if (uniqueCandidateIds.length === 0) {
    return {
      error: "Select at least one seed candidate.",
      ok: false,
    };
  }

  const { error } = await serviceClientResult.supabase
    .from("riot_seed_candidates")
    .update({
      consecutive_scan_failures: 0,
      last_scan_error_at: null,
      last_scan_error_code: null,
      next_retry_at: null,
      status: "candidate",
    })
    .in("id", uniqueCandidateIds);

  if (error) {
    return {
      error: "Seed candidate failure state could not be reset.",
      ok: false,
    };
  }

  console.info("Riot seed candidate lifecycle updated", {
    resetFailures: uniqueCandidateIds.length,
    totalCandidates: uniqueCandidateIds.length,
  });

  return {
    ok: true,
    updatedCount: uniqueCandidateIds.length,
  };
}

export async function getMatchupRankCoverageQueue({
  accessToken,
  filters = {},
  limit = 20,
  sort = "priority_score",
  sortDirection = "desc",
}: {
  accessToken: string;
  filters?: MatchupRankCoverageFilters;
  limit?: number;
  sort?: MatchupRankCoverageSort;
  sortDirection?: "asc" | "desc";
}): Promise<MatchupRankCoverageQueueResult> {
  const authResult = await getAuthorizedAdmin(accessToken, "view matchup rank coverage queue");

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  try {
    const {
      createSupabaseMatchupRankCoverageRepository,
      loadMatchupRankCoverageQueue,
      maxMatchupRankCoverageLimit,
    } = await import("@/scripts/lib/matchup-rank-coverage-queue.mjs");
    const result = await loadMatchupRankCoverageQueue({
      filters,
      limit: Math.min(Math.max(Math.trunc(limit), 1), maxMatchupRankCoverageLimit),
      repository: createSupabaseMatchupRankCoverageRepository(serviceClientResult.supabase),
      sort,
      sortDirection,
    });

    return {
      candidates: result.candidates as MatchupRankCoverageCandidate[],
      ok: true,
      projectedImpact: result.projectedImpact,
      summary: result.summary,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Matchup rank coverage queue could not be loaded.",
      ok: false,
    };
  }
}

export async function refreshMatchupRankCoverageParticipants({
  accessToken,
  force = false,
  participants,
}: {
  accessToken: string;
  force?: boolean;
  participants: MatchupRankCoverageParticipantInput[];
}): Promise<RefreshMatchupRankCoverageParticipantsResult> {
  const authResult = await getAuthorizedAdmin(accessToken, "refresh matchup rank coverage ranks");

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const uniqueParticipants = dedupeCoverageParticipantInputs(participants);

  if (uniqueParticipants.length === 0) {
    return {
      error: "Select at least one matchup participant.",
      ok: false,
    };
  }

  if (uniqueParticipants.length > maxSeedCandidateRankRefreshBatch) {
    return {
      error: `Refresh rank for up to ${maxSeedCandidateRankRefreshBatch} participants at a time.`,
      ok: false,
    };
  }

  if (!process.env.RIOT_API_KEY) {
    return {
      error: "Missing Riot API configuration.",
      ok: false,
    };
  }

  try {
    const { RiotApiClient } = await import("@/scripts/lib/riot-api-client.mjs");
    const { createSupabaseRankRepository, enrichRiotSeedCandidateRanks } =
      await import("@/scripts/lib/riot-seed-rank-enrichment.mjs");
    const { createSupabaseMatchupRankCoverageRepository, ensureMatchupRankCoverageCandidates } =
      await import("@/scripts/lib/matchup-rank-coverage-queue.mjs");
    const coverageRepository = createSupabaseMatchupRankCoverageRepository(
      serviceClientResult.supabase,
    );
    const candidateResult = await ensureMatchupRankCoverageCandidates({
      participants: uniqueParticipants,
      repository: coverageRepository,
    });
    const candidateIds = candidateResult.candidateIds;

    if (candidateIds.length === 0) {
      return {
        error: "No seed candidates could be linked for selected participants.",
        ok: false,
      };
    }

    const riot = new RiotApiClient({
      apiKey: process.env.RIOT_API_KEY,
      regionalRoute: process.env.RIOT_REGIONAL_ROUTING ?? defaultRegionalRoute,
      requestDelayMs: Number(process.env.RIOT_REQUEST_DELAY_MS ?? 1200),
    });
    const result = await enrichRiotSeedCandidateRanks({
      candidateIds,
      force,
      limit: candidateIds.length,
      repository: createSupabaseRankRepository(serviceClientResult.supabase),
      riot,
    });

    return {
      candidatesRequested: candidateResult.requestedCount,
      createdCandidateCount: candidateResult.createdCount,
      failedCount: result.failedCount,
      notFoundCount: result.notFoundCount,
      ok: true,
      rankedCount: result.rankedCount,
      rateLimitedCount: result.rateLimitedCount,
      skippedCount: result.skippedCount,
      snapshotInsertedCount: result.snapshotInsertedCount,
      total: result.total,
      unrankedCount: result.unrankedCount,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? getRiotRankRefreshErrorMessage(error) : "Rank refresh failed.",
      ok: false,
    };
  }
}

export async function rerunMatchupRankCoverageAttribution({
  accessToken,
  filters = {},
  limit = 500,
}: {
  accessToken: string;
  filters?: MatchupRankCoverageFilters;
  limit?: number;
}): Promise<MatchupRankCoverageAttributionResult> {
  const authResult = await getAuthorizedAdmin(accessToken, "re-run matchup rank attribution");

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  try {
    const { attributeStoredMatchupRankBrackets, createSupabaseMatchupRankAttributionRepository } =
      await import("@/scripts/lib/riot-matchup-rank-attribution.mjs");
    const result = await attributeStoredMatchupRankBrackets({
      filters: {
        champion: filters.champion ?? null,
        patch: filters.patch ?? null,
        role: filters.role && filters.role !== "all" ? filters.role : null,
      },
      force: true,
      limit: Math.min(Math.max(Math.trunc(limit), 1), 5000),
      repository: createSupabaseMatchupRankAttributionRepository(serviceClientResult.supabase),
    });

    return {
      ok: true,
      summary: result.summary,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Matchup rank attribution could not be re-run.",
      ok: false,
    };
  }
}

export async function getRecentRiotScanJobs({
  accessToken,
  limit = 10,
}: {
  accessToken: string;
  limit?: number;
}): Promise<RiotScanJobsResult> {
  const authResult = await getAuthorizedAdmin(accessToken, "view Riot scan jobs");

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const { data, error } = await serviceClientResult.supabase
    .from("riot_scan_jobs")
    .select(riotScanJobSelect)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 20))
    .returns<RiotScanJobRow[]>();

  if (error) {
    return {
      error: "Database read failed while loading recent scan jobs.",
      ok: false,
    };
  }

  return {
    jobs: (data ?? []).map(sanitizeJobRow),
    ok: true,
  };
}

export async function getRiotScanJob({
  accessToken,
  jobId,
}: {
  accessToken: string;
  jobId: number;
}): Promise<RiotScanJobResult> {
  const authResult = await getAuthorizedAdmin(accessToken, "view Riot scan jobs");

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const { data, error } = await serviceClientResult.supabase
    .from("riot_scan_jobs")
    .select(riotScanJobSelect)
    .eq("id", jobId)
    .single<RiotScanJobRow>();

  if (error || !data) {
    return {
      error: "Scan job could not be loaded.",
      ok: false,
    };
  }

  return {
    job: sanitizeJobRow(data),
    ok: true,
  };
}

async function runRiotScanJob({
  collectionJobId,
  input,
  jobId,
  supabase,
}: {
  collectionJobId: number | null;
  input: ValidatedStartInput;
  jobId: number;
  supabase: SupabaseClient;
}) {
  const { RiotApiClient, isRiotApiAuthenticationError } =
    await import("@/scripts/lib/riot-api-client.mjs");
  const { loadActiveChampionRegistry } =
    await import("@/scripts/lib/league-champion-normalizer.mjs");
  const {
    createObservationValidationContext,
    exceedsValidationFailureRate,
    validateRoutingConfiguration,
  } = await import("@/scripts/lib/riot-observation-validation.mjs");
  const { fetchCurrentPatch, rankedSoloDuoQueueId, scanRiotCounterPickMatchups } =
    await import("@/scripts/lib/riot-counter-pick-scanner.mjs");
  const { persistObservationsAndRebuildStats } =
    await import("@/scripts/lib/riot-counter-pick-aggregation.mjs");
  const { persistSeedCandidatesFromObservations } =
    await import("@/scripts/lib/riot-seed-candidates.mjs");
  const startedAt = new Date().toISOString();
  const invocationId = createRiotScanInvocationId(jobId);
  const leaseExpiresAt = new Date(Date.now() + riotScanLeaseDurationMs).toISOString();
  const matchBatchSize = collectionJobId ? defaultRiotScanMatchBatchSize : null;
  const progressBase = {
    currentPatchOnly: input.currentPatchOnly,
    discoveryFocusChampion: input.discoveryFocusChampion,
    maxDisplayedResults: input.maxDisplayedResults,
    seedCount: input.seedPuuids.length,
    workerBatchSize: matchBatchSize ?? input.matchCount,
    workerHeartbeatAt: startedAt,
    workerInvocationId: invocationId,
    workerLeaseExpiresAt: leaseExpiresAt,
    workerState: "running" as const,
  };
  const { data: existingJob } = await supabase
    .from("riot_scan_jobs")
    .select("progress, summary")
    .eq("id", jobId)
    .maybeSingle<{ progress: RiotScanSummary | null; summary: RiotScanSummary | null }>();
  const existingProgress = existingJob?.progress ?? {};
  const existingSummary = existingJob?.summary ?? {};

  try {
    await supabase
      .from("riot_scan_jobs")
      .update({
        started_at: startedAt,
        progress: {
          ...existingProgress,
          ...progressBase,
          currentStage: existingProgress.currentStage ?? "initializing",
          lastProgressAt: startedAt,
        },
        status: "running",
      })
      .eq("id", jobId);
    await markSeedCandidatesScanRunning({
      seedPuuids: input.seedPuuids,
      supabase,
    });

    const patch = input.currentPatchOnly ? await fetchCurrentPatch() : null;
    const riot = new RiotApiClient({
      apiKey: process.env.RIOT_API_KEY ?? "",
      rateLimitContext: {
        collectionJobId,
        onWait: async (rateLimitState: RiotRateLimitWaitState) => {
          await updateRiotScanRateLimitProgress({
            collectionJobId,
            jobId,
            progressBase,
            rateLimitState,
            supabase,
          });
        },
        scanJobId: jobId,
        shouldContinue: async () =>
          assertScanControlAllowsProgress({
            collectionJobId,
            jobId,
            supabase,
          }),
      },
      regionalRoute: process.env.RIOT_REGIONAL_ROUTING ?? defaultRegionalRoute,
      requestDelayMs: Number(process.env.RIOT_REQUEST_DELAY_MS ?? 1200),
    });
    const championRegistry = await loadActiveChampionRegistry({
      supabase,
    });
    const validationContext = createObservationValidationContext({
      championRegistry,
    });
    const platformRegion = process.env.RIOT_PLATFORM_REGION ?? defaultPlatformRegion;
    const regionalRouting = process.env.RIOT_REGIONAL_ROUTING ?? defaultRegionalRoute;
    const routingValidation = validateRoutingConfiguration({
      context: validationContext,
      platformRegion,
      regionalRouting,
    });

    if (!routingValidation.ok) {
      throw new Error(
        `Invalid Riot routing configuration: ${routingValidation.issues
          .map((issue) => issue.code)
          .join(", ")}`,
      );
    }
    const updateProgress = async (progress: RiotScanSummary) => {
      const nextProgress: RiotScanSummary = {
        ...progressBase,
        ...progress,
        lastProgressAt: new Date().toISOString(),
        workerHeartbeatAt: new Date().toISOString(),
        workerInvocationId: invocationId,
        workerLeaseExpiresAt: new Date(Date.now() + riotScanLeaseDurationMs).toISOString(),
        workerState: "running",
      };

      await supabase
        .from("riot_scan_jobs")
        .update({
          progress: nextProgress,
        })
        .eq("id", jobId);

      if (collectionJobId) {
        await mirrorScanProgressToCollectionJob({
          collectionJobId,
          progress: nextProgress,
          scanJobId: jobId,
          supabase,
        });
      }
    };
    const scanResult = await scanRiotCounterPickMatchups({
      championRegistry,
      discover: input.mode === "discovery",
      focusChampionId: input.discoveryFocusChampion,
      matchIds: existingProgress.storedMatchIds ?? existingSummary.storedMatchIds ?? null,
      matchCount: input.matchCount,
      maxMatchesToScan: matchBatchSize,
      onProgress: updateProgress,
      patch,
      platformRegion,
      processedMatchIds:
        existingProgress.completedMatchIds ?? existingSummary.completedMatchIds ?? [],
      queue: rankedSoloDuoQueueId,
      regionalRouting,
      riot,
      role: input.role,
      seedPuuids: input.seedPuuids,
      shouldContinue: async () =>
        assertScanControlAllowsProgress({
          collectionJobId,
          jobId,
          supabase,
        }),
      target:
        input.mode === "target"
          ? {
              counterChampionId: input.counterChampion,
              enemyChampionId: input.enemyChampion,
            }
          : null,
    });
    const summary = {
      ...progressBase,
      ...scanResult.summary,
    };
    await updateProgress({
      ...summary,
      currentStage: "persisting",
    });
    const persistenceResult = await persistObservationsAndRebuildStats({
      championRegistry,
      observations: scanResult.observations,
      scanJobId: jobId,
      supabase,
      validationContext,
    });
    const candidatePersistenceResult = await persistSeedCandidatesFromObservations({
      championRegistry,
      observations: scanResult.candidateObservations,
      scanJobId: jobId,
      source: "match_discovery",
      supabase,
      validationContext,
    });
    const focusObservationKeys = new Set(scanResult.focusObservationKeys ?? []);
    const focusChampionObservationsNew = countKeyIntersections(
      focusObservationKeys,
      persistenceResult.insertedObservationKeys ?? [],
    );
    const focusChampionObservationsDuplicate = countKeyIntersections(
      focusObservationKeys,
      persistenceResult.duplicateObservationKeys ?? [],
    );
    const persistedSummary: RiotScanSummary = {
      ...summary,
      candidateIdLookupChunkFailures: candidatePersistenceResult.candidateIdLookupChunkFailures,
      candidateIdLookupChunks: candidatePersistenceResult.candidateIdLookupChunks,
      candidateIdResolutionFailures: candidatePersistenceResult.candidateIdResolutionFailures,
      candidateIdsResolved: candidatePersistenceResult.candidateIdsResolved,
      candidateObservationDuplicatesSkipped:
        candidatePersistenceResult.candidateObservationDuplicatesSkipped,
      candidateObservationInsertFailures:
        candidatePersistenceResult.candidateObservationInsertFailures,
      candidateObservationBatchAttempts:
        candidatePersistenceResult.candidateObservationBatchAttempts,
      candidateObservationSuccessfulBatches:
        candidatePersistenceResult.candidateObservationSuccessfulBatches,
      candidateObservationFailedBatchAttempts:
        candidatePersistenceResult.candidateObservationFailedBatchAttempts,
      candidateObservationBatchSplits: candidatePersistenceResult.candidateObservationBatchSplits,
      candidateObservationTransientRetries:
        candidatePersistenceResult.candidateObservationTransientRetries,
      candidateObservationIsolatedFailures:
        candidatePersistenceResult.candidateObservationIsolatedFailures,
      candidateObservationUnresolvedBatchFailures:
        candidatePersistenceResult.candidateObservationUnresolvedBatchFailures,
      candidateObservationPersistenceFailureSamples:
        candidatePersistenceResult.candidateObservationPersistenceFailureSamples,
      candidateObservationPersistenceErrorGroups:
        candidatePersistenceResult.candidateObservationPersistenceErrorGroups,
      candidateObservationResolutionFailures:
        candidatePersistenceResult.candidateObservationResolutionFailures,
      candidateObservationsFound: candidatePersistenceResult.candidateObservationsFound,
      candidateObservationsInserted: candidatePersistenceResult.candidateObservationsInserted,
      candidateObservationValidationFailures:
        candidatePersistenceResult.candidateObservationValidationFailures,
      candidateObservationValidationSummary:
        candidatePersistenceResult.candidateObservationValidationSummary,
      candidateObservationsRejected: candidatePersistenceResult.candidateObservationsRejected,
      candidateObservationsValidated: candidatePersistenceResult.candidateObservationsValidated,
      candidateProfileFailures: candidatePersistenceResult.candidateProfileFailures,
      candidateProfilesRebuilt: candidatePersistenceResult.candidateProfilesRebuilt,
      candidateUniqueIdResolutionFailures:
        candidatePersistenceResult.candidateUniqueIdResolutionFailures,
      existingCandidatesUpdated: candidatePersistenceResult.existingCandidatesUpdated,
      newCandidatesCreated: candidatePersistenceResult.newCandidatesCreated,
      observationDuplicatesSkipped: persistenceResult.duplicateObservationsSkipped,
      focus_champion_observations_duplicate: focusChampionObservationsDuplicate,
      focus_champion_observations_new: focusChampionObservationsNew,
      observationInsertFailures: persistenceResult.insertFailures,
      matchupObservationBatchAttempts: persistenceResult.matchupObservationBatchAttempts,
      matchupObservationSuccessfulBatches: persistenceResult.matchupObservationSuccessfulBatches,
      matchupObservationFailedBatchAttempts:
        persistenceResult.matchupObservationFailedBatchAttempts,
      matchupObservationBatchSplits: persistenceResult.matchupObservationBatchSplits,
      matchupObservationTransientRetries: persistenceResult.matchupObservationTransientRetries,
      matchupObservationIsolatedFailures: persistenceResult.matchupObservationIsolatedFailures,
      matchupObservationUnresolvedBatchFailures:
        persistenceResult.matchupObservationUnresolvedBatchFailures,
      matchupObservationPersistenceFailureSamples:
        persistenceResult.matchupObservationPersistenceFailureSamples,
      matchupObservationPersistenceErrorGroups:
        persistenceResult.matchupObservationPersistenceErrorGroups,
      observationsFound: persistenceResult.observationsFound,
      observationsInserted: persistenceResult.insertedObservations,
      matchupObservationValidationFailures: persistenceResult.matchupObservationValidationFailures,
      matchupObservationValidationSummary: persistenceResult.matchupObservationValidationSummary,
      matchupObservationsRejected: persistenceResult.matchupObservationsRejected,
      matchupObservationsValidated: persistenceResult.matchupObservationsValidated,
      matchupRankAttributionFailures: persistenceResult.matchupRankAttributionFailures,
      matchupRankAttributionsAttempted: persistenceResult.matchupRankAttributionsAttempted,
      matchupRankAttributionsSinglePlayer: persistenceResult.matchupRankAttributionsSinglePlayer,
      matchupRankAttributionsTwoPlayer: persistenceResult.matchupRankAttributionsTwoPlayer,
      matchupRankAttributionsUnknown: persistenceResult.matchupRankAttributionsUnknown,
      matchupRankParticipantsNotFound: persistenceResult.matchupRankParticipantsNotFound,
      matchupRankSnapshotTooOld: persistenceResult.matchupRankSnapshotTooOld,
      observationsAggregated: persistenceResult.observationsAggregated,
      counterPickAggregateValidationFailures:
        persistenceResult.counterPickAggregateValidationFailures,
      counterPickAggregateValidationSummary:
        persistenceResult.counterPickAggregateValidationSummary,
      counterPickAggregatesValidated: persistenceResult.counterPickAggregatesValidated,
      counterPickAggregateInsertFailures: persistenceResult.counterPickAggregateInsertFailures,
      counterPickAggregateBatchAttempts: persistenceResult.counterPickAggregateBatchAttempts,
      counterPickAggregateSuccessfulBatches:
        persistenceResult.counterPickAggregateSuccessfulBatches,
      counterPickAggregateFailedBatchAttempts:
        persistenceResult.counterPickAggregateFailedBatchAttempts,
      counterPickAggregateBatchSplits: persistenceResult.counterPickAggregateBatchSplits,
      counterPickAggregateTransientRetries: persistenceResult.counterPickAggregateTransientRetries,
      counterPickAggregateIsolatedFailures: persistenceResult.counterPickAggregateIsolatedFailures,
      counterPickAggregateUnresolvedBatchFailures:
        persistenceResult.counterPickAggregateUnresolvedBatchFailures,
      counterPickAggregatePersistenceFailureSamples:
        persistenceResult.counterPickAggregatePersistenceFailureSamples,
      counterPickAggregatePersistenceErrorGroups:
        persistenceResult.counterPickAggregatePersistenceErrorGroups,
      participantPuuidsObserved: candidatePersistenceResult.participantPuuidsObserved,
      seedCandidatesCreatedOrUpdated: candidatePersistenceResult.seedCandidatesCreatedOrUpdated,
      statsRowsUpdated: persistenceResult.statsRowsUpdated,
      uniqueCandidatesEncountered: candidatePersistenceResult.uniqueCandidatesEncountered,
      workerHeartbeatAt: new Date().toISOString(),
      workerInvocationId: invocationId,
      workerLeaseExpiresAt: new Date(Date.now() + riotScanLeaseDurationMs).toISOString(),
      workerState: scanResult.summary.isComplete ? ("idle" as const) : ("idle" as const),
    };

    if (!scanResult.summary.isComplete) {
      await supabase
        .from("riot_scan_jobs")
        .update({
          progress: {
            ...persistedSummary,
            aggregationSkippedReason: "child-scan-incomplete",
            currentStage: "chunk-complete",
            workerState: "idle",
          },
          status: "queued",
          summary: {
            ...persistedSummary,
            aggregationSkippedReason: "child-scan-incomplete",
            currentStage: "chunk-complete",
            workerState: "idle",
          },
        })
        .eq("id", jobId);

      if (collectionJobId) {
        await mirrorScanProgressToCollectionJob({
          collectionJobId,
          progress: {
            ...persistedSummary,
            aggregationSkippedReason: "child-scan-incomplete",
            currentStage: "chunk-complete",
            workerState: "idle",
          },
          scanJobId: jobId,
          supabase,
        });
      }

      console.info("Riot counter pick scan chunk completed", {
        childJobId: jobId,
        collectionJobId,
        completedMatches: persistedSummary.completedMatchIds?.length ?? 0,
        invocationId,
        matchesTotal: persistedSummary.matchesTotal,
        remainingMatches: persistedSummary.workerRemainingMatches,
      });

      return;
    }

    const discoveryResults = scanResult.discoveryResults as RiotScanDiscoveryResult[];
    const results =
      input.mode === "discovery"
        ? getRankedDiscoveryResults({
            focusChampion: input.discoveryFocusChampion,
            maxDisplayedResults: input.maxDisplayedResults,
            minimumGames: input.minimumGames,
            results: discoveryResults,
            updatedStats: persistenceResult.updatedStats,
          })
        : getPersistedTargetResult({
            result: scanResult.targetResult as RiotScanTargetResult | null,
            updatedStats: persistenceResult.updatedStats,
          });
    const didCandidatePersistenceFail =
      candidatePersistenceResult.candidateIdLookupChunkFailures > 0 ||
      candidatePersistenceResult.candidateUniqueIdResolutionFailures > 0 ||
      candidatePersistenceResult.candidateObservationResolutionFailures > 0 ||
      candidatePersistenceResult.candidateProfileFailures > 0;
    const persistenceRecoveryState = getPersistenceRecoveryState(persistedSummary);
    const didValidationFail =
      exceedsValidationFailureRate({
        rejected: persistenceResult.matchupObservationsRejected,
        validated: persistenceResult.matchupObservationsValidated,
      }) ||
      exceedsValidationFailureRate({
        rejected: candidatePersistenceResult.candidateObservationsRejected,
        validated: candidatePersistenceResult.candidateObservationsValidated,
      }) ||
      exceedsValidationFailureRate({
        rejected: persistenceResult.counterPickAggregateValidationFailures,
        validated: persistenceResult.counterPickAggregatesValidated,
      });
    const didPersistenceFail =
      didCandidatePersistenceFail || didValidationFail || persistenceRecoveryState.shouldFail;
    const persistenceErrorMessage = didCandidatePersistenceFail
      ? getCandidatePersistenceErrorMessage(persistedSummary)
      : didValidationFail
        ? getValidationErrorMessage(persistedSummary)
        : persistenceRecoveryState.shouldFail
          ? getPersistenceRecoveryErrorMessage(persistedSummary)
          : persistenceRecoveryState.hasWarnings
            ? getPersistenceRecoveryWarningMessage(persistedSummary)
            : null;

    console.info(
      "Riot counter pick scan completed",
      createRiotCounterPickScanLogPayload({
        didPersistenceFail,
        errorMessage: persistenceErrorMessage,
        jobId,
        persistenceResult,
        summary: persistedSummary,
      }),
    );

    await supabase
      .from("riot_scan_jobs")
      .update({
        completed_at: new Date().toISOString(),
        error_message: persistenceErrorMessage,
        progress: persistedSummary,
        results,
        status: didPersistenceFail ? "failed" : "completed",
        summary: persistedSummary,
      })
      .eq("id", jobId);

    if (didPersistenceFail) {
      await markSeedCandidatesScanFailed({
        errorCode: "scan_persistence_failed",
        scanJobId: jobId,
        seedPuuids: input.seedPuuids,
        supabase,
      });
    } else {
      await markSeedCandidatesScanSucceeded({
        scanJobId: jobId,
        seedPuuids: input.seedPuuids,
        summary: persistedSummary,
        supabase,
      });
    }
  } catch (error) {
    if (isRiotApiAuthenticationError(error) || isRiotApiAuthenticationFailure(error)) {
      const failure = getRiotApiAuthenticationFailureDetails(error);
      const failedProgress: RiotScanSummary = {
        ...progressBase,
        aggregationSkippedReason: "upstream-riot-authentication-failure",
        currentStage: "riot-authentication-failed",
        lastProgressAt: failure.detectedAt,
        riotApiFailure: failure,
        riotApiFailureCode: failure.code,
        riotApiFailureDetectedAt: failure.detectedAt,
        riotApiFailureEndpointGroup: failure.endpointGroup,
        riotApiFailureStatus: failure.status,
      };

      console.error("Riot API authentication failure", {
        aggregationSkipped: true,
        childJobId: jobId,
        collectionJobId,
        endpoint: failure.endpointGroup,
        retryable: failure.retryable,
        stage: failure.stage,
        status: failure.status,
      });

      await supabase
        .from("riot_scan_jobs")
        .update({
          completed_at: failure.detectedAt,
          error_message: failure.message,
          progress: failedProgress,
          status: "failed",
          summary: failedProgress,
        })
        .eq("id", jobId);

      await markSeedCandidatesScanFailed({
        errorCode: failure.code,
        scanJobId: jobId,
        seedPuuids: input.seedPuuids,
        supabase,
      });

      if (collectionJobId) {
        const currentJobResult = await fetchCollectionJob(supabase, collectionJobId);

        if (currentJobResult.ok && !isRiotCollectionTerminalStatus(currentJobResult.job.status)) {
          await completeCollectionJob({
            job: currentJobResult.job,
            status: "failed",
            stopDetail: `${failure.message} Aggregation skipped because Riot rejected the child scan credentials.`,
            stopReason: "riot-api-authentication-failed",
            supabase,
          });
        }
      }

      return;
    }

    if (isRiotRateLimitError(error)) {
      const message = getRiotRateLimitStopDetail(error);

      await supabase
        .from("riot_scan_jobs")
        .update({
          completed_at: new Date().toISOString(),
          error_message: message,
          progress: {
            ...progressBase,
            currentStage: "waiting-for-rate-limit",
            lastProgressAt: new Date().toISOString(),
            rateLimitReason: "rate-limit-retry-exhausted",
            rateLimitWaitUntil:
              typeof error.retryAfterMs === "number"
                ? new Date(Date.now() + error.retryAfterMs).toISOString()
                : null,
          },
          status: "cancelled",
        })
        .eq("id", jobId);

      await releaseSeedCandidatesFromControlledScan({
        seedPuuids: input.seedPuuids,
        supabase,
      });

      if (collectionJobId) {
        const currentJobResult = await fetchCollectionJob(supabase, collectionJobId);

        if (currentJobResult.ok && !isRiotCollectionTerminalStatus(currentJobResult.job.status)) {
          await completeCollectionJob({
            job: currentJobResult.job,
            status: "paused",
            stopDetail: message,
            stopReason: "rate-limited",
            supabase,
          });
        }
      }

      return;
    }

    if (isRiotScanControlError(error)) {
      const message =
        error.controlState === "cancelled"
          ? "Collection scan cancelled by administrator."
          : "Collection scan paused by administrator.";

      await supabase
        .from("riot_scan_jobs")
        .update({
          completed_at: new Date().toISOString(),
          error_message: message,
          progress: {
            ...progressBase,
            currentStage: "cancelled",
            lastProgressAt: new Date().toISOString(),
          },
          status: "cancelled",
        })
        .eq("id", jobId);

      await releaseSeedCandidatesFromControlledScan({
        seedPuuids: input.seedPuuids,
        supabase,
      });

      return;
    }

    console.error("Riot counter pick scan failed", {
      error: getScannerErrorMessage(error),
      scanJobId: jobId,
      seedCount: input.seedPuuids.length,
    });
    await failJob({
      errorMessage: getScannerErrorMessage(error),
      jobId,
      supabase,
    });
    await markSeedCandidatesScanFailed({
      errorCode: "scan_runtime_failed",
      scanJobId: jobId,
      seedPuuids: input.seedPuuids,
      supabase,
    });
  }
}

class RiotScanControlError extends Error {
  controlState: "cancelled" | "paused";

  constructor(controlState: "cancelled" | "paused") {
    super(`Riot scan stopped because the collection job is ${controlState}.`);
    this.controlState = controlState;
  }
}

function isRiotScanControlError(error: unknown): error is RiotScanControlError {
  return error instanceof RiotScanControlError;
}

function createRiotScanInvocationId(jobId: number) {
  return `scan-${jobId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getValidatedInputFromScanJob(scanJob: RiotScanJobRow): ValidatedStartInput {
  return {
    counterChampion: scanJob.counter_champion ?? "",
    currentPatchOnly: Boolean(scanJob.progress?.currentPatchOnly ?? scanJob.summary?.currentPatchOnly),
    discoveryFocusChampion: scanJob.focus_champion_id,
    enemyChampion: scanJob.enemy_champion ?? "",
    matchCount: scanJob.match_count,
    maxDisplayedResults: Number(
      scanJob.progress?.maxDisplayedResults ?? scanJob.summary?.maxDisplayedResults ?? 20,
    ),
    minimumGames: scanJob.minimum_games,
    mode: scanJob.mode,
    role: scanJob.role,
    seedPuuids: scanJob.seed_puuids ?? [],
  };
}

function isRiotRateLimitError(error: unknown): error is { retryAfterMs?: number; status?: number } {
  return (
    error !== null &&
    typeof error === "object" &&
    "status" in error &&
    Number((error as { status?: number }).status) === 429
  );
}

function isRiotApiAuthenticationFailure(error: unknown) {
  if (error === null || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; status?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : null;
  const status = Number(candidate.status);

  return (
    code === "riot-authentication-failed" ||
    code === "riot-access-denied" ||
    status === 401 ||
    status === 403
  );
}

function getRiotApiAuthenticationFailureDetails(error: unknown): NonNullable<
  RiotScanSummary["riotApiFailure"]
> {
  const candidate =
    error !== null && typeof error === "object"
      ? (error as {
          code?: unknown;
          endpointGroup?: unknown;
          message?: unknown;
          responseSummary?: unknown;
          retryable?: unknown;
          status?: unknown;
        })
      : {};
  const status = Number(candidate.status);
  const normalizedStatus = Number.isFinite(status) ? status : null;
  const code =
    candidate.code === "riot-access-denied"
      ? "riot-access-denied"
      : "riot-authentication-failed";
  const message =
    code === "riot-access-denied"
      ? "Riot API access was denied. Check whether the API key has expired or lacks access to this endpoint."
      : "Riot API authentication failed. The API key may be missing, invalid, or expired.";

  return {
    aggregationSkipped: true,
    code,
    detectedAt: new Date().toISOString(),
    endpointGroup:
      typeof candidate.endpointGroup === "string" && candidate.endpointGroup.trim()
        ? candidate.endpointGroup
        : "unknown",
    message,
    responseSummary:
      typeof candidate.responseSummary === "string" && candidate.responseSummary.trim()
        ? candidate.responseSummary
        : null,
    retryable: false,
    stage: getRiotApiFailureStage(candidate.endpointGroup),
    status: normalizedStatus,
  };
}

function getRiotApiFailureStage(endpointGroup: unknown) {
  const endpoint = String(endpointGroup ?? "");

  if (endpoint.includes("match-ids")) {
    return "match-id-fetch";
  }

  if (endpoint.includes("match-detail")) {
    return "match-detail-fetch";
  }

  if (endpoint.includes("league-v4") || endpoint.includes("summoner-v4")) {
    return "seed-discovery";
  }

  if (endpoint.includes("account-v1")) {
    return "account-lookup";
  }

  return "riot-request";
}

function hasRiotApiAuthenticationFailure(scanJob: RiotScanJobRow) {
  const failureCode = scanJob.progress?.riotApiFailureCode ?? scanJob.summary?.riotApiFailureCode;
  const failure = scanJob.progress?.riotApiFailure ?? scanJob.summary?.riotApiFailure;

  return (
    failureCode === "riot-authentication-failed" ||
    failureCode === "riot-access-denied" ||
    failure?.code === "riot-authentication-failed" ||
    failure?.code === "riot-access-denied"
  );
}

function getRiotRateLimitStopDetail(error: { retryAfterMs?: number }) {
  const retryAfterMs = Number(error.retryAfterMs ?? 0);

  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return `Riot request budget remained unavailable after bounded retries. Resume after ${new Date(Date.now() + retryAfterMs).toISOString()}.`;
  }

  return "Riot request budget remained unavailable after bounded retries.";
}

async function assertScanControlAllowsProgress({
  collectionJobId,
  jobId,
  supabase,
}: {
  collectionJobId: number | null;
  jobId: number;
  supabase: SupabaseClient;
}) {
  const { data: scanJob } = await supabase
    .from("riot_scan_jobs")
    .select("status")
    .eq("id", jobId)
    .maybeSingle<{ status: RiotScanStatus }>();

  if (scanJob?.status === "cancelled") {
    throw new RiotScanControlError("cancelled");
  }

  if (!collectionJobId) {
    return true;
  }

  const { data: collectionJob } = await supabase
    .from("riot_collection_jobs")
    .select("status")
    .eq("id", collectionJobId)
    .maybeSingle<{ status: RiotCollectionStatus }>();

  if (collectionJob?.status === "cancelled") {
    throw new RiotScanControlError("cancelled");
  }

  if (collectionJob?.status === "paused") {
    throw new RiotScanControlError("paused");
  }

  return true;
}

async function mirrorScanProgressToCollectionJob({
  collectionJobId,
  progress,
  scanJobId,
  supabase,
}: {
  collectionJobId: number;
  progress: RiotScanSummary;
  scanJobId: number;
  supabase: SupabaseClient;
}) {
  const { data: collectionJob } = await supabase
    .from("riot_collection_jobs")
    .select("progress, status")
    .eq("id", collectionJobId)
    .maybeSingle<Pick<RiotCollectionJobRow, "progress" | "status">>();

  if (!collectionJob || isRiotCollectionTerminalStatus(collectionJob.status)) {
    return;
  }

  if (collectionJob.status === "paused") {
    return;
  }

  await supabase
    .from("riot_collection_jobs")
    .update({
      progress: {
        ...(collectionJob.progress ?? {}),
        activeScanJobId: scanJobId,
        activeScanProgress: progress,
        activeScanProgressAt: new Date().toISOString(),
        lastAdvancedAt: new Date().toISOString(),
        lastMessage: getLiveScanProgressMessage(progress),
        safetyLimits: defaultRiotCollectionSafetyLimits,
      },
    })
    .eq("id", collectionJobId);
}

function getLiveScanProgressMessage(progress: RiotScanSummary) {
  if (progress.currentStage === "waiting-for-rate-limit") {
    return progress.rateLimitWaitUntil
      ? `Waiting for Riot request budget until ${progress.rateLimitWaitUntil}.`
      : "Waiting for Riot request budget.";
  }

  if (progress.currentStage === "fetching-match-ids") {
    return `Fetching match IDs from seed ${progress.currentSeedIndex ?? "?"}/${progress.seedCount ?? "?"}.`;
  }

  if (progress.currentStage === "fetching-matches") {
    return `Scanning match ${progress.currentMatchIndex ?? progress.matchesScanned ?? 0}/${progress.matchesTotal ?? progress.uniqueMatchIds ?? "?"}.`;
  }

  if (progress.currentStage === "chunk-complete") {
    return `Child scan chunk complete. ${progress.workerRemainingMatches ?? 0} matches remaining.`;
  }

  if (progress.currentStage === "persisting") {
    return "Persisting child scan observations and rebuilding matchup stats.";
  }

  return "Child scan progress updated.";
}

type RiotRateLimitWaitState = {
  activeHeaderWindows?: Array<Record<string, unknown>>;
  endpointGroup?: string;
  lastRiotRequestAt?: string | null;
  longWindowLimit?: number;
  longWindowUsage?: number;
  requestDelayed?: boolean;
  retries?: number;
  riot429Responses?: number;
  shortWindowLimit?: number;
  shortWindowUsage?: number;
  totalWaitMs?: number;
  waitEpisodeStarted?: boolean;
  waitMs?: number;
  waitUntil?: string | null;
};

async function updateRiotScanRateLimitProgress({
  collectionJobId,
  jobId,
  progressBase,
  rateLimitState,
  supabase,
}: {
  collectionJobId: number | null;
  jobId: number;
  progressBase: Partial<RiotScanSummary>;
  rateLimitState: RiotRateLimitWaitState;
  supabase: SupabaseClient;
}) {
  const { data: scanJob } = await supabase
    .from("riot_scan_jobs")
    .select("progress")
    .eq("id", jobId)
    .maybeSingle<{ progress: RiotScanSummary | null }>();
  const existingProgress = scanJob?.progress ?? {};
  const nextWaitEpisodes =
    Number(existingProgress.rateLimitWaitEpisodes ?? existingProgress.rateLimitWaits ?? 0) +
    (rateLimitState.waitEpisodeStarted ? 1 : 0);
  const nextRequestsDelayed =
    Number(existingProgress.rateLimitRequestsDelayed ?? 0) +
    (rateLimitState.requestDelayed ? 1 : 0);
  const nextTotalWaitMs =
    Number(existingProgress.riotRateLimitTotalWaitMs ?? 0) + Number(rateLimitState.waitMs ?? 0);
  const nextProgress: RiotScanSummary = {
    ...progressBase,
    currentStage: "waiting-for-rate-limit",
    lastProgressAt: new Date().toISOString(),
    lastRiotRequestAt: rateLimitState.lastRiotRequestAt ?? null,
    rateLimitLongWindowLimit: rateLimitState.longWindowLimit,
    rateLimitLongWindowUsage: rateLimitState.longWindowUsage,
    rateLimitReason: rateLimitState.endpointGroup ?? "unknown",
    rateLimitRetries: rateLimitState.retries,
    rateLimitRequestsDelayed: nextRequestsDelayed,
    rateLimitShortWindowLimit: rateLimitState.shortWindowLimit,
    rateLimitShortWindowUsage: rateLimitState.shortWindowUsage,
    rateLimitWaitEpisodes: nextWaitEpisodes,
    rateLimitWaitMs: rateLimitState.waitMs,
    rateLimitWaitUntil: rateLimitState.waitUntil ?? null,
    rateLimitWaits: nextWaitEpisodes,
    riot429Responses: rateLimitState.riot429Responses,
    riotRateLimitTotalWaitMs: nextTotalWaitMs,
  };

  await supabase
    .from("riot_scan_jobs")
    .update({
      progress: nextProgress,
    })
    .eq("id", jobId);

  if (collectionJobId) {
    await mirrorScanProgressToCollectionJob({
      collectionJobId,
      progress: nextProgress,
      scanJobId: jobId,
      supabase,
    });
  }
}

async function updateCollectionRateLimitProgress({
  job,
  rateLimitState,
  supabase,
}: {
  job: RiotCollectionJobView;
  rateLimitState: RiotRateLimitWaitState;
  supabase: SupabaseClient;
}) {
  const existingRateLimit =
    job.summary.rateLimit && typeof job.summary.rateLimit === "object"
      ? (job.summary.rateLimit as Record<string, unknown>)
      : {};
  const waitEpisodes =
    Number(existingRateLimit.waitEpisodes ?? existingRateLimit.rateLimitWaits ?? 0) +
    (rateLimitState.waitEpisodeStarted ? 1 : 0);
  const requestsDelayed =
    Number(existingRateLimit.requestsDelayed ?? 0) + (rateLimitState.requestDelayed ? 1 : 0);
  const totalWaitMs =
    Number(existingRateLimit.totalWaitMs ?? 0) + Number(rateLimitState.waitMs ?? 0);

  await supabase
    .from("riot_collection_jobs")
    .update({
      progress: getCollectionProgressPatch(job, {
        lastMessage: rateLimitState.waitUntil
          ? `Waiting for Riot request budget until ${rateLimitState.waitUntil}.`
          : "Waiting for Riot request budget.",
      }),
      summary: getCollectionSummaryPatch(job, {
        rateLimit: {
          endpointGroup: rateLimitState.endpointGroup ?? "unknown",
          lastRiotRequestAt: rateLimitState.lastRiotRequestAt ?? null,
          longWindowLimit: rateLimitState.longWindowLimit,
          longWindowUsage: rateLimitState.longWindowUsage,
          requestsDelayed,
          retries: rateLimitState.retries,
          riot429Responses: rateLimitState.riot429Responses,
          shortWindowLimit: rateLimitState.shortWindowLimit,
          shortWindowUsage: rateLimitState.shortWindowUsage,
          totalWaitMs,
          waitMs: rateLimitState.waitMs,
          waitEpisodes,
          waitUntil: rateLimitState.waitUntil ?? null,
        },
      }),
    })
    .eq("id", job.id)
    .not("status", "in", "(cancelled,completed,completed-partial,failed)");
}

async function assertCollectionJobAllowsRiotRequest({
  collectionJobId,
  supabase,
}: {
  collectionJobId: number;
  supabase: SupabaseClient;
}) {
  const { data } = await supabase
    .from("riot_collection_jobs")
    .select("status")
    .eq("id", collectionJobId)
    .maybeSingle<{ status: RiotCollectionStatus }>();

  return data?.status !== "cancelled" && data?.status !== "paused";
}

type RiotCounterPickScanLogPersistence = {
  affectedGroups?: unknown[];
  counterPickAggregateInsertFailures?: number;
  counterPickAggregateValidationFailures?: number;
  duplicateObservationsSkipped?: number;
  insertedObservations?: number;
  insertFailures?: number;
  matchupObservationsRejected?: number;
  observationsFound?: number;
  statsRowsUpdated?: number;
  updatedStats?: unknown[];
};

function createRiotCounterPickScanLogPayload({
  didPersistenceFail,
  errorMessage,
  jobId,
  persistenceResult,
  summary,
}: {
  didPersistenceFail: boolean;
  errorMessage: string | null;
  jobId: number;
  persistenceResult: RiotCounterPickScanLogPersistence;
  summary: RiotScanSummary;
}) {
  const aggregationTriggered = (persistenceResult.affectedGroups?.length ?? 0) > 0;
  const aggregationSucceeded = aggregationTriggered
    ? getNumberMetric(summary.counterPickAggregateInsertFailures) === 0 &&
      getNumberMetric(summary.counterPickAggregateValidationFailures) === 0
    : false;
  const rankBrackets = Array.from(
    new Set(
      (persistenceResult.updatedStats ?? [])
        .map(getRankBracketMetric)
        .filter((rankBracket): rankBracket is string => Boolean(rankBracket)),
    ),
  ).sort();

  return {
    aggregationSucceeded,
    aggregationTriggered,
    duplicateMatchIds: Math.max(
      getNumberMetric(summary.fetchedMatchIds) - getNumberMetric(summary.uniqueMatchIds),
      0,
    ),
    duplicateObservations: getNumberMetric(summary.observationDuplicatesSkipped),
    errorMessage,
    matchIdsFetched: getNumberMetric(summary.fetchedMatchIds),
    matchesFetched: getNumberMetric(summary.matchesFetched),
    matchesFailed: 0,
    matchesLoaded: getNumberMetric(summary.matchesScanned),
    matchesSkippedInvalidData: getNumberMetric(summary.matchesSkippedInvalidData),
    matchesSkippedUnsupportedRoleChampion: getNumberMetric(
      summary.matchesSkippedUnsupportedRoleChampion,
    ),
    observationsAggregated: getNumberMetric(summary.observationsAggregated),
    observationsCreated: getNumberMetric(summary.observationsCreated),
    observationsGenerated: getNumberMetric(summary.observationsFound),
    observationsInserted: getNumberMetric(summary.observationsInserted),
    observationsRejected: getNumberMetric(summary.matchupObservationsRejected),
    rankBracket:
      rankBrackets.length === 0 ? "none" : rankBrackets.length === 1 ? rankBrackets[0] : "mixed",
    rankBrackets,
    scanJobId: jobId,
    seedCount: getNumberMetric(summary.seedCount),
    seedCandidatesCreatedOrUpdated: getNumberMetric(summary.seedCandidatesCreatedOrUpdated),
    statsRows: getNumberMetric(summary.statsRowsUpdated),
    status: didPersistenceFail ? "failed" : "completed",
    uniqueMatchIds: getNumberMetric(summary.uniqueMatchIds),
  };
}

function getNumberMetric(value: unknown) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getRankBracketMetric(value: unknown) {
  if (!value || typeof value !== "object" || !("rank_bracket" in value)) {
    return null;
  }

  const rankBracket = value.rank_bracket;

  return typeof rankBracket === "string" && rankBracket.trim() ? rankBracket : null;
}

function getRankedDiscoveryResults({
  focusChampion,
  maxDisplayedResults,
  minimumGames,
  results,
  updatedStats,
}: {
  focusChampion: string | null;
  maxDisplayedResults: number;
  minimumGames: number;
  results: RiotScanDiscoveryResult[];
  updatedStats: Array<{
    counter_champion_id: string;
    enemy_champion_id: string;
    games: number;
    role: string;
    tier?: string | null;
  }>;
}) {
  return results
    .filter((result) => result.games >= minimumGames)
    .map((result) => ({
      ...result,
      ...getStoredFocusedDiscoveryStats({
        result,
        updatedStats,
      }),
      representedInStats: getDiscoveryResultStoredStatus({
        result,
        updatedStats,
      }),
    }))
    .sort((left, right) => {
      if (!focusChampion) {
        return 0;
      }

      if (left.games !== right.games) {
        return right.games - left.games;
      }

      const leftStoredGames = left.storedGamesAfterAggregation ?? 0;
      const rightStoredGames = right.storedGamesAfterAggregation ?? 0;

      if (leftStoredGames !== rightStoredGames) {
        return rightStoredGames - leftStoredGames;
      }

      return String(left.opponentChampionDisplayName ?? left.championB).localeCompare(
        String(right.opponentChampionDisplayName ?? right.championB),
      );
    })
    .slice(0, maxDisplayedResults);
}

function getPersistedTargetResult({
  result,
  updatedStats,
}: {
  result: RiotScanTargetResult | null;
  updatedStats: Array<{
    counter_champion_id: string;
    enemy_champion_id: string;
    games: number;
    role: string;
  }>;
}) {
  if (!result) {
    return null;
  }

  const storedStat = updatedStats.find(
    (stat) =>
      stat.enemy_champion_id === result.enemyChampion &&
      stat.counter_champion_id === result.counterChampion &&
      stat.role === result.role,
  );

  return {
    ...result,
    storedGamesAfterAggregation: storedStat?.games ?? 0,
    wasWrittenToStats: Boolean(storedStat),
  };
}

function getStoredFocusedDiscoveryStats({
  result,
  updatedStats,
}: {
  result: RiotScanDiscoveryResult;
  updatedStats: Array<{
    counter_champion_id: string;
    enemy_champion_id: string;
    games: number;
    role: string;
    tier?: string | null;
  }>;
}) {
  const focusChampion = result.focusChampion ?? result.championA;
  const opponentChampion = result.opponentChampion ?? result.championB;
  const storedStat = updatedStats.find(
    (stat) =>
      stat.enemy_champion_id === opponentChampion &&
      stat.counter_champion_id === focusChampion &&
      stat.role === result.role,
  );

  if (!result.focusChampion && !result.opponentChampion) {
    return {};
  }

  return {
    storedGamesAfterAggregation: storedStat?.games ?? 0,
    storedTier: storedStat?.tier ?? null,
  };
}

function getDiscoveryResultStoredStatus({
  result,
  updatedStats,
}: {
  result: RiotScanDiscoveryResult;
  updatedStats: Array<{
    counter_champion_id: string;
    enemy_champion_id: string;
    role: string;
  }>;
}) {
  const focusChampion = result.focusChampion ?? result.championA;
  const opponentChampion = result.opponentChampion ?? result.championB;

  if (result.focusChampion || result.opponentChampion) {
    return updatedStats.some(
      (stat) =>
        stat.enemy_champion_id === opponentChampion &&
        stat.counter_champion_id === focusChampion &&
        stat.role === result.role,
    );
  }

  return updatedStats.some(
    (stat) =>
      stat.role === result.role &&
      ((stat.enemy_champion_id === result.championA &&
        stat.counter_champion_id === result.championB) ||
        (stat.enemy_champion_id === result.championB &&
          stat.counter_champion_id === result.championA)),
  );
}

function countKeyIntersections(keys: Set<string>, candidates: string[]) {
  let count = 0;

  for (const candidate of candidates) {
    if (keys.has(candidate)) {
      count += 1;
    }
  }

  return count;
}

function getCandidatePersistenceErrorMessage(summary: RiotScanSummary) {
  return [
    "Candidate persistence partially failed:",
    `${summary.uniqueCandidatesEncountered ?? 0} unique candidates encountered`,
    `${summary.candidateIdsResolved ?? 0} candidate IDs resolved`,
    `${summary.candidateUniqueIdResolutionFailures ?? 0} identities unresolved`,
    `${summary.candidateObservationResolutionFailures ?? 0} participant observations skipped`,
    `${summary.candidateIdLookupChunkFailures ?? 0} lookup chunks failed`,
    `${summary.candidateObservationInsertFailures ?? 0} observation insert failures`,
    `${summary.candidateProfileFailures ?? 0} profile rebuild failures`,
  ].join(" ");
}

function getValidationErrorMessage(summary: RiotScanSummary) {
  return [
    "Riot observation validation rejected too many rows:",
    `${summary.matchupObservationsRejected ?? 0} matchup observations rejected`,
    `${summary.candidateObservationsRejected ?? 0} candidate observations rejected`,
    `${summary.counterPickAggregateValidationFailures ?? 0} counter-pick aggregates rejected`,
  ].join(" ");
}

async function markSeedCandidatesQueued({
  jobId,
  seedPuuids,
  supabase,
}: {
  jobId: number;
  seedPuuids: string[];
  supabase: SupabaseClient;
}) {
  const candidates = await fetchScanSeedCandidates({ seedPuuids, supabase });

  for (const candidate of candidates) {
    const { error } = await supabase
      .from("riot_seed_candidates")
      .update({
        first_seen_scan_job_id: candidate.first_seen_scan_job_id ?? jobId,
        status: "queued",
      })
      .eq("id", candidate.id);

    if (error) {
      console.error("Seed candidate queue metadata update failed", getSafeDatabaseError(error));
    }
  }
}

async function markSeedCandidatesScanRunning({
  seedPuuids,
  supabase,
}: {
  seedPuuids: string[];
  supabase: SupabaseClient;
}) {
  const candidates = await fetchScanSeedCandidates({ seedPuuids, supabase });

  for (const candidate of candidates) {
    const { error } = await supabase
      .from("riot_seed_candidates")
      .update({
        status: "active",
      })
      .eq("id", candidate.id);

    if (error) {
      console.error("Seed candidate running metadata update failed", getSafeDatabaseError(error));
    }
  }
}

async function markSeedCandidatesScanSucceeded({
  scanJobId,
  seedPuuids,
  summary,
  supabase,
}: {
  scanJobId: number;
  seedPuuids: string[];
  summary: RiotScanSummary;
  supabase: SupabaseClient;
}) {
  const candidates = await fetchScanSeedCandidates({ seedPuuids, supabase });
  const scannedAtDate = new Date();
  const scannedAt = scannedAtDate.toISOString();
  const nextEligibleAt = getSeedScanCooldownEligibleAt(scannedAtDate);

  for (const candidate of candidates) {
    const previousLifecycle = deriveSeedCandidateLifecycle(candidate);
    const { error } = await supabase
      .from("riot_seed_candidates")
      .update({
        consecutive_scan_failures: 0,
        last_scan_candidate_observations_discovered:
          summary.candidateObservationsInserted ?? summary.candidateObservationsFound ?? null,
        last_scan_duplicate_matches_skipped: summary.observationDuplicatesSkipped ?? null,
        last_scan_error_at: null,
        last_scan_error_code: null,
        last_scan_match_ids_fetched: summary.fetchedMatchIds ?? null,
        last_scan_matchup_observations_inserted: summary.observationsInserted ?? null,
        last_scan_unique_matches_found: summary.uniqueMatchIds ?? null,
        last_scanned_at: scannedAt,
        last_successful_scan_at: scannedAt,
        latest_scan_job_id: scanJobId,
        next_eligible_scan_at: nextEligibleAt,
        next_retry_at: null,
        status: "candidate",
        successful_scan_count: Number(candidate.successful_scan_count ?? 0) + 1,
        times_scanned: Number(candidate.times_scanned ?? 0) + 1,
      })
      .eq("id", candidate.id);

    if (error) {
      console.error("Seed candidate success metadata update failed", getSafeDatabaseError(error));
    } else {
      logSeedCandidateLifecycleTransition({
        candidate: {
          ...candidate,
          consecutive_scan_failures: 0,
          last_scanned_at: scannedAt,
          last_successful_scan_at: scannedAt,
          next_eligible_scan_at: nextEligibleAt,
          next_retry_at: null,
          status: "candidate",
        },
        previousLifecycle,
        scanJobId,
      });
    }
  }
}

async function markSeedCandidatesScanFailed({
  errorCode,
  scanJobId,
  seedPuuids,
  supabase,
}: {
  errorCode: string;
  scanJobId: number;
  seedPuuids: string[];
  supabase: SupabaseClient;
}) {
  const candidates = await fetchScanSeedCandidates({ seedPuuids, supabase });
  const failedAtDate = new Date();
  const failedAt = failedAtDate.toISOString();

  for (const candidate of candidates) {
    const previousLifecycle = deriveSeedCandidateLifecycle(candidate);
    const consecutiveFailures = Number(candidate.consecutive_scan_failures ?? 0) + 1;
    const nextRetryAt = getSeedScanRetryEligibleAt(failedAtDate, consecutiveFailures);
    const { error } = await supabase
      .from("riot_seed_candidates")
      .update({
        consecutive_scan_failures: consecutiveFailures,
        failed_scan_count: Number(candidate.failed_scan_count ?? 0) + 1,
        last_scan_error_at: failedAt,
        last_scan_error_code: errorCode,
        last_scanned_at: failedAt,
        latest_scan_job_id: scanJobId,
        next_retry_at: nextRetryAt,
        status: "failed",
      })
      .eq("id", candidate.id);

    if (error) {
      console.error("Seed candidate failure metadata update failed", getSafeDatabaseError(error));
    } else {
      logSeedCandidateLifecycleTransition({
        candidate: {
          ...candidate,
          consecutive_scan_failures: consecutiveFailures,
          last_scan_error_at: failedAt,
          last_scan_error_code: errorCode,
          last_scanned_at: failedAt,
          latest_scan_job_id: scanJobId,
          next_retry_at: nextRetryAt,
          status: "failed",
        },
        previousLifecycle,
        scanJobId,
      });
    }
  }
}

async function releaseSeedCandidatesFromControlledScan({
  seedPuuids,
  supabase,
}: {
  seedPuuids: string[];
  supabase: SupabaseClient;
}) {
  const candidates = await fetchScanSeedCandidates({ seedPuuids, supabase });

  for (const candidate of candidates) {
    const { error } = await supabase
      .from("riot_seed_candidates")
      .update({
        status: "candidate",
      })
      .eq("id", candidate.id);

    if (error) {
      console.error("Seed candidate controlled-scan release failed", getSafeDatabaseError(error));
    }
  }
}

async function fetchScanSeedCandidates({
  seedPuuids,
  supabase,
}: {
  seedPuuids: string[];
  supabase: SupabaseClient;
}): Promise<RiotSeedCandidateView[]> {
  const uniquePuuids = uniqueValues(seedPuuids);

  if (uniquePuuids.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("riot_seed_candidates")
    .select(riotSeedCandidateSelect)
    .eq(
      "platform_region",
      (process.env.RIOT_PLATFORM_REGION ?? defaultPlatformRegion).toUpperCase(),
    )
    .in("puuid", uniquePuuids);

  if (error) {
    console.error("Seed candidate scan metadata lookup failed", getSafeDatabaseError(error));
    return [];
  }

  return (data ?? []) as unknown as RiotSeedCandidateView[];
}

function getSafeDatabaseError(error: {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
  status?: number;
}) {
  return {
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
    message: error.message ?? "Database operation failed.",
    status: error.status ?? null,
  };
}

function isRiotCollectionTargetConstraintError(
  error:
    | {
        code?: string;
        details?: string;
        message?: string;
      }
    | null,
) {
  if (!error || error.code !== "23514") {
    return false;
  }

  const detail = `${error.message ?? ""} ${error.details ?? ""}`;

  return detail.includes("riot_collection_jobs_target_check");
}

function logSeedCandidateLifecycleTransition({
  candidate,
  previousLifecycle,
  scanJobId,
}: {
  candidate: RiotSeedCandidateView;
  previousLifecycle: ReturnType<typeof deriveSeedCandidateLifecycle>;
  scanJobId: number;
}) {
  const nextLifecycle = deriveSeedCandidateLifecycle(candidate);

  if (
    previousLifecycle.state === nextLifecycle.state &&
    previousLifecycle.nextEligibleAt === nextLifecycle.nextEligibleAt
  ) {
    return;
  }

  console.info("Riot seed candidate lifecycle changed", {
    candidateId: candidate.id,
    nextEligibleAt: nextLifecycle.nextEligibleAt,
    nextState: nextLifecycle.state,
    previousState: previousLifecycle.state,
    reasonCodes: nextLifecycle.reasonCodes,
    scanJobId,
  });
}

function getPersistenceRecoveryState(summary: RiotScanSummary) {
  const states = [
    getPersistenceStageState({
      attempted:
        (summary.candidateObservationsValidated ?? 0) -
        (summary.candidateObservationsRejected ?? 0),
      failures: summary.candidateObservationInsertFailures ?? 0,
      unresolved: summary.candidateObservationUnresolvedBatchFailures ?? 0,
    }),
    getPersistenceStageState({
      attempted:
        (summary.matchupObservationsValidated ?? 0) - (summary.matchupObservationsRejected ?? 0),
      failures: summary.observationInsertFailures ?? 0,
      unresolved: summary.matchupObservationUnresolvedBatchFailures ?? 0,
    }),
    getPersistenceStageState({
      attempted: summary.counterPickAggregatesValidated ?? 0,
      failures: summary.counterPickAggregateInsertFailures ?? 0,
      unresolved: summary.counterPickAggregateUnresolvedBatchFailures ?? 0,
    }),
  ];

  return {
    hasWarnings: states.some((state) => state.hasWarnings),
    shouldFail: states.some((state) => state.shouldFail),
  };
}

function getPersistenceStageState({
  attempted,
  failures,
  unresolved,
}: {
  attempted: number;
  failures: number;
  unresolved: number;
}) {
  const failureRate = attempted > 0 ? failures / attempted : 0;
  const hasWarnings = failures > 0 || unresolved > 0;

  return {
    hasWarnings,
    shouldFail:
      unresolved > 0 ||
      failures > maxWarningOnlyPersistenceFailureCount ||
      failureRate > maxWarningOnlyPersistenceFailureRate,
  };
}

function getPersistenceRecoveryErrorMessage(summary: RiotScanSummary) {
  return [
    "Riot persistence recovery could not save enough valid rows:",
    `${summary.candidateObservationInsertFailures ?? 0} candidate observation failures`,
    `${summary.observationInsertFailures ?? 0} matchup observation failures`,
    `${summary.counterPickAggregateInsertFailures ?? 0} aggregate write failures`,
    `${summary.candidateObservationUnresolvedBatchFailures ?? 0} candidate rows unresolved`,
    `${summary.matchupObservationUnresolvedBatchFailures ?? 0} matchup rows unresolved`,
  ].join(" ");
}

function getPersistenceRecoveryWarningMessage(summary: RiotScanSummary) {
  return [
    "Completed with Riot persistence recovery warnings:",
    `${summary.candidateObservationIsolatedFailures ?? 0} candidate rows isolated`,
    `${summary.matchupObservationIsolatedFailures ?? 0} matchup rows isolated`,
    `${summary.counterPickAggregateIsolatedFailures ?? 0} aggregate rows isolated`,
  ].join(" ");
}

async function loadCountMetric({
  label,
  loader,
  onLoaded,
}: {
  label: string;
  loader: () => Promise<{ error: string | null; value: number | null }>;
  onLoaded: (metric: { error: string | null; value: number | null }) => void;
}) {
  const metric = await loader();

  if (metric.error) {
    console.error("Counter Pick management metric unavailable", {
      error: metric.error,
      metric: label,
    });
  }

  onLoaded(metric);
}

async function countRows(
  supabase: SupabaseClient,
  table: string,
  applyFilters?: (query: CountQueryBuilder) => CountQueryBuilder,
) {
  let query = supabase
    .from(table)
    .select("*", { count: "exact", head: true }) as unknown as CountQueryBuilder;

  if (applyFilters) {
    query = applyFilters(query);
  }

  const { count, error } = await query;

  if (error) {
    return createMetricValue(null, error.message ?? `${table} count could not be loaded.`);
  }

  return createMetricValue(count ?? 0);
}

async function countUniqueMatchupGroups(supabase: SupabaseClient) {
  const { data, error } = await (supabase.rpc(
    "get_counter_pick_unique_matchup_group_count",
  ) as unknown as PromiseLike<{
    data: number | string | null;
    error: { message?: string } | null;
  }>);

  if (error) {
    return createMetricValue(null, error.message ?? "Unique matchup groups could not be loaded.");
  }

  const value = Number(data);

  return createMetricValue(Number.isFinite(value) ? value : 0);
}

async function loadLatestSuccessfulScanMetric(
  supabase: SupabaseClient,
  metrics: ReturnType<typeof createEmptyCounterPickManagementMetrics>,
) {
  const { data, error } = await supabase
    .from("riot_scan_jobs")
    .select("id, completed_at, summary, progress")
    .eq("status", "completed")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<RiotScanJobMetricsRow>();

  if (error) {
    const message = error.message ?? "Latest successful scan could not be loaded.";

    console.error("Counter Pick management latest scan unavailable", {
      error: message,
    });
    metrics.latestSuccessfulScan = {
      error: message,
      value: null,
    };
    return;
  }

  metrics.latestSuccessfulScan = {
    error: null,
    value: data ? normalizeRiotScanJobMetrics(data) : null,
  };
}

async function loadLatestCollectionMetric(
  supabase: SupabaseClient,
  metrics: ReturnType<typeof createEmptyCounterPickManagementMetrics>,
) {
  const { data, error } = await supabase
    .from("riot_collection_jobs")
    .select("id, platform, rank_bracket, resolved_patch, role, status, updated_at")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<RiotCollectionMetricRow>();

  if (error) {
    const message = error.message ?? "Latest collection job could not be loaded.";

    console.error("Counter Pick management latest collection unavailable", {
      error: message,
    });
    metrics.operations.latestCollection = {
      error: message,
      value: null,
    };
    return;
  }

  metrics.operations.latestCollection = {
    error: null,
    value: data
      ? {
          id: data.id,
          platform: data.platform,
          rankBracket: data.rank_bracket,
          resolvedPatch: data.resolved_patch,
          role: data.role,
          status: data.status,
          updatedAt: data.updated_at,
        }
      : null,
  };
}

async function validateCollectionInput(
  input: StartRiotCollectionJobInput,
  supabase: SupabaseClient,
): Promise<
  | {
      automaticSeedDiscovery: boolean;
      currentPatchOnly: boolean;
      focusChampionId: string | null;
      ok: true;
      platform: string;
      rankBracket: RiotCollectionRankBracket;
      regionalRoute: string;
      role: RiotCollectionRole;
      targetUniqueMatches: RiotCollectionTarget;
    }
  | {
      error: string;
      ok: false;
    }
> {
  const rankBracket = input.rankBracket;
  const role = input.role;
  const targetUniqueMatches = Number(input.targetUniqueMatches);
  const platform = String(input.platform ?? defaultPlatformRegion)
    .trim()
    .toUpperCase();
  const regionalRoute = String(input.regionalRoute ?? defaultRegionalRoute)
    .trim()
    .toUpperCase();

  if (!riotCollectionRankBrackets.includes(rankBracket)) {
    return {
      error: "Select a supported rank bracket.",
      ok: false,
    };
  }

  if (
    role !== "any" &&
    role !== "top" &&
    role !== "jungle" &&
    role !== "mid" &&
    role !== "adc" &&
    role !== "support"
  ) {
    return {
      error: "Select a supported role.",
      ok: false,
    };
  }

  if (!isRiotCollectionTarget(targetUniqueMatches)) {
    return {
      error: getRiotCollectionTargetValidationError(),
      ok: false,
    };
  }

  if (platform !== "EUW1" || regionalRoute !== "EUROPE") {
    return {
      error: "Automated collection currently supports EUW only.",
      ok: false,
    };
  }

  const focusChampionId = input.focusChampionId?.trim() || null;

  if (focusChampionId) {
    const registryResult = await loadChampionRegistry(supabase);

    if (!registryResult.ok) {
      return registryResult;
    }

    const normalizedFocusChampion = registryResult.normalizeChampionIdentifier(
      focusChampionId,
      registryResult.registry,
    );

    if (!normalizedFocusChampion) {
      return {
        error: "Select a valid champion focus.",
        ok: false,
      };
    }

    return {
      automaticSeedDiscovery: input.automaticSeedDiscovery,
      currentPatchOnly: input.currentPatchOnly,
      focusChampionId: normalizedFocusChampion.canonicalKey,
      ok: true,
      platform,
      rankBracket,
      regionalRoute,
      role,
      targetUniqueMatches,
    };
  }

  return {
    automaticSeedDiscovery: input.automaticSeedDiscovery,
    currentPatchOnly: input.currentPatchOnly,
    focusChampionId: null,
    ok: true,
    platform,
    rankBracket,
    regionalRoute,
    role,
    targetUniqueMatches,
  };
}

async function advanceRiotCollectionJob({
  accessToken,
  job,
  supabase,
}: {
  accessToken: string;
  job: RiotCollectionJobView;
  supabase: SupabaseClient;
}): Promise<RiotCollectionJobResult> {
  if (isRiotCollectionTerminalStatus(job.status)) {
    return {
      job,
      ok: true,
    };
  }

  const reconciledJobResult = await reconcileCompletedCollectionScans({ job, supabase });

  if (!reconciledJobResult.ok) {
    return reconciledJobResult;
  }

  let nextJob = reconciledJobResult.job;

  if (nextJob.status === "paused") {
    return {
      job: nextJob,
      ok: true,
    };
  }

  const activeScanResult = await getActiveCollectionScan(supabase, nextJob.id);

  if (activeScanResult) {
    if (activeScanResult.status === "queued") {
      const activeScanRow = await fetchRiotScanJobRow(supabase, activeScanResult.id);

      if (!activeScanRow) {
        return failCollectionJob({
          errorMessage: `Child scan ${activeScanResult.id} could not be loaded for continuation.`,
          job: nextJob,
          supabase,
        });
      }

      await runRiotScanJob({
        collectionJobId: nextJob.id,
        input: getValidatedInputFromScanJob(activeScanRow),
        jobId: activeScanResult.id,
        supabase,
      });

      const refreshedJobResult = await fetchCollectionJob(supabase, nextJob.id);

      if (!refreshedJobResult.ok) {
        return refreshedJobResult;
      }

      const refreshedActiveScan = await getActiveCollectionScan(supabase, nextJob.id);

      if (!refreshedActiveScan) {
        return advanceRiotCollectionJob({
          accessToken,
          job: refreshedJobResult.job,
          supabase,
        });
      }

      return updateCollectionJob({
        patch: {
          progress: getCollectionProgressPatch(refreshedJobResult.job, {
            activeScanJobId: refreshedActiveScan.id,
            lastMessage: `Processed a bounded child scan chunk for ${refreshedActiveScan.id}.`,
          }),
          status: "scanning",
        },
        supabase,
        id: refreshedJobResult.job.id,
      });
    }

    return updateCollectionJob({
      patch: {
        progress: getCollectionProgressPatch(nextJob, {
          activeScanJobId: activeScanResult.id,
          lastMessage: `Waiting for child scan ${activeScanResult.id}.`,
        }),
        status: "scanning",
      },
      supabase,
      id: nextJob.id,
    });
  }

  if (nextJob.unique_matches_processed >= nextJob.target_unique_matches) {
    return completeCollectionJob({
      job: nextJob,
      stopReason: "target-reached",
      status: "completed",
      supabase,
    });
  }

  const usedCandidateIds = await fetchUsedCollectionCandidateIds(supabase, nextJob.id);
  const seedBatchLimit = getAdaptiveRiotCollectionSeedBatchSize({
    maxSeedBatchSize: defaultRiotCollectionSafetyLimits.maxSeedBatchSize,
    seedsUsed: nextJob.seeds_used,
    targetUniqueMatches: nextJob.target_unique_matches,
    uniqueMatchesProcessed: nextJob.unique_matches_processed,
  });
  let selected = await fetchReadyCollectionCandidates({
    focusChampionId: nextJob.focus_champion_id,
    limit: seedBatchLimit,
    rankBracket: nextJob.rank_bracket,
    role: nextJob.role,
    supabase,
    usedCandidateIds,
  });

  if (!selected.ok) {
    return failCollectionJob({
      errorMessage: selected.error,
      job: nextJob,
      supabase,
    });
  }

  if (selected.candidates.length === 0 && nextJob.automatic_seed_discovery) {
    const discovery = await discoverCollectionSeeds({
      focusChampionId: nextJob.focus_champion_id,
      job: nextJob,
      readySeedsBeforeDiscovery: selected.candidates.length,
      targetReadySeeds: seedBatchLimit,
      supabase,
      usedCandidateIds,
    });

    nextJob = discovery.job;

    if (discovery.rateLimited) {
      return completeCollectionJob({
        job: nextJob,
        stopReason: "rate-limited",
        stopDetail: getRiotCollectionDiscoveryStopDetail(discovery.diagnostics),
        status: "paused",
        supabase,
      });
    }

    selected = {
      candidates: discovery.candidates,
      ok: true,
    };

    const selectedDiagnostics = {
      ...discovery.diagnostics,
      eligibility: {
        ...discovery.diagnostics.eligibility,
        candidatesSelectedAsSeeds: selected.candidates.length,
      },
      pipeline: {
        ...discovery.diagnostics.pipeline,
        selectedSeeds: selected.candidates.length,
      },
    } satisfies RiotCollectionDiscoveryDiagnostics;

    const selectedDiagnosticsUpdate = await updateCollectionJob({
      id: nextJob.id,
      patch: {
        summary: getCollectionSummaryPatch(nextJob, { discovery: selectedDiagnostics }),
      },
      supabase,
    });

    nextJob = selectedDiagnosticsUpdate.ok ? selectedDiagnosticsUpdate.job : nextJob;
  }

  if (selected.candidates.length === 0) {
    const discoveryDiagnostics = getLatestCollectionDiscoveryDiagnostics(nextJob);

    return completeCollectionJob({
      job: nextJob,
      stopReason: nextJob.automatic_seed_discovery ? "discovery-exhausted" : "discovery-disabled",
      stopDetail: nextJob.automatic_seed_discovery
        ? getRiotCollectionDiscoveryStopDetail(discoveryDiagnostics)
        : "Automatic seed discovery is disabled.",
      status: nextJob.unique_matches_processed > 0 ? "completed-partial" : "failed",
      supabase,
    });
  }

  await reserveCollectionSeeds({
    candidates: selected.candidates,
    collectionJobId: nextJob.id,
    supabase,
  });

  const scanResult = await startRiotScanJob({
    accessToken,
    collectionJobId: nextJob.id,
    counterChampion: null,
    currentPatchOnly: nextJob.current_patch_only,
    discoveryFocusChampion: nextJob.focus_champion_id,
    enemyChampion: null,
    matchCount: 20,
    maxDisplayedResults: 20,
    minimumGames: 1,
    mode: "discovery",
    role: nextJob.role === "any" ? "mid" : nextJob.role,
    seedPuuids: selected.candidates.map((candidate) => candidate.puuid),
  });

  if (!scanResult.ok) {
    return failCollectionJob({
      errorMessage: scanResult.error,
      job: nextJob,
      supabase,
    });
  }

  await supabase
    .from("riot_collection_job_seeds")
    .update({ source_scan_job_id: scanResult.job.id })
    .eq("collection_job_id", nextJob.id)
    .in(
      "candidate_id",
      selected.candidates.map((candidate) => candidate.id),
    );

  return updateCollectionJob({
    id: nextJob.id,
    patch: {
      progress: getCollectionProgressPatch(nextJob, {
        activeScanJobId: scanResult.job.id,
        lastMessage: `Started child scan ${scanResult.job.id}.`,
      }),
      scan_batches_started: nextJob.scan_batches_started + 1,
      seeds_used: nextJob.seeds_used + selected.candidates.length,
      status: "scanning",
    },
    supabase,
  });
}

async function reconcileCompletedCollectionScans({
  job,
  supabase,
}: {
  job: RiotCollectionJobView;
  supabase: SupabaseClient;
}): Promise<RiotCollectionJobResult> {
  const { data, error } = await supabase
    .from("riot_scan_jobs")
    .select(riotScanJobSelect)
    .eq("collection_job_id", job.id)
    .in("status", ["completed", "failed"])
    .order("created_at", { ascending: true })
    .returns<RiotScanJobRow[]>();

  if (error) {
    return {
      error: "Collection child scans could not be reconciled.",
      ok: false,
    };
  }

  let nextJob = job;

  for (const scanJob of data ?? []) {
    if (scanJob.status === "failed") {
      if (nextJob.status === "paused") {
        continue;
      }

      if (hasRiotApiAuthenticationFailure(scanJob)) {
        const failure = scanJob.progress?.riotApiFailure;
        const stopDetail =
          failure?.message ??
          scanJob.error_message ??
          "Riot API authentication failed. Update the configured key before resuming.";

        return completeCollectionJob({
          job: nextJob,
          stopDetail: `${stopDetail} Aggregation was skipped because the child scan did not complete.`,
          stopReason: "riot-api-authentication-failed",
          status: "failed",
          supabase,
        });
      }

      return completeCollectionJob({
        job: nextJob,
        stopReason: "aggregation-failed",
        status: nextJob.unique_matches_processed > 0 ? "completed-partial" : "failed",
        supabase,
      });
    }

    const childResult = await reconcileCompletedCollectionChild({
      job: nextJob,
      scanJob,
      supabase,
    });

    if (!childResult.ok) {
      return childResult;
    }

    nextJob = childResult.job;
  }

  return {
    job: nextJob,
    ok: true,
  };
}

async function reconcileCompletedCollectionChild({
  job,
  scanJob,
  supabase,
}: {
  job: RiotCollectionJobView;
  scanJob: RiotScanJobRow;
  supabase: SupabaseClient;
}): Promise<RiotCollectionJobResult> {
  if (scanJob.status !== "completed") {
    return {
      job,
      ok: true,
    };
  }

  console.info("Reconciling completed Riot collection child", {
    childStatus: scanJob.status,
    collectionJobId: job.id,
    scanJobId: scanJob.id,
  });

  await recordCollectionMatchesForScan({
    collectionJob: job,
    scanJob,
    supabase,
  });

  const consumedNow = await claimCollectionChildConsumption({
    collectionJobId: job.id,
    scanJobId: scanJob.id,
    supabase,
  });
  const totals = await calculateCollectionConsumedTotals({
    fallbackUniqueMatches: job.unique_matches_processed,
    job,
    supabase,
  });
  const status: RiotCollectionStatus = job.status === "paused" ? "paused" : "selecting-seeds";
  const nextAction =
    status === "paused"
      ? "paused"
      : totals.uniqueMatchesProcessed >= job.target_unique_matches
        ? "target-reached"
        : "select-next-batch";
  const updated = await updateCollectionJob({
    id: job.id,
    patch: {
      duplicate_match_ids: totals.duplicateMatchIds,
      new_matchup_observations: totals.newMatchupObservations,
      progress: getCollectionProgressPatch(job, {
        activeScanJobId: null,
        activeScanProgress: null,
        activeScanProgressAt: null,
        lastMessage:
          status === "paused"
            ? `${totals.uniqueMatchesProcessed}/${job.target_unique_matches} confirmed unique matches. Collection remains paused.`
            : `${totals.uniqueMatchesProcessed}/${job.target_unique_matches} confirmed unique matches after child scan ${scanJob.id}.`,
      }),
      scan_batches_completed: totals.consumedChildScans,
      stat_rows_updated: totals.statRowsUpdated,
      status,
      unique_matches_processed: totals.uniqueMatchesProcessed,
    },
    supabase,
  });

  if (!updated.ok) {
    return updated;
  }

  console.info("Riot collection child reconciled", {
    collectionJobId: job.id,
    collectionUniqueMatches: totals.uniqueMatchesProcessed,
    consumedNow,
    nextAction,
    observationsInserted: totals.newMatchupObservations,
    scanJobId: scanJob.id,
    statRowsUpdated: totals.statRowsUpdated,
  });

  return updated;
}

async function claimCollectionChildConsumption({
  collectionJobId,
  scanJobId,
  supabase,
}: {
  collectionJobId: number;
  scanJobId: number;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from("riot_scan_jobs")
    .update({
      collection_result_consumed_at: new Date().toISOString(),
    })
    .eq("id", scanJobId)
    .eq("collection_job_id", collectionJobId)
    .eq("status", "completed")
    .is("collection_result_consumed_at", null)
    .select("id")
    .maybeSingle<{ id: number }>();

  if (error) {
    console.warn("Riot collection child consumption claim failed", {
      collectionJobId,
      error: getSafeDatabaseError(error),
      scanJobId,
    });
  }

  return Boolean(data);
}

async function calculateCollectionConsumedTotals({
  fallbackUniqueMatches,
  job,
  supabase,
}: {
  fallbackUniqueMatches: number;
  job: RiotCollectionJobView;
  supabase: SupabaseClient;
}) {
  const { data: scanRows } = await supabase
    .from("riot_scan_jobs")
    .select("id, summary")
    .eq("collection_job_id", job.id)
    .eq("status", "completed")
    .not("collection_result_consumed_at", "is", null)
    .returns<Array<{ id: number; summary: RiotScanSummary | null }>>();
  const consumedRows = scanRows ?? [];
  const consumedScanIds = consumedRows.map((row) => row.id);
  const totals = consumedRows.reduce(
    (result, row) => {
      const summary = normalizeCollectionScanSummary(row.summary);

      return {
        duplicateMatchIds: result.duplicateMatchIds + summary.duplicates,
        newMatchupObservations: result.newMatchupObservations + summary.newObservations,
        statRowsUpdated: result.statRowsUpdated + summary.statRowsUpdated,
      };
    },
    {
      duplicateMatchIds: 0,
      newMatchupObservations: 0,
      statRowsUpdated: 0,
    },
  );
  const { count } = await supabase
    .from("riot_collection_job_matches")
    .select("*", { count: "exact", head: true })
    .eq("collection_job_id", job.id)
    .eq("counted_toward_target", true);
  const uniqueMatchesProcessed = count ?? fallbackUniqueMatches;
  let validObservationRows = uniqueMatchesProcessed;

  if (consumedScanIds.length > 0) {
    let observationQuery = supabase
      .from("riot_matchup_observations")
      .select("*", { count: "exact", head: true })
      .in("scan_job_id", consumedScanIds);

    if (job.role !== "any") {
      observationQuery = observationQuery.eq("role", job.role);
    }

    if (job.focus_champion_id) {
      observationQuery = observationQuery.or(
        `champion_a.eq.${job.focus_champion_id},champion_b.eq.${job.focus_champion_id}`,
      );
    }

    const { count: observationCount } = await observationQuery;
    validObservationRows = observationCount ?? validObservationRows;
  }

  return {
    ...totals,
    consumedChildScans: consumedRows.length,
    duplicateMatchIds:
      totals.duplicateMatchIds + Math.max(validObservationRows - uniqueMatchesProcessed, 0),
    uniqueMatchesProcessed,
  };
}

async function fetchReadyCollectionCandidates({
  focusChampionId,
  limit,
  rankBracket,
  role,
  supabase,
  usedCandidateIds,
}: {
  focusChampionId: string | null;
  limit: number;
  rankBracket: RiotCollectionRankBracket;
  role: RiotCollectionRole;
  supabase: SupabaseClient;
  usedCandidateIds: Set<string>;
}): Promise<
  | {
      candidates: RiotCollectionSeedCandidateRow[];
      ok: true;
    }
  | {
      error: string;
      ok: false;
    }
> {
  const { data, error } = await buildRiotSeedCandidateQuery({
    filters: {
      lifecycleState: "ready-to-scan",
      platformRegion: defaultPlatformRegion,
    },
    rankGroup: rankBracket,
    supabase,
  })
    .order("observed_games", { ascending: false })
    .limit(200)
    .returns<RiotCollectionSeedCandidateRow[]>();

  if (error) {
    return {
      error: "Ready seed candidates could not be loaded.",
      ok: false,
    };
  }

  const candidates = (data ?? [])
    .map(hydrateSeedCandidateLifecycle)
    .filter((candidate) => candidate.lifecycle.isSelectableForScan)
    .filter((candidate) => !usedCandidateIds.has(candidate.id))
    .sort((left, right) =>
      compareCollectionSeedCandidates(left, right, {
        focusChampionId,
        role,
      }),
    )
    .slice(0, limit) as RiotCollectionSeedCandidateRow[];

  return {
    candidates,
    ok: true,
  };
}

async function fetchReadyCollectionCandidatesFromIds({
  candidateIds,
  focusChampionId,
  limit,
  rankBracket,
  role,
  supabase,
  usedCandidateIds,
}: {
  candidateIds: string[];
  focusChampionId: string | null;
  limit: number;
  rankBracket: RiotCollectionRankBracket;
  role: RiotCollectionRole;
  supabase: SupabaseClient;
  usedCandidateIds: Set<string>;
}): Promise<
  | {
      candidates: RiotCollectionSeedCandidateRow[];
      ok: true;
    }
  | {
      error: string;
      ok: false;
    }
> {
  const result = await fetchSeedCandidatesByIds({ candidateIds, supabase });

  if (!result.ok) {
    return {
      error: "Discovered seed candidates could not be loaded for selection.",
      ok: false,
    };
  }

  const candidates = result.candidates
    .map(hydrateSeedCandidateLifecycle)
    .filter((candidate) => isCandidateEligibleForCollectionJob({ candidate, rankBracket }))
    .filter((candidate) => !usedCandidateIds.has(candidate.id))
    .sort((left, right) =>
      compareCollectionSeedCandidates(left, right, {
        focusChampionId,
        role,
      }),
    )
    .slice(0, limit) as RiotCollectionSeedCandidateRow[];

  return {
    candidates,
    ok: true,
  };
}

async function discoverCollectionSeeds({
  focusChampionId,
  job,
  readySeedsBeforeDiscovery,
  targetReadySeeds,
  supabase,
  usedCandidateIds,
}: {
  focusChampionId: string | null;
  job: RiotCollectionJobView;
  readySeedsBeforeDiscovery: number;
  targetReadySeeds: number;
  supabase: SupabaseClient;
  usedCandidateIds: Set<string>;
}) {
  const diagnostics = createEmptyRiotCollectionDiscoveryDiagnostics({
    collectionJobId: job.id,
    event: "ladder-discovery-started",
    rankBracket: job.rank_bracket,
    readySeedsBeforeDiscovery,
    remainingTargetMatches: Math.max(job.target_unique_matches - job.unique_matches_processed, 0),
    role: job.role,
  });
  const previousDiagnostics = getLatestCollectionDiscoveryDiagnostics(job);
  const selectedCandidates: RiotCollectionSeedCandidateRow[] = [];
  const selectedCandidateIds = new Set<string>();
  const evaluatedCandidateIds = new Set(previousDiagnostics?.progress?.evaluatedCandidateIds ?? []);
  const exhaustedSourceKeys = new Set(previousDiagnostics?.progress?.exhaustedSourceKeys ?? []);
  const seenEncryptedSummonerIds = new Set<string>();
  const seenPuuids = new Set<string>();
  let nextJob = job;
  let noProgressIterations = 0;

  hydrateDiscoveryProgressFromPreviousRun({
    diagnostics,
    previousDiagnostics,
    targetReadySeeds,
  });

  await updateCollectionJob({
    id: job.id,
    patch: {
      progress: getCollectionProgressPatch(job, {
        lastMessage: "Discovering ranked ladder seeds.",
      }),
      summary: getCollectionSummaryPatch(job, { discovery: diagnostics }),
      status: "discovering-seeds",
    },
    supabase,
  });

  if (!process.env.RIOT_API_KEY) {
    addDiscoveryReasonCode(diagnostics, "missing-riot-api-key");

    const updated = await updateCollectionJob({
      id: job.id,
      patch: {
        progress: getCollectionProgressPatch(job, {
          lastMessage: "Ladder discovery skipped because Riot API configuration is missing.",
        }),
        summary: getCollectionSummaryPatch(job, { discovery: diagnostics }),
        warning_count: job.warning_count + 1,
      },
      supabase,
    });

    return {
      candidates: selectedCandidates,
      diagnostics,
      job: updated.ok ? updated.job : job,
      rateLimited: false,
    };
  }

  const { RiotApiClient } = await import("@/scripts/lib/riot-api-client.mjs");
  const { normalizeRankEntry } = await import("@/scripts/lib/riot-seed-rank-enrichment.mjs");
  const riot = new RiotApiClient({
    apiKey: process.env.RIOT_API_KEY,
    rateLimitContext: {
      collectionJobId: job.id,
      onWait: async (rateLimitState: RiotRateLimitWaitState) => {
        await updateCollectionRateLimitProgress({
          job,
          rateLimitState,
          supabase,
        });
      },
      shouldContinue: async () =>
        assertCollectionJobAllowsRiotRequest({
          collectionJobId: job.id,
          supabase,
        }),
    },
    regionalRoute: job.regional_route,
    requestDelayMs: Number(process.env.RIOT_REQUEST_DELAY_MS ?? 1200),
  });
  const sources: readonly RiotCollectionLadderSource[] =
    riotCollectionLadderSourcesByBracket[job.rank_bracket];

  if (sources.length === 0) {
    addDiscoveryReasonCode(diagnostics, "no-ladder-sources");
  }

  const previousReadySeedIds = previousDiagnostics?.progress?.readySeedIds ?? [];

  if (previousReadySeedIds.length > 0) {
    const previousReadySeeds = await fetchReadyCollectionCandidatesFromIds({
      candidateIds: previousReadySeedIds,
      focusChampionId,
      limit: targetReadySeeds,
      rankBracket: job.rank_bracket,
      role: job.role,
      supabase,
      usedCandidateIds,
    });

    if (previousReadySeeds.ok) {
      for (const candidate of previousReadySeeds.candidates) {
        selectedCandidateIds.add(candidate.id);
        selectedCandidates.push(candidate);
      }
    }
  }

  diagnostics.progress.readySeedIds = Array.from(selectedCandidateIds);
  diagnostics.progress.readySeedsFound = selectedCandidates.length;
  diagnostics.progress.remainingSeedsNeeded = Math.max(targetReadySeeds - selectedCandidates.length, 0);
  diagnostics.progress.selectedSeedIds = Array.from(selectedCandidateIds);

  const discoveryTasks = getRiotCollectionLadderDiscoveryTasks(sources);
  let taskIndex = Math.min(
    Math.max(previousDiagnostics?.progress?.currentSourceIndex ?? 0, 0),
    Math.max(discoveryTasks.length - 1, 0),
  );

  while (discoveryTasks.length > 0) {
    const continuation = shouldContinueRiotCollectionSeedDiscovery({
      apiRequestCount: diagnostics.api.requestCount,
      maxApiRequests: defaultRiotCollectionSafetyLimits.maxIdentifierLookupsPerJob,
      maxCandidatesInspected:
        defaultRiotCollectionSafetyLimits.maxCandidatesInspectedPerDiscovery,
      maxNoProgressIterations:
        defaultRiotCollectionSafetyLimits.maxNoProgressDiscoveryIterations,
      maxPages: defaultRiotCollectionSafetyLimits.maxLadderPagesPerJob,
      noProgressIterations,
      pagesFetched: diagnostics.pagesFetched,
      rateLimited: diagnostics.api.rateLimited,
      readySeedsFound: selectedCandidates.length,
      sourcesExhausted: exhaustedSourceKeys.size >= discoveryTasks.length,
      targetReadySeeds,
      uniqueCandidatesInspected: evaluatedCandidateIds.size,
    });

    if (!continuation.shouldContinue) {
      diagnostics.progress.stopReason = continuation.stopReason;
      break;
    }

    const nextTask = getNextDiscoveryTask({
      exhaustedSourceKeys,
      startIndex: taskIndex,
      tasks: discoveryTasks,
    });

    if (!nextTask) {
      diagnostics.progress.stopReason = "discovery-sources-exhausted";
      break;
    }

    const { index, task } = nextTask;
    taskIndex = (index + 1) % discoveryTasks.length;
    diagnostics.sourcesAttempted += 1;
    diagnostics.progress.currentSource = task.label;
    diagnostics.progress.currentSourceIndex = taskIndex;

    const cursor = await getOrCreateLadderCursor({
      division: task.division,
      job,
      tier: task.tier,
      supabase,
    });
    const page = cursor.next_page;
    diagnostics.progress.currentPage = page;
    let entries: unknown[] = [];

    try {
      if (task.route === "tier-division") {
        const tierDivisionEntries = await riot.fetchLeagueEntriesByTierDivision({
          division: task.division,
          page,
          platformRegion: job.platform,
          queue: job.queue_type,
          tier: task.tier,
        });
        entries = Array.isArray(tierDivisionEntries) ? tierDivisionEntries : [];

        if (!Array.isArray(tierDivisionEntries)) {
          diagnostics.api.failures += 1;
          addDiscoveryReasonCode(diagnostics, "api-failure");
        }
      } else {
        const highTierLeague = await riot.fetchHighTierLeagueEntries({
          platformRegion: job.platform,
          queue: job.queue_type,
          tier: task.tier,
        });
        entries = Array.isArray(highTierLeague?.entries) ? highTierLeague.entries : [];

        if (!Array.isArray(highTierLeague?.entries)) {
          diagnostics.api.failures += 1;
          addDiscoveryReasonCode(diagnostics, "api-failure");
        }
      }
      diagnostics.api.requestCount += 1;
      diagnostics.pagesFetched += 1;
    } catch (error) {
      diagnostics.api.failures += 1;

      if (Number((error as { status?: number }).status ?? 0) === 429) {
        diagnostics.api.rateLimited = true;
        diagnostics.progress.stopReason = "rate-limited";
        addDiscoveryReasonCode(diagnostics, "rate-limited");
        await updateLadderCursorFailure({
          cursorId: cursor.id,
          errorCode: "rate_limited",
          supabase,
        });
        break;
      }

      await updateLadderCursorFailure({
        cursorId: cursor.id,
        errorCode: "ladder_fetch_failed",
        supabase,
      });
      addDiscoveryReasonCode(diagnostics, "api-failure");
      continue;
    }

    if (entries.length === 0 || task.route === "high-tier") {
      exhaustedSourceKeys.add(task.key);
      diagnostics.progress.exhaustedSourceKeys = Array.from(exhaustedSourceKeys);
    }

    diagnostics.entriesFetched += entries.length;
    const discoveryResult = await persistDiscoveredLadderEntries({
      diagnostics,
      entries,
      job,
      normalizeRankEntry,
      riot,
      seenEncryptedSummonerIds,
      seenPuuids,
      supabase,
    });

    await updateLadderCursorSuccess({
      candidatesCreated: discoveryResult.created,
      candidatesReused: discoveryResult.reused,
      cursorId: cursor.id,
      entriesReturned: entries.length,
      fetchedPage: page,
      hasStandardPages: task.route === "tier-division",
      supabase,
    });

    const duplicateCandidateIds = discoveryResult.candidateIds.filter((candidateId) =>
      evaluatedCandidateIds.has(candidateId),
    );
    const candidateIdsForEvaluation = Array.from(new Set(discoveryResult.candidateIds)).filter(
      (candidateId) => !evaluatedCandidateIds.has(candidateId),
    );
    const iterationStart = cloneDiscoveryEligibilitySnapshot(diagnostics);
    const readySeedsBeforeIteration = selectedCandidates.length;
    diagnostics.progress.duplicateCandidatesSkipped += duplicateCandidateIds.length;

    if (candidateIdsForEvaluation.length > 0) {
      const lifecycleDiagnostics = await loadDiscoveryLifecycleDiagnostics({
        candidateIds: candidateIdsForEvaluation,
        rankBracket: job.rank_bracket,
        role: job.role,
        supabase,
      });

      mergeDiscoveryLifecycleDiagnostics({ diagnostics, lifecycleDiagnostics });

      for (const candidateId of candidateIdsForEvaluation) {
        evaluatedCandidateIds.add(candidateId);
      }

      const selectionResult = await fetchReadyCollectionCandidatesFromIds({
        candidateIds: candidateIdsForEvaluation,
        focusChampionId,
        limit: Math.max(targetReadySeeds - selectedCandidates.length, 0),
        rankBracket: job.rank_bracket,
        role: job.role,
        supabase,
        usedCandidateIds: new Set([...usedCandidateIds, ...selectedCandidateIds]),
      });

      if (selectionResult.ok) {
        for (const candidate of selectionResult.candidates) {
          if (selectedCandidateIds.has(candidate.id)) {
            continue;
          }

          selectedCandidateIds.add(candidate.id);
          selectedCandidates.push(candidate);
        }
      }
    }

    diagnostics.pipeline.discoveredPuuids = diagnostics.identifiers.resolved;
    diagnostics.pipeline.selectedSeeds = selectedCandidates.length;
    diagnostics.eligibility.candidatesSelectedAsSeeds = selectedCandidates.length;
    diagnostics.progress.evaluatedCandidateIds = Array.from(evaluatedCandidateIds);
    diagnostics.progress.readySeedIds = Array.from(selectedCandidateIds);
    diagnostics.progress.readySeedsFound = selectedCandidates.length;
    diagnostics.progress.remainingSeedsNeeded = Math.max(
      targetReadySeeds - selectedCandidates.length,
      0,
    );
    diagnostics.progress.selectedSeedIds = Array.from(selectedCandidateIds);
    diagnostics.progress.uniqueCandidatesInspected = evaluatedCandidateIds.size;
    noProgressIterations = candidateIdsForEvaluation.length === 0 ? noProgressIterations + 1 : 0;

    diagnostics.progress.iterations.push({
      candidatesEvaluated:
        diagnostics.eligibility.candidatesEvaluated - iterationStart.candidatesEvaluated,
      duplicateCandidatesSkipped: duplicateCandidateIds.length,
      duplicatePuuidsSkipped: discoveryResult.duplicatesSkipped,
      entriesReturned: entries.length,
      iteration: diagnostics.progress.iterations.length + 1,
      newCandidates: discoveryResult.created,
      page,
      readySeedsFound: selectedCandidates.length - readySeedsBeforeIteration,
      rejectedRecentlyScanned:
        (diagnostics.eligibility.hardRejections["recently-scanned"] ?? 0) -
        (iterationStart.hardRejections["recently-scanned"] ?? 0),
      rejectedTooFewObservations:
        (diagnostics.eligibility.hardRejections["too-few-observations"] ?? 0) -
        (iterationStart.hardRejections["too-few-observations"] ?? 0),
      remainingSeedsNeeded: diagnostics.progress.remainingSeedsNeeded,
      reusedCandidates: discoveryResult.reused,
      source: task.label,
      uniqueCandidatesFound: candidateIdsForEvaluation.length,
      uniquePuuidsFound: discoveryResult.uniquePuuidsFound,
    });

    console.info("Seed discovery iteration complete", {
      candidatesEvaluated: candidateIdsForEvaluation.length,
      collectionJobId: job.id,
      duplicateCandidatesSkipped: duplicateCandidateIds.length,
      duplicatePuuidsSkipped: discoveryResult.duplicatesSkipped,
      entriesReturned: entries.length,
      iteration: diagnostics.progress.iterations.length,
      page,
      readySeedsFound: selectedCandidates.length - readySeedsBeforeIteration,
      remainingSeedsNeeded: diagnostics.progress.remainingSeedsNeeded,
      source: task.label,
      targetReadySeeds,
    });

    const progressUpdate = await updateCollectionJob({
      id: nextJob.id,
      patch: {
        progress: getCollectionProgressPatch(nextJob, {
          lastMessage: `Discovery found ${selectedCandidates.length}/${targetReadySeeds} ready seeds after ${diagnostics.progress.iterations.length} iterations.`,
        }),
        summary: getCollectionSummaryPatch(nextJob, { discovery: diagnostics }),
      },
      supabase,
    });

    if (progressUpdate.ok) {
      nextJob = progressUpdate.job;
    }
  }

  if (!diagnostics.progress.stopReason) {
    diagnostics.progress.stopReason =
      selectedCandidates.length >= targetReadySeeds
        ? "target-ready-seeds-reached"
        : "discovery-sources-exhausted";
  }

  addDiscoveryOutcomeReasonCodes(diagnostics);
  addDiscoveryReasonCode(diagnostics, diagnostics.progress.stopReason);
  console.info("Seed discovery complete", {
    candidateRowsFetchedAfterEnrichment: diagnostics.pipeline.candidateRowsFetchedAfterEnrichment,
    candidatesCreated: diagnostics.candidates.created,
    candidatesEnriched: diagnostics.candidates.enriched,
    candidatesEvaluated: diagnostics.eligibility.candidatesEvaluated,
    candidatesRejected: diagnostics.eligibility.candidatesRejected,
    candidatesReused: diagnostics.candidates.reused,
    collectionJobId: job.id,
    directPuuids: diagnostics.identifiers.directPuuids,
    discoveredPuuids: diagnostics.identifiers.resolved,
    eligibleCandidates: diagnostics.lifecycle.eligibleSeedsProduced,
    entriesReturned: diagnostics.entriesFetched,
    invariantErrors: diagnostics.pipeline.invariantErrors,
    iterations: diagnostics.progress.iterations.length,
    qualificationInput: diagnostics.pipeline.qualificationInput,
    rankSnapshotsStored: diagnostics.candidates.rankSnapshotsInserted,
    readySeedsFound: selectedCandidates.length,
    rejectionSummary: diagnostics.eligibility.hardRejections,
    role: job.role,
    selectedSeeds: diagnostics.pipeline.selectedSeeds,
    stopReason: diagnostics.progress.stopReason,
    targetReadySeeds,
    warningSummary: diagnostics.eligibility.warnings,
  });

  const updated = await updateCollectionJob({
    id: nextJob.id,
    patch: {
      api_requests_used: nextJob.api_requests_used + diagnostics.api.requestCount,
      progress: getCollectionProgressPatch(nextJob, {
        lastMessage: diagnostics.api.rateLimited
          ? "Ladder discovery paused because Riot rate limits were reached."
          : `Ladder discovery found ${selectedCandidates.length}/${targetReadySeeds} ready seeds.`,
      }),
      seeds_discovered: nextJob.seeds_discovered + selectedCandidates.length,
      status: "selecting-seeds",
      summary: getCollectionSummaryPatch(nextJob, { discovery: diagnostics }),
      warning_count:
        nextJob.warning_count + (selectedCandidates.length === 0 ? 1 : 0),
    },
    supabase,
  });

  return {
    candidates: selectedCandidates,
    diagnostics,
    job: updated.ok ? updated.job : nextJob,
    rateLimited: diagnostics.api.rateLimited,
  };
}

type RiotCollectionLadderDiscoveryTask = {
  division: string;
  key: string;
  label: string;
  route: RiotCollectionLadderSource["route"];
  tier: RiotCollectionLadderSource["tier"];
};

function getRiotCollectionLadderDiscoveryTasks(
  sources: readonly RiotCollectionLadderSource[],
): RiotCollectionLadderDiscoveryTask[] {
  const tasks: RiotCollectionLadderDiscoveryTask[] = [];

  for (const source of sources) {
    if (source.route === "tier-division") {
      for (const division of source.divisions) {
        tasks.push({
          division,
          key: `${source.tier}:${division}`,
          label: `${source.tier} ${division}`,
          route: source.route,
          tier: source.tier,
        });
      }

      continue;
    }

    tasks.push({
      division: "",
      key: source.tier,
      label: source.tier,
      route: source.route,
      tier: source.tier,
    });
  }

  return tasks;
}

function getNextDiscoveryTask({
  exhaustedSourceKeys,
  startIndex,
  tasks,
}: {
  exhaustedSourceKeys: Set<string>;
  startIndex: number;
  tasks: RiotCollectionLadderDiscoveryTask[];
}) {
  for (let offset = 0; offset < tasks.length; offset += 1) {
    const index = (startIndex + offset) % tasks.length;
    const task = tasks[index];

    if (!exhaustedSourceKeys.has(task.key)) {
      return { index, task };
    }
  }

  return null;
}

function hydrateDiscoveryProgressFromPreviousRun({
  diagnostics,
  previousDiagnostics,
  targetReadySeeds,
}: {
  diagnostics: RiotCollectionDiscoveryDiagnostics;
  previousDiagnostics: RiotCollectionDiscoveryDiagnostics | null;
  targetReadySeeds: number;
}) {
  diagnostics.progress.targetReadySeeds = targetReadySeeds;
  diagnostics.progress.remainingSeedsNeeded = targetReadySeeds;

  if (!previousDiagnostics?.progress) {
    return;
  }

  diagnostics.candidateIds = [...(previousDiagnostics.candidateIds ?? [])];
  diagnostics.candidates = { ...diagnostics.candidates, ...previousDiagnostics.candidates };
  diagnostics.entriesFetched = previousDiagnostics.entriesFetched ?? 0;
  diagnostics.identifiers = { ...diagnostics.identifiers, ...previousDiagnostics.identifiers };
  diagnostics.lifecycle = { ...diagnostics.lifecycle, ...previousDiagnostics.lifecycle };
  diagnostics.eligibility = {
    ...diagnostics.eligibility,
    ...previousDiagnostics.eligibility,
    hardRejections: { ...(previousDiagnostics.eligibility?.hardRejections ?? {}) },
    rejectionSamples: [...(previousDiagnostics.eligibility?.rejectionSamples ?? [])],
    warnings: { ...(previousDiagnostics.eligibility?.warnings ?? {}) },
  };
  diagnostics.pagesFetched = previousDiagnostics.pagesFetched ?? 0;
  diagnostics.pipeline = {
    ...diagnostics.pipeline,
    ...previousDiagnostics.pipeline,
    invariantErrors: [...(previousDiagnostics.pipeline?.invariantErrors ?? [])],
  };
  diagnostics.progress = {
    ...diagnostics.progress,
    ...previousDiagnostics.progress,
    currentPage: previousDiagnostics.progress.currentPage ?? null,
    currentSource: previousDiagnostics.progress.currentSource ?? null,
    duplicateCandidatesSkipped: previousDiagnostics.progress.duplicateCandidatesSkipped ?? 0,
    duplicatePuuidsSkipped: previousDiagnostics.progress.duplicatePuuidsSkipped ?? 0,
    evaluatedCandidateIds: [...(previousDiagnostics.progress.evaluatedCandidateIds ?? [])],
    exhaustedSourceKeys: [...(previousDiagnostics.progress.exhaustedSourceKeys ?? [])],
    iterations: [...(previousDiagnostics.progress.iterations ?? [])],
    readySeedIds: [...(previousDiagnostics.progress.readySeedIds ?? [])],
    readySeedsFound: 0,
    remainingSeedsNeeded: targetReadySeeds,
    selectedSeedIds: [],
    stopReason: null,
    targetReadySeeds,
  };
  diagnostics.reasonCodes = [];
  diagnostics.sourcesAttempted = previousDiagnostics.sourcesAttempted ?? 0;
}

function cloneDiscoveryEligibilitySnapshot(diagnostics: RiotCollectionDiscoveryDiagnostics) {
  return {
    candidatesEvaluated: diagnostics.eligibility.candidatesEvaluated,
    hardRejections: { ...diagnostics.eligibility.hardRejections },
  };
}

function mergeDiscoveryLifecycleDiagnostics({
  diagnostics,
  lifecycleDiagnostics,
}: {
  diagnostics: RiotCollectionDiscoveryDiagnostics;
  lifecycleDiagnostics: Pick<
    RiotCollectionDiscoveryDiagnostics,
    "eligibility" | "lifecycle" | "pipeline"
  >;
}) {
  for (const [state, count] of Object.entries(lifecycleDiagnostics.lifecycle)) {
    diagnostics.lifecycle[state as keyof typeof diagnostics.lifecycle] =
      (diagnostics.lifecycle[state as keyof typeof diagnostics.lifecycle] ?? 0) + count;
  }

  diagnostics.eligibility.candidatesEvaluated +=
    lifecycleDiagnostics.eligibility.candidatesEvaluated;
  diagnostics.eligibility.candidatesRejected +=
    lifecycleDiagnostics.eligibility.candidatesRejected;

  for (const [reason, count] of Object.entries(lifecycleDiagnostics.eligibility.hardRejections)) {
    diagnostics.eligibility.hardRejections[reason] =
      (diagnostics.eligibility.hardRejections[reason] ?? 0) + count;
  }

  for (const [warning, count] of Object.entries(lifecycleDiagnostics.eligibility.warnings)) {
    diagnostics.eligibility.warnings[warning] =
      (diagnostics.eligibility.warnings[warning] ?? 0) + count;
  }

  diagnostics.eligibility.rejectionSamples.push(
    ...lifecycleDiagnostics.eligibility.rejectionSamples.slice(
      0,
      Math.max(8 - diagnostics.eligibility.rejectionSamples.length, 0),
    ),
  );
  diagnostics.pipeline.candidateRowsFetchedAfterEnrichment +=
    lifecycleDiagnostics.pipeline.candidateRowsFetchedAfterEnrichment;
  diagnostics.pipeline.discoveredPuuids = diagnostics.identifiers.resolved;
  diagnostics.pipeline.eligibilityResults += lifecycleDiagnostics.pipeline.eligibilityResults;
  diagnostics.pipeline.eligibleCandidates = diagnostics.lifecycle.eligibleSeedsProduced;
  diagnostics.pipeline.enrichedCandidateIds += lifecycleDiagnostics.pipeline.enrichedCandidateIds;
  diagnostics.pipeline.persistedCandidateIds += lifecycleDiagnostics.pipeline.persistedCandidateIds;
  diagnostics.pipeline.qualificationInput += lifecycleDiagnostics.pipeline.qualificationInput;
  diagnostics.pipeline.rejectedCandidates = diagnostics.eligibility.candidatesRejected;
  diagnostics.pipeline.invariantErrors = Array.from(
    new Set([
      ...diagnostics.pipeline.invariantErrors,
      ...lifecycleDiagnostics.pipeline.invariantErrors,
    ]),
  );
}

function addDiscoveryReasonCode(
  diagnostics: RiotCollectionDiscoveryDiagnostics,
  reasonCode: string,
) {
  if (!diagnostics.reasonCodes.includes(reasonCode)) {
    diagnostics.reasonCodes.push(reasonCode);
  }
}

function addDiscoveryOutcomeReasonCodes(diagnostics: RiotCollectionDiscoveryDiagnostics) {
  if (diagnostics.entriesFetched === 0) {
    addDiscoveryReasonCode(diagnostics, "no-ladder-entries");
  }

  if (diagnostics.entriesFetched > 0 && diagnostics.identifiers.resolved === 0) {
    addDiscoveryReasonCode(diagnostics, "identifier-resolution-failed");
  }

  if (
    diagnostics.identifiers.resolved > 0 &&
    diagnostics.candidates.created + diagnostics.candidates.reused === 0
  ) {
    addDiscoveryReasonCode(diagnostics, "persistence-failed");
  }

  if (
    diagnostics.candidates.created + diagnostics.candidates.reused > 0 &&
    diagnostics.lifecycle.eligibleSeedsProduced === 0
  ) {
    addDiscoveryReasonCode(diagnostics, "no-eligible-seeds");

    if (diagnostics.pipeline.candidateRowsFetchedAfterEnrichment === 0) {
      addDiscoveryReasonCode(diagnostics, "no-candidates-after-enrichment-refetch");
    }

    if (diagnostics.pipeline.qualificationInput === 0) {
      addDiscoveryReasonCode(diagnostics, "no-qualification-input");
    }

    if (
      diagnostics.eligibility.candidatesEvaluated > 0 &&
      diagnostics.eligibility.candidatesRejected === diagnostics.eligibility.candidatesEvaluated
    ) {
      addDiscoveryReasonCode(diagnostics, "all-candidates-rejected");
    }
  }

  if (diagnostics.lifecycle.eligibleSeedsProduced > 0) {
    addDiscoveryReasonCode(diagnostics, "eligible-candidates-selected");
  }
}

async function loadDiscoveryLifecycleDiagnostics({
  candidateIds,
  rankBracket,
  role,
  supabase,
}: {
  candidateIds: string[];
  rankBracket: RiotCollectionRankBracket;
  role: RiotCollectionRole;
  supabase: SupabaseClient;
}): Promise<Pick<RiotCollectionDiscoveryDiagnostics, "eligibility" | "lifecycle" | "pipeline">> {
  const diagnostics = createEmptyRiotCollectionDiscoveryDiagnostics();
  const lifecycle = diagnostics.lifecycle;
  const eligibility = diagnostics.eligibility;
  const pipeline = diagnostics.pipeline;
  const uniqueCandidateIds = Array.from(new Set(candidateIds));

  pipeline.persistedCandidateIds = uniqueCandidateIds.length;
  pipeline.enrichedCandidateIds = uniqueCandidateIds.length;

  if (uniqueCandidateIds.length === 0) {
    return {
      eligibility,
      lifecycle,
      pipeline,
    };
  }

  const fetchResult = await fetchSeedCandidatesByIds({
    candidateIds: uniqueCandidateIds,
    supabase,
  });

  if (!fetchResult.ok) {
    pipeline.invariantErrors.push("candidate-refetch-failed");

    return {
      eligibility,
      lifecycle,
      pipeline,
    };
  }

  pipeline.candidateRowsFetchedAfterEnrichment = fetchResult.candidates.length;
  pipeline.qualificationInput = fetchResult.candidates.length;

  for (const candidate of fetchResult.candidates.map(hydrateSeedCandidateLifecycle)) {
    eligibility.candidatesEvaluated += 1;
    lifecycle[candidate.lifecycle.state] += 1;
    const isEligibleForCollectionJob = addCandidateEligibilityDiagnostics({
      candidate,
      eligibility,
      rankBracket,
      role,
    });

    if (isEligibleForCollectionJob) {
      lifecycle.eligibleSeedsProduced += 1;
    } else {
      eligibility.candidatesRejected += 1;
    }
  }

  pipeline.eligibilityResults = eligibility.candidatesEvaluated;
  pipeline.eligibleCandidates = lifecycle.eligibleSeedsProduced;
  pipeline.rejectedCandidates = eligibility.candidatesRejected;
  validateDiscoveryPipelineInvariants({ eligibility, lifecycle, pipeline });

  return {
    eligibility,
    lifecycle,
    pipeline,
  };
}

function addCandidateEligibilityDiagnostics({
  candidate,
  eligibility,
  rankBracket,
  role,
}: {
  candidate: RiotSeedCandidateView;
  eligibility: RiotCollectionDiscoveryDiagnostics["eligibility"];
  rankBracket: RiotCollectionRankBracket;
  role: RiotCollectionRole;
}): boolean {
  const hardReasons = new Set<string>();
  const warnings = new Set<string>();

  for (const reasonCode of candidate.lifecycle.reasonCodes) {
    if (reasonCode === "ready") {
      continue;
    }

    if (reasonCode === "too-few-observations" && candidate.lifecycle.isSelectableForScan) {
      warnings.add("missing-observation-data");
      continue;
    }

    hardReasons.add(reasonCode);
  }

  if (candidate.lifecycle.rankBracket !== rankBracket) {
    hardReasons.add(
      candidate.lifecycle.rankBracket === "unknown" ? "missing-rank" : "rank-bracket-mismatch",
    );
  }

  if (role !== "any") {
    if (!candidate.estimated_primary_role) {
      warnings.add("missing-role-observation-data");
    } else if (candidate.estimated_primary_role !== role) {
      warnings.add("primary-role-mismatch");
    }
  }

  if (Number(candidate.observed_games ?? 0) < MIN_SEED_OBSERVATIONS) {
    warnings.add("missing-observation-data");
  }

  for (const reason of hardReasons) {
    eligibility.hardRejections[reason] = (eligibility.hardRejections[reason] ?? 0) + 1;
  }

  for (const warning of warnings) {
    eligibility.warnings[warning] = (eligibility.warnings[warning] ?? 0) + 1;
  }

  const isEligibleForCollectionJob = candidate.lifecycle.isSelectableForScan && hardReasons.size === 0;

  if (!isEligibleForCollectionJob && eligibility.rejectionSamples.length < 8) {
    eligibility.rejectionSamples.push({
      hardReasons: Array.from(hardReasons).sort(),
      id: getSafeCandidateIdPreview(candidate.id),
      rank: formatCandidateRankForDiagnostics(candidate),
      role: candidate.estimated_primary_role ?? "missing",
      warnings: Array.from(warnings).sort(),
    });
  }

  return isEligibleForCollectionJob;
}

async function fetchSeedCandidatesByIds({
  candidateIds,
  supabase,
}: {
  candidateIds: string[];
  supabase: SupabaseClient;
}): Promise<
  | {
      candidates: RiotCollectionSeedCandidateRow[];
      ok: true;
    }
  | {
      error: string;
      ok: false;
    }
> {
  const uniqueCandidateIds = Array.from(new Set(candidateIds));
  const candidates: RiotCollectionSeedCandidateRow[] = [];

  for (let index = 0; index < uniqueCandidateIds.length; index += maxDiscoveryCandidateRefetchChunkSize) {
    const chunk = uniqueCandidateIds.slice(index, index + maxDiscoveryCandidateRefetchChunkSize);
    const { data, error } = await supabase
      .from("riot_seed_candidates")
      .select(riotSeedCandidateSelect)
      .in("id", chunk)
      .returns<RiotCollectionSeedCandidateRow[]>();

    if (error) {
      console.error("Seed qualification candidate refetch failed", getSafeDatabaseError(error));

      return {
        error: error.message,
        ok: false,
      };
    }

    candidates.push(...(data ?? []));
  }

  return {
    candidates,
    ok: true,
  };
}

function isCandidateEligibleForCollectionJob({
  candidate,
  rankBracket,
}: {
  candidate: RiotSeedCandidateView;
  rankBracket: RiotCollectionRankBracket;
}) {
  return candidate.lifecycle.isSelectableForScan && candidate.lifecycle.rankBracket === rankBracket;
}

function validateDiscoveryPipelineInvariants({
  eligibility,
  lifecycle,
  pipeline,
}: Pick<RiotCollectionDiscoveryDiagnostics, "eligibility" | "lifecycle" | "pipeline">) {
  const rejectedPlusReady = eligibility.candidatesRejected + lifecycle.eligibleSeedsProduced;

  if (rejectedPlusReady !== eligibility.candidatesEvaluated) {
    pipeline.invariantErrors.push("rejected-plus-ready-mismatch");
  }

  if (pipeline.selectedSeeds > 0 && lifecycle.eligibleSeedsProduced === 0) {
    pipeline.invariantErrors.push("selected-seeds-with-zero-ready-seeds");
  }

  if (
    eligibility.candidatesEvaluated === 0 &&
    Object.values(eligibility.hardRejections).some((count) => count > 0)
  ) {
    pipeline.invariantErrors.push("rejections-with-zero-evaluated");
  }

  if (eligibility.candidatesRejected > eligibility.candidatesEvaluated) {
    pipeline.invariantErrors.push("rejected-greater-than-evaluated");
  }

  if (lifecycle.eligibleSeedsProduced > eligibility.candidatesEvaluated) {
    pipeline.invariantErrors.push("ready-greater-than-evaluated");
  }

  if (pipeline.enrichedCandidateIds > 0 && pipeline.candidateRowsFetchedAfterEnrichment === 0) {
    pipeline.invariantErrors.push("enriched-candidates-not-refetched");
  }

  if (pipeline.invariantErrors.length > 0) {
    console.error("Seed qualification pipeline invariant failed", {
      candidatesEvaluated: eligibility.candidatesEvaluated,
      candidatesRejected: eligibility.candidatesRejected,
      candidateRowsFetchedAfterEnrichment: pipeline.candidateRowsFetchedAfterEnrichment,
      enrichedCandidateIds: pipeline.enrichedCandidateIds,
      errors: pipeline.invariantErrors,
      readySeeds: lifecycle.eligibleSeedsProduced,
      selectedSeeds: pipeline.selectedSeeds,
    });
  }
}

function getSafeCandidateIdPreview(candidateId: string) {
  return candidateId ? `${candidateId.slice(0, 8)}...` : "unknown";
}

function formatCandidateRankForDiagnostics(candidate: RiotSeedCandidateView) {
  if (candidate.rank_enrichment_status !== "ranked") {
    return candidate.rank_enrichment_status;
  }

  return [candidate.rank_tier, candidate.rank_division].filter(Boolean).join(" ") || "missing";
}

function getLatestCollectionDiscoveryDiagnostics(
  job: RiotCollectionJobView,
): RiotCollectionDiscoveryDiagnostics | null {
  const discovery = job.summary.discovery;

  if (!discovery || typeof discovery !== "object") {
    return null;
  }

  return discovery as RiotCollectionDiscoveryDiagnostics;
}

async function persistDiscoveredLadderEntries({
  diagnostics,
  entries,
  job,
  normalizeRankEntry,
  riot,
  seenEncryptedSummonerIds,
  seenPuuids,
  supabase,
}: {
  diagnostics: RiotCollectionDiscoveryDiagnostics;
  entries: unknown[];
  job: RiotCollectionJobView;
  normalizeRankEntry: (entry: unknown) => {
    division: string | null;
    freshBlood: boolean | null;
    hotStreak: boolean | null;
    inactive: boolean | null;
    leaguePoints: number | null;
    losses: number | null;
    queueType: string;
    tier: string | null;
    veteran: boolean | null;
    winRate: number | null;
    wins: number | null;
  } | null;
  riot: {
    fetchSummonerByEncryptedId: (input: {
      encryptedSummonerId: string;
      platformRegion: string;
    }) => Promise<{ puuid?: string }>;
  };
  seenEncryptedSummonerIds: Set<string>;
  seenPuuids: Set<string>;
  supabase: SupabaseClient;
}) {
  const candidateIds: string[] = [];
  let created = 0;
  let duplicatesSkipped = 0;
  let reused = 0;
  let uniquePuuidsFound = 0;
  const now = new Date().toISOString();

  for (const entry of entries) {
    if (
      diagnostics.candidates.created + diagnostics.candidates.reused >=
        defaultRiotCollectionSafetyLimits.maxNewCandidatesPerJob ||
      diagnostics.api.requestCount >= defaultRiotCollectionSafetyLimits.maxIdentifierLookupsPerJob
    ) {
      break;
    }

    const normalizedEntry =
      entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    const directPuuid = String(normalizedEntry.puuid ?? "").trim();
    const encryptedSummonerId = String(
      normalizedEntry.summonerId ??
        normalizedEntry.encryptedSummonerId ??
        normalizedEntry.encrypted_summoner_id ??
        "",
    ).trim();

    let puuid: string | null = directPuuid || null;

    if (directPuuid && seenPuuids.has(directPuuid)) {
      duplicatesSkipped += 1;
      diagnostics.progress.duplicatePuuidsSkipped += 1;
      continue;
    }

    if (!directPuuid && encryptedSummonerId && seenEncryptedSummonerIds.has(encryptedSummonerId)) {
      duplicatesSkipped += 1;
      diagnostics.progress.duplicatePuuidsSkipped += 1;
      continue;
    }

    if (puuid) {
      diagnostics.identifiers.directPuuids += 1;
      diagnostics.identifiers.resolved += 1;
    } else if (encryptedSummonerId) {
      const cachedPuuid = await getCachedSummonerPuuid({
        encryptedSummonerId,
        platform: job.platform,
        supabase,
      });
      puuid = cachedPuuid;

      if (puuid) {
        diagnostics.identifiers.resolved += 1;
      }
    } else {
      diagnostics.identifiers.missing += 1;
      continue;
    }

    if (!puuid && encryptedSummonerId) {
      try {
        diagnostics.identifiers.lookupsAttempted += 1;
        const summoner = await riot.fetchSummonerByEncryptedId({
          encryptedSummonerId,
          platformRegion: job.platform,
        });
        diagnostics.api.requestCount += 1;
        puuid = String(summoner?.puuid ?? "").trim();
        diagnostics.identifiers.resolved += puuid ? 1 : 0;
        await upsertSummonerPuuidCache({
          encryptedSummonerId,
          platform: job.platform,
          puuid,
          status: puuid ? "resolved" : "not_found",
          supabase,
        });
      } catch (error) {
        diagnostics.api.requestCount += 1;
        diagnostics.identifiers.failed += 1;
        diagnostics.api.failures += 1;
        await upsertSummonerPuuidCache({
          encryptedSummonerId,
          errorCode:
            Number((error as { status?: number }).status ?? 0) === 429
              ? "rate_limited"
              : "lookup_failed",
          platform: job.platform,
          puuid: null,
          status:
            Number((error as { status?: number }).status ?? 0) === 429 ? "rate_limited" : "failed",
          supabase,
        });
        diagnostics.api.rateLimited =
          diagnostics.api.rateLimited || Number((error as { status?: number }).status ?? 0) === 429;

        if (Number((error as { status?: number }).status ?? 0) === 429) {
          addDiscoveryReasonCode(diagnostics, "rate-limited");
        } else {
          addDiscoveryReasonCode(diagnostics, "identifier-resolution-failed");
        }

        continue;
      }
    }

    if (!puuid) {
      diagnostics.identifiers.failed += 1;
      continue;
    }

    if (seenPuuids.has(puuid)) {
      duplicatesSkipped += 1;
      diagnostics.progress.duplicatePuuidsSkipped += 1;
      continue;
    }

    seenPuuids.add(puuid);
    uniquePuuidsFound += 1;

    if (encryptedSummonerId) {
      seenEncryptedSummonerIds.add(encryptedSummonerId);
    }

    const rank = normalizeRankEntry({
      ...normalizedEntry,
      queueType: job.queue_type,
    });
    const hasRank = Boolean(rank?.tier);
    const { data: existingCandidate } = await supabase
      .from("riot_seed_candidates")
      .select("id, observed_games, source")
      .eq("platform_region", job.platform)
      .eq("puuid", puuid)
      .maybeSingle<{ id: string; observed_games: number | null; source: string | null }>();
    const observedGames = Number(existingCandidate?.observed_games ?? 0);
    const { data: savedCandidate, error } = await supabase
      .from("riot_seed_candidates")
      .upsert(
        {
          first_seen_at: now,
          last_seen_at: now,
          observed_games: observedGames,
          platform_region: job.platform,
          puuid,
          rank_division: hasRank ? (rank?.division ?? null) : null,
          rank_enrichment_error_code: null,
          rank_enrichment_error_message: null,
          rank_enrichment_status: hasRank ? "ranked" : "unranked",
          rank_fresh_blood: hasRank ? (rank?.freshBlood ?? null) : null,
          rank_hot_streak: hasRank ? (rank?.hotStreak ?? null) : null,
          rank_inactive: hasRank ? (rank?.inactive ?? null) : null,
          rank_last_success_at: hasRank ? now : null,
          rank_league_points: hasRank ? (rank?.leaguePoints ?? null) : null,
          rank_losses: hasRank ? (rank?.losses ?? null) : null,
          rank_queue_type: hasRank ? (rank?.queueType ?? job.queue_type) : job.queue_type,
          rank_tier: hasRank ? (rank?.tier ?? null) : null,
          rank_veteran: hasRank ? (rank?.veteran ?? null) : null,
          rank_win_rate: hasRank ? (rank?.winRate ?? null) : null,
          rank_wins: hasRank ? (rank?.wins ?? null) : null,
          ranked_at: hasRank ? now : null,
          regional_routing: job.regional_route,
          source: existingCandidate?.source ?? "ladder_import",
          status: "candidate",
        },
        {
          onConflict: "platform_region,puuid",
        },
      )
      .select("id")
      .single<{ id: string }>();

    if (error || !savedCandidate) {
      diagnostics.candidates.persistenceFailures += 1;
      addDiscoveryReasonCode(diagnostics, "persistence-failed");
      continue;
    }

    diagnostics.candidateIds.push(savedCandidate.id);
    candidateIds.push(savedCandidate.id);
    diagnostics.candidates.enriched += 1;

    if (!hasRank) {
      diagnostics.candidates.missingEnrichment += 1;
    }

    if (hasRank) {
      const { error: snapshotError } = await supabase
        .from("riot_seed_candidate_rank_snapshots")
        .insert({
          candidate_id: savedCandidate.id,
          division: rank?.division ?? null,
          fresh_blood: rank?.freshBlood ?? null,
          hot_streak: rank?.hotStreak ?? null,
          inactive: rank?.inactive ?? null,
          league_points: rank?.leaguePoints ?? null,
          losses: rank?.losses ?? null,
          platform_region: job.platform,
          queue_type: rank?.queueType ?? job.queue_type,
          snapshot_status: "ranked",
          source: "ladder_import",
          tier: rank?.tier ?? null,
          veteran: rank?.veteran ?? null,
          win_rate: rank?.winRate ?? null,
          wins: rank?.wins ?? null,
        });

      if (snapshotError && snapshotError.code !== "23505") {
        diagnostics.candidates.rankSnapshotFailures += 1;
      } else if (!snapshotError) {
        diagnostics.candidates.rankSnapshotsInserted += 1;
      }
    }

    if (existingCandidate) {
      reused += 1;
      diagnostics.candidates.existingMatched += 1;
      diagnostics.candidates.reused += 1;
    } else {
      created += 1;
      diagnostics.candidates.created += 1;
    }
  }

  return {
    candidateIds,
    created,
    duplicatesSkipped,
    reused,
    uniquePuuidsFound,
  };
}

async function recordCollectionMatchesForScan({
  collectionJob,
  scanJob,
  supabase,
}: {
  collectionJob: RiotCollectionJobView;
  scanJob: RiotScanJobRow;
  supabase: SupabaseClient;
}) {
  let query = supabase
    .from("riot_matchup_observations")
    .select("id, match_id, role, champion_a, champion_b")
    .eq("scan_job_id", scanJob.id);

  if (collectionJob.role !== "any") {
    query = query.eq("role", collectionJob.role);
  }

  const { data, error } = await query.returns<
    Array<{
      champion_a: string;
      champion_b: string;
      id: string;
      match_id: string;
      role: LeagueRole;
    }>
  >();

  if (error) {
    return {
      duplicates: 0,
      inserted: 0,
      totalCount: collectionJob.unique_matches_processed,
    };
  }

  const rows = (data ?? [])
    .filter((observation) =>
      collectionJob.focus_champion_id
        ? observation.champion_a === collectionJob.focus_champion_id ||
          observation.champion_b === collectionJob.focus_champion_id
        : true,
    )
    .map((observation) => ({
      collection_job_id: collectionJob.id,
      counted_toward_target: true,
      duplicate_within_collection: false,
      match_id: observation.match_id,
      observation_id: observation.id,
      role: observation.role,
      source_scan_job_id: scanJob.id,
    }));

  if (rows.length > 0) {
    await supabase.from("riot_collection_job_matches").upsert(rows, {
      ignoreDuplicates: true,
      onConflict: "collection_job_id,match_id,role",
    });
  }

  const { count } = await supabase
    .from("riot_collection_job_matches")
    .select("*", { count: "exact", head: true })
    .eq("collection_job_id", collectionJob.id)
    .eq("counted_toward_target", true);
  const totalCount = count ?? collectionJob.unique_matches_processed;

  return {
    duplicates: Math.max(
      rows.length - Math.max(totalCount - collectionJob.unique_matches_processed, 0),
      0,
    ),
    inserted: Math.max(totalCount - collectionJob.unique_matches_processed, 0),
    totalCount,
  };
}

async function reserveCollectionSeeds({
  candidates,
  collectionJobId,
  supabase,
}: {
  candidates: RiotCollectionSeedCandidateRow[];
  collectionJobId: number;
  supabase: SupabaseClient;
}) {
  if (candidates.length === 0) {
    return;
  }

  await supabase.from("riot_collection_job_seeds").upsert(
    candidates.map((candidate) => ({
      candidate_id: candidate.id,
      collection_job_id: collectionJobId,
      puuid: candidate.puuid,
      source: "selected",
    })),
    {
      ignoreDuplicates: true,
      onConflict: "collection_job_id,candidate_id",
    },
  );
}

async function fetchUsedCollectionCandidateIds(supabase: SupabaseClient, collectionJobId: number) {
  const { data } = await supabase
    .from("riot_collection_job_seeds")
    .select("candidate_id")
    .eq("collection_job_id", collectionJobId)
    .returns<Array<{ candidate_id: string }>>();

  return new Set((data ?? []).map((row) => row.candidate_id));
}

async function fetchActiveCollectionJobForPlatform({
  platform,
  supabase,
}: {
  platform: string;
  supabase: SupabaseClient;
}) {
  const { data } = await supabase
    .from("riot_collection_jobs")
    .select("*")
    .eq("platform", platform)
    .in("status", [
      "queued",
      "discovering-seeds",
      "selecting-seeds",
      "scanning",
      "aggregating",
      "paused",
    ])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<RiotCollectionJobRow>();

  return data ? sanitizeCollectionJobRow(data) : null;
}

async function getActiveCollectionScan(supabase: SupabaseClient, collectionJobId: number) {
  const { data } = await supabase
    .from("riot_scan_jobs")
    .select(riotScanJobSelect)
    .eq("collection_job_id", collectionJobId)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<RiotScanJobRow>();

  return data ? sanitizeJobRow(data) : null;
}

async function fetchRiotScanJobRow(supabase: SupabaseClient, scanJobId: number) {
  const { data } = await supabase
    .from("riot_scan_jobs")
    .select(riotScanJobSelect)
    .eq("id", scanJobId)
    .maybeSingle<RiotScanJobRow>();

  return data ?? null;
}

async function getRiotCollectionConsistencyIssue({
  job,
  supabase,
}: {
  job: RiotCollectionJobView;
  supabase: SupabaseClient;
}): Promise<{
  reasonCode:
    | "active-parent-no-child"
    | "child-missing"
    | "child-parent-mismatch"
    | "terminal-child-consumed-parent-not-advanced"
    | "terminal-child-unconsumed";
  scanJobId: number | null;
} | null> {
  if (isRiotCollectionTerminalStatus(job.status)) {
    return null;
  }

  if (job.status !== "scanning" && job.status !== "paused") {
    return null;
  }

  const activeScanJobId = Number(job.progress.activeScanJobId ?? 0);

  if (!activeScanJobId) {
    return job.status === "scanning"
      ? {
          reasonCode: "active-parent-no-child",
          scanJobId: null,
        }
      : null;
  }

  const { data: scanJob } = await supabase
    .from("riot_scan_jobs")
    .select(riotScanJobSelect)
    .eq("id", activeScanJobId)
    .maybeSingle<RiotScanJobRow>();

  if (!scanJob) {
    return {
      reasonCode: "child-missing",
      scanJobId: activeScanJobId,
    };
  }

  if (scanJob.collection_job_id !== job.id) {
    return {
      reasonCode: "child-parent-mismatch",
      scanJobId: scanJob.id,
    };
  }

  if (scanJob.status === "completed") {
    return {
      reasonCode: scanJob.collection_result_consumed_at
        ? "terminal-child-consumed-parent-not-advanced"
        : "terminal-child-unconsumed",
      scanJobId: scanJob.id,
    };
  }

  if (scanJob.status === "failed" || scanJob.status === "cancelled") {
    return {
      reasonCode: "terminal-child-unconsumed",
      scanJobId: scanJob.id,
    };
  }

  return null;
}

async function fetchCollectionJob(
  supabase: SupabaseClient,
  collectionJobId: number,
): Promise<RiotCollectionJobResult> {
  const { data, error } = await supabase
    .from("riot_collection_jobs")
    .select("*")
    .eq("id", collectionJobId)
    .single<RiotCollectionJobRow>();

  if (error || !data) {
    return {
      error: "Collection job could not be loaded.",
      ok: false,
    };
  }

  const jobs = await hydrateCollectionJobs(supabase, [data]);

  return {
    job: jobs[0],
    ok: true,
  };
}

async function hydrateCollectionJobs(supabase: SupabaseClient, rows: RiotCollectionJobRow[]) {
  const latestScanJobsByCollectionId = new Map<number, RiotScanJobView>();

  if (rows.length > 0) {
    const { data } = await supabase
      .from("riot_scan_jobs")
      .select(riotScanJobSelect)
      .in(
        "collection_job_id",
        rows.map((row) => row.id),
      )
      .order("created_at", { ascending: false })
      .returns<RiotScanJobRow[]>();

    for (const row of data ?? []) {
      if (row.collection_job_id && !latestScanJobsByCollectionId.has(row.collection_job_id)) {
        latestScanJobsByCollectionId.set(row.collection_job_id, sanitizeJobRow(row));
      }
    }
  }

  return rows.map((row) =>
    sanitizeCollectionJobRow(row, latestScanJobsByCollectionId.get(row.id) ?? null),
  );
}

function sanitizeCollectionJobRow(
  row: RiotCollectionJobRow,
  latestScanJob: RiotScanJobView | null = null,
): RiotCollectionJobView {
  return {
    ...row,
    latest_scan_job: latestScanJob,
    progress: row.progress ?? {},
    summary: row.summary ?? {},
  };
}

async function updateCollectionJob({
  id,
  patch,
  supabase,
}: {
  id: number;
  patch: Partial<RiotCollectionJobRow>;
  supabase: SupabaseClient;
}): Promise<RiotCollectionJobResult> {
  const { data, error } = await supabase
    .from("riot_collection_jobs")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single<RiotCollectionJobRow>();

  if (error || !data) {
    return {
      error: "Collection job could not be updated.",
      ok: false,
    };
  }

  const jobs = await hydrateCollectionJobs(supabase, [data]);

  return {
    job: jobs[0],
    ok: true,
  };
}

function getCollectionSummaryPatch(
  job: RiotCollectionJobView,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...job.summary,
    ...patch,
  };
}

async function completeCollectionJob({
  job,
  status,
  stopDetail = null,
  stopReason,
  supabase,
}: {
  job: RiotCollectionJobView;
  status: RiotCollectionStatus;
  stopDetail?: string | null;
  stopReason: RiotCollectionStopReason;
  supabase: SupabaseClient;
}) {
  const now = new Date().toISOString();

  return updateCollectionJob({
    id: job.id,
    patch: {
      completed_at:
        status === "completed" || status === "completed-partial" ? now : job.completed_at,
      failed_at: status === "failed" ? now : job.failed_at,
      progress: getCollectionProgressPatch(job, {
        activeScanJobId: null,
        lastMessage: stopReason,
      }),
      status,
      stop_detail: stopDetail,
      stop_reason: stopReason,
    },
    supabase,
  });
}

async function failCollectionJob({
  errorMessage,
  job,
  supabase,
}: {
  errorMessage: string;
  job: RiotCollectionJobView;
  supabase: SupabaseClient;
}) {
  return updateCollectionJob({
    id: job.id,
    patch: {
      error_count: job.error_count + 1,
      failed_at: new Date().toISOString(),
      progress: getCollectionProgressPatch(job, {
        activeScanJobId: null,
        lastMessage: errorMessage,
      }),
      status: "failed",
      stop_detail: errorMessage,
      stop_reason: "error-budget-reached",
    },
    supabase,
  });
}

async function updateCollectionJobControlState({
  accessToken,
  collectionJobId,
  status,
  stopReason,
  timestampColumn,
}: {
  accessToken: string;
  collectionJobId: number;
  status: RiotCollectionStatus;
  stopReason: RiotCollectionStopReason;
  timestampColumn: "cancelled_at" | null;
}): Promise<RiotCollectionJobResult> {
  const authResult = await getAuthorizedAdmin(accessToken, "update Riot collection jobs");

  if (!authResult.ok) {
    return authResult;
  }

  const serviceClientResult = getServiceSupabaseClient();

  if (!serviceClientResult.ok) {
    return serviceClientResult;
  }

  const patch: Partial<RiotCollectionJobRow> = {
    status,
    stop_detail: null,
    stop_reason: stopReason,
  };

  if (timestampColumn) {
    patch[timestampColumn] = new Date().toISOString();
  }

  return updateCollectionJob({
    id: collectionJobId,
    patch,
    supabase: serviceClientResult.supabase,
  });
}

function getCollectionProgressPatch(
  job: RiotCollectionJobView,
  patch: Partial<RiotCollectionJobProgress>,
): RiotCollectionJobProgress {
  return {
    ...job.progress,
    lastAdvancedAt: new Date().toISOString(),
    safetyLimits: defaultRiotCollectionSafetyLimits,
    ...patch,
  };
}

function compareCollectionSeedCandidates(
  left: RiotCollectionSeedCandidateRow,
  right: RiotCollectionSeedCandidateRow,
  {
    focusChampionId,
    role,
  }: {
    focusChampionId: string | null;
    role: RiotCollectionRole;
  },
) {
  const leftFocusMatch = focusChampionId && left.primary_champion === focusChampionId ? 1 : 0;
  const rightFocusMatch = focusChampionId && right.primary_champion === focusChampionId ? 1 : 0;

  if (leftFocusMatch !== rightFocusMatch) {
    return rightFocusMatch - leftFocusMatch;
  }

  const leftRoleMatch = role !== "any" && left.estimated_primary_role === role ? 1 : 0;
  const rightRoleMatch = role !== "any" && right.estimated_primary_role === role ? 1 : 0;

  if (leftRoleMatch !== rightRoleMatch) {
    return rightRoleMatch - leftRoleMatch;
  }

  if (left.observed_games !== right.observed_games) {
    return right.observed_games - left.observed_games;
  }

  const leftYield = Number(left.last_scan_unique_matches_found ?? -1);
  const rightYield = Number(right.last_scan_unique_matches_found ?? -1);

  if (leftYield !== rightYield) {
    return rightYield - leftYield;
  }

  const leftLastScan = left.last_successful_scan_at
    ? new Date(left.last_successful_scan_at).getTime()
    : 0;
  const rightLastScan = right.last_successful_scan_at
    ? new Date(right.last_successful_scan_at).getTime()
    : 0;

  if (leftLastScan !== rightLastScan) {
    return leftLastScan - rightLastScan;
  }

  return left.id.localeCompare(right.id);
}

async function getOrCreateLadderCursor({
  division,
  job,
  tier,
  supabase,
}: {
  division: string;
  job: RiotCollectionJobView;
  tier: string;
  supabase: SupabaseClient;
}) {
  const { data } = await supabase
    .from("riot_ladder_discovery_cursors")
    .upsert(
      {
        division,
        platform: job.platform,
        queue_type: job.queue_type,
        tier,
      },
      {
        ignoreDuplicates: true,
        onConflict: "platform,queue_type,tier,division",
      },
    )
    .select("id, next_page")
    .single<{ id: number; next_page: number }>();

  return data ?? { id: 0, next_page: 1 };
}

async function updateLadderCursorSuccess({
  candidatesCreated,
  candidatesReused,
  cursorId,
  entriesReturned,
  fetchedPage,
  hasStandardPages,
  supabase,
}: {
  candidatesCreated: number;
  candidatesReused: number;
  cursorId: number;
  entriesReturned: number;
  fetchedPage: number;
  hasStandardPages: boolean;
  supabase: SupabaseClient;
}) {
  if (!cursorId) {
    return;
  }

  await supabase
    .from("riot_ladder_discovery_cursors")
    .update({
      candidates_created: candidatesCreated,
      candidates_reused: candidatesReused,
      empty_page_count: entriesReturned === 0 ? 1 : 0,
      entries_returned: entriesReturned,
      last_discovered_at: new Date().toISOString(),
      last_error_code: null,
      last_page_fetched: fetchedPage,
      next_page: hasStandardPages ? fetchedPage + 1 : 1,
    })
    .eq("id", cursorId);
}

async function updateLadderCursorFailure({
  cursorId,
  errorCode,
  supabase,
}: {
  cursorId: number;
  errorCode: string;
  supabase: SupabaseClient;
}) {
  if (!cursorId) {
    return;
  }

  await supabase
    .from("riot_ladder_discovery_cursors")
    .update({
      cooldown_until:
        errorCode === "rate_limited" ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
      last_error_code: errorCode,
    })
    .eq("id", cursorId);
}

async function getCachedSummonerPuuid({
  encryptedSummonerId,
  platform,
  supabase,
}: {
  encryptedSummonerId: string;
  platform: string;
  supabase: SupabaseClient;
}) {
  const { data } = await supabase
    .from("riot_summoner_puuid_cache")
    .select("puuid, lookup_status")
    .eq("platform", platform)
    .eq("encrypted_summoner_id", encryptedSummonerId)
    .maybeSingle<{ lookup_status: string; puuid: string | null }>();

  return data?.lookup_status === "resolved" ? data.puuid : null;
}

async function upsertSummonerPuuidCache({
  encryptedSummonerId,
  errorCode = null,
  platform,
  puuid,
  status,
  supabase,
}: {
  encryptedSummonerId: string;
  errorCode?: string | null;
  platform: string;
  puuid: string | null;
  status: string;
  supabase: SupabaseClient;
}) {
  const now = new Date().toISOString();

  await supabase.from("riot_summoner_puuid_cache").upsert(
    {
      encrypted_summoner_id: encryptedSummonerId,
      last_attempted_at: now,
      last_error_code: errorCode,
      last_success_at: status === "resolved" ? now : null,
      lookup_status: status,
      next_retry_at:
        status === "rate_limited" ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
      platform,
      puuid,
    },
    {
      onConflict: "platform,encrypted_summoner_id",
    },
  );
}

async function failJob({
  errorMessage,
  jobId,
  supabase,
}: {
  errorMessage: string;
  jobId: number;
  supabase: SupabaseClient;
}) {
  const { data } = await supabase
    .from("riot_scan_jobs")
    .update({
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
      status: "failed",
    })
    .eq("id", jobId)
    .select(riotScanJobSelect)
    .maybeSingle<RiotScanJobRow>();

  return data ? sanitizeJobRow(data) : null;
}

function getAuthorizedAdmin(
  accessToken: string,
  actionLabel: string,
): Promise<AuthorizedClientResult> {
  return getAuthorizedAdminClient(accessToken, actionLabel);
}

async function getAuthorizedAdminClient(
  accessToken: string,
  actionLabel: string,
): Promise<AuthorizedClientResult> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      error: "Supabase is not configured.",
      ok: false,
    };
  }

  if (!accessToken) {
    return {
      error: "Admin session is not ready.",
      ok: false,
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  const user = userData.user;

  if (userError || !user) {
    return {
      error: "Admin session could not be verified.",
      ok: false,
    };
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin", {
    user_id: user.id,
  });

  if (adminError || !isAdmin) {
    return {
      error: `Only admins can ${actionLabel}.`,
      ok: false,
    };
  }

  return {
    ok: true,
    userId: user.id,
  };
}

function getServiceSupabaseClient():
  | {
      ok: true;
      supabase: SupabaseClient;
    }
  | {
      error: string;
      ok: false;
    } {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return {
      error: "Supabase service credentials are not configured.",
      ok: false,
    };
  }

  return {
    ok: true,
    supabase: createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
      },
    }),
  };
}

async function loadChampionRegistry(supabase: SupabaseClient): Promise<
  | {
      normalizeChampionIdentifier: (
        value: unknown,
        registry: unknown,
      ) => { canonicalKey: string } | null;
      ok: true;
      registry: unknown;
    }
  | {
      error: string;
      ok: false;
    }
> {
  try {
    const { loadActiveChampionRegistry, normalizeChampionIdentifier } =
      await import("@/scripts/lib/league-champion-normalizer.mjs");
    const registry = await loadActiveChampionRegistry({
      supabase,
    });

    return {
      normalizeChampionIdentifier,
      ok: true,
      registry,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "League champion registry could not be initialized.",
      ok: false,
    };
  }
}

type ValidatedStartInput = {
  counterChampion: string;
  currentPatchOnly: boolean;
  discoveryFocusChampion: string | null;
  enemyChampion: string;
  matchCount: number;
  maxDisplayedResults: number;
  minimumGames: number;
  mode: RiotScanMode;
  role: LeagueRole;
  seedPuuids: string[];
};

function normalizeTargetChampions(
  enemyChampion: string,
  counterChampion: string,
  championRegistry: unknown,
  normalizeChampionIdentifier: (
    value: unknown,
    registry: unknown,
  ) => { canonicalKey: string } | null,
):
  | {
      counterChampion: string;
      enemyChampion: string;
      ok: true;
    }
  | {
      error: string;
      ok: false;
    } {
  if (!enemyChampion || !counterChampion) {
    return {
      error: "Target scans require enemy and counter champions.",
      ok: false,
    };
  }

  const enemy = normalizeChampionIdentifier(enemyChampion, championRegistry);
  const counter = normalizeChampionIdentifier(counterChampion, championRegistry);

  if (!enemy || !counter) {
    return {
      error: "Select valid enemy and counter champions.",
      ok: false,
    };
  }

  return {
    counterChampion: counter.canonicalKey,
    enemyChampion: enemy.canonicalKey,
    ok: true,
  };
}

function validateStartInput(
  input: StartRiotScanJobInput,
  championRegistry: unknown,
  normalizeChampionIdentifier: (
    value: unknown,
    registry: unknown,
  ) => { canonicalKey: string } | null,
):
  | ({
      ok: true;
    } & ValidatedStartInput)
  | {
      error: string;
      ok: false;
    } {
  const mode = input.mode;
  const role = normalizeRole(input.role);
  const seedPuuids = uniqueValues(input.seedPuuids ?? []);
  const matchCount = Number(input.matchCount);
  const minimumGames = Number(input.minimumGames);
  const maxDisplayedResults = Number(input.maxDisplayedResults);
  const enemyChampion = input.enemyChampion?.trim() ?? "";
  const counterChampion = input.counterChampion?.trim() ?? "";
  const discoveryFocusChampionInput = input.discoveryFocusChampion?.trim() ?? "";
  const normalizedChampions =
    mode === "target"
      ? normalizeTargetChampions(
          enemyChampion,
          counterChampion,
          championRegistry,
          normalizeChampionIdentifier,
        )
      : null;
  const normalizedDiscoveryFocusChampion =
    mode === "discovery" && discoveryFocusChampionInput
      ? normalizeChampionIdentifier(discoveryFocusChampionInput, championRegistry)
      : null;

  if (mode !== "target" && mode !== "discovery") {
    return {
      error: "Select a valid scan mode.",
      ok: false,
    };
  }

  if (!role) {
    return {
      error: "Select a valid role.",
      ok: false,
    };
  }

  if (seedPuuids.length === 0) {
    return {
      error: "Add at least one Seed PUUID.",
      ok: false,
    };
  }

  if (seedPuuids.length > maxSeedCandidatesPerScan) {
    return {
      error: `You selected ${seedPuuids.length} seed candidates. The maximum per scan job is ${maxSeedCandidatesPerScan}.`,
      ok: false,
    };
  }

  if (!Number.isInteger(matchCount) || matchCount < 1 || matchCount > maxMatchCount) {
    return {
      error: `Match count must be between 1 and ${maxMatchCount}.`,
      ok: false,
    };
  }

  const hasInvalidMinimumGames =
    !Number.isInteger(minimumGames) || minimumGames < 1 || minimumGames > 1000;
  const hasInvalidMaxDisplayedResults =
    !Number.isInteger(maxDisplayedResults) ||
    maxDisplayedResults < 1 ||
    maxDisplayedResults > maxDisplayedResultsLimit;

  if (mode === "discovery" && hasInvalidMinimumGames) {
    return {
      error: "Minimum games must be between 1 and 1000.",
      ok: false,
    };
  }

  if (mode === "discovery" && hasInvalidMaxDisplayedResults) {
    return {
      error: `Maximum displayed results must be between 1 and ${maxDisplayedResultsLimit}.`,
      ok: false,
    };
  }

  if (mode === "target" && !normalizedChampions?.ok) {
    return {
      error:
        normalizedChampions?.error ?? "Target scans require valid enemy and counter champions.",
      ok: false,
    };
  }

  if (mode === "discovery" && discoveryFocusChampionInput && !normalizedDiscoveryFocusChampion) {
    return {
      error: "Select a valid discovery focus champion.",
      ok: false,
    };
  }

  if (
    mode === "target" &&
    normalizedChampions?.ok &&
    normalizedChampions.enemyChampion === normalizedChampions.counterChampion
  ) {
    return {
      error: "Enemy and counter champion cannot be the same.",
      ok: false,
    };
  }

  return {
    counterChampion:
      mode === "target" && normalizedChampions?.ok ? normalizedChampions.counterChampion : "",
    currentPatchOnly: input.currentPatchOnly,
    discoveryFocusChampion:
      mode === "discovery" && normalizedDiscoveryFocusChampion
        ? normalizedDiscoveryFocusChampion.canonicalKey
        : null,
    enemyChampion:
      mode === "target" && normalizedChampions?.ok ? normalizedChampions.enemyChampion : "",
    matchCount,
    maxDisplayedResults: mode === "discovery" ? maxDisplayedResults : 20,
    minimumGames: mode === "discovery" ? minimumGames : 1,
    mode,
    ok: true,
    role,
    seedPuuids,
  };
}

function sanitizeJobRow(row: RiotScanJobRow): RiotScanJobView {
  const seedCount =
    row.seed_puuids?.length ?? row.summary?.seedCount ?? row.progress?.seedCount ?? 0;

  return {
    collection_job_id: row.collection_job_id,
    collection_result_consumed_at: row.collection_result_consumed_at,
    completed_at: row.completed_at,
    counter_champion: row.counter_champion,
    created_at: row.created_at,
    enemy_champion: row.enemy_champion,
    error_message: row.error_message,
    focus_champion_id: row.focus_champion_id,
    id: row.id,
    match_count: row.match_count,
    minimum_games: row.minimum_games,
    mode: row.mode,
    progress: {
      ...(row.progress ?? {}),
      seedCount,
    },
    results: row.results,
    role: row.role,
    seed_count: seedCount,
    started_at: row.started_at,
    status: row.status,
    summary: {
      ...(row.summary ?? {}),
      seedCount,
    },
  };
}

function normalizeRole(value: unknown): LeagueRole | null {
  const role = String(value).trim().toLowerCase();

  if (role === "bottom" || role === "bot") {
    return "adc";
  }

  return role === "top" ||
    role === "jungle" ||
    role === "mid" ||
    role === "adc" ||
    role === "support"
    ? role
    : null;
}

function uniqueValues(values: unknown[]) {
  return Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean)));
}

function normalizeNullableText(value: string | null | undefined) {
  const text = String(value ?? "").trim();

  return text ? text.slice(0, 240) : null;
}

function dedupeCoverageParticipantInputs(participants: MatchupRankCoverageParticipantInput[]) {
  const participantsByKey = new Map<string, MatchupRankCoverageParticipantInput>();

  for (const participant of participants ?? []) {
    const platformRegion = String(participant.platformRegion ?? "")
      .trim()
      .toUpperCase();
    const puuid = String(participant.puuid ?? "").trim();

    if (!platformRegion || !puuid) {
      continue;
    }

    participantsByKey.set(`${platformRegion}:${puuid}`, {
      platformRegion,
      puuid,
    });
  }

  return Array.from(participantsByKey.values());
}

function getCandidateSortColumn(sort: RiotSeedCandidateSort) {
  switch (sort) {
    case "created_at":
      return "created_at";
    case "last_scanned_at":
      return "last_scanned_at";
    case "rank_league_points":
      return "rank_league_points";
    case "rank_last_success_at":
      return "rank_last_success_at";
    case "rank_tier":
      return "rank_last_success_at";
    case "observed_games":
      return "observed_games";
    case "primary_champion_share":
      return "primary_champion_share";
    case "primary_role_share":
      return "primary_role_share";
    case "last_seen_at":
    default:
      return "last_seen_at";
  }
}

function buildRiotSeedCandidateQuery({
  filters,
  rankGroup = null,
  selectOptions,
  supabase,
}: {
  filters: RiotSeedCandidateFilters;
  rankGroup?: RiotSeedCandidateRankGroupId | null;
  selectOptions?: {
    count?: "exact";
    head?: boolean;
  };
  supabase: SupabaseClient;
}) {
  let query = supabase.from("riot_seed_candidates").select(riotSeedCandidateSelect, selectOptions);

  if (filters.platformRegion?.trim()) {
    query = query.eq("platform_region", filters.platformRegion.trim().toUpperCase());
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.primaryRole && filters.primaryRole !== "all") {
    query = query.eq("estimated_primary_role", filters.primaryRole);
  }

  if (filters.primaryChampion?.trim()) {
    query = query.ilike("primary_champion", `%${filters.primaryChampion.trim()}%`);
  }

  if (filters.search?.trim()) {
    const search = filters.search.trim().replace(/[%*,]/g, "");

    if (search) {
      query = query.or(`puuid.ilike.%${search}%,primary_champion.ilike.%${search}%`);
    }
  }

  if (filters.lastScanned === "never") {
    query = query.is("last_scanned_at", null);
  } else if (filters.lastScanned === "recent") {
    query = query.gte("last_scanned_at", getRecentSeedCandidateScanCutoff());
  } else if (filters.lastScanned === "older") {
    query = query.or(
      `last_scanned_at.is.null,last_scanned_at.lt.${getRecentSeedCandidateScanCutoff()}`,
    );
  }

  if (filters.source && filters.source !== "all") {
    query = query.eq("source", filters.source);
  }

  if (filters.rankStatus && filters.rankStatus !== "all") {
    query = query.eq("rank_enrichment_status", filters.rankStatus);
  }

  if (filters.rankTier && filters.rankTier !== "all") {
    query = query.eq("rank_tier", filters.rankTier);
  }

  if (filters.rankedState === "ranked") {
    query = query.eq("rank_enrichment_status", "ranked");
  } else if (filters.rankedState === "unranked") {
    query = query.in("rank_enrichment_status", ["unranked", "not_found"]);
  }

  if (filters.rankLastRefreshed === "never") {
    query = query.is("rank_last_success_at", null);
  } else if (filters.rankLastRefreshed === "recent") {
    query = query.gte("rank_last_success_at", getRecentSeedCandidateRankRefreshCutoff());
  } else if (filters.rankLastRefreshed === "older") {
    query = query.or(
      `rank_last_success_at.is.null,rank_last_success_at.lt.${getRecentSeedCandidateRankRefreshCutoff()}`,
    );
  }

  if (filters.minObservedGames && filters.minObservedGames > 0) {
    query = query.gte("observed_games", Math.trunc(filters.minObservedGames));
  }

  const minPrimaryRoleShare = normalizeShareFilter(filters.minPrimaryRoleShare);
  const minPrimaryChampionShare = normalizeShareFilter(filters.minPrimaryChampionShare);

  if (minPrimaryRoleShare !== null) {
    query = query.gte("primary_role_share", minPrimaryRoleShare);
  }

  if (minPrimaryChampionShare !== null) {
    query = query.gte("primary_champion_share", minPrimaryChampionShare);
  }

  if (rankGroup) {
    const group = riotSeedCandidateRankGroupsById.get(rankGroup);

    if (group && group.tiers.length > 0) {
      query = query.eq("rank_enrichment_status", "ranked").in("rank_tier", group.tiers);
    } else {
      query = query.or(
        "rank_tier.is.null,rank_enrichment_status.in.(pending,unranked,not_found,failed)",
      );
    }
  }

  if (filters.lifecycleState && filters.lifecycleState !== "all") {
    query = applyRiotSeedCandidateLifecycleFilter(query, filters.lifecycleState);
  }

  return query;
}

function applyRiotSeedCandidateLifecycleFilter<TQuery extends RiotSeedCandidateQueryBuilder>(
  query: TQuery,
  lifecycleState: SeedCandidateLifecycleState,
) {
  const nowIso = new Date().toISOString();
  const recentCutoff = getHoursAgoIso(RECENTLY_SCANNED_WINDOW_HOURS);
  const staleRankCutoff = getDaysAgoIso(30);
  const supportedRankTiers = [
    "CHALLENGER",
    "GRANDMASTER",
    "MASTER",
    "DIAMOND",
    "EMERALD",
    "PLATINUM",
    "GOLD",
    "SILVER",
    "BRONZE",
    "IRON",
  ];

  switch (lifecycleState) {
    case "rejected":
      return query.not("manually_rejected_at", "is", null) as TQuery;
    case "low-signal":
      return query
        .is("manually_rejected_at", null)
        .not("source", "eq", "ladder_import")
        .lt("observed_games", MIN_SEED_OBSERVATIONS) as TQuery;
    case "failed":
      return query
        .is("manually_rejected_at", null)
        .or(
          `consecutive_scan_failures.gte.${MAX_CONSECUTIVE_SCAN_FAILURES},status.eq.failed`,
        ) as TQuery;
    case "recently-scanned":
      return query
        .is("manually_rejected_at", null)
        .gte("last_successful_scan_at", recentCutoff)
        .lt("consecutive_scan_failures", MAX_CONSECUTIVE_SCAN_FAILURES) as TQuery;
    case "cooling-down":
      return query
        .is("manually_rejected_at", null)
        .lt("last_successful_scan_at", recentCutoff)
        .gt("next_eligible_scan_at", nowIso)
        .lt("consecutive_scan_failures", MAX_CONSECUTIVE_SCAN_FAILURES) as TQuery;
    case "needs-rank-enrichment":
      return query
        .is("manually_rejected_at", null)
        .gte("observed_games", MIN_SEED_OBSERVATIONS)
        .lt("consecutive_scan_failures", MAX_CONSECUTIVE_SCAN_FAILURES)
        .or(
          [
            "rank_enrichment_status.neq.ranked",
            "rank_tier.is.null",
            "rank_last_success_at.is.null",
            `rank_last_success_at.lt.${staleRankCutoff}`,
          ].join(","),
        ) as TQuery;
    case "ready-to-scan":
      return query
        .is("manually_rejected_at", null)
        .or(`observed_games.gte.${MIN_SEED_OBSERVATIONS},source.eq.ladder_import`)
        .eq("rank_enrichment_status", "ranked")
        .in("rank_tier", supportedRankTiers)
        .lt("consecutive_scan_failures", MAX_CONSECUTIVE_SCAN_FAILURES)
        .or("status.eq.candidate,status.eq.approved,status.eq.cooldown,status.eq.ignored")
        .or(`next_eligible_scan_at.is.null,next_eligible_scan_at.lte.${nowIso}`)
        .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
        .or(`last_successful_scan_at.is.null,last_successful_scan_at.lt.${recentCutoff}`) as TQuery;
    case "observed":
    default:
      return query
        .is("manually_rejected_at", null)
        .gte("observed_games", MIN_SEED_OBSERVATIONS)
        .is("rank_last_attempted_at", null) as TQuery;
  }
}

function hydrateSeedCandidateLifecycle(candidate: RiotSeedCandidateView): RiotSeedCandidateView {
  return {
    ...candidate,
    lifecycle: deriveSeedCandidateLifecycle(candidate),
  };
}

function getRiotSeedCandidateGroupLabel(rankGroup: RiotSeedCandidateRankGroupId) {
  return riotSeedCandidateRankGroupsById.get(rankGroup)?.label ?? "Riot seed";
}

async function fetchRankTierSortedSeedCandidatePage({
  filters,
  page,
  pageSize,
  rankGroup,
  sortDirection,
  supabase,
}: {
  filters: RiotSeedCandidateFilters;
  page: number;
  pageSize: number;
  rankGroup: RiotSeedCandidateRankGroupId;
  sortDirection: "asc" | "desc";
  supabase: SupabaseClient;
}) {
  const group = riotSeedCandidateRankGroupsById.get(rankGroup);

  if (!group || group.tiers.length === 0) {
    return buildRiotSeedCandidateQuery({
      filters,
      rankGroup,
      supabase,
    })
      .order("observed_games", { ascending: false, nullsFirst: false })
      .range((page - 1) * pageSize, page * pageSize - 1)
      .returns<RiotSeedCandidateView[]>();
  }

  const tiers = sortDirection === "asc" ? group.tiers : [...group.tiers].reverse();
  const rows: RiotSeedCandidateView[] = [];
  let offset = (page - 1) * pageSize;
  let remaining = pageSize;

  for (const tier of tiers) {
    if (remaining <= 0) {
      break;
    }

    const { count, error: countError } = await buildRiotSeedCandidateQuery({
      filters,
      rankGroup,
      selectOptions: { count: "exact", head: true },
      supabase,
    }).eq("rank_tier", tier);

    if (countError) {
      return {
        data: null,
        error: countError,
      };
    }

    const tierCount = count ?? 0;

    if (offset >= tierCount) {
      offset -= tierCount;
      continue;
    }

    const from = offset;
    const to = Math.min(tierCount - 1, offset + remaining - 1);
    const { data, error } = await buildRiotSeedCandidateQuery({
      filters,
      rankGroup,
      supabase,
    })
      .eq("rank_tier", tier)
      .order("rank_division", {
        ascending: sortDirection === "asc",
        nullsFirst: false,
      })
      .order("rank_league_points", {
        ascending: sortDirection === "desc",
        nullsFirst: false,
      })
      .order("observed_games", { ascending: false, nullsFirst: false })
      .range(from, to)
      .returns<RiotSeedCandidateView[]>();

    if (error) {
      return {
        data: null,
        error,
      };
    }

    rows.push(...(data ?? []));
    remaining = pageSize - rows.length;
    offset = 0;
  }

  return {
    data: rows,
    error: null,
  };
}

function sortCandidateRows(candidates: RiotSeedCandidateView[], sort: RiotSeedCandidateSort) {
  if (sort !== "rank_tier") {
    return candidates;
  }

  return [...candidates].sort((left, right) => {
    const leftWeight = getRankSortWeight(left);
    const rightWeight = getRankSortWeight(right);

    if (leftWeight !== rightWeight) {
      return leftWeight - rightWeight;
    }

    return Number(right.rank_league_points ?? -1) - Number(left.rank_league_points ?? -1);
  });
}

function getRankSortWeight(candidate: Pick<RiotSeedCandidateView, "rank_division" | "rank_tier">) {
  const tierOrder = [
    "CHALLENGER",
    "GRANDMASTER",
    "MASTER",
    "DIAMOND",
    "EMERALD",
    "PLATINUM",
    "GOLD",
    "SILVER",
    "BRONZE",
    "IRON",
  ];
  const divisionOrder = ["I", "II", "III", "IV"];
  const tierIndex = tierOrder.indexOf(candidate.rank_tier ?? "");
  const divisionIndex = divisionOrder.indexOf(candidate.rank_division ?? "");

  if (tierIndex === -1) {
    return Number.MAX_SAFE_INTEGER;
  }

  return tierIndex * 10 + (divisionIndex === -1 ? 0 : divisionIndex);
}

function normalizeShareFilter(value: number | undefined) {
  const share = Number(value);

  if (!Number.isFinite(share) || share <= 0) {
    return null;
  }

  if (share > 1) {
    return Math.min(share / 100, 1);
  }

  return Math.min(share, 1);
}

function getRecentSeedCandidateScanCutoff() {
  return new Date(Date.now() - recentSeedCandidateScanHours * 60 * 60 * 1000).toISOString();
}

function getRecentSeedCandidateRankRefreshCutoff() {
  return new Date(Date.now() - recentSeedCandidateRankRefreshHours * 60 * 60 * 1000).toISOString();
}

function getHoursAgoIso(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function getDaysAgoIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function getScannerErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("401") || error.message.includes("403")) {
      return "Riot authentication failed. Check the Riot API key.";
    }

    if (error.message.includes("429") || error.message.toLowerCase().includes("rate limit")) {
      return "Riot rate limit was reached. Try again later or lower the scan size.";
    }

    if (error.message.toLowerCase().includes("fetch")) {
      return "Network failure while contacting Riot.";
    }

    if (
      error.message.startsWith("Database write failed") ||
      error.message.startsWith("Could not fetch current League patch")
    ) {
      return error.message;
    }
  }

  return "Scanner failure. Check the scan inputs and try again.";
}

function getRiotRankRefreshErrorMessage(error: Error) {
  const errorWithStatus = error as Error & { status?: number };

  if (errorWithStatus.status === 401 || errorWithStatus.status === 403) {
    return "Riot API authentication failed. Check the Riot API key.";
  }

  if (errorWithStatus.status === 429 || error.message.toLowerCase().includes("rate limit")) {
    return "Riot rank refresh was rate limited. Try again later.";
  }

  if (error.message.toLowerCase().includes("fetch")) {
    return "Network error while contacting Riot rank endpoint.";
  }

  return error.message || "Riot rank refresh failed.";
}

function validateCounterRankingV2MechanicalReviewInput(
  input: SaveCounterRankingV2MechanicalReviewInput,
):
  | {
      adjustmentReason: CounterRankingV2AdjustmentReason;
      counterChampionId: string;
      enemyChampionId: string;
      highMasteryRequired: boolean;
      manualAdjustment: number;
      publicEligible: boolean;
      reviewStatus: CounterRankingV2ReviewStatus;
      role: LeagueRole;
      ok: true;
    }
  | {
      error: string;
      ok: false;
    } {
  const enemyChampionId = normalizeChampionIdForReview(input.enemyChampionId);
  const counterChampionId = normalizeChampionIdForReview(input.counterChampionId);

  if (!enemyChampionId || !counterChampionId) {
    return {
      error: "Select an enemy champion and counter champion before saving review.",
      ok: false,
    };
  }

  if (enemyChampionId === counterChampionId) {
    return {
      error: "A champion cannot be reviewed as a counter to itself.",
      ok: false,
    };
  }

  if (!leagueRoles.includes(input.role)) {
    return {
      error: "Select a valid role before saving review.",
      ok: false,
    };
  }

  if (!isCounterRankingV2AdjustmentReason(input.adjustmentReason)) {
    return {
      error: "Select a valid adjustment reason.",
      ok: false,
    };
  }

  if (!isCounterRankingV2ReviewStatus(input.reviewStatus)) {
    return {
      error: "Select a valid review status.",
      ok: false,
    };
  }

  if (!Number.isFinite(input.manualAdjustment)) {
    return {
      error: "Manual adjustment must be a finite number.",
      ok: false,
    };
  }

  if (!isCounterRankingV2ManualAdjustmentInBounds(input.manualAdjustment)) {
    return {
      error: "Manual adjustment must be between -30 and 30.",
      ok: false,
    };
  }

  return {
    adjustmentReason: input.adjustmentReason,
    counterChampionId,
    enemyChampionId,
    highMasteryRequired: input.highMasteryRequired === true,
    manualAdjustment: input.manualAdjustment,
    ok: true,
    publicEligible: normalizeCounterRankingV2PublicEligible({
      publicEligible: input.publicEligible,
      reviewStatus: input.reviewStatus,
    }),
    reviewStatus: input.reviewStatus,
    role: input.role,
  };
}

function resolveCounterRankingV2ReviewChampionIds({
  counterChampionId,
  enemyChampionId,
  registry,
  resolveChampion,
}: {
  counterChampionId: string;
  enemyChampionId: string;
  registry: unknown;
  resolveChampion: (value: unknown, registry: unknown) => { canonicalKey: string } | null;
}):
  | {
      counterChampionId: string;
      enemyChampionId: string;
      ok: true;
    }
  | {
      error: string;
      ok: false;
    } {
  const enemyChampion = resolveChampion(enemyChampionId, registry);
  const counterChampion = resolveChampion(counterChampionId, registry);

  if (!enemyChampion || !counterChampion) {
    return {
      error: "Select valid enemy and counter champions before saving review.",
      ok: false,
    };
  }

  if (enemyChampion.canonicalKey === counterChampion.canonicalKey) {
    return {
      error: "A champion cannot be reviewed as a counter to itself.",
      ok: false,
    };
  }

  return {
    counterChampionId: counterChampion.canonicalKey,
    enemyChampionId: enemyChampion.canonicalKey,
    ok: true,
  };
}

function toCounterRankingV2MechanicalReview(
  row: CounterRankingV2MechanicalReviewRow,
): CounterRankingV2MechanicalReview {
  const isLegacyHighMasteryStatus = row.review_status === "high_mastery_required";
  const reviewStatus: CounterRankingV2ReviewStatus = isLegacyHighMasteryStatus
    ? "needs_more_data"
    : (row.review_status as CounterRankingV2ReviewStatus);

  return createCounterRankingV2MechanicalReview({
    adjustmentReason: row.adjustment_reason,
    adminReviewNote: row.admin_review_note,
    calculatedMechanicalScore: Number(row.calculated_mechanical_score),
    counterChampionId: row.counter_champion_id,
    createdAt: row.created_at,
    enemyChampionId: row.enemy_champion_id,
    generatedAt: row.generated_at,
    generatedBy: row.generated_by,
    highMasteryRequired: Boolean(row.high_mastery_required) || isLegacyHighMasteryStatus,
    manualAdjustment: Number(row.manual_adjustment),
    publicEligible: row.public_eligible,
    reviewStatus,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    role: row.role,
    updatedAt: row.updated_at,
  });
}

function toCounterRankingV2ProfileReview(
  row: CounterRankingV2ProfileReviewRow,
): CounterRankingV2ProfileReview {
  return {
    championId: row.champion_id,
    createdAt: row.created_at,
    reviewNote: row.notes,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    role: row.role,
    status: normalizeCounterRankingV2ProfileStatus(row.status) ?? "draft",
    traitProfileVersion: row.trait_profile_version,
    updatedAt: row.updated_at,
    vulnerabilityProfileVersion: row.vulnerability_profile_version,
  };
}

function createCounterRankingV2GeneratedTraitProfileRow(
  championId: string,
  role: LeagueRole,
  now: string,
) {
  const profile = createCounterRankingV2GeneratedDraftChampionProfile(championId, role);

  return {
    champion_id: championId,
    created_at: now,
    identity_summary: profile.identitySummary,
    known_strengths: profile.knownStrengths,
    mastery_requirement: null,
    notes: profile.notes,
    profile_version: counterRankingV2GeneratedDraftProfileVersion,
    role,
    strengths: profile.strengths,
    updated_at: now,
    updated_by: null,
  };
}

function createCounterRankingV2GeneratedVulnerabilityProfileRow(
  championId: string,
  role: LeagueRole,
  now: string,
) {
  const profile = createCounterRankingV2GeneratedDraftChampionProfile(championId, role);

  return {
    champion_id: championId,
    created_at: now,
    known_weaknesses: profile.knownWeaknesses,
    notes: profile.notes,
    profile_version: counterRankingV2GeneratedDraftProfileVersion,
    role,
    updated_at: now,
    updated_by: null,
    vulnerabilities: profile.vulnerabilities,
  };
}

function createCounterRankingV2GeneratedReviewRow(
  championId: string,
  role: LeagueRole,
  now: string,
) {
  return {
    champion_id: championId,
    created_at: now,
    notes: null,
    reviewed_at: null,
    reviewed_by: null,
    role,
    status: "draft",
    trait_profile_version: counterRankingV2GeneratedDraftProfileVersion,
    updated_at: now,
    vulnerability_profile_version: counterRankingV2GeneratedDraftProfileVersion,
  };
}

function getSupportedCounterRankingV2ProfileTargets(championIds: string[]) {
  return championIds.flatMap((championId) =>
    getSupportedChampionRoles({ id: championId })
      .filter((role): role is LeagueRole => leagueRoles.includes(role))
      .map((role) => ({
        championId,
        role,
      })),
  );
}

function mergeCounterRankingV2EditableProfileRows({
  traitRows,
  vulnerabilityRows,
}: {
  traitRows: CounterRankingV2TraitProfileRow[];
  vulnerabilityRows: CounterRankingV2VulnerabilityProfileRow[];
}): CounterRankingV2ChampionProfile[] {
  const traitRowsByProfileKey = new Map(
    traitRows.map((row) => [getCounterRankingV2ProfileKey(row.champion_id, row.role), row] as const),
  );
  const vulnerabilityRowsByProfileKey = new Map(
    vulnerabilityRows.map(
      (row) => [getCounterRankingV2ProfileKey(row.champion_id, row.role), row] as const,
    ),
  );
  const profileKeys = Array.from(
    new Set([...traitRowsByProfileKey.keys(), ...vulnerabilityRowsByProfileKey.keys()]),
  );

  const profiles: CounterRankingV2ChampionProfile[] = [];

  for (const profileKey of profileKeys) {
      const traitRow = traitRowsByProfileKey.get(profileKey);
      const vulnerabilityRow = vulnerabilityRowsByProfileKey.get(profileKey);
      const championId = traitRow?.champion_id ?? vulnerabilityRow?.champion_id ?? "";
      const role = traitRow?.role ?? vulnerabilityRow?.role ?? "mid";
      const baseProfile = getCounterRankingV2ChampionProfile(championId, undefined, undefined, role);
      const generatedProfile = createCounterRankingV2GeneratedDraftChampionProfile(championId, role);
      const fallbackProfile = baseProfile ?? generatedProfile;

      const profile: CounterRankingV2ChampionProfile = {
        ...fallbackProfile,
        notes: traitRow?.identity_summary ?? traitRow?.notes ?? fallbackProfile.notes,
        role,
        strengths:
          normalizeCounterRankingV2ProfileTraits(traitRow?.strengths) ?? fallbackProfile.strengths,
        vulnerabilities:
          normalizeCounterRankingV2ProfileTraits(vulnerabilityRow?.vulnerabilities) ??
          fallbackProfile.vulnerabilities,
        version: Math.max(
          fallbackProfile.version,
          traitRow?.profile_version ?? 0,
          vulnerabilityRow?.profile_version ?? 0,
        ),
      };
      const identitySummary = traitRow?.identity_summary ?? fallbackProfile.identitySummary;
      const knownStrengths =
        normalizeTextList(traitRow?.known_strengths) ?? fallbackProfile.knownStrengths;
      const knownWeaknesses =
        normalizeTextList(vulnerabilityRow?.known_weaknesses) ?? fallbackProfile.knownWeaknesses;
      const masteryRequirement =
        normalizeMasteryRequirement(traitRow?.mastery_requirement) ??
        fallbackProfile.masteryRequirement;

      if (identitySummary) {
        profile.identitySummary = identitySummary;
      }

      if (knownStrengths) {
        profile.knownStrengths = knownStrengths;
      }

      if (knownWeaknesses) {
        profile.knownWeaknesses = knownWeaknesses;
      }

      if (masteryRequirement) {
        profile.masteryRequirement = masteryRequirement;
      }

      profiles.push(profile);
  }

  return profiles;
}

function validateCounterRankingV2ProfileManagementInput(
  input: SaveCounterRankingV2ProfileManagementInput,
):
  | {
      championId: string;
      identitySummary: string | null;
      knownStrengths: string[];
      knownWeaknesses: string[];
      masteryRequirement: ChampionMasteryRequirementLevel | null;
      ok: true;
      reviewNote: string | null;
      role: LeagueRole;
      status: CounterRankingV2ProfileStatus;
      strengths: CounterRankingV2ProfileTrait[];
      vulnerabilities: CounterRankingV2ProfileTrait[];
    }
  | {
      error: string;
      ok: false;
    } {
  const championId = normalizeChampionIdForReview(input.championId);
  const role = input.role;
  const status = normalizeCounterRankingV2ProfileStatus(input.status);
  const strengths = validateCounterRankingV2ProfileTraits(input.strengths, "trait");
  const vulnerabilities = validateCounterRankingV2ProfileTraits(
    input.vulnerabilities,
    "vulnerability",
  );

  if (!championId) {
    return {
      error: "Select a champion profile before saving profile edits.",
      ok: false,
    };
  }

  if (!status) {
    return {
      error: "Select a valid profile status.",
      ok: false,
    };
  }

  if (!leagueRoles.includes(role)) {
    return {
      error: "Select a valid role before saving profile review.",
      ok: false,
    };
  }

  if (!leagueRoles.includes(role)) {
    return {
      error: "Select a valid role before saving profile edits.",
      ok: false,
    };
  }

  if (!strengths.ok) {
    return strengths;
  }

  if (!vulnerabilities.ok) {
    return vulnerabilities;
  }

  return {
    championId,
    identitySummary: nullableTrim(input.identitySummary),
    knownStrengths: normalizeStringList(input.knownStrengths),
    knownWeaknesses: normalizeStringList(input.knownWeaknesses),
    masteryRequirement: normalizeMasteryRequirement(input.masteryRequirement),
    ok: true,
    reviewNote: nullableTrim(input.reviewNote),
    role,
    status,
    strengths: strengths.traits,
    vulnerabilities: vulnerabilities.traits,
  };
}

function validateCounterRankingV2ProfileCanBeReviewed(profile: CounterRankingV2ChampionProfile):
  | {
      ok: true;
    }
  | {
      error: string;
      ok: false;
    } {
  if (!profile.championId.trim()) {
    return {
      error: "champion_id is missing.",
      ok: false,
    };
  }

  if (!leagueRoles.includes(profile.role)) {
    return {
      error: "role is missing or invalid.",
      ok: false,
    };
  }

  if (profile.strengths.length === 0) {
    return {
      error: "strengths are empty.",
      ok: false,
    };
  }

  if (profile.vulnerabilities.length === 0) {
    return {
      error: "weaknesses are empty.",
      ok: false,
    };
  }

  const strengths = validateCounterRankingV2ProfileTraits(profile.strengths, "strength");

  if (!strengths.ok) {
    return strengths;
  }

  const vulnerabilities = validateCounterRankingV2ProfileTraits(
    profile.vulnerabilities,
    "weakness",
  );

  if (!vulnerabilities.ok) {
    return vulnerabilities;
  }

  return {
    ok: true,
  };
}

function dedupeCounterRankingV2ProfileReviewTargets(
  profiles: MarkCounterRankingV2ProfileReviewedTarget[],
) {
  const profilesByKey = new Map<string, MarkCounterRankingV2ProfileReviewedTarget>();

  for (const profile of profiles) {
    const championId = profile.championId.trim();
    const role = profile.role;
    const profileKey = getCounterRankingV2ProfileKey(championId, role);

    if (!championId || profilesByKey.has(profileKey)) {
      continue;
    }

    profilesByKey.set(profileKey, {
      championId,
      role,
    });
  }

  return Array.from(profilesByKey.values());
}

function validateCounterRankingV2ProfileTraits(
  inputTraits: CounterRankingV2ProfileTrait[],
  label: string,
):
  | {
      ok: true;
      traits: CounterRankingV2ProfileTrait[];
    }
  | {
      error: string;
      ok: false;
    } {
  const seenTraitIds = new Set<string>();
  const traits: CounterRankingV2ProfileTrait[] = [];

  for (const trait of inputTraits) {
    const traitId = normalizeCounterRankingV2TraitId(trait.traitId);
    const weight = Number(trait.weight);

    if (!traitId) {
      return {
        error: `Select a valid ${label}.`,
        ok: false,
      };
    }

    if (seenTraitIds.has(traitId)) {
      return {
        error: `Remove duplicate ${label} entries before saving.`,
        ok: false,
      };
    }

    if (!isCounterRankingV2ProfileValueInBounds(weight)) {
      return {
        error: `${getTraitLabelForAction(traitId)} must be between 0 and 10.`,
        ok: false,
      };
    }

    seenTraitIds.add(traitId);
    traits.push({ traitId, weight });
  }

  return {
    ok: true,
    traits,
  };
}

function normalizeCounterRankingV2ProfileTraits(
  value: unknown,
): CounterRankingV2ProfileTrait[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const traitsById = new Map<CounterRankingV2TraitId, CounterRankingV2ProfileTrait>();

  for (const item of value) {
    const record = item as { traitId?: unknown; trait_id?: unknown; weight?: unknown };
    const traitId = normalizeCounterRankingV2TraitId(record.traitId ?? record.trait_id);
    const weight = Number(record.weight);

    if (!traitId || !Number.isFinite(weight)) {
      continue;
    }

    const existingTrait = traitsById.get(traitId);
    const normalizedTrait = { traitId, weight };

    traitsById.set(
      traitId,
      existingTrait && existingTrait.weight > normalizedTrait.weight
        ? existingTrait
        : normalizedTrait,
    );
  }

  return Array.from(traitsById.values());
}

function normalizeTextList(value: unknown) {
  return Array.isArray(value) ? normalizeStringList(value.map(String)) : null;
}

function normalizeStringList(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean).map((value) => value.slice(0, 160))),
  );
}

function normalizeMasteryRequirement(value: unknown): ChampionMasteryRequirementLevel | null {
  return value === "low" || value === "moderate" || value === "high" || value === "very_high"
    ? value
    : null;
}

function getTraitLabelForAction(traitId: CounterRankingV2TraitId) {
  return counterRankingV2TraitDefinitionsById.get(traitId)?.label ?? traitId;
}

function isCounterRankingV2BatchAction(
  value: string,
): value is BatchCounterRankingV2MechanicalReviewAction {
  return value === "approve" || value === "needs_review" || value === "reject";
}

function getCounterRankingV2BatchReviewStatus({
  action,
  mechanicalScore,
}: {
  action: BatchCounterRankingV2MechanicalReviewAction;
  mechanicalScore: number;
}): CounterRankingV2ReviewStatus {
  if (action === "reject") {
    return "incorrect_suggestion";
  }

  if (action === "needs_review") {
    return "needs_more_data";
  }

  return mechanicalScore >= 80 ? "verified_strong_counter" : "verified_soft_counter";
}

function getCounterRankingV2BatchReviewNote(
  action: BatchCounterRankingV2MechanicalReviewAction,
) {
  switch (action) {
    case "approve":
      return "Batch approved from Counter Ranking V2 auto-approval candidates.";
    case "needs_review":
      return "Batch marked for manual review from Counter Ranking V2 auto-approval candidates.";
    case "reject":
      return "Batch rejected from Counter Ranking V2 auto-approval candidates.";
  }
}

function normalizeChampionIdForReview(championId: string) {
  return championId.trim().toLowerCase();
}

function nullableTrim(value: string | null) {
  const trimmedValue = value?.trim() ?? "";

  return trimmedValue || null;
}

function getRegistryRowLabel(row: { id?: string | null; name?: string | null }) {
  const id = row.id ?? "unknown";

  return row.name ? `${row.name} (${id})` : id;
}
