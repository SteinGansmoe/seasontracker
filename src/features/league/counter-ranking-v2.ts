import { calculateCounterPickConfidence } from "./counter-pick-confidence.ts";
import type { CounterPickStatistics } from "./counter-pick-statistics.ts";
import {
  getChampionMasteryRequirementLevel,
  type ChampionMasteryRequirementLevel,
} from "./champion-mastery-requirements.ts";
import { isChampionIdSupportedInRole } from "./champion-role-registry.ts";
import { leagueRoles, type LeagueRole } from "./roles.ts";

export type CounterRankingV2TraitCategory =
  | "damage_pattern"
  | "defensive_shape"
  | "range_shape"
  | "target_access"
  | "utility"
  | "vulnerability";

export type CounterRankingV2TraitId =
  | "anti_dash"
  | "anti_heal"
  | "anti_magic"
  | "anti_shield"
  | "all_in_threat"
  | "burst_damage"
  | "can_contest_crab"
  | "can_gank_early"
  | "cooldown_reliant"
  | "dash_reliant"
  | "difficult_to_contest_crab"
  | "disengage"
  | "engage"
  | "early_weakness"
  | "falls_off_late"
  | "fragile"
  | "gap_closing"
  | "good_ganks"
  | "immobile"
  | "late_scaling"
  | "melee_commit"
  | "mobility"
  | "mobility_reliant"
  | "no_disengage"
  | "no_engage"
  | "point_and_click_cc"
  | "poke"
  | "reliable_cc"
  | "roaming"
  | "scaling"
  | "short_range"
  | "skillshot_reliant"
  | "slow_first_clear"
  | "strong_clear"
  | "suppression"
  | "strong_early"
  | "sustained_damage"
  | "sustain"
  | "vulnerable_to_all_in"
  | "waveclear"
  | "waveclear_weak"
  | "weak_early"
  | "weak_vs_poke"
  | "weak_vs_range"
  | "weak_vs_roaming"
  | "weak_vs_sustain"
  | "weak_vs_waveclear"
  | "weak_ganks_pre_6";

export type CounterRankingV2ProfileStatus = "draft" | "needs_revision" | "reviewed";
export type CounterRankingV2DraftProfileConfidence =
  | "high_draft_confidence"
  | "medium_draft_confidence"
  | "low_draft_confidence";

export type CounterRankingV2TraitDefinition = {
  category: CounterRankingV2TraitCategory;
  description: string;
  id: CounterRankingV2TraitId;
  isShared?: boolean;
  label: string;
  roles?: readonly LeagueRole[];
};

export type CounterRankingV2ProfileTrait = {
  traitId: CounterRankingV2TraitId;
  weight: number;
};

export type CounterRankingV2ChampionProfile = {
  championId: string;
  identitySummary?: string;
  knownStrengths?: string[];
  knownWeaknesses?: string[];
  masteryRequirement?: ChampionMasteryRequirementLevel;
  notes?: string;
  reviewStatus: CounterRankingV2ProfileStatus;
  role: LeagueRole;
  strengths: CounterRankingV2ProfileTrait[];
  supportedRoles: LeagueRole[];
  vulnerabilities: CounterRankingV2ProfileTrait[];
  version: number;
};

export type CounterRankingV2DraftProfileKnowledgeInput = {
  abilities?: Record<string, string> | null;
  archetype?: readonly string[] | null;
  commonWeaknesses?: readonly string[] | null;
  damageType?: string | null;
  dangerAbilities?: readonly string[] | null;
  hardCrowdControl?: readonly string[] | null;
  identityText?: string | null;
  isCommonRole?: boolean;
  jungleProfile?: {
    clearSpeed?: { rating?: string | null } | null;
    dueling?: { rating?: string | null } | null;
    earlyGamePressure?: { rating?: string | null } | null;
    gankThreat?: { rating?: string | null } | null;
    objectiveControl?: { rating?: string | null } | null;
    scaling?: { rating?: string | null } | null;
  } | null;
  mobilityLevel?: string | null;
  name?: string | null;
  primaryTradingPattern?: string | null;
  primaryWinCondition?: readonly string[] | null;
  shields?: readonly string[] | null;
  strategicIdentity?: {
    laneGoal?: string | null;
    preferredGameLength?: string | null;
    scalingProfile?: string | null;
    winMethod?: readonly string[] | null;
  } | null;
  sustain?: readonly string[] | null;
};

export type CounterRankingV2DraftProfileSuggestion = {
  changes: {
    addedStrengths: CounterRankingV2TraitId[];
    addedWeaknesses: CounterRankingV2TraitId[];
    changedStrengths: CounterRankingV2TraitId[];
    changedWeaknesses: CounterRankingV2TraitId[];
    removedStrengths: CounterRankingV2TraitId[];
    removedWeaknesses: CounterRankingV2TraitId[];
  };
  championId: string;
  confidence: CounterRankingV2DraftProfileConfidence;
  explanation: string[];
  knownStrengths: string[];
  knownWeaknesses: string[];
  proposedStatus: CounterRankingV2ProfileStatus;
  role: LeagueRole;
  similarReviewedProfiles: Array<{
    championId: string;
    overlap: CounterRankingV2TraitId[];
    role: LeagueRole;
  }>;
  summary: string;
  strengths: CounterRankingV2ProfileTrait[];
  uncertaintyNotes: string[];
  vulnerabilities: CounterRankingV2ProfileTrait[];
};

export type CounterRankingV2ProfileReview = {
  championId: string;
  createdAt: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  role: LeagueRole;
  status: CounterRankingV2ProfileStatus;
  traitProfileVersion: number;
  updatedAt: string | null;
  vulnerabilityProfileVersion: number;
};

export type CounterRankingV2ProfileStatusByChampionId = Map<
  string,
  CounterRankingV2ProfileStatus
>;
export type CounterRankingV2ProfileByChampionId = Map<string, CounterRankingV2ChampionProfile>;

export function getCounterRankingV2ProfileKey(
  championId: string,
  role: LeagueRole | string | null | undefined,
) {
  return `${normalizeChampionId(championId)}::${normalizeCounterRankingV2ProfileRole(role)}`;
}

export type CounterRankingV2Factor = {
  candidateStrength: CounterRankingV2TraitId;
  contribution: number;
  enemyVulnerability: CounterRankingV2TraitId;
  interactionWeight: number;
  reason: string;
};

export type CounterRankingV2FactorImpactLevel = "high" | "low" | "medium";

export type CounterRankingV2MechanicalReason = {
  explanation: string;
  factor: CounterRankingV2Factor;
  impactLevel: CounterRankingV2FactorImpactLevel;
  title: string;
};

export type CounterRankingV2FitStatus =
  | "calculated"
  | "incomplete_profile"
  | "missing_candidate_profile"
  | "missing_enemy_profile";

export type CounterRankingV2MechanicalFitResult = {
  candidateChampionId: string;
  enemyChampionId: string;
  factors: CounterRankingV2Factor[];
  maxRawScore: number;
  rawScore: number;
  role: LeagueRole | null;
  score: number;
  status: CounterRankingV2FitStatus;
};

export type CounterRankingV2ObservedRankSnapshot = {
  confidence: CounterPickStatistics["confidence"];
  games: number | null;
  rank: number | null;
  winRate: number | null;
};

export type CounterRankingV2AdjustmentReason =
  | "auto_generated"
  | "data_disagreement"
  | "manual_review"
  | "meta_shift"
  | "other"
  | "patch_buff"
  | "patch_nerf"
  | "practical_difficulty";

export type CounterRankingV2ReviewStatus =
  | "incorrect_suggestion"
  | "needs_more_data"
  | "not_a_counter"
  | "unreviewed"
  | "verified_soft_counter"
  | "verified_strong_counter";

export type CounterRankingV2ReviewFilter =
  | "all"
  | "auto_approval_candidate"
  | "auto_approved"
  | "auto_suggested"
  | "high_mastery_required"
  | "incorrect_suggestion"
  | "low_sample"
  | "manual_approved"
  | "manual_rejected"
  | "needs_more_data"
  | "needs_review"
  | "not_a_counter"
  | "public_eligible"
  | "unreviewed"
  | "verified_soft_counter"
  | "verified_strong_counter";

export type CounterRankingV2SuggestedStrength =
  | "hard_counter"
  | "neutral"
  | "poor_fit"
  | "soft_counter"
  | "strong_counter";

export type CounterRankingV2AutomationStatus =
  | "auto_approval_candidate"
  | "auto_approved"
  | "auto_suggested"
  | "manual_approved"
  | "manual_rejected"
  | "needs_review";

export type CounterRankingV2AutomationConfidence = "high" | "low" | "medium";

export type CounterRankingV2AutomationBlockerId =
  | "candidate_profile_generated_draft"
  | "excluded_unsupported_candidate_role"
  | "existing_manual_review_override"
  | "high_mastery_candidate"
  | "manually_rejected"
  | "missing_profile"
  | "observed_stat_contradiction"
  | "other"
  | "profile_deprecated"
  | "profile_needs_revision"
  | "score_below_auto_approval_threshold"
  | "score_below_auto_suggested_threshold"
  | "target_profile_generated_draft"
  | "weak_one_factor_signal";

export type CounterRankingV2AutomationBlocker = {
  id: CounterRankingV2AutomationBlockerId;
  message: string;
};

export type CounterRankingV2MechanicalReview = {
  adjustmentReason: CounterRankingV2AdjustmentReason;
  adminReviewNote: string | null;
  calculatedMechanicalScore: number;
  counterChampionId: string;
  createdAt: string | null;
  enemyChampionId: string;
  finalMechanicalScore: number;
  generatedAt: string | null;
  generatedBy: string | null;
  highMasteryRequired: boolean;
  manualAdjustment: number;
  publicEligible: boolean;
  reviewStatus: CounterRankingV2ReviewStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  role: LeagueRole;
  updatedAt: string | null;
};

export type CounterRankingV2ComparisonRow = {
  automationSuggestion: CounterRankingV2MechanicalSuggestion | null;
  candidateChampionId: string;
  mechanicalRank: number | null;
  mechanicalResult: CounterRankingV2MechanicalFitResult;
  review: CounterRankingV2MechanicalReview | null;
  rankDelta: number | null;
  observed: CounterRankingV2ObservedRankSnapshot | null;
};

export type CounterRankingV2MechanicalSuggestion = {
  automationStatus: CounterRankingV2AutomationStatus;
  blockers: CounterRankingV2AutomationBlocker[];
  confidence: CounterRankingV2AutomationConfidence;
  factors: CounterRankingV2Factor[];
  reasons: string[];
  score: number;
  suggestedStrength: CounterRankingV2SuggestedStrength;
};

export type CounterRankingV2AutomationSummary = {
  autoApprovalCandidates: number;
  autoApproved: number;
  autoSuggested: number;
  generatedSuggestions: number;
  manualApproved: number;
  manualRejected: number;
  needsReview: number;
};

export type CounterRankingV2AutomationBlockerSummary = Record<
  CounterRankingV2AutomationBlockerId,
  number
>;

export type CounterRankingV2ReviewProgressSummary = {
  highMasteryRequired: number;
  incorrectSuggestions: number;
  needsMoreData: number;
  notCounters: number;
  publicEligible: number;
  reviewed: number;
  total: number;
  unreviewed: number;
  verifiedSoftCounters: number;
  verifiedStrongCounters: number;
};

export type CounterRankingV2CandidatePoolSummary = {
  candidatesDisplayed: number;
  candidatesEvaluated: number;
  excludedUnsupportedCandidateRole: number;
  includedForSelectedRole: number;
  role: LeagueRole;
  totalActiveChampions: number;
};

export type CounterRankingV2PublicPreviewRow = {
  candidateChampionId: string;
  confidenceLabel: string;
  currentPublicRank: number | null;
  finalReviewedScore: number;
  highMasteryRequired: boolean;
  isLowSampleDesignCounter: boolean;
  observedGames: number | null;
  reviewStatus: CounterRankingV2ReviewStatus;
};

type CounterRankingV2TraitInteraction = {
  candidateStrength: CounterRankingV2TraitId;
  enemyVulnerability: CounterRankingV2TraitId;
  reason: string;
  weight: number;
};

const maxTraitWeight = 5;
export const counterRankingV2AutoSuggestedScoreThreshold = 75;
export const counterRankingV2AutoApprovalScoreThreshold = 85;
export const counterRankingV2NeedsReviewScoreThreshold = 65;
export const counterRankingV2ProfileValueMin = 0;
export const counterRankingV2ProfileValueMax = 10;
export const counterRankingV2ManualAdjustmentMin = -30;
export const counterRankingV2ManualAdjustmentMax = 30;
export const counterRankingV2DefaultAdjustmentReason = "manual_review";
export const counterRankingV2DefaultReviewStatus = "unreviewed";
export const counterRankingV2GeneratedDraftProfileVersion = 1;
export const useReviewedMechanicalCountersPublicly =
  process.env.NEXT_PUBLIC_USE_REVIEWED_MECHANICAL_COUNTERS_PUBLICLY === "true";

export const counterRankingV2ProfileStatuses = [
  "draft",
  "needs_revision",
  "reviewed",
] as const satisfies readonly CounterRankingV2ProfileStatus[];

export const counterRankingV2AdjustmentReasons = [
  "auto_generated",
  "patch_buff",
  "patch_nerf",
  "meta_shift",
  "practical_difficulty",
  "data_disagreement",
  "manual_review",
  "other",
] as const satisfies readonly CounterRankingV2AdjustmentReason[];

export const counterRankingV2ReviewStatuses = [
  "unreviewed",
  "verified_strong_counter",
  "verified_soft_counter",
  "not_a_counter",
  "needs_more_data",
  "incorrect_suggestion",
] as const satisfies readonly CounterRankingV2ReviewStatus[];
export const counterRankingV2PublicApprovedReviewStatuses = [
  "verified_strong_counter",
  "verified_soft_counter",
] as const;

export const counterRankingV2SupportedChampionIds = [
  "vex",
  "yone",
  "yasuo",
  "akali",
  "annie",
  "malzahar",
  "lissandra",
  "kassadin",
  "ahri",
  "syndra",
  "orianna",
  "zed",
  "katarina",
  "leblanc",
  "viktor",
  "sylas",
  "fizz",
  "hwei",
  "malphite",
  "veigar",
  "akshan",
  "anivia",
  "aurelionsol",
  "aurora",
  "azir",
  "cassiopeia",
  "corki",
  "diana",
  "ekko",
  "galio",
  "irelia",
  "lux",
  "mel",
  "naafiri",
  "neeko",
  "qiyana",
  "ryze",
  "taliyah",
  "talon",
  "twistedfate",
  "vladimir",
  "xerath",
  "ziggs",
  "zoe",
] as const;

