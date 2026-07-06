export type AdminLeagueChampion = {
  id: string;
  image_url: string;
  name: string;
  title: string;
};

export type AdminLeagueMatchup = {
  admin_notes: string | null;
  champion_a_id: string;
  champion_b_id: string;
  confidence_level: string | null;
  danger_windows: string | null;
  difficulty_rating: number | null;
  early_game: string | null;
  generated_at: string | null;
  generation_status: "draft" | "failed" | "reviewed";
  id: number;
  overview: string | null;
  power_spikes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  role: "mid" | "top" | "jungle" | "adc" | "support";
  trading_pattern: string | null;
  updated_at: string | null;
  win_conditions: string | null;
};

export type LeagueCounterPickType = "best_counter" | "countered_by";
export type LeagueCounterPickStatus = "draft" | "reviewed";
export type LeagueCounterPickBuildPath = Record<string, unknown>;

export type LeagueCounterPick = {
  behind_build_path: LeagueCounterPickBuildPath | null;
  champion_id: string;
  common_build_vs: LeagueCounterPickBuildPath | null;
  counter_champion_id: string;
  counter_strength: string | null;
  counter_type: LeagueCounterPickType;
  created_at: string;
  games: number | null;
  generation_status: LeagueCounterPickStatus;
  id: number;
  patch: string | null;
  rank_filter: string | null;
  region: string | null;
  reason: string | null;
  role: AdminLeagueMatchup["role"];
  updated_at: string;
  win_rate: number | null;
};

export type AdminLeagueMatchupFeedback = {
  card_type: string;
  created_at: string;
  enemy_champion: string;
  feedback_type: "helpful" | "not_helpful" | "report_issue";
  id: number;
  lane: AdminLeagueMatchup["role"];
  matchup_id: number;
  message: string | null;
  player_champion: string;
  reason:
    | "ability_formatting_issue"
    | "incorrect_advice"
    | "missing_information"
    | "other"
    | "too_generic"
    | "wrong_champion_perspective"
    | null;
  status: "dismissed" | "open" | "resolved" | "reviewing";
  updated_at: string;
  user_id: string | null;
};

export type LeagueMatchupBatchPlanItem = {
  championAId: string;
  championBId: string;
  existingMatchupId: number | null;
  role: AdminLeagueMatchup["role"];
};

export type LeagueMatchupQueueItemResult =
  | {
      matchupId: number;
      ok: true;
      profileWarning?: string;
      skipped?: boolean;
    }
  | {
      error: string;
      ok: false;
    };

export type AdminData = {
  leagueChampions: AdminLeagueChampion[];
  leagueCounterPicks: LeagueCounterPick[];
  leagueFeedback: AdminLeagueMatchupFeedback[];
  leagueMatchups: AdminLeagueMatchup[];
};

export type AdminSection =
  | "counter-picks-collect"
  | "counter-picks-overview"
  | "counter-picks-profile-review"
  | "counter-picks-review"
  | "counter-picks-shadow-ranking"
  | "league-counter-picks"
  | "league-matchups"
  | "overview";

export type LeagueMatchupFormState = {
  admin_notes: string;
  champion_a_id: string;
  champion_b_id: string;
  confidence_level: string;
  danger_windows: string;
  difficulty_rating: string;
  early_game: string;
  overview: string;
  power_spikes: string;
  role: "mid" | "top" | "jungle" | "adc" | "support";
  trading_pattern: string;
  win_conditions: string;
};

export type FormStatus = {
  error: string | null;
  isLoading: boolean;
  success: string | null;
};
