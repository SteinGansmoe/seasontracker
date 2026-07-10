import type {
  AdminData,
  LeagueMatchupFormState,
} from "./types";

export const sessionCheckTimeoutMs = 2_000;

export const emptyLeagueMatchupForm: LeagueMatchupFormState = {
  admin_notes: "",
  champion_a_id: "",
  champion_b_id: "",
  confidence_level: "",
  danger_windows: "",
  difficulty_rating: "",
  early_game: "",
  overview: "",
  power_spikes: "",
  role: "mid",
  trading_pattern: "",
  win_conditions: "",
};

export const emptyAdminData: AdminData = {
  leagueChampions: [],
  leagueCounterPicks: [],
  leagueFeedback: [],
  leagueMatchups: [],
  leaguePublicCounterPicksCount: null,
};

export const missingLeagueMatchupsTableMessage =
  "League matchup management is not fully set up in Supabase yet. Apply the latest league_matchups migration to enable this admin page.";
export const missingLeagueCounterPicksTableMessage =
  "Counter Pick management is not fully set up in Supabase yet. Apply the latest league_counter_picks migration to enable this admin page.";
export const missingLeagueFeedbackTableMessage =
  "League matchup feedback is not fully set up in Supabase yet. Apply the latest matchup_feedback migration to enable feedback review.";

export const fieldClassName =
  "w-full rounded-lg border border-white/10 bg-[#111a2c] px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus-visible:border-violet-400/70 focus-visible:ring-3 focus-visible:ring-violet-400/20 disabled:cursor-not-allowed disabled:opacity-50";
export const selectOptionClassName = "bg-[#10182b] text-zinc-100";