export const counterRankingV2TraitVocabulary = [
  {
    category: "utility",
    description: "Punishes repeated dashes, blinks, or committed movement patterns.",
    id: "anti_dash",
    label: "Anti-dash",
  },
  {
    category: "utility",
    description: "Can reduce, punish, or naturally pressure sustain/healing-heavy champions.",
    id: "anti_heal",
    label: "Anti-heal",
  },
  {
    category: "defensive_shape",
    description: "Naturally reduces or absorbs magic-heavy pressure.",
    id: "anti_magic",
    label: "Anti-magic",
  },
  {
    category: "utility",
    description: "Can reduce, break, bypass, or punish shield-based durability.",
    id: "anti_shield",
    label: "Anti-shield",
  },
  {
    category: "target_access",
    description:
      "Can threaten decisive engage or kill windows through committed burst, engage, or full-combo pressure.",
    id: "all_in_threat",
    label: "All-in threat",
  },
  {
    category: "damage_pattern",
    description: "Can threaten decisive health swings during short windows.",
    id: "burst_damage",
    label: "Burst damage",
  },
  {
    category: "utility",
    description: "Can create useful gank pressure before level 6.",
    id: "can_gank_early",
    label: "Can gank early",
    roles: ["jungle"],
  },
  {
    category: "utility",
    description: "Can fight or pressure early river crab contests.",
    id: "can_contest_crab",
    label: "Can contest crab",
    roles: ["jungle"],
  },
  {
    category: "vulnerability",
    description: "Has meaningful downtime after key spells are used.",
    id: "cooldown_reliant",
    label: "CDR-reliant",
  },
  {
    category: "vulnerability",
    description: "Needs dash access to trade, escape, or finish fights.",
    id: "dash_reliant",
    label: "Dash-reliant",
  },
  {
    category: "vulnerability",
    description:
      "Struggles to fight or secure early river crab against stronger early junglers.",
    id: "difficult_to_contest_crab",
    label: "Difficult to contest crab",
    roles: ["jungle"],
  },
  {
    category: "defensive_shape",
    description:
      "Can deny engage, reset fights, peel, escape, or interrupt enemy commitment.",
    id: "disengage",
    label: "Disengage",
  },
  {
    category: "target_access",
    description: "Can start fights, force commits, or create reliable initiation windows.",
    id: "engage",
    label: "Engage",
  },
  {
    category: "vulnerability",
    description: "Can be punished before levels, items, or core scaling breakpoints.",
    id: "early_weakness",
    label: "Early weakness",
  },
  {
    category: "vulnerability",
    description: "Loses relative impact later in the game compared to scaling opponents.",
    id: "falls_off_late",
    label: "Falls off late",
  },
  {
    category: "vulnerability",
    description: "Low tolerance for burst or locked-down all-ins.",
    id: "fragile",
    label: "Fragile",
  },
  {
    category: "vulnerability",
    description:
      "Vulnerable to enemies that can quickly close distance and force trades or all-ins.",
    id: "gap_closing",
    label: "Gap closing",
  },
  {
    category: "target_access",
    description:
      "Has reliable gank tools such as CC, gap close, burst, or strong lane follow-up setup.",
    id: "good_ganks",
    label: "Good ganks",
    roles: ["jungle"],
  },
  {
    category: "vulnerability",
    description: "Limited ability to reposition once threatened.",
    id: "immobile",
    label: "Immobile",
  },
  {
    category: "damage_pattern",
    description: "Gains large relative value after levels or items.",
    id: "scaling",
    label: "Scaling",
  },
  {
    category: "vulnerability",
    description: "Must enter committed melee range to access normal trading patterns.",
    id: "melee_commit",
    label: "Melee commit",
  },
  {
    category: "target_access",
    description: "Can reposition or threaten backline access in fights.",
    id: "mobility",
    label: "Mobility",
  },
  {
    category: "vulnerability",
    description: "Loses much of its plan if movement is interrupted or constrained.",
    id: "mobility_reliant",
    label: "Mobility-reliant",
  },
  {
    category: "vulnerability",
    description: "Lacks reliable tools to reset, peel, or stop enemy commitment.",
    id: "no_disengage",
    label: "No disengage",
  },
  {
    category: "vulnerability",
    description: "Lacks reliable tools to start fights or force decisive commitment.",
    id: "no_engage",
    label: "No engage",
  },
  {
    category: "utility",
    description: "Can lock a specific target without relying on dodgeable skillshots.",
    id: "point_and_click_cc",
    label: "Point-and-click CC",
  },
  {
    category: "range_shape",
    description: "Can chip or control space before a committed fight starts.",
    id: "poke",
    label: "Poke",
  },
  {
    category: "utility",
    description: "Has dependable crowd control that can interrupt or punish entry.",
    id: "reliable_cc",
    label: "Reliable CC",
  },
  {
    category: "utility",
    description:
      "Can leave lane and impact side lanes, jungle fights, or map tempo effectively.",
    id: "roaming",
    label: "Roaming",
  },
  {
    category: "vulnerability",
    description: "Needs to stand close enough to be threatened during normal trades.",
    id: "short_range",
    label: "Short range",
  },
  {
    category: "vulnerability",
    description:
      "Loses reliability when enemies can dodge, dash, become untargetable, or otherwise avoid key spells.",
    id: "skillshot_reliant",
    label: "Skillshot-reliant",
  },
  {
    category: "vulnerability",
    description: "Loses early tempo because first clear is slow or unhealthy.",
    id: "slow_first_clear",
    label: "Slow first clear",
    roles: ["jungle"],
  },
  {
    category: "utility",
    description: "Clears camps efficiently and can keep tempo.",
    id: "strong_clear",
    label: "Strong clear",
    roles: ["jungle"],
  },
  {
    category: "utility",
    description: "Can force a high-value target to stop acting for a decisive window.",
    id: "suppression",
    label: "Suppression",
  },
  {
    category: "damage_pattern",
    description: "Has strong early lane pressure, kill threat, or early skirmish power.",
    id: "strong_early",
    label: "Strong early",
  },
  {
    category: "damage_pattern",
    description: "Wins through repeated DPS rather than one burst window.",
    id: "sustained_damage",
    label: "Sustained damage",
  },
  {
    category: "defensive_shape",
    description:
      "Can recover health or stay in fights/trades longer through healing, shielding, or repeated combat recovery.",
    id: "sustain",
    label: "Sustain",
  },
  {
    category: "vulnerability",
    description: "Struggles when enemies can commit and force decisive kill windows.",
    id: "vulnerable_to_all_in",
    label: "Weak to all-in",
  },
  {
    category: "utility",
    description: "Can control minion waves to shape recall, roam, or punish timings.",
    id: "waveclear",
    label: "Waveclear",
  },
  {
    category: "vulnerability",
    description: "Can be trapped under wave pressure or delayed on roam timings.",
    id: "waveclear_weak",
    label: "Weak waveclear",
  },
  {
    category: "vulnerability",
    description: "Vulnerable before key levels/items and can be punished by early pressure.",
    id: "weak_early",
    label: "Weak early",
  },
  {
    category: "vulnerability",
    description: "Struggles against repeated ranged damage, chip pressure, or long-range harassment.",
    id: "weak_vs_poke",
    label: "Vulnerable to poke",
  },
  {
    category: "vulnerability",
    description: "Struggles to farm or trade against long-range champions and poke.",
    id: "weak_vs_range",
    label: "Weak vs range",
  },
  {
    category: "vulnerability",
    description: "Struggles to match, punish, or respond to enemy map movement.",
    id: "weak_vs_roaming",
    label: "Weak vs roaming",
  },
  {
    category: "vulnerability",
    description:
      "Loses value when enemies can heal, shield, or recover through its poke/trade pattern.",
    id: "weak_vs_sustain",
    label: "Weak vs sustain",
  },
  {
    category: "vulnerability",
    description:
      "Loses pressure or roam opportunities when enemies can quickly clear waves and neutralize lane tempo.",
    id: "weak_vs_waveclear",
    label: "Weak vs waveclear",
  },
  {
    category: "vulnerability",
    description: "Has weak or unreliable ganks before ultimate or key level 6 tools.",
    id: "weak_ganks_pre_6",
    label: "Not good ganks pre 6",
    roles: ["jungle"],
  },
] as const satisfies readonly CounterRankingV2TraitDefinition[];

export const counterRankingV2TraitDefinitionsById: ReadonlyMap<
  CounterRankingV2TraitId,
  CounterRankingV2TraitDefinition
> = new Map(
  counterRankingV2TraitVocabulary.map((trait) => [trait.id, trait] as const),
);

const counterRankingV2TraitAliases: Partial<Record<CounterRankingV2TraitId, CounterRankingV2TraitId>> = {
  late_scaling: "scaling",
};

export function normalizeCounterRankingV2TraitId(
  value: unknown,
): CounterRankingV2TraitId | null {
  const rawTraitId = String(value ?? "").trim() as CounterRankingV2TraitId;
  const normalizedTraitId = counterRankingV2TraitAliases[rawTraitId] ?? rawTraitId;

  return counterRankingV2TraitDefinitionsById.has(normalizedTraitId) ? normalizedTraitId : null;
}

export function isCounterRankingV2TraitDefinitionVisibleForRole(
  traitDefinition: CounterRankingV2TraitDefinition,
  role: LeagueRole,
) {
  return !traitDefinition.roles || traitDefinition.roles.includes(role) || traitDefinition.isShared;
}

export function isChampionSupportedInRole(championId: string, role: LeagueRole) {
  return isChampionIdSupportedInRole(championId, role);
}

export function getCounterRankingV2SupportedRoleCandidatePool({
  candidateChampionIds,
  role,
}: {
  candidateChampionIds: string[];
  role: LeagueRole;
}) {
  const normalizedCandidateIds = Array.from(new Set(candidateChampionIds.map(normalizeChampionId)));
  const candidateRoleEligibility = new Map(
    normalizedCandidateIds.map(
      (candidateChampionId) =>
        [
          candidateChampionId,
          isChampionSupportedInRole(candidateChampionId, role),
        ] as const,
    ),
  );
  const supportedRoleCandidatePool = normalizedCandidateIds.filter((candidateChampionId) =>
    candidateRoleEligibility.get(candidateChampionId),
  );

  return {
    candidateRoleEligibility,
    supportedRoleCandidatePool,
  };
}

export function getCounterRankingV2CandidatePoolSummary({
  candidateChampionIds,
  candidatesDisplayed,
  candidatesEvaluated,
  role,
}: {
  candidateChampionIds: string[];
  candidatesDisplayed: number;
  candidatesEvaluated: number;
  role: LeagueRole;
}): CounterRankingV2CandidatePoolSummary {
  const { candidateRoleEligibility } = getCounterRankingV2SupportedRoleCandidatePool({
    candidateChampionIds,
    role,
  });
  const includedForSelectedRole = Array.from(candidateRoleEligibility.values()).filter(Boolean)
    .length;
  const totalActiveChampions = candidateRoleEligibility.size;

  return {
    candidatesDisplayed,
    candidatesEvaluated,
    excludedUnsupportedCandidateRole: totalActiveChampions - includedForSelectedRole,
    includedForSelectedRole,
    role,
    totalActiveChampions,
  };
}

const counterRankingV2TraitInteractions = [
  {
    candidateStrength: "anti_dash",
    enemyVulnerability: "dash_reliant",
    reason: "Anti-dash tools directly punish champions whose trades depend on repeated dashes.",
    weight: 1,
  },
  {
    candidateStrength: "anti_dash",
    enemyVulnerability: "mobility_reliant",
    reason: "Anti-dash control removes safety from mobility-reliant engage or escape patterns.",
    weight: 0.9,
  },
  {
    candidateStrength: "anti_dash",
    enemyVulnerability: "melee_commit",
    reason: "Committed melee entries are easier to interrupt when anti-dash tools are available.",
    weight: 0.8,
  },
  {
    candidateStrength: "mobility",
    enemyVulnerability: "gap_closing",
    reason: "Mobility helps force trades into champions vulnerable to quick gap closing.",
    weight: 0.7,
  },
  {
    candidateStrength: "point_and_click_cc",
    enemyVulnerability: "mobility_reliant",
    reason: "Point-and-click crowd control reliably tags slippery champions.",
    weight: 0.95,
  },
  {
    candidateStrength: "point_and_click_cc",
    enemyVulnerability: "dash_reliant",
    reason: "Targeted lockdown punishes dash-reliant champions before they can reset spacing.",
    weight: 0.85,
  },
  {
    candidateStrength: "reliable_cc",
    enemyVulnerability: "melee_commit",
    reason: "Reliable crowd control punishes committed melee entries.",
    weight: 0.8,
  },
  {
    candidateStrength: "reliable_cc",
    enemyVulnerability: "mobility_reliant",
    reason: "Dependable control makes mobility windows riskier to use.",
    weight: 0.75,
  },
  {
    candidateStrength: "disengage",
    enemyVulnerability: "melee_commit",
    reason: "Disengage can reset or interrupt committed melee entries.",
    weight: 0.75,
  },
  {
    candidateStrength: "disengage",
    enemyVulnerability: "gap_closing",
    reason: "Disengage punishes opponents that must close distance to start trades.",
    weight: 0.7,
  },
  {
    candidateStrength: "suppression",
    enemyVulnerability: "mobility_reliant",
    reason: "Suppression denies mobility-reliant champions their escape and outplay windows.",
    weight: 1,
  },
  {
    candidateStrength: "suppression",
    enemyVulnerability: "fragile",
    reason: "Suppression turns fragile targets into reliable focus-fire windows.",
    weight: 0.8,
  },
  {
    candidateStrength: "poke",
    enemyVulnerability: "short_range",
    reason: "Poke can tax short-range champions before they reach their preferred trade range.",
    weight: 0.7,
  },
  {
    candidateStrength: "poke",
    enemyVulnerability: "waveclear_weak",
    reason: "Poke plus wave pressure exploits weak waveclear and delayed resets.",
    weight: 0.65,
  },
  {
    candidateStrength: "poke",
    enemyVulnerability: "weak_vs_poke",
    reason: "Repeated poke directly pressures champions vulnerable to ranged harassment.",
    weight: 0.75,
  },
  {
    candidateStrength: "poke",
    enemyVulnerability: "weak_vs_range",
    reason: "Range and chip damage tax champions that struggle to farm into long reach.",
    weight: 0.7,
  },
  {
    candidateStrength: "burst_damage",
    enemyVulnerability: "fragile",
    reason: "Burst damage threatens fragile champions before extended patterns develop.",
    weight: 0.8,
  },
  {
    candidateStrength: "burst_damage",
    enemyVulnerability: "cooldown_reliant",
    reason: "Burst can punish cooldown windows after key defensive spells are spent.",
    weight: 0.65,
  },
  {
    candidateStrength: "all_in_threat",
    enemyVulnerability: "vulnerable_to_all_in",
    reason: "All-in pressure directly attacks champions weak to decisive commit windows.",
    weight: 0.9,
  },
  {
    candidateStrength: "all_in_threat",
    enemyVulnerability: "short_range",
    reason: "Committed kill pressure is easier to force against short-range champions.",
    weight: 0.65,
  },
  {
    candidateStrength: "all_in_threat",
    enemyVulnerability: "immobile",
    reason: "Immobile champions have fewer ways to avoid committed all-in windows.",
    weight: 0.75,
  },
  {
    candidateStrength: "all_in_threat",
    enemyVulnerability: "skillshot_reliant",
    reason: "All-in pressure can punish champions that need reliable skillshot setup.",
    weight: 0.6,
  },
  {
    candidateStrength: "waveclear",
    enemyVulnerability: "waveclear_weak",
    reason: "Waveclear can trap weak-waveclear champions in poor tempo states.",
    weight: 0.75,
  },
  {
    candidateStrength: "waveclear",
    enemyVulnerability: "weak_vs_waveclear",
    reason: "Waveclear neutralizes champions that need lane tempo or roam windows.",
    weight: 0.75,
  },
  {
    candidateStrength: "scaling",
    enemyVulnerability: "falls_off_late",
    reason: "Scaling champions gain value against opponents that lose relative late impact.",
    weight: 0.8,
  },
  {
    candidateStrength: "scaling",
    enemyVulnerability: "early_weakness",
    reason: "Scaling value is safer when the enemy also has limited early punishment.",
    weight: 0.45,
  },
  {
    candidateStrength: "scaling",
    enemyVulnerability: "weak_early",
    reason: "Scaling value is safer when the enemy has limited early punishment.",
    weight: 0.5,
  },
  {
    candidateStrength: "strong_early",
    enemyVulnerability: "early_weakness",
    reason: "Strong early pressure punishes champions before their core levels or items.",
    weight: 0.75,
  },
  {
    candidateStrength: "strong_early",
    enemyVulnerability: "weak_early",
    reason: "Strong early pressure directly attacks weak early lanes.",
    weight: 0.8,
  },
  {
    candidateStrength: "strong_early",
    enemyVulnerability: "falls_off_late",
    reason: "Early pressure can decide games before lower-scaling champions stabilize.",
    weight: 0.55,
  },
  {
    candidateStrength: "sustained_damage",
    enemyVulnerability: "cooldown_reliant",
    reason: "Sustained damage keeps pressure high through the enemy's cooldown downtime.",
    weight: 0.55,
  },
  {
    candidateStrength: "sustain",
    enemyVulnerability: "weak_vs_sustain",
    reason: "Sustain outlasts champions whose poke or trade pattern depends on damage sticking.",
    weight: 0.75,
  },
  {
    candidateStrength: "sustain",
    enemyVulnerability: "weak_vs_poke",
    reason: "Sustain blunts poke lanes that need chip damage to stay permanent.",
    weight: 0.6,
  },
  {
    candidateStrength: "anti_magic",
    enemyVulnerability: "burst_damage",
    reason: "Anti-magic durability reduces the impact of magic burst windows.",
    weight: 0.5,
  },
  {
    candidateStrength: "anti_heal",
    enemyVulnerability: "sustain",
    reason: "Anti-heal pressure reduces the value of sustain-heavy patterns.",
    weight: 0.7,
  },
  {
    candidateStrength: "anti_shield",
    enemyVulnerability: "sustain",
    reason: "Anti-shield tools punish shield-based durability and recovery windows.",
    weight: 0.55,
  },
  {
    candidateStrength: "roaming",
    enemyVulnerability: "weak_vs_roaming",
    reason: "Roaming pressure exploits champions that cannot match or punish map movement.",
    weight: 0.8,
  },
  {
    candidateStrength: "mobility",
    enemyVulnerability: "skillshot_reliant",
    reason: "Mobility makes key skillshots less reliable.",
    weight: 0.65,
  },
  {
    candidateStrength: "anti_dash",
    enemyVulnerability: "gap_closing",
    reason: "Anti-dash tools punish champions that rely on quick gap closing.",
    weight: 0.75,
  },
] as const satisfies readonly CounterRankingV2TraitInteraction[];

