import Image from "next/image";
import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Square,
  Trash2,
  X,
} from "lucide-react";

import {
  backfillCounterRankingV2GeneratedDraftProfiles,
  batchSaveCounterRankingV2MechanicalReviews,
  getCounterPickManagementMetrics,
  getCounterRankingV2AllMechanicalReviews,
  getCounterRankingV2EditableProfiles,
  getCounterRankingV2MechanicalReviews,
  getCounterRankingV2ProfileReviews,
  markCounterRankingV2ProfilesReviewed,
  saveCounterRankingV2ProfileManagement,
  saveCounterRankingV2MechanicalReview,
  type BatchCounterRankingV2MechanicalReviewAction,
} from "@/src/app/admin/league/counter-picks/actions";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import type { CounterPickManagementMetrics } from "@/src/features/league/counter-pick-management-metrics";
import { fetchCounterPickStatsByEnemyAndRole } from "@/src/features/league/counter-pick-stats";
import {
  compareCounterPickStatistics,
  publicCounterPickMinimumRankedGames,
  toPublicCounterPickResult,
} from "@/src/features/league/counter-pick-statistics";
import {
  counterRankingV2SupportedChampionIds,
  counterRankingV2ChampionProfiles,
  counterRankingV2ProfileStatuses,
  counterRankingV2AdjustmentReasons,
  counterRankingV2ReviewStatuses,
  counterRankingV2TraitDefinitionsById,
  counterRankingV2TraitVocabulary,
  createCounterRankingV2ImprovedDraftProfileSuggestion,
  createObservedCounterRankingV2Snapshot,
  calculateCounterRankingV2FinalMechanicalScore,
  canAddCounterRankingV2PublicCounter,
  counterRankingV2DefaultAdjustmentReason,
  counterRankingV2DefaultReviewStatus,
  counterRankingV2PublicCounterCaps,
  clampCounterRankingV2ManualAdjustment,
  createEmptyCounterRankingV2PublicCounterCapCounts,
  filterCounterRankingV2RowsByReviewFilter,
  generateCounterRankingV2MechanicalSuggestionsForRole,
  getCounterRankingV2MechanicalReasons,
  getCounterRankingV2ChampionProfile,
  getCounterRankingV2CandidatePoolSummary,
  getCounterRankingV2ProfileKey,
  getCounterRankingV2ProfileImpactLabel,
  getCounterRankingV2PublicCounterCapCounts,
  getCounterRankingV2AutomationBlockerSummary,
  getCounterRankingV2AutomationSummary,
  getCounterRankingV2PublicPreviewRows,
  getCounterRankingV2ReviewProgressSummary,
  hasCounterRankingV2WeakMechanicalSignal,
  isCounterRankingV2ProfileEligibleForDraftImprovement,
  isChampionSupportedInRole,
  isCounterRankingV2TraitDefinitionVisibleForRole,
  isCounterRankingV2ReviewPublicEligible,
  isCounterRankingV2ReviewStatusPublicEligible,
  isCounterRankingV2RowMatchingReviewFilter,
  normalizeCounterRankingV2TraitId,
  sortCounterRankingV2RowsByReviewPriority,
  useReviewedMechanicalCountersPublicly,
  type CounterRankingV2PublicCounterCapCounts,
  type CounterRankingV2AdjustmentReason,
  type CounterRankingV2AutomationBlockerSummary,
  type CounterRankingV2AutomationConfidence,
  type CounterRankingV2AutomationStatus,
  type CounterRankingV2AutomationSummary,
  type CounterRankingV2CandidatePoolSummary,
  type CounterRankingV2ChampionProfile,
  type CounterRankingV2ComparisonRow,
  type CounterRankingV2DraftProfileSuggestion,
  type CounterRankingV2FitStatus,
  type CounterRankingV2FactorImpactLevel,
  type CounterRankingV2MechanicalReview,
  type CounterRankingV2ObservedRankSnapshot,
  type CounterRankingV2ProfileReview,
  type CounterRankingV2ProfileStatus,
  type CounterRankingV2ProfileStatusByChampionId,
  type CounterRankingV2ProfileByChampionId,
  type CounterRankingV2ProfileTrait,
  type CounterRankingV2PublicPreviewRow,
  type CounterRankingV2ReviewFilter,
  type CounterRankingV2ReviewProgressSummary,
  type CounterRankingV2ReviewStatus,
  type CounterRankingV2SuggestedStrength,
  type CounterRankingV2TraitDefinition,
  type CounterRankingV2TraitId,
} from "@/src/features/league/counter-ranking-v2";
import { isChampionInRole, sortChampionsForRole } from "@/src/features/league/champion-roles";
import { getChampionMasteryRequirementLevel } from "@/src/features/league/champion-mastery-requirements";
import type { ChampionMasteryRequirementLevel } from "@/src/features/league/champion-mastery-requirements";
import { getChampionCombatProfile } from "@/src/features/league/champion-knowledge";
import { getChampionIconPath } from "@/src/features/league/champions";
import { leagueRoles, type LeagueRole } from "@/src/features/league/roles";
import { cn } from "@/src/lib/utils";
import { supabase } from "@/src/lib/supabase";
import { fieldClassName, selectOptionClassName } from "../constants";
import type {
  AdminLeagueChampion,
  FormStatus,
  LeagueCounterPick,
  LeagueCounterPickType,
} from "../types";
import { RiotMatchScannerPanel } from "./riot-match-scanner-panel";

type CounterPickStatusFilter = LeagueCounterPick["generation_status"] | "all";
type CounterPickTypeFilter = LeagueCounterPickType | "all";
type CounterPickAdminView =
  | "collect"
  | "editorial"
  | "overview"
  | "profile-review"
  | "review"
  | "shadow-ranking";
type CounterPickEditForm = {
  counter_strength: string;
  counter_type: LeagueCounterPickType;
  reason: string;
};
type CounterPickCreateForm = CounterPickEditForm & {
  counter_champion_id: string;
};
type CounterRankingV2ReviewForm = {
  adjustmentReason: CounterRankingV2AdjustmentReason;
  adminReviewNote: string;
  highMasteryRequired: boolean;
  manualAdjustment: string;
  publicEligible: boolean;
  reviewStatus: CounterRankingV2ReviewStatus;
};
type CounterRankingV2ProfileReviewForm = {
  identitySummary: string;
  knownStrengths: string;
  knownWeaknesses: string;
  masteryRequirement: string;
  reviewNote: string;
  status: CounterRankingV2ProfileStatus;
  strengths: CounterRankingV2ProfileTrait[];
  vulnerabilities: CounterRankingV2ProfileTrait[];
};
type CounterRankingV2ProfileStatusFilter =
  | CounterRankingV2ProfileStatus
  | "all"
  | "improved_draft";
type CounterRankingV2ProfileRoleFilter = LeagueRole | "all";
type CounterRankingV2ShadowReviewFilterOption = {
  filter: CounterRankingV2ReviewFilter;
  label: string;
};
type CounterRankingV2AdminReviewSort =
  | "candidate_champion"
  | "champion_name"
  | "highest_mechanical_score"
  | "lowest_observed_rank_mismatch"
  | "lowest_sample_first"
  | "most_games"
  | "newest_review_update"
  | "review_priority"
  | "target_champion";
type CounterRankingV2AdminReviewMode = "all" | "top_candidates";
type CounterRankingV2AdminReviewDensity = "compact" | "comfortable";
type CounterRankingV2AdminReviewTab =
  | "all_rows"
  | "needs_more_data"
  | "public_counters"
  | "rejected_not_counters"
  | "review_suggestions";
type CounterRankingV2AdminReviewQueueSection =
  | "all"
  | "auto_approval_candidate"
  | "auto_suggested"
  | "needs_review"
  | "low_sample"
  | "public_eligible"
  | "rejected"
  | "needs_more_data";
type CounterRankingV2AdminReviewRow = CounterRankingV2ComparisonRow & {
  candidateProfile: CounterRankingV2ChampionProfile | null;
  rowKey: string;
  targetChampionId: string;
  targetProfile: CounterRankingV2ChampionProfile | null;
  unsupportedRole: boolean;
};
type CounterRankingV2TargetReviewSummary = {
  label: string;
  needsMoreData: number;
  notCounters: number;
  publicEligible: number;
  publicSoft: number;
  publicStrong: number;
  remainingUnreviewed: number;
  targetChampionId: string;
  verifiedSoft: number;
  verifiedStrong: number;
};
type CounterRankingV2AdminBatchReviewStatus = Exclude<
  CounterRankingV2ReviewStatus,
  "unreviewed"
>;

const emptyCreateForm: CounterPickCreateForm = {
  counter_champion_id: "",
  counter_strength: "",
  counter_type: "best_counter",
  reason: "",
};
const counterRankingV2ShadowReviewFilterOptions = [
  { filter: "all", label: "All" },
  { filter: "auto_approval_candidate", label: "Auto approval candidate" },
  { filter: "auto_suggested", label: "Auto suggested" },
  { filter: "auto_approved", label: "Auto approved" },
  { filter: "needs_review", label: "Needs review automation" },
  { filter: "manual_approved", label: "Manual approved" },
  { filter: "manual_rejected", label: "Manual rejected" },
  { filter: "high_mastery_required", label: "High mastery required" },
  { filter: "unreviewed", label: "Unreviewed" },
  { filter: "verified_strong_counter", label: "Verified strong counter" },
  { filter: "verified_soft_counter", label: "Verified soft counter" },
  { filter: "not_a_counter", label: "Not a counter" },
  { filter: "needs_more_data", label: "Needs more data" },
  { filter: "incorrect_suggestion", label: "Incorrect suggestion" },
  { filter: "public_eligible", label: "Public eligible" },
  { filter: "low_sample", label: "Low sample" },
] as const satisfies readonly CounterRankingV2ShadowReviewFilterOption[];
const counterRankingV2AdminReviewSortOptions = [
  { sort: "review_priority", label: "Review priority" },
  { sort: "highest_mechanical_score", label: "Highest mechanical score" },
  { sort: "lowest_observed_rank_mismatch", label: "Lowest observed rank mismatch" },
  { sort: "most_games", label: "Most games" },
  { sort: "lowest_sample_first", label: "Lowest sample first" },
  { sort: "newest_review_update", label: "Newest review/update" },
  { sort: "champion_name", label: "Champion name" },
  { sort: "target_champion", label: "Target champion" },
  { sort: "candidate_champion", label: "Candidate champion" },
] as const satisfies ReadonlyArray<{
  label: string;
  sort: CounterRankingV2AdminReviewSort;
}>;
const counterRankingV2AdminReviewQueueSections = [
  { section: "all", label: "All review rows" },
  { section: "auto_approval_candidate", label: "Auto approval candidates" },
  { section: "auto_suggested", label: "Auto suggested" },
  { section: "needs_review", label: "Needs review" },
  { section: "low_sample", label: "Low sample mechanical counters" },
  { section: "public_eligible", label: "Public eligible reviewed counters" },
  { section: "rejected", label: "Rejected / Not a counter" },
  { section: "needs_more_data", label: "Needs more data" },
] as const satisfies ReadonlyArray<{
  label: string;
  section: CounterRankingV2AdminReviewQueueSection;
}>;
const counterRankingV2AdminReviewTabs = [
  { tab: "public_counters", label: "Public counters" },
  { tab: "review_suggestions", label: "Review suggestions" },
  { tab: "rejected_not_counters", label: "Rejected / Not counters" },
  { tab: "needs_more_data", label: "Needs more data" },
  { tab: "all_rows", label: "All rows" },
] as const satisfies ReadonlyArray<{
  label: string;
  tab: CounterRankingV2AdminReviewTab;
}>;
const counterRankingV2AdminBatchReviewStatuses = [
  "verified_strong_counter",
  "verified_soft_counter",
  "not_a_counter",
  "needs_more_data",
  "incorrect_suggestion",
] as const satisfies readonly CounterRankingV2AdminBatchReviewStatus[];
const counterRankingV2TopCandidateCaps = [5, 10, 15] as const;
const counterRankingV2PublicCounterWarningThreshold = counterRankingV2PublicCounterCaps.total;

