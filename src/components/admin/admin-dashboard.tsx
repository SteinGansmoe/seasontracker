"use client";

import { type FormEvent, useEffect, useMemo, useState, ViewTransition } from "react";
import { LockKeyhole } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { BackButton } from "@/src/components/back-button";
import { AdminNavigation } from "./admin-nav";
import { AdminOverview } from "./admin-overview";
import {
  emptyAdminData,
  emptyLeagueMatchupForm,
  missingLeagueCounterPicksTableMessage,
  missingLeagueMatchupsTableMessage,
  missingLeagueFeedbackTableMessage,
  sessionCheckTimeoutMs,
} from "./constants";
import {
  isMissingLeagueCounterPicksTableError,
  isMissingLeagueMatchupsTableError,
  isMissingLeagueFeedbackTableError,
} from "./helpers";
import { AdminLeagueCounterPicksSection } from "./league/league-counter-pick-section";
import { AdminLeagueMatchupsSection } from "./league/league-matchup-section";
import type {
  AdminData,
  AdminLeagueChampion,
  LeagueCounterPick,
  AdminLeagueMatchupFeedback,
  AdminLeagueMatchup,
  AdminSection,
  LeagueMatchupBatchPlanItem,
  LeagueMatchupFormState,
  LeagueMatchupQueueItemResult,
} from "./types";
import {
  deleteLeagueMatchupDraft,
  generateLeagueMatchupDraft,
} from "@/src/app/admin/league/matchups/actions";
import { SiteHeader } from "@/src/components/site-header";
import { LaneStompPageShell } from "@/src/components/lane-stomp-page";
import {
  SkeletonButton,
  SkeletonLine,
  SkeletonPanel,
  SkeletonStatCell,
} from "@/src/components/lane-stomp-skeleton";
import { Card } from "@/src/components/ui/card";
import { isChampionInRole } from "@/src/features/league/champion-roles";
import { getChampionCombatProfile } from "@/src/features/league/champion-knowledge";
import {
  calculateLeagueMatchupConfidence,
  getLeagueMatchupConfidenceSourceFromNotes,
} from "@/src/features/league/matchup-confidence";
import { isAdminUser } from "@/src/lib/admin";
import { fetchUserProfile, getProfileDisplayName, type UserProfile } from "@/src/lib/profile";
import { supabase } from "@/src/lib/supabase";

type SessionResult = Awaited<ReturnType<NonNullable<typeof supabase>["auth"]["getSession"]>>;

const adminDataPageSize = 1000;
const leagueMatchupSelect = [
  "id",
  "admin_notes",
  "champion_a_id",
  "champion_b_id",
  "role",
  "difficulty_rating",
  "confidence_level",
  "generation_status",
  "generated_at",
  "reviewed_at",
  "reviewed_by",
  "updated_at",
].join(", ");
const leagueMatchupDetailSelect = [
  leagueMatchupSelect,
  "admin_notes",
  "danger_windows",
  "early_game",
  "overview",
  "power_spikes",
  "trading_pattern",
  "win_conditions",
].join(", ");
const leagueMatchupRoleConflictTarget = "champion_a_id,champion_b_id,role";
const leagueCounterPickSelect = [
  "behind_build_path",
  "champion_id",
  "common_build_vs",
  "counter_champion_id",
  "counter_strength",
  "counter_type",
  "created_at",
  "games",
  "generation_status",
  "id",
  "patch",
  "rank_filter",
  "region",
  "reason",
  "role",
  "updated_at",
  "win_rate",
].join(", ");
const leagueFeedbackSelect = [
  "id",
  "matchup_id",
  "player_champion",
  "enemy_champion",
  "lane",
  "card_type",
  "feedback_type",
  "reason",
  "message",
  "user_id",
  "status",
  "created_at",
  "updated_at",
].join(", ");

function AdminDashboardSkeleton() {
  return (
    <div className="space-y-8">
      <SkeletonPanel className="flex gap-2 overflow-hidden p-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonButton className="h-10 min-w-28" key={index} />
        ))}
      </SkeletonPanel>

      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonPanel className="h-28 p-4" key={index}>
            <SkeletonStatCell className="border-l-0 px-0 py-0" />
          </SkeletonPanel>
        ))}
      </div>

      <section className="space-y-5">
        <div className="space-y-3">
          <SkeletonLine className="h-8 w-32" tone="raised" />
          <SkeletonLine className="h-4 w-full max-w-2xl" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonPanel className="h-40 p-4" key={index}>
              <SkeletonLine className="h-4 w-32" tone="cyan" />
              <div className="mt-5 grid gap-3">
                {Array.from({ length: 4 }).map((_, rowIndex) => (
                  <SkeletonLine className="h-3 w-full" key={rowIndex} />
                ))}
              </div>
            </SkeletonPanel>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div className="space-y-3">
          <SkeletonLine className="h-8 w-28" tone="raised" />
          <SkeletonLine className="h-4 w-full max-w-xl" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <SkeletonPanel className="h-36 p-4" key={index}>
              <SkeletonLine className="h-4 w-40" tone="cyan" />
              <SkeletonLine className="mt-5 h-3 w-full" />
              <SkeletonLine className="mt-3 h-3 w-8/12" />
            </SkeletonPanel>
          ))}
        </div>
      </section>
    </div>
  );
}

let cachedAdminData: AdminData | null = null;
let cachedAdminProfile: UserProfile | null = null;
let cachedAdminUser: User | null = null;