export const counterRankingV2ChampionProfiles = [
  profile("vex", "reviewed", 1, {
    notes: "Anti-dash mage baseline for testing mobile melee mid counters.",
    strengths: [
      trait("anti_dash", 5),
      trait("reliable_cc", 4),
      trait("burst_damage", 4),
      trait("poke", 3),
    ],
    vulnerabilities: [trait("immobile", 3), trait("cooldown_reliant", 3), trait("short_range", 2)],
  }),
  profile("yone", "reviewed", 1, {
    notes: "Mobile melee carry profile used as the primary dash-reliant enemy fixture.",
    strengths: [trait("mobility", 5), trait("sustained_damage", 4), trait("scaling", 4)],
    vulnerabilities: [
      trait("dash_reliant", 5),
      trait("melee_commit", 4),
      trait("mobility_reliant", 4),
      trait("early_weakness", 2),
    ],
  }),
  profile("yasuo", "reviewed", 1, {
    notes: "Dash-reliant melee skirmisher profile for anti-dash and lockdown tests.",
    strengths: [trait("mobility", 5), trait("sustained_damage", 4), trait("waveclear", 3)],
    vulnerabilities: [
      trait("dash_reliant", 5),
      trait("melee_commit", 4),
      trait("mobility_reliant", 4),
      trait("fragile", 2),
    ],
  }),
  profile("akali", "needs_revision", 1, {
    notes: "Mobile assassin profile with weak wave control and cooldown windows.",
    strengths: [trait("mobility", 5), trait("burst_damage", 4), trait("anti_magic", 2)],
    vulnerabilities: [
      trait("mobility_reliant", 5),
      trait("cooldown_reliant", 3),
      trait("waveclear_weak", 3),
    ],
  }),
  profile("annie", "needs_revision", 1, {
    notes: "Short-range burst mage profile with reliable targeted lockdown.",
    strengths: [trait("point_and_click_cc", 5), trait("burst_damage", 4), trait("reliable_cc", 3)],
    vulnerabilities: [trait("short_range", 4), trait("immobile", 4), trait("cooldown_reliant", 3)],
  }),
  profile("malzahar", "needs_revision", 1, {
    notes: "Suppression and waveclear profile for testing mobile-fragile counter pressure.",
    strengths: [trait("suppression", 5), trait("waveclear", 4), trait("reliable_cc", 3)],
    vulnerabilities: [trait("immobile", 4), trait("early_weakness", 3), trait("cooldown_reliant", 3)],
  }),
  profile("lissandra", "needs_revision", 1, {
    notes: "Reliable crowd-control mage profile for punishing committed melee entries.",
    strengths: [trait("reliable_cc", 5), trait("point_and_click_cc", 3), trait("burst_damage", 3)],
    vulnerabilities: [trait("short_range", 3), trait("cooldown_reliant", 4), trait("early_weakness", 2)],
  }),
  profile("kassadin", "needs_revision", 1, {
    notes: "Late-scaling anti-magic assassin profile with exploitable early wave states.",
    strengths: [trait("scaling", 5), trait("anti_magic", 4), trait("mobility", 4)],
    vulnerabilities: [
      trait("early_weakness", 5),
      trait("waveclear_weak", 4),
      trait("melee_commit", 2),
    ],
  }),
  profile("ahri", "draft", 1, {
    notes: "Mobile pick mage profile with charm setup, poke, and cooldown-dependent threat.",
    strengths: [trait("mobility", 4), trait("reliable_cc", 3), trait("poke", 3), trait("burst_damage", 3)],
    vulnerabilities: [trait("cooldown_reliant", 4), trait("fragile", 3), trait("waveclear_weak", 2)],
  }),
  profile("syndra", "draft", 1, {
    notes: "Longer-range burst control mage profile with strong punish windows but low mobility.",
    strengths: [trait("burst_damage", 5), trait("poke", 4), trait("reliable_cc", 3), trait("waveclear", 3)],
    vulnerabilities: [trait("immobile", 4), trait("cooldown_reliant", 3), trait("fragile", 3)],
  }),
  profile("orianna", "draft", 1, {
    notes: "Control mage profile with wave control and reliable zone setup, offset by immobility.",
    strengths: [trait("waveclear", 5), trait("poke", 3), trait("reliable_cc", 3), trait("scaling", 3)],
    vulnerabilities: [trait("immobile", 4), trait("fragile", 3), trait("cooldown_reliant", 2)],
  }),
  profile("zed", "draft", 1, {
    notes: "Mobile AD assassin profile that depends on shadow windows and committed burst access.",
    strengths: [trait("mobility", 5), trait("burst_damage", 5), trait("poke", 2)],
    vulnerabilities: [
      trait("cooldown_reliant", 4),
      trait("mobility_reliant", 4),
      trait("melee_commit", 3),
      trait("fragile", 2),
    ],
  }),
  profile("katarina", "draft", 1, {
    notes: "Reset assassin profile with high mobility but heavy dependence on entry timing.",
    strengths: [trait("mobility", 5), trait("burst_damage", 4), trait("sustained_damage", 3)],
    vulnerabilities: [
      trait("mobility_reliant", 5),
      trait("melee_commit", 4),
      trait("fragile", 3),
      trait("waveclear_weak", 3),
    ],
  }),
  profile("leblanc", "draft", 1, {
    notes: "Mobile burst mage profile with distortion windows and chain follow-up pressure.",
    strengths: [trait("mobility", 5), trait("burst_damage", 4), trait("reliable_cc", 2), trait("poke", 2)],
    vulnerabilities: [
      trait("mobility_reliant", 4),
      trait("cooldown_reliant", 4),
      trait("waveclear_weak", 3),
      trait("fragile", 2),
    ],
  }),
  profile("viktor", "draft", 1, {
    notes: "Scaling control mage profile with wave control and zone pressure but low repositioning.",
    strengths: [trait("waveclear", 5), trait("poke", 4), trait("scaling", 4), trait("sustained_damage", 3)],
    vulnerabilities: [trait("immobile", 4), trait("early_weakness", 3), trait("cooldown_reliant", 2)],
  }),
  profile("sylas", "draft", 1, {
    notes: "Melee AP skirmisher profile with mobility and sustain-oriented extended trades.",
    strengths: [trait("mobility", 4), trait("sustained_damage", 4), trait("burst_damage", 3)],
    vulnerabilities: [
      trait("melee_commit", 4),
      trait("cooldown_reliant", 4),
      trait("waveclear_weak", 3),
      trait("early_weakness", 2),
    ],
  }),
  profile("fizz", "draft", 1, {
    notes: "Mobile melee burst profile with evasive cooldown windows and committed all-ins.",
    strengths: [trait("mobility", 5), trait("burst_damage", 5), trait("anti_magic", 2)],
    vulnerabilities: [
      trait("melee_commit", 4),
      trait("cooldown_reliant", 4),
      trait("waveclear_weak", 3),
      trait("fragile", 2),
    ],
  }),
  profile("hwei", "draft", 1, {
    notes: "Artillery control mage profile with broad poke, waveclear, and utility but low mobility.",
    strengths: [trait("poke", 5), trait("waveclear", 4), trait("reliable_cc", 3), trait("burst_damage", 3)],
    vulnerabilities: [trait("immobile", 5), trait("fragile", 3), trait("cooldown_reliant", 3)],
  }),
  profile("malphite", "draft", 1, {
    notes: "Mid flex engage profile with reliable initiation and anti-physical trading, but low wave agency.",
    strengths: [trait("reliable_cc", 5), trait("anti_dash", 3), trait("burst_damage", 3)],
    vulnerabilities: [
      trait("cooldown_reliant", 4),
      trait("waveclear_weak", 3),
      trait("short_range", 3),
      trait("early_weakness", 2),
    ],
  }),
  profile("veigar", "draft", 1, {
    notes: "Scaling cage mage profile with burst and zone control but punishable early tempo.",
    strengths: [trait("scaling", 5), trait("burst_damage", 4), trait("reliable_cc", 4), trait("waveclear", 3)],
    vulnerabilities: [trait("immobile", 4), trait("early_weakness", 4), trait("cooldown_reliant", 3)],
  }),
  profile("akshan", "draft", 1, {
    notes: "Ranged roaming marksman profile with lane poke, swing mobility, and reset pressure.",
    strengths: [trait("poke", 4), trait("mobility", 4), trait("sustained_damage", 3), trait("waveclear", 2)],
    vulnerabilities: [trait("mobility_reliant", 4), trait("cooldown_reliant", 3), trait("fragile", 3)],
  }),
  profile("anivia", "draft", 1, {
    notes: "Immobile control mage profile with strong waveclear, scaling, and reliable zone control.",
    strengths: [trait("waveclear", 5), trait("reliable_cc", 4), trait("scaling", 4), trait("burst_damage", 3)],
    vulnerabilities: [trait("immobile", 5), trait("early_weakness", 3), trait("cooldown_reliant", 3)],
  }),
  profile("aurelionsol", "draft", 1, {
    notes: "Late-scaling battlemage profile with strong wave control but punishable early lane states.",
    strengths: [trait("scaling", 5), trait("waveclear", 4), trait("sustained_damage", 4), trait("poke", 2)],
    vulnerabilities: [trait("early_weakness", 5), trait("immobile", 3), trait("cooldown_reliant", 3)],
  }),
  profile("aurora", "draft", 1, {
    notes: "Mobile short-range mage profile with burst windows and repositioning dependence.",
    strengths: [trait("mobility", 4), trait("burst_damage", 4), trait("sustained_damage", 3), trait("poke", 2)],
    vulnerabilities: [trait("short_range", 4), trait("mobility_reliant", 3), trait("cooldown_reliant", 3)],
  }),
  profile("azir", "draft", 1, {
    notes: "Scaling control mage profile with sustained soldier damage and wave control.",
    strengths: [trait("scaling", 5), trait("sustained_damage", 5), trait("waveclear", 4), trait("mobility", 2)],
    vulnerabilities: [trait("early_weakness", 4), trait("cooldown_reliant", 3), trait("fragile", 3)],
  }),
  profile("cassiopeia", "draft", 1, {
    notes: "Short-range sustained DPS mage profile with anti-dash threat and low repositioning.",
    strengths: [trait("sustained_damage", 5), trait("anti_dash", 4), trait("scaling", 4), trait("reliable_cc", 2)],
    vulnerabilities: [trait("short_range", 4), trait("immobile", 4), trait("cooldown_reliant", 2)],
  }),
  profile("corki", "draft", 1, {
    notes: "Scaling poke marksman profile with package-era burst windows and cooldown dependence.",
    strengths: [trait("poke", 4), trait("scaling", 4), trait("burst_damage", 3), trait("mobility", 2)],
    vulnerabilities: [trait("cooldown_reliant", 3), trait("early_weakness", 3), trait("fragile", 3)],
  }),
  profile("diana", "draft", 1, {
    notes: "Melee AP diver profile with burst engage and committed dash access.",
    strengths: [trait("burst_damage", 4), trait("mobility", 4), trait("sustained_damage", 3), trait("waveclear", 3)],
    vulnerabilities: [trait("dash_reliant", 4), trait("melee_commit", 4), trait("cooldown_reliant", 3)],
  }),
  profile("ekko", "draft", 1, {
    notes: "Mobile AP skirmisher profile with burst trades, late scaling, and cooldown windows.",
    strengths: [trait("mobility", 5), trait("burst_damage", 4), trait("scaling", 3), trait("waveclear", 3)],
    vulnerabilities: [trait("mobility_reliant", 4), trait("cooldown_reliant", 4), trait("melee_commit", 3)],
  }),
  profile("galio", "draft", 1, {
    notes: "Anti-magic control tank profile with reliable crowd control and roam support.",
    strengths: [trait("anti_magic", 5), trait("reliable_cc", 4), trait("waveclear", 3), trait("burst_damage", 2)],
    vulnerabilities: [trait("short_range", 3), trait("cooldown_reliant", 3), trait("early_weakness", 2)],
  }),
  profile("irelia", "draft", 1, {
    notes: "Dash-reliant melee skirmisher profile with sustained damage and wave-dependent access.",
    strengths: [trait("mobility", 5), trait("sustained_damage", 5), trait("burst_damage", 3)],
    vulnerabilities: [
      trait("dash_reliant", 5),
      trait("melee_commit", 4),
      trait("mobility_reliant", 4),
      trait("cooldown_reliant", 2),
    ],
  }),
  profile("lux", "draft", 1, {
    notes: "Long-range pick mage profile with poke, waveclear, and fragile immobile spacing.",
    strengths: [trait("poke", 5), trait("burst_damage", 4), trait("reliable_cc", 3), trait("waveclear", 3)],
    vulnerabilities: [trait("immobile", 5), trait("fragile", 4), trait("cooldown_reliant", 3)],
  }),
  profile("mel", "draft", 1, {
    notes: "Ranged mage profile with poke pressure, projectile defense, and cooldown-reliant trades.",
    strengths: [trait("poke", 4), trait("burst_damage", 4), trait("waveclear", 3), trait("reliable_cc", 2)],
    vulnerabilities: [trait("cooldown_reliant", 4), trait("fragile", 3), trait("immobile", 3)],
  }),
  profile("naafiri", "draft", 1, {
    notes: "Melee AD assassin profile with pack poke and highly committed dash engage.",
    strengths: [trait("burst_damage", 4), trait("mobility", 4), trait("poke", 2), trait("sustained_damage", 2)],
    vulnerabilities: [
      trait("dash_reliant", 4),
      trait("melee_commit", 5),
      trait("mobility_reliant", 3),
      trait("fragile", 3),
    ],
  }),
  profile("neeko", "draft", 1, {
    notes: "Pick mage profile with reliable crowd control, burst setup, and moderate wave control.",
    strengths: [trait("reliable_cc", 4), trait("burst_damage", 4), trait("waveclear", 3), trait("poke", 3)],
    vulnerabilities: [trait("cooldown_reliant", 3), trait("short_range", 3), trait("fragile", 3)],
  }),
  profile("qiyana", "draft", 1, {
    notes: "Mobile terrain assassin profile with burst windows and committed melee entries.",
    strengths: [trait("mobility", 5), trait("burst_damage", 5), trait("reliable_cc", 2)],
    vulnerabilities: [
      trait("melee_commit", 4),
      trait("cooldown_reliant", 4),
      trait("mobility_reliant", 4),
      trait("waveclear_weak", 3),
    ],
  }),
  profile("ryze", "draft", 1, {
    notes: "Shorter-range scaling battlemage profile with wave control and sustained spell damage.",
    strengths: [trait("scaling", 5), trait("sustained_damage", 4), trait("waveclear", 4), trait("point_and_click_cc", 2)],
    vulnerabilities: [trait("short_range", 4), trait("early_weakness", 3), trait("cooldown_reliant", 2)],
  }),
  profile("taliyah", "draft", 1, {
    notes: "Roaming control mage profile with anti-dash tools, poke, and waveclear.",
    strengths: [trait("anti_dash", 4), trait("poke", 4), trait("waveclear", 4), trait("reliable_cc", 3)],
    vulnerabilities: [trait("immobile", 4), trait("cooldown_reliant", 3), trait("fragile", 3)],
  }),
  profile("talon", "draft", 1, {
    notes: "Roaming AD assassin profile with burst access and weak sustained wave states.",
    strengths: [trait("mobility", 4), trait("burst_damage", 5), trait("waveclear", 3)],
    vulnerabilities: [trait("melee_commit", 4), trait("cooldown_reliant", 4), trait("waveclear_weak", 3)],
  }),
  profile("twistedfate", "draft", 1, {
    notes: "Roaming utility mage profile with point-and-click pick tools and low combat mobility.",
    strengths: [trait("point_and_click_cc", 5), trait("waveclear", 4), trait("reliable_cc", 3), trait("poke", 2)],
    vulnerabilities: [trait("immobile", 4), trait("fragile", 3), trait("cooldown_reliant", 3)],
  }),
  profile("vladimir", "draft", 1, {
    notes: "Late-scaling short-range battlemage profile with sustained damage and weak early pressure.",
    strengths: [trait("scaling", 5), trait("sustained_damage", 4), trait("anti_magic", 2), trait("burst_damage", 2)],
    vulnerabilities: [trait("early_weakness", 4), trait("short_range", 4), trait("cooldown_reliant", 3)],
  }),
  profile("xerath", "draft", 1, {
    notes: "Artillery mage profile with extreme poke and waveclear but very low mobility.",
    strengths: [trait("poke", 5), trait("waveclear", 4), trait("burst_damage", 3), trait("scaling", 2)],
    vulnerabilities: [trait("immobile", 5), trait("fragile", 4), trait("cooldown_reliant", 3)],
  }),
  profile("ziggs", "draft", 1, {
    notes: "Artillery waveclear mage profile with poke siege pressure and fragile immobile spacing.",
    strengths: [trait("waveclear", 5), trait("poke", 5), trait("burst_damage", 3), trait("scaling", 2)],
    vulnerabilities: [trait("immobile", 5), trait("fragile", 3), trait("cooldown_reliant", 3)],
  }),
  profile("zoe", "draft", 1, {
    notes: "Long-range pick mage profile with burst poke and cooldown-dependent bubble setups.",
    strengths: [trait("poke", 5), trait("burst_damage", 5), trait("reliable_cc", 3)],
    vulnerabilities: [trait("fragile", 4), trait("cooldown_reliant", 4), trait("waveclear_weak", 3)],
  }),
] as const satisfies readonly CounterRankingV2ChampionProfile[];