export function AdminLeagueCounterPicksSection({
  champions,
  counterPicks,
  onRefresh,
  view = "editorial",
}: {
  champions: AdminLeagueChampion[];
  counterPicks: LeagueCounterPick[];
  onRefresh: () => Promise<boolean>;
  view?: CounterPickAdminView;
}) {
  const [championSearch, setChampionSearch] = useState("");
  const [counterSearch, setCounterSearch] = useState("");
  const [selectedChampionId, setSelectedChampionId] = useState("");
  const [selectedRole, setSelectedRole] = useState<LeagueRole>("mid");
  const [statusFilter, setStatusFilter] = useState<CounterPickStatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<CounterPickTypeFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [editingCounterPickId, setEditingCounterPickId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<CounterPickEditForm>({
    counter_strength: "",
    counter_type: "best_counter",
    reason: "",
  });
  const [createForm, setCreateForm] = useState<CounterPickCreateForm>(emptyCreateForm);
  const [createStatus, setCreateStatus] = useState<FormStatus>({
    error: null,
    isLoading: false,
    success: null,
  });
  const [editStatus, setEditStatus] = useState<FormStatus>({
    error: null,
    isLoading: false,
    success: null,
  });
  const [bulkStatus, setBulkStatus] = useState<FormStatus>({
    error: null,
    isLoading: false,
    success: null,
  });
  const [managementMetrics, setManagementMetrics] = useState<CounterPickManagementMetrics | null>(
    null,
  );
  const [metricsStatus, setMetricsStatus] = useState<FormStatus>({
    error: null,
    isLoading: true,
    success: null,
  });
  const [counterRankingV2ObservedByChampionId, setCounterRankingV2ObservedByChampionId] = useState<
    Map<string, CounterRankingV2ObservedRankSnapshot>
  >(() => new Map());
  const [counterRankingV2ReviewsByCandidateId, setCounterRankingV2ReviewsByCandidateId] = useState<
    Map<string, CounterRankingV2MechanicalReview>
  >(() => new Map());
  const [counterRankingV2AllReviewsByKey, setCounterRankingV2AllReviewsByKey] = useState<
    Map<string, CounterRankingV2MechanicalReview>
  >(() => new Map());
  const [counterRankingV2ProfileReviewsByChampionId, setCounterRankingV2ProfileReviewsByChampionId] =
    useState<Map<string, CounterRankingV2ProfileReview>>(() => new Map());
  const [
    counterRankingV2ProfileOverridesByChampionId,
    setCounterRankingV2ProfileOverridesByChampionId,
  ] = useState<CounterRankingV2ProfileByChampionId>(() => new Map());
  const [counterRankingV2Status, setCounterRankingV2Status] = useState<FormStatus>({
    error: null,
    isLoading: false,
    success: null,
  });
  const [counterRankingV2ReviewStatus, setCounterRankingV2ReviewStatus] = useState<FormStatus>({
    error: null,
    isLoading: false,
    success: null,
  });
  const [counterRankingV2ProfileReviewStatus, setCounterRankingV2ProfileReviewStatus] =
    useState<FormStatus>({
      error: null,
      isLoading: false,
      success: null,
    });
  const [savingCounterRankingV2ReviewKey, setSavingCounterRankingV2ReviewKey] = useState<
    string | null
  >(null);
  const [savingCounterRankingV2ProfileReviewId, setSavingCounterRankingV2ProfileReviewId] =
    useState<string | null>(null);
  const [hasResolvedInitialSelection, setHasResolvedInitialSelection] = useState(false);
  const hasInitializedSelection = useRef(false);
  const isCounterRankingV2ProfileWorkspace =
    view === "profile-review" || view === "review" || view === "shadow-ranking";
  const shouldDefaultCounterRankingV2Champion = view === "shadow-ranking";

  const championsById = useMemo(
    () => new Map(champions.map((champion) => [champion.id, champion] as const)),
    [champions],
  );
  const counterRankingV2ChampionsById = useMemo(
    () =>
      new Map(
        champions.map((champion) => [
          normalizeCounterRankingV2ChampionId(champion.id),
          champion,
        ] as const),
      ),
    [champions],
  );
  const counterRankingV2ProfileStatusesByChampionId = useMemo(
    () =>
      new Map(
        Array.from(counterRankingV2ProfileReviewsByChampionId.values()).map((review) => [
          getCounterRankingV2ProfileKey(review.championId, review.role),
          review.status,
        ] as const),
      ) satisfies CounterRankingV2ProfileStatusByChampionId,
    [counterRankingV2ProfileReviewsByChampionId],
  );
  const roleSortedChampions = useMemo(
    () => sortChampionsForRole(champions, selectedRole),
    [champions, selectedRole],
  );
  const championOptions = useMemo(() => {
    const query = championSearch.trim().toLowerCase();
    const includeOffMeta = !isCounterRankingV2ProfileWorkspace;

    return roleSortedChampions.filter((champion) => {
      const matchesQuery =
        !query ||
        champion.name.toLowerCase().includes(query) ||
        champion.id.toLowerCase().includes(query);

      return matchesQuery && isChampionInRole(champion, selectedRole, { includeOffMeta });
    });
  }, [championSearch, isCounterRankingV2ProfileWorkspace, roleSortedChampions, selectedRole]);
  const counterRankingV2DefaultChampionId = useMemo(
    () =>
      counterRankingV2SupportedChampionIds.find((championId) =>
        counterRankingV2ChampionsById.has(championId),
      ) ?? "",
    [counterRankingV2ChampionsById],
  );
  const defaultSelectedChampionId =
    isCounterRankingV2ProfileWorkspace
      ? shouldDefaultCounterRankingV2Champion && hasResolvedInitialSelection
        ? counterRankingV2DefaultChampionId
        : ""
      : (roleSortedChampions.find((champion) =>
          isChampionInRole(champion, selectedRole, {
            includeOffMeta: !isCounterRankingV2ProfileWorkspace,
          }),
        )?.id ?? "");
  const effectiveSelectedChampionId = selectedChampionId
    ? (getChampionIdFromOptionMap(counterRankingV2ChampionsById, selectedChampionId) ??
      (championsById.has(selectedChampionId) ? selectedChampionId : defaultSelectedChampionId))
    : defaultSelectedChampionId;
  const selectedChampion = effectiveSelectedChampionId
    ? championsById.get(effectiveSelectedChampionId)
    : null;
  const championSelectOptions = useMemo(
    () => includeSelectedChampionOption(championOptions, selectedChampion),
    [championOptions, selectedChampion],
  );
  const selectedCounterRankingV2Profile = useMemo(
    () =>
      effectiveSelectedChampionId
        ? getCounterRankingV2ChampionProfile(
            effectiveSelectedChampionId,
            counterRankingV2ProfileStatusesByChampionId,
            counterRankingV2ProfileOverridesByChampionId,
            selectedRole,
          )
        : null,
    [
      counterRankingV2ProfileOverridesByChampionId,
      counterRankingV2ProfileStatusesByChampionId,
      effectiveSelectedChampionId,
      selectedRole,
    ],
  );
  const hasSelectedCounterRankingV2Profile = selectedCounterRankingV2Profile !== null;
  const selectedChampionCombatProfile = useMemo(
    () =>
      effectiveSelectedChampionId ? getChampionCombatProfile(effectiveSelectedChampionId) : null,
    [effectiveSelectedChampionId],
  );
  const createCounterChampionOptions = useMemo(
    () => champions.filter((champion) => champion.id !== effectiveSelectedChampionId),
    [champions, effectiveSelectedChampionId],
  );
  const effectiveCreateCounterChampionId = createCounterChampionOptions.some(
    (champion) => champion.id === createForm.counter_champion_id,
  )
    ? createForm.counter_champion_id
    : (createCounterChampionOptions[0]?.id ?? "");
  const visibleCounterPicks = useMemo(
    () =>
      sortCounterPicksForAdmin(
        counterPicks.filter((counterPick) => {
          const counterChampion = championsById.get(counterPick.counter_champion_id);
          const query = counterSearch.trim().toLowerCase();
          const matchesCounterSearch =
            !query ||
            counterPick.counter_champion_id.toLowerCase().includes(query) ||
            Boolean(counterChampion?.name.toLowerCase().includes(query));

          return (
            counterPick.champion_id === effectiveSelectedChampionId &&
            counterPick.role === selectedRole &&
            (statusFilter === "all" || counterPick.generation_status === statusFilter) &&
            (typeFilter === "all" || counterPick.counter_type === typeFilter) &&
            matchesCounterSearch
          );
        }),
      ),
    [
      championsById,
      counterPicks,
      counterSearch,
      effectiveSelectedChampionId,
      selectedRole,
      statusFilter,
      typeFilter,
    ],
  );
  const allVisibleIds = useMemo(
    () => visibleCounterPicks.map((counterPick) => counterPick.id),
    [visibleCounterPicks],
  );
  const selectedVisibleIds = allVisibleIds.filter((id) => selectedIds.has(id));
  const draftVisibleIds = visibleCounterPicks
    .filter((counterPick) => counterPick.generation_status === "draft")
    .map((counterPick) => counterPick.id);
  const draftSelectedIds = visibleCounterPicks
    .filter((counterPick) => selectedIds.has(counterPick.id))
    .filter((counterPick) => counterPick.generation_status === "draft")
    .map((counterPick) => counterPick.id);
  const reviewedVisibleCount = visibleCounterPicks.filter(
    (counterPick) => counterPick.generation_status === "reviewed",
  ).length;
  const counterRankingV2Rows = useMemo(
    () =>
      effectiveSelectedChampionId && hasSelectedCounterRankingV2Profile
        ? sortCounterRankingV2RowsByReviewPriority(
            generateCounterRankingV2MechanicalSuggestionsForRole({
              enemyChampionId: effectiveSelectedChampionId,
              observedByChampionId: counterRankingV2ObservedByChampionId,
              profileOverridesByChampionId: counterRankingV2ProfileOverridesByChampionId,
              profileStatusesByChampionId: counterRankingV2ProfileStatusesByChampionId,
              reviewsByCandidateId: counterRankingV2ReviewsByCandidateId,
              role: selectedRole,
            }),
          )
        : [],
    [
      counterRankingV2ObservedByChampionId,
      counterRankingV2ProfileOverridesByChampionId,
      counterRankingV2ProfileStatusesByChampionId,
      counterRankingV2ReviewsByCandidateId,
      effectiveSelectedChampionId,
      hasSelectedCounterRankingV2Profile,
      selectedRole,
    ],
  );

  useEffect(() => {
    void loadManagementMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hasInitializedSelection.current || champions.length === 0) {
      return;
    }

    hasInitializedSelection.current = true;

    if (typeof window !== "undefined") {
      const query = new URLSearchParams(window.location.search);
      const requestedChampionId =
        query.get("champion") ?? query.get("enemyChampion") ?? query.get("enemy");
      const requestedRole = normalizeRoleForAdmin(query.get("role"));
      const normalizedRequestedChampion = requestedChampionId
        ? getChampionIdFromOptionMap(counterRankingV2ChampionsById, requestedChampionId)
        : null;

      if (requestedRole) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedRole(requestedRole);
      }

      if (normalizedRequestedChampion) {
        setSelectedChampionId(normalizedRequestedChampion);
        setHasResolvedInitialSelection(true);
        return;
      }
    }

    if (shouldDefaultCounterRankingV2Champion && counterRankingV2DefaultChampionId) {
      setSelectedChampionId(counterRankingV2DefaultChampionId);
      setHasResolvedInitialSelection(true);
      return;
    }

    if (defaultSelectedChampionId) {
      setSelectedChampionId(defaultSelectedChampionId);
    }

    setHasResolvedInitialSelection(true);
  }, [
    champions.length,
    counterRankingV2ChampionsById,
    counterRankingV2DefaultChampionId,
    defaultSelectedChampionId,
    isCounterRankingV2ProfileWorkspace,
    shouldDefaultCounterRankingV2Champion,
  ]);

  useEffect(() => {
    void loadCounterRankingV2ObservedStats();
    void loadCounterRankingV2Reviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSelectedChampionId, selectedRole]);

  useEffect(() => {
    if (!isCounterRankingV2ProfileWorkspace) {
      return;
    }

    void loadCounterRankingV2ProfileReviews();
    void loadCounterRankingV2EditableProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCounterRankingV2ProfileWorkspace]);

  useEffect(() => {
    if (view !== "review") {
      return;
    }

    void loadCounterRankingV2AllReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  async function getAccessToken() {
    if (!supabase) {
      return {
        error: "Supabase is not configured.",
        ok: false as const,
      };
    }

    const { data, error } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (error || !accessToken) {
      return {
        error: "Admin session is not ready.",
        ok: false as const,
      };
    }

    return {
      accessToken,
      ok: true as const,
    };
  }

  async function loadManagementMetrics() {
    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setMetricsStatus({ error: tokenResult.error, isLoading: false, success: null });
      return;
    }

    setMetricsStatus((currentStatus) => ({
      error: null,
      isLoading: true,
      success: currentStatus.success,
    }));

    const result = await getCounterPickManagementMetrics({
      accessToken: tokenResult.accessToken,
    });

    if (!result.ok) {
      setMetricsStatus({ error: result.error, isLoading: false, success: null });
      return;
    }

    setManagementMetrics(result.metrics);
    setMetricsStatus({ error: null, isLoading: false, success: "Metrics refreshed." });
  }

  async function loadCounterRankingV2ObservedStats() {
    if (!effectiveSelectedChampionId || !hasSelectedCounterRankingV2Profile) {
      setCounterRankingV2ObservedByChampionId(new Map());
      setCounterRankingV2Status({ error: null, isLoading: false, success: null });
      return;
    }

    setCounterRankingV2Status({ error: null, isLoading: true, success: null });

    const result = await fetchCounterPickStatsByEnemyAndRole({
      enemyChampionId: effectiveSelectedChampionId,
      rankBracket: "all",
      role: selectedRole,
    });

    if (result.error) {
      setCounterRankingV2ObservedByChampionId(new Map());
      setCounterRankingV2Status({ error: result.error, isLoading: false, success: null });
      return;
    }

    const publicResults = result.stats
      .map((stat) => toPublicCounterPickResult(stat, effectiveSelectedChampionId))
      .filter((row) => row !== null)
      .sort((left, right) => compareCounterPickStatistics(left.statistics, right.statistics, "desc"));
    const observedByChampionId = new Map(
      publicResults.map((resultRow, index) => [
        normalizeCounterRankingV2ChampionId(resultRow.listedChampionId),
        createObservedCounterRankingV2Snapshot({
          games: resultRow.statistics.games,
          rank: index + 1,
          winRate: resultRow.statistics.winRate,
        }),
      ]),
    );

    setCounterRankingV2ObservedByChampionId(observedByChampionId);
    setCounterRankingV2Status({
      error: null,
      isLoading: false,
      success: `${publicResults.length} observed rows loaded.`,
    });
  }

  async function loadCounterRankingV2Reviews() {
    if (!effectiveSelectedChampionId || !hasSelectedCounterRankingV2Profile) {
      setCounterRankingV2ReviewsByCandidateId(new Map());
      setCounterRankingV2ReviewStatus({ error: null, isLoading: false, success: null });
      return;
    }

    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setCounterRankingV2ReviewsByCandidateId(new Map());
      setCounterRankingV2ReviewStatus({
        error: tokenResult.error,
        isLoading: false,
        success: null,
      });
      return;
    }

    setCounterRankingV2ReviewStatus({ error: null, isLoading: true, success: null });

    const result = await getCounterRankingV2MechanicalReviews({
      accessToken: tokenResult.accessToken,
      enemyChampionId: effectiveSelectedChampionId,
      role: selectedRole,
    });

    if (!result.ok) {
      setCounterRankingV2ReviewsByCandidateId(new Map());
      setCounterRankingV2ReviewStatus({ error: result.error, isLoading: false, success: null });
      return;
    }

    setCounterRankingV2ReviewsByCandidateId(
      new Map(
        result.reviews.map((review) => [
          normalizeCounterRankingV2ChampionId(review.counterChampionId),
          review,
        ] as const),
      ),
    );
    setCounterRankingV2ReviewStatus({
      error: null,
      isLoading: false,
      success: result.reviews.length > 0 ? `${result.reviews.length} review rows loaded.` : null,
    });
  }

  async function loadCounterRankingV2ProfileReviews() {
    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setCounterRankingV2ProfileReviewsByChampionId(new Map());
      setCounterRankingV2ProfileReviewStatus({
        error: tokenResult.error,
        isLoading: false,
        success: null,
      });
      return;
    }

    setCounterRankingV2ProfileReviewStatus({ error: null, isLoading: true, success: null });

    const result = await getCounterRankingV2ProfileReviews({
      accessToken: tokenResult.accessToken,
    });

    if (!result.ok) {
      setCounterRankingV2ProfileReviewsByChampionId(new Map());
      setCounterRankingV2ProfileReviewStatus({
        error: result.error,
        isLoading: false,
        success: null,
      });
      return;
    }

    setCounterRankingV2ProfileReviewsByChampionId(
      new Map(
        result.reviews.map((review) => [
          getCounterRankingV2ProfileKey(review.championId, review.role),
          review,
        ] as const),
      ),
    );
    setCounterRankingV2ProfileReviewStatus({
      error: null,
      isLoading: false,
      success:
        result.reviews.length > 0
          ? `${result.reviews.length} profile review rows loaded.`
          : null,
    });
  }

  async function loadCounterRankingV2EditableProfiles() {
    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setCounterRankingV2ProfileOverridesByChampionId(new Map());
      setCounterRankingV2ProfileReviewStatus({
        error: tokenResult.error,
        isLoading: false,
        success: null,
      });
      return;
    }

    const result = await getCounterRankingV2EditableProfiles({
      accessToken: tokenResult.accessToken,
    });

    if (!result.ok) {
      setCounterRankingV2ProfileOverridesByChampionId(new Map());
      setCounterRankingV2ProfileReviewStatus({
        error: result.error,
        isLoading: false,
        success: null,
      });
      return;
    }

    setCounterRankingV2ProfileOverridesByChampionId(
      new Map(
        result.profiles.map((profile) => [
          getCounterRankingV2ProfileKey(profile.championId, profile.role),
          profile,
        ] as const),
      ),
    );
  }

  async function backfillCounterRankingV2ProfileDrafts() {
    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setCounterRankingV2ProfileReviewStatus({
        error: tokenResult.error,
        isLoading: false,
        success: null,
      });
      return;
    }

    setCounterRankingV2ProfileReviewStatus({ error: null, isLoading: true, success: null });

    const result = await backfillCounterRankingV2GeneratedDraftProfiles({
      accessToken: tokenResult.accessToken,
    });

    if (!result.ok) {
      setCounterRankingV2ProfileReviewStatus({
        error: result.error,
        isLoading: false,
        success: null,
      });
      return;
    }

    await Promise.all([loadCounterRankingV2ProfileReviews(), loadCounterRankingV2EditableProfiles()]);

    setCounterRankingV2ProfileReviewStatus({
      error: null,
      isLoading: false,
      success: `Generated draft profile backfill complete: ${result.summary.createdProfiles} created, ${result.summary.repairedProfiles} repaired, ${result.summary.skippedProfiles} skipped, ${result.summary.missingProfiles} missing.`,
    });
  }

  async function loadCounterRankingV2AllReviews() {
    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setCounterRankingV2AllReviewsByKey(new Map());
      setCounterRankingV2ReviewStatus({
        error: tokenResult.error,
        isLoading: false,
        success: null,
      });
      return;
    }

    setCounterRankingV2ReviewStatus({ error: null, isLoading: true, success: null });

    const result = await getCounterRankingV2AllMechanicalReviews({
      accessToken: tokenResult.accessToken,
    });

    if (!result.ok) {
      setCounterRankingV2AllReviewsByKey(new Map());
      setCounterRankingV2ReviewStatus({ error: result.error, isLoading: false, success: null });
      return;
    }

    setCounterRankingV2AllReviewsByKey(
      new Map(
        result.reviews.map((review) => [
          getCounterRankingV2ReviewRowKey({
            candidateChampionId: review.counterChampionId,
            role: review.role,
            targetChampionId: review.enemyChampionId,
          }),
          review,
        ] as const),
      ),
    );
    setCounterRankingV2ReviewStatus({
      error: null,
      isLoading: false,
      success:
        result.reviews.length > 0 ? `${result.reviews.length} review queue rows loaded.` : null,
    });
  }

  async function applyCounterRankingV2DraftProfileImprovements(
    suggestions: CounterRankingV2DraftProfileSuggestion[],
  ) {
    if (suggestions.length === 0) {
      setCounterRankingV2ProfileReviewStatus({
        error: "Select at least one draft profile suggestion to apply.",
        isLoading: false,
        success: null,
      });
      return;
    }

    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setCounterRankingV2ProfileReviewStatus({
        error: tokenResult.error,
        isLoading: false,
        success: null,
      });
      return;
    }

    setCounterRankingV2ProfileReviewStatus({ error: null, isLoading: true, success: null });

    const savedProfiles: CounterRankingV2ChampionProfile[] = [];
    const savedReviews: CounterRankingV2ProfileReview[] = [];

    for (const suggestion of suggestions) {
      const canonicalChampionId =
        counterRankingV2ChampionsById.get(normalizeCounterRankingV2ChampionId(suggestion.championId))
          ?.id ?? suggestion.championId;
      const result = await saveCounterRankingV2ProfileManagement({
        accessToken: tokenResult.accessToken,
        championId: canonicalChampionId,
        identitySummary: suggestion.summary,
        knownStrengths: suggestion.knownStrengths,
        knownWeaknesses: suggestion.knownWeaknesses,
        masteryRequirement: null,
        reviewNote: formatDraftProfileImprovementReviewNote(suggestion),
        role: suggestion.role,
        status: suggestion.proposedStatus,
        strengths: suggestion.strengths,
        vulnerabilities: suggestion.vulnerabilities,
      });

      if (!result.ok) {
        setCounterRankingV2ProfileReviewStatus({
          error: `Draft profile improvement stopped at ${canonicalChampionId} ${getRoleLabel(suggestion.role)}: ${result.error}`,
          isLoading: false,
          success: null,
        });
        return;
      }

      savedProfiles.push(result.profile);
      savedReviews.push(result.review);
    }

    setCounterRankingV2ProfileOverridesByChampionId((currentProfiles) => {
      const nextProfiles = new Map(currentProfiles);

      for (const profile of savedProfiles) {
        nextProfiles.set(getCounterRankingV2ProfileKey(profile.championId, profile.role), profile);
      }

      return nextProfiles;
    });
    setCounterRankingV2ProfileReviewsByChampionId((currentReviews) => {
      const nextReviews = new Map(currentReviews);

      for (const review of savedReviews) {
        nextReviews.set(getCounterRankingV2ProfileKey(review.championId, review.role), review);
      }

      return nextReviews;
    });
    setCounterRankingV2ProfileReviewStatus({
      error: null,
      isLoading: false,
      success: `Applied ${savedProfiles.length} draft profile improvement${savedProfiles.length === 1 ? "" : "s"}.`,
    });
  }

  async function markCounterRankingV2ProfileTargetsReviewed(
    targets: Array<{ championId: string; role: LeagueRole }>,
  ) {
    if (targets.length === 0) {
      setCounterRankingV2ProfileReviewStatus({
        error: "Select at least one eligible mechanical profile to mark reviewed.",
        isLoading: false,
        success: null,
      });
      return;
    }

    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setCounterRankingV2ProfileReviewStatus({
        error: tokenResult.error,
        isLoading: false,
        success: null,
      });
      return;
    }

    setCounterRankingV2ProfileReviewStatus({ error: null, isLoading: true, success: null });

    const result = await markCounterRankingV2ProfilesReviewed({
      accessToken: tokenResult.accessToken,
      profiles: targets,
    });

    if (!result.ok) {
      setCounterRankingV2ProfileReviewStatus({
        error: result.error,
        isLoading: false,
        success: null,
      });
      return;
    }

    setCounterRankingV2ProfileReviewsByChampionId((currentReviews) => {
      const nextReviews = new Map(currentReviews);

      for (const review of result.reviews) {
        nextReviews.set(getCounterRankingV2ProfileKey(review.championId, review.role), review);
      }

      return nextReviews;
    });
    setCounterRankingV2ProfileReviewStatus({
      error: null,
      isLoading: false,
      success: `Marked ${result.reviews.length} mechanical profile${result.reviews.length === 1 ? "" : "s"} reviewed${result.skipped.length > 0 ? `; skipped ${result.skipped.length}.` : "."}`,
    });
  }

  async function saveCounterRankingV2ProfileReviewForm({
    championId,
    form,
    role,
  }: {
    championId: string;
    form: CounterRankingV2ProfileReviewForm;
    role: LeagueRole;
  }) {
    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setCounterRankingV2ProfileReviewStatus({
        error: tokenResult.error,
        isLoading: false,
        success: null,
      });
      return;
    }

    setSavingCounterRankingV2ProfileReviewId(getCounterRankingV2ProfileKey(championId, role));
    setCounterRankingV2ProfileReviewStatus({ error: null, isLoading: true, success: null });

    const canonicalChampionId =
      counterRankingV2ChampionsById.get(normalizeCounterRankingV2ChampionId(championId))?.id ??
      championId;
    const result = await saveCounterRankingV2ProfileManagement({
      accessToken: tokenResult.accessToken,
      championId: canonicalChampionId,
      identitySummary: form.identitySummary,
      knownStrengths: splitProfileTextLines(form.knownStrengths),
      knownWeaknesses: splitProfileTextLines(form.knownWeaknesses),
      masteryRequirement:
        form.masteryRequirement === ""
          ? null
          : (form.masteryRequirement as ChampionMasteryRequirementLevel),
      reviewNote: form.reviewNote,
      role,
      status: form.status,
      strengths: form.strengths,
      vulnerabilities: form.vulnerabilities,
    });

    setSavingCounterRankingV2ProfileReviewId(null);

    if (!result.ok) {
      setCounterRankingV2ProfileReviewStatus({
        error: result.error,
        isLoading: false,
        success: null,
      });
      return;
    }

    setCounterRankingV2ProfileReviewsByChampionId((currentReviews) => {
      const nextReviews = new Map(currentReviews);

      nextReviews.set(getCounterRankingV2ProfileKey(result.review.championId, result.review.role), result.review);
      return nextReviews;
    });
    setCounterRankingV2ProfileOverridesByChampionId((currentProfiles) => {
      const nextProfiles = new Map(currentProfiles);

      nextProfiles.set(getCounterRankingV2ProfileKey(result.profile.championId, result.profile.role), result.profile);
      return nextProfiles;
    });
    setCounterRankingV2ProfileReviewStatus({
      error: null,
      isLoading: false,
      success:
        result.review.status === "reviewed"
          ? "Mechanical profile promoted to reviewed."
          : "Mechanical profile review saved.",
    });
  }

  async function saveCounterRankingV2Review(
    row: CounterRankingV2ComparisonRow,
    form: CounterRankingV2ReviewForm,
  ) {
    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setCounterRankingV2ReviewStatus({
        error: tokenResult.error,
        isLoading: false,
        success: null,
      });
      return;
    }

    const manualAdjustment = Number(form.manualAdjustment);

    if (!Number.isFinite(manualAdjustment)) {
      setCounterRankingV2ReviewStatus({
        error: "Manual adjustment must be a finite number.",
        isLoading: false,
        success: null,
      });
      return;
    }

    setSavingCounterRankingV2ReviewKey(row.candidateChampionId);
    setCounterRankingV2ReviewStatus({ error: null, isLoading: true, success: null });

    const canonicalCounterChampionId =
      counterRankingV2ChampionsById.get(normalizeCounterRankingV2ChampionId(row.candidateChampionId))
        ?.id ?? row.candidateChampionId;
    const canonicalEnemyChampionId =
      counterRankingV2ChampionsById.get(
        normalizeCounterRankingV2ChampionId(row.mechanicalResult.enemyChampionId),
      )?.id ?? row.mechanicalResult.enemyChampionId;

    const result = await saveCounterRankingV2MechanicalReview({
      accessToken: tokenResult.accessToken,
      adjustmentReason: form.adjustmentReason,
      adminReviewNote: form.adminReviewNote,
      counterChampionId: canonicalCounterChampionId,
      enemyChampionId: canonicalEnemyChampionId,
      highMasteryRequired: form.highMasteryRequired,
      manualAdjustment,
      publicEligible: form.publicEligible,
      reviewStatus: form.reviewStatus,
      role: row.mechanicalResult.role ?? selectedRole,
    });

    setSavingCounterRankingV2ReviewKey(null);

    if (!result.ok) {
      setCounterRankingV2ReviewStatus({ error: result.error, isLoading: false, success: null });
      return;
    }

    setCounterRankingV2ReviewsByCandidateId((currentReviews) => {
      const nextReviews = new Map(currentReviews);

      nextReviews.set(normalizeCounterRankingV2ChampionId(result.review.counterChampionId), result.review);
      return nextReviews;
    });
    setCounterRankingV2AllReviewsByKey((currentReviews) => {
      const nextReviews = new Map(currentReviews);

      nextReviews.set(
        getCounterRankingV2ReviewRowKey({
          candidateChampionId: result.review.counterChampionId,
          role: result.review.role,
          targetChampionId: result.review.enemyChampionId,
        }),
        result.review,
      );
      return nextReviews;
    });
    setCounterRankingV2ReviewStatus({
      error: null,
      isLoading: false,
      success: "Mechanical review saved.",
    });
  }

  async function batchSaveCounterRankingV2Reviews({
    action,
    publicEligible,
    rows,
  }: {
    action: BatchCounterRankingV2MechanicalReviewAction;
    publicEligible: boolean;
    rows: CounterRankingV2ComparisonRow[];
  }) {
    if (rows.length === 0) {
      setCounterRankingV2ReviewStatus({
        error: "Select at least one auto-approval candidate first.",
        isLoading: false,
        success: null,
      });
      return;
    }

    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setCounterRankingV2ReviewStatus({
        error: tokenResult.error,
        isLoading: false,
        success: null,
      });
      return;
    }

    setSavingCounterRankingV2ReviewKey("batch");
    setCounterRankingV2ReviewStatus({ error: null, isLoading: true, success: null });

    const canonicalEnemyChampionId =
      counterRankingV2ChampionsById.get(
        normalizeCounterRankingV2ChampionId(rows[0]?.mechanicalResult.enemyChampionId ?? ""),
      )?.id ??
      rows[0]?.mechanicalResult.enemyChampionId ??
      effectiveSelectedChampionId;
    const canonicalCounterChampionIds = rows.map(
      (row) =>
        counterRankingV2ChampionsById.get(normalizeCounterRankingV2ChampionId(row.candidateChampionId))
          ?.id ?? row.candidateChampionId,
    );

    const result = await batchSaveCounterRankingV2MechanicalReviews({
      accessToken: tokenResult.accessToken,
      action,
      counterChampionIds: canonicalCounterChampionIds,
      enemyChampionId: canonicalEnemyChampionId,
      publicEligible,
      role: selectedRole,
    });

    setSavingCounterRankingV2ReviewKey(null);

    if (!result.ok) {
      setCounterRankingV2ReviewStatus({ error: result.error, isLoading: false, success: null });
      return;
    }

    setCounterRankingV2ReviewsByCandidateId((currentReviews) => {
      const nextReviews = new Map(currentReviews);

      for (const review of result.reviews) {
        nextReviews.set(normalizeCounterRankingV2ChampionId(review.counterChampionId), review);
      }

      return nextReviews;
    });
    setCounterRankingV2AllReviewsByKey((currentReviews) => {
      const nextReviews = new Map(currentReviews);

      for (const review of result.reviews) {
        nextReviews.set(
          getCounterRankingV2ReviewRowKey({
            candidateChampionId: review.counterChampionId,
            role: review.role,
            targetChampionId: review.enemyChampionId,
          }),
          review,
        );
      }

      return nextReviews;
    });
    setCounterRankingV2ReviewStatus({
      error: null,
      isLoading: false,
      success: `${result.reviews.length} mechanical reviews updated by batch action.${result.publicCapLimitedCount > 0 ? ` Public cap reached. Rows were reviewed but not made public (${result.publicCapLimitedCount}).` : ""}`,
    });
  }

  async function batchSaveCounterRankingV2ReviewQueueRows({
    approveMode,
    publicEligible,
    rows,
    reviewStatus,
  }: {
    approveMode?: "public_up_to_cap" | "reviewed_only";
    publicEligible?: boolean;
    rows: CounterRankingV2AdminReviewRow[];
    reviewStatus?: CounterRankingV2AdminBatchReviewStatus;
  }) {
    if (rows.length === 0) {
      setCounterRankingV2ReviewStatus({
        error: "Select at least one review queue row first.",
        isLoading: false,
        success: null,
      });
      return;
    }

    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setCounterRankingV2ReviewStatus({
        error: tokenResult.error,
        isLoading: false,
        success: null,
      });
      return;
    }

    setSavingCounterRankingV2ReviewKey("batch");
    setCounterRankingV2ReviewStatus({ error: null, isLoading: true, success: null });

    const savedReviews: CounterRankingV2MechanicalReview[] = [];
    const publicCapTracker = createCounterRankingV2PublicCapTracker(rows);
    let publicCapLimitedCount = 0;
    const skippedRows: string[] = [];

    for (const row of rows) {
      const nextReviewStatus =
        approveMode === "public_up_to_cap" || approveMode === "reviewed_only"
          ? getCounterRankingV2AdminBatchApprovalStatus(row)
          : reviewStatus ?? row.review?.reviewStatus ?? "unreviewed";
      const canBePublicEligible =
        nextReviewStatus === "verified_strong_counter" ||
        nextReviewStatus === "verified_soft_counter";
      const requestedPublicEligible =
        approveMode === "reviewed_only"
          ? false
          : approveMode === "public_up_to_cap"
            ? true
            : publicEligible;
      const nextPublicEligible =
        requestedPublicEligible === undefined
          ? canBePublicEligible && Boolean(row.review?.publicEligible)
          : canBePublicEligible && requestedPublicEligible;

      if (publicEligible === true && !canBePublicEligible) {
        skippedRows.push(row.rowKey);
        continue;
      }

      const publicCapResult = applyCounterRankingV2PublicCapForBatchRow({
        nextPublicEligible,
        publicCapTracker,
        reviewStatus: nextReviewStatus,
        row,
      });

      const result = await saveCounterRankingV2MechanicalReview({
        accessToken: tokenResult.accessToken,
        adjustmentReason: row.review?.adjustmentReason ?? counterRankingV2DefaultAdjustmentReason,
        adminReviewNote: row.review?.adminReviewNote ?? null,
        counterChampionId:
          counterRankingV2ChampionsById.get(normalizeCounterRankingV2ChampionId(row.candidateChampionId))
            ?.id ?? row.candidateChampionId,
        enemyChampionId:
          counterRankingV2ChampionsById.get(normalizeCounterRankingV2ChampionId(row.targetChampionId))
            ?.id ?? row.targetChampionId,
        highMasteryRequired: row.review?.highMasteryRequired ?? false,
        manualAdjustment: row.review?.manualAdjustment ?? 0,
        publicEligible: publicCapResult.publicEligible,
        reviewStatus: nextReviewStatus,
        role: row.mechanicalResult.role ?? selectedRole,
      });

      publicCapLimitedCount += publicCapResult.capLimited ? 1 : 0;

      if (!result.ok) {
        setSavingCounterRankingV2ReviewKey(null);
        setCounterRankingV2ReviewStatus({
          error: `${savedReviews.length} saved, ${skippedRows.length} skipped before error: ${result.error}`,
          isLoading: false,
          success: null,
        });
        return;
      }

      savedReviews.push(result.review);
    }

    setSavingCounterRankingV2ReviewKey(null);
    setCounterRankingV2AllReviewsByKey((currentReviews) => {
      const nextReviews = new Map(currentReviews);

      for (const review of savedReviews) {
        nextReviews.set(
          getCounterRankingV2ReviewRowKey({
            candidateChampionId: review.counterChampionId,
            role: review.role,
            targetChampionId: review.enemyChampionId,
          }),
          review,
        );
      }

      return nextReviews;
    });
    setCounterRankingV2ReviewsByCandidateId((currentReviews) => {
      const nextReviews = new Map(currentReviews);

      for (const review of savedReviews) {
        if (
          normalizeCounterRankingV2ChampionId(review.enemyChampionId) ===
            normalizeCounterRankingV2ChampionId(effectiveSelectedChampionId) &&
          review.role === selectedRole
        ) {
          nextReviews.set(normalizeCounterRankingV2ChampionId(review.counterChampionId), review);
        }
      }

      return nextReviews;
    });
    setCounterRankingV2ReviewStatus({
      error: null,
      isLoading: false,
      success: `${savedReviews.length} review queue row${savedReviews.length === 1 ? "" : "s"} updated${skippedRows.length > 0 ? `; skipped ${skippedRows.length} ineligible row${skippedRows.length === 1 ? "" : "s"}` : ""}${publicCapLimitedCount > 0 ? `${skippedRows.length > 0 ? "; " : "; "}Public cap reached. Rows were reviewed but not made public (${publicCapLimitedCount}).` : "."}`,
    });
  }

  function startEditingCounterPick(counterPick: LeagueCounterPick) {
    setEditingCounterPickId(counterPick.id);
    setEditStatus({ error: null, isLoading: false, success: null });
    setEditForm({
      counter_strength: counterPick.counter_strength ?? "",
      counter_type: counterPick.counter_type,
      reason: counterPick.reason ?? "",
    });
  }

  function stopEditingCounterPick() {
    setEditingCounterPickId(null);
    setEditStatus({ error: null, isLoading: false, success: null });
  }

  function toggleSelectedId(counterPickId: number) {
    setSelectedIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(counterPickId)) {
        nextIds.delete(counterPickId);
      } else {
        nextIds.add(counterPickId);
      }

      return nextIds;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((currentIds) => {
      const hasAllVisibleSelected =
        allVisibleIds.length > 0 && allVisibleIds.every((id) => currentIds.has(id));
      const nextIds = new Set(currentIds);

      for (const id of allVisibleIds) {
        if (hasAllVisibleSelected) {
          nextIds.delete(id);
        } else {
          nextIds.add(id);
        }
      }

      return nextIds;
    });
  }

  async function refreshAfterMutation(success: string, setStatus: (status: FormStatus) => void) {
    const didRefresh = await onRefresh();
    await loadManagementMetrics();

    setStatus({
      error: didRefresh ? null : "Saved, but the refreshed admin data could not be loaded.",
      isLoading: false,
      success: didRefresh ? success : null,
    });
  }

  async function handleCreateCounterPick(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setCreateStatus({ error: "Supabase is not configured.", isLoading: false, success: null });
      return;
    }

    if (!effectiveSelectedChampionId || !effectiveCreateCounterChampionId) {
      setCreateStatus({
        error: "Select a champion, role, and counter champion.",
        isLoading: false,
        success: null,
      });
      return;
    }

    if (effectiveSelectedChampionId === effectiveCreateCounterChampionId) {
      setCreateStatus({
        error: "A champion cannot counter itself.",
        isLoading: false,
        success: null,
      });
      return;
    }

    setCreateStatus({ error: null, isLoading: true, success: null });

    const { error } = await supabase.from("league_counter_picks").upsert(
      {
        champion_id: effectiveSelectedChampionId,
        counter_champion_id: effectiveCreateCounterChampionId,
        counter_strength: nullableTrim(createForm.counter_strength),
        counter_type: createForm.counter_type,
        generation_status: "draft",
        reason: nullableTrim(createForm.reason),
        role: selectedRole,
      },
      {
        onConflict: "champion_id,counter_champion_id,role,counter_type",
      },
    );

    if (error) {
      setCreateStatus({ error: error.message, isLoading: false, success: null });
      return;
    }

    setCreateForm({
      ...emptyCreateForm,
      counter_champion_id: createCounterChampionOptions[0]?.id ?? "",
    });
    await refreshAfterMutation("Counter pick draft saved.", setCreateStatus);
  }

  async function handleSaveCounterPick(counterPick: LeagueCounterPick) {
    if (!supabase) {
      setEditStatus({ error: "Supabase is not configured.", isLoading: false, success: null });
      return;
    }

    setEditStatus({ error: null, isLoading: true, success: null });

    const { error } = await supabase
      .from("league_counter_picks")
      .update({
        counter_strength: nullableTrim(editForm.counter_strength),
        counter_type: editForm.counter_type,
        reason: nullableTrim(editForm.reason),
      })
      .eq("id", counterPick.id);

    if (error) {
      setEditStatus({ error: error.message, isLoading: false, success: null });
      return;
    }

    setEditingCounterPickId(null);
    await refreshAfterMutation("Counter pick updated.", setEditStatus);
  }

  async function updateCounterPickStatus(
    counterPick: LeagueCounterPick,
    generationStatus: LeagueCounterPick["generation_status"],
  ) {
    if (!supabase) {
      setBulkStatus({ error: "Supabase is not configured.", isLoading: false, success: null });
      return;
    }

    setBulkStatus({ error: null, isLoading: true, success: null });

    const { error } = await supabase
      .from("league_counter_picks")
      .update({ generation_status: generationStatus })
      .eq("id", counterPick.id);

    if (error) {
      setBulkStatus({ error: error.message, isLoading: false, success: null });
      return;
    }

    await refreshAfterMutation(
      generationStatus === "reviewed"
        ? "Counter pick reviewed."
        : "Counter pick reverted to draft.",
      setBulkStatus,
    );
  }

  async function approveCounterPickIds(counterPickIds: number[], label: string) {
    if (!supabase || counterPickIds.length === 0) {
      return;
    }

    setBulkStatus({ error: null, isLoading: true, success: null });

    const { error } = await supabase
      .from("league_counter_picks")
      .update({ generation_status: "reviewed" })
      .in("id", counterPickIds);

    if (error) {
      setBulkStatus({ error: error.message, isLoading: false, success: null });
      return;
    }

    await refreshAfterMutation(label, setBulkStatus);
  }

  async function deleteCounterPickIds(counterPickIds: number[], label: string) {
    if (!supabase || counterPickIds.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${counterPickIds.length} counter pick${counterPickIds.length === 1 ? "" : "s"}?`,
    );

    if (!confirmed) {
      return;
    }

    setBulkStatus({ error: null, isLoading: true, success: null });

    const { error } = await supabase.from("league_counter_picks").delete().in("id", counterPickIds);

    if (error) {
      setBulkStatus({ error: error.message, isLoading: false, success: null });
      return;
    }

    setSelectedIds(new Set());
    setEditingCounterPickId(null);
    await refreshAfterMutation(label, setBulkStatus);
  }

  if (view === "overview") {
    return (
      <div className="space-y-6">
        <CounterPickManagementMetricsPanel
          error={metricsStatus.error}
          isLoading={metricsStatus.isLoading}
          metrics={managementMetrics}
          onRefresh={() => void loadManagementMetrics()}
        />
        <CounterPickOverviewOperationsPanel
          isLoading={metricsStatus.isLoading}
          metrics={managementMetrics}
        />
        <CounterPickAdminLinks />
      </div>
    );
  }

  if (view === "collect") {
    return (
      <div className="space-y-6">
        <CounterPickManagementMetricsPanel
          error={metricsStatus.error}
          isLoading={metricsStatus.isLoading}
          metrics={managementMetrics}
          onRefresh={() => void loadManagementMetrics()}
        />
        <RiotMatchScannerPanel champions={champions} onScanTerminal={loadManagementMetrics} />
      </div>
    );
  }

  if (view === "profile-review") {
    return (
      <div className="space-y-6">
        <CounterRankingV2ProfileReviewPanel
          championsById={counterRankingV2ChampionsById}
          isSaving={savingCounterRankingV2ProfileReviewId !== null}
          onApplyDraftImprovements={(suggestions) =>
            void applyCounterRankingV2DraftProfileImprovements(suggestions)
          }
          onBackfillDrafts={() => void backfillCounterRankingV2ProfileDrafts()}
          onMarkProfilesReviewed={(targets) =>
            void markCounterRankingV2ProfileTargetsReviewed(targets)
          }
          onRefresh={() => {
            void loadCounterRankingV2ProfileReviews();
            void loadCounterRankingV2EditableProfiles();
          }}
          onSaveReview={(championId, role, form) =>
            void saveCounterRankingV2ProfileReviewForm({ championId, form, role })
          }
          onSelectProfile={(championId, role) => {
            const champion = counterRankingV2ChampionsById.get(
              normalizeCounterRankingV2ChampionId(championId),
            );

            setSelectedChampionId(champion?.id ?? championId);
            setSelectedRole(role);
            setChampionSearch(champion?.name ?? championId);
          }}
          profileReviewsByChampionId={counterRankingV2ProfileReviewsByChampionId}
          profileOverridesByChampionId={counterRankingV2ProfileOverridesByChampionId}
          profileStatusesByChampionId={counterRankingV2ProfileStatusesByChampionId}
          reviewStatus={counterRankingV2ProfileReviewStatus}
          savingChampionId={savingCounterRankingV2ProfileReviewId}
          selectedChampionId={effectiveSelectedChampionId}
          selectedRole={selectedRole}
        />
      </div>
    );
  }

  if (view === "review") {
    return (
      <CounterRankingV2AdminReviewPanel
        allReviewsByKey={counterRankingV2AllReviewsByKey}
        champions={champions}
        championsById={counterRankingV2ChampionsById}
        enemyChampionId={effectiveSelectedChampionId}
        isBatchSaving={savingCounterRankingV2ReviewKey === "batch"}
        observedByChampionId={counterRankingV2ObservedByChampionId}
        onBatchReview={(input) => void batchSaveCounterRankingV2ReviewQueueRows(input)}
        onRefresh={() => {
          void loadCounterRankingV2AllReviews();
          void loadCounterRankingV2ProfileReviews();
          void loadCounterRankingV2EditableProfiles();
        }}
        onSaveReview={(row, form) => void saveCounterRankingV2Review(row, form)}
        onSelectEnemyChampion={(championId) => {
          setSelectedChampionId(championId);
          setChampionSearch(championsById.get(championId)?.name ?? "");
        }}
        onSelectRole={setSelectedRole}
        profileOverridesByChampionId={counterRankingV2ProfileOverridesByChampionId}
        profileStatusesByChampionId={counterRankingV2ProfileStatusesByChampionId}
        reviewStatus={counterRankingV2ReviewStatus}
        savingReviewKey={savingCounterRankingV2ReviewKey}
        selectedRole={selectedRole}
      />
    );
  }

  if (view === "shadow-ranking") {
    return (
      <div className="space-y-6">
        <Card className="border-white/10 bg-[#10182b]/90 text-white shadow-xl shadow-black/15">
          <CardHeader>
            <div>
              <CardTitle className="font-mono text-xl">Counter review target</CardTitle>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                Find counters against the selected champion and role by comparing observed public
                rank against Counter Ranking V2 mechanical fit.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
              <label className="block space-y-2">
                <span className="text-sm text-zinc-300">Search champions</span>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                    aria-hidden="true"
                  />
                  <Input
                    className="h-10 border-white/10 bg-white/5 pl-9 text-zinc-100 placeholder:text-zinc-500 focus-visible:border-violet-400/70 focus-visible:ring-violet-400/20"
                    onChange={(event) => setChampionSearch(event.target.value)}
                    placeholder="Vex, Yone, Yasuo..."
                    type="search"
                    value={championSearch}
                  />
                </div>
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-zinc-300">Find counters against</span>
                <select
                  className={`${fieldClassName} h-10`}
                  onChange={(event) => {
                    const nextChampion = championsById.get(event.target.value);

                    setSelectedChampionId(event.target.value);
                    setChampionSearch(nextChampion?.name ?? "");
                  }}
                  value={effectiveSelectedChampionId}
                >
                  {championSelectOptions.map((champion) => (
                    <option className={selectOptionClassName} key={champion.id} value={champion.id}>
                      {champion.name} (
                      {formatCounterRankingV2ProfileAvailability(
                        champion.id,
                        counterRankingV2ProfileStatusesByChampionId,
                        counterRankingV2ProfileOverridesByChampionId,
                        selectedRole,
                      )}
                      )
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-zinc-300">Role</span>
                <select
                  className={`${fieldClassName} h-10`}
                  onChange={(event) => setSelectedRole(event.target.value as LeagueRole)}
                  value={selectedRole}
                >
                  {leagueRoles.map((role) => (
                    <option className={selectOptionClassName} key={role} value={role}>
                      {getRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-sm leading-6 text-zinc-400">
              Every candidate below is evaluated as a champion picked into the selected target.
            </p>
          </CardContent>
        </Card>

        <CounterRankingV2ShadowPanel
          championsById={counterRankingV2ChampionsById}
          enemyChampionId={effectiveSelectedChampionId}
          isLoading={counterRankingV2Status.isLoading}
          onBatchSaveReview={batchSaveCounterRankingV2Reviews}
          onSaveReview={saveCounterRankingV2Review}
          profileOverridesByChampionId={counterRankingV2ProfileOverridesByChampionId}
          profileStatusesByChampionId={counterRankingV2ProfileStatusesByChampionId}
          reviewStatus={counterRankingV2ReviewStatus}
          rows={counterRankingV2Rows}
          savingReviewKey={savingCounterRankingV2ReviewKey}
          selectedRole={selectedRole}
          statusError={counterRankingV2Status.error}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CounterPickManagementMetricsPanel
        error={metricsStatus.error}
        isLoading={metricsStatus.isLoading}
        metrics={managementMetrics}
        onRefresh={() => void loadManagementMetrics()}
      />

      <Card className="border-white/10 bg-[#10182b]/90 text-white shadow-xl shadow-black/15">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="font-mono text-xl">Counter Pick workspace</CardTitle>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                Manage draft and reviewed recommendations for a selected champion and role.
              </p>
            </div>
            <Button
              className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
              onClick={() => void onRefresh()}
              type="button"
              variant="ghost"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">Search champions</span>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                  aria-hidden="true"
                />
                <Input
                  className="h-10 border-white/10 bg-white/5 pl-9 text-zinc-100 placeholder:text-zinc-500 focus-visible:border-violet-400/70 focus-visible:ring-violet-400/20"
                  onChange={(event) => setChampionSearch(event.target.value)}
                  placeholder="Fizz, Ahri, Aatrox..."
                  type="search"
                  value={championSearch}
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">Champion</span>
              <select
                className={`${fieldClassName} h-10`}
                onChange={(event) => {
                  setSelectedChampionId(event.target.value);
                  setChampionSearch(championsById.get(event.target.value)?.name ?? "");
                  setSelectedIds(new Set());
                  setEditingCounterPickId(null);
                }}
                value={effectiveSelectedChampionId}
              >
                {championSelectOptions.map((champion) => (
                  <option className={selectOptionClassName} key={champion.id} value={champion.id}>
                    {champion.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">Role</span>
              <select
                className={`${fieldClassName} h-10`}
                onChange={(event) => {
                  setSelectedRole(event.target.value as LeagueRole);
                  setSelectedIds(new Set());
                  setEditingCounterPickId(null);
                }}
                value={selectedRole}
              >
                {leagueRoles.map((role) => (
                  <option className={selectOptionClassName} key={role} value={role}>
                    {getRoleLabel(role)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedChampion ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-violet-300/15 bg-violet-500/[0.06] p-3">
              <Image
                alt=""
                className="size-10 rounded-md bg-white/10 object-cover"
                height={40}
                src={getChampionIconPath(selectedChampion)}
                width={40}
              />
              <div>
                <p className="text-sm font-semibold text-white">{selectedChampion.name}</p>
                <p className="text-xs text-zinc-400">{getRoleLabel(selectedRole)} counter board</p>
              </div>
            </div>
          ) : (
            <EmptyState tone="warning" text="No champion is available for this role filter." />
          )}
        </CardContent>
      </Card>

      {selectedChampionCombatProfile ? (
        <CombatProfileCounterRelationships
          championName={selectedChampionCombatProfile.name}
          counteredBy={selectedChampionCombatProfile.counteredBy}
          counters={selectedChampionCombatProfile.counters}
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="border-white/10 bg-[#10182b]/90 text-white shadow-xl shadow-black/15">
          <CardHeader>
            <CardTitle className="font-mono text-xl">Create draft</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreateCounterPick}>
              <label className="block space-y-2">
                <span className="text-sm text-zinc-300">Counter champion</span>
                <select
                  className={`${fieldClassName} h-10`}
                  disabled={createStatus.isLoading}
                  onChange={(event) =>
                    setCreateForm((currentForm) => ({
                      ...currentForm,
                      counter_champion_id: event.target.value,
                    }))
                  }
                  required
                  value={effectiveCreateCounterChampionId}
                >
                  {createCounterChampionOptions.map((champion) => (
                    <option className={selectOptionClassName} key={champion.id} value={champion.id}>
                      {champion.name}
                    </option>
                  ))}
                </select>
              </label>

              <CounterPickEditableFields
                disabled={createStatus.isLoading}
                form={createForm}
                onChange={setCreateForm}
              />

              <StatusMessage status={createStatus} />

              <Button
                className="h-10 bg-violet-500/80 px-4 text-white hover:bg-violet-500"
                disabled={createStatus.isLoading || !effectiveSelectedChampionId}
                type="submit"
              >
                <Plus className="size-4" aria-hidden="true" />
                {createStatus.isLoading ? "Saving..." : "Create draft"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#10182b]/90 text-white shadow-xl shadow-black/15">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle className="font-mono text-xl">Counter picks</CardTitle>
                <p className="mt-2 text-sm text-zinc-400">
                  {visibleCounterPicks.length} visible, {reviewedVisibleCount} reviewed.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
                  disabled={allVisibleIds.length === 0 || bulkStatus.isLoading}
                  onClick={toggleAllVisible}
                  type="button"
                  variant="ghost"
                >
                  {allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id)) ? (
                    <CheckSquare className="size-4" aria-hidden="true" />
                  ) : (
                    <Square className="size-4" aria-hidden="true" />
                  )}
                  Select visible
                </Button>
                <Button
                  className="border-emerald-300/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
                  disabled={draftSelectedIds.length === 0 || bulkStatus.isLoading}
                  onClick={() =>
                    void approveCounterPickIds(draftSelectedIds, "Selected counter picks reviewed.")
                  }
                  type="button"
                  variant="ghost"
                >
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Approve selected
                </Button>
                <Button
                  className="border-emerald-300/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
                  disabled={draftVisibleIds.length === 0 || bulkStatus.isLoading}
                  onClick={() =>
                    void approveCounterPickIds(draftVisibleIds, "Visible counter picks reviewed.")
                  }
                  type="button"
                  variant="ghost"
                >
                  <CheckSquare className="size-4" aria-hidden="true" />
                  Approve all visible
                </Button>
                <Button
                  className="border-rose-300/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                  disabled={selectedVisibleIds.length === 0 || bulkStatus.isLoading}
                  onClick={() =>
                    void deleteCounterPickIds(selectedVisibleIds, "Selected counter picks deleted.")
                  }
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Delete selected
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="block space-y-2 md:col-span-3">
                <span className="text-sm text-zinc-300">Search counter champions</span>
                <Input
                  className="h-10 border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus-visible:border-violet-400/70 focus-visible:ring-violet-400/20"
                  onChange={(event) => {
                    setCounterSearch(event.target.value);
                    setSelectedIds(new Set());
                  }}
                  placeholder="Filter visible counters..."
                  type="search"
                  value={counterSearch}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-zinc-300">Status</span>
                <select
                  className={`${fieldClassName} h-10`}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as CounterPickStatusFilter);
                    setSelectedIds(new Set());
                  }}
                  value={statusFilter}
                >
                  <option className={selectOptionClassName} value="all">
                    All
                  </option>
                  <option className={selectOptionClassName} value="draft">
                    Draft
                  </option>
                  <option className={selectOptionClassName} value="reviewed">
                    Reviewed
                  </option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-zinc-300">Counter type</span>
                <select
                  className={`${fieldClassName} h-10`}
                  onChange={(event) => {
                    setTypeFilter(event.target.value as CounterPickTypeFilter);
                    setSelectedIds(new Set());
                  }}
                  value={typeFilter}
                >
                  <option className={selectOptionClassName} value="all">
                    All
                  </option>
                  <option className={selectOptionClassName} value="best_counter">
                    Best Counter
                  </option>
                  <option className={selectOptionClassName} value="countered_by">
                    Countered By
                  </option>
                </select>
              </label>

              <div className="flex items-end">
                <Button
                  className="h-10 w-full border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
                  onClick={() => {
                    setCounterSearch("");
                    setStatusFilter("all");
                    setTypeFilter("all");
                    setSelectedIds(new Set());
                  }}
                  type="button"
                  variant="ghost"
                >
                  <X className="size-4" aria-hidden="true" />
                  Clear filters
                </Button>
              </div>
            </div>

            <StatusMessage status={bulkStatus} />

            {counterPicks.length === 0 ? (
              <EmptyState text="No counter picks exist yet. Create the first draft for a champion and role." />
            ) : visibleCounterPicks.length === 0 ? (
              <EmptyState text="No counter picks match the current filters." />
            ) : (
              <div className="space-y-3">
                {visibleCounterPicks.map((counterPick) => (
                  <CounterPickRow
                    championsById={championsById}
                    counterPick={counterPick}
                    editForm={editForm}
                    editStatus={editStatus}
                    isEditing={editingCounterPickId === counterPick.id}
                    isSelected={selectedIds.has(counterPick.id)}
                    key={counterPick.id}
                    onCancelEdit={stopEditingCounterPick}
                    onDelete={(id) => void deleteCounterPickIds([id], "Counter pick deleted.")}
                    onEditChange={setEditForm}
                    onSave={handleSaveCounterPick}
                    onStartEdit={startEditingCounterPick}
                    onToggleReviewed={updateCounterPickStatus}
                    onToggleSelected={toggleSelectedId}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CounterPickEditableFields<TForm extends CounterPickEditForm>({
  disabled,
  form,
  onChange,
}: {
  disabled: boolean;
  form: TForm;
  onChange: (form: TForm) => void;
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm text-zinc-300">Counter type</span>
          <select
            className={`${fieldClassName} h-10`}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...form,
                counter_type: event.target.value as LeagueCounterPickType,
              })
            }
            value={form.counter_type}
          >
            <option className={selectOptionClassName} value="best_counter">
              Best Counter
            </option>
            <option className={selectOptionClassName} value="countered_by">
              Countered By
            </option>
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-sm text-zinc-300">Counter strength</span>
          <Input
            className="h-10 border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus-visible:border-violet-400/70 focus-visible:ring-violet-400/20"
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...form,
                counter_strength: event.target.value,
              })
            }
            placeholder="Strong, situational, skill matchup..."
            value={form.counter_strength}
          />
        </label>
      </div>

      <label className="block space-y-2">
        <span className="text-sm text-zinc-300">Reason</span>
        <textarea
          className={`${fieldClassName} min-h-28 py-2 leading-6`}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...form,
              reason: event.target.value,
            })
          }
          placeholder="Why this counter pick matters in lane..."
          value={form.reason}
        />
      </label>
    </>
  );
}

function CombatProfileCounterRelationships({
  championName,
  counteredBy,
  counters,
}: {
  championName: string;
  counteredBy?: readonly { champion: string; reasons: readonly string[] }[];
  counters?: readonly { champion: string; reasons: readonly string[] }[];
}) {
  return (
    <Card className="border-white/10 bg-[#10182b]/90 text-white shadow-xl shadow-black/15">
      <CardHeader>
        <CardTitle className="font-mono text-xl">Combat profile counter notes</CardTitle>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Static combat-profile relationships for {championName}. Add bullets in the champion
          profile files and they will appear here for Counter Pick review.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-2">
          <CombatProfileRelationshipList
            emptyText="No champions are listed as matchups this champion counters yet."
            relationships={counters}
            title={`${championName} counters`}
          />
          <CombatProfileRelationshipList
            emptyText="No champions are listed as counters into this champion yet."
            relationships={counteredBy}
            title={`${championName} is countered by`}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function CombatProfileRelationshipList({
  emptyText,
  relationships,
  title,
}: {
  emptyText: string;
  relationships?: readonly { champion: string; reasons: readonly string[] }[];
  title: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {relationships && relationships.length > 0 ? (
        <ul className="mt-4 space-y-4">
          {relationships.map((relationship) => (
            <li
              className="rounded-md border border-white/10 bg-black/15 p-3"
              key={relationship.champion}
            >
              <p className="text-sm font-semibold text-violet-100">{relationship.champion}</p>
              {relationship.reasons.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-300">
                  {relationship.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-zinc-500">No reasons added yet.</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-md border border-white/10 bg-black/15 p-3 text-sm text-zinc-500">
          {emptyText}
        </p>
      )}
    </div>
  );
}

function CounterRankingV2TraitList({
  labelContext,
  title,
  traits,
}: {
  labelContext: CounterRankingV2ProfileLabelContext;
  title: string;
  traits: { traitId: CounterRankingV2TraitId; weight: number }[];
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs font-semibold uppercase text-zinc-500">{title}</p>
      {traits.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-400">No {title.toLowerCase()} recorded.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {traits.map((trait) => (
            <Badge className="border-white/10 bg-white/5 text-zinc-200" key={trait.traitId}>
              {getProfileTraitLabel(trait.traitId, labelContext)} · {trait.weight}/10 ·{" "}
              {getCounterRankingV2ProfileImpactLabel(trait.weight)}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

type CounterRankingV2ProfileReviewPanelRow = {
  champion: AdminLeagueChampion | null;
  profile: CounterRankingV2ChampionProfile;
  review: CounterRankingV2ProfileReview | null;
};

function CounterRankingV2ProfileReviewPanel({
  championsById,
  isSaving,
  onApplyDraftImprovements,
  onBackfillDrafts,
  onMarkProfilesReviewed,
  onRefresh,
  onSaveReview,
  onSelectProfile,
  profileOverridesByChampionId,
  profileReviewsByChampionId,
  profileStatusesByChampionId,
  reviewStatus,
  savingChampionId,
  selectedChampionId,
  selectedRole,
}: {
  championsById: Map<string, AdminLeagueChampion>;
  isSaving: boolean;
  onApplyDraftImprovements: (suggestions: CounterRankingV2DraftProfileSuggestion[]) => void;
  onBackfillDrafts: () => void;
  onMarkProfilesReviewed: (targets: Array<{ championId: string; role: LeagueRole }>) => void;
  onRefresh: () => void;
  onSaveReview: (
    championId: string,
    role: LeagueRole,
    form: CounterRankingV2ProfileReviewForm,
  ) => void;
  onSelectProfile: (championId: string, role: LeagueRole) => void;
  profileOverridesByChampionId: CounterRankingV2ProfileByChampionId;
  profileReviewsByChampionId: Map<string, CounterRankingV2ProfileReview>;
  profileStatusesByChampionId: CounterRankingV2ProfileStatusByChampionId;
  reviewStatus: FormStatus;
  savingChampionId: string | null;
  selectedChampionId: string;
  selectedRole: LeagueRole;
}) {
  const [statusFilter, setStatusFilter] = useState<CounterRankingV2ProfileStatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<CounterRankingV2ProfileRoleFilter>("all");
  const [draftImprovementMaxProfiles, setDraftImprovementMaxProfiles] = useState("10");
  const [draftImprovementOnlyFiltered, setDraftImprovementOnlyFiltered] = useState(true);
  const [draftImprovementSuggestions, setDraftImprovementSuggestions] = useState<
    CounterRankingV2DraftProfileSuggestion[]
  >([]);
  const [selectedDraftImprovementKeys, setSelectedDraftImprovementKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedProfileApprovalKeys, setSelectedProfileApprovalKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const selectedProfile = selectedChampionId
    ? getCounterRankingV2ChampionProfile(
        selectedChampionId,
        profileStatusesByChampionId,
        profileOverridesByChampionId,
        selectedRole,
      )
    : null;
  const selectedProfileKey = selectedChampionId
    ? getCounterRankingV2ProfileKey(selectedChampionId, selectedRole)
    : null;
  const selectedProfileReview = selectedChampionId
    ? profileReviewsByChampionId.get(selectedProfileKey ?? "") ?? null
    : null;
  const profileRows = useMemo(
    () => {
      const profileTargets = [
        ...counterRankingV2ChampionProfiles.map((profile) => ({
          championId: profile.championId,
          role: profile.role,
        })),
        ...Array.from(profileOverridesByChampionId.values()).map((profile) => ({
          championId: profile.championId,
          role: profile.role,
        })),
        ...Array.from(profileReviewsByChampionId.values()).map((review) => ({
          championId: review.championId,
          role: review.role,
        })),
      ];
      const rowsByProfileKey = new Map<string, CounterRankingV2ProfileReviewPanelRow>();
      const duplicateRowsByProfileKey = new Map<string, CounterRankingV2ProfileReviewPanelRow[]>();

      for (const { championId, role } of profileTargets) {
        const normalizedChampionId = normalizeCounterRankingV2ChampionId(championId);
        const profileKey = getCounterRankingV2ProfileKey(championId, role);
        const champion = championsById.get(normalizedChampionId) ?? null;
        const profile =
          getCounterRankingV2ChampionProfile(
            champion?.id ?? championId,
            profileStatusesByChampionId,
            profileOverridesByChampionId,
            role,
          ) ??
          profileOverridesByChampionId.get(profileKey) ??
          null;

        if (!profile) {
          continue;
        }

        const row = {
          champion,
          profile,
          review: profileReviewsByChampionId.get(profileKey) ?? null,
        };
        const existingRow = rowsByProfileKey.get(profileKey);

        if (!existingRow) {
          rowsByProfileKey.set(profileKey, row);
          continue;
        }

        duplicateRowsByProfileKey.set(profileKey, [
          ...(duplicateRowsByProfileKey.get(profileKey) ?? [existingRow]),
          row,
        ]);
        rowsByProfileKey.set(
          profileKey,
          getPreferredCounterRankingV2ProfileRow(existingRow, row),
        );
      }

      if (duplicateRowsByProfileKey.size > 0) {
        console.warn(
          "Counter Ranking V2 profile duplicates detected before rendering; using one row per normalized champion-role key.",
          Array.from(duplicateRowsByProfileKey.entries()).map(([profileKey, rows]) => ({
            duplicateRowIds: rows.map((row) => row.profile.championId),
            profileKey,
            statuses: rows.map((row) => row.profile.reviewStatus),
            updatedAtValues: rows.map((row) => row.review?.updatedAt ?? null),
          })),
        );
      }

      return Array.from(rowsByProfileKey.values()).sort((rowA, rowB) => {
        const nameA = rowA.champion?.name ?? rowA.profile.championId;
        const nameB = rowB.champion?.name ?? rowB.profile.championId;

        return nameA.localeCompare(nameB) || rowA.profile.role.localeCompare(rowB.profile.role);
      });
    },
    [
      championsById,
      profileOverridesByChampionId,
      profileReviewsByChampionId,
      profileStatusesByChampionId,
    ],
  );
  const supportedProfileRows = useMemo(
    () =>
      profileRows.filter(({ profile }) =>
        isChampionSupportedInRole(profile.championId, profile.role),
      ),
    [profileRows],
  );
  const unsupportedProfileRows = useMemo(
    () =>
      profileRows.filter(
        ({ profile }) => !isChampionSupportedInRole(profile.championId, profile.role),
      ),
    [profileRows],
  );
  const profileCoverageSummary = useMemo(
    () =>
      getCounterRankingV2ProfileCoverageSummary(
        supportedProfileRows.map((row) => row.profile),
        Array.from(championsById.values()).reduce(
          (total, champion) =>
            total + leagueRoles.filter((role) => isChampionSupportedInRole(champion.id, role)).length,
          0,
        ),
      ),
    [championsById, supportedProfileRows],
  );
  const filteredProfileRows = useMemo(
    () =>
      supportedProfileRows.filter(({ profile, review }) => {
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "improved_draft"
            ? profile.reviewStatus !== "reviewed" && isImprovedCounterRankingV2DraftReview(review)
            : profile.reviewStatus === statusFilter);
        const matchesRole = roleFilter === "all" || profile.role === roleFilter;

        return matchesStatus && matchesRole;
      }),
    [roleFilter, statusFilter, supportedProfileRows],
  );
  const reviewedExampleProfiles = useMemo(
    () =>
      supportedProfileRows
        .map((row) => row.profile)
        .filter((profile) => profile.reviewStatus === "reviewed"),
    [supportedProfileRows],
  );
  const selectedDraftImprovementCount = draftImprovementSuggestions.filter((suggestion) =>
    selectedDraftImprovementKeys.has(getCounterRankingV2ProfileKey(suggestion.championId, suggestion.role)),
  ).length;
  const visibleApprovalRows = filteredProfileRows.filter(({ profile }) =>
    isCounterRankingV2ProfileEligibleForReviewedApproval(profile),
  );
  const selectedApprovalRows = visibleApprovalRows.filter(({ profile }) =>
    selectedProfileApprovalKeys.has(getCounterRankingV2ProfileKey(profile.championId, profile.role)),
  );

  const selectedChampion = selectedProfile
    ? championsById.get(normalizeCounterRankingV2ChampionId(selectedProfile.championId)) ?? null
    : null;
  const masteryRequirement = selectedProfile
    ? getChampionMasteryRequirementLevel(selectedProfile.championId)
    : null;
  const isCurrentProfileSaving =
    selectedProfile !== null &&
    savingChampionId === getCounterRankingV2ProfileKey(selectedProfile.championId, selectedProfile.role);

  function previewDraftProfileImprovements() {
    const maxProfiles = Math.max(1, Math.min(25, Number(draftImprovementMaxProfiles) || 10));
    const candidateRows = (draftImprovementOnlyFiltered ? filteredProfileRows : supportedProfileRows)
      .filter(({ profile, review }) =>
        isCounterRankingV2ProfileEligibleForDraftImprovement({
          hasAdminNote: Boolean(review?.reviewNote?.trim()),
          profile,
        }),
      )
      .slice(0, maxProfiles);
    const suggestions = candidateRows
      .map(({ champion, profile }) =>
        createCounterRankingV2ImprovedDraftProfileSuggestion({
          currentProfile: profile,
          knowledge: toCounterRankingV2DraftProfileKnowledge({
            champion,
            isCommonRole: champion ? isChampionInRole(champion, profile.role) : true,
            profile,
          }),
          reviewedProfiles: reviewedExampleProfiles,
        }),
      )
      .filter(
        (suggestion) =>
          suggestion.strengths.length > 0 ||
          suggestion.vulnerabilities.length > 0 ||
          suggestion.knownStrengths.length > 0 ||
          suggestion.knownWeaknesses.length > 0,
      );

    setDraftImprovementSuggestions(suggestions);
    setSelectedDraftImprovementKeys(
      new Set(
        suggestions
          .filter((suggestion) => suggestion.confidence !== "low_draft_confidence")
          .map((suggestion) => getCounterRankingV2ProfileKey(suggestion.championId, suggestion.role)),
      ),
    );
  }

  function applySelectedDraftProfileImprovements() {
    const selectedSuggestions = draftImprovementSuggestions.filter((suggestion) =>
      selectedDraftImprovementKeys.has(getCounterRankingV2ProfileKey(suggestion.championId, suggestion.role)),
    );

    onApplyDraftImprovements(selectedSuggestions);
  }

  function markSingleProfileReviewed(profile: CounterRankingV2ChampionProfile) {
    const confirmed = window.confirm(
      "Mark this mechanical profile as reviewed? This will allow it to be trusted by Counter Ranking V2 automation.",
    );

    if (!confirmed) {
      return;
    }

    onMarkProfilesReviewed([{ championId: profile.championId, role: profile.role }]);
  }

  function markSelectedProfilesReviewed() {
    if (selectedApprovalRows.length === 0) {
      onMarkProfilesReviewed([]);
      return;
    }

    const confirmed = window.confirm(
      `Mark ${selectedApprovalRows.length} mechanical profile${selectedApprovalRows.length === 1 ? "" : "s"} as reviewed? This will allow them to be trusted by Counter Ranking V2 automation.`,
    );

    if (!confirmed) {
      return;
    }

    onMarkProfilesReviewed(
      selectedApprovalRows.map(({ profile }) => ({
        championId: profile.championId,
        role: profile.role,
      })),
    );
    setSelectedProfileApprovalKeys(new Set());
  }

  return (
    <Card className="border-emerald-300/15 bg-[#071321]/95 text-white shadow-xl shadow-black/15">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="font-mono text-xl">Champion Counter Profiles</CardTitle>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Review champion mechanical profiles before automation can promote their suggestions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="border-emerald-300/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15"
              disabled={reviewStatus.isLoading}
              onClick={onBackfillDrafts}
              type="button"
              variant="outline"
            >
              <Plus className="mr-2 size-4" aria-hidden="true" />
              Create missing drafts
            </Button>
            <Button
              className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
              disabled={reviewStatus.isLoading}
              onClick={onRefresh}
              type="button"
              variant="outline"
            >
              <RefreshCw className="mr-2 size-4" aria-hidden="true" />
              Refresh profiles
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {reviewStatus.error ? (
          <p className="rounded-md border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-100">
            {reviewStatus.error}
          </p>
        ) : null}
        {reviewStatus.success ? (
          <p className="rounded-md border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            {reviewStatus.success}
          </p>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <CounterRankingV2MetaCell
            label="Expected role profiles"
            value={String(profileCoverageSummary.activeChampions)}
          />
          <CounterRankingV2MetaCell label="Total profiles" value={String(profileCoverageSummary.total)} />
          <CounterRankingV2MetaCell
            label="Missing profiles"
            value={String(profileCoverageSummary.missing)}
          />
          <CounterRankingV2MetaCell
            label="Draft/generated_draft"
            value={String(profileCoverageSummary.draft)}
          />
          <CounterRankingV2MetaCell
            label="Needs revision"
            value={String(profileCoverageSummary.needsRevision)}
          />
          <CounterRankingV2MetaCell
            label="Reviewed"
            value={String(profileCoverageSummary.reviewed)}
          />
          <CounterRankingV2MetaCell
            label="Unsupported/off-meta"
            value={String(unsupportedProfileRows.length)}
          />
        </div>

        {unsupportedProfileRows.length > 0 ? (
          <p className="rounded-md border border-amber-300/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-100">
            {unsupportedProfileRows.length} stored mechanical profile
            {unsupportedProfileRows.length === 1 ? "" : "s"} are excluded from normal review because
            their champion-role pair is unsupported or off-meta.
          </p>
        ) : null}

        <div className="rounded-lg border border-white/10 bg-black/15 p-3">
          <p className="text-sm font-semibold text-zinc-100">Reviewed coverage by role</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {leagueRoles.map((role) => (
              <CounterRankingV2MetaCell
                key={role}
                label={getRoleLabel(role)}
                value={`${profileCoverageSummary.reviewedByRole[role].reviewed}/${profileCoverageSummary.reviewedByRole[role].total}`}
              />
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-emerald-300/15 bg-emerald-500/[0.04] p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-emerald-100">Improve draft profiles</p>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-400">
                Builds role-aware draft suggestions from champion knowledge and reviewed examples.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-zinc-300">
                <input
                  checked={draftImprovementOnlyFiltered}
                  className="size-4 accent-emerald-300"
                  onChange={(event) => setDraftImprovementOnlyFiltered(event.target.checked)}
                  type="checkbox"
                />
                Current filters
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-300">
                Max
                <Input
                  className="h-9 w-20 border-white/10 bg-white/5 text-zinc-100"
                  max={25}
                  min={1}
                  onChange={(event) => setDraftImprovementMaxProfiles(event.target.value)}
                  type="number"
                  value={draftImprovementMaxProfiles}
                />
              </label>
              <Button
                className="border-emerald-300/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15"
                disabled={reviewStatus.isLoading}
                onClick={previewDraftProfileImprovements}
                type="button"
                variant="outline"
              >
                <RefreshCw className="mr-2 size-4" aria-hidden="true" />
                Improve draft profiles
              </Button>
            </div>
          </div>

          {draftImprovementSuggestions.length > 0 ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-zinc-400">
                  {draftImprovementSuggestions.length} previews · {selectedDraftImprovementCount} selected
                </p>
                <Button
                  className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                  disabled={reviewStatus.isLoading || selectedDraftImprovementCount === 0}
                  onClick={applySelectedDraftProfileImprovements}
                  type="button"
                >
                  <CheckSquare className="mr-2 size-4" aria-hidden="true" />
                  Apply selected
                </Button>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                {draftImprovementSuggestions.map((suggestion) => {
                  const suggestionKey = getCounterRankingV2ProfileKey(
                    suggestion.championId,
                    suggestion.role,
                  );
                  const champion =
                    championsById.get(normalizeCounterRankingV2ChampionId(suggestion.championId)) ??
                    null;
                  const isSelected = selectedDraftImprovementKeys.has(suggestionKey);

                  return (
                    <div
                      className="rounded-md border border-white/10 bg-black/20 p-3"
                      key={suggestionKey}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <button
                          className="flex items-start gap-2 text-left"
                          onClick={() =>
                            setSelectedDraftImprovementKeys((currentKeys) => {
                              const nextKeys = new Set(currentKeys);

                              if (nextKeys.has(suggestionKey)) {
                                nextKeys.delete(suggestionKey);
                              } else {
                                nextKeys.add(suggestionKey);
                              }

                              return nextKeys;
                            })
                          }
                          type="button"
                        >
                          {isSelected ? (
                            <CheckSquare className="mt-0.5 size-4 text-emerald-200" aria-hidden="true" />
                          ) : (
                            <Square className="mt-0.5 size-4 text-zinc-500" aria-hidden="true" />
                          )}
                          <span>
                            <span className="block text-sm font-semibold text-white">
                              {champion?.name ?? suggestion.championId} {getRoleLabel(suggestion.role)}
                            </span>
                            <span className="mt-1 block text-xs text-zinc-500">
                              {formatDraftProfileConfidence(suggestion.confidence)}
                            </span>
                          </span>
                        </button>
                        <Badge className={getProfileStatusBadgeClassName(suggestion.proposedStatus)}>
                          {formatProfileStatus(suggestion.proposedStatus)}
                        </Badge>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-zinc-400">{suggestion.summary}</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <CounterRankingV2TraitList
                          labelContext="strength"
                          title="Proposed strengths"
                          traits={suggestion.strengths}
                        />
                        <CounterRankingV2TraitList
                          labelContext="weakness"
                          title="Proposed weaknesses"
                          traits={suggestion.vulnerabilities}
                        />
                      </div>
                      <p className="mt-3 text-xs leading-5 text-zinc-500">
                        Added: {formatDraftProfileChangedTraitIds([
                          ...suggestion.changes.addedStrengths,
                          ...suggestion.changes.addedWeaknesses,
                        ])}
                      </p>
                      {suggestion.similarReviewedProfiles.length > 0 ? (
                        <p className="mt-1 text-xs leading-5 text-zinc-500">
                          Examples:{" "}
                          {suggestion.similarReviewedProfiles
                            .map((example) => `${example.championId} ${getRoleLabel(example.role)}`)
                            .join(", ")}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {selectedProfile ? (
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-lg border border-white/10 bg-black/15 p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {selectedChampion?.name ?? selectedProfile.championId} {getRoleLabel(selectedRole)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatMechanicalProfileStatusLabel(selectedProfile)}
                  </p>
                </div>
                <Badge className={getProfileStatusBadgeClassName(selectedProfile.reviewStatus)}>
                  {formatProfileStatus(selectedProfile.reviewStatus)}
                </Badge>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <CounterRankingV2MetaCell
                  label="Mastery requirement"
                  value={formatMasteryRequirement(masteryRequirement)}
                />
                <CounterRankingV2MetaCell
                  label="Profile revision"
                  title={counterRankingV2ProfileRevisionHelpText}
                  value={String(selectedProfile.version)}
                />
                <CounterRankingV2MetaCell
                  label="Reviewed by"
                  value={selectedProfileReview?.reviewedBy ? "Saved admin" : "Not reviewed"}
                />
                <CounterRankingV2MetaCell
                  label="Updated"
                  value={formatCounterRankingV2Timestamp(selectedProfileReview?.updatedAt)}
                />
              </div>

              {selectedProfile.notes ? (
                <p className="mt-4 rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm leading-6 text-zinc-300">
                  {selectedProfile.notes}
                </p>
              ) : null}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <CounterRankingV2TraitList
                  labelContext="strength"
                  title="Strengths"
                  traits={selectedProfile.strengths}
                />
                <CounterRankingV2TraitList
                  labelContext="weakness"
                  title="Weaknesses"
                  traits={selectedProfile.vulnerabilities}
                />
              </div>
            </div>

            <CounterRankingV2ProfileReviewEditor
              isCurrentProfileSaving={isCurrentProfileSaving}
              isSaving={isSaving}
              key={`${selectedProfile.championId}-${selectedProfile.role}-${selectedProfile.reviewStatus}-${selectedProfileReview?.updatedAt ?? "new"}`}
              onSaveReview={(form) => onSaveReview(selectedProfile.championId, selectedProfile.role, form)}
              profile={selectedProfile}
              review={selectedProfileReview}
            />
          </div>
        ) : (
          <EmptyState text="Select a champion with a mechanical profile to review." />
        )}

        <div className="rounded-lg border border-white/10 bg-black/15 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-zinc-100">Profile filters</p>
            <p className="text-xs text-zinc-500">
              {filteredProfileRows.length} of {supportedProfileRows.length} supported mechanical profiles
            </p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(["all", "improved_draft", ...counterRankingV2ProfileStatuses] as const).map((status) => {
              const isActive = statusFilter === status;

              return (
                <button
                  aria-pressed={isActive}
                  className={cn(
                    "rounded-md border px-3 py-2 text-xs font-semibold transition-colors",
                    isActive
                      ? "border-emerald-300/30 bg-emerald-500/15 text-emerald-100"
                      : "border-white/10 bg-white/5 text-zinc-300 hover:border-emerald-300/20 hover:bg-white/10",
                  )}
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  type="button"
                >
                  {status === "all"
                    ? "All"
                    : status === "improved_draft"
                      ? "Improved drafts"
                      : formatProfileStatus(status)}
                </button>
              );
            })}
            <select
              className={`${fieldClassName} h-9 w-auto min-w-36`}
              onChange={(event) =>
                setRoleFilter(event.target.value as CounterRankingV2ProfileRoleFilter)
              }
              value={roleFilter}
            >
              <option className={selectOptionClassName} value="all">
                All roles
              </option>
              {leagueRoles.map((role) => (
                <option className={selectOptionClassName} key={role} value={role}>
                  {getRoleLabel(role)}
                </option>
              ))}
            </select>
            <Button
              className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
              disabled={visibleApprovalRows.length === 0}
              onClick={() =>
                setSelectedProfileApprovalKeys(
                  new Set(
                    visibleApprovalRows.map(({ profile }) =>
                      getCounterRankingV2ProfileKey(profile.championId, profile.role),
                    ),
                  ),
                )
              }
              type="button"
              variant="outline"
            >
              <CheckSquare className="mr-2 size-4" aria-hidden="true" />
              Select visible eligible
            </Button>
            <Button
              className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              disabled={reviewStatus.isLoading || selectedApprovalRows.length === 0}
              onClick={markSelectedProfilesReviewed}
              type="button"
            >
              <CheckCircle2 className="mr-2 size-4" aria-hidden="true" />
              Mark selected as reviewed
            </Button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {selectedApprovalRows.length} selected · {visibleApprovalRows.length} visible eligible
          </p>
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {filteredProfileRows.map(({ champion, profile, review }) => {
            const profileKey = getCounterRankingV2ProfileKey(profile.championId, profile.role);
            const isProfileSelected = selectedProfileApprovalKeys.has(profileKey);
            const isApprovalEligible = isCounterRankingV2ProfileEligibleForReviewedApproval(profile);

            return (
              <div
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  normalizeCounterRankingV2ChampionId(profile.championId) ===
                    normalizeCounterRankingV2ChampionId(selectedChampionId) &&
                    profile.role === selectedRole
                    ? "border-emerald-300/30 bg-emerald-500/10"
                    : "border-white/10 bg-white/[0.03] hover:border-emerald-300/20 hover:bg-white/[0.06]",
                )}
                key={profileKey}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onSelectProfile(profile.championId, profile.role)}
                    type="button"
                  >
                    <p className="text-sm font-semibold text-white">
                      {champion?.name ?? profile.championId} {getRoleLabel(profile.role)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {formatMechanicalProfileStatusLabel(profile)}
                    </p>
                    <p
                      className="mt-1 text-[0.7rem] text-zinc-600"
                      title={counterRankingV2ProfileRevisionHelpText}
                    >
                      {formatMechanicalProfileRevisionLabel(profile)}
                    </p>
                  </button>
                  <Badge className={getProfileStatusBadgeClassName(profile.reviewStatus)}>
                    {formatProfileStatus(profile.reviewStatus)}
                  </Badge>
                </div>
                <p className="mt-3 line-clamp-2 text-xs leading-5 text-zinc-400">
                  {review?.reviewNote ?? profile.notes ?? "No profile notes yet."}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {isApprovalEligible ? (
                    <button
                      className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
                      onClick={() =>
                        setSelectedProfileApprovalKeys((currentKeys) => {
                          const nextKeys = new Set(currentKeys);

                          if (nextKeys.has(profileKey)) {
                            nextKeys.delete(profileKey);
                          } else {
                            nextKeys.add(profileKey);
                          }

                          return nextKeys;
                        })
                      }
                      type="button"
                    >
                      {isProfileSelected ? (
                        <CheckSquare className="size-4 text-emerald-200" aria-hidden="true" />
                      ) : (
                        <Square className="size-4 text-zinc-500" aria-hidden="true" />
                      )}
                      Select
                    </button>
                  ) : null}
                  {isApprovalEligible ? (
                    <Button
                      className="border-emerald-300/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15"
                      disabled={reviewStatus.isLoading}
                      onClick={() => markSingleProfileReviewed(profile)}
                      type="button"
                      variant="outline"
                    >
                      <CheckCircle2 className="mr-2 size-4" aria-hidden="true" />
                      Mark reviewed
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function CounterRankingV2ProfileReviewEditor({
  isCurrentProfileSaving,
  isSaving,
  onSaveReview,
  profile,
  review,
}: {
  isCurrentProfileSaving: boolean;
  isSaving: boolean;
  onSaveReview: (form: CounterRankingV2ProfileReviewForm) => void;
  profile: CounterRankingV2ChampionProfile;
  review: CounterRankingV2ProfileReview | null;
}) {
  const [form, setForm] = useState<CounterRankingV2ProfileReviewForm>(() => ({
    identitySummary: profile.identitySummary ?? profile.notes ?? "",
    knownStrengths: (profile.knownStrengths ?? []).join("\n"),
    knownWeaknesses: (profile.knownWeaknesses ?? []).join("\n"),
    masteryRequirement:
      profile.masteryRequirement ?? getChampionMasteryRequirementLevel(profile.championId),
    reviewNote: review?.reviewNote ?? "",
    status: profile.reviewStatus,
    strengths: profile.strengths,
    vulnerabilities: profile.vulnerabilities,
  }));
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmedReviewedEdit, setConfirmedReviewedEdit] = useState(false);
  const isReviewedProfile = profile.reviewStatus === "reviewed";

  function saveProfile(nextStatus = form.status) {
    const invalidTrait = [...form.strengths, ...form.vulnerabilities].find(
      (trait) => trait.weight < 0 || trait.weight > 10 || !Number.isFinite(trait.weight),
    );

    if (invalidTrait) {
      setLocalError(`${getTraitLabel(invalidTrait.traitId)} must be between 0 and 10.`);
      return;
    }

    if (isReviewedProfile && !confirmedReviewedEdit && nextStatus === "reviewed") {
      setLocalError("Confirm reviewed-profile editing before saving reviewed data.");
      return;
    }

    setLocalError(null);
    onSaveReview({
      ...form,
      reviewNote: form.reviewNote,
      status: nextStatus,
    });
  }

  return (
    <form
      className="rounded-lg border border-white/10 bg-black/15 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        saveProfile();
      }}
    >
      {localError ? (
        <p className="mb-4 rounded-md border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-100">
          {localError}
        </p>
      ) : null}

      <label className="block space-y-2">
        <span className="text-sm text-zinc-300">Profile status</span>
        <select
          className={`${fieldClassName} h-10`}
          disabled={isCurrentProfileSaving}
          onChange={(event) =>
            setForm((currentForm) => ({
              ...currentForm,
              status: event.target.value as CounterRankingV2ProfileStatus,
            }))
          }
          value={form.status}
        >
          {counterRankingV2ProfileStatuses.map((status) => (
            <option className={selectOptionClassName} key={status} value={status}>
              {formatProfileStatus(status)}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 block space-y-2">
        <span className="text-sm text-zinc-300">Mastery requirement</span>
        <select
          className={`${fieldClassName} h-10`}
          disabled={isCurrentProfileSaving}
          onChange={(event) =>
            setForm((currentForm) => ({
              ...currentForm,
              masteryRequirement: event.target.value,
            }))
          }
          value={form.masteryRequirement}
        >
          {(["low", "moderate", "high", "very_high"] as const).map((requirement) => (
            <option className={selectOptionClassName} key={requirement} value={requirement}>
              {formatMasteryRequirement(requirement)}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 block space-y-2">
        <span className="text-sm text-zinc-300">Mechanical identity summary</span>
        <textarea
          className={`${fieldClassName} min-h-24 resize-y py-3`}
          disabled={isCurrentProfileSaving}
          onChange={(event) =>
            setForm((currentForm) => ({
              ...currentForm,
              identitySummary: event.target.value,
            }))
          }
          value={form.identitySummary}
        />
      </label>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <CounterRankingV2ProfileTraitEditor
          disabled={isCurrentProfileSaving}
          labelContext="strength"
          onChange={(strengths) =>
            setForm((currentForm) => ({
              ...currentForm,
              strengths,
            }))
          }
          profileRole={profile.role}
          title="Strengths"
          traits={form.strengths}
        />
        <CounterRankingV2ProfileTraitEditor
          disabled={isCurrentProfileSaving}
          labelContext="weakness"
          onChange={(vulnerabilities) =>
            setForm((currentForm) => ({
              ...currentForm,
              vulnerabilities,
            }))
          }
          profileRole={profile.role}
          title="Weaknesses"
          traits={form.vulnerabilities}
        />
      </div>

      <label className="mt-4 block space-y-2">
        <span className="text-sm text-zinc-300">Known strengths</span>
        <textarea
          className={`${fieldClassName} min-h-24 resize-y py-3`}
          disabled={isCurrentProfileSaving}
          onChange={(event) =>
            setForm((currentForm) => ({
              ...currentForm,
              knownStrengths: event.target.value,
            }))
          }
          placeholder="One strength per line."
          value={form.knownStrengths}
        />
      </label>

      <label className="mt-4 block space-y-2">
        <span className="text-sm text-zinc-300">Known weaknesses</span>
        <textarea
          className={`${fieldClassName} min-h-24 resize-y py-3`}
          disabled={isCurrentProfileSaving}
          onChange={(event) =>
            setForm((currentForm) => ({
              ...currentForm,
              knownWeaknesses: event.target.value,
            }))
          }
          placeholder="One weakness per line."
          value={form.knownWeaknesses}
        />
      </label>

      <label className="mt-4 block space-y-2">
        <span className="text-sm text-zinc-300">Review note</span>
        <textarea
          className={`${fieldClassName} min-h-28 resize-y py-3`}
          disabled={isCurrentProfileSaving}
          onChange={(event) =>
            setForm((currentForm) => ({
              ...currentForm,
              reviewNote: event.target.value,
            }))
          }
          placeholder="Optional admin note for this profile review."
          value={form.reviewNote}
        />
      </label>

      {isReviewedProfile ? (
        <label className="mt-4 flex items-start gap-3 rounded-md border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-100">
          <input
            checked={confirmedReviewedEdit}
            className="mt-1 size-4 accent-amber-300"
            onChange={(event) => setConfirmedReviewedEdit(event.target.checked)}
            type="checkbox"
          />
          <span>
            Confirm editing this reviewed profile. Saving can keep the reviewed status or you can
            change the status to Needs revision before saving.
          </span>
        </label>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
          disabled={isCurrentProfileSaving || isSaving}
          type="submit"
        >
          <Save className="mr-2 size-4" aria-hidden="true" />
          Save profile review
        </Button>
        <Button
          className="border-emerald-300/25 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15"
          disabled={isCurrentProfileSaving || isSaving}
          onClick={() => saveProfile("reviewed")}
          type="button"
          variant="outline"
        >
          <CheckCircle2 className="mr-2 size-4" aria-hidden="true" />
          Promote to Reviewed
        </Button>
      </div>
    </form>
  );
}

function CounterRankingV2ProfileTraitEditor({
  disabled,
  labelContext,
  onChange,
  profileRole,
  title,
  traits,
}: {
  disabled: boolean;
  labelContext: CounterRankingV2ProfileLabelContext;
  onChange: (traits: CounterRankingV2ProfileTrait[]) => void;
  profileRole: LeagueRole;
  title: string;
  traits: CounterRankingV2ProfileTrait[];
}) {
  const availableTraitIds: CounterRankingV2TraitId[] = counterRankingV2TraitVocabulary
    .filter((traitDefinition) =>
      isTraitDefinitionVisibleForProfileContext(traitDefinition, labelContext, profileRole),
    )
    .map((traitDefinition) => traitDefinition.id)
    .filter((traitId) => !traits.some((trait) => trait.traitId === traitId));
  const [selectedTraitId, setSelectedTraitId] = useState<CounterRankingV2TraitId>(
    availableTraitIds[0] ?? counterRankingV2TraitVocabulary[0].id,
  );
  const effectiveSelectedTraitId = availableTraitIds.includes(selectedTraitId)
    ? selectedTraitId
    : availableTraitIds[0];

  function updateTraitValue(traitId: CounterRankingV2TraitId, value: number) {
    onChange(
      traits.map((trait) => (trait.traitId === traitId ? { ...trait, weight: value } : trait)),
    );
  }

  function removeTrait(traitId: CounterRankingV2TraitId) {
    onChange(traits.filter((trait) => trait.traitId !== traitId));
  }

  function addTrait() {
    if (!effectiveSelectedTraitId) {
      return;
    }

    onChange([...traits, { traitId: effectiveSelectedTraitId, weight: 1 }]);
    setSelectedTraitId(
      availableTraitIds.find((traitId) => traitId !== effectiveSelectedTraitId) ??
        counterRankingV2TraitVocabulary[0].id,
    );
  }

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            0 = not present · 1-3 = low · 4-6 = medium · 7-8 = high · 9-10 =
            defining/extreme
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {traits.map((trait) => {
          const isOutOfRoleTrait = !isTraitIdVisibleForProfileContext(
            trait.traitId,
            labelContext,
            profileRole,
          );

          return (
          <div
            className="grid gap-2 rounded-md border border-white/10 bg-black/15 p-3 md:grid-cols-[1fr_120px_auto]"
            key={trait.traitId}
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-zinc-100">
                  {getProfileTraitLabel(trait.traitId, labelContext)}
                </p>
                {isOutOfRoleTrait ? (
                  <Badge className="border-amber-300/20 bg-amber-500/10 text-[0.65rem] text-amber-100">
                    Out-of-role
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {trait.weight}/10 · {getCounterRankingV2ProfileImpactLabel(trait.weight)}
              </p>
            </div>
            <Input
              className="h-10 border-white/10 bg-white/5 text-zinc-100"
              disabled={disabled}
              max={10}
              min={0}
              onChange={(event) => updateTraitValue(trait.traitId, Number(event.target.value))}
              step={1}
              type="number"
              value={String(trait.weight)}
            />
            <Button
              aria-label={`Remove ${getProfileTraitLabel(trait.traitId, labelContext)}`}
              className="size-10 shrink-0 border-rose-300/20 bg-rose-500/10 p-0 text-rose-100 hover:bg-rose-500/15"
              disabled={disabled}
              onClick={() => removeTrait(trait.traitId)}
              type="button"
              variant="outline"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <select
          className={`${fieldClassName} h-10 min-w-52`}
          disabled={disabled || availableTraitIds.length === 0}
          onChange={(event) => setSelectedTraitId(event.target.value as CounterRankingV2TraitId)}
          value={effectiveSelectedTraitId ?? ""}
        >
          {availableTraitIds.map((traitId) => (
            <option className={selectOptionClassName} key={traitId} value={traitId}>
              {getProfileTraitLabel(traitId, labelContext)}
            </option>
          ))}
        </select>
        <Button
          className="border-emerald-300/25 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15"
          disabled={disabled || !effectiveSelectedTraitId}
          onClick={addTrait}
          type="button"
          variant="outline"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add
        </Button>
      </div>
    </div>
  );
}

function CounterRankingV2AdminReviewPanel({
  allReviewsByKey,
  champions,
  championsById,
  enemyChampionId,
  isBatchSaving,
  observedByChampionId,
  onBatchReview,
  onRefresh,
  onSaveReview,
  onSelectEnemyChampion,
  onSelectRole,
  profileOverridesByChampionId,
  profileStatusesByChampionId,
  reviewStatus,
  savingReviewKey,
  selectedRole,
}: {
  allReviewsByKey: Map<string, CounterRankingV2MechanicalReview>;
  champions: AdminLeagueChampion[];
  championsById: Map<string, AdminLeagueChampion>;
  enemyChampionId: string;
  isBatchSaving: boolean;
  observedByChampionId: Map<string, CounterRankingV2ObservedRankSnapshot>;
  onBatchReview: (input: {
    approveMode?: "public_up_to_cap" | "reviewed_only";
    publicEligible?: boolean;
    rows: CounterRankingV2AdminReviewRow[];
    reviewStatus?: CounterRankingV2AdminBatchReviewStatus;
  }) => void;
  onRefresh: () => void;
  onSaveReview: (row: CounterRankingV2ComparisonRow, form: CounterRankingV2ReviewForm) => void;
  onSelectEnemyChampion: (championId: string) => void;
  onSelectRole: (role: LeagueRole) => void;
  profileOverridesByChampionId: CounterRankingV2ProfileByChampionId;
  profileStatusesByChampionId: CounterRankingV2ProfileStatusByChampionId;
  reviewStatus: FormStatus;
  savingReviewKey: string | null;
  selectedRole: LeagueRole;
}) {
  const [automationFilter, setAutomationFilter] = useState<CounterRankingV2AutomationStatus | "all">("all");
  const [areAdvancedFiltersOpen, setAreAdvancedFiltersOpen] = useState(false);
  const [candidateQuery, setCandidateQuery] = useState("");
  const [dataFilter, setDataFilter] = useState<"all" | "has_observed" | "low_sample" | "no_observed">("all");
  const [densityMode, setDensityMode] = useState<CounterRankingV2AdminReviewDensity>("compact");
  const [isOverviewOpen, setIsOverviewOpen] = useState(false);
  const [isPublicPreviewOpen, setIsPublicPreviewOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [publicFilter, setPublicFilter] = useState<"all" | "not_public" | "public_eligible">("all");
  const [queueSection, setQueueSection] = useState<CounterRankingV2AdminReviewQueueSection>("all");
  const [reviewFilter, setReviewFilter] = useState<CounterRankingV2ReviewFilter | "reviewed_only">("all");
  const [reviewMode, setReviewMode] = useState<CounterRankingV2AdminReviewMode>("top_candidates");
  const [reviewTab, setReviewTab] = useState<CounterRankingV2AdminReviewTab>("public_counters");
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(() => new Set());
  const [sortMode, setSortMode] = useState<CounterRankingV2AdminReviewSort>("review_priority");
  const [strengthFilter, setStrengthFilter] = useState<"all" | "soft_counter" | "strong_counter">("all");
  const [topCandidateCap, setTopCandidateCap] = useState<(typeof counterRankingV2TopCandidateCaps)[number]>(10);
  const roleSupportedChampions = useMemo(
    () =>
      champions
        .filter((champion) => isChampionSupportedInRole(champion.id, selectedRole))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [champions, selectedRole],
  );
  const targetChampionIds = useMemo(() => {
    if (enemyChampionId) {
      return [enemyChampionId];
    }

    return roleSupportedChampions
      .filter((champion) =>
        getCounterRankingV2ChampionProfile(
          champion.id,
          profileStatusesByChampionId,
          profileOverridesByChampionId,
          selectedRole,
        ),
      )
      .map((champion) => champion.id);
  }, [
    enemyChampionId,
    profileOverridesByChampionId,
    profileStatusesByChampionId,
    roleSupportedChampions,
    selectedRole,
  ]);
  const unsupportedRoleReviewCount = useMemo(
    () =>
      Array.from(allReviewsByKey.values()).filter(
        (review) =>
          review.role === selectedRole &&
          (!isChampionSupportedInRole(review.enemyChampionId, selectedRole) ||
            !isChampionSupportedInRole(review.counterChampionId, selectedRole)),
      ).length,
    [allReviewsByKey, selectedRole],
  );
  const queueRows = useMemo(() => {
    const rows: CounterRankingV2AdminReviewRow[] = [];

    for (const targetChampionId of targetChampionIds) {
      const reviewsByCandidateId = new Map(
        Array.from(allReviewsByKey.values())
          .filter(
            (review) =>
              review.role === selectedRole &&
              normalizeCounterRankingV2ChampionId(review.enemyChampionId) ===
                normalizeCounterRankingV2ChampionId(targetChampionId),
          )
          .map((review) => [
            normalizeCounterRankingV2ChampionId(review.counterChampionId),
            review,
          ] as const),
      );
      const targetObservedByChampionId =
        enemyChampionId &&
        normalizeCounterRankingV2ChampionId(enemyChampionId) ===
          normalizeCounterRankingV2ChampionId(targetChampionId)
          ? observedByChampionId
          : new Map<string, CounterRankingV2ObservedRankSnapshot>();
      const targetRows = generateCounterRankingV2MechanicalSuggestionsForRole({
        enemyChampionId: targetChampionId,
        observedByChampionId: targetObservedByChampionId,
        profileOverridesByChampionId,
        profileStatusesByChampionId,
        reviewsByCandidateId,
        role: selectedRole,
      });

      for (const row of targetRows) {
        const rowKey = getCounterRankingV2ReviewRowKey({
          candidateChampionId: row.candidateChampionId,
          role: row.mechanicalResult.role ?? selectedRole,
          targetChampionId,
        });
        const candidateProfile = getCounterRankingV2ChampionProfile(
          row.candidateChampionId,
          profileStatusesByChampionId,
          profileOverridesByChampionId,
          selectedRole,
        );
        const targetProfile = getCounterRankingV2ChampionProfile(
          targetChampionId,
          profileStatusesByChampionId,
          profileOverridesByChampionId,
          selectedRole,
        );
        const unsupportedRole =
          !isChampionSupportedInRole(row.candidateChampionId, selectedRole) ||
          !isChampionSupportedInRole(targetChampionId, selectedRole);

        if (unsupportedRole) {
          continue;
        }

        rows.push({
          ...row,
          candidateProfile,
          rowKey,
          targetChampionId,
          targetProfile,
          unsupportedRole,
        });
      }
    }

    return rows;
  }, [
    allReviewsByKey,
    enemyChampionId,
    observedByChampionId,
    profileOverridesByChampionId,
    profileStatusesByChampionId,
    selectedRole,
    targetChampionIds,
  ]);
  const summary = useMemo(
    () => getCounterRankingV2AdminReviewSummary(queueRows, unsupportedRoleReviewCount),
    [queueRows, unsupportedRoleReviewCount],
  );
  const targetSummaries = useMemo(
    () =>
      getCounterRankingV2TargetReviewSummaries({
        championsById,
        role: selectedRole,
        rows: queueRows,
      }),
    [championsById, queueRows, selectedRole],
  );
  const publicCounterRows = useMemo(
    () =>
      sortCounterRankingV2AdminReviewRows(
        queueRows.filter((row) => isCounterRankingV2ReviewPublicEligible(row.review)),
        sortMode,
        championsById,
      ),
    [championsById, queueRows, sortMode],
  );
  const visibleRows = useMemo(
    () => {
      const tabRows = queueRows.filter((row) =>
        isCounterRankingV2AdminReviewRowInTab(row, reviewTab),
      );
      const filteredRows = tabRows.filter((row) =>
        isCounterRankingV2AdminReviewRowVisible({
          automationFilter,
          candidateQuery,
          dataFilter,
          publicFilter,
          queueSection,
          reviewFilter,
          reviewTab,
          row,
          strengthFilter,
        }),
      );
      const modeRows =
        reviewTab === "review_suggestions" && reviewMode === "top_candidates"
          ? getCounterRankingV2TopCandidateRowsPerTarget({
              rows: filteredRows,
              topCandidateCap,
            })
          : filteredRows;

      return sortCounterRankingV2AdminReviewRows(
        modeRows,
        sortMode,
        championsById,
      );
    },
    [
      automationFilter,
      candidateQuery,
      championsById,
      dataFilter,
      publicFilter,
      queueRows,
      queueSection,
      reviewFilter,
      reviewMode,
      reviewTab,
      sortMode,
      strengthFilter,
      topCandidateCap,
    ],
  );
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = visibleRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedRows = visibleRows.filter((row) => selectedRowKeys.has(row.rowKey));
  const previewRows = publicCounterRows.slice(0, 12);
  const activeTabLabel =
    counterRankingV2AdminReviewTabs.find((tab) => tab.tab === reviewTab)?.label ?? "Rows";
  const selectedTargetSummary = enemyChampionId
    ? targetSummaries.find(
        (targetSummary) =>
          normalizeCounterRankingV2ChampionId(targetSummary.targetChampionId) ===
          normalizeCounterRankingV2ChampionId(enemyChampionId),
      ) ?? null
    : null;
  const selectedTargetLabel =
    selectedTargetSummary?.label ??
    (enemyChampionId
      ? `${championsById.get(normalizeCounterRankingV2ChampionId(enemyChampionId))?.name ?? enemyChampionId} ${getRoleLabel(selectedRole)}`
      : `All reviewed profile targets ${getRoleLabel(selectedRole)}`);
  const selectedTargetSummaryText = selectedTargetSummary
    ? `${selectedTargetSummary.label} - ${selectedTargetSummary.publicEligible}/${counterRankingV2PublicCounterCaps.total} public - ${selectedTargetSummary.publicStrong} strong - ${selectedTargetSummary.publicSoft} soft - ${selectedTargetSummary.remainingUnreviewed} unreviewed`
    : `${selectedTargetLabel} - ${visibleRows.length} visible - ${summary.publicEligible}/${counterRankingV2PublicCounterCaps.total} public`;

  function runBatchReview({
    approveMode,
    publicEligible,
    reviewStatus: nextReviewStatus,
  }: {
    approveMode?: "public_up_to_cap" | "reviewed_only";
    publicEligible?: boolean;
    reviewStatus?: CounterRankingV2AdminBatchReviewStatus;
  }) {
    if (
      (approveMode === "public_up_to_cap" || publicEligible === true) &&
      selectedRows.length > 1 &&
      typeof window !== "undefined"
    ) {
      const targetCount = new Set(
        selectedRows.map(
          (row) =>
            `${normalizeCounterRankingV2ChampionId(row.targetChampionId)}:${row.mechanicalResult.role ?? selectedRole}`,
        ),
      ).size;
      const confirmed = window.confirm(
        `You are about to review ${selectedRows.length} rows across ${targetCount} champion-role targets. Public eligibility will only be applied up to the configured cap.`,
      );

      if (!confirmed) {
        return;
      }
    }

    const destructiveStatuses: CounterRankingV2AdminBatchReviewStatus[] = [
      "incorrect_suggestion",
      "not_a_counter",
    ];

    if (
      nextReviewStatus &&
      destructiveStatuses.includes(nextReviewStatus) &&
      typeof window !== "undefined" &&
      !window.confirm(
        `Mark ${selectedRows.length} selected row(s) as ${formatCounterRankingV2ReviewStatus(nextReviewStatus)}?`,
      )
    ) {
      return;
    }

    onBatchReview({
      approveMode,
      publicEligible,
      reviewStatus: nextReviewStatus,
      rows: selectedRows,
    });
  }

  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-[#10182b]/90 text-white shadow-xl shadow-black/15">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="font-mono text-xl">Public Counter Review</CardTitle>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                Review mechanical counter suggestions across champion-role profiles, approve public
                candidates, and keep rejected or not-a-counter rows out of public Counter Pick.
              </p>
            </div>
            <Button
              className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
              onClick={onRefresh}
              type="button"
              variant="ghost"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-cyan-100">Selected target</p>
                <p className="mt-1 text-sm text-cyan-50">{selectedTargetSummaryText}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="border-emerald-300/20 bg-emerald-500/10 text-emerald-100">
                  {selectedTargetSummary?.publicEligible ?? summary.publicEligible}/{counterRankingV2PublicCounterCaps.total} public
                </Badge>
                <Badge className="border-cyan-300/20 bg-cyan-500/10 text-cyan-100">
                  {selectedTargetSummary?.publicStrong ?? summary.verifiedStrong}/{counterRankingV2PublicCounterCaps.strong} strong
                </Badge>
                <Badge className="border-sky-300/20 bg-sky-500/10 text-sky-100">
                  {selectedTargetSummary?.publicSoft ?? summary.verifiedSoft}/{counterRankingV2PublicCounterCaps.soft} soft
                </Badge>
              </div>
            </div>
          </div>

          <button
            className="inline-flex w-fit items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 transition hover:border-cyan-300/25 hover:bg-cyan-500/[0.06]"
            onClick={() => setIsOverviewOpen((isOpen) => !isOpen)}
            type="button"
          >
            {isOverviewOpen ? (
              <ChevronDown className="size-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-4" aria-hidden="true" />
            )}
            Overview
          </button>

          {isOverviewOpen ? (
            <div className="space-y-4">
              <CounterRankingV2AdminReviewSummaryGrid summary={summary} />

              <p className="rounded-md border border-cyan-300/20 bg-cyan-500/10 p-3 text-sm leading-6 text-cyan-100">
                Review the best candidates first. You do not need to classify every matchup. Public
                Counter Pick only uses reviewed and public eligible counters.
              </p>

              <CounterRankingV2TargetReviewSummaryPanel
                onOpenPublicCounters={() => {
                  setReviewTab("public_counters");
                  setSelectedRowKeys(new Set());
                  setPage(1);
                }}
                summaries={targetSummaries}
              />
            </div>
          ) : null}

          {unsupportedRoleReviewCount > 0 ? (
            <p className="rounded-md border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-100">
              {unsupportedRoleReviewCount} unsupported/off-role review row{unsupportedRoleReviewCount === 1 ? "" : "s"} excluded from the normal queue.
            </p>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {counterRankingV2AdminReviewTabs.map((tab) => {
              const count = getCounterRankingV2AdminReviewTabCount(queueRows, tab.tab);
              const isActive = reviewTab === tab.tab;

              return (
                <button
                  className={cn(
                    "rounded-md border p-3 text-left transition",
                    isActive
                      ? "border-cyan-300/30 bg-cyan-500/10 text-cyan-100"
                      : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-cyan-300/25 hover:bg-cyan-500/[0.06]",
                  )}
                  key={tab.tab}
                  onClick={() => {
                    setReviewTab(tab.tab);
                    setSelectedRowKeys(new Set());
                    setPage(1);
                  }}
                  type="button"
                >
                  <span className="block text-sm font-semibold">{tab.label}</span>
                  <span className="mt-1 block text-xl font-semibold">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="sticky top-3 z-20 grid gap-4 rounded-lg border border-white/10 bg-[#10182b]/95 p-3 shadow-xl shadow-black/20 backdrop-blur lg:grid-cols-5">
            <AdminReviewSelect
              label="Role"
              onChange={(value) => {
                onSelectRole(value as LeagueRole);
                setPage(1);
              }}
              value={selectedRole}
            >
              {leagueRoles.map((role) => (
                <option className={selectOptionClassName} key={role} value={role}>
                  {getRoleLabel(role)}
                </option>
              ))}
            </AdminReviewSelect>

            <AdminReviewSelect
              label="Target champion"
              onChange={(value) => {
                onSelectEnemyChampion(value);
                setPage(1);
              }}
              value={enemyChampionId}
            >
              <option className={selectOptionClassName} value="">
                All reviewed profile targets
              </option>
              {roleSupportedChampions.map((champion) => (
                <option className={selectOptionClassName} key={champion.id} value={champion.id}>
                  {champion.name}
                </option>
              ))}
            </AdminReviewSelect>

            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">Candidate champion</span>
              <Input
                className="h-10 border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500"
                onChange={(event) => {
                  setCandidateQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search candidate..."
                type="search"
                value={candidateQuery}
              />
            </label>

            <AdminReviewSelect
              label="Public status"
              onChange={(value) => {
                setPublicFilter(value as typeof publicFilter);
                setPage(1);
              }}
              value={publicFilter}
            >
              <option className={selectOptionClassName} value="all">All public states</option>
              <option className={selectOptionClassName} value="public_eligible">Public eligible</option>
              <option className={selectOptionClassName} value="not_public">Not public</option>
            </AdminReviewSelect>

            <div className="space-y-2">
              <span className="text-sm text-zinc-300">Density</span>
              <div className="grid h-10 grid-cols-2 rounded-md border border-white/10 bg-white/[0.03] p-1">
                {(["compact", "comfortable"] as const).map((density) => (
                  <button
                    aria-pressed={densityMode === density}
                    className={cn(
                      "rounded px-2 text-xs font-semibold transition",
                      densityMode === density
                        ? "bg-cyan-500/20 text-cyan-100"
                        : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
                    )}
                    key={density}
                    onClick={() => setDensityMode(density)}
                    type="button"
                  >
                    {density === "compact" ? "Compact" : "Comfortable"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            className="inline-flex w-fit items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 transition hover:border-cyan-300/25 hover:bg-cyan-500/[0.06]"
            onClick={() => setAreAdvancedFiltersOpen((isOpen) => !isOpen)}
            type="button"
          >
            {areAdvancedFiltersOpen ? (
              <ChevronDown className="size-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-4" aria-hidden="true" />
            )}
            Advanced filters
          </button>

          {areAdvancedFiltersOpen ? (
            <div className="grid gap-3 rounded-lg border border-white/10 bg-black/15 p-3 lg:grid-cols-5">
            <AdminReviewSelect
              label="Sort"
              onChange={(value) => setSortMode(value as CounterRankingV2AdminReviewSort)}
              value={sortMode}
            >
              {counterRankingV2AdminReviewSortOptions.map((option) => (
                <option className={selectOptionClassName} key={option.sort} value={option.sort}>
                  {option.label}
                </option>
              ))}
            </AdminReviewSelect>
            <AdminReviewSelect
              label="Queue mode"
              onChange={(value) => {
                setReviewMode(value as CounterRankingV2AdminReviewMode);
                setPage(1);
              }}
              value={reviewMode}
            >
              <option className={selectOptionClassName} value="top_candidates">
                Top candidates per champion
              </option>
              <option className={selectOptionClassName} value="all">All matching rows</option>
            </AdminReviewSelect>
            <AdminReviewSelect
              label="Top candidates"
              onChange={(value) => {
                setTopCandidateCap(Number(value) as (typeof counterRankingV2TopCandidateCaps)[number]);
                setPage(1);
              }}
              value={String(topCandidateCap)}
            >
              {counterRankingV2TopCandidateCaps.map((cap) => (
                <option className={selectOptionClassName} key={cap} value={cap}>
                  Show top {cap}
                </option>
              ))}
            </AdminReviewSelect>
            <AdminReviewSelect
              label="Review status"
              onChange={(value) => {
                setReviewFilter(value as CounterRankingV2ReviewFilter | "reviewed_only");
                setPage(1);
              }}
              value={reviewFilter}
            >
              <option className={selectOptionClassName} value="all">All statuses</option>
              <option className={selectOptionClassName} value="reviewed_only">Reviewed only</option>
              <option className={selectOptionClassName} value="high_mastery_required">
                High mastery required
              </option>
              {counterRankingV2ReviewStatuses.map((status) => (
                <option className={selectOptionClassName} key={status} value={status}>
                  {formatCounterRankingV2ReviewStatus(status)}
                </option>
              ))}
            </AdminReviewSelect>
            <AdminReviewSelect
              label="Automation"
              onChange={(value) => {
                setAutomationFilter(value as CounterRankingV2AutomationStatus | "all");
                setPage(1);
              }}
              value={automationFilter}
            >
              <option className={selectOptionClassName} value="all">All automation</option>
              <option className={selectOptionClassName} value="auto_approval_candidate">Auto approval candidates</option>
              <option className={selectOptionClassName} value="auto_suggested">Auto suggested</option>
              <option className={selectOptionClassName} value="needs_review">Needs review</option>
              <option className={selectOptionClassName} value="manual_approved">Manual approved</option>
              <option className={selectOptionClassName} value="manual_rejected">Manual rejected</option>
            </AdminReviewSelect>
            <AdminReviewSelect
              label="Observed data"
              onChange={(value) => {
                setDataFilter(value as typeof dataFilter);
                setPage(1);
              }}
              value={dataFilter}
            >
              <option className={selectOptionClassName} value="all">All samples</option>
              <option className={selectOptionClassName} value="has_observed">Has observed data</option>
              <option className={selectOptionClassName} value="no_observed">No observed data</option>
              <option className={selectOptionClassName} value="low_sample">Low sample</option>
            </AdminReviewSelect>
            <AdminReviewSelect
              label="Suggestion"
              onChange={(value) => {
                setStrengthFilter(value as typeof strengthFilter);
                setPage(1);
              }}
              value={strengthFilter}
            >
              <option className={selectOptionClassName} value="all">All suggestions</option>
              <option className={selectOptionClassName} value="strong_counter">Strong counter suggestions</option>
              <option className={selectOptionClassName} value="soft_counter">Soft counter suggestions</option>
            </AdminReviewSelect>
          </div>
          ) : null}
        </CardContent>
      </Card>

      {reviewTab === "review_suggestions" && areAdvancedFiltersOpen ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {counterRankingV2AdminReviewQueueSections.map((section) => {
          const count = getCounterRankingV2AdminReviewSectionCount(queueRows, section.section);
          const isActive = queueSection === section.section;

          return (
            <button
              className={cn(
                "rounded-md border p-3 text-left transition",
                isActive
                  ? "border-cyan-300/30 bg-cyan-500/10 text-cyan-100"
                  : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-cyan-300/25 hover:bg-cyan-500/[0.06]",
              )}
              key={section.section}
              onClick={() => {
                setQueueSection(section.section);
                setPage(1);
              }}
              type="button"
            >
              <span className="block text-sm font-semibold">{section.label}</span>
              <span className="mt-1 block text-xl font-semibold">{count}</span>
            </button>
          );
        })}
      </div>
      ) : null}

      <CounterRankingV2AdminBatchPanel
        disabled={isBatchSaving}
        isPublicCountersTab={reviewTab === "public_counters"}
        onClearSelection={() => setSelectedRowKeys(new Set())}
        onBatchReview={runBatchReview}
        onSelectVisibleRows={() =>
          setSelectedRowKeys(new Set(visibleRows.map((row) => row.rowKey)))
        }
        selectedCount={selectedRows.length}
        visibleCount={visibleRows.length}
      />

      <div className="rounded-lg border border-white/10 bg-black/15 p-3">
        <button
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-100 transition hover:text-cyan-100"
          onClick={() => setIsPublicPreviewOpen((isOpen) => !isOpen)}
          type="button"
        >
          {isPublicPreviewOpen ? (
            <ChevronDown className="size-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="size-4" aria-hidden="true" />
          )}
          Public preview
          <span className="text-xs font-normal text-zinc-500">
            {publicCounterRows.length} public row{publicCounterRows.length === 1 ? "" : "s"}
          </span>
        </button>
        {isPublicPreviewOpen ? (
          <div className="mt-3">
            <CounterRankingV2AdminPublicPreviewPanel
              championsById={championsById}
              rows={previewRows}
              totalPublicRows={publicCounterRows.length}
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-400">
            Showing {paginatedRows.length} of {visibleRows.length} {activeTabLabel.toLowerCase()} rows
            {reviewTab === "review_suggestions" && reviewMode === "top_candidates"
              ? ` in top-${topCandidateCap}-per-target mode.`
              : "."}
          </p>
          <div className="flex items-center gap-2">
            <Button
              className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
              disabled={currentPage <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              type="button"
              variant="ghost"
            >
              Previous
            </Button>
            <span className="text-sm text-zinc-500">
              Page {currentPage} / {totalPages}
            </span>
            <Button
              className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              type="button"
              variant="ghost"
            >
              Next
            </Button>
          </div>
        </div>

        {reviewStatus.error ? (
          <p className="rounded-md border border-rose-300/25 bg-rose-500/10 p-3 text-sm text-rose-100">
            {reviewStatus.error}
          </p>
        ) : null}
        {reviewStatus.success ? (
          <p className="rounded-md border border-emerald-300/25 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            {reviewStatus.success}
          </p>
        ) : null}

        {paginatedRows.length > 0 ? (
          paginatedRows.map((row) => (
            <CounterRankingV2AdminReviewRow
              championsById={championsById}
              densityMode={densityMode}
              isSaving={savingReviewKey === row.candidateChampionId || savingReviewKey === "batch"}
              isSelected={selectedRowKeys.has(row.rowKey)}
              key={row.rowKey}
              onSaveReview={onSaveReview}
              reviewTab={reviewTab}
              onToggleSelected={() =>
                setSelectedRowKeys((currentKeys) => {
                  const nextKeys = new Set(currentKeys);

                  if (nextKeys.has(row.rowKey)) {
                    nextKeys.delete(row.rowKey);
                  } else {
                    nextKeys.add(row.rowKey);
                  }

                  return nextKeys;
                })
              }
              row={row}
            />
          ))
        ) : (
          <EmptyState text={getCounterRankingV2AdminReviewEmptyStateText(reviewTab)} />
        )}
      </div>
    </div>
  );
}

function AdminReviewSelect({
  children,
  label,
  onChange,
  value,
}: {
  children: ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm text-zinc-300">{label}</span>
      <select
        className={`${fieldClassName} h-10`}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
    </label>
  );
}

function CounterRankingV2AdminReviewSummaryGrid({
  summary,
}: {
  summary: ReturnType<typeof getCounterRankingV2AdminReviewSummary>;
}) {
  const summaryItems = [
    { label: "Total suggestions", value: summary.total },
    { label: "Unreviewed", value: summary.unreviewed },
    { label: "Auto approval candidates", value: summary.autoApprovalCandidates },
    { label: "Auto suggested", value: summary.autoSuggested },
    { label: "Verified strong", value: summary.verifiedStrong },
    { label: "Verified soft", value: summary.verifiedSoft },
    { label: "High mastery", value: summary.highMasteryRequired },
    { label: "Not a counter", value: summary.notCounters },
    { label: "Needs more data", value: summary.needsMoreData },
    { label: "Public eligible", value: summary.publicEligible },
    { label: "Low sample", value: summary.lowSample },
    { label: "Unsupported/off-role excluded", value: summary.unsupportedRoleExcluded },
  ] as const;

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
      {summaryItems.map((item) => (
        <CounterRankingV2CompactMetric key={item.label} label={item.label} value={item.value} />
      ))}
    </div>
  );
}

function CounterRankingV2TargetReviewSummaryPanel({
  onOpenPublicCounters,
  summaries,
}: {
  onOpenPublicCounters: () => void;
  summaries: CounterRankingV2TargetReviewSummary[];
}) {
  if (summaries.length === 0) {
    return null;
  }

  const visibleSummaries = summaries.slice(0, 6);

  return (
    <div className="rounded-lg border border-white/10 bg-black/15 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-zinc-100">Per-target review summary</p>
        <p className="text-xs text-zinc-500">
          {summaries.length > visibleSummaries.length
            ? `${visibleSummaries.length} of ${summaries.length} targets shown`
            : `${summaries.length} target${summaries.length === 1 ? "" : "s"}`}
        </p>
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {visibleSummaries.map((summary) => (
          <div
            className="rounded-md border border-white/10 bg-white/[0.03] p-3"
            key={`${summary.targetChampionId}-${summary.label}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="text-sm font-semibold text-zinc-100">{summary.label}</p>
              <Badge className="border-emerald-300/20 bg-emerald-500/10 text-emerald-100">
                {summary.publicEligible}/{counterRankingV2PublicCounterCaps.total} public
              </Badge>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              {summary.publicStrong}/{counterRankingV2PublicCounterCaps.strong} strong,{" "}
              {summary.publicSoft}/{counterRankingV2PublicCounterCaps.soft} soft
            </p>
            {summary.publicEligible >= counterRankingV2PublicCounterWarningThreshold ? (
              <p className="mt-2 rounded-md border border-amber-300/20 bg-amber-500/10 p-2 text-xs leading-5 text-amber-100">
                {summary.label} already has {summary.publicEligible} public counters. Consider
                keeping only the clearest 3-6 recommendations.
                <button
                  className="ml-2 font-semibold text-amber-50 underline-offset-4 hover:underline"
                  onClick={onOpenPublicCounters}
                  type="button"
                >
                  Open Public counters
                </button>
              </p>
            ) : null}
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <CounterRankingV2CompactMetric label="Strong" value={summary.verifiedStrong} />
              <CounterRankingV2CompactMetric label="Soft" value={summary.verifiedSoft} />
              <CounterRankingV2CompactMetric label="Unreviewed" value={summary.remainingUnreviewed} />
              <CounterRankingV2CompactMetric label="Not counter" value={summary.notCounters} />
              <CounterRankingV2CompactMetric label="More data" value={summary.needsMoreData} />
              <CounterRankingV2CompactMetric label="Public" value={summary.publicEligible} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CounterRankingV2AdminBatchPanel({
  disabled,
  isPublicCountersTab,
  onClearSelection,
  onBatchReview,
  onSelectVisibleRows,
  selectedCount,
  visibleCount,
}: {
  disabled: boolean;
  isPublicCountersTab: boolean;
  onClearSelection: () => void;
  onBatchReview: (input: {
    approveMode?: "public_up_to_cap" | "reviewed_only";
    publicEligible?: boolean;
    reviewStatus?: CounterRankingV2AdminBatchReviewStatus;
  }) => void;
  onSelectVisibleRows: () => void;
  selectedCount: number;
  visibleCount: number;
}) {
  const hasSelection = selectedCount > 0;
  const selectLabel = isPublicCountersTab ? "Select visible public counters" : "Select visible rows";

  return (
    <div className="rounded-lg border border-white/10 bg-black/15 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-100">Batch review actions</p>
          <p className="mt-1 text-xs text-zinc-500">{selectedCount} selected</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
            disabled={visibleCount === 0 || disabled}
            onClick={onSelectVisibleRows}
            type="button"
            variant="ghost"
          >
            {selectLabel}
          </Button>
          <Button
            className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
            disabled={!hasSelection || disabled}
            onClick={onClearSelection}
            type="button"
            variant="ghost"
          >
            Clear selection
          </Button>
          {counterRankingV2AdminBatchReviewStatuses.map((status) => (
            <Button
              className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
              disabled={!hasSelection || disabled}
              key={status}
              onClick={() => onBatchReview({ reviewStatus: status })}
              type="button"
              variant="ghost"
            >
              {formatCounterRankingV2ReviewStatus(status)}
            </Button>
          ))}
          <Button
            className="border-cyan-300/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
            disabled={!hasSelection || disabled}
            onClick={() => onBatchReview({ approveMode: "reviewed_only" })}
            type="button"
            variant="ghost"
          >
            Approve reviewed only
          </Button>
          <Button
            className="border-emerald-300/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
            disabled={!hasSelection || disabled}
            onClick={() => onBatchReview({ approveMode: "public_up_to_cap" })}
            type="button"
            variant="ghost"
          >
            Approve and make public up to cap
          </Button>
          {isPublicCountersTab ? (
            <>
              <Button
                className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
                disabled={!hasSelection || disabled}
                onClick={() => onBatchReview({ publicEligible: false })}
                type="button"
                variant="ghost"
              >
                Remove from public
              </Button>
              <Button
                className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
                disabled={!hasSelection || disabled}
                onClick={() =>
                  onBatchReview({ publicEligible: true, reviewStatus: "verified_soft_counter" })
                }
                type="button"
                variant="ghost"
              >
                Downgrade to soft
              </Button>
            </>
          ) : null}
          <Button
            className="border-emerald-300/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
            disabled={!hasSelection || disabled}
            onClick={() => onBatchReview({ publicEligible: true })}
            type="button"
            variant="ghost"
          >
            Enable public eligible
          </Button>
          <Button
            className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
            disabled={!hasSelection || disabled}
            onClick={() => onBatchReview({ publicEligible: false })}
            type="button"
            variant="ghost"
          >
            Disable public eligible
          </Button>
        </div>
      </div>
    </div>
  );
}

function CounterRankingV2AdminPublicPreviewPanel({
  championsById,
  rows,
  totalPublicRows,
}: {
  championsById: Map<string, AdminLeagueChampion>;
  rows: CounterRankingV2AdminReviewRow[];
  totalPublicRows: number;
}) {
  const approvedRows = rows.filter((row) => isCounterRankingV2ReviewPublicEligible(row.review));
  const bestCounterRows = approvedRows.filter(
    (row) =>
      row.review?.reviewStatus === "verified_strong_counter" ||
      row.review?.reviewStatus === "verified_soft_counter",
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-emerald-300/15 bg-emerald-500/[0.05] p-3">
        <p className="text-sm font-semibold text-emerald-100">Public preview: Best Counters</p>
        <p className="mt-1 text-xs text-emerald-100/70">
          Showing current public rows for the selected target/role, independent of queue filters.
          {totalPublicRows > rows.length ? ` First ${rows.length} of ${totalPublicRows} shown.` : ""}
        </p>
        <CounterRankingV2AdminPreviewList
          championsById={championsById}
          rows={bestCounterRows}
          variant="best"
        />
      </div>
      <div className="rounded-lg border border-cyan-300/15 bg-cyan-500/[0.05] p-3">
        <p className="text-sm font-semibold text-cyan-100">Public preview: Bad Into inverse</p>
        <p className="mt-1 text-xs text-cyan-100/70">
          Uses public eligible reviewed counters, even when the suggestion queue is empty.
        </p>
        <CounterRankingV2AdminPreviewList
          championsById={championsById}
          rows={bestCounterRows}
          variant="inverse"
        />
      </div>
    </div>
  );
}

function CounterRankingV2AdminPreviewList({
  championsById,
  rows,
  variant,
}: {
  championsById: Map<string, AdminLeagueChampion>;
  rows: CounterRankingV2AdminReviewRow[];
  variant: "best" | "inverse";
}) {
  if (rows.length === 0) {
    return (
      <p className="mt-3 rounded-md border border-white/10 bg-black/15 p-3 text-sm text-zinc-500">
        No public counters match the current target and role. Try the All rows tab or clear
        candidate/status filters.
      </p>
    );
  }

  return (
    <ul className="mt-3 space-y-2">
      {rows.slice(0, 8).map((row) => {
        const target = championsById.get(normalizeCounterRankingV2ChampionId(row.targetChampionId));
        const candidate = championsById.get(normalizeCounterRankingV2ChampionId(row.candidateChampionId));
        const listedChampion = variant === "best" ? candidate : target;
        const contextChampion = variant === "best" ? target : candidate;

        return (
          <li className="rounded-md border border-white/10 bg-black/15 p-3" key={`${variant}-${row.rowKey}`}>
            <p className="text-sm font-semibold text-zinc-100">
              {listedChampion?.name ?? listedChampion?.id ?? "Unknown"}{" "}
              {variant === "best" ? "as Best Counter into" : "in Bad Into for"}{" "}
              {contextChampion?.name ?? contextChampion?.id ?? "Unknown"} {getRoleLabel(row.mechanicalResult.role ?? "mid")}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {formatCounterRankingV2ReviewStatus(row.review?.reviewStatus ?? "unreviewed")} · public-safe preview
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function CounterRankingV2AdminReviewRow({
  championsById,
  densityMode,
  isSaving,
  isSelected,
  onSaveReview,
  onToggleSelected,
  reviewTab,
  row,
}: {
  championsById: Map<string, AdminLeagueChampion>;
  densityMode: CounterRankingV2AdminReviewDensity;
  isSaving: boolean;
  isSelected: boolean;
  onSaveReview: (row: CounterRankingV2ComparisonRow, form: CounterRankingV2ReviewForm) => void;
  onToggleSelected: () => void;
  reviewTab: CounterRankingV2AdminReviewTab;
  row: CounterRankingV2AdminReviewRow;
}) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [form, setForm] = useState<CounterRankingV2ReviewForm>(() =>
    getCounterRankingV2ReviewForm(row.review),
  );
  const target = championsById.get(normalizeCounterRankingV2ChampionId(row.targetChampionId));
  const candidate = championsById.get(normalizeCounterRankingV2ChampionId(row.candidateChampionId));
  const observedGames = row.observed?.games ?? 0;
  const isLowSample = observedGames > 0 && observedGames < publicCounterPickMinimumRankedGames;
  const isPublicAllowed =
    form.reviewStatus === "verified_strong_counter" ||
    form.reviewStatus === "verified_soft_counter";
  const isPublicEligibleChecked = isPublicAllowed && form.publicEligible;
  const reasons = row.automationSuggestion?.blockers.length
    ? row.automationSuggestion.blockers.map((blocker) => blocker.message)
    : (row.automationSuggestion?.reasons ?? []);
  const mechanicalReasons = getCounterRankingV2MechanicalReasons(row.mechanicalResult.factors, 1);
  const priorityScore = Math.round(getCounterRankingV2AdminReviewPriorityScore(row));
  const isPublicCountersTab = reviewTab === "public_counters";
  const suggestionExplanation = getCounterRankingV2RowSuggestionExplanation(row);
  const rowWarnings = getCounterRankingV2RowWarnings(row);
  const isManualOverridePublicRow = isCounterRankingV2ManualOverridePublicRow(row);
  const rowPadding = densityMode === "compact" ? "p-2" : "p-3";
  const metricTextClassName = densityMode === "compact" ? "text-xs" : "text-sm";
  const manualReviewScore = row.review?.finalMechanicalScore ?? null;
  const observedRankLabel = row.observed?.rank ? `#${row.observed.rank}` : "None";

  function saveWithStatus(reviewStatus: CounterRankingV2ReviewStatus) {
    const nextForm = {
      ...form,
      publicEligible:
        reviewStatus === "verified_strong_counter" || reviewStatus === "verified_soft_counter"
          ? form.publicEligible
          : false,
      reviewStatus,
    };

    setForm(nextForm);
    onSaveReview(row, nextForm);
  }

  function saveWithFormPatch(patch: Partial<CounterRankingV2ReviewForm>) {
    const nextForm = {
      ...form,
      ...patch,
    };

    setForm(nextForm);
    onSaveReview(row, {
      ...nextForm,
      publicEligible:
        nextForm.reviewStatus === "verified_strong_counter" ||
        nextForm.reviewStatus === "verified_soft_counter"
          ? nextForm.publicEligible
          : false,
    });
  }

  return (
    <div className={cn("rounded-lg border border-white/10 bg-white/[0.03]", rowPadding)}>
      <div className="grid gap-3 xl:grid-cols-[minmax(18rem,1.7fr)_minmax(14rem,1fr)_minmax(16rem,1fr)_minmax(18rem,1.2fr)] xl:items-center">
        <label className="flex min-w-0 items-center gap-3 text-sm text-zinc-300">
          <input
            checked={isSelected}
            className="size-4 accent-cyan-300"
            onChange={onToggleSelected}
            type="checkbox"
          />
          <span className="sr-only">Select row</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">
              {candidate?.name ?? row.candidateChampionId} into {target?.name ?? row.targetChampionId}
            </span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              {getRoleLabel(row.mechanicalResult.role ?? "mid")} - Candidate into target
            </span>
          </span>
        </label>

        <div className="flex flex-wrap gap-1.5">
          <Badge className="border-sky-300/20 bg-sky-500/10 text-sky-100">
            {row.automationSuggestion
              ? formatCounterRankingV2AutomationStatus(row.automationSuggestion.automationStatus)
              : "No automation"}
          </Badge>
          <Badge className="border-white/10 bg-white/5 text-zinc-300">
            {formatCounterRankingV2ReviewStatus(form.reviewStatus)}
          </Badge>
          {isPublicEligibleChecked ? (
            <Badge className="border-emerald-300/20 bg-emerald-500/10 text-emerald-100">
              Public eligible
            </Badge>
          ) : (
            <Badge className="border-white/10 bg-white/5 text-zinc-400">
              Internal review only
            </Badge>
          )}
          {isManualOverridePublicRow ? (
            <Badge className="border-amber-300/20 bg-amber-500/10 text-amber-100">
              Manual override
            </Badge>
          ) : null}
          {form.highMasteryRequired ? (
            <Badge className="border-amber-300/20 bg-amber-500/10 text-amber-100">
              High Mastery
            </Badge>
          ) : null}
          {isLowSample ? (
            <Badge className="border-amber-300/20 bg-amber-500/10 text-amber-100">Low sample</Badge>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-2 text-zinc-300">
          <div>
            <p className="text-[11px] uppercase text-zinc-500">Mechanical</p>
            <p className={cn("font-semibold text-zinc-100", metricTextClassName)}>
              {row.mechanicalResult.score}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-zinc-500">Manual</p>
            <p
              className={cn(
                "font-semibold",
                manualReviewScore === null ? "text-zinc-500" : "text-zinc-100",
                metricTextClassName,
              )}
            >
              {manualReviewScore === null ? "None" : formatNullableNumber(manualReviewScore)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-zinc-500">Games</p>
            <p className={cn("font-semibold text-zinc-100", metricTextClassName)}>
              {formatNullableNumber(observedGames)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-start gap-1.5 xl:justify-end">
          {rowWarnings.length > 0
            ? rowWarnings.map((warning, index) => (
                <Badge
                  className="border-amber-300/20 bg-amber-500/10 text-amber-100"
                  key={`${warning}-${index}`}
                >
                  Warning
                </Badge>
              ))
            : null}
          <Badge className="border-white/10 bg-white/5 text-zinc-300">
            {row.observed ? `Observed ${observedRankLabel}` : "No observed data"}
          </Badge>
          <Badge className="border-white/10 bg-white/5 text-zinc-300">
            Priority {priorityScore}
          </Badge>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap justify-end gap-1.5">
        {isPublicCountersTab ? (
          <Button
            className="h-8 border-white/10 bg-white/5 px-2 text-xs text-zinc-100 hover:bg-white/10"
            disabled={isSaving}
            onClick={() => saveWithFormPatch({ publicEligible: false })}
            title="Remove from public"
            type="button"
            variant="ghost"
          >
            Remove
          </Button>
        ) : null}
        <Button
          className="h-8 border-cyan-300/20 bg-cyan-500/10 px-2 text-xs text-cyan-100 hover:bg-cyan-500/20"
          disabled={isSaving}
          onClick={() => saveWithStatus("verified_strong_counter")}
          title="Verified strong counter"
          type="button"
          variant="ghost"
        >
          Strong
        </Button>
        <Button
          className="h-8 border-sky-300/20 bg-sky-500/10 px-2 text-xs text-sky-100 hover:bg-sky-500/20"
          disabled={isSaving}
          onClick={() =>
            saveWithFormPatch({
              publicEligible: isPublicCountersTab ? true : form.publicEligible,
              reviewStatus: "verified_soft_counter",
            })
          }
          title="Verified soft counter"
          type="button"
          variant="ghost"
        >
          Soft
        </Button>
        <Button
          className="h-8 border-white/10 bg-white/5 px-2 text-xs text-zinc-100 hover:bg-white/10"
          disabled={isSaving}
          onClick={() => saveWithStatus("needs_more_data")}
          title="Needs more data"
          type="button"
          variant="ghost"
        >
          Data
        </Button>
        <Button
          className="h-8 border-white/10 bg-white/5 px-2 text-xs text-zinc-100 hover:bg-white/10"
          disabled={isSaving}
          onClick={() => saveWithStatus("not_a_counter")}
          title="Not a counter"
          type="button"
          variant="ghost"
        >
          No
        </Button>
        <Button
          className="h-8 border-amber-300/20 bg-amber-500/10 px-2 text-xs text-amber-100 hover:bg-amber-500/20"
          disabled={isSaving}
          onClick={() => saveWithFormPatch({ highMasteryRequired: !form.highMasteryRequired })}
          title={form.highMasteryRequired ? "Clear high mastery" : "High mastery required"}
          type="button"
          variant="ghost"
        >
          HM
        </Button>
        <Button
          className="h-8 border-emerald-300/20 bg-emerald-500/10 px-2 text-xs text-emerald-100 hover:bg-emerald-500/20"
          disabled={isSaving || !isPublicAllowed}
          onClick={() => saveWithFormPatch({ publicEligible: !isPublicEligibleChecked })}
          title={isPublicEligibleChecked ? "Clear public eligible" : "Public eligible"}
          type="button"
          variant="ghost"
        >
          Public
        </Button>
        <Button
          className="h-8 border-cyan-300/20 bg-cyan-500/10 px-2 text-xs text-cyan-100 hover:bg-cyan-500/20"
          onClick={() => setIsEditorOpen(true)}
          type="button"
          variant="ghost"
        >
          <Pencil className="size-3.5" aria-hidden="true" />
          Edit
        </Button>
      </div>

      {isEditorOpen ? (
        <div className="fixed inset-0 z-50 bg-black/70">
          <div className="ml-auto flex h-full w-full max-w-3xl flex-col border-l border-white/10 bg-[#071321] shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
              <div>
                <p className="text-xs font-semibold uppercase text-cyan-200">
                  Counter review editor
                </p>
                <h3 className="mt-1 text-lg font-semibold text-white">
                  {candidate?.name ?? row.candidateChampionId} into {target?.name ?? row.targetChampionId}
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  {getRoleLabel(row.mechanicalResult.role ?? "mid")} - full row details and editing controls
                </p>
              </div>
              <Button
                className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
                onClick={() => setIsEditorOpen(false)}
                type="button"
                variant="ghost"
              >
                <X className="size-4" aria-hidden="true" />
                Close
              </Button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <CounterRankingV2Metric label="Mechanical score" value={String(row.mechanicalResult.score)} />
                <CounterRankingV2Metric label="Manual review score" value={formatNullableNumber(row.review?.finalMechanicalScore)} />
                <CounterRankingV2Metric label="Observed rank" value={observedRankLabel} />
                <CounterRankingV2Metric label="Observed games" value={formatNullableNumber(row.observed?.games)} />
                <CounterRankingV2Metric label="Observed confidence" value={row.observed?.confidence.shortLabel ?? "No data"} />
                <CounterRankingV2Metric label="Observed mismatch" value={row.rankDelta === null ? "None" : formatRankDelta(row.rankDelta)} />
                <CounterRankingV2Metric label="Review priority" value={String(priorityScore)} />
                <CounterRankingV2Metric label="Public status" value={isPublicEligibleChecked ? "Public eligible" : "Internal review only"} />
              </div>

              <div className="rounded-md border border-white/10 bg-black/15 p-3">
                <p className="text-sm text-zinc-300">{suggestionExplanation}</p>
                {rowWarnings.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {rowWarnings.map((warning) => (
                      <li className="text-xs text-amber-100" key={warning}>
                        Warning: {warning}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              {reasons.length > 0 || mechanicalReasons.length > 0 ? (
                <div className="rounded-md border border-white/10 bg-black/15 p-3">
                  {mechanicalReasons.at(0) ? (
                    <p className="text-sm text-zinc-300">{mechanicalReasons[0].explanation}</p>
                  ) : null}
                  {reasons.slice(0, 3).map((reason) => (
                    <p className="mt-1 text-xs text-zinc-500" key={reason}>{reason}</p>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-3 rounded-md border border-white/10 bg-black/15 p-3 md:grid-cols-2">
                <CounterRankingV2Metric
                  label="Target profile"
                  value={row.targetProfile ? `${formatProfileStatus(row.targetProfile.reviewStatus)} v${row.targetProfile.version}` : "Missing"}
                />
                <CounterRankingV2Metric
                  label="Candidate profile"
                  value={row.candidateProfile ? `${formatProfileStatus(row.candidateProfile.reviewStatus)} v${row.candidateProfile.version}` : "Missing"}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {counterRankingV2ReviewStatuses
                  .filter((status) => status !== "unreviewed")
                  .map((status) => (
                    <Button
                      className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
                      disabled={isSaving}
                      key={status}
                      onClick={() => saveWithStatus(status)}
                      type="button"
                      variant="ghost"
                    >
                      {formatCounterRankingV2ReviewStatus(status)}
                    </Button>
                  ))}
              </div>

              <form
                className="grid gap-3 rounded-md border border-white/10 bg-white/[0.03] p-3 lg:grid-cols-[0.5fr_1fr]"
                onSubmit={(event) => {
                  event.preventDefault();
                  onSaveReview(row, {
                    ...form,
                    publicEligible: isPublicAllowed && form.publicEligible,
                  });
                }}
              >
                <label className="block space-y-2">
                  <span className="text-sm text-zinc-300">Manual adjustment</span>
                  <Input
                    className="h-10 border-white/10 bg-white/5 text-zinc-100"
                    disabled={isSaving}
                    max={30}
                    min={-30}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, manualAdjustment: event.target.value }))}
                    type="number"
                    value={form.manualAdjustment}
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm text-zinc-300">Admin note</span>
                  <Input
                    className="h-10 border-white/10 bg-white/5 text-zinc-100"
                    disabled={isSaving}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, adminReviewNote: event.target.value }))}
                    placeholder="Admin note"
                    value={form.adminReviewNote}
                  />
                </label>
                <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/15 px-3 py-2 text-xs text-zinc-300">
                  <input
                    checked={isPublicEligibleChecked}
                    className="size-4 accent-cyan-300"
                    disabled={isSaving || !isPublicAllowed}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, publicEligible: event.target.checked }))}
                    type="checkbox"
                  />
                  Public eligible
                </label>
                <label className="flex items-center gap-2 rounded-md border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                  <input
                    checked={form.highMasteryRequired}
                    className="size-4 accent-amber-300"
                    disabled={isSaving}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        highMasteryRequired: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  High mastery required
                </label>
                <div className="flex flex-wrap gap-2 lg:col-span-2">
                  <Button
                    className="border-cyan-300/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
                    disabled={isSaving}
                    type="submit"
                    variant="ghost"
                  >
                    <Save className="size-4" aria-hidden="true" />
                    Save note / adjustment
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CounterRankingV2AdminReviewCard({
  championsById,
  isSaving,
  isSelected,
  onSaveReview,
  onToggleSelected,
  reviewTab,
  row,
}: {
  championsById: Map<string, AdminLeagueChampion>;
  isSaving: boolean;
  isSelected: boolean;
  onSaveReview: (row: CounterRankingV2ComparisonRow, form: CounterRankingV2ReviewForm) => void;
  onToggleSelected: () => void;
  reviewTab: CounterRankingV2AdminReviewTab;
  row: CounterRankingV2AdminReviewRow;
}) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [form, setForm] = useState<CounterRankingV2ReviewForm>(() =>
    getCounterRankingV2ReviewForm(row.review),
  );
  const target = championsById.get(normalizeCounterRankingV2ChampionId(row.targetChampionId));
  const candidate = championsById.get(normalizeCounterRankingV2ChampionId(row.candidateChampionId));
  const observedGames = row.observed?.games ?? 0;
  const isLowSample = observedGames > 0 && observedGames < publicCounterPickMinimumRankedGames;
  const isPublicAllowed =
    form.reviewStatus === "verified_strong_counter" ||
    form.reviewStatus === "verified_soft_counter";
  const isPublicEligibleChecked = isPublicAllowed && form.publicEligible;
  const reasons = row.automationSuggestion?.blockers.length
    ? row.automationSuggestion.blockers.map((blocker) => blocker.message)
    : (row.automationSuggestion?.reasons ?? []);
  const mechanicalReasons = getCounterRankingV2MechanicalReasons(row.mechanicalResult.factors, 1);
  const priorityScore = Math.round(getCounterRankingV2AdminReviewPriorityScore(row));
  const isPublicCountersTab = reviewTab === "public_counters";
  const suggestionExplanation = getCounterRankingV2RowSuggestionExplanation(row);
  const rowWarnings = getCounterRankingV2RowWarnings(row);
  const isManualOverridePublicRow = isCounterRankingV2ManualOverridePublicRow(row);

  function saveWithStatus(reviewStatus: CounterRankingV2ReviewStatus) {
    const nextForm = {
      ...form,
      publicEligible:
        reviewStatus === "verified_strong_counter" || reviewStatus === "verified_soft_counter"
          ? form.publicEligible
          : false,
      reviewStatus,
    };

    setForm(nextForm);
    onSaveReview(row, nextForm);
  }

  function saveWithFormPatch(patch: Partial<CounterRankingV2ReviewForm>) {
    const nextForm = {
      ...form,
      ...patch,
    };

    setForm(nextForm);
    onSaveReview(row, {
      ...nextForm,
      publicEligible:
        nextForm.reviewStatus === "verified_strong_counter" ||
        nextForm.reviewStatus === "verified_soft_counter"
          ? nextForm.publicEligible
          : false,
    });
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <label className="flex items-center gap-3 text-sm text-zinc-300">
          <input
            checked={isSelected}
            className="size-4 accent-cyan-300"
            onChange={onToggleSelected}
            type="checkbox"
          />
          Select
        </label>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {candidate?.name ?? row.candidateChampionId} into {target?.name ?? row.targetChampionId} ·{" "}
            {getRoleLabel(row.mechanicalResult.role ?? "mid")}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Target profile: {row.targetProfile ? `${formatProfileStatus(row.targetProfile.reviewStatus)} v${row.targetProfile.version}` : "Missing"} · Candidate profile:{" "}
            {row.candidateProfile ? `${formatProfileStatus(row.candidateProfile.reviewStatus)} v${row.candidateProfile.version}` : "Missing"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="border-sky-300/20 bg-sky-500/10 text-sky-100">
            {row.automationSuggestion ? formatCounterRankingV2AutomationStatus(row.automationSuggestion.automationStatus) : "No automation"}
          </Badge>
          <Badge className="border-white/10 bg-white/5 text-zinc-300">
            {formatCounterRankingV2ReviewStatus(row.review?.reviewStatus ?? "unreviewed")}
          </Badge>
          {isCounterRankingV2ReviewPublicEligible(row.review) ? (
            <Badge className="border-emerald-300/20 bg-emerald-500/10 text-emerald-100">Public eligible</Badge>
          ) : null}
          {isManualOverridePublicRow ? (
            <Badge className="border-amber-300/20 bg-amber-500/10 text-amber-100">
              Manual override
            </Badge>
          ) : null}
          {row.review?.highMasteryRequired ? (
            <Badge className="border-amber-300/20 bg-amber-500/10 text-amber-100">
              High Mastery
            </Badge>
          ) : null}
          {isLowSample ? (
            <Badge className="border-amber-300/20 bg-amber-500/10 text-amber-100">Low sample</Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <CounterRankingV2Metric label="Mechanical score" value={String(row.mechanicalResult.score)} />
        <CounterRankingV2Metric label="Manual review score" value={formatNullableNumber(row.review?.finalMechanicalScore)} />
        <CounterRankingV2Metric label="Observed rank" value={row.observed?.rank ? `#${row.observed.rank}` : "None"} />
        <CounterRankingV2Metric label="Games" value={formatNullableNumber(row.observed?.games)} />
        <CounterRankingV2Metric label="Observed confidence" value={row.observed?.confidence.shortLabel ?? "No data"} />
        <CounterRankingV2Metric label="Observed mismatch" value={row.rankDelta === null ? "None" : formatRankDelta(row.rankDelta)} />
        <CounterRankingV2Metric label="Review priority" value={String(priorityScore)} />
      </div>

      <div className="mt-3 rounded-md border border-white/10 bg-black/15 p-3">
        <p className="text-sm text-zinc-300">{suggestionExplanation}</p>
        {rowWarnings.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {rowWarnings.map((warning) => (
              <li className="text-xs text-amber-100" key={warning}>
                Warning: {warning}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {reasons.length > 0 || mechanicalReasons.length > 0 ? (
        <div className="mt-3 rounded-md border border-white/10 bg-black/15 p-3">
          {mechanicalReasons.at(0) ? (
            <p className="text-sm text-zinc-300">{mechanicalReasons[0].explanation}</p>
          ) : null}
          {reasons.slice(0, 2).map((reason) => (
            <p className="mt-1 text-xs text-zinc-500" key={reason}>{reason}</p>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {isPublicCountersTab ? (
          <>
            <Button
              className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
              disabled={isSaving}
              onClick={() => saveWithFormPatch({ publicEligible: false })}
              type="button"
              variant="ghost"
            >
              Remove from public
            </Button>
            <Button
              className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
              disabled={isSaving}
              onClick={() =>
                saveWithFormPatch({
                  publicEligible: true,
                  reviewStatus: "verified_soft_counter",
                })
              }
              type="button"
              variant="ghost"
            >
              Downgrade to soft
            </Button>
            <Button
              className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
              disabled={isSaving}
              onClick={() => saveWithStatus("not_a_counter")}
              type="button"
              variant="ghost"
            >
              Mark not a counter
            </Button>
            <Button
              className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
              disabled={isSaving}
              onClick={() => saveWithStatus("needs_more_data")}
              type="button"
              variant="ghost"
            >
              Needs more data
            </Button>
          </>
        ) : null}
        {counterRankingV2ReviewStatuses
          .filter((status) => status !== "unreviewed")
          .map((status) => (
            <Button
              className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
              disabled={isSaving}
              key={status}
              onClick={() => saveWithStatus(status)}
              type="button"
              variant="ghost"
            >
              {formatCounterRankingV2ReviewStatus(status)}
            </Button>
          ))}
        <Button
          className="border-cyan-300/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
          onClick={() => setIsEditorOpen((isOpen) => !isOpen)}
          type="button"
          variant="ghost"
        >
          <Pencil className="size-4" aria-hidden="true" />
          {isEditorOpen ? "Close edit" : "Edit"}
        </Button>
        <Button
          className="border-amber-300/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
          disabled={isSaving}
          onClick={() => saveWithFormPatch({ highMasteryRequired: !form.highMasteryRequired })}
          type="button"
          variant="ghost"
        >
          {form.highMasteryRequired ? "Clear high mastery" : "High mastery"}
        </Button>
        <Button
          className="border-emerald-300/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
          disabled={isSaving || !isPublicAllowed}
          onClick={() => saveWithFormPatch({ publicEligible: !isPublicEligibleChecked })}
          type="button"
          variant="ghost"
        >
          {isPublicEligibleChecked ? "Clear public eligible" : "Public eligible"}
        </Button>
      </div>

      {isEditorOpen ? (
        <form
        className="mt-4 grid gap-3 lg:grid-cols-[0.5fr_1fr_auto_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          onSaveReview(row, {
            ...form,
            publicEligible: isPublicAllowed && form.publicEligible,
          });
        }}
      >
        <Input
          className="h-10 border-white/10 bg-white/5 text-zinc-100"
          disabled={isSaving}
          max={30}
          min={-30}
          onChange={(event) => setForm((currentForm) => ({ ...currentForm, manualAdjustment: event.target.value }))}
          type="number"
          value={form.manualAdjustment}
        />
        <Input
          className="h-10 border-white/10 bg-white/5 text-zinc-100"
          disabled={isSaving}
          onChange={(event) => setForm((currentForm) => ({ ...currentForm, adminReviewNote: event.target.value }))}
          placeholder="Admin note"
          value={form.adminReviewNote}
        />
        <label className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-300">
          <input
            checked={isPublicEligibleChecked}
            className="size-4 accent-cyan-300"
            disabled={isSaving || !isPublicAllowed}
            onChange={(event) => setForm((currentForm) => ({ ...currentForm, publicEligible: event.target.checked }))}
            type="checkbox"
          />
          Public eligible
        </label>
        <label className="flex items-center gap-2 rounded-md border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <input
            checked={form.highMasteryRequired}
            className="size-4 accent-amber-300"
            disabled={isSaving}
            onChange={(event) =>
              setForm((currentForm) => ({
                ...currentForm,
                highMasteryRequired: event.target.checked,
              }))
            }
            type="checkbox"
          />
          High mastery required
        </label>
        <div className="lg:col-span-4">
          <Button
            className="border-cyan-300/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
            disabled={isSaving}
            type="submit"
            variant="ghost"
          >
            <Save className="size-4" aria-hidden="true" />
            Save note / adjustment
          </Button>
        </div>
      </form>
      ) : null}
    </div>
  );
}

function CounterRankingV2ShadowPanel({
  championsById,
  enemyChampionId,
  isLoading,
  onBatchSaveReview,
  onSaveReview,
  profileOverridesByChampionId,
  profileStatusesByChampionId,
  reviewStatus,
  rows,
  savingReviewKey,
  selectedRole,
  statusError,
}: {
  championsById: Map<string, AdminLeagueChampion>;
  enemyChampionId: string;
  isLoading: boolean;
  onBatchSaveReview: (input: {
    action: BatchCounterRankingV2MechanicalReviewAction;
    publicEligible: boolean;
    rows: CounterRankingV2ComparisonRow[];
  }) => Promise<void>;
  onSaveReview: (row: CounterRankingV2ComparisonRow, form: CounterRankingV2ReviewForm) => void;
  profileOverridesByChampionId: CounterRankingV2ProfileByChampionId;
  profileStatusesByChampionId: CounterRankingV2ProfileStatusByChampionId;
  reviewStatus: FormStatus;
  rows: CounterRankingV2ComparisonRow[];
  savingReviewKey: string | null;
  selectedRole: LeagueRole;
  statusError: string | null;
}) {
  const [reviewFilter, setReviewFilter] = useState<CounterRankingV2ReviewFilter>("all");
  const [batchPublicEligible, setBatchPublicEligible] = useState(false);
  const [selectedAutoApprovalCandidateIds, setSelectedAutoApprovalCandidateIds] = useState<
    Set<string>
  >(() => new Set());
  const enemyChampion = championsById.get(normalizeCounterRankingV2ChampionId(enemyChampionId));
  const enemyProfile = enemyChampionId
    ? getCounterRankingV2ChampionProfile(
        enemyChampionId,
        profileStatusesByChampionId,
        profileOverridesByChampionId,
        selectedRole,
      )
    : null;
  const hasEnemyProfile = enemyProfile !== null;
  const reviewTargetLabel = enemyChampion
    ? `${enemyChampion.name} ${getRoleLabel(selectedRole)}`
    : `selected target ${getRoleLabel(selectedRole)}`;
  const reviewTargetValue = enemyChampion ? reviewTargetLabel : "None";
  const hasObservedStats = rows.some((row) => row.observed !== null);
  const hasReviewRows = rows.some((row) => row.review !== null);
  const reviewProgressSummary = useMemo(
    () => getCounterRankingV2ReviewProgressSummary(rows),
    [rows],
  );
  const automationSummary = useMemo(
    () => getCounterRankingV2AutomationSummary(rows),
    [rows],
  );
  const automationBlockerSummary = useMemo(
    () => getCounterRankingV2AutomationBlockerSummary(rows),
    [rows],
  );
  const publicPreviewRows = useMemo(
    () =>
      getCounterRankingV2PublicPreviewRows({
        minimumGames: publicCounterPickMinimumRankedGames,
        rows,
      }),
    [rows],
  );
  const filteredRows = useMemo(
    () =>
      filterCounterRankingV2RowsByReviewFilter({
        filter: reviewFilter,
        minimumGames: publicCounterPickMinimumRankedGames,
        rows,
      }),
    [reviewFilter, rows],
  );
  const candidatePoolSummary = useMemo(
    () =>
      getCounterRankingV2CandidatePoolSummary({
        candidateChampionIds: Array.from(championsById.values()).map((champion) => champion.id),
        candidatesDisplayed: filteredRows.length,
        candidatesEvaluated: rows.length,
        role: selectedRole,
      }),
    [championsById, filteredRows.length, rows.length, selectedRole],
  );
  const activeFilterLabel =
    counterRankingV2ShadowReviewFilterOptions.find((option) => option.filter === reviewFilter)
      ?.label ?? "All";
  const autoApprovalCandidateRows = useMemo(
    () =>
      rows.filter(
        (row) => row.automationSuggestion?.automationStatus === "auto_approval_candidate",
      ),
    [rows],
  );
  const selectedAutoApprovalRows = useMemo(
    () =>
      autoApprovalCandidateRows.filter((row) =>
        selectedAutoApprovalCandidateIds.has(row.candidateChampionId),
      ),
    [autoApprovalCandidateRows, selectedAutoApprovalCandidateIds],
  );
  const isBatchSaving = savingReviewKey === "batch";

  async function handleBatchReviewAction(action: BatchCounterRankingV2MechanicalReviewAction) {
    const safePublicEligible =
      batchPublicEligible &&
      selectedAutoApprovalRows.every(isCounterRankingV2SafeAutoPublicApprovalRow);

    await onBatchSaveReview({
      action,
      publicEligible: safePublicEligible,
      rows: selectedAutoApprovalRows,
    });
    setSelectedAutoApprovalCandidateIds(new Set());
    setBatchPublicEligible(false);
  }

  return (
    <Card className="border-cyan-300/15 bg-[#071321]/95 text-white shadow-xl shadow-black/15">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="font-mono text-xl">
              Mechanical counters against {reviewTargetLabel}
            </CardTitle>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Internal-only comparison between current observed win-rate rank and deterministic
              mechanical matchup fit. Every candidate below is evaluated into {reviewTargetLabel}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="border-cyan-300/20 bg-cyan-500/10 text-cyan-100">Shadow mode</Badge>
            <Badge className="border-white/10 bg-white/5 text-zinc-300">
              Sorted by review priority
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-5">
          <CounterRankingV2MetaCell
            label="Review target"
            value={reviewTargetValue}
          />
          <CounterRankingV2MetaCell
            label="Target profile"
            value={
              enemyProfile
                ? `${formatProfileStatus(enemyProfile.reviewStatus)} v${enemyProfile.version}`
                : "Missing"
            }
          />
          <CounterRankingV2MetaCell
            label="Observed data"
            value={
              !hasEnemyProfile
                ? "Not loaded"
                : isLoading
                  ? "Loading"
                  : statusError
                    ? "Unavailable"
                    : hasObservedStats
                      ? "Loaded from current stats"
                      : "No observed stats"
            }
          />
          <CounterRankingV2MetaCell
            label="Review layer"
            value={
              !hasEnemyProfile
                ? "Not loaded"
                : reviewStatus.isLoading
                ? "Loading"
                : reviewStatus.error
                  ? "Unavailable"
                  : hasReviewRows
                    ? "Loaded from review table"
                    : "No review rows yet"
            }
          />
          <CounterRankingV2MetaCell
            label="Public reviewed counters"
            value={useReviewedMechanicalCountersPublicly ? "Feature flag enabled" : "Disabled"}
          />
        </div>

        {statusError ? (
          <p className="rounded-md border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-100">
            {statusError}
          </p>
        ) : null}
        {reviewStatus.error ? (
          <p className="rounded-md border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-100">
            {reviewStatus.error}
          </p>
        ) : null}
        {reviewStatus.success ? (
          <p className="rounded-md border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            {reviewStatus.success}
          </p>
        ) : null}

        <CounterRankingV2CandidatePoolSummaryPanel summary={candidatePoolSummary} />

        {!hasEnemyProfile ? (
          <EmptyState
            tone="warning"
            text="This champion does not have a mechanical profile yet."
          />
        ) : rows.length === 0 ? (
          <EmptyState text="No Counter Ranking V2 mechanical candidates into this target are available for this selection." />
        ) : (
          <>
            {!isLoading && !statusError && !hasObservedStats ? (
              <EmptyState text="No observed stats are available for this target and role yet." />
            ) : null}
            {!reviewStatus.isLoading && !reviewStatus.error && !hasReviewRows ? (
              <EmptyState text="No review rows have been saved for this target and role yet." />
            ) : null}
            <CounterRankingV2ReviewProgressSummaryPanel summary={reviewProgressSummary} />
            <CounterRankingV2AutomationSummaryPanel summary={automationSummary} />
            <CounterRankingV2AutomationBlockerSummaryPanel
              summary={automationBlockerSummary}
            />
            <CounterRankingV2BatchReviewPanel
              autoApprovalCandidateCount={autoApprovalCandidateRows.length}
              isBatchSaving={isBatchSaving}
              onAction={(action) => void handleBatchReviewAction(action)}
              onPublicEligibleChange={setBatchPublicEligible}
              onSelectAll={() =>
                setSelectedAutoApprovalCandidateIds(
                  new Set(autoApprovalCandidateRows.map((row) => row.candidateChampionId)),
                )
              }
              onSelectionChange={setSelectedAutoApprovalCandidateIds}
              publicEligible={batchPublicEligible}
              selectedCount={selectedAutoApprovalRows.length}
              selectedIds={selectedAutoApprovalCandidateIds}
            />
            <CounterRankingV2PublicPreviewPanel
              championsById={championsById}
              previewRows={publicPreviewRows}
              targetLabel={reviewTargetLabel}
            />
            <p className="text-sm font-semibold text-zinc-100">
              Mechanical candidates into {reviewTargetLabel}
            </p>
            <div className="rounded-lg border border-white/10 bg-black/15 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-zinc-100">Review filters</p>
                <p className="text-xs text-zinc-500">
                  {activeFilterLabel}: {filteredRows.length} of {rows.length} counter candidates
                </p>
              </div>
              <div
                aria-label="Counter Ranking V2 review filters"
                className="mt-3 flex flex-wrap gap-2"
                role="group"
              >
                {counterRankingV2ShadowReviewFilterOptions.map((option) => {
                  const isActiveFilter = option.filter === reviewFilter;

                  return (
                    <button
                      aria-pressed={isActiveFilter}
                      className={cn(
                        "rounded-md border px-3 py-2 text-xs font-semibold transition-colors",
                        isActiveFilter
                          ? "border-cyan-300/30 bg-cyan-500/15 text-cyan-100"
                          : "border-white/10 bg-white/5 text-zinc-300 hover:border-cyan-300/20 hover:bg-white/10",
                      )}
                      key={option.filter}
                      onClick={() => setReviewFilter(option.filter)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {filteredRows.length === 0 ? (
              <EmptyState text="No mechanical candidates match this filter." />
            ) : (
              <CounterRankingV2ShadowRows
                championsById={championsById}
                isLoadingObserved={isLoading}
                key={`${enemyChampionId}-${selectedRole}-${reviewFilter}`}
                onAutoApprovalSelectionToggle={(candidateId) =>
                  setSelectedAutoApprovalCandidateIds((currentIds) => {
                    const nextIds = new Set(currentIds);

                    if (nextIds.has(candidateId)) {
                      nextIds.delete(candidateId);
                    } else {
                      nextIds.add(candidateId);
                    }

                    return nextIds;
                  })
                }
                onSaveReview={onSaveReview}
                profileOverridesByChampionId={profileOverridesByChampionId}
                profileStatusesByChampionId={profileStatusesByChampionId}
                rows={filteredRows}
                savingReviewKey={savingReviewKey}
                selectedAutoApprovalCandidateIds={selectedAutoApprovalCandidateIds}
                targetLabel={reviewTargetLabel}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CounterRankingV2ShadowRows({
  championsById,
  isLoadingObserved,
  onAutoApprovalSelectionToggle,
  onSaveReview,
  profileOverridesByChampionId,
  profileStatusesByChampionId,
  rows,
  savingReviewKey,
  selectedAutoApprovalCandidateIds,
  targetLabel,
}: {
  championsById: Map<string, AdminLeagueChampion>;
  isLoadingObserved: boolean;
  onAutoApprovalSelectionToggle: (candidateId: string) => void;
  onSaveReview: (row: CounterRankingV2ComparisonRow, form: CounterRankingV2ReviewForm) => void;
  profileOverridesByChampionId: CounterRankingV2ProfileByChampionId;
  profileStatusesByChampionId: CounterRankingV2ProfileStatusByChampionId;
  rows: CounterRankingV2ComparisonRow[];
  savingReviewKey: string | null;
  selectedAutoApprovalCandidateIds: Set<string>;
  targetLabel: string;
}) {
  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(
    () => rows[0]?.candidateChampionId ?? null,
  );

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <CounterRankingV2ShadowRow
          candidate={championsById.get(row.candidateChampionId) ?? null}
          isExpanded={expandedCandidateId === row.candidateChampionId}
          isLoadingObserved={isLoadingObserved}
          isSelectedForAutoApproval={selectedAutoApprovalCandidateIds.has(row.candidateChampionId)}
          key={`${row.candidateChampionId}-${row.review?.updatedAt ?? "new"}`}
          onAutoApprovalSelectionToggle={() =>
            onAutoApprovalSelectionToggle(row.candidateChampionId)
          }
          onSaveReview={onSaveReview}
          onToggle={() =>
            setExpandedCandidateId((currentCandidateId) =>
              currentCandidateId === row.candidateChampionId ? null : row.candidateChampionId,
            )
          }
          profileOverridesByChampionId={profileOverridesByChampionId}
          profileStatusesByChampionId={profileStatusesByChampionId}
          row={row}
          savingReviewKey={savingReviewKey}
          targetLabel={targetLabel}
        />
      ))}
    </div>
  );
}

function CounterRankingV2MetaCell({
  label,
  title,
  value,
}: {
  label: string;
  title?: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3" title={title}>
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function CounterRankingV2ReviewProgressSummaryPanel({
  summary,
}: {
  summary: CounterRankingV2ReviewProgressSummary;
}) {
  const progressItems = [
    { label: "Total counter candidates", value: summary.total },
    { label: "Reviewed counter candidates", value: summary.reviewed },
    { label: "Unreviewed counter candidates", value: summary.unreviewed },
    { label: "Verified strong counters", value: summary.verifiedStrongCounters },
    { label: "Verified soft counters", value: summary.verifiedSoftCounters },
    { label: "High mastery", value: summary.highMasteryRequired },
    { label: "Not counters", value: summary.notCounters },
    { label: "Needs more data", value: summary.needsMoreData },
    { label: "Incorrect suggestions", value: summary.incorrectSuggestions },
    { label: "Public eligible", value: summary.publicEligible },
  ] as const;

  return (
    <div className="rounded-lg border border-cyan-300/15 bg-cyan-500/[0.06] p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-cyan-100">Review progress</p>
        <p className="text-xs text-zinc-500">Selected target and role</p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {progressItems.map((item) => (
          <div className="rounded-md border border-white/10 bg-black/15 p-3" key={item.label}>
            <p className="text-xs uppercase text-zinc-500">{item.label}</p>
            <p className="mt-1 text-lg font-semibold text-zinc-100">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CounterRankingV2AutomationSummaryPanel({
  summary,
}: {
  summary: CounterRankingV2AutomationSummary;
}) {
  const automationItems = [
    { label: "Generated suggestions", value: summary.generatedSuggestions },
    { label: "Auto approval candidates", value: summary.autoApprovalCandidates },
    { label: "Auto suggested", value: summary.autoSuggested },
    { label: "Needs review", value: summary.needsReview },
    { label: "Manually approved", value: summary.manualApproved },
    { label: "Manually rejected", value: summary.manualRejected },
  ] as const;

  return (
    <div className="rounded-lg border border-sky-300/15 bg-sky-500/[0.05] p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-sky-100">Automation suggestions</p>
        <p className="text-xs text-zinc-500">Generated from mechanical profiles only</p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {automationItems.map((item) => (
          <div className="rounded-md border border-white/10 bg-black/15 p-3" key={item.label}>
            <p className="text-xs uppercase text-zinc-500">{item.label}</p>
            <p className="mt-1 text-lg font-semibold text-zinc-100">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CounterRankingV2AutomationBlockerSummaryPanel({
  summary,
}: {
  summary: CounterRankingV2AutomationBlockerSummary;
}) {
  const blockerItems = [
    { label: "Target profile is generated_draft", value: summary.target_profile_generated_draft },
    {
      label: "Candidate profile is generated_draft",
      value: summary.candidate_profile_generated_draft,
    },
    { label: "Profile needs_revision", value: summary.profile_needs_revision },
    { label: "Profile deprecated", value: summary.profile_deprecated },
    {
      label: "Score below auto_suggested threshold",
      value: summary.score_below_auto_suggested_threshold,
    },
    {
      label: "Score below auto_approval threshold",
      value: summary.score_below_auto_approval_threshold,
    },
    { label: "High mastery candidate", value: summary.high_mastery_candidate },
    {
      label: "Insufficient direct counter signal",
      value: summary.insufficient_direct_counter_signal,
    },
    { label: "Observed-stat contradiction", value: summary.observed_stat_contradiction },
    { label: "Weak one-factor signal", value: summary.weak_one_factor_signal },
    {
      label: "Existing manual review overrides automation",
      value: summary.existing_manual_review_override,
    },
    {
      label: "Excluded unsupported candidate role",
      value: summary.excluded_unsupported_candidate_role,
    },
    { label: "Manually rejected", value: summary.manually_rejected },
    { label: "Missing profile", value: summary.missing_profile },
    { label: "Other", value: summary.other },
  ] as const;

  return (
    <div className="rounded-lg border border-amber-300/15 bg-amber-500/[0.05] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-100">
            Automation blocker breakdown
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Thresholds: auto_suggested 75-84, auto_approval_candidate 85+, 65-74 needs_review.
          </p>
        </div>
        <p className="text-xs text-zinc-500">Selected target and role</p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {blockerItems.map((item) => (
          <div
            className={cn(
              "rounded-md border p-3",
              item.value > 0
                ? "border-amber-300/20 bg-amber-500/10"
                : "border-white/10 bg-black/15",
            )}
            key={item.label}
          >
            <p className="text-xs uppercase text-zinc-500">{item.label}</p>
            <p className="mt-1 text-lg font-semibold text-zinc-100">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CounterRankingV2CandidatePoolSummaryPanel({
  summary,
}: {
  summary: CounterRankingV2CandidatePoolSummary;
}) {
  const roleLabel = getRoleLabel(summary.role);

  return (
    <div className="rounded-lg border border-cyan-300/15 bg-cyan-500/[0.05] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-cyan-100">
            {roleLabel} candidate pool
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            {roleLabel} candidates: {summary.includedForSelectedRole} included,{" "}
            {summary.excludedUnsupportedCandidateRole} excluded by role support.
          </p>
        </div>
        <p className="text-xs text-zinc-500">Selected target role</p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <CounterRankingV2CompactMetric
          label="Total active champions"
          value={summary.totalActiveChampions}
        />
        <CounterRankingV2CompactMetric
          label="Included for role"
          value={summary.includedForSelectedRole}
        />
        <CounterRankingV2CompactMetric
          label="Excluded by role"
          value={summary.excludedUnsupportedCandidateRole}
        />
        <CounterRankingV2CompactMetric
          label="Evaluated"
          value={summary.candidatesEvaluated}
        />
        <CounterRankingV2CompactMetric
          label="Displayed"
          value={summary.candidatesDisplayed}
        />
      </div>
    </div>
  );
}

function CounterRankingV2CompactMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-black/15 p-3">
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function CounterRankingV2BatchReviewPanel({
  autoApprovalCandidateCount,
  isBatchSaving,
  onAction,
  onPublicEligibleChange,
  onSelectAll,
  onSelectionChange,
  publicEligible,
  selectedCount,
  selectedIds,
}: {
  autoApprovalCandidateCount: number;
  isBatchSaving: boolean;
  onAction: (action: BatchCounterRankingV2MechanicalReviewAction) => void;
  onPublicEligibleChange: (value: boolean) => void;
  onSelectAll: () => void;
  onSelectionChange: (ids: Set<string>) => void;
  publicEligible: boolean;
  selectedCount: number;
  selectedIds: Set<string>;
}) {
  const hasSelection = selectedCount > 0;

  return (
    <div className="rounded-lg border border-white/10 bg-black/15 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-100">Auto-approval batch review</p>
          <p className="mt-1 text-xs text-zinc-500">
            {selectedCount} selected of {autoApprovalCandidateCount} safe candidates
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
            disabled={autoApprovalCandidateCount === 0 || isBatchSaving}
            onClick={onSelectAll}
            type="button"
            variant="ghost"
          >
            <CheckSquare className="size-4" aria-hidden="true" />
            Select candidates
          </Button>
          <Button
            className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
            disabled={selectedIds.size === 0 || isBatchSaving}
            onClick={() => onSelectionChange(new Set())}
            type="button"
            variant="ghost"
          >
            <Square className="size-4" aria-hidden="true" />
            Clear
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-300">
          <input
            checked={publicEligible}
            className="size-4 accent-cyan-300"
            disabled={!hasSelection || isBatchSaving}
            onChange={(event) => onPublicEligibleChange(event.target.checked)}
            type="checkbox"
          />
          Public eligible on approve
        </label>
        <Button
          className="border-emerald-300/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
          disabled={!hasSelection || isBatchSaving}
          onClick={() => onAction("approve")}
          type="button"
          variant="ghost"
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Approve selected
        </Button>
        <Button
          className="border-amber-300/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
          disabled={!hasSelection || isBatchSaving}
          onClick={() => onAction("needs_review")}
          type="button"
          variant="ghost"
        >
          <Pencil className="size-4" aria-hidden="true" />
          Needs review
        </Button>
        <Button
          className="border-rose-300/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
          disabled={!hasSelection || isBatchSaving}
          onClick={() => onAction("reject")}
          type="button"
          variant="ghost"
        >
          <X className="size-4" aria-hidden="true" />
          Reject selected
        </Button>
      </div>
    </div>
  );
}

function CounterRankingV2PublicPreviewPanel({
  championsById,
  previewRows,
  targetLabel,
}: {
  championsById: Map<string, AdminLeagueChampion>;
  previewRows: CounterRankingV2PublicPreviewRow[];
  targetLabel: string;
}) {
  return (
    <div className="rounded-lg border border-emerald-300/15 bg-emerald-500/[0.05] p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-emerald-100">
          Public preview: approved counters against {targetLabel}
        </p>
        <Badge className="border-emerald-300/20 bg-emerald-500/10 text-emerald-100">
          Preview only — public ordering unchanged
        </Badge>
      </div>

      {previewRows.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {previewRows.map((previewRow) => {
            const candidate = championsById.get(previewRow.candidateChampionId) ?? null;

            return (
              <li
                className="rounded-md border border-white/10 bg-black/15 p-3"
                key={previewRow.candidateChampionId}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {candidate ? (
                      <Image
                        alt=""
                        className="size-10 rounded-md bg-white/10 object-cover"
                        height={40}
                        src={getChampionIconPath(candidate)}
                        width={40}
                      />
                    ) : (
                      <div className="size-10 rounded-md bg-white/10" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {candidate?.name ?? previewRow.candidateChampionId}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {formatCounterRankingV2ReviewStatus(previewRow.reviewStatus)}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {candidate?.name ?? previewRow.candidateChampionId} would appear as a
                        public counter against {targetLabel}.
                      </p>
                    </div>
                  </div>
                  {previewRow.isLowSampleDesignCounter ? (
                    <Badge className="border-amber-300/20 bg-amber-500/10 text-amber-100">
                      Low sample mechanical counter
                    </Badge>
                  ) : null}
                  {previewRow.highMasteryRequired ? (
                    <Badge className="border-amber-300/20 bg-amber-500/10 text-amber-100">
                      High Mastery
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <CounterRankingV2Metric
                    label="Current public ranking"
                    value={
                      previewRow.currentPublicRank ? `#${previewRow.currentPublicRank}` : "Unranked"
                    }
                  />
                  <CounterRankingV2Metric
                    label="Manual review score"
                    value={String(previewRow.finalReviewedScore)}
                  />
                  <CounterRankingV2Metric
                    label="Observed games"
                    value={formatNullableNumber(previewRow.observedGames)}
                  />
                  <CounterRankingV2Metric label="Observed confidence" value={previewRow.confidenceLabel} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 rounded-md border border-white/10 bg-black/15 p-3 text-sm text-zinc-500">
          No approved mechanical counters against {targetLabel} are public-preview eligible yet.
        </p>
      )}
    </div>
  );
}

function CounterRankingV2ShadowRow({
  candidate,
  isExpanded,
  isLoadingObserved,
  isSelectedForAutoApproval,
  onAutoApprovalSelectionToggle,
  onSaveReview,
  onToggle,
  profileOverridesByChampionId,
  profileStatusesByChampionId,
  row,
  savingReviewKey,
  targetLabel,
}: {
  candidate: AdminLeagueChampion | null;
  isExpanded: boolean;
  isLoadingObserved: boolean;
  isSelectedForAutoApproval: boolean;
  onAutoApprovalSelectionToggle: () => void;
  onSaveReview: (row: CounterRankingV2ComparisonRow, form: CounterRankingV2ReviewForm) => void;
  onToggle: () => void;
  profileOverridesByChampionId: CounterRankingV2ProfileByChampionId;
  profileStatusesByChampionId: CounterRankingV2ProfileStatusByChampionId;
  row: CounterRankingV2ComparisonRow;
  savingReviewKey: string | null;
  targetLabel: string;
}) {
  const result = row.mechanicalResult;
  const profile = getCounterRankingV2ChampionProfile(
    row.candidateChampionId,
    profileStatusesByChampionId,
    profileOverridesByChampionId,
    row.mechanicalResult.role ?? "mid",
  );
  const automationSuggestion = row.automationSuggestion;
  const topReasons = getCounterRankingV2MechanicalReasons(result.factors);
  const hasWeakMechanicalSignal = hasCounterRankingV2WeakMechanicalSignal(result.factors);
  const [reviewForm, setReviewForm] = useState<CounterRankingV2ReviewForm>(() =>
    getCounterRankingV2ReviewForm(row.review),
  );
  const parsedAdjustment = Number(reviewForm.manualAdjustment);
  const previewAdjustment = clampCounterRankingV2ManualAdjustment(
    Number.isFinite(parsedAdjustment) ? parsedAdjustment : 0,
  );
  const finalScorePreview = calculateCounterRankingV2FinalMechanicalScore({
    calculatedMechanicalScore: result.score,
    manualAdjustment: previewAdjustment,
  });
  const isSavingReview = savingReviewKey === row.candidateChampionId;
  const hasCalculatedScore = result.status === "calculated";
  const observedGames = row.observed?.games ?? 0;
  const hasLowObservedSample =
    observedGames > 0 && observedGames < publicCounterPickMinimumRankedGames;
  const hasNoObservedData = !isLoadingObserved && observedGames === 0;
  const isReviewStatusPublicEligible = isCounterRankingV2ReviewStatusPublicEligible(
    reviewForm.reviewStatus,
  );
  const isPublicEligibleChecked = isReviewStatusPublicEligible && reviewForm.publicEligible;
  const isSavedPublicEligible = isCounterRankingV2ReviewPublicEligible(row.review);
  const isLowSampleDesignCounter = isSavedPublicEligible && hasLowObservedSample;
  const publicEligibilityHelperText =
    reviewForm.reviewStatus === "unreviewed"
      ? "Choose a reviewed status before enabling public eligibility."
      : reviewForm.reviewStatus === "incorrect_suggestion" ||
          reviewForm.reviewStatus === "not_a_counter"
        ? `${formatCounterRankingV2ReviewStatus(reviewForm.reviewStatus)} rows cannot be public eligible.`
        : isPublicEligibleChecked && hasLowObservedSample
          ? "This will be treated as a low-sample mechanical counter."
          : "Stored for shadow review. Public use requires the reviewed-counter feature flag.";
  const panelId = `counter-ranking-v2-review-${row.candidateChampionId}`;
  const isAutoApprovalCandidate =
    automationSuggestion?.automationStatus === "auto_approval_candidate";
  const automationExplanationTitle =
    automationSuggestion?.automationStatus === "needs_review"
      ? "Why this needs review"
      : "Automation reasons";
  const automationExplanations =
    automationSuggestion?.automationStatus === "needs_review" &&
    automationSuggestion.blockers.length > 0
      ? automationSuggestion.blockers.map((blocker) => blocker.message)
      : (automationSuggestion?.reasons ?? []);
  const suggestionExplanation = getCounterRankingV2RowSuggestionExplanation(row);
  const rowWarnings = getCounterRankingV2RowWarnings(row);
  const isManualOverridePublicRow = isCounterRankingV2ManualOverridePublicRow(row);

  return (
    <div
      className={cn(
        "rounded-lg border bg-white/[0.03] transition-colors",
        isExpanded ? "border-cyan-300/25" : "border-white/10 hover:border-cyan-300/20",
      )}
    >
      {isAutoApprovalCandidate ? (
        <label className="flex items-center gap-3 border-b border-white/10 px-4 py-3 text-sm text-zinc-300">
          <input
            checked={isSelectedForAutoApproval}
            className="size-4 accent-cyan-300"
            onChange={onAutoApprovalSelectionToggle}
            type="checkbox"
          />
          <span className="font-semibold text-sky-100">Select for batch review</span>
          <span className="text-xs text-zinc-500">Safe auto-approval candidate</span>
        </label>
      ) : null}
      <button
        aria-controls={panelId}
        aria-expanded={isExpanded}
        className="w-full p-4 text-left"
        onClick={onToggle}
        type="button"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {candidate ? (
              <Image
                alt=""
                className="size-11 rounded-md bg-white/10 object-cover"
                height={44}
                src={getChampionIconPath(candidate)}
                width={44}
              />
            ) : (
              <div className="size-11 rounded-md bg-white/10" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {candidate?.name ?? row.candidateChampionId} into {targetLabel}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {profile ? formatMechanicalProfileStatusLabel(profile) : "No profile"}
              </p>
              {profile ? (
                <p
                  className="mt-1 text-[0.7rem] text-zinc-600"
                  title={counterRankingV2ProfileRevisionHelpText}
                >
                  {formatMechanicalProfileRevisionLabel(profile)}
                </p>
              ) : null}
            </div>
          </div>

          <span className="flex shrink-0 items-center gap-2 rounded-md border border-white/10 bg-black/15 px-3 py-2 text-xs font-semibold text-zinc-300">
            {isExpanded ? (
              <ChevronDown className="size-4 text-cyan-100" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-4 text-cyan-100" aria-hidden="true" />
            )}
            {isExpanded ? "Collapse" : "Review"}
          </span>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <CounterRankingV2Metric
            label="Observed rank"
            value={
              isLoadingObserved
                ? "Loading"
                : row.observed?.rank
                  ? `#${row.observed.rank}`
                  : "None"
            }
          />
          <CounterRankingV2Metric label="Games" value={formatNullableNumber(row.observed?.games)} />
          <CounterRankingV2Metric
            label="Observed confidence"
            value={row.observed?.confidence.shortLabel ?? "No data"}
          />
          <CounterRankingV2Metric
            label="Mechanical rank / score"
            value={
              result.status === "calculated"
                ? `#${row.mechanicalRank} / ${result.score}`
                : "Missing"
            }
          />
          <CounterRankingV2Metric
            label="Suggestion"
            value={
              automationSuggestion
                ? formatCounterRankingV2SuggestedStrength(automationSuggestion.suggestedStrength)
                : "Skipped"
            }
          />
          <CounterRankingV2Metric
            label="Adjustment"
            value={formatSignedAdjustment(previewAdjustment)}
          />
          <CounterRankingV2Metric
            label="Manual review score"
            value={hasCalculatedScore ? String(finalScorePreview) : "Missing"}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge className="border-white/10 bg-white/5 text-zinc-300">
            {formatCounterRankingV2Status(result.status)}
          </Badge>
          <Badge className="border-violet-300/20 bg-violet-500/10 text-violet-100">
            {formatRankDelta(row.rankDelta)}
          </Badge>
          {automationSuggestion ? (
            <>
              <Badge className="border-sky-300/20 bg-sky-500/10 text-sky-100">
                {formatCounterRankingV2AutomationStatus(
                  automationSuggestion.automationStatus,
                )}
              </Badge>
              <Badge className="border-white/10 bg-white/5 text-zinc-300">
                {formatCounterRankingV2AutomationConfidence(
                  automationSuggestion.confidence,
                )}{" "}
                confidence
              </Badge>
            </>
          ) : null}
          {row.observed?.winRate !== null && row.observed?.winRate !== undefined ? (
            <Badge className="border-cyan-300/20 bg-cyan-500/10 text-cyan-100">
              {row.observed.winRate.toFixed(1)}% observed WR
            </Badge>
          ) : null}
          {row.review ? (
            <Badge className="border-emerald-300/20 bg-emerald-500/10 text-emerald-100">
              {formatCounterRankingV2ReviewStatus(row.review.reviewStatus)}
            </Badge>
          ) : (
            <Badge className="border-white/10 bg-white/5 text-zinc-400">No review row</Badge>
          )}
          {isSavedPublicEligible ? (
            <Badge className="border-emerald-300/20 bg-emerald-500/10 text-emerald-100">
              Public eligible
            </Badge>
          ) : (
            <Badge className="border-white/10 bg-white/5 text-zinc-400">
              Internal review only
            </Badge>
          )}
          {isManualOverridePublicRow ? (
            <Badge className="border-amber-300/20 bg-amber-500/10 text-amber-100">
              Manual override
            </Badge>
          ) : null}
          {row.review?.highMasteryRequired ? (
            <Badge className="border-amber-300/20 bg-amber-500/10 text-amber-100">
              High Mastery
            </Badge>
          ) : null}
          {isLowSampleDesignCounter ? (
            <Badge className="border-amber-300/20 bg-amber-500/10 text-amber-100">
              Low sample mechanical counter
            </Badge>
          ) : hasLowObservedSample ? (
            <Badge className="border-amber-300/20 bg-amber-500/10 text-amber-100">
              Low sample size
            </Badge>
          ) : null}
          {hasNoObservedData ? (
            <Badge className="border-white/10 bg-white/5 text-zinc-400">No observed data</Badge>
          ) : null}
          {hasWeakMechanicalSignal ? (
            <Badge className="border-amber-300/20 bg-amber-500/10 text-amber-100">
              Weak signal
            </Badge>
          ) : null}
        </div>
      </button>

      {isExpanded ? (
        <div className="border-t border-white/10 p-4" id={panelId}>
          <div className="mb-4 rounded-md border border-white/10 bg-black/15 p-3">
            <p className="text-sm text-zinc-300">{suggestionExplanation}</p>
            {rowWarnings.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {rowWarnings.map((warning) => (
                  <li className="text-xs text-amber-100" key={warning}>
                    Warning: {warning}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <CounterRankingV2Metric
              label="Calculated mechanical score"
              value={hasCalculatedScore ? String(result.score) : "Missing"}
            />
            <CounterRankingV2Metric
              label="Manual adjustment"
              value={formatSignedAdjustment(previewAdjustment)}
            />
            <CounterRankingV2Metric
              label="Manual review score"
              value={hasCalculatedScore ? String(finalScorePreview) : "Missing"}
            />
          </div>

          {automationSuggestion ? (
            <div className="mt-4 rounded-md border border-sky-300/15 bg-sky-500/[0.05] p-4">
              <p className="text-sm font-semibold text-sky-100">Generated suggestion</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-sky-300/20 bg-sky-500/10 text-sky-100">
                  {formatCounterRankingV2AutomationStatus(
                    automationSuggestion.automationStatus,
                  )}
                </Badge>
                <Badge className="border-white/10 bg-white/5 text-zinc-300">
                  {formatCounterRankingV2SuggestedStrength(
                    automationSuggestion.suggestedStrength,
                  )}
                </Badge>
                <Badge className="border-white/10 bg-white/5 text-zinc-300">
                  {formatCounterRankingV2AutomationConfidence(
                    automationSuggestion.confidence,
                  )}{" "}
                  confidence
                </Badge>
              </div>
              <p className="mt-3 text-xs font-semibold uppercase text-zinc-500">
                {automationExplanationTitle}
              </p>
              <ul className="mt-3 space-y-2">
                {automationExplanations.map((reason) => (
                  <li className="text-sm leading-6 text-zinc-400" key={reason}>
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <form
            className="mt-4 grid gap-4 rounded-md border border-white/10 bg-black/15 p-4 lg:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              onSaveReview(row, reviewForm);
            }}
          >
            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">Review status</span>
              <select
                className={`${fieldClassName} h-10`}
                disabled={!hasCalculatedScore || isSavingReview}
                onChange={(event) =>
                  setReviewForm((currentForm) => ({
                    ...currentForm,
                    publicEligible:
                      event.target.value === "incorrect_suggestion" ||
                      event.target.value === "not_a_counter" ||
                      event.target.value === "unreviewed"
                        ? false
                        : currentForm.publicEligible,
                    reviewStatus: event.target.value as CounterRankingV2ReviewStatus,
                  }))
                }
                value={reviewForm.reviewStatus}
              >
                {counterRankingV2ReviewStatuses.map((status) => (
                  <option className={selectOptionClassName} key={status} value={status}>
                    {formatCounterRankingV2ReviewStatus(status)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">Adjustment reason</span>
              <select
                className={`${fieldClassName} h-10`}
                disabled={!hasCalculatedScore || isSavingReview}
                onChange={(event) =>
                  setReviewForm((currentForm) => ({
                    ...currentForm,
                    adjustmentReason: event.target.value as CounterRankingV2AdjustmentReason,
                  }))
                }
                value={reviewForm.adjustmentReason}
              >
                {counterRankingV2AdjustmentReasons.map((reason) => (
                  <option className={selectOptionClassName} key={reason} value={reason}>
                    {formatCounterRankingV2AdjustmentReason(reason)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">Manual adjustment</span>
              <Input
                className="h-10 border-white/10 bg-white/5 text-zinc-100"
                disabled={!hasCalculatedScore || isSavingReview}
                max={30}
                min={-30}
                onChange={(event) =>
                  setReviewForm((currentForm) => ({
                    ...currentForm,
                    manualAdjustment: event.target.value,
                  }))
                }
                step={1}
                type="number"
                value={reviewForm.manualAdjustment}
              />
              <input
                aria-label="Manual adjustment slider"
                className="w-full accent-cyan-300"
                disabled={!hasCalculatedScore || isSavingReview}
                max={30}
                min={-30}
                onChange={(event) =>
                  setReviewForm((currentForm) => ({
                    ...currentForm,
                    manualAdjustment: event.target.value,
                  }))
                }
                step={1}
                type="range"
                value={Number.isFinite(parsedAdjustment) ? parsedAdjustment : 0}
              />
            </label>

            <label className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] p-3">
              <input
                checked={isPublicEligibleChecked}
                className="size-4 accent-cyan-300"
                disabled={
                  !hasCalculatedScore ||
                  isSavingReview ||
                  !isReviewStatusPublicEligible
                }
                onChange={(event) =>
                  setReviewForm((currentForm) => ({
                    ...currentForm,
                    publicEligible: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              <span>
                <span className="block text-sm font-semibold text-zinc-100">Public eligible</span>
                <span className="block text-xs leading-5 text-zinc-500">
                  {publicEligibilityHelperText}
                </span>
              </span>
            </label>

            <label className="flex items-center gap-3 rounded-md border border-amber-300/20 bg-amber-500/10 p-3">
              <input
                checked={reviewForm.highMasteryRequired}
                className="size-4 accent-amber-300"
                disabled={!hasCalculatedScore || isSavingReview}
                onChange={(event) =>
                  setReviewForm((currentForm) => ({
                    ...currentForm,
                    highMasteryRequired: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              <span>
                <span className="block text-sm font-semibold text-amber-100">
                  High mastery required
                </span>
                <span className="block text-xs leading-5 text-amber-200/70">
                  Modifier only. Public exposure still requires strong or soft counter approval.
                </span>
              </span>
            </label>

            {isPublicEligibleChecked && hasLowObservedSample ? (
              <p className="rounded-md border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-100 lg:col-span-2">
                This will be treated as a low-sample mechanical counter.
              </p>
            ) : null}

            <label className="block space-y-2 lg:col-span-2">
              <span className="text-sm text-zinc-300">Admin review note</span>
              <textarea
                className={`${fieldClassName} min-h-24 py-2 leading-6`}
                disabled={!hasCalculatedScore || isSavingReview}
                onChange={(event) =>
                  setReviewForm((currentForm) => ({
                    ...currentForm,
                    adminReviewNote: event.target.value,
                  }))
                }
                placeholder="Why this mechanical suggestion should be trusted, adjusted, or rejected..."
                value={reviewForm.adminReviewNote}
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-2">
              <p className="text-xs leading-5 text-zinc-500">
                Raw calculated score stays model-owned. Saving only updates the review layer.
              </p>
              <Button
                className="border-cyan-300/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
                disabled={!hasCalculatedScore || isSavingReview}
                type="submit"
                variant="ghost"
              >
                <Save className="size-4" aria-hidden="true" />
                {isSavingReview ? "Saving..." : "Save review"}
              </Button>
            </div>
          </form>

          {hasWeakMechanicalSignal ? (
            <p className="mt-4 rounded-md border border-amber-300/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-100">
              Score is spread across small factors. Treat this suggestion as needing review.
            </p>
          ) : null}

          {topReasons.length > 0 ? (
            <div className="mt-4">
              <p className="text-sm font-semibold text-zinc-100">Top mechanical reasons</p>
              <ul className="mt-3 space-y-2">
                {topReasons.map((reason) => (
                  <li
                    className="rounded-md border border-white/10 bg-black/15 p-3 text-sm leading-6 text-zinc-300"
                    key={`${reason.factor.candidateStrength}-${reason.factor.enemyVulnerability}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-zinc-100">{reason.title}</p>
                        <p className="mt-1 text-xs leading-5 text-zinc-500">
                          {reason.explanation}
                        </p>
                      </div>
                      <Badge
                        className={cn(
                          "shrink-0",
                          getCounterRankingV2ImpactBadgeClassName(reason.impactLevel),
                        )}
                      >
                        {formatCounterRankingV2ImpactLevel(reason.impactLevel)}
                      </Badge>
                    </div>
                    <details className="mt-3 text-xs text-zinc-500">
                      <summary className="cursor-pointer text-zinc-400">
                        Show calculation details
                      </summary>
                      <p className="mt-2">
                        {getTraitLabel(reason.factor.candidateStrength)} into{" "}
                        {getTraitLabel(reason.factor.enemyVulnerability)}. Raw contribution +
                        {reason.factor.contribution.toFixed(1)}.
                      </p>
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 rounded-md border border-white/10 bg-black/15 p-3 text-sm text-zinc-500">
              No contributing mechanical factors are available for this candidate and selected
              target profile.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function CounterRankingV2Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/15 p-3">
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <p className="mt-1 font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function getCounterRankingV2ReviewForm(
  review: CounterRankingV2MechanicalReview | null,
): CounterRankingV2ReviewForm {
  return {
    adjustmentReason: review?.adjustmentReason ?? counterRankingV2DefaultAdjustmentReason,
    adminReviewNote: review?.adminReviewNote ?? "",
    highMasteryRequired: review?.highMasteryRequired ?? false,
    manualAdjustment: String(review?.manualAdjustment ?? 0),
    publicEligible: review?.publicEligible ?? false,
    reviewStatus: review?.reviewStatus ?? counterRankingV2DefaultReviewStatus,
  };
}

function formatSignedAdjustment(adjustment: number) {
  if (!Number.isFinite(adjustment) || adjustment === 0) {
    return "0";
  }

  return adjustment > 0 ? `+${adjustment}` : String(adjustment);
}

function CounterPickRow({
  championsById,
  counterPick,
  editForm,
  editStatus,
  isEditing,
  isSelected,
  onCancelEdit,
  onDelete,
  onEditChange,
  onSave,
  onStartEdit,
  onToggleReviewed,
  onToggleSelected,
}: {
  championsById: Map<string, AdminLeagueChampion>;
  counterPick: LeagueCounterPick;
  editForm: CounterPickEditForm;
  editStatus: FormStatus;
  isEditing: boolean;
  isSelected: boolean;
  onCancelEdit: () => void;
  onDelete: (counterPickId: number) => void;
  onEditChange: (form: CounterPickEditForm) => void;
  onSave: (counterPick: LeagueCounterPick) => void;
  onStartEdit: (counterPick: LeagueCounterPick) => void;
  onToggleReviewed: (
    counterPick: LeagueCounterPick,
    generationStatus: LeagueCounterPick["generation_status"],
  ) => void;
  onToggleSelected: (counterPickId: number) => void;
}) {
  const counterChampion = championsById.get(counterPick.counter_champion_id);

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition",
        isSelected
          ? "border-violet-300/30 bg-violet-500/[0.08]"
          : "border-white/10 bg-white/[0.03]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            aria-label={isSelected ? "Deselect counter pick" : "Select counter pick"}
            className="mt-1 rounded-md border border-white/10 bg-white/5 p-1 text-zinc-300 transition hover:bg-white/10 hover:text-white"
            onClick={() => onToggleSelected(counterPick.id)}
            type="button"
          >
            {isSelected ? (
              <CheckSquare className="size-4" aria-hidden="true" />
            ) : (
              <Square className="size-4" aria-hidden="true" />
            )}
          </button>
          {counterChampion ? (
            <Image
              alt=""
              className="size-11 rounded-md bg-white/10 object-cover"
              height={44}
              src={getChampionIconPath(counterChampion)}
              width={44}
            />
          ) : (
            <div className="size-11 rounded-md bg-white/10" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {counterChampion?.name ?? counterPick.counter_champion_id}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <CounterPickTypeBadge counterType={counterPick.counter_type} />
              <CounterPickStatusBadge status={counterPick.generation_status} />
              {counterPick.win_rate !== null ? (
                <Badge className="border-cyan-300/20 bg-cyan-500/10 text-cyan-100">
                  {counterPick.win_rate.toFixed(1)}% WR
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
            onClick={() =>
              counterPick.generation_status === "reviewed"
                ? onToggleReviewed(counterPick, "draft")
                : onToggleReviewed(counterPick, "reviewed")
            }
            size="sm"
            type="button"
            variant="ghost"
          >
            {counterPick.generation_status === "reviewed" ? (
              <RotateCcw className="size-3.5" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
            )}
            {counterPick.generation_status === "reviewed" ? "Revert" : "Review"}
          </Button>
          <Button
            className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
            onClick={() => onStartEdit(counterPick)}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            Edit
          </Button>
          <Button
            className="border-rose-300/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
            onClick={() => onDelete(counterPick.id)}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-xs text-zinc-400 md:grid-cols-3">
        <p>Updated {formatDateTime(counterPick.updated_at)}</p>
        <p>Strength {counterPick.counter_strength ?? "Not set"}</p>
        <p>Sample {counterPick.games !== null ? counterPick.games.toLocaleString() : "Not set"}</p>
      </div>

      {counterPick.reason ? (
        <p className="mt-3 text-sm leading-6 text-zinc-300">{counterPick.reason}</p>
      ) : null}

      {isEditing ? (
        <div className="mt-4 rounded-lg border border-violet-300/15 bg-violet-500/[0.06] p-4">
          <div className="space-y-4">
            <CounterPickEditableFields
              disabled={editStatus.isLoading}
              form={editForm}
              onChange={onEditChange}
            />
            <StatusMessage status={editStatus} />
            <div className="flex flex-wrap gap-2">
              <Button
                className="h-9 bg-violet-500/80 px-4 text-white hover:bg-violet-500"
                disabled={editStatus.isLoading}
                onClick={() => onSave(counterPick)}
                type="button"
              >
                <Save className="size-4" aria-hidden="true" />
                {editStatus.isLoading ? "Saving..." : "Save changes"}
              </Button>
              <Button
                className="h-9 border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
                disabled={editStatus.isLoading}
                onClick={onCancelEdit}
                type="button"
                variant="ghost"
              >
                <X className="size-4" aria-hidden="true" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CounterPickManagementMetricsPanel({
  error,
  isLoading,
  metrics,
  onRefresh,
}: {
  error: string | null;
  isLoading: boolean;
  metrics: CounterPickManagementMetrics | null;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-mono text-lg font-semibold text-white">Riot data pipeline</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Stored Riot evidence and aggregate rows used by public Counter Pick stats.
            </p>
          </div>
          <Button
            className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
            disabled={isLoading}
            onClick={onRefresh}
            type="button"
            variant="ghost"
          >
            {isLoading ? (
              <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            Refresh metrics
          </Button>
        </div>
        {error ? (
          <p className="rounded-md border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-100">
            {error}
          </p>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CounterPickMetricCard
            description="Validated Riot match-role observations"
            isLoading={isLoading && !metrics}
            label="Matchup observations"
            metric={metrics?.pipeline.matchupObservations ?? null}
          />
          <CounterPickMetricCard
            description="Aggregated champion, role, patch and rank rows"
            isLoading={isLoading && !metrics}
            label="Counter Pick stat rows"
            metric={metrics?.pipeline.counterPickStatRows ?? null}
          />
          <CounterPickMetricCard
            description="Sorted champion pair + role + patch"
            isLoading={isLoading && !metrics}
            label="Unique matchup groups"
            metric={metrics?.pipeline.uniqueMatchupGroups ?? null}
          />
          <LatestSuccessfulScanCard isLoading={isLoading && !metrics} metrics={metrics} />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-mono text-lg font-semibold text-white">Public review workflow</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Mechanical review rows that decide which counters can appear publicly.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <CounterPickMetricCard
            description="Verified strong or soft counters marked public eligible"
            isLoading={isLoading && !metrics}
            label="Public counters"
            metric={metrics?.review.publicCounters ?? null}
          />
          <CounterPickMetricCard
            description="Mechanical suggestions that have been classified by review"
            isLoading={isLoading && !metrics}
            label="Reviewed counter rows"
            metric={metrics?.review.reviewedCounterRows ?? null}
          />
          <CounterPickMetricCard
            description="Mechanical suggestions still waiting for review"
            isLoading={isLoading && !metrics}
            label="Unreviewed suggestions"
            metric={metrics?.review.unreviewedSuggestions ?? null}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-mono text-lg font-semibold text-white">Editorial content</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Manually reviewed guide records from the editorial Counter Pick table.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <CounterPickMetricCard
            description="Rows in league_counter_picks"
            isLoading={isLoading && !metrics}
            label="Counter Pick guides"
            metric={metrics?.editorial.totalGuides ?? null}
          />
          <CounterPickMetricCard
            description="Guides marked reviewed"
            isLoading={isLoading && !metrics}
            label="Reviewed guides"
            metric={metrics?.editorial.reviewedGuides ?? null}
          />
          <CounterPickMetricCard
            description="Guides still in draft"
            isLoading={isLoading && !metrics}
            label="Draft guides"
            metric={metrics?.editorial.visibleDrafts ?? null}
          />
        </div>
      </section>
    </div>
  );
}

function CounterPickOverviewOperationsPanel({
  isLoading,
  metrics,
}: {
  isLoading: boolean;
  metrics: CounterPickManagementMetrics | null;
}) {
  const latestCollection = metrics?.operations.latestCollection.value;
  const latestCollectionError = metrics?.operations.latestCollection.error;

  return (
    <Card className="border-white/10 bg-[#10182b]/90 text-white shadow-xl shadow-black/15">
      <CardHeader>
        <CardTitle className="font-mono text-xl">Counter Pick Dashboard</CardTitle>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
          Snapshot of stored data, collection activity, and the latest patch/rank coverage signal.
        </p>
        <p className="mt-3 rounded-md border border-cyan-300/20 bg-cyan-500/10 p-3 text-sm leading-6 text-cyan-100">
          Workflow: Collect data &rarr; Review champion profiles &rarr; Inspect suggestions &rarr;
          Curate public counters.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CounterPickMetricCard
          description="Stored Riot seed candidates available to collection jobs"
          isLoading={isLoading && !metrics}
          label="Seed candidates"
          metric={metrics?.operations.seedCandidates ?? null}
        />
        <CounterPickMetricCard
          description="Reviewed mechanical counters eligible to appear publicly"
          isLoading={isLoading && !metrics}
          label="Public counters"
          metric={metrics?.review.publicCounters ?? null}
        />
        <CounterPickStaticOverviewCard
          description="Collection jobs currently queued, scanning, paused, or aggregating"
          isLoading={isLoading && !metrics}
          label="Active/recent scan status"
          value={
            metrics?.operations.activeCollectionJobs.error
              ? "Unavailable"
              : (metrics?.operations.activeCollectionJobs.value?.toLocaleString() ?? "Pending")
          }
        />
        <CounterPickStaticOverviewCard
          description={
            latestCollectionError ??
            (latestCollection
              ? `${formatCollectionCoverage(latestCollection)} updated ${formatDateTime(
                  latestCollection.updatedAt,
                )}`
              : "No persisted collection job is available yet.")
          }
          isLoading={isLoading && !metrics}
          label="Patch / rank coverage"
          value={
            latestCollectionError
              ? "Unavailable"
              : latestCollection
                ? (latestCollection.resolvedPatch ?? latestCollection.rankBracket ?? "Recorded")
                : "Pending"
          }
        />
      </CardContent>
    </Card>
  );
}

function CounterPickAdminLinks() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <CounterPickAdminLinkCard
        description="Collect Riot match data and rebuild counter statistics."
        href="/admin/counter-picks/collect"
        label="Data Collector"
      />
      <CounterPickAdminLinkCard
        description="Inspect mechanical counter suggestions before review."
        href="/admin/counter-picks/shadow-ranking"
        label="Counter Suggestions"
      />
      <CounterPickAdminLinkCard
        description="Curate which reviewed counters are eligible to appear publicly."
        href="/admin/counter-picks/review"
        label="Public Counter Review"
      />
      <CounterPickAdminLinkCard
        description="Review each champion-role mechanical profile used by the suggestion engine."
        href="/admin/counter-picks/profile-review"
        label="Champion Counter Profiles"
      />
    </div>
  );
}

function CounterPickAdminLinkCard({
  description,
  href,
  label,
}: {
  description: string;
  href: string;
  label: string;
}) {
  return (
    <Card className="border-cyan-300/15 bg-[#071321]/95 p-5 text-white shadow-xl shadow-black/15">
      <div className="flex h-full flex-col items-start gap-4">
        <div>
          <h2 className="font-mono text-lg font-semibold text-white">{label}</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
        </div>
        <Button asChild className="mt-auto" size="sm" variant="outline">
          <Link href={href} transitionTypes={["admin-section"]}>
            Open
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}

function CounterPickStaticOverviewCard({
  description,
  isLoading,
  label,
  value,
}: {
  description: string;
  isLoading: boolean;
  label: string;
  value: string;
}) {
  return (
    <Card className="border-white/10 bg-[#10182b]/90 p-5 text-white shadow-xl shadow-black/15">
      <p className="font-mono text-3xl font-semibold text-violet-100">
        {isLoading ? "Loading" : value}
      </p>
      <p className="mt-1 text-sm font-medium text-zinc-200">{label}</p>
      <p className="mt-2 text-xs leading-5 text-zinc-500">{description}</p>
    </Card>
  );
}

function CounterPickMetricCard({
  description,
  isLoading,
  label,
  metric,
}: {
  description: string;
  isLoading: boolean;
  label: string;
  metric: CounterPickManagementMetrics["pipeline"]["matchupObservations"] | null;
}) {
  const isUnavailable = Boolean(metric?.error);
  const value = isLoading
    ? "Loading"
    : isUnavailable
      ? "Unavailable"
      : metric
        ? (metric.value?.toLocaleString() ?? "Unavailable")
        : "Pending";

  return (
    <Card className="border-white/10 bg-[#10182b]/90 p-5 text-white shadow-xl shadow-black/15">
      <p
        className={cn(
          "font-mono text-3xl font-semibold",
          isUnavailable ? "text-amber-100" : "text-violet-100",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-sm font-medium text-zinc-200">{label}</p>
      <p className="mt-2 text-xs leading-5 text-zinc-500">
        {isUnavailable ? metric?.error : description}
      </p>
    </Card>
  );
}

function LatestSuccessfulScanCard({
  isLoading,
  metrics,
}: {
  isLoading: boolean;
  metrics: CounterPickManagementMetrics | null;
}) {
  const latestScan = metrics?.latestSuccessfulScan.value;
  const error = metrics?.latestSuccessfulScan.error;
  const title = isLoading
    ? "Loading"
    : error
      ? "Unavailable"
      : latestScan
        ? `${formatNullableNumber(latestScan.uniqueMatches)} unique matches`
        : "No successful scans yet";

  return (
    <Card className="border-white/10 bg-[#10182b]/90 p-5 text-white shadow-xl shadow-black/15">
      <p
        className={cn(
          "font-mono text-2xl font-semibold",
          error ? "text-amber-100" : "text-violet-100",
        )}
      >
        {title}
      </p>
      <p className="mt-1 text-sm font-medium text-zinc-200">Latest successful scan</p>
      {latestScan ? (
        <div className="mt-2 space-y-1 text-xs leading-5 text-zinc-500">
          <p>Completed {formatDateTime(latestScan.completedAt)}</p>
          <p>
            {formatNullableNumber(latestScan.observationsInserted)} new observations ·{" "}
            {formatNullableNumber(latestScan.statRowsUpdated)} stat rows updated
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          {error ?? "The persisted scan job table has no completed scan yet."}
        </p>
      )}
    </Card>
  );
}

function CounterPickTypeBadge({ counterType }: { counterType: LeagueCounterPickType }) {
  return (
    <Badge
      className={
        counterType === "best_counter"
          ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
          : "border-amber-300/20 bg-amber-500/10 text-amber-100"
      }
    >
      {counterType === "best_counter" ? "Best Counter" : "Countered By"}
    </Badge>
  );
}

function CounterPickStatusBadge({ status }: { status: LeagueCounterPick["generation_status"] }) {
  return (
    <Badge
      className={
        status === "reviewed"
          ? "border-cyan-300/20 bg-cyan-500/10 text-cyan-100"
          : "border-zinc-300/15 bg-white/5 text-zinc-300"
      }
    >
      {status === "reviewed" ? "Reviewed" : "Draft"}
    </Badge>
  );
}

function EmptyState({ text, tone = "default" }: { text: string; tone?: "default" | "warning" }) {
  return (
    <div
      className={cn(
        "rounded-lg border p-6 text-sm",
        tone === "warning"
          ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
          : "border-white/10 bg-white/[0.03] text-zinc-400",
      )}
    >
      {text}
    </div>
  );
}

function StatusMessage({ status }: { status: FormStatus }) {
  if (status.error) {
    return (
      <p className="rounded-md border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-100">
        {status.error}
      </p>
    );
  }

  if (status.success) {
    return (
      <p className="rounded-md border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">
        {status.success}
      </p>
    );
  }

  return null;
}

function sortCounterPicksForAdmin(counterPicks: LeagueCounterPick[]) {
  return [...counterPicks].sort((left, right) => {
    const typeOrder = left.counter_type.localeCompare(right.counter_type);

    if (typeOrder !== 0) {
      return typeOrder;
    }

    const leftWinRate = left.win_rate;
    const rightWinRate = right.win_rate;

    if (leftWinRate !== null && rightWinRate !== null && leftWinRate !== rightWinRate) {
      return left.counter_type === "best_counter"
        ? rightWinRate - leftWinRate
        : leftWinRate - rightWinRate;
    }

    if (leftWinRate !== null) {
      return -1;
    }

    if (rightWinRate !== null) {
      return 1;
    }

    return left.counter_champion_id.localeCompare(right.counter_champion_id);
  });
}

function nullableTrim(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue ? trimmedValue : null;
}

function getRoleLabel(role: LeagueRole) {
  return role === "adc" ? "ADC" : role.charAt(0).toUpperCase() + role.slice(1);
}

function normalizeCounterRankingV2ChampionId(championId: string) {
  return championId.trim().toLowerCase();
}

function getChampionIdFromOptionMap(
  championsByNormalizedId: Map<string, AdminLeagueChampion>,
  championId: string,
) {
  return championsByNormalizedId.get(normalizeCounterRankingV2ChampionId(championId))?.id ?? null;
}

function includeSelectedChampionOption(
  championOptions: AdminLeagueChampion[],
  selectedChampion: AdminLeagueChampion | null | undefined,
) {
  if (!selectedChampion || championOptions.some((champion) => champion.id === selectedChampion.id)) {
    return championOptions;
  }

  return [selectedChampion, ...championOptions];
}

function normalizeRoleForAdmin(role: string | null) {
  if (!role) {
    return null;
  }

  const normalizedRole = role.trim().toLowerCase();

  if (normalizedRole === "bottom" || normalizedRole === "bot") {
    return "adc";
  }

  return leagueRoles.includes(normalizedRole as LeagueRole)
    ? (normalizedRole as LeagueRole)
    : null;
}

type CounterRankingV2ProfileLabelContext = "strength" | "weakness";

const counterRankingV2ProfileRevisionHelpText =
  "Profile revision is the mechanical profile data version, not the Counter Ranking system version.";

const strengthProfileTraitLabels: Partial<Record<CounterRankingV2TraitId, string>> = {
  vulnerable_to_all_in: "Strong vs all-in",
  weak_early: "Strong early",
  weak_vs_poke: "Strong vs poke",
  weak_vs_range: "Strong vs range",
  weak_vs_roaming: "Strong vs roaming",
  weak_vs_sustain: "Strong vs sustain",
  weak_vs_waveclear: "Strong vs waveclear",
};

const weaknessProfileTraitLabels: Partial<Record<CounterRankingV2TraitId, string>> = {
  vulnerable_to_all_in: "Vulnerable to all-in",
  waveclear_weak: "Vulnerable to waveclear",
  weak_early: "Weak early",
  weak_vs_poke: "Vulnerable to poke",
  weak_vs_range: "Vulnerable to range",
  weak_vs_roaming: "Vulnerable to roaming",
  weak_vs_sustain: "Vulnerable to sustain",
  weak_vs_waveclear: "Vulnerable to waveclear",
};

function getTraitLabel(traitId: string) {
  const normalizedTraitId = normalizeCounterRankingV2TraitId(traitId);

  return (
    (normalizedTraitId
      ? counterRankingV2TraitDefinitionsById.get(normalizedTraitId)?.label
      : null) ?? traitId
  );
}

function getProfileTraitLabel(traitId: string, context: CounterRankingV2ProfileLabelContext) {
  const normalizedTraitId = normalizeCounterRankingV2TraitId(traitId);

  if (!normalizedTraitId) {
    return traitId;
  }

  const contextualLabel =
    context === "strength"
      ? strengthProfileTraitLabels[normalizedTraitId]
      : weaknessProfileTraitLabels[normalizedTraitId];

  return contextualLabel ?? getTraitLabel(normalizedTraitId);
}

function isTraitDefinitionVisibleForProfileContext(
  traitDefinition: CounterRankingV2TraitDefinition,
  context: CounterRankingV2ProfileLabelContext,
  profileRole: LeagueRole,
) {
  const isVisibleForRole = isCounterRankingV2TraitDefinitionVisibleForRole(
    traitDefinition,
    profileRole,
  );

  if (!isVisibleForRole) {
    return false;
  }

  return context === "weakness"
    ? traitDefinition.category === "vulnerability"
    : traitDefinition.category !== "vulnerability";
}

function isTraitIdVisibleForProfileContext(
  traitId: string,
  context: CounterRankingV2ProfileLabelContext,
  profileRole: LeagueRole,
) {
  const normalizedTraitId = normalizeCounterRankingV2TraitId(traitId);
  const traitDefinition = normalizedTraitId
    ? counterRankingV2TraitDefinitionsById.get(normalizedTraitId)
    : null;

  return traitDefinition
    ? isTraitDefinitionVisibleForProfileContext(traitDefinition, context, profileRole)
    : false;
}

function splitProfileTextLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function toCounterRankingV2DraftProfileKnowledge({
  champion,
  isCommonRole,
  profile,
}: {
  champion: AdminLeagueChampion | null;
  isCommonRole: boolean;
  profile: CounterRankingV2ChampionProfile;
}) {
  const combatProfile = getChampionCombatProfile(champion?.id ?? profile.championId);
  const laneIdentity =
    typeof combatProfile?.laneIdentity === "string"
      ? combatProfile.laneIdentity
      : [
          combatProfile?.laneIdentity?.lanePressure,
          combatProfile?.laneIdentity?.earlyGameAgency,
          combatProfile?.laneIdentity?.scalingPriority,
          ...(combatProfile?.laneIdentity?.preferredGameState ?? []),
          ...(combatProfile?.laneIdentity?.winLaneBy ?? []),
        ].filter(Boolean).join(" ");

  return {
    abilities: combatProfile?.abilities ?? null,
    archetype: combatProfile?.archetype ?? null,
    commonWeaknesses: combatProfile?.commonWeaknesses ?? null,
    damageType: combatProfile?.damageType ?? null,
    dangerAbilities: combatProfile?.dangerAbilities ?? null,
    hardCrowdControl: combatProfile?.hardCrowdControl ?? null,
    identityText: [
      profile.identitySummary,
      profile.notes,
      combatProfile?.primaryTradingPattern,
      combatProfile?.primaryWinCondition?.join(" "),
      laneIdentity,
    ].filter(Boolean).join(" "),
    isCommonRole,
    jungleProfile: combatProfile?.jungleProfile ?? null,
    mobilityLevel: combatProfile?.mobilityLevel ?? null,
    name: champion?.name ?? combatProfile?.name ?? profile.championId,
    primaryTradingPattern: combatProfile?.primaryTradingPattern ?? null,
    primaryWinCondition: combatProfile?.primaryWinCondition ?? null,
    shields: combatProfile?.shields ?? null,
    strategicIdentity: combatProfile?.strategicIdentity ?? null,
    sustain: combatProfile?.sustain ?? null,
  };
}

function formatDraftProfileImprovementReviewNote(
  suggestion: CounterRankingV2DraftProfileSuggestion,
) {
  return [
    `Auto-improved draft confidence: ${formatDraftProfileConfidence(suggestion.confidence)}.`,
    suggestion.summary,
    ...suggestion.explanation.map((line) => `- ${line}`),
    ...suggestion.uncertaintyNotes.map((line) => `- Uncertainty: ${line}`),
  ].join("\n");
}

function formatDraftProfileConfidence(confidence: CounterRankingV2DraftProfileSuggestion["confidence"]) {
  switch (confidence) {
    case "high_draft_confidence":
      return "High draft confidence";
    case "medium_draft_confidence":
      return "Medium draft confidence";
    case "low_draft_confidence":
      return "Low draft confidence";
  }
}

function formatDraftProfileChangedTraitIds(traitIds: CounterRankingV2TraitId[]) {
  if (traitIds.length === 0) {
    return "None";
  }

  return traitIds.map((traitId) => getTraitLabel(traitId)).join(", ");
}

function isCounterRankingV2ProfileEligibleForReviewedApproval(
  profile: CounterRankingV2ChampionProfile,
) {
  return profile.reviewStatus === "draft" || profile.reviewStatus === "needs_revision";
}

function isImprovedCounterRankingV2DraftReview(review: CounterRankingV2ProfileReview | null) {
  return Boolean(review?.reviewNote?.includes("Auto-improved draft confidence:"));
}

function formatCounterRankingV2ProfileAvailability(
  championId: string,
  profileStatusesByChampionId?: CounterRankingV2ProfileStatusByChampionId,
  profileOverridesByChampionId?: CounterRankingV2ProfileByChampionId,
  role: LeagueRole = "mid",
) {
  const profile = getCounterRankingV2ChampionProfile(
    championId,
    profileStatusesByChampionId,
    profileOverridesByChampionId,
    role,
  );

  if (!profile) {
    return "No mechanical profile";
  }

  return `${formatMechanicalProfileStatusLabel(profile)} (${formatMechanicalProfileRevisionLabel(
    profile,
  )})`;
}

function formatMechanicalProfileStatusLabel(profile: Pick<CounterRankingV2ChampionProfile, "reviewStatus">) {
  return `Mechanical profile · ${formatProfileStatus(profile.reviewStatus)}`;
}

function formatMechanicalProfileRevisionLabel(profile: Pick<CounterRankingV2ChampionProfile, "version">) {
  return `Profile revision ${profile.version}`;
}

function formatProfileStatus(status: CounterRankingV2ProfileStatus) {
  switch (status) {
    case "reviewed":
      return "Reviewed";
    case "needs_revision":
      return "Needs revision";
    case "draft":
      return "Draft";
  }
}

function getProfileStatusBadgeClassName(status: CounterRankingV2ProfileStatus) {
  switch (status) {
    case "reviewed":
      return "border-emerald-300/20 bg-emerald-500/10 text-emerald-100";
    case "needs_revision":
      return "border-amber-300/20 bg-amber-500/10 text-amber-100";
    case "draft":
      return "border-white/10 bg-white/5 text-zinc-300";
  }
}

function getPreferredCounterRankingV2ProfileRow(
  currentRow: CounterRankingV2ProfileReviewPanelRow,
  nextRow: CounterRankingV2ProfileReviewPanelRow,
) {
  const currentScore = getCounterRankingV2ProfileRowPreferenceScore(currentRow);
  const nextScore = getCounterRankingV2ProfileRowPreferenceScore(nextRow);

  if (nextScore !== currentScore) {
    return nextScore > currentScore ? nextRow : currentRow;
  }

  const currentUpdatedAt = getProfileRowUpdatedAtTimestamp(currentRow);
  const nextUpdatedAt = getProfileRowUpdatedAtTimestamp(nextRow);

  return nextUpdatedAt > currentUpdatedAt ? nextRow : currentRow;
}

function getCounterRankingV2ProfileRowPreferenceScore(row: CounterRankingV2ProfileReviewPanelRow) {
  const statusScore =
    row.profile.reviewStatus === "reviewed"
      ? 300
      : row.profile.reviewStatus === "needs_revision"
        ? 200
        : 100;
  const editableContentScore =
    row.profile.strengths.length +
    row.profile.vulnerabilities.length +
    (row.profile.identitySummary ? 1 : 0) +
    (row.profile.notes ? 1 : 0);
  const championRegistryScore = row.champion ? 10 : 0;

  return statusScore + championRegistryScore + Math.min(9, editableContentScore);
}

function getProfileRowUpdatedAtTimestamp(row: CounterRankingV2ProfileReviewPanelRow) {
  const updatedAt = row.review?.updatedAt ?? null;
  const timestamp = updatedAt ? new Date(updatedAt).getTime() : 0;

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getCounterRankingV2ReviewRowKey({
  candidateChampionId,
  role,
  targetChampionId,
}: {
  candidateChampionId: string;
  role: LeagueRole;
  targetChampionId: string;
}) {
  return `${normalizeCounterRankingV2ChampionId(targetChampionId)}::${normalizeCounterRankingV2ChampionId(candidateChampionId)}::${role}`;
}

function getCounterRankingV2AdminReviewSummary(
  rows: CounterRankingV2AdminReviewRow[],
  unsupportedRoleExcluded: number,
) {
  return rows.reduce(
    (summary, row) => {
      const reviewStatus = row.review?.reviewStatus ?? "unreviewed";
      const automationStatus = row.automationSuggestion?.automationStatus ?? null;
      const observedGames = row.observed?.games ?? 0;

      return {
        autoApprovalCandidates:
          summary.autoApprovalCandidates +
          (automationStatus === "auto_approval_candidate" ? 1 : 0),
        autoSuggested: summary.autoSuggested + (automationStatus === "auto_suggested" ? 1 : 0),
        highMasteryRequired:
          summary.highMasteryRequired + (row.review?.highMasteryRequired ? 1 : 0),
        lowSample:
          summary.lowSample +
          (observedGames > 0 && observedGames < publicCounterPickMinimumRankedGames ? 1 : 0),
        needsMoreData: summary.needsMoreData + (reviewStatus === "needs_more_data" ? 1 : 0),
        notCounters: summary.notCounters + (reviewStatus === "not_a_counter" ? 1 : 0),
        publicEligible:
          summary.publicEligible + (isCounterRankingV2ReviewPublicEligible(row.review) ? 1 : 0),
        total: summary.total + 1,
        unreviewed:
          summary.unreviewed + (row.review === null || reviewStatus === "unreviewed" ? 1 : 0),
        unsupportedRoleExcluded: summary.unsupportedRoleExcluded,
        verifiedSoft: summary.verifiedSoft + (reviewStatus === "verified_soft_counter" ? 1 : 0),
        verifiedStrong:
          summary.verifiedStrong + (reviewStatus === "verified_strong_counter" ? 1 : 0),
      };
    },
    {
      autoApprovalCandidates: 0,
      autoSuggested: 0,
      highMasteryRequired: 0,
      lowSample: 0,
      needsMoreData: 0,
      notCounters: 0,
      publicEligible: 0,
      total: 0,
      unreviewed: 0,
      unsupportedRoleExcluded,
      verifiedSoft: 0,
      verifiedStrong: 0,
    },
  );
}

function getCounterRankingV2AdminReviewSectionCount(
  rows: CounterRankingV2AdminReviewRow[],
  section: CounterRankingV2AdminReviewQueueSection,
) {
  return rows.filter((row) => isCounterRankingV2AdminReviewRowInSection(row, section)).length;
}

function getCounterRankingV2AdminReviewTabCount(
  rows: CounterRankingV2AdminReviewRow[],
  tab: CounterRankingV2AdminReviewTab,
) {
  return rows.filter((row) => isCounterRankingV2AdminReviewRowInTab(row, tab)).length;
}

function createCounterRankingV2PublicCapTracker(rows: CounterRankingV2AdminReviewRow[]) {
  const tracker = new Map<string, CounterRankingV2PublicCounterCapCounts>();

  for (const row of rows) {
    const key = getCounterRankingV2PublicCapKey(row);
    const currentCounts =
      tracker.get(key) ?? createEmptyCounterRankingV2PublicCounterCapCounts();
    const rowCounts = getCounterRankingV2PublicCounterCapCounts([row.review]);

    tracker.set(key, {
      soft: currentCounts.soft + rowCounts.soft,
      strong: currentCounts.strong + rowCounts.strong,
      total: currentCounts.total + rowCounts.total,
    });
  }

  return tracker;
}

function applyCounterRankingV2PublicCapForBatchRow({
  nextPublicEligible,
  publicCapTracker,
  reviewStatus,
  row,
}: {
  nextPublicEligible: boolean;
  publicCapTracker: Map<string, CounterRankingV2PublicCounterCapCounts>;
  reviewStatus: CounterRankingV2ReviewStatus;
  row: CounterRankingV2AdminReviewRow;
}) {
  const key = getCounterRankingV2PublicCapKey(row);
  const counts = {
    ...(publicCapTracker.get(key) ?? createEmptyCounterRankingV2PublicCounterCapCounts()),
  };

  if (row.review && isCounterRankingV2ReviewPublicEligible(row.review)) {
    decrementCounterRankingV2PublicCapCount(counts, row.review.reviewStatus);
  }

  if (!nextPublicEligible) {
    publicCapTracker.set(key, counts);
    return {
      capLimited: false,
      publicEligible: false,
    };
  }

  if (!canAddCounterRankingV2PublicCounter({ counts, reviewStatus })) {
    publicCapTracker.set(key, counts);
    return {
      capLimited: true,
      publicEligible: false,
    };
  }

  incrementCounterRankingV2PublicCapCount(counts, reviewStatus);
  publicCapTracker.set(key, counts);

  return {
    capLimited: false,
    publicEligible: true,
  };
}

function getCounterRankingV2AdminBatchApprovalStatus(
  row: CounterRankingV2AdminReviewRow,
): CounterRankingV2AdminBatchReviewStatus {
  const mechanicalScore =
    row.review?.finalMechanicalScore ??
    (row.mechanicalResult.status === "calculated" ? row.mechanicalResult.score : 0);

  return mechanicalScore >= 80 ? "verified_strong_counter" : "verified_soft_counter";
}

function getCounterRankingV2RowSuggestionExplanation(row: CounterRankingV2ComparisonRow) {
  const mechanicalReasons = getCounterRankingV2MechanicalReasons(row.mechanicalResult.factors, 3);

  if (mechanicalReasons.length === 0 || row.mechanicalResult.score < 45) {
    return "No clear counter pattern is strong enough yet; treat this as needs expert review.";
  }

  return `Suggested because ${mechanicalReasons
    .map((reason) => reason.title.toLowerCase())
    .join(", ")}.`;
}

function getCounterRankingV2RowWarnings(row: CounterRankingV2ComparisonRow) {
  const warnings: string[] = [];
  const observedGames = row.observed?.games ?? 0;
  const automationBlockers = row.automationSuggestion?.blockers ?? [];

  if (observedGames > 0 && observedGames < publicCounterPickMinimumRankedGames) {
    warnings.push("low sample");
  }

  if (observedGames === 0) {
    warnings.push("no observed data");
  }

  if (row.review?.highMasteryRequired) {
    warnings.push("high mastery required");
  }

  if (row.mechanicalResult.score < 65) {
    warnings.push("mechanical score is low");
  }

  if (automationBlockers.length > 0) {
    warnings.push("automation blocker present");
  }

  if (isCounterRankingV2ManualOverridePublicRow(row)) {
    warnings.push("manual override public recommendation");
  }

  return warnings;
}

function isCounterRankingV2ManualOverridePublicRow(row: CounterRankingV2ComparisonRow) {
  return (
    isCounterRankingV2ReviewPublicEligible(row.review) &&
    (row.mechanicalResult.score < 65 ||
      (row.automationSuggestion?.blockers.length ?? 0) > 0 ||
      !hasCounterRankingV2VisibleDirectCounterSignal(row))
  );
}

function hasCounterRankingV2VisibleDirectCounterSignal(row: CounterRankingV2ComparisonRow) {
  return getCounterRankingV2MechanicalReasons(row.mechanicalResult.factors, 3).some(
    (reason) => reason.impactLevel === "medium" || reason.impactLevel === "high",
  );
}

function isCounterRankingV2SafeAutoPublicApprovalRow(row: CounterRankingV2ComparisonRow) {
  const observedGames = row.observed?.games ?? 0;

  return (
    row.automationSuggestion?.automationStatus === "auto_approval_candidate" &&
    row.automationSuggestion.blockers.length === 0 &&
    !(observedGames > 0 && observedGames < publicCounterPickMinimumRankedGames)
  );
}

function getCounterRankingV2PublicCapKey(row: CounterRankingV2AdminReviewRow) {
  return [
    normalizeCounterRankingV2ChampionId(row.targetChampionId),
    row.mechanicalResult.role ?? row.review?.role ?? "mid",
  ].join("::");
}

function incrementCounterRankingV2PublicCapCount(
  counts: CounterRankingV2PublicCounterCapCounts,
  reviewStatus: CounterRankingV2ReviewStatus,
) {
  counts.total += 1;

  if (reviewStatus === "verified_strong_counter") {
    counts.strong += 1;
  }

  if (reviewStatus === "verified_soft_counter") {
    counts.soft += 1;
  }
}

function decrementCounterRankingV2PublicCapCount(
  counts: CounterRankingV2PublicCounterCapCounts,
  reviewStatus: CounterRankingV2ReviewStatus,
) {
  counts.total = Math.max(0, counts.total - 1);

  if (reviewStatus === "verified_strong_counter") {
    counts.strong = Math.max(0, counts.strong - 1);
  }

  if (reviewStatus === "verified_soft_counter") {
    counts.soft = Math.max(0, counts.soft - 1);
  }
}

function getCounterRankingV2TopCandidateRowsPerTarget({
  rows,
  topCandidateCap,
}: {
  rows: CounterRankingV2AdminReviewRow[];
  topCandidateCap: number;
}) {
  const rowsByTarget = new Map<string, CounterRankingV2AdminReviewRow[]>();

  for (const row of rows) {
    if (!isCounterRankingV2AdminTopCandidate(row)) {
      continue;
    }

    const targetKey = normalizeCounterRankingV2ChampionId(row.targetChampionId);
    const targetRows = rowsByTarget.get(targetKey) ?? [];

    targetRows.push(row);
    rowsByTarget.set(targetKey, targetRows);
  }

  return Array.from(rowsByTarget.values()).flatMap((targetRows) =>
    sortCounterRankingV2AdminReviewRows(targetRows, "review_priority", new Map()).slice(
      0,
      topCandidateCap,
    ),
  );
}

function isCounterRankingV2AdminTopCandidate(row: CounterRankingV2AdminReviewRow) {
  const reviewStatus = row.review?.reviewStatus ?? "unreviewed";

  return (
    (row.review === null || reviewStatus === "unreviewed") &&
    row.mechanicalResult.status === "calculated" &&
    row.targetProfile?.reviewStatus === "reviewed" &&
    row.candidateProfile?.reviewStatus === "reviewed" &&
    !row.unsupportedRole
  );
}

function isCounterRankingV2AdminReviewRowVisible({
  automationFilter,
  candidateQuery,
  dataFilter,
  publicFilter,
  queueSection,
  reviewFilter,
  reviewTab,
  row,
  strengthFilter,
}: {
  automationFilter: CounterRankingV2AutomationStatus | "all";
  candidateQuery: string;
  dataFilter: "all" | "has_observed" | "low_sample" | "no_observed";
  publicFilter: "all" | "not_public" | "public_eligible";
  queueSection: CounterRankingV2AdminReviewQueueSection;
  reviewFilter: CounterRankingV2ReviewFilter | "reviewed_only";
  reviewTab: CounterRankingV2AdminReviewTab;
  row: CounterRankingV2AdminReviewRow;
  strengthFilter: "all" | "soft_counter" | "strong_counter";
}) {
  const query = candidateQuery.trim().toLowerCase();
  const observedGames = row.observed?.games ?? 0;
  const reviewStatus = row.review?.reviewStatus ?? "unreviewed";
  const isPublicEligible = isCounterRankingV2ReviewPublicEligible(row.review);

  if (reviewTab === "public_counters") {
    return !query || row.candidateChampionId.toLowerCase().includes(query);
  }

  if (!isCounterRankingV2AdminReviewRowInSection(row, queueSection)) {
    return false;
  }

  if (
    query &&
    !row.candidateChampionId.toLowerCase().includes(query) &&
    !row.targetChampionId.toLowerCase().includes(query)
  ) {
    return false;
  }

  if (reviewFilter === "reviewed_only" && (row.review === null || reviewStatus === "unreviewed")) {
    return false;
  }

  if (
    reviewFilter !== "all" &&
    reviewFilter !== "reviewed_only" &&
    !isCounterRankingV2RowMatchingReviewFilter({
      filter: reviewFilter,
      minimumGames: publicCounterPickMinimumRankedGames,
      row,
    })
  ) {
    return false;
  }

  if (automationFilter !== "all" && row.automationSuggestion?.automationStatus !== automationFilter) {
    return false;
  }

  if (publicFilter === "public_eligible" && !isPublicEligible) {
    return false;
  }

  if (publicFilter === "not_public" && isPublicEligible) {
    return false;
  }

  if (dataFilter === "has_observed" && observedGames <= 0) {
    return false;
  }

  if (dataFilter === "no_observed" && observedGames > 0) {
    return false;
  }

  if (
    dataFilter === "low_sample" &&
    !(observedGames > 0 && observedGames < publicCounterPickMinimumRankedGames)
  ) {
    return false;
  }

  if (strengthFilter === "strong_counter") {
    return (
      row.automationSuggestion?.suggestedStrength === "strong_counter" ||
      row.automationSuggestion?.suggestedStrength === "hard_counter"
    );
  }

  if (strengthFilter === "soft_counter") {
    return row.automationSuggestion?.suggestedStrength === "soft_counter";
  }

  return true;
}

function isCounterRankingV2AdminReviewRowInTab(
  row: CounterRankingV2AdminReviewRow,
  tab: CounterRankingV2AdminReviewTab,
) {
  const reviewStatus = row.review?.reviewStatus ?? "unreviewed";

  switch (tab) {
    case "public_counters":
      return isCounterRankingV2ReviewPublicEligible(row.review);
    case "review_suggestions":
      return (
        row.review === null ||
        reviewStatus === "unreviewed" ||
        row.automationSuggestion?.automationStatus === "auto_approval_candidate" ||
        row.automationSuggestion?.automationStatus === "auto_suggested" ||
        row.automationSuggestion?.automationStatus === "needs_review"
      );
    case "rejected_not_counters":
      return reviewStatus === "incorrect_suggestion" || reviewStatus === "not_a_counter";
    case "needs_more_data":
      return reviewStatus === "needs_more_data";
    case "all_rows":
      return true;
  }
}

function getCounterRankingV2AdminReviewEmptyStateText(tab: CounterRankingV2AdminReviewTab) {
  switch (tab) {
    case "public_counters":
      return "No public counters match the current filters. Try the All rows tab or clear candidate/status filters.";
    case "review_suggestions":
      return "No review suggestions match the current filters. Try All rows or loosen advanced filters.";
    case "rejected_not_counters":
      return "No rejected or not-a-counter rows match the current filters.";
    case "needs_more_data":
      return "No needs-more-data rows match the current filters.";
    case "all_rows":
      return "No rows match the current filters. Clear candidate search or advanced filters.";
  }
}

function isCounterRankingV2AdminReviewRowInSection(
  row: CounterRankingV2AdminReviewRow,
  section: CounterRankingV2AdminReviewQueueSection,
) {
  const reviewStatus = row.review?.reviewStatus ?? "unreviewed";
  const observedGames = row.observed?.games ?? 0;

  switch (section) {
    case "all":
      return true;
    case "auto_approval_candidate":
      return row.automationSuggestion?.automationStatus === "auto_approval_candidate";
    case "auto_suggested":
      return row.automationSuggestion?.automationStatus === "auto_suggested";
    case "needs_review":
      return row.automationSuggestion?.automationStatus === "needs_review";
    case "low_sample":
      return observedGames > 0 && observedGames < publicCounterPickMinimumRankedGames;
    case "public_eligible":
      return isCounterRankingV2ReviewPublicEligible(row.review);
    case "rejected":
      return reviewStatus === "incorrect_suggestion" || reviewStatus === "not_a_counter";
    case "needs_more_data":
      return reviewStatus === "needs_more_data";
  }
}

function sortCounterRankingV2AdminReviewRows(
  rows: CounterRankingV2AdminReviewRow[],
  sortMode: CounterRankingV2AdminReviewSort,
  championsById: Map<string, AdminLeagueChampion>,
) {
  if (sortMode === "review_priority") {
    return [...rows].sort(compareCounterRankingV2AdminReviewPriorityRows);
  }

  return [...rows].sort((left, right) => {
    switch (sortMode) {
      case "highest_mechanical_score":
        return right.mechanicalResult.score - left.mechanicalResult.score;
      case "lowest_observed_rank_mismatch":
        return Math.abs(left.rankDelta ?? 999) - Math.abs(right.rankDelta ?? 999);
      case "most_games":
        return (right.observed?.games ?? 0) - (left.observed?.games ?? 0);
      case "lowest_sample_first":
        return (left.observed?.games ?? 0) - (right.observed?.games ?? 0);
      case "newest_review_update":
        return getCounterRankingV2ReviewUpdatedTimestamp(right) - getCounterRankingV2ReviewUpdatedTimestamp(left);
      case "champion_name":
      case "candidate_champion":
        return getAdminReviewChampionName(left.candidateChampionId, championsById).localeCompare(
          getAdminReviewChampionName(right.candidateChampionId, championsById),
        );
      case "target_champion":
        return getAdminReviewChampionName(left.targetChampionId, championsById).localeCompare(
          getAdminReviewChampionName(right.targetChampionId, championsById),
        );
    }
  });
}

function compareCounterRankingV2AdminReviewPriorityRows(
  left: CounterRankingV2AdminReviewRow,
  right: CounterRankingV2AdminReviewRow,
) {
  const leftScore = getCounterRankingV2AdminReviewPriorityScore(left);
  const rightScore = getCounterRankingV2AdminReviewPriorityScore(right);

  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }

  return sortCounterRankingV2RowsByReviewPriority([left, right])[0] === left ? -1 : 1;
}

function getCounterRankingV2AdminReviewPriorityScore(row: CounterRankingV2AdminReviewRow) {
  const reviewStatus = row.review?.reviewStatus ?? "unreviewed";
  const mechanicalScore =
    row.review?.finalMechanicalScore ??
    (row.mechanicalResult.status === "calculated" ? row.mechanicalResult.score : 0);
  const observedGames = row.observed?.games ?? 0;
  let priorityScore = mechanicalScore;

  if (reviewStatus === "unreviewed" || row.review === null) {
    priorityScore += 160;
  } else if (reviewStatus === "verified_strong_counter" || reviewStatus === "verified_soft_counter") {
    priorityScore += 20;
  } else if (reviewStatus === "not_a_counter" || reviewStatus === "incorrect_suggestion") {
    priorityScore -= 250;
  } else {
    priorityScore -= 80;
  }

  if (row.targetProfile?.reviewStatus === "reviewed") {
    priorityScore += 40;
  } else if (!row.targetProfile) {
    priorityScore -= 200;
  }

  if (row.candidateProfile?.reviewStatus === "reviewed") {
    priorityScore += 40;
  } else if (!row.candidateProfile) {
    priorityScore -= 200;
  }

  if (!row.unsupportedRole) {
    priorityScore += 50;
  } else {
    priorityScore -= 500;
  }

  if (observedGames > 0) {
    priorityScore += 25 + Math.min(50, Math.log10(observedGames + 1) * 20);
  }

  if (row.rankDelta !== null && row.rankDelta > 0) {
    priorityScore += Math.min(35, row.rankDelta);
  }

  return priorityScore;
}

function getCounterRankingV2TargetReviewSummaries({
  championsById,
  role,
  rows,
}: {
  championsById: Map<string, AdminLeagueChampion>;
  role: LeagueRole;
  rows: CounterRankingV2AdminReviewRow[];
}): CounterRankingV2TargetReviewSummary[] {
  const summariesByTarget = new Map<string, CounterRankingV2TargetReviewSummary>();

  for (const row of rows) {
    const targetKey = normalizeCounterRankingV2ChampionId(row.targetChampionId);
    const champion = championsById.get(targetKey);
    const currentSummary =
      summariesByTarget.get(targetKey) ??
      {
        label: `${champion?.name ?? row.targetChampionId} ${getRoleLabel(role)}`,
        needsMoreData: 0,
        notCounters: 0,
        publicEligible: 0,
        publicSoft: 0,
        publicStrong: 0,
        remainingUnreviewed: 0,
        targetChampionId: row.targetChampionId,
        verifiedSoft: 0,
        verifiedStrong: 0,
      };
    const reviewStatus = row.review?.reviewStatus ?? "unreviewed";
    const isPublicEligible = isCounterRankingV2ReviewPublicEligible(row.review);

    summariesByTarget.set(targetKey, {
      ...currentSummary,
      needsMoreData:
        currentSummary.needsMoreData + (reviewStatus === "needs_more_data" ? 1 : 0),
      notCounters: currentSummary.notCounters + (reviewStatus === "not_a_counter" ? 1 : 0),
      publicEligible: currentSummary.publicEligible + (isPublicEligible ? 1 : 0),
      publicSoft:
        currentSummary.publicSoft +
        (isPublicEligible && reviewStatus === "verified_soft_counter" ? 1 : 0),
      publicStrong:
        currentSummary.publicStrong +
        (isPublicEligible && reviewStatus === "verified_strong_counter" ? 1 : 0),
      remainingUnreviewed:
        currentSummary.remainingUnreviewed +
        (row.review === null || reviewStatus === "unreviewed" ? 1 : 0),
      verifiedSoft:
        currentSummary.verifiedSoft + (reviewStatus === "verified_soft_counter" ? 1 : 0),
      verifiedStrong:
        currentSummary.verifiedStrong + (reviewStatus === "verified_strong_counter" ? 1 : 0),
    });
  }

  return Array.from(summariesByTarget.values()).sort((left, right) => {
    if (left.publicEligible !== right.publicEligible) {
      return right.publicEligible - left.publicEligible;
    }

    if (left.remainingUnreviewed !== right.remainingUnreviewed) {
      return right.remainingUnreviewed - left.remainingUnreviewed;
    }

    return left.label.localeCompare(right.label);
  });
}

function getCounterRankingV2ReviewUpdatedTimestamp(row: CounterRankingV2AdminReviewRow) {
  const timestamp = row.review?.updatedAt ? new Date(row.review.updatedAt).getTime() : 0;

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getAdminReviewChampionName(
  championId: string,
  championsById: Map<string, AdminLeagueChampion>,
) {
  return championsById.get(normalizeCounterRankingV2ChampionId(championId))?.name ?? championId;
}

function getCounterRankingV2ProfileCoverageSummary(
  profiles: CounterRankingV2ChampionProfile[],
  activeChampionCount: number,
) {
  const reviewedByRole = Object.fromEntries(
    leagueRoles.map((role) => [role, { reviewed: 0, total: 0 }]),
  ) as Record<LeagueRole, { reviewed: number; total: number }>;

  return profiles.reduce(
    (summary, profile) => {
      reviewedByRole[profile.role].total += 1;

      if (profile.reviewStatus === "reviewed") {
        reviewedByRole[profile.role].reviewed += 1;
      }

      return {
        activeChampions: summary.activeChampions,
        draft: summary.draft + (profile.reviewStatus === "draft" ? 1 : 0),
        missing: summary.missing,
        needsRevision:
          summary.needsRevision + (profile.reviewStatus === "needs_revision" ? 1 : 0),
        reviewed: summary.reviewed + (profile.reviewStatus === "reviewed" ? 1 : 0),
        reviewedByRole,
        total: summary.total + 1,
      };
    },
    {
      activeChampions: activeChampionCount,
      draft: 0,
      missing: Math.max(0, activeChampionCount - profiles.length),
      needsRevision: 0,
      reviewed: 0,
      reviewedByRole,
      total: 0,
    },
  );
}

function formatMasteryRequirement(requirement: string | null) {
  if (!requirement) {
    return "Unknown";
  }

  return requirement
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatCounterRankingV2Timestamp(value: string | null | undefined) {
  if (!value) {
    return "Not saved";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatCounterRankingV2Status(status: CounterRankingV2FitStatus) {
  switch (status) {
    case "calculated":
      return "Mechanical fit calculated";
    case "incomplete_profile":
      return "Incomplete profile";
    case "missing_candidate_profile":
      return "Missing candidate profile";
    case "missing_enemy_profile":
      return "Missing target profile";
  }
}

function formatCounterRankingV2ImpactLevel(impactLevel: CounterRankingV2FactorImpactLevel) {
  switch (impactLevel) {
    case "high":
      return "High impact";
    case "medium":
      return "Medium impact";
    case "low":
      return "Low impact";
  }
}

function getCounterRankingV2ImpactBadgeClassName(
  impactLevel: CounterRankingV2FactorImpactLevel,
) {
  switch (impactLevel) {
    case "high":
      return "border-emerald-300/20 bg-emerald-500/10 text-emerald-100";
    case "medium":
      return "border-sky-300/20 bg-sky-500/10 text-sky-100";
    case "low":
      return "border-white/10 bg-white/5 text-zinc-300";
  }
}

function formatCounterRankingV2AutomationStatus(status: CounterRankingV2AutomationStatus) {
  switch (status) {
    case "auto_approval_candidate":
      return "Auto approval candidate";
    case "auto_approved":
      return "Auto approved";
    case "auto_suggested":
      return "Auto suggested";
    case "manual_approved":
      return "Manual approved";
    case "manual_rejected":
      return "Manual rejected";
    case "needs_review":
      return "Needs review";
  }
}

function formatCounterRankingV2SuggestedStrength(strength: CounterRankingV2SuggestedStrength) {
  switch (strength) {
    case "hard_counter":
      return "Hard counter";
    case "strong_counter":
      return "Strong counter";
    case "soft_counter":
      return "Soft counter";
    case "neutral":
      return "Neutral";
    case "poor_fit":
      return "Poor fit";
  }
}

function formatCounterRankingV2AutomationConfidence(
  confidence: CounterRankingV2AutomationConfidence,
) {
  switch (confidence) {
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
  }
}

function formatCounterRankingV2ReviewStatus(status: CounterRankingV2ReviewStatus) {
  switch (status) {
    case "unreviewed":
      return "Unreviewed";
    case "verified_strong_counter":
      return "Verified strong counter";
    case "verified_soft_counter":
      return "Verified soft counter";
    case "not_a_counter":
      return "Not a counter";
    case "incorrect_suggestion":
      return "Incorrect suggestion";
    case "needs_more_data":
      return "Needs more data";
  }
}

function formatCounterRankingV2AdjustmentReason(reason: CounterRankingV2AdjustmentReason) {
  switch (reason) {
    case "auto_generated":
      return "Auto generated";
    case "patch_buff":
      return "Patch buff";
    case "patch_nerf":
      return "Patch nerf";
    case "meta_shift":
      return "Meta shift";
    case "practical_difficulty":
      return "Practical difficulty";
    case "data_disagreement":
      return "Data disagreement";
    case "manual_review":
      return "Manual review";
    case "other":
      return "Other";
  }
}

function formatCollectionCoverage(
  collection: NonNullable<CounterPickManagementMetrics["operations"]["latestCollection"]["value"]>,
) {
  const parts = [
    collection.platform,
    collection.role ? getRoleLabel(collection.role as LeagueRole) : null,
    collection.rankBracket,
    collection.status,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" / ") : `Collection #${collection.id}`;
}

function formatRankDelta(rankDelta: number | null) {
  if (rankDelta === null) {
    return "No observed rank";
  }

  if (rankDelta === 0) {
    return "Ranks aligned";
  }

  return rankDelta > 0
    ? `Mechanical ${rankDelta} higher`
    : `Observed ${Math.abs(rankDelta)} higher`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatNullableNumber(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString() : "—";
}