export function AdminDashboard({ section }: { section: AdminSection }) {
  const [adminData, setAdminData] = useState<AdminData>(() => cachedAdminData ?? emptyAdminData);
  const [createLeagueMatchupForm, setCreateLeagueMatchupForm] =
    useState<LeagueMatchupFormState>(emptyLeagueMatchupForm);
  const [createLeagueMatchupStatus, setCreateLeagueMatchupStatus] = useState<{
    error: string | null;
    isLoading: boolean;
    success: string | null;
  }>({ error: null, isLoading: false, success: null });
  const [editLeagueMatchupForm, setEditLeagueMatchupForm] =
    useState<LeagueMatchupFormState>(emptyLeagueMatchupForm);
  const [editingLeagueMatchupId, setEditingLeagueMatchupId] = useState<number | null>(null);
  const [editLeagueMatchupStatus, setEditLeagueMatchupStatus] = useState<{
    error: string | null;
    isLoading: boolean;
    success: string | null;
  }>({ error: null, isLoading: false, success: null });
  const [generatingLeagueMatchupId, setGeneratingLeagueMatchupId] = useState<number | null>(null);
  const [deletingLeagueMatchupDraftId, setDeletingLeagueMatchupDraftId] = useState<number | null>(
    null,
  );
  const [batchLeagueMatchupStatus, setBatchLeagueMatchupStatus] = useState<{
    error: string | null;
    isLoading: boolean;
    success: string | null;
  }>({ error: null, isLoading: false, success: null });
  const [batchLeagueMatchupProgress, setBatchLeagueMatchupProgress] = useState<{
    current: number;
    label: string;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(() => !cachedAdminData);
  const [profile, setProfile] = useState<UserProfile | null>(() => cachedAdminProfile);
  const [leagueMatchupsSetupMessage, setLeagueMatchupsSetupMessage] = useState<string | null>(null);
  const [leagueCounterPicksSetupMessage, setLeagueCounterPicksSetupMessage] = useState<
    string | null
  >(null);
  const [leagueFeedbackSetupMessage, setLeagueFeedbackSetupMessage] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(() => cachedAdminUser);
  const pageTitle =
    section === "league-matchups"
      ? "League matchup management"
      : section === "counter-picks-collect"
        ? "Collect Counter Pick data"
        : section === "counter-picks-profile-review"
          ? "Counter Profile Review"
        : section === "counter-picks-review"
          ? "Counter Review"
        : section === "counter-picks-shadow-ranking"
          ? "Counter Pick shadow ranking"
          : section === "league-counter-picks" || section === "counter-picks-overview"
        ? "Counter Pick management"
        : "Admin dashboard";

  useEffect(() => {
    let isMounted = true;
    let redirectTimeoutId: number | undefined;

    async function loadAdminData() {
      redirectTimeoutId = window.setTimeout(() => {
        window.location.replace("/login");
      }, sessionCheckTimeoutMs + 1_000);

      if (!supabase) {
        window.clearTimeout(redirectTimeoutId);
        setError("Supabase is not configured.");
        setIsLoading(false);
        return;
      }

      const { data: sessionData, error: sessionError } = await getSessionWithTimeout();
      const sessionUser = sessionData.session?.user ?? null;

      if (!isMounted) {
        window.clearTimeout(redirectTimeoutId);
        return;
      }

      if (sessionError || !sessionUser) {
        window.location.replace("/login");
        return;
      }

      const hasAdminAccess = await isAdminUser(sessionUser);

      if (!isMounted) {
        window.clearTimeout(redirectTimeoutId);
        return;
      }

      if (!hasAdminAccess) {
        cachedAdminData = null;
        cachedAdminProfile = null;
        cachedAdminUser = null;
        window.location.replace("/");
        return;
      }

      window.clearTimeout(redirectTimeoutId);

      cachedAdminUser = sessionUser;
      setUser(sessionUser);
      const profileResult = await fetchUserProfile(sessionUser.id);

      if (!isMounted) {
        window.clearTimeout(redirectTimeoutId);
        return;
      }

      cachedAdminProfile = profileResult.data;
      setProfile(profileResult.data);

      const [
        leagueChampionsResult,
        leagueCounterPicksResult,
        leagueMatchupsResult,
        leagueFeedbackResult,
      ] = await Promise.all([
        supabase
          .from("league_champions")
          .select("id, name, title, image_url")
          .eq("is_active", true)
          .order("name", { ascending: true }),
        fetchAllLeagueCounterPicks(),
        fetchAllLeagueMatchups(),
        fetchAllLeagueFeedback(),
      ]);

      if (!isMounted) {
        return;
      }

      const isMissingLeagueMatchupsTable = isMissingLeagueMatchupsTableError(
        leagueMatchupsResult.error,
      );
      const isMissingLeagueCounterPicksTable = isMissingLeagueCounterPicksTableError(
        leagueCounterPicksResult.error,
      );
      const isMissingLeagueFeedbackTable = isMissingLeagueFeedbackTableError(
        leagueFeedbackResult.error,
      );

      if (
        leagueChampionsResult.error ||
        (leagueCounterPicksResult.error && !isMissingLeagueCounterPicksTable) ||
        (leagueMatchupsResult.error && !isMissingLeagueMatchupsTable) ||
        (leagueFeedbackResult.error && !isMissingLeagueFeedbackTable)
      ) {
        setError(
          leagueChampionsResult.error?.message ??
            (!isMissingLeagueCounterPicksTable ? leagueCounterPicksResult.error?.message : null) ??
            (!isMissingLeagueMatchupsTable ? leagueMatchupsResult.error?.message : null) ??
            (!isMissingLeagueFeedbackTable ? leagueFeedbackResult.error?.message : null) ??
            "Could not load admin data.",
        );
        setIsLoading(false);
        return;
      }

      setLeagueMatchupsSetupMessage(
        isMissingLeagueMatchupsTable ? missingLeagueMatchupsTableMessage : null,
      );
      setLeagueCounterPicksSetupMessage(
        isMissingLeagueCounterPicksTable ? missingLeagueCounterPicksTableMessage : null,
      );
      setLeagueFeedbackSetupMessage(
        isMissingLeagueFeedbackTable ? missingLeagueFeedbackTableMessage : null,
      );

      const nextAdminData = {
        leagueChampions: (leagueChampionsResult.data ?? []) as AdminLeagueChampion[],
        leagueCounterPicks: isMissingLeagueCounterPicksTable
          ? []
          : ((leagueCounterPicksResult.data ?? []) as LeagueCounterPick[]),
        leagueFeedback: isMissingLeagueFeedbackTable
          ? []
          : ((leagueFeedbackResult.data ?? []) as unknown as AdminLeagueMatchupFeedback[]),
        leagueMatchups: isMissingLeagueMatchupsTable
          ? []
          : ((leagueMatchupsResult.data ?? []) as AdminLeagueMatchup[]),
      };

      cachedAdminData = nextAdminData;
      setAdminData(nextAdminData);
      setIsLoading(false);
    }

    loadAdminData();

    return () => {
      isMounted = false;
      window.clearTimeout(redirectTimeoutId);
    };
  }, []);

  const reviewedLeagueMatchupsCount = useMemo(
    () =>
      adminData.leagueMatchups.filter((matchup) => matchup.generation_status === "reviewed").length,
    [adminData.leagueMatchups],
  );
  const draftLeagueMatchupsCount = adminData.leagueMatchups.length - reviewedLeagueMatchupsCount;

  async function reloadAdminData() {
    if (!supabase) {
      setError("Supabase is not configured.");
      return false;
    }

    const [
      leagueChampionsResult,
      leagueCounterPicksResult,
      leagueMatchupsResult,
      leagueFeedbackResult,
    ] = await Promise.all([
      supabase
        .from("league_champions")
        .select("id, name, title, image_url")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      fetchAllLeagueCounterPicks(),
      fetchAllLeagueMatchups(),
      fetchAllLeagueFeedback(),
    ]);

    const isMissingLeagueMatchupsTable = isMissingLeagueMatchupsTableError(
      leagueMatchupsResult.error,
    );
    const isMissingLeagueCounterPicksTable = isMissingLeagueCounterPicksTableError(
      leagueCounterPicksResult.error,
    );
    const isMissingLeagueFeedbackTable = isMissingLeagueFeedbackTableError(
      leagueFeedbackResult.error,
    );

    if (
      leagueChampionsResult.error ||
      (leagueCounterPicksResult.error && !isMissingLeagueCounterPicksTable) ||
      (leagueMatchupsResult.error && !isMissingLeagueMatchupsTable) ||
      (leagueFeedbackResult.error && !isMissingLeagueFeedbackTable)
    ) {
      setError(
        leagueChampionsResult.error?.message ??
          (!isMissingLeagueCounterPicksTable ? leagueCounterPicksResult.error?.message : null) ??
          (!isMissingLeagueMatchupsTable ? leagueMatchupsResult.error?.message : null) ??
          (!isMissingLeagueFeedbackTable ? leagueFeedbackResult.error?.message : null) ??
          "Could not load admin data.",
      );
      return false;
    }

    setLeagueMatchupsSetupMessage(
      isMissingLeagueMatchupsTable ? missingLeagueMatchupsTableMessage : null,
    );
    setLeagueCounterPicksSetupMessage(
      isMissingLeagueCounterPicksTable ? missingLeagueCounterPicksTableMessage : null,
    );
    setLeagueFeedbackSetupMessage(
      isMissingLeagueFeedbackTable ? missingLeagueFeedbackTableMessage : null,
    );

    const nextAdminData = {
      leagueChampions: (leagueChampionsResult.data ?? []) as AdminLeagueChampion[],
      leagueCounterPicks: isMissingLeagueCounterPicksTable
        ? []
        : ((leagueCounterPicksResult.data ?? []) as LeagueCounterPick[]),
      leagueFeedback: isMissingLeagueFeedbackTable
        ? []
        : ((leagueFeedbackResult.data ?? []) as unknown as AdminLeagueMatchupFeedback[]),
      leagueMatchups: isMissingLeagueMatchupsTable
        ? []
        : ((leagueMatchupsResult.data ?? []) as AdminLeagueMatchup[]),
    };

    cachedAdminData = nextAdminData;
    setAdminData(nextAdminData);
    return true;
  }

  function getLeagueMatchupFormError(form: LeagueMatchupFormState) {
    if (!form.champion_a_id || !form.champion_b_id || !form.role) {
      return "Champion A, champion B, and role are required.";
    }

    if (form.champion_a_id === form.champion_b_id) {
      return "Champion A and Champion B must be different.";
    }

    const difficultyRating = form.difficulty_rating.trim();

    if (difficultyRating) {
      const parsedRating = Number.parseInt(difficultyRating, 10);

      if (Number.isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        return "Difficulty rating must be between 1 and 5.";
      }
    }

    const lanePoolError = getLeagueMatchupLanePoolError(form, adminData.leagueChampions);

    if (lanePoolError) {
      return lanePoolError;
    }

    return null;
  }

  function getLeagueMatchupPayload(form: LeagueMatchupFormState) {
    const difficultyRating = form.difficulty_rating.trim();

    return {
      admin_notes: form.admin_notes.trim() || null,
      champion_a_id: form.champion_a_id,
      champion_b_id: form.champion_b_id,
      confidence_level: form.confidence_level.trim() || null,
      danger_windows: form.danger_windows.trim() || null,
      difficulty_rating: difficultyRating ? Number.parseInt(difficultyRating, 10) : null,
      early_game: form.early_game.trim() || null,
      overview: form.overview.trim() || null,
      power_spikes: form.power_spikes.trim() || null,
      role: form.role,
      trading_pattern: form.trading_pattern.trim() || null,
      win_conditions: form.win_conditions.trim() || null,
    };
  }

  async function handleCreateLeagueMatchup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setCreateLeagueMatchupStatus({
        error: "Supabase is not configured.",
        isLoading: false,
        success: null,
      });
      return;
    }

    const validationError = getLeagueMatchupFormError(createLeagueMatchupForm);

    if (validationError) {
      setCreateLeagueMatchupStatus({
        error: validationError,
        isLoading: false,
        success: null,
      });
      return;
    }

    setCreateLeagueMatchupStatus({
      error: null,
      isLoading: true,
      success: null,
    });

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (sessionError || !accessToken) {
      setCreateLeagueMatchupStatus({
        error: sessionError?.message ?? "Admin session is not ready.",
        isLoading: false,
        success: null,
      });
      return;
    }

    const { data: existingMatchup, error: existingMatchupError } = await supabase
      .from("league_matchups")
      .select(leagueMatchupSelect)
      .eq("champion_a_id", createLeagueMatchupForm.champion_a_id)
      .eq("champion_b_id", createLeagueMatchupForm.champion_b_id)
      .eq("role", createLeagueMatchupForm.role)
      .maybeSingle<AdminLeagueMatchup>();

    if (existingMatchupError) {
      setCreateLeagueMatchupStatus({
        error: existingMatchupError.message,
        isLoading: false,
        success: null,
      });
      return;
    }

    if (existingMatchup && hasSavedLeagueMatchupDraftContent(existingMatchup)) {
      await startEditingLeagueMatchup(
        existingMatchup,
        "Opened the existing matchup row. You can edit it here or regenerate this exact draft.",
      );
      setCreateLeagueMatchupStatus({
        error: null,
        isLoading: false,
        success:
          "This matchup already has saved guidance, so the existing row was opened for editing.",
      });
      return;
    }

    let matchupId = existingMatchup?.id ?? null;

    if (!matchupId) {
      const { data: createdMatchup, error: createError } = await supabase
        .from("league_matchups")
        .upsert(
          {
            champion_a_id: createLeagueMatchupForm.champion_a_id,
            champion_b_id: createLeagueMatchupForm.champion_b_id,
            role: createLeagueMatchupForm.role,
          },
          { onConflict: leagueMatchupRoleConflictTarget },
        )
        .select("id")
        .single<{ id: number }>();

      if (createError || !createdMatchup) {
        setCreateLeagueMatchupStatus({
          error: createError?.message ?? "League matchup could not be created.",
          isLoading: false,
          success: null,
        });
        return;
      }

      matchupId = createdMatchup.id;
    }

    setGeneratingLeagueMatchupId(matchupId);

    const result = await generateLeagueMatchupDraft({
      accessToken,
      matchupId,
    });

    if (!result.ok) {
      setGeneratingLeagueMatchupId(null);
      setCreateLeagueMatchupStatus({
        error: result.error,
        isLoading: false,
        success: null,
      });
      await reloadAdminData();
      return;
    }

    await reloadAdminData();
    setGeneratingLeagueMatchupId(null);
    setCreateLeagueMatchupForm({
      ...emptyLeagueMatchupForm,
      champion_a_id: createLeagueMatchupForm.champion_a_id,
      role: createLeagueMatchupForm.role,
    });
    setCreateLeagueMatchupStatus({
      error: null,
      isLoading: false,
      success: result.profileWarning
        ? `League matchup draft generated and saved with lower confidence. ${result.profileWarning}`
        : "League matchup draft generated and saved. Review before publishing.",
    });
  }

  async function startEditingLeagueMatchup(matchup: AdminLeagueMatchup, successMessage?: string) {
    setEditingLeagueMatchupId(matchup.id);
    setEditLeagueMatchupStatus({ error: null, isLoading: true, success: null });
    setEditLeagueMatchupForm({
      admin_notes: matchup.admin_notes ?? "",
      champion_a_id: matchup.champion_a_id,
      champion_b_id: matchup.champion_b_id,
      confidence_level: matchup.confidence_level ?? "",
      danger_windows: matchup.danger_windows ?? "",
      difficulty_rating: matchup.difficulty_rating ? String(matchup.difficulty_rating) : "",
      early_game: matchup.early_game ?? "",
      overview: matchup.overview ?? "",
      power_spikes: matchup.power_spikes ?? "",
      role: matchup.role,
      trading_pattern: matchup.trading_pattern ?? "",
      win_conditions: matchup.win_conditions ?? "",
    });

    if (!supabase) {
      setEditLeagueMatchupStatus({
        error: "Supabase is not configured.",
        isLoading: false,
        success: null,
      });
      return;
    }

    const { data, error } = await supabase
      .from("league_matchups")
      .select(leagueMatchupDetailSelect)
      .eq("id", matchup.id)
      .single<AdminLeagueMatchup>();

    if (error || !data) {
      setEditLeagueMatchupStatus({
        error: error?.message ?? "League matchup details could not be loaded.",
        isLoading: false,
        success: null,
      });
      return;
    }

    setEditLeagueMatchupForm({
      admin_notes: data.admin_notes ?? "",
      champion_a_id: data.champion_a_id,
      champion_b_id: data.champion_b_id,
      confidence_level: data.confidence_level ?? "",
      danger_windows: data.danger_windows ?? "",
      difficulty_rating: data.difficulty_rating ? String(data.difficulty_rating) : "",
      early_game: data.early_game ?? "",
      overview: data.overview ?? "",
      power_spikes: data.power_spikes ?? "",
      role: data.role,
      trading_pattern: data.trading_pattern ?? "",
      win_conditions: data.win_conditions ?? "",
    });
    setEditLeagueMatchupStatus({ error: null, isLoading: false, success: successMessage ?? null });
  }

  function stopEditingLeagueMatchup() {
    setEditingLeagueMatchupId(null);
    setEditLeagueMatchupForm(emptyLeagueMatchupForm);
    setEditLeagueMatchupStatus({ error: null, isLoading: false, success: null });
  }

  async function handleUpdateLeagueMatchup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !editingLeagueMatchupId) {
      return;
    }

    const validationError = getLeagueMatchupFormError(editLeagueMatchupForm);

    if (validationError) {
      setEditLeagueMatchupStatus({
        error: validationError,
        isLoading: false,
        success: null,
      });
      return;
    }

    setEditLeagueMatchupStatus({ error: null, isLoading: true, success: null });

    const { error: updateError } = await supabase
      .from("league_matchups")
      .update(getLeagueMatchupPayload(editLeagueMatchupForm))
      .eq("id", editingLeagueMatchupId);

    if (updateError) {
      setEditLeagueMatchupStatus({
        error: updateError.message,
        isLoading: false,
        success: null,
      });
      return;
    }

    await reloadAdminData();
    setEditingLeagueMatchupId(null);
    setEditLeagueMatchupStatus({
      error: null,
      isLoading: false,
      success: "League matchup updated.",
    });
  }

  async function handleMarkLeagueMatchupReviewed(matchup: AdminLeagueMatchup) {
    if (!supabase) {
      setEditLeagueMatchupStatus({
        error: "Supabase is not configured.",
        isLoading: false,
        success: null,
      });
      return;
    }

    if (!user) {
      setEditLeagueMatchupStatus({
        error: "Admin session is not ready.",
        isLoading: false,
        success: null,
      });
      return;
    }

    setEditLeagueMatchupStatus({ error: null, isLoading: true, success: null });

    const { data: matchupDetails, error: matchupDetailsError } = await supabase
      .from("league_matchups")
      .select(leagueMatchupDetailSelect)
      .eq("id", matchup.id)
      .single<AdminLeagueMatchup>();

    if (matchupDetailsError || !matchupDetails) {
      setEditLeagueMatchupStatus({
        error: matchupDetailsError?.message ?? "League matchup details could not be loaded.",
        isLoading: false,
        success: null,
      });
      return;
    }

    const confidence = calculateAdminLeagueMatchupConfidence({
      ...matchupDetails,
      generation_status: "reviewed",
    });
    const reviewedAdminNotes = removeLeagueMatchupGenerationFailureNotes(
      matchupDetails.admin_notes,
    );
    const { error: reviewError } = await supabase
      .from("league_matchups")
      .update({
        admin_notes: reviewedAdminNotes,
        confidence_level: confidence.level,
        generation_status: "reviewed",
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq("id", matchup.id);

    if (reviewError) {
      setEditLeagueMatchupStatus({
        error: reviewError.message,
        isLoading: false,
        success: null,
      });
      return;
    }

    logLeagueMatchupConfidenceCalculation(matchup.id, confidence);
    await reloadAdminData();
    setEditLeagueMatchupStatus({
      error: null,
      isLoading: false,
      success: "League matchup marked as reviewed.",
    });
  }

  async function handleMarkLeagueMatchupsReviewedForChampion(
    championName: string,
    matchupIds: number[],
  ) {
    const uniqueMatchupIds = Array.from(new Set(matchupIds));

    if (uniqueMatchupIds.length === 0) {
      return;
    }

    if (
      !window.confirm(
        `Approve all ${uniqueMatchupIds.length} draft matchup${
          uniqueMatchupIds.length === 1 ? "" : "s"
        } for ${championName}? These drafts will be marked as reviewed and published.`,
      )
    ) {
      return;
    }

    if (!supabase) {
      setEditLeagueMatchupStatus({
        error: "Supabase is not configured.",
        isLoading: false,
        success: null,
      });
      return;
    }

    if (!user) {
      setEditLeagueMatchupStatus({
        error: "Admin session is not ready.",
        isLoading: false,
        success: null,
      });
      return;
    }

    setEditLeagueMatchupStatus({ error: null, isLoading: true, success: null });
    const supabaseClient = supabase;

    const { data: draftMatchups, error: draftMatchupsError } = await supabaseClient
      .from("league_matchups")
      .select(leagueMatchupDetailSelect)
      .in("id", uniqueMatchupIds)
      .eq("generation_status", "draft");

    if (draftMatchupsError) {
      setEditLeagueMatchupStatus({
        error: draftMatchupsError.message,
        isLoading: false,
        success: null,
      });
      return;
    }

    const reviewedAt = new Date().toISOString();
    const reviewResults = await Promise.all(
      ((draftMatchups ?? []) as unknown as AdminLeagueMatchup[]).map((draftMatchup) => {
        const confidence = calculateAdminLeagueMatchupConfidence({
          ...draftMatchup,
          generation_status: "reviewed",
        });

        logLeagueMatchupConfidenceCalculation(draftMatchup.id, confidence);

        return supabaseClient
          .from("league_matchups")
          .update({
            confidence_level: confidence.level,
            generation_status: "reviewed",
            reviewed_at: reviewedAt,
            reviewed_by: user.id,
          })
          .eq("id", draftMatchup.id)
          .eq("generation_status", "draft");
      }),
    );
    const failedReview = reviewResults.find((result) => result.error);

    if (failedReview?.error) {
      setEditLeagueMatchupStatus({
        error: failedReview.error.message,
        isLoading: false,
        success: null,
      });
      await reloadAdminData();
      return;
    }

    await reloadAdminData();
    setEditLeagueMatchupStatus({
      error: null,
      isLoading: false,
      success: `${draftMatchups?.length ?? 0} ${championName} draft matchup${
        draftMatchups?.length === 1 ? "" : "s"
      } marked as reviewed.`,
    });
  }

  async function handleUpdateLeagueFeedbackStatus(
    feedback: AdminLeagueMatchupFeedback,
    status: AdminLeagueMatchupFeedback["status"],
  ) {
    if (!supabase) {
      setEditLeagueMatchupStatus({
        error: "Supabase is not configured.",
        isLoading: false,
        success: null,
      });
      return;
    }

    setEditLeagueMatchupStatus({ error: null, isLoading: true, success: null });

    const { error: updateError } = await supabase
      .from("matchup_feedback")
      .update({ status })
      .eq("id", feedback.id);

    if (updateError) {
      setEditLeagueMatchupStatus({
        error: updateError.message,
        isLoading: false,
        success: null,
      });
      return;
    }

    await reloadAdminData();
    setEditLeagueMatchupStatus({
      error: null,
      isLoading: false,
      success: `Feedback marked as ${status}.`,
    });
  }

  async function handleGenerateLeagueMatchupDraft(matchup: AdminLeagueMatchup) {
    if (!supabase) {
      setEditLeagueMatchupStatus({
        error: "Supabase is not configured.",
        isLoading: false,
        success: null,
      });
      return;
    }

    setGeneratingLeagueMatchupId(matchup.id);
    setEditLeagueMatchupStatus({
      error: null,
      isLoading: true,
      success: null,
    });

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (sessionError || !accessToken) {
      setGeneratingLeagueMatchupId(null);
      setEditLeagueMatchupStatus({
        error: sessionError?.message ?? "Admin session is not ready.",
        isLoading: false,
        success: null,
      });
      return;
    }

    const result = await generateLeagueMatchupDraft({
      accessToken,
      matchupId: matchup.id,
    });

    if (!result.ok) {
      setGeneratingLeagueMatchupId(null);
      setEditLeagueMatchupStatus({
        error: result.error,
        isLoading: false,
        success: null,
      });
      return;
    }

    await reloadAdminData();

    if (editingLeagueMatchupId === matchup.id) {
      setEditLeagueMatchupForm({
        ...editLeagueMatchupForm,
        ...normalizeDraftForForm(result.draft),
      });
    }

    setGeneratingLeagueMatchupId(null);
    setEditLeagueMatchupStatus({
      error: null,
      isLoading: false,
      success: result.profileWarning
        ? `League matchup draft generated and saved with lower confidence. ${result.profileWarning}`
        : "League matchup draft generated and saved. Review before publishing.",
    });
  }

  async function handleDeleteLeagueMatchupDraft(matchup: AdminLeagueMatchup) {
    const matchupLabel = getLeagueMatchupLabel(matchup, adminData.leagueChampions);

    if (
      !window.confirm(
        `Delete the saved AI draft for ${matchupLabel}? The matchup row and admin notes will remain.`,
      )
    ) {
      return;
    }

    if (!supabase) {
      setEditLeagueMatchupStatus({
        error: "Supabase is not configured.",
        isLoading: false,
        success: null,
      });
      return;
    }

    setDeletingLeagueMatchupDraftId(matchup.id);
    setEditLeagueMatchupStatus({
      error: null,
      isLoading: true,
      success: null,
    });

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (sessionError || !accessToken) {
      setDeletingLeagueMatchupDraftId(null);
      setEditLeagueMatchupStatus({
        error: sessionError?.message ?? "Admin session is not ready.",
        isLoading: false,
        success: null,
      });
      return;
    }

    const result = await deleteLeagueMatchupDraft({
      accessToken,
      matchupId: matchup.id,
    });

    if (!result.ok) {
      setDeletingLeagueMatchupDraftId(null);
      setEditLeagueMatchupStatus({
        error: result.error,
        isLoading: false,
        success: null,
      });
      return;
    }

    await reloadAdminData();

    if (editingLeagueMatchupId === matchup.id) {
      setEditLeagueMatchupForm({
        ...editLeagueMatchupForm,
        ...normalizeDraftForForm({
          danger_windows: "",
          early_game: "",
          overview: "",
          power_spikes: "",
          trading_pattern: "",
          win_conditions: "",
        }),
      });
    }

    setDeletingLeagueMatchupDraftId(null);
    setEditLeagueMatchupStatus({
      error: null,
      isLoading: false,
      success: "League matchup draft deleted.",
    });
  }

  async function handleGenerateLeagueMatchupBatch(items: LeagueMatchupBatchPlanItem[]) {
    if (!supabase) {
      setBatchLeagueMatchupStatus({
        error: "Supabase is not configured.",
        isLoading: false,
        success: null,
      });
      return;
    }

    if (items.length === 0) {
      setBatchLeagueMatchupStatus({
        error: "Select at least one matchup to generate.",
        isLoading: false,
        success: null,
      });
      return;
    }

    const invalidItemError = items
      .map((item) => getLeagueMatchupPlanLanePoolError(item, adminData.leagueChampions))
      .find((error): error is string => Boolean(error));

    if (invalidItemError) {
      setBatchLeagueMatchupStatus({
        error: invalidItemError,
        isLoading: false,
        success: null,
      });
      return;
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (sessionError || !accessToken) {
      setBatchLeagueMatchupStatus({
        error: sessionError?.message ?? "Admin session is not ready.",
        isLoading: false,
        success: null,
      });
      return;
    }

    setBatchLeagueMatchupStatus({
      error: null,
      isLoading: true,
      success: null,
    });
    setBatchLeagueMatchupProgress({
      current: 0,
      label: "Preparing batch",
      total: items.length,
    });

    let generatedCount = 0;
    let profileWarningCount = 0;

    for (const [index, item] of items.entries()) {
      const matchupLabel = getLeagueMatchupPlanLabel(item, adminData.leagueChampions);
      setBatchLeagueMatchupProgress({
        current: index,
        label: `Generating ${matchupLabel}`,
        total: items.length,
      });

      let matchupId = item.existingMatchupId;

      if (!matchupId) {
        const { data: createdMatchup, error: createError } = await supabase
          .from("league_matchups")
          .upsert(
            {
              champion_a_id: item.championAId,
              champion_b_id: item.championBId,
              role: item.role,
            },
            { onConflict: leagueMatchupRoleConflictTarget },
          )
          .select("id")
          .single<{ id: number }>();

        if (createError || !createdMatchup) {
          setBatchLeagueMatchupStatus({
            error: createError?.message ?? `Could not create ${matchupLabel}.`,
            isLoading: false,
            success: null,
          });
          setBatchLeagueMatchupProgress(null);
          await reloadAdminData();
          return;
        }

        matchupId = createdMatchup.id;
      }

      const result = await generateLeagueMatchupDraft({
        accessToken,
        matchupId,
      });

      if (!result.ok) {
        setBatchLeagueMatchupStatus({
          error: result.error,
          isLoading: false,
          success: null,
        });
        setBatchLeagueMatchupProgress(null);
        await reloadAdminData();
        return;
      }

      generatedCount += 1;
      if (result.profileWarning) {
        profileWarningCount += 1;
      }
      setBatchLeagueMatchupProgress({
        current: index + 1,
        label: `Generated ${matchupLabel}`,
        total: items.length,
      });
    }

    await reloadAdminData();
    setBatchLeagueMatchupProgress(null);
    setBatchLeagueMatchupStatus({
      error: null,
      isLoading: false,
      success: `${generatedCount} matchup draft${
        generatedCount === 1 ? "" : "s"
      } generated and saved.${
        profileWarningCount > 0
          ? ` ${profileWarningCount} used lower confidence because a combat profile was missing.`
          : " Review before publishing."
      }`,
    });
  }

  async function handleGenerateLeagueMatchupQueueItem(
    item: LeagueMatchupBatchPlanItem,
  ): Promise<LeagueMatchupQueueItemResult> {
    if (!supabase) {
      return {
        error: "Supabase is not configured.",
        ok: false,
      };
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (sessionError || !accessToken) {
      return {
        error: sessionError?.message ?? "Admin session is not ready.",
        ok: false,
      };
    }

    const matchupLabel = getLeagueMatchupPlanLabel(item, adminData.leagueChampions);
    const lanePoolError = getLeagueMatchupPlanLanePoolError(item, adminData.leagueChampions);

    if (lanePoolError) {
      return {
        error: lanePoolError,
        ok: false,
      };
    }

    let matchupId = item.existingMatchupId;

    if (!matchupId) {
      const { data: existingMatchup, error: existingMatchupError } = await supabase
        .from("league_matchups")
        .select(leagueMatchupSelect)
        .eq("champion_a_id", item.championAId)
        .eq("champion_b_id", item.championBId)
        .eq("role", item.role)
        .maybeSingle<AdminLeagueMatchup>();

      if (existingMatchupError) {
        return {
          error: `Could not verify existing row for ${matchupLabel}: ${existingMatchupError.message}`,
          ok: false,
        };
      }

      matchupId = existingMatchup?.id ?? null;

      if (existingMatchup && hasSavedLeagueMatchupDraftContent(existingMatchup)) {
        const refreshOk = await reloadAdminData();

        return {
          matchupId: existingMatchup.id,
          ok: true,
          profileWarning: refreshOk
            ? undefined
            : "Existing saved draft was confirmed, but the admin list could not refresh.",
          skipped: true,
        };
      }
    }

    if (!matchupId) {
      const { data: createdMatchup, error: createError } = await supabase
        .from("league_matchups")
        .upsert(
          {
            champion_a_id: item.championAId,
            champion_b_id: item.championBId,
            role: item.role,
          },
          { onConflict: leagueMatchupRoleConflictTarget },
        )
        .select(leagueMatchupSelect)
        .single<AdminLeagueMatchup>();

      if (createError || !createdMatchup) {
        return {
          error: createError?.message ?? `Could not create matchup row for ${matchupLabel}.`,
          ok: false,
        };
      }

      matchupId = createdMatchup.id;
    }

    const result = await generateLeagueMatchupDraft({
      accessToken,
      matchupId,
    });

    if (!result.ok) {
      return {
        error: `Could not save generated draft for ${matchupLabel}: ${result.error}`,
        ok: false,
      };
    }

    const { data: savedMatchup, error: savedMatchupError } = await supabase
      .from("league_matchups")
      .select(leagueMatchupSelect)
      .eq("id", matchupId)
      .maybeSingle<AdminLeagueMatchup>();

    if (savedMatchupError || !savedMatchup) {
      return {
        error:
          savedMatchupError?.message ??
          `Generated draft for ${matchupLabel} could not be verified after save.`,
        ok: false,
      };
    }

    if (!hasSavedLeagueMatchupDraftContent(savedMatchup)) {
      return {
        error: `Generated draft for ${matchupLabel} saved without matchup guidance content.`,
        ok: false,
      };
    }

    const refreshOk = await reloadAdminData();
    const refreshWarning = refreshOk
      ? undefined
      : "Draft saved, but the admin matchup list could not refresh.";
    const profileWarning = [result.profileWarning, refreshWarning].filter(Boolean).join(" ");

    return {
      matchupId,
      ok: true,
      profileWarning: profileWarning || undefined,
    };
  }

  return (
    <LaneStompPageShell>
        <SiteHeader />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <BackButton href="/" label="Back to dashboard" />
        </div>

        <div>
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-lg bg-violet-500/20 text-violet-100 ring-1 ring-violet-300/20">
              <LockKeyhole className="size-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-mono text-3xl font-semibold tracking-normal text-white sm:text-4xl">
                {pageTitle}
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                {user ? getProfileDisplayName(user, profile) : "Checking admin session..."}
              </p>
            </div>
          </div>
        </div>

        {isLoading ? <AdminDashboardSkeleton /> : null}

        {error && !isLoading ? (
          <Card className="border-rose-400/20 bg-[#10182b]/90 p-8 text-rose-100">{error}</Card>
        ) : null}

        {!isLoading && !error ? (
          <>
            <AdminNavigation activeSection={section} />

            {leagueMatchupsSetupMessage ? (
              <Card className="border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
                {leagueMatchupsSetupMessage}
              </Card>
            ) : null}

            {leagueCounterPicksSetupMessage ? (
              <Card className="border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
                {leagueCounterPicksSetupMessage}
              </Card>
            ) : null}

            {leagueFeedbackSetupMessage ? (
              <Card className="border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
                {leagueFeedbackSetupMessage}
              </Card>
            ) : null}

            <ViewTransition
              key={section}
              name="admin-section-content"
              enter={{
                "admin-section": "admin-section-enter",
                default: "none",
              }}
              exit={{
                "admin-section": "admin-section-exit",
                default: "none",
              }}
              default="none"
            >
              <div className="contents">
                {section === "overview" ? (
                  <AdminOverview
                    leagueChampionsCount={adminData.leagueChampions.length}
                    leagueCounterPicksCount={adminData.leagueCounterPicks.length}
                    leagueDraftMatchupsCount={draftLeagueMatchupsCount}
                    leagueMatchupsCount={adminData.leagueMatchups.length}
                    leagueReviewedMatchupsCount={reviewedLeagueMatchupsCount}
                  />
                ) : null}

                {section === "league-matchups" ? (
                  <AdminLeagueMatchupsSection
                    champions={adminData.leagueChampions}
                    createForm={createLeagueMatchupForm}
                    createStatus={createLeagueMatchupStatus}
                    editForm={editLeagueMatchupForm}
                    editStatus={editLeagueMatchupStatus}
                    editingMatchupId={editingLeagueMatchupId}
                    deletingDraftMatchupId={deletingLeagueMatchupDraftId}
                    batchProgress={batchLeagueMatchupProgress}
                    batchStatus={batchLeagueMatchupStatus}
                    matchups={adminData.leagueMatchups}
                    feedback={adminData.leagueFeedback}
                    onCancelEdit={stopEditingLeagueMatchup}
                    onCreateChange={setCreateLeagueMatchupForm}
                    onCreateSubmit={handleCreateLeagueMatchup}
                    onEditChange={setEditLeagueMatchupForm}
                    onEditSubmit={handleUpdateLeagueMatchup}
                    onDeleteDraft={handleDeleteLeagueMatchupDraft}
                    onGenerateBatch={handleGenerateLeagueMatchupBatch}
                    onGenerateDraft={handleGenerateLeagueMatchupDraft}
                    onGenerateQueueItem={handleGenerateLeagueMatchupQueueItem}
                    onRefresh={reloadAdminData}
                    onMarkReviewed={handleMarkLeagueMatchupReviewed}
                    onMarkReviewedForChampion={handleMarkLeagueMatchupsReviewedForChampion}
                    onUpdateFeedbackStatus={handleUpdateLeagueFeedbackStatus}
                    onStartEdit={startEditingLeagueMatchup}
                    generatingMatchupId={generatingLeagueMatchupId}
                  />
                ) : null}

                {section === "league-counter-picks" ? (
                  <AdminLeagueCounterPicksSection
                    champions={adminData.leagueChampions}
                    counterPicks={adminData.leagueCounterPicks}
                    onRefresh={reloadAdminData}
                    view="editorial"
                  />
                ) : null}

                {section === "counter-picks-overview" ? (
                  <AdminLeagueCounterPicksSection
                    champions={adminData.leagueChampions}
                    counterPicks={adminData.leagueCounterPicks}
                    onRefresh={reloadAdminData}
                    view="overview"
                  />
                ) : null}

                {section === "counter-picks-collect" ? (
                  <AdminLeagueCounterPicksSection
                    champions={adminData.leagueChampions}
                    counterPicks={adminData.leagueCounterPicks}
                    onRefresh={reloadAdminData}
                    view="collect"
                  />
                ) : null}

                {section === "counter-picks-shadow-ranking" ? (
                  <AdminLeagueCounterPicksSection
                    champions={adminData.leagueChampions}
                    counterPicks={adminData.leagueCounterPicks}
                    onRefresh={reloadAdminData}
                    view="shadow-ranking"
                  />
                ) : null}

                {section === "counter-picks-review" ? (
                  <AdminLeagueCounterPicksSection
                    champions={adminData.leagueChampions}
                    counterPicks={adminData.leagueCounterPicks}
                    onRefresh={reloadAdminData}
                    view="review"
                  />
                ) : null}

                {section === "counter-picks-profile-review" ? (
                  <AdminLeagueCounterPicksSection
                    champions={adminData.leagueChampions}
                    counterPicks={adminData.leagueCounterPicks}
                    onRefresh={reloadAdminData}
                    view="profile-review"
                  />
                ) : null}
              </div>
            </ViewTransition>
          </>
        ) : null}
    </LaneStompPageShell>
  );
}

async function fetchAllLeagueMatchups() {
  if (!supabase) {
    return {
      data: null,
      error: { message: "Supabase is not configured." },
    };
  }

  const rows: AdminLeagueMatchup[] = [];

  for (let page = 0; ; page += 1) {
    const from = page * adminDataPageSize;
    const to = from + adminDataPageSize - 1;
    const { data, error } = await supabase
      .from("league_matchups")
      .select(leagueMatchupSelect)
      .order("champion_a_id", { ascending: true })
      .order("champion_b_id", { ascending: true })
      .order("role", { ascending: true })
      .range(from, to);

    if (error) {
      return { data: null, error };
    }

    const pageRows = (data ?? []) as unknown as AdminLeagueMatchup[];

    rows.push(...pageRows);

    if (pageRows.length < adminDataPageSize) {
      return { data: rows, error: null };
    }
  }
}

async function fetchAllLeagueCounterPicks() {
  if (!supabase) {
    return {
      data: null,
      error: { message: "Supabase is not configured." },
    };
  }

  const rows: LeagueCounterPick[] = [];

  for (let page = 0; ; page += 1) {
    const from = page * adminDataPageSize;
    const to = from + adminDataPageSize - 1;
    const { data, error } = await supabase
      .from("league_counter_picks")
      .select(leagueCounterPickSelect)
      .order("champion_id", { ascending: true })
      .order("role", { ascending: true })
      .order("counter_type", { ascending: true })
      .order("win_rate", { ascending: false, nullsFirst: false })
      .range(from, to);

    if (error) {
      return { data: null, error };
    }

    const pageRows = (data ?? []) as unknown as LeagueCounterPick[];

    rows.push(...pageRows);

    if (pageRows.length < adminDataPageSize) {
      return { data: rows, error: null };
    }
  }
}

async function fetchAllLeagueFeedback() {
  if (!supabase) {
    return {
      data: null,
      error: { message: "Supabase is not configured." },
    };
  }

  const { data, error } = await supabase
    .from("matchup_feedback")
    .select(leagueFeedbackSelect)
    .order("created_at", { ascending: false })
    .limit(1000);

  return { data, error };
}

function getSessionWithTimeout(): Promise<SessionResult> {
  if (!supabase) {
    return Promise.resolve({
      data: { session: null },
      error: null,
    });
  }

  return Promise.race([
    supabase.auth.getSession(),
    new Promise<SessionResult>((resolve) => {
      window.setTimeout(() => {
        resolve({
          data: { session: null },
          error: null,
        });
      }, sessionCheckTimeoutMs);
    }),
  ]);
}

function normalizeDraftForForm(
  draft: Pick<
    AdminLeagueMatchup,
    | "danger_windows"
    | "early_game"
    | "overview"
    | "power_spikes"
    | "trading_pattern"
    | "win_conditions"
  >,
): Pick<
  LeagueMatchupFormState,
  | "danger_windows"
  | "early_game"
  | "overview"
  | "power_spikes"
  | "trading_pattern"
  | "win_conditions"
> {
  return {
    danger_windows: draft.danger_windows ?? "",
    early_game: draft.early_game ?? "",
    overview: draft.overview ?? "",
    power_spikes: draft.power_spikes ?? "",
    trading_pattern: draft.trading_pattern ?? "",
    win_conditions: draft.win_conditions ?? "",
  };
}

function getDraftSectionsFromAdminLeagueMatchup(
  matchup: Pick<
    AdminLeagueMatchup,
    | "danger_windows"
    | "early_game"
    | "overview"
    | "power_spikes"
    | "trading_pattern"
    | "win_conditions"
  >,
) {
  return normalizeDraftForForm(matchup);
}

function calculateAdminLeagueMatchupConfidence(matchup: AdminLeagueMatchup) {
  return calculateLeagueMatchupConfidence({
    championAName: matchup.champion_a_id,
    championAProfile: getChampionCombatProfile(matchup.champion_a_id),
    championBName: matchup.champion_b_id,
    championBProfile: getChampionCombatProfile(matchup.champion_b_id),
    draft: getDraftSectionsFromAdminLeagueMatchup(matchup),
    generationSource: getLeagueMatchupConfidenceSourceFromNotes(matchup.admin_notes),
    generationStatus: matchup.generation_status,
  });
}

function logLeagueMatchupConfidenceCalculation(
  matchupId: number,
  confidence: ReturnType<typeof calculateLeagueMatchupConfidence>,
) {
  console.info("League matchup confidence calculation", {
    confidence: confidence.level,
    matchupId,
    reasons: confidence.reasons,
  });
}

function removeLeagueMatchupGenerationFailureNotes(adminNotes: string | null) {
  const paragraphs = adminNotes
    ?.split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph && !paragraph.startsWith("Generation failed "));

  return paragraphs?.length ? paragraphs.join("\n\n") : null;
}

function hasSavedLeagueMatchupDraftContent(
  matchup: Pick<
    AdminLeagueMatchup,
    | "generated_at"
    | "generation_status"
    | "danger_windows"
    | "early_game"
    | "overview"
    | "power_spikes"
    | "trading_pattern"
    | "win_conditions"
  >,
) {
  return (
    Boolean(matchup.generated_at) ||
    matchup.generation_status === "reviewed" ||
    [
      matchup.overview,
      matchup.early_game,
      matchup.trading_pattern,
      matchup.power_spikes,
      matchup.danger_windows,
      matchup.win_conditions,
    ].some((value) => Boolean(value?.trim()))
  );
}

function getLeagueMatchupLanePoolError(
  form: Pick<LeagueMatchupFormState, "champion_a_id" | "champion_b_id" | "role">,
  champions: AdminLeagueChampion[],
) {
  return getLanePoolValidationError(
    {
      championAId: form.champion_a_id,
      championBId: form.champion_b_id,
      role: form.role,
    },
    champions,
  );
}

function getLeagueMatchupPlanLanePoolError(
  item: LeagueMatchupBatchPlanItem,
  champions: AdminLeagueChampion[],
) {
  return getLanePoolValidationError(item, champions);
}

function getLanePoolValidationError(
  item: Pick<LeagueMatchupBatchPlanItem, "championAId" | "championBId" | "role">,
  champions: AdminLeagueChampion[],
) {
  const championsById = new Map(champions.map((champion) => [champion.id, champion] as const));
  const roleLabel = getAdminLeagueRoleLabel(item.role);
  const championA = championsById.get(item.championAId);
  const championB = championsById.get(item.championBId);

  if (!championA) {
    return `Cannot create matchup because ${item.championAId} is not currently available in the champion list.`;
  }

  if (!championB) {
    return `Cannot create matchup because ${item.championBId} is not currently available in the champion list.`;
  }

  if (!isChampionInRole(championA, item.role)) {
    return `Cannot create matchup because ${championA.name} is not currently included in the ${roleLabel} pool.`;
  }

  if (!isChampionInRole(championB, item.role)) {
    return `Cannot create matchup because ${championB.name} is not currently included in the ${roleLabel} pool.`;
  }

  return null;
}

function getLeagueMatchupPlanLabel(
  item: LeagueMatchupBatchPlanItem,
  champions: AdminLeagueChampion[],
) {
  const championNamesById = new Map(
    champions.map((champion) => [champion.id, champion.name] as const),
  );

  return `${
    championNamesById.get(item.championAId) ?? item.championAId
  } vs ${championNamesById.get(item.championBId) ?? item.championBId} (${getAdminLeagueRoleLabel(
    item.role,
  )})`;
}

function getLeagueMatchupLabel(matchup: AdminLeagueMatchup, champions: AdminLeagueChampion[]) {
  const championNamesById = new Map(
    champions.map((champion) => [champion.id, champion.name] as const),
  );

  return `${
    championNamesById.get(matchup.champion_a_id) ?? matchup.champion_a_id
  } vs ${championNamesById.get(matchup.champion_b_id) ?? matchup.champion_b_id}`;
}

function getAdminLeagueRoleLabel(role: AdminLeagueMatchup["role"]) {
  return role === "adc" ? "ADC" : role.charAt(0).toUpperCase() + role.slice(1);
}