export const counterRankingV2ChampionProfilesById = new Map(
  counterRankingV2ChampionProfiles.map((championProfile) => [
    championProfile.championId,
    championProfile,
  ] as const),
);

export function getCounterRankingV2ChampionProfile(
  championId: string,
  profileStatusesByChampionId?: CounterRankingV2ProfileStatusByChampionId,
  profileOverridesByChampionId?: CounterRankingV2ProfileByChampionId,
  role: LeagueRole | string = "mid",
) {
  const normalizedChampionId = normalizeChampionId(championId);
  const normalizedRole = normalizeCounterRankingV2ProfileRole(role);
  const profileKey = getCounterRankingV2ProfileKey(normalizedChampionId, normalizedRole);
  const profile = counterRankingV2ChampionProfilesById.get(normalizedChampionId) ?? null;
  const profileOverride = profileOverridesByChampionId?.get(profileKey);

  if (!profile) {
    if (!profileOverride) {
      return null;
    }

    const reviewedStatus = profileStatusesByChampionId?.get(profileKey);
    const normalizedProfile = normalizeCounterRankingV2ChampionProfileTraits(profileOverride);

    return reviewedStatus ? { ...normalizedProfile, reviewStatus: reviewedStatus } : normalizedProfile;
  }

  const reviewedStatus = profileStatusesByChampionId?.get(profileKey);
  const mergedProfile = profileOverride
    ? {
        ...profile,
        ...profileOverride,
        championId: profile.championId,
        role: normalizedRole,
        supportedRoles: profileOverride.supportedRoles.length > 0 ? profileOverride.supportedRoles : profile.supportedRoles,
      }
    : { ...profile, role: normalizedRole };
  const normalizedProfile = normalizeCounterRankingV2ChampionProfileTraits(mergedProfile);

  return reviewedStatus ? { ...normalizedProfile, reviewStatus: reviewedStatus } : normalizedProfile;
}

export function createCounterRankingV2GeneratedDraftChampionProfile(
  championId: string,
  role: LeagueRole = "mid",
): CounterRankingV2ChampionProfile {
  return {
    championId: championId.trim(),
    identitySummary: "Generated draft mechanical profile awaiting admin review.",
    knownStrengths: [],
    knownWeaknesses: [],
    notes: "Generated draft mechanical profile awaiting admin review.",
    reviewStatus: "draft",
    role,
    strengths: [],
    supportedRoles: [role],
    vulnerabilities: [],
    version: counterRankingV2GeneratedDraftProfileVersion,
  };
}

export function isCounterRankingV2ProfileEligibleForDraftImprovement({
  hasAdminNote = false,
  profile,
}: {
  hasAdminNote?: boolean;
  profile: CounterRankingV2ChampionProfile;
}) {
  if (profile.reviewStatus === "reviewed" || hasAdminNote) {
    return false;
  }

  return (
    profile.reviewStatus === "draft" ||
    (profile.reviewStatus === "needs_revision" &&
      profile.strengths.length === 0 &&
      profile.vulnerabilities.length === 0)
  );
}

export function createCounterRankingV2ImprovedDraftProfileSuggestion({
  currentProfile,
  knowledge = null,
  reviewedProfiles = [],
}: {
  currentProfile: CounterRankingV2ChampionProfile;
  knowledge?: CounterRankingV2DraftProfileKnowledgeInput | null;
  reviewedProfiles?: readonly CounterRankingV2ChampionProfile[];
}): CounterRankingV2DraftProfileSuggestion {
  const normalizedCurrentProfile = normalizeCounterRankingV2ChampionProfileTraits(currentProfile);
  const championName = knowledge?.name?.trim() || normalizedCurrentProfile.championId;
  const sourceText = getCounterRankingV2DraftKnowledgeText(knowledge);
  const strengthScores = new Map<CounterRankingV2TraitId, number>();
  const weaknessScores = new Map<CounterRankingV2TraitId, number>();
  const explanation: string[] = [];
  const uncertaintyNotes: string[] = [];

  addCounterRankingV2DraftTrait(strengthScores, "reliable_cc", 5, {
    explanation,
    isStrength: true,
    reason: "Hard crowd control or pick setup appears in the champion profile.",
    role: normalizedCurrentProfile.role,
    sourceText,
    tokenPattern: /\b(?:stun|root|knockup|knock up|suppress|taunt|charm|hook|pull|cc|crowd control|lockdown)\b/i,
  });
  addCounterRankingV2DraftTrait(strengthScores, "point_and_click_cc", 4, {
    explanation,
    isStrength: true,
    reason: "Point-and-click or unavoidable lockdown language appears in the champion profile.",
    role: normalizedCurrentProfile.role,
    sourceText,
    tokenPattern: /\b(?:point-and-click|targeted|suppression|suppress)\b/i,
  });
  addCounterRankingV2DraftTrait(strengthScores, "engage", 5, {
    explanation,
    isStrength: true,
    reason: "Engage or initiation is part of the champion identity.",
    role: normalizedCurrentProfile.role,
    sourceText,
    tokenPattern: /\b(?:engage|initiat|dive|flank|hook|pick setup|start fights?)\b/i,
  });
  addCounterRankingV2DraftTrait(strengthScores, "disengage", 4, {
    explanation,
    isStrength: true,
    reason: "Peel, reset, or disengage tools are present in the champion identity.",
    role: normalizedCurrentProfile.role,
    sourceText,
    tokenPattern: /\b(?:disengage|peel|reset fights?|interrupt|knock away|protect)\b/i,
  });
  addCounterRankingV2DraftTrait(strengthScores, "all_in_threat", 5, {
    explanation,
    isStrength: true,
    reason: "All-in, burst, dive, or kill-window language appears in the champion profile.",
    role: normalizedCurrentProfile.role,
    sourceText,
    tokenPattern: /\b(?:all-in|all in|kill window|burst combo|assassin|dive)\b/i,
  });
  addCounterRankingV2DraftTrait(strengthScores, "burst_damage", 4, {
    explanation,
    isStrength: true,
    reason: "Burst damage is part of the champion pattern.",
    role: normalizedCurrentProfile.role,
    sourceText,
    tokenPattern: /\b(?:burst|execute|one-shot|oneshot|combo)\b/i,
  });
  addCounterRankingV2DraftTrait(strengthScores, "poke", 4, {
    explanation,
    isStrength: true,
    reason: "Poke, long-range chip, or harassment appears in the champion profile.",
    role: normalizedCurrentProfile.role,
    sourceText,
    tokenPattern: /\b(?:poke|harass|long-range|long range|artillery|chip)\b/i,
  });
  addCounterRankingV2DraftTrait(strengthScores, "waveclear", 4, {
    explanation,
    isStrength: true,
    reason: "Waveclear or fast wave control appears in the champion profile.",
    role: normalizedCurrentProfile.role,
    sourceText,
    tokenPattern: /\b(?:waveclear|wave clear|clear waves?|push waves?|lane pressure)\b/i,
  });
  addCounterRankingV2DraftTrait(strengthScores, "roaming", 4, {
    explanation,
    isStrength: true,
    reason: "Roam, map movement, or side-lane impact appears in the champion profile.",
    role: normalizedCurrentProfile.role,
    sourceText,
    tokenPattern: /\b(?:roam|map movement|side lanes?|global|rotate)\b/i,
  });
  addCounterRankingV2DraftTrait(strengthScores, "sustain", 4, {
    explanation,
    isStrength: true,
    reason: "Healing, shielding, or extended-trade recovery appears in the champion profile.",
    role: normalizedCurrentProfile.role,
    sourceText,
    tokenPattern: /\b(?:sustain|heal|healing|shield|lifesteal|life steal|durability)\b/i,
  });
  addCounterRankingV2DraftTrait(strengthScores, "scaling", 4, {
    explanation,
    isStrength: true,
    reason: "Scaling or late-game payoff is part of the champion identity.",
    role: normalizedCurrentProfile.role,
    sourceText,
    tokenPattern: /\b(?:scaling|late game|late-game|stack|scale)\b/i,
  });
  addCounterRankingV2DraftTrait(strengthScores, "strong_early", 4, {
    explanation,
    isStrength: true,
    reason: "Early pressure or snowball language appears in the champion profile.",
    role: normalizedCurrentProfile.role,
    sourceText,
    tokenPattern: /\b(?:early pressure|strong early|snowball|lane bully|early skirmish)\b/i,
  });

  if (knowledge?.mobilityLevel === "high" || knowledge?.mobilityLevel === "very_high") {
    setCounterRankingV2DraftTraitScore(strengthScores, "mobility", 5, normalizedCurrentProfile.role);
    explanation.push("Mobility rating suggests Mobility as a key strength.");
  }

  if (knowledge?.hardCrowdControl && knowledge.hardCrowdControl.length > 0) {
    setCounterRankingV2DraftTraitScore(strengthScores, "reliable_cc", 5, normalizedCurrentProfile.role);
  }

  if (knowledge?.sustain?.some((item) => item.trim())) {
    setCounterRankingV2DraftTraitScore(strengthScores, "sustain", 4, normalizedCurrentProfile.role);
  }

  addCounterRankingV2DraftTrait(weaknessScores, "immobile", 5, {
    explanation,
    isStrength: false,
    reason: "Low mobility or no-dash language appears in the champion profile.",
    role: normalizedCurrentProfile.role,
    sourceText,
    tokenPattern: /\b(?:immobile|no dash|no mobility|limited mobility|low mobility)\b/i,
  });
  addCounterRankingV2DraftTrait(weaknessScores, "fragile", 4, {
    explanation,
    isStrength: false,
    reason: "Fragile, squishy, or burst-vulnerable wording appears in the champion profile.",
    role: normalizedCurrentProfile.role,
    sourceText,
    tokenPattern: /\b(?:fragile|squishy|low durability|burst down|vulnerable to burst)\b/i,
  });
  addCounterRankingV2DraftTrait(weaknessScores, "cooldown_reliant", 4, {
    explanation,
    isStrength: false,
    reason: "The profile calls out downtime or key cooldown dependency.",
    role: normalizedCurrentProfile.role,
    sourceText,
    tokenPattern: /\b(?:cooldown|downtime|when .* down|misses key|key ability)\b/i,
  });
  addCounterRankingV2DraftTrait(weaknessScores, "short_range", 4, {
    explanation,
    isStrength: false,
    reason: "Short range or needing to stand close appears in the champion profile.",
    role: normalizedCurrentProfile.role,
    sourceText,
    tokenPattern: /\b(?:short range|short-range|melee range|low range)\b/i,
  });
  addCounterRankingV2DraftTrait(weaknessScores, "vulnerable_to_all_in", 4, {
    explanation,
    isStrength: false,
    reason: "The profile mentions being punishable by direct commits or all-ins.",
    role: normalizedCurrentProfile.role,
    sourceText,
    tokenPattern: /\b(?:vulnerable to all-in|weak to all-in|direct engage|hard engage|fast engage)\b/i,
  });
  addCounterRankingV2DraftTrait(weaknessScores, "weak_vs_poke", 4, {
    explanation,
    isStrength: false,
    reason: "Poke pressure is listed as a weakness.",
    role: normalizedCurrentProfile.role,
    sourceText,
    tokenPattern: /\b(?:poked out|weak .* poke|long-range poke|vulnerable to poke)\b/i,
  });
  addCounterRankingV2DraftTrait(weaknessScores, "weak_vs_waveclear", 3, {
    explanation,
    isStrength: false,
    reason: "Waveclear or wave pressure is listed as a weakness.",
    role: normalizedCurrentProfile.role,
    sourceText,
    tokenPattern: /\b(?:weak waveclear|poor waveclear|wave pressure|pushed in)\b/i,
  });
  addCounterRankingV2DraftTrait(weaknessScores, "no_engage", 3, {
    explanation,
    isStrength: false,
    reason: "The profile points to limited engage access.",
    role: normalizedCurrentProfile.role,
    sourceText,
    tokenPattern: /\b(?:no engage|limited engage|low engage|cannot start fights?)\b/i,
  });
  addCounterRankingV2DraftTrait(weaknessScores, "no_disengage", 3, {
    explanation,
    isStrength: false,
    reason: "The profile points to limited peel, reset, or disengage access.",
    role: normalizedCurrentProfile.role,
    sourceText,
    tokenPattern: /\b(?:no disengage|limited disengage|no peel|cannot reset)\b/i,
  });

  if (knowledge?.mobilityLevel === "none" || knowledge?.mobilityLevel === "low") {
    setCounterRankingV2DraftTraitScore(weaknessScores, "immobile", 5, normalizedCurrentProfile.role);
    explanation.push("Mobility rating suggests Immobile as a key weakness.");
  }

  if (normalizedCurrentProfile.role === "jungle") {
    applyCounterRankingV2JungleDraftSignals({
      explanation,
      jungleProfile: knowledge?.jungleProfile ?? null,
      strengthScores,
      weaknessScores,
    });
  }

  const similarReviewedProfiles = getSimilarCounterRankingV2ReviewedProfiles({
    reviewedProfiles,
    role: normalizedCurrentProfile.role,
    strengthScores,
    weaknessScores,
  });

  for (const example of similarReviewedProfiles.slice(0, 2)) {
    for (const strength of example.profile.strengths.slice(0, 2)) {
      setCounterRankingV2DraftTraitScore(strengthScores, strength.traitId, Math.min(5, strength.weight), normalizedCurrentProfile.role);
    }
    for (const vulnerability of example.profile.vulnerabilities.slice(0, 2)) {
      setCounterRankingV2DraftTraitScore(weaknessScores, vulnerability.traitId, Math.min(5, vulnerability.weight), normalizedCurrentProfile.role);
    }
  }

  const strengths = mergeCounterRankingV2DraftTraits(
    normalizedCurrentProfile.strengths,
    strengthScores,
    "strength",
    normalizedCurrentProfile.role,
    4,
  );
  const vulnerabilities = mergeCounterRankingV2DraftTraits(
    normalizedCurrentProfile.vulnerabilities,
    weaknessScores,
    "weakness",
    normalizedCurrentProfile.role,
    4,
  );

  if (strengths.length === 0) {
    uncertaintyNotes.push("No strong profile signals were found for strengths.");
  }

  if (vulnerabilities.length === 0) {
    uncertaintyNotes.push("No strong profile signals were found for weaknesses.");
  }

  if (!knowledge) {
    uncertaintyNotes.push("Champion knowledge profile was unavailable.");
  }

  if (!knowledge?.abilities || Object.keys(knowledge.abilities).length === 0) {
    uncertaintyNotes.push("Ability kit metadata was unavailable or incomplete.");
  }

  if (similarReviewedProfiles.length === 0) {
    uncertaintyNotes.push("No reviewed profile examples were available for this role.");
  }

  if (knowledge?.isCommonRole === false) {
    uncertaintyNotes.push("Selected role is not a primary/secondary champion role.");
  }

  const confidence = getCounterRankingV2DraftProfileConfidence({
    hasAbilityKit: Boolean(knowledge?.abilities && Object.keys(knowledge.abilities).length > 0),
    hasKnowledge: Boolean(knowledge),
    hasRoleMatch: knowledge?.isCommonRole !== false,
    similarReviewedProfileCount: similarReviewedProfiles.length,
    strengths,
    vulnerabilities,
  });
  const summary = `${championName} ${normalizedCurrentProfile.role} improved draft from champion knowledge, role context, and ${similarReviewedProfiles.length} reviewed example${similarReviewedProfiles.length === 1 ? "" : "s"}.`;
  const changes = getCounterRankingV2DraftProfileChanges({
    currentStrengths: normalizedCurrentProfile.strengths,
    currentWeaknesses: normalizedCurrentProfile.vulnerabilities,
    nextStrengths: strengths,
    nextWeaknesses: vulnerabilities,
  });

  return {
    changes,
    championId: normalizedCurrentProfile.championId,
    confidence,
    explanation: explanation.slice(0, 8),
    knownStrengths: getCounterRankingV2DraftKnownLines(knowledge, "strength", sourceText, strengths),
    knownWeaknesses: getCounterRankingV2DraftKnownLines(
      knowledge,
      "weakness",
      sourceText,
      vulnerabilities,
    ),
    proposedStatus: confidence === "low_draft_confidence" ? "needs_revision" : "draft",
    role: normalizedCurrentProfile.role,
    similarReviewedProfiles: similarReviewedProfiles.slice(0, 3).map(({ overlap, profile }) => ({
      championId: profile.championId,
      overlap,
      role: profile.role,
    })),
    summary,
    strengths,
    uncertaintyNotes,
    vulnerabilities,
  };
}

function normalizeCounterRankingV2ChampionProfileTraits(
  profile: CounterRankingV2ChampionProfile,
): CounterRankingV2ChampionProfile {
  return {
    ...profile,
    strengths: normalizeCounterRankingV2ProfileTraitList(profile.strengths),
    vulnerabilities: normalizeCounterRankingV2ProfileTraitList(profile.vulnerabilities),
  };
}

function normalizeCounterRankingV2ProfileTraitList(
  traits: readonly CounterRankingV2ProfileTrait[],
): CounterRankingV2ProfileTrait[] {
  const traitsById = new Map<CounterRankingV2TraitId, CounterRankingV2ProfileTrait>();

  for (const traitValue of traits) {
    const traitId = normalizeCounterRankingV2TraitId(traitValue.traitId);

    if (!traitId) {
      continue;
    }

    const weight = Number(traitValue.weight);
    const existingTrait = traitsById.get(traitId);
    const normalizedTrait = {
      traitId,
      weight: Number.isFinite(weight) ? weight : 0,
    };

    traitsById.set(
      traitId,
      existingTrait && existingTrait.weight > normalizedTrait.weight
        ? existingTrait
        : normalizedTrait,
    );
  }

  return Array.from(traitsById.values());
}

function getCounterRankingV2DraftKnowledgeText(
  knowledge: CounterRankingV2DraftProfileKnowledgeInput | null | undefined,
) {
  if (!knowledge) {
    return "";
  }

  return [
    knowledge.name,
    knowledge.identityText,
    knowledge.primaryTradingPattern,
    knowledge.mobilityLevel,
    knowledge.damageType,
    ...(knowledge.archetype ?? []),
    ...(knowledge.commonWeaknesses ?? []),
    ...(knowledge.dangerAbilities ?? []),
    ...(knowledge.hardCrowdControl ?? []),
    ...(knowledge.primaryWinCondition ?? []),
    ...(knowledge.shields ?? []),
    ...(knowledge.sustain ?? []),
    knowledge.strategicIdentity?.laneGoal,
    knowledge.strategicIdentity?.preferredGameLength,
    knowledge.strategicIdentity?.scalingProfile,
    ...(knowledge.strategicIdentity?.winMethod ?? []),
    ...Object.values(knowledge.abilities ?? {}),
  ]
    .filter((item): item is string => Boolean(item?.trim()))
    .join(" ");
}

function addCounterRankingV2DraftTrait(
  scores: Map<CounterRankingV2TraitId, number>,
  traitId: CounterRankingV2TraitId,
  weight: number,
  {
    explanation,
    isStrength,
    reason,
    role,
    sourceText,
    tokenPattern,
  }: {
    explanation: string[];
    isStrength: boolean;
    reason: string;
    role: LeagueRole;
    sourceText: string;
    tokenPattern: RegExp;
  },
) {
  if (!tokenPattern.test(sourceText)) {
    return;
  }

  if (!setCounterRankingV2DraftTraitScore(scores, traitId, weight, role)) {
    return;
  }

  explanation.push(
    `${isStrength ? "Strength" : "Weakness"} ${getCounterRankingV2TraitLabel(traitId)}: ${reason}`,
  );
}

function setCounterRankingV2DraftTraitScore(
  scores: Map<CounterRankingV2TraitId, number>,
  traitId: CounterRankingV2TraitId,
  weight: number,
  role: LeagueRole,
) {
  const definition = counterRankingV2TraitDefinitionsById.get(traitId);

  if (!definition || !isCounterRankingV2TraitDefinitionVisibleForRole(definition, role)) {
    return false;
  }

  scores.set(traitId, Math.max(scores.get(traitId) ?? 0, weight));
  return true;
}

function applyCounterRankingV2JungleDraftSignals({
  explanation,
  jungleProfile,
  strengthScores,
  weaknessScores,
}: {
  explanation: string[];
  jungleProfile: CounterRankingV2DraftProfileKnowledgeInput["jungleProfile"];
  strengthScores: Map<CounterRankingV2TraitId, number>;
  weaknessScores: Map<CounterRankingV2TraitId, number>;
}) {
  const clearRating = jungleProfile?.clearSpeed?.rating ?? null;
  const gankRating = jungleProfile?.gankThreat?.rating ?? null;
  const earlyRating = jungleProfile?.earlyGamePressure?.rating ?? null;
  const duelRating = jungleProfile?.dueling?.rating ?? null;
  const objectiveRating = jungleProfile?.objectiveControl?.rating ?? null;

  if (isHighCounterRankingV2JungleRating(clearRating)) {
    setCounterRankingV2DraftTraitScore(strengthScores, "strong_clear", 6, "jungle");
    explanation.push("Strength Strong clear: jungle clear speed is rated highly.");
  } else if (isLowCounterRankingV2JungleRating(clearRating)) {
    setCounterRankingV2DraftTraitScore(weaknessScores, "slow_first_clear", 4, "jungle");
    explanation.push("Weakness Slow first clear: jungle clear speed is rated low.");
  }

  if (isHighCounterRankingV2JungleRating(gankRating)) {
    setCounterRankingV2DraftTraitScore(strengthScores, "good_ganks", 6, "jungle");
    explanation.push("Strength Good ganks: jungle gank threat is rated highly.");
  } else if (isLowCounterRankingV2JungleRating(gankRating)) {
    setCounterRankingV2DraftTraitScore(weaknessScores, "weak_ganks_pre_6", 4, "jungle");
    explanation.push("Weakness Not good ganks pre 6: jungle gank threat is rated low.");
  }

  if (isHighCounterRankingV2JungleRating(earlyRating)) {
    setCounterRankingV2DraftTraitScore(strengthScores, "can_gank_early", 5, "jungle");
    explanation.push("Strength Can gank early: early jungle pressure is rated highly.");
  }

  if (
    isHighCounterRankingV2JungleRating(duelRating) ||
    isHighCounterRankingV2JungleRating(objectiveRating)
  ) {
    setCounterRankingV2DraftTraitScore(strengthScores, "can_contest_crab", 5, "jungle");
    explanation.push("Strength Can contest crab: duel/objective control supports river contests.");
  } else if (
    isLowCounterRankingV2JungleRating(duelRating) ||
    isLowCounterRankingV2JungleRating(objectiveRating)
  ) {
    setCounterRankingV2DraftTraitScore(weaknessScores, "difficult_to_contest_crab", 4, "jungle");
    explanation.push("Weakness Difficult to contest crab: duel/objective control is rated low.");
  }
}

function isHighCounterRankingV2JungleRating(value: string | null) {
  return value === "high" || value === "very_high";
}

function isLowCounterRankingV2JungleRating(value: string | null) {
  return value === "low" || value === "very_low";
}

function mergeCounterRankingV2DraftTraits(
  currentTraits: readonly CounterRankingV2ProfileTrait[],
  scores: Map<CounterRankingV2TraitId, number>,
  context: "strength" | "weakness",
  role: LeagueRole,
  maxTraits: number,
) {
  const traitsById = new Map<CounterRankingV2TraitId, CounterRankingV2ProfileTrait>();

  for (const traitValue of currentTraits) {
    const traitId = normalizeCounterRankingV2TraitId(traitValue.traitId);

    if (!traitId) {
      continue;
    }

    traitsById.set(traitId, {
      traitId,
      weight: Math.max(0, Math.min(10, Math.round(Number(traitValue.weight) || 0))),
    });
  }

  for (const [traitId, weight] of scores.entries()) {
    const definition = counterRankingV2TraitDefinitionsById.get(traitId);
    const isCorrectContext =
      context === "weakness"
        ? definition?.category === "vulnerability"
        : definition?.category !== "vulnerability";

    if (
      !definition ||
      !isCorrectContext ||
      !isCounterRankingV2TraitDefinitionVisibleForRole(definition, role)
    ) {
      continue;
    }

    const currentTrait = traitsById.get(traitId);
    traitsById.set(traitId, {
      traitId,
      weight: Math.max(currentTrait?.weight ?? 0, Math.round(weight)),
    });
  }

  return Array.from(traitsById.values())
    .filter((trait) => isTraitVisibleForDraftRole(trait.traitId, context, role))
    .sort((left, right) => right.weight - left.weight || left.traitId.localeCompare(right.traitId))
    .slice(0, maxTraits);
}

function isTraitVisibleForDraftRole(
  traitId: CounterRankingV2TraitId,
  context: "strength" | "weakness",
  role: LeagueRole,
) {
  const definition = counterRankingV2TraitDefinitionsById.get(traitId);

  if (!definition) {
    return false;
  }

  if (context === "weakness" && definition.category !== "vulnerability") {
    return false;
  }

  if (context === "strength" && definition.category === "vulnerability") {
    return false;
  }

  return isCounterRankingV2TraitDefinitionVisibleForRole(definition, role);
}

function getSimilarCounterRankingV2ReviewedProfiles({
  reviewedProfiles,
  role,
  strengthScores,
  weaknessScores,
}: {
  reviewedProfiles: readonly CounterRankingV2ChampionProfile[];
  role: LeagueRole;
  strengthScores: Map<CounterRankingV2TraitId, number>;
  weaknessScores: Map<CounterRankingV2TraitId, number>;
}) {
  const suggestedTraitIds = new Set([...strengthScores.keys(), ...weaknessScores.keys()]);

  return reviewedProfiles
    .filter((profile) => profile.reviewStatus === "reviewed" && profile.role === role)
    .map((profile) => {
      const overlap = [...profile.strengths, ...profile.vulnerabilities]
        .map((traitValue) => traitValue.traitId)
        .filter((traitId) => suggestedTraitIds.has(traitId));

      return {
        overlap,
        profile,
        score: overlap.length * 3 + profile.strengths.length + profile.vulnerabilities.length,
      };
    })
    .filter((example) => example.score > 0)
    .sort((left, right) => right.score - left.score || left.profile.championId.localeCompare(right.profile.championId));
}

function getCounterRankingV2DraftProfileConfidence({
  hasAbilityKit,
  hasKnowledge,
  hasRoleMatch,
  similarReviewedProfileCount,
  strengths,
  vulnerabilities,
}: {
  hasAbilityKit: boolean;
  hasKnowledge: boolean;
  hasRoleMatch: boolean;
  similarReviewedProfileCount: number;
  strengths: readonly CounterRankingV2ProfileTrait[];
  vulnerabilities: readonly CounterRankingV2ProfileTrait[];
}): CounterRankingV2DraftProfileConfidence {
  const score =
    (hasKnowledge ? 2 : 0) +
    (hasAbilityKit ? 1 : 0) +
    (hasRoleMatch ? 1 : 0) +
    Math.min(2, similarReviewedProfileCount) +
    (strengths.length >= 2 ? 1 : 0) +
    (vulnerabilities.length >= 2 ? 1 : 0);

  if (score >= 7) {
    return "high_draft_confidence";
  }

  if (score >= 4) {
    return "medium_draft_confidence";
  }

  return "low_draft_confidence";
}

function getCounterRankingV2DraftProfileChanges({
  currentStrengths,
  currentWeaknesses,
  nextStrengths,
  nextWeaknesses,
}: {
  currentStrengths: readonly CounterRankingV2ProfileTrait[];
  currentWeaknesses: readonly CounterRankingV2ProfileTrait[];
  nextStrengths: readonly CounterRankingV2ProfileTrait[];
  nextWeaknesses: readonly CounterRankingV2ProfileTrait[];
}): CounterRankingV2DraftProfileSuggestion["changes"] {
  const strengthChanges = getCounterRankingV2DraftTraitChanges(currentStrengths, nextStrengths);
  const weaknessChanges = getCounterRankingV2DraftTraitChanges(currentWeaknesses, nextWeaknesses);

  return {
    addedStrengths: strengthChanges.added,
    addedWeaknesses: weaknessChanges.added,
    changedStrengths: strengthChanges.changed,
    changedWeaknesses: weaknessChanges.changed,
    removedStrengths: strengthChanges.removed,
    removedWeaknesses: weaknessChanges.removed,
  };
}

function getCounterRankingV2DraftTraitChanges(
  currentTraits: readonly CounterRankingV2ProfileTrait[],
  nextTraits: readonly CounterRankingV2ProfileTrait[],
) {
  const currentById = new Map(currentTraits.map((traitValue) => [traitValue.traitId, traitValue]));
  const nextById = new Map(nextTraits.map((traitValue) => [traitValue.traitId, traitValue]));
  const added = nextTraits
    .filter((traitValue) => !currentById.has(traitValue.traitId))
    .map((traitValue) => traitValue.traitId);
  const removed = currentTraits
    .filter((traitValue) => !nextById.has(traitValue.traitId))
    .map((traitValue) => traitValue.traitId);
  const changed = nextTraits
    .filter((traitValue) => currentById.get(traitValue.traitId)?.weight !== undefined)
    .filter((traitValue) => currentById.get(traitValue.traitId)?.weight !== traitValue.weight)
    .map((traitValue) => traitValue.traitId);

  return {
    added,
    changed,
    removed,
  };
}

function getCounterRankingV2DraftKnownLines(
  knowledge: CounterRankingV2DraftProfileKnowledgeInput | null | undefined,
  context: "strength" | "weakness",
  sourceText: string,
  traits: readonly CounterRankingV2ProfileTrait[],
) {
  const sourceLines =
    context === "strength"
      ? [
          ...(knowledge?.archetype ?? []),
          ...(knowledge?.primaryWinCondition ?? []),
          ...(knowledge?.strategicIdentity?.winMethod ?? []),
        ]
      : [...(knowledge?.commonWeaknesses ?? [])];
  const traitLines = traits.map((traitValue) => getCounterRankingV2TraitLabel(traitValue.traitId));
  const fallbackLine =
    context === "strength"
      ? "Generated from champion identity and role-aware mechanical vocabulary."
      : "Generated from champion weaknesses and role-aware mechanical vocabulary.";

  return Array.from(new Set([...sourceLines, ...traitLines, sourceText ? fallbackLine : ""]))
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);
}

export function isCounterRankingV2SupportedChampion(championId: string) {
  return counterRankingV2ChampionProfilesById.has(normalizeChampionId(championId));
}

export function calculateMechanicalMatchupFit({
  candidateChampionId,
  enemyChampionId,
  profileOverridesByChampionId,
  profileStatusesByChampionId,
  role = null,
}: {
  candidateChampionId: string;
  enemyChampionId: string;
  profileOverridesByChampionId?: CounterRankingV2ProfileByChampionId;
  profileStatusesByChampionId?: CounterRankingV2ProfileStatusByChampionId;
  role?: LeagueRole | null;
}): CounterRankingV2MechanicalFitResult {
  const normalizedCandidateId = normalizeChampionId(candidateChampionId);
  const normalizedEnemyId = normalizeChampionId(enemyChampionId);
  const candidateProfile = getCounterRankingV2ChampionProfile(
    normalizedCandidateId,
    profileStatusesByChampionId,
    profileOverridesByChampionId,
    role ?? "mid",
  );
  const enemyProfile = getCounterRankingV2ChampionProfile(
    normalizedEnemyId,
    profileStatusesByChampionId,
    profileOverridesByChampionId,
    role ?? "mid",
  );

  if (!candidateProfile) {
    return emptyMechanicalFitResult({
      candidateChampionId: normalizedCandidateId,
      enemyChampionId: normalizedEnemyId,
      role,
      status: "missing_candidate_profile",
    });
  }

  if (!enemyProfile) {
    return emptyMechanicalFitResult({
      candidateChampionId: normalizedCandidateId,
      enemyChampionId: normalizedEnemyId,
      role,
      status: "missing_enemy_profile",
    });
  }

  if (
    candidateProfile.strengths.length === 0 ||
    candidateProfile.vulnerabilities.length === 0 ||
    enemyProfile.strengths.length === 0 ||
    enemyProfile.vulnerabilities.length === 0
  ) {
    return emptyMechanicalFitResult({
      candidateChampionId: normalizedCandidateId,
      enemyChampionId: normalizedEnemyId,
      role,
      status: "incomplete_profile",
    });
  }

  const factors = getMechanicalFitFactors(candidateProfile, enemyProfile);
  const rawScore = Number(
    factors.reduce((total, factor) => total + factor.contribution, 0).toFixed(4),
  );
  const maxRawScore = getMechanicalFitMaxRawScore(candidateProfile, enemyProfile);
  const score =
    maxRawScore > 0
      ? Math.min(100, Math.round(Math.sqrt(rawScore / maxRawScore) * 100))
      : 0;

  return {
    candidateChampionId: normalizedCandidateId,
    enemyChampionId: normalizedEnemyId,
    factors: factors.sort((left, right) => right.contribution - left.contribution),
    maxRawScore,
    rawScore,
    role,
    score,
    status: "calculated",
  };
}

export function getCounterRankingV2ComparisonRows({
  candidateChampionIds,
  enemyChampionId,
  observedByChampionId,
  profileOverridesByChampionId,
  profileStatusesByChampionId,
  reviewsByCandidateId = new Map(),
  role,
}: {
  candidateChampionIds: string[];
  enemyChampionId: string;
  observedByChampionId: Map<string, CounterRankingV2ObservedRankSnapshot>;
  profileOverridesByChampionId?: CounterRankingV2ProfileByChampionId;
  profileStatusesByChampionId?: CounterRankingV2ProfileStatusByChampionId;
  reviewsByCandidateId?: Map<string, CounterRankingV2MechanicalReview>;
  role: LeagueRole;
}): CounterRankingV2ComparisonRow[] {
  const { supportedRoleCandidatePool } = getCounterRankingV2SupportedRoleCandidatePool({
    candidateChampionIds,
    role,
  });
  const mechanicalRows = supportedRoleCandidatePool
    .map((candidateChampionId) => ({
      candidateChampionId: normalizeChampionId(candidateChampionId),
      mechanicalResult: calculateMechanicalMatchupFit({
        candidateChampionId,
        enemyChampionId,
        profileOverridesByChampionId,
        profileStatusesByChampionId,
        role,
      }),
    }))
    .filter((row) => row.candidateChampionId !== normalizeChampionId(enemyChampionId));
  const rankedMechanicalRows = [...mechanicalRows]
    .filter((row) => row.mechanicalResult.status === "calculated")
    .sort((left, right) => {
      if (left.mechanicalResult.score !== right.mechanicalResult.score) {
        return right.mechanicalResult.score - left.mechanicalResult.score;
      }

      return left.candidateChampionId.localeCompare(right.candidateChampionId);
    });
  const mechanicalRankByChampionId = new Map(
    rankedMechanicalRows.map((row, index) => [row.candidateChampionId, index + 1] as const),
  );

  return mechanicalRows
    .map((row) => {
      const mechanicalRank = mechanicalRankByChampionId.get(row.candidateChampionId) ?? null;
      const observed = observedByChampionId.get(row.candidateChampionId) ?? null;
      const rankDelta =
        observed?.rank && mechanicalRank ? observed.rank - mechanicalRank : null;
      const review = reviewsByCandidateId.get(row.candidateChampionId) ?? null;

      return {
        automationSuggestion: generateCounterRankingV2MechanicalSuggestion({
          mechanicalResult: row.mechanicalResult,
          observed,
          profileOverridesByChampionId,
          profileStatusesByChampionId,
          review,
        }),
        candidateChampionId: row.candidateChampionId,
        mechanicalRank,
        mechanicalResult: row.mechanicalResult,
        observed,
        review,
        rankDelta,
      };
    })
    .sort((left, right) => {
      const leftRank = left.mechanicalRank ?? Number.POSITIVE_INFINITY;
      const rightRank = right.mechanicalRank ?? Number.POSITIVE_INFINITY;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return left.candidateChampionId.localeCompare(right.candidateChampionId);
    });
}

export function generateCounterRankingV2MechanicalSuggestionsForRole({
  enemyChampionId,
  observedByChampionId,
  profileOverridesByChampionId,
  profileStatusesByChampionId,
  reviewsByCandidateId = new Map(),
  role,
}: {
  enemyChampionId: string;
  observedByChampionId: Map<string, CounterRankingV2ObservedRankSnapshot>;
  profileOverridesByChampionId?: CounterRankingV2ProfileByChampionId;
  profileStatusesByChampionId?: CounterRankingV2ProfileStatusByChampionId;
  reviewsByCandidateId?: Map<string, CounterRankingV2MechanicalReview>;
  role: LeagueRole;
}): CounterRankingV2ComparisonRow[] {
  const normalizedEnemyChampionId = normalizeChampionId(enemyChampionId);
  const allProfileCandidateIds = Array.from(
    new Set([
      ...counterRankingV2ChampionProfiles
        .filter((profile) => profile.championId !== normalizedEnemyChampionId)
        .map((profile) => profile.championId),
      ...Array.from(profileOverridesByChampionId?.values() ?? [])
        .filter((profile) => profile.championId !== normalizedEnemyChampionId)
        .map((profile) => profile.championId),
    ]),
  );
  const { supportedRoleCandidatePool } = getCounterRankingV2SupportedRoleCandidatePool({
    candidateChampionIds: allProfileCandidateIds,
    role,
  });

  return getCounterRankingV2ComparisonRows({
    candidateChampionIds: supportedRoleCandidatePool,
    enemyChampionId,
    observedByChampionId,
    profileOverridesByChampionId,
    profileStatusesByChampionId,
    reviewsByCandidateId,
    role,
  });
}

export function sortCounterRankingV2RowsByReviewPriority(
  rows: CounterRankingV2ComparisonRow[],
): CounterRankingV2ComparisonRow[] {
  return [...rows].sort((left, right) => {
    const leftReviewedPriority = getCounterRankingV2ReviewPriority(left);
    const rightReviewedPriority = getCounterRankingV2ReviewPriority(right);

    if (leftReviewedPriority !== rightReviewedPriority) {
      return leftReviewedPriority - rightReviewedPriority;
    }

    const leftScore = getCounterRankingV2ReviewPriorityScore(left);
    const rightScore = getCounterRankingV2ReviewPriorityScore(right);

    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    const leftRankDelta = Math.max(0, left.rankDelta ?? 0);
    const rightRankDelta = Math.max(0, right.rankDelta ?? 0);

    if (leftRankDelta !== rightRankDelta) {
      return rightRankDelta - leftRankDelta;
    }

    const leftMechanicalRank = left.mechanicalRank ?? Number.POSITIVE_INFINITY;
    const rightMechanicalRank = right.mechanicalRank ?? Number.POSITIVE_INFINITY;

    if (leftMechanicalRank !== rightMechanicalRank) {
      return leftMechanicalRank - rightMechanicalRank;
    }

    return left.candidateChampionId.localeCompare(right.candidateChampionId);
  });
}

function getCounterRankingV2ReviewPriority(row: CounterRankingV2ComparisonRow) {
  return row.review?.reviewStatus === undefined || row.review.reviewStatus === "unreviewed" ? 0 : 1;
}

function getCounterRankingV2ReviewPriorityScore(row: CounterRankingV2ComparisonRow) {
  if (row.review) {
    return row.review.finalMechanicalScore;
  }

  return row.mechanicalResult.status === "calculated" ? row.mechanicalResult.score : -1;
}

export function filterCounterRankingV2RowsByReviewFilter({
  filter,
  minimumGames,
  rows,
}: {
  filter: CounterRankingV2ReviewFilter;
  minimumGames: number;
  rows: CounterRankingV2ComparisonRow[];
}) {
  if (filter === "all") {
    return rows;
  }

  return rows.filter((row) =>
    isCounterRankingV2RowMatchingReviewFilter({
      filter,
      minimumGames,
      row,
    }),
  );
}

export function isCounterRankingV2RowMatchingReviewFilter({
  filter,
  minimumGames,
  row,
}: {
  filter: CounterRankingV2ReviewFilter;
  minimumGames: number;
  row: CounterRankingV2ComparisonRow;
}) {
  if (filter === "unreviewed") {
    return row.review === null || row.review.reviewStatus === "unreviewed";
  }

  if (filter === "public_eligible") {
    return isCounterRankingV2ReviewPublicEligible(row.review);
  }

  if (filter === "low_sample") {
    const observedGames = row.observed?.games ?? 0;

    return observedGames > 0 && observedGames < minimumGames;
  }

  if (filter === "high_mastery_required") {
    return Boolean(row.review?.highMasteryRequired);
  }

  if (isCounterRankingV2AutomationStatus(filter)) {
    return row.automationSuggestion?.automationStatus === filter;
  }

  return row.review?.reviewStatus === filter;
}

export function getCounterRankingV2FactorImpactLevel(
  factor: Pick<CounterRankingV2Factor, "contribution">,
): CounterRankingV2FactorImpactLevel {
  if (factor.contribution >= 12) {
    return "high";
  }

  if (factor.contribution >= 6) {
    return "medium";
  }

  return "low";
}

export function getCounterRankingV2MechanicalReasons(
  factors: CounterRankingV2Factor[],
  limit = 3,
): CounterRankingV2MechanicalReason[] {
  return factors.slice(0, limit).map((factor) => ({
    explanation: getCounterRankingV2FactorExplanation(factor),
    factor,
    impactLevel: getCounterRankingV2FactorImpactLevel(factor),
    title: getCounterRankingV2FactorTitle(factor),
  }));
}

export function hasCounterRankingV2WeakMechanicalSignal(
  factors: CounterRankingV2Factor[],
) {
  const topReasons = getCounterRankingV2MechanicalReasons(factors);

  return topReasons.length >= 3 && topReasons.every((reason) => reason.impactLevel === "low");
}

function getCounterRankingV2SuggestedStrength(
  score: number,
): CounterRankingV2SuggestedStrength {
  if (score >= 90) {
    return "hard_counter";
  }

  if (score >= 80) {
    return "strong_counter";
  }

  if (score >= 65) {
    return "soft_counter";
  }

  if (score >= 45) {
    return "neutral";
  }

  return "poor_fit";
}

function getCounterRankingV2ManualAutomationStatus(
  review: CounterRankingV2MechanicalReview | null | undefined,
): CounterRankingV2AutomationStatus | null {
  if (!review) {
    return null;
  }

  if (
    review.reviewStatus === "verified_strong_counter" ||
    review.reviewStatus === "verified_soft_counter"
  ) {
    return "manual_approved";
  }

  if (review.reviewStatus === "incorrect_suggestion" || review.reviewStatus === "not_a_counter") {
    return "manual_rejected";
  }

  return "needs_review";
}

function isCounterRankingV2AutoApprovalBlockedByReview(
  review: CounterRankingV2MechanicalReview | null | undefined,
) {
  return (
    review?.reviewStatus === "incorrect_suggestion" ||
    review?.reviewStatus === "not_a_counter" ||
    review?.reviewStatus === "needs_more_data"
  );
}

function isCounterRankingV2DeprecatedProfile(profile: CounterRankingV2ChampionProfile) {
  return String(profile.reviewStatus) === "deprecated";
}

function isCounterRankingV2HighMasteryCandidate(candidateProfile: CounterRankingV2ChampionProfile) {
  const masteryLevel =
    candidateProfile.masteryRequirement ??
    getChampionMasteryRequirementLevel(candidateProfile.championId);

  return masteryLevel === "high" || masteryLevel === "very_high";
}

function isCounterRankingV2ObservedContradiction({
  mechanicalResult,
  observed,
}: {
  mechanicalResult: CounterRankingV2MechanicalFitResult;
  observed: CounterRankingV2ObservedRankSnapshot | null;
}) {
  return (
    mechanicalResult.score >= 65 &&
    (observed?.games ?? 0) >= 20 &&
    observed?.winRate !== null &&
    observed?.winRate !== undefined &&
    observed.winRate < 48
  );
}

function isCounterRankingV2OneWeakFactorSignal(factors: CounterRankingV2Factor[]) {
  return (
    factors.length === 1 &&
    getCounterRankingV2FactorImpactLevel(factors[0]) === "low"
  );
}

function getCounterRankingV2AutomationConfidence({
  automationStatus,
  score,
}: {
  automationStatus: CounterRankingV2AutomationStatus;
  score: number;
}): CounterRankingV2AutomationConfidence {
  if (
    automationStatus === "auto_approval_candidate" ||
    automationStatus === "auto_suggested" ||
    automationStatus === "manual_approved"
  ) {
    return "high";
  }

  if (score >= 65) {
    return "medium";
  }

  return "low";
}

function isCounterRankingV2AutomationStatus(
  value: CounterRankingV2ReviewFilter,
): value is CounterRankingV2AutomationStatus {
  return (
    value === "auto_approval_candidate" ||
    value === "auto_approved" ||
    value === "auto_suggested" ||
    value === "manual_approved" ||
    value === "manual_rejected" ||
    value === "needs_review"
  );
}

function createEmptyCounterRankingV2AutomationBlockerSummary(): CounterRankingV2AutomationBlockerSummary {
  return {
    candidate_profile_generated_draft: 0,
    excluded_unsupported_candidate_role: 0,
    existing_manual_review_override: 0,
    high_mastery_candidate: 0,
    manually_rejected: 0,
    missing_profile: 0,
    observed_stat_contradiction: 0,
    other: 0,
    profile_deprecated: 0,
    profile_needs_revision: 0,
    score_below_auto_approval_threshold: 0,
    score_below_auto_suggested_threshold: 0,
    target_profile_generated_draft: 0,
    weak_one_factor_signal: 0,
  };
}

function getCounterRankingV2FactorTitle(factor: CounterRankingV2Factor) {
  const interactionKey = `${factor.candidateStrength}:${factor.enemyVulnerability}`;

  switch (interactionKey) {
    case "anti_dash:dash_reliant":
      return "Punishes dash commits";
    case "anti_dash:mobility_reliant":
      return "Removes mobility safety";
    case "anti_dash:melee_commit":
      return "Interrupts committed entries";
    case "point_and_click_cc:mobility_reliant":
      return "Locks down slippery targets";
    case "point_and_click_cc:dash_reliant":
      return "Stops dash resets";
    case "reliable_cc:melee_commit":
      return "Controls melee engages";
    case "reliable_cc:mobility_reliant":
      return "Makes mobility risky";
    case "suppression:mobility_reliant":
      return "Denies escape windows";
    case "suppression:fragile":
      return "Creates focus-fire windows";
    case "poke:short_range":
      return "Taxes short range";
    case "poke:waveclear_weak":
      return "Pressures weak waveclear";
    case "burst_damage:fragile":
      return "Threatens fragile targets";
    case "burst_damage:cooldown_reliant":
      return "Punishes cooldown windows";
    case "waveclear:waveclear_weak":
      return "Controls lane tempo";
    case "scaling:early_weakness":
      return "Scales through weak early pressure";
    case "scaling:falls_off_late":
      return "Outscales late falloff";
    case "scaling:weak_early":
      return "Scales through weak early pressure";
    case "strong_early:weak_early":
    case "strong_early:early_weakness":
      return "Punishes weak early lanes";
    case "all_in_threat:vulnerable_to_all_in":
      return "Forces decisive all-ins";
    case "disengage:gap_closing":
    case "disengage:melee_commit":
      return "Resets enemy commitment";
    case "sustain:weak_vs_sustain":
      return "Outlasts trade patterns";
    case "roaming:weak_vs_roaming":
      return "Punishes map-response gaps";
    case "sustained_damage:cooldown_reliant":
      return "Punishes cooldown downtime";
    case "anti_magic:burst_damage":
      return "Reduces burst threat";
    default:
      return `${getCounterRankingV2TraitLabel(
        factor.candidateStrength,
      )} targets ${getCounterRankingV2TraitLabel(factor.enemyVulnerability).toLowerCase()}`;
  }
}

function getCounterRankingV2FactorExplanation(factor: CounterRankingV2Factor) {
  return factor.reason;
}

function getCounterRankingV2TraitLabel(traitId: CounterRankingV2TraitId) {
  const normalizedTraitId = normalizeCounterRankingV2TraitId(traitId);

  return (
    (normalizedTraitId
      ? counterRankingV2TraitDefinitionsById.get(normalizedTraitId)?.label
      : null) ?? traitId
  );
}

export function generateCounterRankingV2MechanicalSuggestion({
  mechanicalResult,
  observed,
  profileOverridesByChampionId,
  profileStatusesByChampionId,
  review,
}: {
  mechanicalResult: CounterRankingV2MechanicalFitResult;
  observed: CounterRankingV2ObservedRankSnapshot | null;
  profileOverridesByChampionId?: CounterRankingV2ProfileByChampionId;
  profileStatusesByChampionId?: CounterRankingV2ProfileStatusByChampionId;
  review?: CounterRankingV2MechanicalReview | null;
}): CounterRankingV2MechanicalSuggestion | null {
  if (mechanicalResult.status !== "calculated") {
    return null;
  }

  const candidateProfile = getCounterRankingV2ChampionProfile(
    mechanicalResult.candidateChampionId,
    profileStatusesByChampionId,
    profileOverridesByChampionId,
    mechanicalResult.role ?? "mid",
  );
  const enemyProfile = getCounterRankingV2ChampionProfile(
    mechanicalResult.enemyChampionId,
    profileStatusesByChampionId,
    profileOverridesByChampionId,
    mechanicalResult.role ?? "mid",
  );

  if (!candidateProfile || !enemyProfile) {
    return null;
  }

  const suggestedStrength = getCounterRankingV2SuggestedStrength(mechanicalResult.score);
  const manualAutomationStatus = getCounterRankingV2ManualAutomationStatus(review);
  const hasHighMasteryBlocker = isCounterRankingV2HighMasteryCandidate(candidateProfile);
  const hasObservedContradiction = isCounterRankingV2ObservedContradiction({
    mechanicalResult,
    observed,
  });
  const hasOneWeakFactorSignal = isCounterRankingV2OneWeakFactorSignal(mechanicalResult.factors);
  const blockers: CounterRankingV2AutomationBlocker[] = [];
  const reasons: string[] = [];
  let automationStatus: CounterRankingV2AutomationStatus =
    mechanicalResult.score >= counterRankingV2AutoSuggestedScoreThreshold
      ? "auto_suggested"
      : "needs_review";

  if (manualAutomationStatus) {
    automationStatus = manualAutomationStatus;
    blockers.push({
      id: "existing_manual_review_override",
      message: "Existing manual review overrides automation.",
    });

    if (review?.reviewStatus === "incorrect_suggestion" || review?.reviewStatus === "not_a_counter") {
      blockers.push({
        id: "manually_rejected",
        message:
          review.reviewStatus === "not_a_counter"
            ? "Not a counter review row blocks automation."
            : "Manually rejected review row blocks automation.",
      });
    }

    reasons.push(...blockers.map((blocker) => blocker.message));
  } else {
    if (mechanicalResult.score < counterRankingV2AutoSuggestedScoreThreshold) {
      blockers.push({
        id: "score_below_auto_suggested_threshold",
        message: `Score ${mechanicalResult.score} is below auto_suggested threshold ${counterRankingV2AutoSuggestedScoreThreshold}.`,
      });
    }

    if (mechanicalResult.score < counterRankingV2AutoApprovalScoreThreshold) {
      blockers.push({
        id: "score_below_auto_approval_threshold",
        message: `Score ${mechanicalResult.score} is below auto_approval threshold ${counterRankingV2AutoApprovalScoreThreshold}.`,
      });
    }

    if (
      mechanicalResult.score >= counterRankingV2AutoApprovalScoreThreshold &&
      candidateProfile.reviewStatus === "reviewed" &&
      enemyProfile.reviewStatus === "reviewed" &&
      !hasHighMasteryBlocker &&
      !isCounterRankingV2AutoApprovalBlockedByReview(review) &&
      !hasObservedContradiction &&
      !hasOneWeakFactorSignal
    ) {
      automationStatus = "auto_approval_candidate";
      reasons.push("Safe high-score suggestion is eligible for batch auto-approval review.");
    }

    if (enemyProfile.reviewStatus === "draft") {
      blockers.push({
        id: "target_profile_generated_draft",
        message: "Target profile is generated_draft.",
      });
    }

    if (candidateProfile.reviewStatus === "draft") {
      blockers.push({
        id: "candidate_profile_generated_draft",
        message: "Candidate profile is generated_draft.",
      });
    }

    if (
      candidateProfile.reviewStatus === "needs_revision" ||
      enemyProfile.reviewStatus === "needs_revision"
    ) {
      blockers.push({
        id: "profile_needs_revision",
        message: "Profile needs_revision requires admin review.",
      });
    }

    if (
      isCounterRankingV2DeprecatedProfile(candidateProfile) ||
      isCounterRankingV2DeprecatedProfile(enemyProfile)
    ) {
      blockers.push({
        id: "profile_deprecated",
        message: "Deprecated profile requires admin review.",
      });
    }

    if (candidateProfile.reviewStatus !== "reviewed" || enemyProfile.reviewStatus !== "reviewed") {
      automationStatus = "needs_review";
    }

    if (hasHighMasteryBlocker) {
      automationStatus = "needs_review";
      blockers.push({
        id: "high_mastery_candidate",
        message: "High mastery candidate requires manual review.",
      });
    }

    if (hasObservedContradiction) {
      automationStatus = "needs_review";
      blockers.push({
        id: "observed_stat_contradiction",
        message: "Observed stats strongly contradict the mechanical suggestion.",
      });
    }

    if (hasOneWeakFactorSignal) {
      automationStatus = "needs_review";
      blockers.push({
        id: "weak_one_factor_signal",
        message: "Weak one-factor signal requires manual review.",
      });
    }

    if (
      mechanicalResult.score >= counterRankingV2NeedsReviewScoreThreshold &&
      mechanicalResult.score < counterRankingV2AutoSuggestedScoreThreshold
    ) {
      automationStatus = "needs_review";
    }

    if (automationStatus === "needs_review" && blockers.length === 0) {
      blockers.push({
        id: "other",
        message: "Other automation guardrail requires manual review.",
      });
    }

    reasons.push(...blockers.map((blocker) => blocker.message));
  }

  if (reasons.length === 0) {
    reasons.push("High mechanical score from reviewed profiles is auto-suggested for admin review.");
  }

  return {
    automationStatus,
    blockers,
    confidence: getCounterRankingV2AutomationConfidence({
      automationStatus,
      score: mechanicalResult.score,
    }),
    factors: mechanicalResult.factors,
    reasons,
    score: mechanicalResult.score,
    suggestedStrength,
  };
}

export function getCounterRankingV2AutomationBlockerSummary(
  rows: CounterRankingV2ComparisonRow[],
): CounterRankingV2AutomationBlockerSummary {
  return rows.reduce<CounterRankingV2AutomationBlockerSummary>(
    (summary, row) => {
      const blockers = row.automationSuggestion?.blockers ?? [];

      if (blockers.length > 0) {
        for (const blocker of blockers) {
          summary[blocker.id] += 1;
        }

        return summary;
      }

      if (
        row.mechanicalResult.status === "missing_candidate_profile" ||
        row.mechanicalResult.status === "missing_enemy_profile"
      ) {
        summary.missing_profile += 1;
        return summary;
      }

      if (!row.automationSuggestion && row.mechanicalResult.status !== "calculated") {
        summary.other += 1;
      }

      return summary;
    },
    createEmptyCounterRankingV2AutomationBlockerSummary(),
  );
}

export function getCounterRankingV2AutomationSummary(
  rows: CounterRankingV2ComparisonRow[],
): CounterRankingV2AutomationSummary {
  return rows.reduce<CounterRankingV2AutomationSummary>(
    (summary, row) => {
      const automationStatus = row.automationSuggestion?.automationStatus;

      if (!automationStatus) {
        return summary;
      }

      return {
        autoApprovalCandidates:
          summary.autoApprovalCandidates +
          (automationStatus === "auto_approval_candidate" ? 1 : 0),
        autoApproved: summary.autoApproved + (automationStatus === "auto_approved" ? 1 : 0),
        autoSuggested: summary.autoSuggested + (automationStatus === "auto_suggested" ? 1 : 0),
        generatedSuggestions: summary.generatedSuggestions + 1,
        manualApproved: summary.manualApproved + (automationStatus === "manual_approved" ? 1 : 0),
        manualRejected: summary.manualRejected + (automationStatus === "manual_rejected" ? 1 : 0),
        needsReview: summary.needsReview + (automationStatus === "needs_review" ? 1 : 0),
      };
    },
    {
      autoApprovalCandidates: 0,
      autoApproved: 0,
      autoSuggested: 0,
      generatedSuggestions: 0,
      manualApproved: 0,
      manualRejected: 0,
      needsReview: 0,
    },
  );
}

export function getCounterRankingV2ReviewProgressSummary(
  rows: CounterRankingV2ComparisonRow[],
): CounterRankingV2ReviewProgressSummary {
  return rows.reduce<CounterRankingV2ReviewProgressSummary>(
    (summary, row) => {
      const reviewStatus = row.review?.reviewStatus ?? "unreviewed";
      const isUnreviewed = row.review === null || reviewStatus === "unreviewed";

      return {
        highMasteryRequired:
          summary.highMasteryRequired + (row.review?.highMasteryRequired ? 1 : 0),
        incorrectSuggestions:
          summary.incorrectSuggestions + (reviewStatus === "incorrect_suggestion" ? 1 : 0),
        needsMoreData: summary.needsMoreData + (reviewStatus === "needs_more_data" ? 1 : 0),
        notCounters: summary.notCounters + (reviewStatus === "not_a_counter" ? 1 : 0),
        publicEligible:
          summary.publicEligible + (isCounterRankingV2ReviewPublicEligible(row.review) ? 1 : 0),
        reviewed: summary.reviewed + (isUnreviewed ? 0 : 1),
        total: summary.total + 1,
        unreviewed: summary.unreviewed + (isUnreviewed ? 1 : 0),
        verifiedSoftCounters:
          summary.verifiedSoftCounters + (reviewStatus === "verified_soft_counter" ? 1 : 0),
        verifiedStrongCounters:
          summary.verifiedStrongCounters + (reviewStatus === "verified_strong_counter" ? 1 : 0),
      };
    },
    {
      highMasteryRequired: 0,
      incorrectSuggestions: 0,
      needsMoreData: 0,
      notCounters: 0,
      publicEligible: 0,
      reviewed: 0,
      total: 0,
      unreviewed: 0,
      verifiedSoftCounters: 0,
      verifiedStrongCounters: 0,
    },
  );
}

export function getCounterRankingV2PublicPreviewRows({
  minimumGames,
  rows,
}: {
  minimumGames: number;
  rows: CounterRankingV2ComparisonRow[];
}): CounterRankingV2PublicPreviewRow[] {
  return rows
    .filter((row) => isCounterRankingV2ApprovedReviewPublicEligible(row.review))
    .filter((row) =>
      isChampionSupportedInRole(row.candidateChampionId, row.mechanicalResult.role ?? "mid"),
    )
    .map((row) => ({
      candidateChampionId: row.candidateChampionId,
      confidenceLabel: row.observed?.confidence.shortLabel ?? "No data",
      currentPublicRank: row.observed?.rank ?? null,
      finalReviewedScore: row.review?.finalMechanicalScore ?? 0,
      highMasteryRequired: Boolean(row.review?.highMasteryRequired),
      isLowSampleDesignCounter: (row.observed?.games ?? 0) < minimumGames,
      observedGames: row.observed?.games ?? null,
      reviewStatus: row.review?.reviewStatus ?? "unreviewed",
    }))
    .sort((left, right) => {
      if (left.finalReviewedScore !== right.finalReviewedScore) {
        return right.finalReviewedScore - left.finalReviewedScore;
      }

      const leftRank = left.currentPublicRank ?? Number.POSITIVE_INFINITY;
      const rightRank = right.currentPublicRank ?? Number.POSITIVE_INFINITY;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return left.candidateChampionId.localeCompare(right.candidateChampionId);
    });
}

export function clampCounterRankingV2ManualAdjustment(adjustment: number) {
  const finiteAdjustment = Number.isFinite(adjustment) ? adjustment : 0;

  return Math.min(
    counterRankingV2ManualAdjustmentMax,
    Math.max(counterRankingV2ManualAdjustmentMin, finiteAdjustment),
  );
}

export function isCounterRankingV2ManualAdjustmentInBounds(adjustment: number) {
  return (
    Number.isFinite(adjustment) &&
    adjustment >= counterRankingV2ManualAdjustmentMin &&
    adjustment <= counterRankingV2ManualAdjustmentMax
  );
}

export function calculateCounterRankingV2FinalMechanicalScore({
  calculatedMechanicalScore,
  manualAdjustment,
}: {
  calculatedMechanicalScore: number;
  manualAdjustment: number;
}) {
  const finiteCalculatedScore = Number.isFinite(calculatedMechanicalScore)
    ? calculatedMechanicalScore
    : 0;
  const boundedAdjustment = clampCounterRankingV2ManualAdjustment(manualAdjustment);

  return Math.min(100, Math.max(0, finiteCalculatedScore + boundedAdjustment));
}

export function createCounterRankingV2MechanicalReview({
  adjustmentReason = counterRankingV2DefaultAdjustmentReason,
  adminReviewNote = null,
  calculatedMechanicalScore,
  counterChampionId,
  createdAt = null,
  enemyChampionId,
  generatedAt = null,
  generatedBy = null,
  highMasteryRequired = false,
  manualAdjustment = 0,
  publicEligible = false,
  reviewStatus = counterRankingV2DefaultReviewStatus,
  reviewedAt = null,
  reviewedBy = null,
  role,
  updatedAt = null,
}: Pick<
  CounterRankingV2MechanicalReview,
  "calculatedMechanicalScore" | "counterChampionId" | "enemyChampionId" | "role"
> &
  Partial<
    Pick<
      CounterRankingV2MechanicalReview,
      | "adjustmentReason"
      | "adminReviewNote"
      | "createdAt"
      | "generatedAt"
      | "generatedBy"
      | "highMasteryRequired"
      | "manualAdjustment"
      | "publicEligible"
      | "reviewStatus"
      | "reviewedAt"
      | "reviewedBy"
      | "updatedAt"
    >
  >): CounterRankingV2MechanicalReview {
  const boundedAdjustment = clampCounterRankingV2ManualAdjustment(manualAdjustment);

  return {
    adjustmentReason,
    adminReviewNote,
    calculatedMechanicalScore,
    counterChampionId: normalizeChampionId(counterChampionId),
    createdAt,
    enemyChampionId: normalizeChampionId(enemyChampionId),
    finalMechanicalScore: calculateCounterRankingV2FinalMechanicalScore({
      calculatedMechanicalScore,
      manualAdjustment: boundedAdjustment,
    }),
    generatedAt,
    generatedBy,
    highMasteryRequired,
    manualAdjustment: boundedAdjustment,
    publicEligible: normalizeCounterRankingV2PublicEligible({
      publicEligible,
      reviewStatus,
    }),
    reviewStatus,
    reviewedAt,
    reviewedBy,
    role,
    updatedAt,
  };
}

export function isCounterRankingV2AdjustmentReason(value: string): value is CounterRankingV2AdjustmentReason {
  return counterRankingV2AdjustmentReasons.includes(value as CounterRankingV2AdjustmentReason);
}

export function isCounterRankingV2ReviewStatus(value: string): value is CounterRankingV2ReviewStatus {
  return counterRankingV2ReviewStatuses.includes(value as CounterRankingV2ReviewStatus);
}

export function normalizeCounterRankingV2ProfileStatus(
  value: string,
): CounterRankingV2ProfileStatus | null {
  if (value === "needs_review") {
    return "needs_revision";
  }

  return counterRankingV2ProfileStatuses.includes(value as CounterRankingV2ProfileStatus)
    ? (value as CounterRankingV2ProfileStatus)
    : null;
}

export function isCounterRankingV2ProfileStatus(
  value: string,
): value is CounterRankingV2ProfileStatus {
  return normalizeCounterRankingV2ProfileStatus(value) === value;
}

export function isCounterRankingV2ProfileValueInBounds(value: number) {
  return (
    Number.isFinite(value) &&
    value >= counterRankingV2ProfileValueMin &&
    value <= counterRankingV2ProfileValueMax
  );
}

export function getCounterRankingV2ProfileImpactLabel(value: number) {
  if (value <= 0) {
    return "None";
  }

  if (value <= 3) {
    return "Low";
  }

  if (value <= 6) {
    return "Medium";
  }

  if (value <= 8) {
    return "High";
  }

  return "Defining";
}

export function isCounterRankingV2ReviewStatusPublicEligible(
  reviewStatus: CounterRankingV2ReviewStatus,
) {
  return (counterRankingV2PublicApprovedReviewStatuses as readonly CounterRankingV2ReviewStatus[]).includes(
    reviewStatus,
  );
}

export function normalizeCounterRankingV2PublicEligible({
  publicEligible,
  reviewStatus,
}: {
  publicEligible: boolean;
  reviewStatus: CounterRankingV2ReviewStatus;
}) {
  return publicEligible && isCounterRankingV2ReviewStatusPublicEligible(reviewStatus);
}

export function isCounterRankingV2ReviewPublicEligible(
  review: Pick<CounterRankingV2MechanicalReview, "publicEligible" | "reviewStatus"> | null,
) {
  return Boolean(
    review?.publicEligible && isCounterRankingV2ReviewStatusPublicEligible(review.reviewStatus),
  );
}

export function isCounterRankingV2ApprovedReviewPublicEligible(
  review: Pick<CounterRankingV2MechanicalReview, "publicEligible" | "reviewStatus"> | null,
) {
  return Boolean(
    review?.publicEligible &&
      (counterRankingV2PublicApprovedReviewStatuses as readonly CounterRankingV2ReviewStatus[]).includes(
        review.reviewStatus,
      ),
  );
}

export function isCounterRankingV2ShadowCandidateEligible({
  minimumGames,
  observedGames,
  review,
}: {
  minimumGames: number;
  observedGames: number | null;
  review: Pick<CounterRankingV2MechanicalReview, "publicEligible" | "reviewStatus"> | null;
}) {
  return (observedGames ?? 0) >= minimumGames || isCounterRankingV2ReviewPublicEligible(review);
}

export function isCounterRankingV2PublicCandidateEligible({
  minimumGames,
  observedGames,
  review,
  useReviewedMechanicalCounters = useReviewedMechanicalCountersPublicly,
}: {
  minimumGames: number;
  observedGames: number | null;
  review: Pick<CounterRankingV2MechanicalReview, "publicEligible" | "reviewStatus"> | null;
  useReviewedMechanicalCounters?: boolean;
}) {
  return (
    (observedGames ?? 0) >= minimumGames ||
    (useReviewedMechanicalCounters && isCounterRankingV2ApprovedReviewPublicEligible(review))
  );
}

export function createObservedCounterRankingV2Snapshot({
  games,
  rank,
  winRate,
}: {
  games: number | null;
  rank: number | null;
  winRate: number | null;
}): CounterRankingV2ObservedRankSnapshot {
  return {
    confidence: calculateCounterPickConfidence(games ?? 0),
    games,
    rank,
    winRate,
  };
}

function getMechanicalFitFactors(
  candidateProfile: CounterRankingV2ChampionProfile,
  enemyProfile: CounterRankingV2ChampionProfile,
) {
  const enemyVulnerabilityWeightById = new Map(
    enemyProfile.vulnerabilities.map((vulnerability) => [
      vulnerability.traitId,
      clampTraitWeight(vulnerability.weight),
    ] as const),
  );
  const factors: CounterRankingV2Factor[] = [];

  for (const strength of candidateProfile.strengths) {
    const strengthWeight = clampTraitWeight(strength.weight);
    const interactions = counterRankingV2TraitInteractions.filter(
      (interaction) => interaction.candidateStrength === strength.traitId,
    );

    for (const interaction of interactions) {
      const vulnerabilityWeight = enemyVulnerabilityWeightById.get(
        interaction.enemyVulnerability,
      );

      if (!vulnerabilityWeight) {
        continue;
      }

      const contribution = Number(
        (strengthWeight * vulnerabilityWeight * interaction.weight).toFixed(4),
      );

      if (contribution <= 0) {
        continue;
      }

      factors.push({
        candidateStrength: interaction.candidateStrength,
        contribution,
        enemyVulnerability: interaction.enemyVulnerability,
        interactionWeight: interaction.weight,
        reason: interaction.reason,
      });
    }
  }

  return factors;
}

function getMechanicalFitMaxRawScore(
  candidateProfile: CounterRankingV2ChampionProfile,
  enemyProfile: CounterRankingV2ChampionProfile,
) {
  const enemyVulnerabilityIds = new Set(
    enemyProfile.vulnerabilities.map((vulnerability) => vulnerability.traitId),
  );
  const maxRawScore = candidateProfile.strengths.reduce((total, strength) => {
    const maxContributionForStrength = counterRankingV2TraitInteractions
      .filter(
        (interaction) =>
          interaction.candidateStrength === strength.traitId &&
          enemyVulnerabilityIds.has(interaction.enemyVulnerability),
      )
      .reduce(
        (strengthTotal, interaction) =>
          strengthTotal + clampTraitWeight(strength.weight) * maxTraitWeight * interaction.weight,
        0,
      );

    return total + maxContributionForStrength;
  }, 0);

  return Number(maxRawScore.toFixed(4));
}

function emptyMechanicalFitResult({
  candidateChampionId,
  enemyChampionId,
  role,
  status,
}: {
  candidateChampionId: string;
  enemyChampionId: string;
  role: LeagueRole | null;
  status: CounterRankingV2FitStatus;
}): CounterRankingV2MechanicalFitResult {
  return {
    candidateChampionId,
    enemyChampionId,
    factors: [],
    maxRawScore: 0,
    rawScore: 0,
    role,
    score: 0,
    status,
  };
}

function profile(
  championId: string,
  reviewStatus: CounterRankingV2ProfileStatus,
  version: number,
  traits: Pick<CounterRankingV2ChampionProfile, "notes" | "strengths" | "vulnerabilities">,
): CounterRankingV2ChampionProfile {
  return {
    championId,
    reviewStatus,
    role: "mid",
    supportedRoles: ["mid"],
    version,
    ...traits,
  };
}

function trait(
  traitId: CounterRankingV2TraitId,
  weight: number,
): CounterRankingV2ProfileTrait {
  const normalizedTraitId = normalizeCounterRankingV2TraitId(traitId);

  return {
    traitId: normalizedTraitId ?? traitId,
    weight: clampTraitWeight(weight),
  };
}

function clampTraitWeight(weight: number) {
  return Math.min(maxTraitWeight, Math.max(0, Number.isFinite(weight) ? weight : 0));
}

function normalizeChampionId(championId: string) {
  return championId.trim().toLowerCase();
}

function normalizeCounterRankingV2ProfileRole(
  role: LeagueRole | string | null | undefined,
): LeagueRole {
  const normalizedRole = String(role ?? "mid").trim().toLowerCase();
  const roleAliases: Record<string, LeagueRole> = {
    bot: "adc",
    bottom: "adc",
    middle: "mid",
  };
  const aliasedRole = roleAliases[normalizedRole] ?? normalizedRole;

  return leagueRoles.includes(aliasedRole as LeagueRole) ? (aliasedRole as LeagueRole) : "mid";
}
