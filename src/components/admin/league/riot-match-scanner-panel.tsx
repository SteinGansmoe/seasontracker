import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Loader2,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  UserPlus,
  X,
} from "lucide-react";

import {
  getMatchupRankCoverageQueue,
  getRecentRiotCollectionJobs,
  getLeagueChampionRegistryAdminStatus,
  getPaginatedRiotSeedCandidates,
  getRiotCollectionJob,
  getRiotCollectionInventory,
  getRecentRiotScanJobs,
  pauseRiotCollectionJob,
  cancelRiotCollectionJob,
  getRiotScanJob,
  rejectRiotSeedCandidates,
  refreshRiotSeedCandidateRanks,
  refreshMatchupRankCoverageParticipants,
  resetRiotSeedCandidateFailures,
  resumeRiotCollectionJob,
  restoreRiotSeedCandidates,
  rerunMatchupRankCoverageAttribution,
  startRiotCollectionJob,
  startRiotScanJob,
  syncLeagueChampionRegistryAdmin,
  type LeagueChampionRegistryAdminStatusResult,
} from "@/src/app/admin/league/counter-picks/actions";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import type {
  MatchupRankAttributionMethod,
  MatchupRankCoverageCandidate,
  MatchupRankCoverageFilters,
  MatchupRankCoverageSort,
  MatchupRankCoverageSummary,
  RiotSeedCandidateFilters,
  RiotSeedCandidateRankEnrichmentStatus,
  RiotSeedCandidateSort,
  RiotSeedCandidateSource,
  RiotSeedCandidateStatus,
  RiotSeedCandidateTopChampion,
  RiotSeedCandidateView,
  RiotScanDiscoveryResult,
  RiotScanJobView,
  RiotScanMode,
  RiotScanTargetResult,
} from "@/src/features/league/riot-scan-jobs";
import { shouldRefreshCounterPickManagementMetricsForJobTransition } from "@/src/features/league/counter-pick-management-metrics";
import {
  getRiotCollectionProgressPercent,
  isRiotCollectionTerminalStatus,
  riotCollectionRankBrackets,
  riotCollectionStatusLabels,
  riotCollectionStopReasonLabels,
  riotCollectionTargets,
  type RiotCollectionDiscoveryDiagnostics,
  type RiotCollectionJobView,
  type RiotCollectionRankBracket,
  type RiotCollectionRole,
  type RiotCollectionTarget,
} from "@/src/features/league/riot-collection-jobs";
import {
  seedCandidateLifecycleLabels,
  seedCandidateLifecycleReasonLabels,
  seedCandidateLifecycleStates,
  type SeedCandidateLifecycleState,
} from "@/src/features/league/riot-seed-candidate-lifecycle";
import {
  createDefaultRiotSeedCandidateGroupRequest,
  getDefaultRiotSeedCandidateSortDirection,
  getRiotSeedCandidateRange,
  riotSeedCandidatePageSizes,
  riotSeedCandidateRankGroups,
  type PaginatedSeedCandidates,
  type RiotSeedCandidateGroupPageRequest,
  type RiotSeedCandidateRankGroupId,
  type RiotSeedCandidateSortDirection,
} from "@/src/features/league/riot-seed-candidate-rank-groups";
import { leagueRoles, type LeagueRole } from "@/src/features/league/roles";
import { supabase } from "@/src/lib/supabase";
import { cn } from "@/src/lib/utils";
import { fieldClassName, selectOptionClassName } from "../constants";
import type { AdminLeagueChampion, FormStatus } from "../types";

const maxMatchCount = 50;
const maxDisplayedResults = 100;
const maxSeedCandidatesPerScan = 20;
const maxSeedCandidateRankRefreshBatch = 20;
const recentSeedCandidateScanHours = 24;
const recentSeedCandidateRankRefreshHours = 24;
const seedCandidateStatuses: Array<RiotSeedCandidateStatus | "all"> = [
  "all",
  "candidate",
  "approved",
  "queued",
  "active",
  "cooldown",
  "ignored",
  "failed",
];
const seedCandidateRankStatuses: Array<RiotSeedCandidateRankEnrichmentStatus | "all"> = [
  "all",
  "pending",
  "queued",
  "running",
  "ranked",
  "unranked",
  "not_found",
  "rate_limited",
  "failed",
];
const seedCandidateRankTiers = [
  "all",
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
] as const;
const seedCandidateSources: Array<RiotSeedCandidateSource | "all"> = [
  "all",
  "match_discovery",
  "matchup_rank_coverage",
  "riot_id_resolver",
  "manual",
  "ladder_import",
];
const seedCandidateSorts: Array<{
  label: string;
  value: RiotSeedCandidateSort;
}> = [
  { label: "Observed games", value: "observed_games" },
  { label: "Last seen", value: "last_seen_at" },
  { label: "Last scanned", value: "last_scanned_at" },
  { label: "Primary role share", value: "primary_role_share" },
  { label: "Primary champion share", value: "primary_champion_share" },
  { label: "Rank tier", value: "rank_tier" },
  { label: "League points", value: "rank_league_points" },
  { label: "Rank refreshed", value: "rank_last_success_at" },
  { label: "Created", value: "created_at" },
];
const seedCandidateLastScannedFilters: Array<{
  label: string;
  value: NonNullable<RiotSeedCandidateFilters["lastScanned"]>;
}> = [
  { label: "All", value: "all" },
  { label: "Never scanned", value: "never" },
  { label: "Scanned within 24h", value: "recent" },
  { label: "Not scanned within 24h", value: "older" },
];
const seedCandidateRankRefreshFilters: Array<{
  label: string;
  value: NonNullable<RiotSeedCandidateFilters["rankLastRefreshed"]>;
}> = [
  { label: "All", value: "all" },
  { label: "Never refreshed", value: "never" },
  { label: "Refreshed within 24h", value: "recent" },
  { label: "Not refreshed within 24h", value: "older" },
];
const matchupCoverageAttributionFilters: Array<MatchupRankAttributionMethod | "all"> = [
  "all",
  "unknown",
  "single-player",
  "two-player-average",
];
const matchupCoverageCandidateFilters: Array<
  NonNullable<MatchupRankCoverageFilters["hasCandidate"]>
> = ["all", "yes", "no"];
const matchupCoverageSorts: Array<{
  label: string;
  value: MatchupRankCoverageSort;
}> = [
  { label: "Priority score", value: "priority_score" },
  { label: "Observations affected", value: "observations_affected" },
  { label: "Unknown affected", value: "unknown_observations_affected" },
  { label: "Two-player upgrades", value: "two_player_upgrade_potential" },
  { label: "Latest match seen", value: "latest_match_seen_at" },
  { label: "Last rank refresh", value: "last_rank_refresh_at" },
];
const seedCandidateLifecycleFilters: Array<SeedCandidateLifecycleState | "all"> = [
  "ready-to-scan",
  "recently-scanned",
  "cooling-down",
  "needs-rank-enrichment",
  "failed",
  "low-signal",
  "observed",
  "rejected",
  "all",
];
type LeagueChampionRegistryStatus = Extract<
  LeagueChampionRegistryAdminStatusResult,
  { ok: true }
>["status"];

type SeedCandidateGroupState = PaginatedSeedCandidates & {
  error: string | null;
  isExpanded: boolean;
  isLoading: boolean;
  loaded: boolean;
  sort: RiotSeedCandidateSort;
  sortDirection: RiotSeedCandidateSortDirection;
};

type SeedCandidateGroupStates = Record<RiotSeedCandidateRankGroupId, SeedCandidateGroupState>;

export function RiotMatchScannerPanel({
  champions,
  onScanTerminal,
}: {
  champions: AdminLeagueChampion[];
  onScanTerminal?: () => Promise<void> | void;
}) {
  const scannerCardRef = useRef<HTMLDivElement | null>(null);
  const terminalRefreshJobIdsRef = useRef<Set<number>>(new Set());
  const [mode, setMode] = useState<RiotScanMode>("target");
  const [seedText, setSeedText] = useState("");
  const [role, setRole] = useState<LeagueRole>("mid");
  const [matchCount, setMatchCount] = useState("20");
  const [currentPatchOnly, setCurrentPatchOnly] = useState(true);
  const [enemyChampionInput, setEnemyChampionInput] = useState("Ahri");
  const [counterChampionInput, setCounterChampionInput] = useState("Yasuo");
  const [discoveryFocusChampionInput, setDiscoveryFocusChampionInput] = useState("");
  const [minimumGames, setMinimumGames] = useState("2");
  const [displayLimit, setDisplayLimit] = useState("20");
  const [activeJob, setActiveJob] = useState<RiotScanJobView | null>(null);
  const [recentJobs, setRecentJobs] = useState<RiotScanJobView[]>([]);
  const [seedCandidateRefreshKey, setSeedCandidateRefreshKey] = useState(0);
  const [formStatus, setFormStatus] = useState<FormStatus>({
    error: null,
    isLoading: false,
    success: null,
  });
  const [jobsStatus, setJobsStatus] = useState<FormStatus>({
    error: null,
    isLoading: false,
    success: null,
  });
  const uniqueSeedPuuids = useMemo(() => parseSeedPuuids(seedText), [seedText]);
  const championOptions = useMemo(
    () =>
      [...champions].sort((left, right) => {
        return left.name.localeCompare(right.name);
      }),
    [champions],
  );
  const championDisplayNamesById = useMemo(
    () => new Map(champions.map((champion) => [champion.id, champion.name] as const)),
    [champions],
  );

  useEffect(() => {
    void refreshRecentJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeJob || (activeJob.status !== "queued" && activeJob.status !== "running")) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshJob(activeJob.id);
    }, 2500);

    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJob]);

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

  async function refreshRecentJobs() {
    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setJobsStatus({ error: tokenResult.error, isLoading: false, success: null });
      return;
    }

    setJobsStatus({ error: null, isLoading: true, success: null });

    const result = await getRecentRiotScanJobs({
      accessToken: tokenResult.accessToken,
      limit: 10,
    });

    if (!result.ok) {
      setJobsStatus({ error: result.error, isLoading: false, success: null });
      return;
    }

    setRecentJobs(result.jobs);
    setJobsStatus({ error: null, isLoading: false, success: null });
  }

  async function refreshJob(jobId: number) {
    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setJobsStatus({ error: tokenResult.error, isLoading: false, success: null });
      return;
    }

    const result = await getRiotScanJob({
      accessToken: tokenResult.accessToken,
      jobId,
    });

    if (!result.ok) {
      setJobsStatus({ error: result.error, isLoading: false, success: null });
      return;
    }

    const shouldRefreshAfterTerminalTransition =
      activeJob?.id === result.job.id &&
      shouldRefreshCounterPickManagementMetricsForJobTransition({
        alreadyRefreshed: terminalRefreshJobIdsRef.current.has(result.job.id),
        nextStatus: result.job.status,
        previousStatus: activeJob.status,
      });

    setActiveJob(result.job);
    setRecentJobs((currentJobs) =>
      [result.job, ...currentJobs.filter((job) => job.id !== result.job.id)].slice(0, 10),
    );

    if (shouldRefreshAfterTerminalTransition) {
      terminalRefreshJobIdsRef.current.add(result.job.id);
      await refreshAfterTerminalScan();
    }
  }

  async function handleSubmit() {
    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setFormStatus({ error: tokenResult.error, isLoading: false, success: null });
      return;
    }

    const enemyChampion = resolveChampionId(enemyChampionInput, champions);
    const counterChampion = resolveChampionId(counterChampionInput, champions);
    const discoveryFocusChampion =
      mode === "discovery" && discoveryFocusChampionInput.trim()
        ? resolveChampionId(discoveryFocusChampionInput, champions)
        : null;
    const parsedMatchCount = Number(matchCount);
    const parsedMinimumGames = Number(minimumGames);
    const parsedDisplayLimit = Number(displayLimit);

    if (uniqueSeedPuuids.length === 0) {
      setFormStatus({ error: "Add at least one Seed PUUID.", isLoading: false, success: null });
      return;
    }

    if (uniqueSeedPuuids.length > maxSeedCandidatesPerScan) {
      setFormStatus({
        error: `You selected ${uniqueSeedPuuids.length} seed candidates. The maximum per scan job is ${maxSeedCandidatesPerScan}.`,
        isLoading: false,
        success: null,
      });
      return;
    }

    if (
      !Number.isInteger(parsedMatchCount) ||
      parsedMatchCount < 1 ||
      parsedMatchCount > maxMatchCount
    ) {
      setFormStatus({
        error: `Match count must be between 1 and ${maxMatchCount}.`,
        isLoading: false,
        success: null,
      });
      return;
    }

    if (mode === "target" && (!enemyChampion || !counterChampion)) {
      setFormStatus({
        error: "Select valid enemy and counter champions.",
        isLoading: false,
        success: null,
      });
      return;
    }

    if (mode === "target" && enemyChampion === counterChampion) {
      setFormStatus({
        error: "Enemy and counter champion cannot be the same.",
        isLoading: false,
        success: null,
      });
      return;
    }

    const hasInvalidDiscoveryLimits =
      !Number.isInteger(parsedMinimumGames) ||
      parsedMinimumGames < 1 ||
      !Number.isInteger(parsedDisplayLimit) ||
      parsedDisplayLimit < 1 ||
      parsedDisplayLimit > maxDisplayedResults;

    if (mode === "discovery" && hasInvalidDiscoveryLimits) {
      setFormStatus({
        error: `Discovery limits must be valid numbers. Display limit max is ${maxDisplayedResults}.`,
        isLoading: false,
        success: null,
      });
      return;
    }

    if (mode === "discovery" && discoveryFocusChampionInput.trim() && !discoveryFocusChampion) {
      setFormStatus({
        error: "Select a valid discovery focus champion.",
        isLoading: false,
        success: null,
      });
      return;
    }

    setFormStatus({ error: null, isLoading: true, success: null });

    const result = await startRiotScanJob({
      accessToken: tokenResult.accessToken,
      counterChampion,
      currentPatchOnly,
      discoveryFocusChampion,
      enemyChampion,
      matchCount: parsedMatchCount,
      maxDisplayedResults: parsedDisplayLimit,
      minimumGames: parsedMinimumGames,
      mode,
      role,
      seedPuuids: uniqueSeedPuuids,
    });

    if (!result.ok) {
      setFormStatus({ error: result.error, isLoading: false, success: null });
      return;
    }

    setActiveJob(result.job);
    setSeedText("");
    setFormStatus({ error: null, isLoading: false, success: "Riot scan job started." });
    await refreshRecentJobs();
  }

  function addPuuidsToScanner(puuids: string[]) {
    const currentPuuids = parseSeedPuuids(seedText);
    const nextPuuids = uniqueStrings([...currentPuuids, ...puuids]);
    const addedCount = nextPuuids.length - currentPuuids.length;

    setSeedText(nextPuuids.join("\n"));
    setFormStatus({
      error: null,
      isLoading: false,
      success:
        addedCount > 0
          ? `${addedCount} ${addedCount === 1 ? "PUUID" : "PUUIDs"} added to scanner.`
          : "Those PUUIDs are already in the scanner.",
    });
    return addedCount;
  }

  function focusScanner() {
    scannerCardRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function handleSelectedScanStarted(job: RiotScanJobView) {
    setActiveJob(job);
    setRecentJobs((currentJobs) => [job, ...currentJobs.filter((item) => item.id !== job.id)]);
    void refreshRecentJobs();
  }

  async function refreshAfterTerminalScan() {
    setSeedCandidateRefreshKey((currentKey) => currentKey + 1);
    await Promise.all([onScanTerminal?.(), refreshRecentJobs()]);
  }

  return (
    <div className="space-y-6">
      <LeagueChampionRegistryStatusPanel getAccessToken={getAccessToken} />
      <RiotCollectionJobsPanel
        champions={championOptions}
        championDisplayNamesById={championDisplayNamesById}
        getAccessToken={getAccessToken}
        onCollectionTransition={async () => {
          setSeedCandidateRefreshKey((currentKey) => currentKey + 1);
          await Promise.all([onScanTerminal?.(), refreshRecentJobs()]);
        }}
      />
      <RiotSeedCandidatesPanel
        champions={championOptions}
        championDisplayNamesById={championDisplayNamesById}
        getAccessToken={getAccessToken}
        onAddPuuids={addPuuidsToScanner}
        onFocusScanner={focusScanner}
        onScanStarted={handleSelectedScanStarted}
        refreshSignal={seedCandidateRefreshKey}
      />
      <MatchupRankCoverageQueuePanel
        championDisplayNamesById={championDisplayNamesById}
        champions={championOptions}
        getAccessToken={getAccessToken}
      />

      <Card
        className="border-white/10 bg-[#10182b]/90 text-white shadow-xl shadow-black/15"
        ref={scannerCardRef}
      >
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="font-mono text-xl">Riot Match Scanner</CardTitle>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                Run focused Riot match scans for Counter Pick stats and discovery.
              </p>
            </div>
            <Button
              className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
              onClick={() => void refreshRecentJobs()}
              type="button"
              variant="ghost"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Refresh jobs
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-black/20 p-1">
                <ModeButton active={mode === "target"} onClick={() => setMode("target")}>
                  Target matchup
                </ModeButton>
                <ModeButton active={mode === "discovery"} onClick={() => setMode("discovery")}>
                  Matchup discovery
                </ModeButton>
              </div>

              <label className="block space-y-2">
                <span className="text-sm text-zinc-300">Seed PUUIDs</span>
                <textarea
                  className={`${fieldClassName} min-h-36 py-2 leading-6`}
                  disabled={formStatus.isLoading}
                  onChange={(event) => setSeedText(event.target.value)}
                  placeholder="One PUUID per line"
                  value={seedText}
                />
                <span className="text-xs text-zinc-500">
                  {uniqueSeedPuuids.length} unique seed{" "}
                  {uniqueSeedPuuids.length === 1 ? "PUUID" : "PUUIDs"} parsed
                </span>
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="block space-y-2">
                  <span className="text-sm text-zinc-300">Role</span>
                  <select
                    className={`${fieldClassName} h-10`}
                    disabled={formStatus.isLoading}
                    onChange={(event) => setRole(event.target.value as LeagueRole)}
                    value={role}
                  >
                    {leagueRoles.map((leagueRole) => (
                      <option className={selectOptionClassName} key={leagueRole} value={leagueRole}>
                        {getRoleLabel(leagueRole)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm text-zinc-300">Match count per seed</span>
                  <Input
                    className="h-10 border-white/10 bg-white/5 text-zinc-100 focus-visible:border-violet-400/70 focus-visible:ring-violet-400/20"
                    disabled={formStatus.isLoading}
                    max={maxMatchCount}
                    min={1}
                    onChange={(event) => setMatchCount(event.target.value)}
                    type="number"
                    value={matchCount}
                  />
                </label>

                <label className="flex items-end gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">
                  <input
                    checked={currentPatchOnly}
                    className="size-4 accent-cyan-400"
                    disabled={formStatus.isLoading}
                    onChange={(event) => setCurrentPatchOnly(event.target.checked)}
                    type="checkbox"
                  />
                  Current patch only
                </label>
              </div>

              {mode === "target" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <ChampionSearchInput
                    disabled={formStatus.isLoading}
                    label="Enemy champion"
                    onChange={setEnemyChampionInput}
                    options={championOptions}
                    value={enemyChampionInput}
                  />
                  <ChampionSearchInput
                    disabled={formStatus.isLoading}
                    label="Counter champion"
                    onChange={setCounterChampionInput}
                    options={championOptions}
                    value={counterChampionInput}
                  />
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  <ChampionSearchInput
                    disabled={formStatus.isLoading}
                    label="Focus champion (optional)"
                    onChange={setDiscoveryFocusChampionInput}
                    options={championOptions}
                    value={discoveryFocusChampionInput}
                  />
                  <label className="block space-y-2">
                    <span className="text-sm text-zinc-300">Minimum games</span>
                    <Input
                      className="h-10 border-white/10 bg-white/5 text-zinc-100 focus-visible:border-violet-400/70 focus-visible:ring-violet-400/20"
                      disabled={formStatus.isLoading}
                      min={1}
                      onChange={(event) => setMinimumGames(event.target.value)}
                      type="number"
                      value={minimumGames}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm text-zinc-300">Maximum displayed results</span>
                    <Input
                      className="h-10 border-white/10 bg-white/5 text-zinc-100 focus-visible:border-violet-400/70 focus-visible:ring-violet-400/20"
                      disabled={formStatus.isLoading}
                      max={maxDisplayedResults}
                      min={1}
                      onChange={(event) => setDisplayLimit(event.target.value)}
                      type="number"
                      value={displayLimit}
                    />
                  </label>
                </div>
              )}

              <StatusMessage status={formStatus} />

              <Button
                className="h-10 bg-violet-500/80 px-4 text-white hover:bg-violet-500"
                disabled={formStatus.isLoading}
                onClick={() => void handleSubmit()}
                type="button"
              >
                {formStatus.isLoading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Play className="size-4" aria-hidden="true" />
                )}
                {formStatus.isLoading ? "Starting..." : "Start scan"}
              </Button>
            </div>

            <div className="space-y-4">
              {activeJob ? (
                <RiotScanJobDetails
                  championDisplayNamesById={championDisplayNamesById}
                  job={activeJob}
                />
              ) : (
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-400">
                  Start or open a scan job to see progress and results.
                </div>
              )}

              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-white">Recent scan jobs</h3>
                  {jobsStatus.isLoading ? (
                    <Loader2 className="size-4 animate-spin text-zinc-500" aria-hidden="true" />
                  ) : null}
                </div>
                {jobsStatus.error ? (
                  <p className="rounded-md border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-100">
                    {jobsStatus.error}
                  </p>
                ) : recentJobs.length === 0 ? (
                  <p className="text-sm text-zinc-500">No scan jobs yet.</p>
                ) : (
                  <div className="space-y-2">
                    {recentJobs.map((job) => (
                      <button
                        className="grid w-full gap-2 rounded-md border border-white/10 bg-black/15 p-3 text-left text-sm transition hover:bg-white/[0.06] md:grid-cols-[1fr_auto]"
                        key={job.id}
                        onClick={() => setActiveJob(job)}
                        type="button"
                      >
                        <span>
                          <span className="font-semibold text-white">{getModeLabel(job.mode)}</span>
                          <span className="ml-2 text-zinc-400">
                            {getRoleLabel(job.role)} - {getStatusLabel(job.status)}
                          </span>
                          <span className="mt-1 block text-xs text-zinc-500">
                            Scanned {formatNumber(job.summary.matchesScanned)} -{" "}
                            {formatDateTime(job.created_at)}
                          </span>
                          {job.focus_champion_id ? (
                            <span className="mt-1 block text-xs text-cyan-200">
                              Focus:{" "}
                              {championDisplayNamesById.get(job.focus_champion_id) ??
                                job.summary.focusChampionDisplayName ??
                                job.focus_champion_id}
                            </span>
                          ) : null}
                        </span>
                        <span className="text-xs font-semibold text-cyan-200">Open details</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LeagueChampionRegistryStatusPanel({
  getAccessToken,
}: {
  getAccessToken: () => Promise<
    | {
        accessToken: string;
        ok: true;
      }
    | {
        error: string;
        ok: false;
      }
  >;
}) {
  const [registryStatus, setRegistryStatus] = useState<LeagueChampionRegistryStatus | null>(null);
  const [status, setStatus] = useState<FormStatus>({
    error: null,
    isLoading: false,
    success: null,
  });

  useEffect(() => {
    void loadRegistryStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRegistryStatus() {
    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setStatus({ error: tokenResult.error, isLoading: false, success: null });
      return;
    }

    setStatus({ error: null, isLoading: true, success: null });

    const result = await getLeagueChampionRegistryAdminStatus({
      accessToken: tokenResult.accessToken,
    });

    if (!result.ok) {
      setStatus({ error: result.error, isLoading: false, success: null });
      return;
    }

    setRegistryStatus(result.status);
    setStatus({ error: null, isLoading: false, success: null });
  }

  async function syncRegistry() {
    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setStatus({ error: tokenResult.error, isLoading: false, success: null });
      return;
    }

    setStatus({ error: null, isLoading: true, success: null });

    const result = await syncLeagueChampionRegistryAdmin({
      accessToken: tokenResult.accessToken,
    });

    if (!result.ok) {
      setStatus({ error: result.error, isLoading: false, success: null });
      return;
    }

    setRegistryStatus(result.status);

    const summary = result.summary;
    const syncMessage = `Registry sync ${summary.failed > 0 ? "finished with failures" : "complete"}: ${formatNumber(summary.inserted)} inserted, ${formatNumber(summary.updated)} updated, ${formatNumber(summary.skipped)} skipped, ${formatNumber(summary.remainingMissing)} remaining missing.`;

    setStatus({
      error:
        summary.failed > 0
          ? `${syncMessage} ${summary.failures.join(" ")}`
          : null,
      isLoading: false,
      success: summary.failed > 0 ? null : syncMessage,
    });
  }

  const issueCount =
    (registryStatus?.missingCount ?? 0) +
    (registryStatus?.unknownCount ?? 0) +
    (registryStatus?.conflictCount ?? 0) +
    (registryStatus?.inactiveReturnedByRiotCount ?? 0) +
    (registryStatus?.nameMismatchCount ?? 0);

  return (
    <Card className="border-white/10 bg-[#10182b]/90 text-white shadow-xl shadow-black/15">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="font-mono text-xl">League Champion Registry</CardTitle>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Read-only health check for the canonical Data Dragon champion registry.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="border-cyan-300/30 bg-cyan-500/15 text-cyan-50 hover:bg-cyan-500/25"
              disabled={status.isLoading}
              onClick={() => void syncRegistry()}
              type="button"
            >
              {status.isLoading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              Sync missing champions
            </Button>
            <Button
              className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
              disabled={status.isLoading}
              onClick={() => void loadRegistryStatus()}
              type="button"
              variant="ghost"
            >
              {status.isLoading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              Refresh registry
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <StatusMessage status={status} />

        {registryStatus ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Registry"
                value={registryStatus.registryOk ? "Healthy" : "Needs sync"}
              />
              <Metric label="Patch" value={registryStatus.sourceVersion} />
              <Metric label="Source champions" value={registryStatus.sourceChampionCount} />
              <Metric label="Active champions" value={registryStatus.activeDatabaseChampionCount} />
              <Metric label="Database rows" value={registryStatus.databaseChampionCount} />
              <Metric label="Missing" value={registryStatus.missingCount} />
              <Metric label="Unknown active" value={registryStatus.unknownCount} />
              <Metric label="Last sync" value={formatDateTime(registryStatus.lastSyncedAt)} />
            </div>

            <div
              className={cn(
                "rounded-lg border p-4 text-sm",
                registryStatus.registryOk
                  ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
                  : "border-amber-300/20 bg-amber-500/10 text-amber-100",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-semibold">
                  {registryStatus.registryOk
                    ? "Registry matches Riot Data Dragon."
                    : `${issueCount} registry ${issueCount === 1 ? "issue" : "issues"} detected.`}
                </span>
                <span className="text-xs">
                  Sync status: {formatEnumLabel(registryStatus.lastSyncStatus)}
                </span>
              </div>
              {registryStatus.lastSyncError ? (
                <p className="mt-2 text-xs">{registryStatus.lastSyncError}</p>
              ) : null}
            </div>

            {!registryStatus.registryOk ? (
              <div className="grid gap-3 lg:grid-cols-2">
                <RegistryIssueList label="Missing champions" values={registryStatus.missing} />
                <RegistryIssueList
                  label="Unknown active champions"
                  values={registryStatus.unknown}
                />
                <RegistryIssueList label="Conflicts" values={registryStatus.conflicts} />
                <RegistryIssueList label="Name mismatches" values={registryStatus.nameMismatches} />
                <RegistryIssueList
                  label="Inactive but returned by Riot"
                  values={registryStatus.inactiveReturnedByRiot}
                />
              </div>
            ) : null}
          </>
        ) : status.isLoading ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-500">
            Checking registry status...
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RegistryIssueList({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/15 p-3">
      <h3 className="text-sm font-semibold text-white">{label}</h3>
      <ul className="mt-2 space-y-1 text-xs text-zinc-400">
        {values.map((value) => (
          <li className="break-words" key={value}>
            {value}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MatchupRankCoverageQueuePanel({
  championDisplayNamesById,
  champions,
  getAccessToken,
}: {
  championDisplayNamesById: Map<string, string>;
  champions: AdminLeagueChampion[];
  getAccessToken: () => Promise<
    | {
        accessToken: string;
        ok: true;
      }
    | {
        error: string;
        ok: false;
      }
  >;
}) {
  const [candidates, setCandidates] = useState<MatchupRankCoverageCandidate[]>([]);
  const [summary, setSummary] = useState<MatchupRankCoverageSummary | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasLoadedQueue, setHasLoadedQueue] = useState(false);
  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(null);
  const [selectedCandidateKeys, setSelectedCandidateKeys] = useState<Set<string>>(() => new Set());
  const [status, setStatus] = useState<FormStatus>({
    error: null,
    isLoading: false,
    success: null,
  });
  const [refreshSummary, setRefreshSummary] = useState<{
    candidatesRequested: number;
    createdCandidateCount: number;
    failedCount: number;
    notFoundCount: number;
    rankedCount: number;
    rateLimitedCount: number;
    skippedCount: number;
    snapshotInsertedCount: number;
    total: number;
    unrankedCount: number;
  } | null>(null);
  const [attributionSummary, setAttributionSummary] = useState<{
    failures: number;
    participantsNotFound: number;
    processed: number;
    singlePlayer: number;
    snapshotTooOld: number;
    total: number;
    twoPlayerAverage: number;
    unknown: number;
  } | null>(null);
  const [roleFilter, setRoleFilter] = useState<LeagueRole | "all">("all");
  const [championFilter, setChampionFilter] = useState("");
  const [patchFilter, setPatchFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("EUW1");
  const [attributionFilter, setAttributionFilter] = useState<MatchupRankAttributionMethod | "all">(
    "all",
  );
  const [hasCandidateFilter, setHasCandidateFilter] =
    useState<NonNullable<MatchupRankCoverageFilters["hasCandidate"]>>("all");
  const [rankStatusFilter, setRankStatusFilter] =
    useState<NonNullable<MatchupRankCoverageFilters["rankStatus"]>>("all");
  const [minimumImpact, setMinimumImpact] = useState("1");
  const [twoPlayerUpgradeOnly, setTwoPlayerUpgradeOnly] = useState(false);
  const [limit, setLimit] = useState("20");
  const [sort, setSort] = useState<MatchupRankCoverageSort>("priority_score");
  const [forceRefresh, setForceRefresh] = useState(false);
  const selectedCandidates = useMemo(
    () => candidates.filter((candidate) => selectedCandidateKeys.has(candidate.identityKey)),
    [candidates, selectedCandidateKeys],
  );
  const projectedImpact = useMemo(
    () =>
      selectedCandidates.reduce(
        (projection, candidate) => ({
          observationsAffected: projection.observationsAffected + candidate.observationsAffected,
          twoPlayerUpgradePotential:
            projection.twoPlayerUpgradePotential + candidate.twoPlayerUpgradePotential,
          unknownObservationsAffected:
            projection.unknownObservationsAffected + candidate.unknownObservationsAffected,
        }),
        {
          observationsAffected: 0,
          twoPlayerUpgradePotential: 0,
          unknownObservationsAffected: 0,
        },
      ),
    [selectedCandidates],
  );
  const allVisibleSelected =
    candidates.length > 0 &&
    candidates.every((candidate) => selectedCandidateKeys.has(candidate.identityKey));
  const panelId = "matchup-rank-coverage-queue-panel";

  function buildFilters(): MatchupRankCoverageFilters {
    const parsedMinimumImpact = Number(minimumImpact);

    return {
      attributionMethod: attributionFilter,
      champion: championFilter || null,
      hasCandidate: hasCandidateFilter,
      minimumImpact:
        Number.isFinite(parsedMinimumImpact) && parsedMinimumImpact > 0
          ? parsedMinimumImpact
          : undefined,
      patch: patchFilter.trim() || null,
      platformRegion: platformFilter.trim() || null,
      rankStatus: rankStatusFilter,
      role: roleFilter,
      twoPlayerUpgradeOnly,
    };
  }

  async function loadQueue({ preserveFeedback = false }: { preserveFeedback?: boolean } = {}) {
    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setStatus({ error: tokenResult.error, isLoading: false, success: null });
      return;
    }

    if (!preserveFeedback) {
      setStatus({ error: null, isLoading: true, success: null });
    }

    const result = await getMatchupRankCoverageQueue({
      accessToken: tokenResult.accessToken,
      filters: buildFilters(),
      limit: Number(limit),
      sort,
      sortDirection: "desc",
    });

    if (!result.ok) {
      setStatus({ error: result.error, isLoading: false, success: null });
      return;
    }

    setHasLoadedQueue(true);
    setCandidates(result.candidates);
    setSummary(result.summary);
    setSelectedCandidateKeys((currentSelection) => {
      const visibleKeys = new Set(result.candidates.map((candidate) => candidate.identityKey));

      return new Set([...currentSelection].filter((key) => visibleKeys.has(key)));
    });
    if (!preserveFeedback) {
      setStatus({
        error: null,
        isLoading: false,
        success: `${result.candidates.length} coverage ${result.candidates.length === 1 ? "candidate" : "candidates"} loaded.`,
      });
    }
  }

  function toggleQueuePanel() {
    setIsExpanded((currentExpanded) => {
      const nextExpanded = !currentExpanded;

      if (nextExpanded && !hasLoadedQueue && !status.isLoading) {
        void loadQueue();
      }

      return nextExpanded;
    });
  }

  function toggleSelection(candidate: MatchupRankCoverageCandidate) {
    setSelectedCandidateKeys((currentSelection) => {
      const nextSelection = new Set(currentSelection);

      if (nextSelection.has(candidate.identityKey)) {
        nextSelection.delete(candidate.identityKey);
      } else {
        nextSelection.add(candidate.identityKey);
      }

      return nextSelection;
    });
  }

  function selectAllVisible() {
    setSelectedCandidateKeys(new Set(candidates.map((candidate) => candidate.identityKey)));
    setStatus({
      error: null,
      isLoading: false,
      success: `${candidates.length} visible ${candidates.length === 1 ? "participant" : "participants"} selected.`,
    });
  }

  function clearSelection() {
    setSelectedCandidateKeys(new Set());
    setStatus({ error: null, isLoading: false, success: "Coverage selection cleared." });
  }

  async function refreshSelectedRanks() {
    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setStatus({ error: tokenResult.error, isLoading: false, success: null });
      return;
    }

    if (selectedCandidates.length === 0) {
      setStatus({ error: "Select at least one participant.", isLoading: false, success: null });
      return;
    }

    if (selectedCandidates.length > maxSeedCandidateRankRefreshBatch) {
      setStatus({
        error: `Refresh rank for up to ${maxSeedCandidateRankRefreshBatch} participants at a time.`,
        isLoading: false,
        success: null,
      });
      return;
    }

    setStatus({ error: null, isLoading: true, success: null });
    const result = await refreshMatchupRankCoverageParticipants({
      accessToken: tokenResult.accessToken,
      force: forceRefresh,
      participants: selectedCandidates.map((candidate) => ({
        platformRegion: candidate.platformRegion,
        puuid: candidate.puuid,
      })),
    });

    if (!result.ok) {
      setStatus({ error: result.error, isLoading: false, success: null });
      return;
    }

    setRefreshSummary(result);
    setStatus({
      error: null,
      isLoading: false,
      success: "Rank refresh complete.",
    });
    await loadQueue({ preserveFeedback: true });
  }

  async function rerunAttribution() {
    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setStatus({ error: tokenResult.error, isLoading: false, success: null });
      return;
    }

    setStatus({ error: null, isLoading: true, success: null });
    const result = await rerunMatchupRankCoverageAttribution({
      accessToken: tokenResult.accessToken,
      filters: buildFilters(),
    });

    if (!result.ok) {
      setStatus({ error: result.error, isLoading: false, success: null });
      return;
    }

    setAttributionSummary(result.summary);
    setStatus({
      error: null,
      isLoading: false,
      success: "Rank attribution re-run complete.",
    });
    await loadQueue({ preserveFeedback: true });
  }

  return (
    <Card className="border-white/10 bg-[#10182b]/90 text-white shadow-xl shadow-black/15">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="font-mono text-xl">Rank Attribution Coverage Queue</CardTitle>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Prioritize matchup participants whose missing rank snapshots block stored matchup
              attribution.
            </p>
          </div>
          <button
            aria-controls={panelId}
            aria-expanded={isExpanded}
            className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/10"
            onClick={toggleQueuePanel}
            type="button"
          >
            {isExpanded ? (
              <ChevronDown className="size-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-4" aria-hidden="true" />
            )}
            {isExpanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </CardHeader>
      {isExpanded ? (
        <CardContent className="space-y-5" id={panelId}>
          <Button
            className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
            disabled={status.isLoading}
            onClick={() => void loadQueue()}
            type="button"
            variant="ghost"
          >
            {status.isLoading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            Refresh queue
          </Button>

          {!hasLoadedQueue && status.isLoading ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-500">
              Loading rank attribution coverage queue...
            </div>
          ) : null}

          {summary ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Metric label="Total observations" value={formatNumber(summary.totalObservations)} />
              <Metric label="Two-player average" value={formatNumber(summary.twoPlayerAverage)} />
              <Metric label="Single-player" value={formatNumber(summary.singlePlayer)} />
              <Metric label="Unknown" value={formatNumber(summary.unknown)} />
              <Metric
                label="Strict / any coverage"
                value={`${summary.strictCoveragePercent}% / ${summary.anyRankCoveragePercent}%`}
              />
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">Role</span>
              <select
                className={`${fieldClassName} h-10`}
                onChange={(event) => setRoleFilter(event.target.value as LeagueRole | "all")}
                value={roleFilter}
              >
                <option className={selectOptionClassName} value="all">
                  All roles
                </option>
                {leagueRoles.map((roleOption) => (
                  <option className={selectOptionClassName} key={roleOption} value={roleOption}>
                    {formatRole(roleOption)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">Champion</span>
              <select
                className={`${fieldClassName} h-10`}
                onChange={(event) => setChampionFilter(event.target.value)}
                value={championFilter}
              >
                <option className={selectOptionClassName} value="">
                  All champions
                </option>
                {champions.map((champion) => (
                  <option className={selectOptionClassName} key={champion.id} value={champion.id}>
                    {champion.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">Patch</span>
              <Input
                className={fieldClassName}
                onChange={(event) => setPatchFilter(event.target.value)}
                placeholder="16.12"
                value={patchFilter}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">Platform</span>
              <Input
                className={fieldClassName}
                onChange={(event) => setPlatformFilter(event.target.value.toUpperCase())}
                placeholder="EUW1"
                value={platformFilter}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">Attribution</span>
              <select
                className={`${fieldClassName} h-10`}
                onChange={(event) =>
                  setAttributionFilter(event.target.value as MatchupRankAttributionMethod | "all")
                }
                value={attributionFilter}
              >
                {matchupCoverageAttributionFilters.map((method) => (
                  <option className={selectOptionClassName} key={method} value={method}>
                    {method === "all" ? "All unresolved" : formatEnumLabel(method)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">Candidate row</span>
              <select
                className={`${fieldClassName} h-10`}
                onChange={(event) =>
                  setHasCandidateFilter(
                    event.target.value as NonNullable<MatchupRankCoverageFilters["hasCandidate"]>,
                  )
                }
                value={hasCandidateFilter}
              >
                {matchupCoverageCandidateFilters.map((filter) => (
                  <option className={selectOptionClassName} key={filter} value={filter}>
                    {filter === "all" ? "All" : filter === "yes" ? "Has candidate" : "Missing"}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">Rank status</span>
              <select
                className={`${fieldClassName} h-10`}
                onChange={(event) =>
                  setRankStatusFilter(
                    event.target.value as NonNullable<MatchupRankCoverageFilters["rankStatus"]>,
                  )
                }
                value={rankStatusFilter}
              >
                <option className={selectOptionClassName} value="all">
                  All
                </option>
                <option className={selectOptionClassName} value="never_enriched">
                  Never enriched
                </option>
                {seedCandidateRankStatuses
                  .filter((rankStatus) => rankStatus !== "all")
                  .map((rankStatus) => (
                    <option className={selectOptionClassName} key={rankStatus} value={rankStatus}>
                      {formatEnumLabel(rankStatus)}
                    </option>
                  ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">Sort</span>
              <select
                className={`${fieldClassName} h-10`}
                onChange={(event) => setSort(event.target.value as MatchupRankCoverageSort)}
                value={sort}
              >
                {matchupCoverageSorts.map((sortOption) => (
                  <option
                    className={selectOptionClassName}
                    key={sortOption.value}
                    value={sortOption.value}
                  >
                    {sortOption.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">Minimum impact</span>
              <Input
                className={fieldClassName}
                min={1}
                onChange={(event) => setMinimumImpact(event.target.value)}
                type="number"
                value={minimumImpact}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">Limit</span>
              <Input
                className={fieldClassName}
                max={20}
                min={1}
                onChange={(event) => setLimit(event.target.value)}
                type="number"
                value={limit}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  checked={twoPlayerUpgradeOnly}
                  className="size-4 accent-cyan-400"
                  onChange={(event) => setTwoPlayerUpgradeOnly(event.target.checked)}
                  type="checkbox"
                />
                Two-player upgrade potential only
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  checked={forceRefresh}
                  className="size-4 accent-cyan-400"
                  onChange={(event) => setForceRefresh(event.target.checked)}
                  type="checkbox"
                />
                Force refresh selected ranks
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
                disabled={candidates.length === 0 || allVisibleSelected}
                onClick={selectAllVisible}
                type="button"
                variant="ghost"
              >
                <Check className="size-4" aria-hidden="true" />
                Select all visible
              </Button>
              <Button
                className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
                disabled={selectedCandidates.length === 0}
                onClick={clearSelection}
                type="button"
                variant="ghost"
              >
                <X className="size-4" aria-hidden="true" />
                Clear selection
              </Button>
              <Button
                className="border-cyan-300/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
                disabled={status.isLoading || selectedCandidates.length === 0}
                onClick={() => void refreshSelectedRanks()}
                type="button"
                variant="ghost"
              >
                {status.isLoading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="size-4" aria-hidden="true" />
                )}
                Refresh rank for selected
              </Button>
              <Button
                className="border-amber-300/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
                disabled={status.isLoading}
                onClick={() => void rerunAttribution()}
                type="button"
                variant="ghost"
              >
                Re-run rank attribution
              </Button>
              <Button
                className="h-10 bg-violet-500/80 px-4 text-white hover:bg-violet-500"
                disabled={status.isLoading}
                onClick={() => void loadQueue()}
                type="button"
              >
                <Search className="size-4" aria-hidden="true" />
                Apply filters
              </Button>
            </div>
          </div>

          <StatusMessage status={status} />

          {selectedCandidates.length > 0 ? (
            <div className="grid gap-3 rounded-lg border border-cyan-300/20 bg-cyan-500/10 p-4 sm:grid-cols-4">
              <Metric label="Selected participants" value={selectedCandidates.length} />
              <Metric
                label="Projected unknown gains"
                value={projectedImpact.unknownObservationsAffected}
              />
              <Metric
                label="Projected two-player upgrades"
                value={projectedImpact.twoPlayerUpgradePotential}
              />
              <Metric
                label="Projected affected observations"
                value={projectedImpact.observationsAffected}
              />
            </div>
          ) : null}

          {selectedCandidates.length > maxSeedCandidateRankRefreshBatch ? (
            <p className="rounded-md border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-100">
              You selected {selectedCandidates.length} participants. The maximum rank refresh batch
              is {maxSeedCandidateRankRefreshBatch}.
            </p>
          ) : null}

          {refreshSummary ? (
            <div className="grid gap-3 rounded-lg border border-emerald-300/20 bg-emerald-500/10 p-4 sm:grid-cols-3 xl:grid-cols-6">
              <Metric label="Candidates requested" value={refreshSummary.candidatesRequested} />
              <Metric label="Created" value={refreshSummary.createdCandidateCount} />
              <Metric label="Ranked" value={refreshSummary.rankedCount} />
              <Metric label="Unranked" value={refreshSummary.unrankedCount} />
              <Metric label="Not found" value={refreshSummary.notFoundCount} />
              <Metric label="Snapshots created" value={refreshSummary.snapshotInsertedCount} />
            </div>
          ) : null}

          {attributionSummary ? (
            <div className="grid gap-3 rounded-lg border border-amber-300/20 bg-amber-500/10 p-4 sm:grid-cols-3 xl:grid-cols-6">
              <Metric label="Processed" value={attributionSummary.processed} />
              <Metric label="Two-player" value={attributionSummary.twoPlayerAverage} />
              <Metric label="Single-player" value={attributionSummary.singlePlayer} />
              <Metric label="Unknown" value={attributionSummary.unknown} />
              <Metric
                label="Participants missing"
                value={attributionSummary.participantsNotFound}
              />
              <Metric label="Snapshot too old" value={attributionSummary.snapshotTooOld} />
            </div>
          ) : null}

          {candidates.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-500">
              {status.isLoading
                ? "Loading rank attribution coverage queue..."
                : hasLoadedQueue
                  ? "No unresolved matchup participants matched the current filters."
                  : "Open this advanced tool to load coverage candidates."}
            </div>
          ) : (
            <div className="space-y-3">
              {candidates.map((candidate) => {
                const expanded = expandedCandidateId === candidate.identityKey;
                const selected = selectedCandidateKeys.has(candidate.identityKey);

                return (
                  <div
                    className={cn(
                      "rounded-lg border bg-black/15 transition",
                      selected ? "border-cyan-300/50" : "border-white/10",
                    )}
                    key={candidate.identityKey}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <input
                          checked={selected}
                          className="size-4 accent-cyan-400"
                          onChange={() => toggleSelection(candidate)}
                          type="checkbox"
                        />
                        <button
                          className="min-w-0 text-left"
                          onClick={() =>
                            setExpandedCandidateId((currentId) =>
                              currentId === candidate.identityKey ? null : candidate.identityKey,
                            )
                          }
                          type="button"
                        >
                          <span className="block font-semibold text-white">
                            {candidate.platformRegion} / {candidate.puuidPreview}
                          </span>
                          <span className="mt-1 block text-xs text-zinc-500">
                            {candidate.roles.map(formatRole).join(", ")} ·{" "}
                            {candidate.champions
                              .map((champion) => championDisplayNamesById.get(champion) ?? champion)
                              .join(", ")}
                          </span>
                        </button>
                      </div>

                      <div className="grid min-w-[560px] flex-1 grid-cols-5 gap-3 text-right text-xs">
                        <CoverageMetric label="Priority" value={candidate.priorityScore} />
                        <CoverageMetric label="Affected" value={candidate.observationsAffected} />
                        <CoverageMetric
                          label="Unknown"
                          value={candidate.unknownObservationsAffected}
                        />
                        <CoverageMetric
                          label="2-player gain"
                          value={candidate.twoPlayerUpgradePotential}
                        />
                        <CoverageMetric
                          label="Rank status"
                          value={
                            candidate.cooldownActive
                              ? "Cooldown active"
                              : formatEnumLabel(candidate.rankStatus)
                          }
                        />
                      </div>
                    </div>

                    {expanded ? (
                      <div className="grid gap-3 border-t border-white/10 p-4 text-sm text-zinc-300 lg:grid-cols-3">
                        <Metric
                          label="Candidate row"
                          value={candidate.candidateId ? "Linked" : "Missing"}
                        />
                        <Metric
                          label="Last refresh"
                          value={formatDateTime(candidate.lastRankRefreshAt)}
                        />
                        <Metric
                          label="Next eligible"
                          value={formatDateTime(candidate.nextEligibleAt)}
                        />
                        <Metric
                          label="Latest match seen"
                          value={formatDateTime(candidate.latestMatchSeenAt)}
                        />
                        <Metric
                          label="Rank"
                          value={
                            candidate.rankTier
                              ? `${candidate.rankTier} ${candidate.rankDivision ?? ""}`.trim()
                              : "Pending"
                          }
                        />
                        <Metric label="LP" value={candidate.rankLeaguePoints ?? "Pending"} />
                        <div className="lg:col-span-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">
                            Affected sample
                          </p>
                          <div className="mt-2 grid gap-2">
                            {candidate.affectedMatchups.map((matchup) => (
                              <div
                                className="rounded-md border border-white/10 bg-white/[0.03] p-2 text-xs text-zinc-400"
                                key={`${candidate.identityKey}-${matchup.matchIdPreview}-${matchup.championA}-${matchup.championB}`}
                              >
                                {championDisplayNamesById.get(matchup.championA) ??
                                  matchup.championA}{" "}
                                vs{" "}
                                {championDisplayNamesById.get(matchup.championB) ??
                                  matchup.championB}{" "}
                                · {formatRole(matchup.role)} · {matchup.patch} ·{" "}
                                {formatEnumLabel(matchup.method)}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}

function CoverageMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="font-semibold text-cyan-100">{value}</div>
      <div className="mt-1 uppercase tracking-[0.18em] text-zinc-600">{label}</div>
    </div>
  );
}

function getCollectionDiscoveryDiagnostics(
  job: RiotCollectionJobView,
): RiotCollectionDiscoveryDiagnostics | null {
  const discovery = job.summary.discovery;

  return discovery && typeof discovery === "object"
    ? (discovery as RiotCollectionDiscoveryDiagnostics)
    : null;
}

function RiotCollectionJobsPanel({
  champions,
  championDisplayNamesById,
  getAccessToken,
  onCollectionTransition,
}: {
  champions: AdminLeagueChampion[];
  championDisplayNamesById: Map<string, string>;
  getAccessToken: () => Promise<
    | {
        accessToken: string;
        ok: true;
      }
    | {
        error: string;
        ok: false;
      }
  >;
  onCollectionTransition: () => Promise<void> | void;
}) {
  const [rankBracket, setRankBracket] = useState<RiotCollectionRankBracket>("gold-emerald");
  const [role, setRole] = useState<RiotCollectionRole>("mid");
  const [focusChampionInput, setFocusChampionInput] = useState("");
  const [target, setTarget] = useState<RiotCollectionTarget>(200);
  const [automaticSeedDiscovery, setAutomaticSeedDiscovery] = useState(true);
  const [currentPatchOnly, setCurrentPatchOnly] = useState(true);
  const [activeJob, setActiveJob] = useState<RiotCollectionJobView | null>(null);
  const [recentJobs, setRecentJobs] = useState<RiotCollectionJobView[]>([]);
  const [inventory, setInventory] = useState<{
    estimatedAdditionalSeedsNeeded: string;
    readySeeds: number;
  } | null>(null);
  const [status, setStatus] = useState<FormStatus>({
    error: null,
    isLoading: false,
    success: null,
  });

  useEffect(() => {
    void loadCollectionJobs();
    void loadInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankBracket, role, focusChampionInput]);

  useEffect(() => {
    if (!activeJob || isRiotCollectionTerminalStatus(activeJob.status)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshCollection(activeJob.id, { silent: true });
    }, 4000);

    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJob]);

  async function loadCollectionJobs() {
    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setStatus({ error: tokenResult.error, isLoading: false, success: null });
      return;
    }

    const result = await getRecentRiotCollectionJobs({
      accessToken: tokenResult.accessToken,
      limit: 5,
    });

    if (!result.ok) {
      setStatus({ error: result.error, isLoading: false, success: null });
      return;
    }

    setRecentJobs(result.jobs);
    setActiveJob((currentJob) => currentJob ?? result.jobs[0] ?? null);
  }

  async function loadInventory() {
    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      return;
    }

    const focusChampionId = focusChampionInput.trim()
      ? resolveChampionId(focusChampionInput, champions)
      : null;

    if (focusChampionInput.trim() && !focusChampionId) {
      setInventory(null);
      return;
    }

    const result = await getRiotCollectionInventory({
      accessToken: tokenResult.accessToken,
      focusChampionId,
      rankBracket,
      role,
    });

    if (result.ok) {
      setInventory(result.inventory);
    }
  }

  async function startCollection() {
    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setStatus({ error: tokenResult.error, isLoading: false, success: null });
      return;
    }

    const focusChampionId = focusChampionInput.trim()
      ? resolveChampionId(focusChampionInput, champions)
      : null;

    if (focusChampionInput.trim() && !focusChampionId) {
      setStatus({ error: "Select a valid champion focus.", isLoading: false, success: null });
      return;
    }

    setStatus({ error: null, isLoading: true, success: null });

    const result = await startRiotCollectionJob({
      accessToken: tokenResult.accessToken,
      automaticSeedDiscovery,
      currentPatchOnly,
      focusChampionId,
      platform: "EUW1",
      rankBracket,
      regionalRoute: "EUROPE",
      role,
      targetUniqueMatches: target,
    });

    if (!result.ok) {
      setStatus({ error: result.error, isLoading: false, success: null });
      return;
    }

    setActiveJob(result.job);
    setRecentJobs((currentJobs) =>
      [result.job, ...currentJobs.filter((job) => job.id !== result.job.id)].slice(0, 5),
    );
    setStatus({ error: null, isLoading: false, success: "Collection job started." });
    await onCollectionTransition();
  }

  async function resumeCollection(collectionJobId: number, { silent = false } = {}) {
    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      if (!silent) {
        setStatus({ error: tokenResult.error, isLoading: false, success: null });
      }
      return;
    }

    if (!silent) {
      setStatus({ error: null, isLoading: true, success: null });
    }

    const previousStatus = activeJob?.status ?? null;
    const result = await resumeRiotCollectionJob({
      accessToken: tokenResult.accessToken,
      collectionJobId,
    });

    if (!result.ok) {
      if (!silent) {
        setStatus({ error: result.error, isLoading: false, success: null });
      }
      return;
    }

    setActiveJob(result.job);
    setRecentJobs((currentJobs) =>
      [result.job, ...currentJobs.filter((job) => job.id !== result.job.id)].slice(0, 5),
    );

    if (previousStatus !== result.job.status || isRiotCollectionTerminalStatus(result.job.status)) {
      await onCollectionTransition();
    }

    if (!silent) {
      setStatus({ error: null, isLoading: false, success: "Collection job advanced." });
    }
  }

  async function refreshCollection(collectionJobId: number, { silent = false } = {}) {
    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      if (!silent) {
        setStatus({ error: tokenResult.error, isLoading: false, success: null });
      }
      return;
    }

    const result = await getRiotCollectionJob({
      accessToken: tokenResult.accessToken,
      collectionJobId,
    });

    if (!result.ok) {
      if (!silent) {
        setStatus({ error: result.error, isLoading: false, success: null });
      }
      return;
    }

    setActiveJob(result.job);
    setRecentJobs((currentJobs) =>
      [result.job, ...currentJobs.filter((job) => job.id !== result.job.id)].slice(0, 5),
    );
  }

  async function pauseCollection(collectionJobId: number) {
    await controlCollection(collectionJobId, "pause");
  }

  async function cancelCollection(collectionJobId: number) {
    await controlCollection(collectionJobId, "cancel");
  }

  async function controlCollection(collectionJobId: number, action: "cancel" | "pause") {
    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setStatus({ error: tokenResult.error, isLoading: false, success: null });
      return;
    }

    setStatus({ error: null, isLoading: true, success: null });
    const result =
      action === "pause"
        ? await pauseRiotCollectionJob({
            accessToken: tokenResult.accessToken,
            collectionJobId,
          })
        : await cancelRiotCollectionJob({
            accessToken: tokenResult.accessToken,
            collectionJobId,
          });

    if (!result.ok) {
      setStatus({ error: result.error, isLoading: false, success: null });
      return;
    }

    setActiveJob(result.job);
    setRecentJobs((currentJobs) =>
      [result.job, ...currentJobs.filter((job) => job.id !== result.job.id)].slice(0, 5),
    );
    setStatus({
      error: null,
      isLoading: false,
      success: action === "pause" ? "Collection paused." : "Collection cancelled.",
    });
    await onCollectionTransition();
  }

  return (
    <Card className="border-cyan-300/20 bg-[#10182b]/90 text-white shadow-xl shadow-black/15">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="font-mono text-xl">Collect Counter Pick Data</CardTitle>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Start a controlled rank-first collection job. Existing ready seeds are used first, and
              ladder discovery can fill the pool when needed.
            </p>
          </div>
          <Button
            className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
            onClick={() => void loadCollectionJobs()}
            type="button"
            variant="ghost"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Refresh jobs
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-4 rounded-lg border border-white/10 bg-black/15 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Metric label="Region" value="EUW" />
              <label className="block space-y-2">
                <span className="text-sm text-zinc-300">Rank bracket</span>
                <select
                  className={`${fieldClassName} h-10`}
                  onChange={(event) =>
                    setRankBracket(event.target.value as RiotCollectionRankBracket)
                  }
                  value={rankBracket}
                >
                  {riotCollectionRankBrackets.map((bracket) => (
                    <option className={selectOptionClassName} key={bracket} value={bracket}>
                      {formatEnumLabel(bracket)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm text-zinc-300">Collection focus role</span>
                <select
                  className={`${fieldClassName} h-10`}
                  onChange={(event) => setRole(event.target.value as RiotCollectionRole)}
                  value={role}
                >
                  {["any", ...leagueRoles].map((nextRole) => (
                    <option className={selectOptionClassName} key={nextRole} value={nextRole}>
                      {nextRole === "any" ? "Any" : getRoleLabel(nextRole as LeagueRole)}
                    </option>
                  ))}
                </select>
                <span className="block text-xs leading-5 text-zinc-500">
                  Used to choose and discover seed players. The scanner extracts all valid role
                  matchups from every fetched match.
                </span>
              </label>
              <label className="block space-y-2">
                <span className="text-sm text-zinc-300">Target unique matches</span>
                <select
                  className={`${fieldClassName} h-10`}
                  onChange={(event) =>
                    setTarget(Number(event.target.value) as RiotCollectionTarget)
                  }
                  value={target}
                >
                  {riotCollectionTargets.map((nextTarget) => (
                    <option className={selectOptionClassName} key={nextTarget} value={nextTarget}>
                      {nextTarget}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <ChampionSearchInput
              disabled={status.isLoading}
              label="Champion focus (optional)"
              onChange={setFocusChampionInput}
              options={champions}
              value={focusChampionInput}
            />

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">
                <input
                  checked={automaticSeedDiscovery}
                  className="size-4 accent-cyan-400"
                  onChange={(event) => setAutomaticSeedDiscovery(event.target.checked)}
                  type="checkbox"
                />
                Automatic seed discovery
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">
                <input
                  checked={currentPatchOnly}
                  className="size-4 accent-cyan-400"
                  onChange={(event) => setCurrentPatchOnly(event.target.checked)}
                  type="checkbox"
                />
                Current patch only
              </label>
            </div>

            <div className="rounded-md border border-cyan-300/20 bg-cyan-500/10 p-3 text-sm text-cyan-100">
              Ready seeds in {formatEnumLabel(rankBracket)}:{" "}
              <span className="font-semibold">{inventory?.readySeeds ?? "Pending"}</span>
              <span className="mt-1 block text-xs text-cyan-100/70">
                Estimated additional seeds needed:{" "}
                {inventory?.estimatedAdditionalSeedsNeeded ?? "Pending"}. Individual scan batches
                remain capped at 20 seeds and the job may stop early at safety limits.
              </span>
            </div>

            <StatusMessage status={status} />

            <Button
              className="h-10 bg-cyan-500/80 px-4 text-slate-950 hover:bg-cyan-400"
              disabled={status.isLoading}
              onClick={() => void startCollection()}
              type="button"
            >
              {status.isLoading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="size-4" aria-hidden="true" />
              )}
              Start collection
            </Button>
          </div>

          <div className="space-y-4">
            {activeJob ? (
              <RiotCollectionJobCard
                championDisplayNamesById={championDisplayNamesById}
                job={activeJob}
                onCancel={() => void cancelCollection(activeJob.id)}
                onPause={() => void pauseCollection(activeJob.id)}
                onResume={() => void resumeCollection(activeJob.id)}
                statusLoading={status.isLoading}
              />
            ) : (
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-400">
                Start or select a collection job to see progress.
              </div>
            )}

            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-sm font-semibold text-white">Recent collection jobs</h3>
              {recentJobs.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">No collection jobs yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {recentJobs.map((job) => (
                    <button
                      className="grid w-full gap-2 rounded-md border border-white/10 bg-black/15 p-3 text-left text-sm transition hover:bg-white/[0.06] md:grid-cols-[1fr_auto]"
                      key={job.id}
                      onClick={() => setActiveJob(job)}
                      type="button"
                    >
                      <span>
                        <span className="font-semibold text-white">
                          {formatEnumLabel(job.rank_bracket)} · {formatRole(job.role)}
                        </span>
                        <span className="ml-2 text-zinc-400">
                          {riotCollectionStatusLabels[job.status]}
                        </span>
                      </span>
                      <span className="font-mono text-cyan-100">
                        {job.unique_matches_processed}/{job.target_unique_matches}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RiotCollectionJobCard({
  championDisplayNamesById,
  job,
  onCancel,
  onPause,
  onResume,
  statusLoading,
}: {
  championDisplayNamesById: Map<string, string>;
  job: RiotCollectionJobView;
  onCancel: () => void;
  onPause: () => void;
  onResume: () => void;
  statusLoading: boolean;
}) {
  const progressPercent = getRiotCollectionProgressPercent({
    targetUniqueMatches: job.target_unique_matches,
    uniqueMatchesProcessed: job.unique_matches_processed,
  });
  const canPause = !isRiotCollectionTerminalStatus(job.status) && job.status !== "paused";
  const canResume =
    job.status === "paused" ||
    job.status === "queued" ||
    job.status === "selecting-seeds" ||
    job.status === "discovering-seeds" ||
    job.status === "aggregating";
  const canCancel = !isRiotCollectionTerminalStatus(job.status);
  const discoveryDiagnostics = getCollectionDiscoveryDiagnostics(job);
  const activeScanProgress = job.latest_scan_job?.progress ?? job.progress.activeScanProgress;
  const activeScanStage = activeScanProgress?.currentStage
    ? formatEnumLabel(activeScanProgress.currentStage)
    : job.latest_scan_job?.status
      ? riotCollectionStatusLabels[job.status]
      : "Pending";

  return (
    <div className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-mono text-lg font-semibold text-white">
            {formatEnumLabel(job.rank_bracket)} · {formatRole(job.role)} ·{" "}
            {job.focus_champion_id
              ? getChampionDisplayName(championDisplayNamesById, job.focus_champion_id)
              : "Any champion"}
          </h3>
          <p className="mt-1 text-sm text-cyan-100">{riotCollectionStatusLabels[job.status]}</p>
          <p className="mt-1 text-xs text-cyan-100/70">
            Focus role: {formatRole(job.role)}. Extracting all valid roles.
          </p>
        </div>
        <p className="font-mono text-2xl font-semibold text-cyan-100">{progressPercent}%</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/30">
        <div className="h-full bg-cyan-300" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="mt-4 grid gap-2 text-xs text-zinc-300 sm:grid-cols-2 lg:grid-cols-3">
        <Metric
          label="Unique matches"
          value={`${job.unique_matches_processed}/${job.target_unique_matches}`}
        />
        <Metric label="Eligible seeds produced" value={job.seeds_discovered} />
        <Metric label="Seeds used" value={job.seeds_used} />
        <Metric label="Current batch" value={job.progress.activeScanJobId ?? "Pending"} />
        <Metric label="Child stage" value={activeScanStage} />
        <Metric
          label="Match IDs"
          value={
            activeScanProgress
              ? `${activeScanProgress.uniqueMatchIds ?? 0}/${activeScanProgress.fetchedMatchIds ?? 0}`
              : "Pending"
          }
        />
        <Metric
          label="Matches scanned"
          value={
            activeScanProgress
              ? `${activeScanProgress.matchesScanned ?? 0}/${activeScanProgress.matchesTotal ?? activeScanProgress.uniqueMatchIds ?? "?"}`
              : "Pending"
          }
        />
        <Metric label="New observations" value={job.new_matchup_observations} />
        <Metric label="Duplicates skipped" value={job.duplicate_match_ids} />
        <Metric label="Stat rows updated" value={job.stat_rows_updated} />
        <Metric label="Failures" value={job.error_count} />
        <Metric label="Started" value={formatDateTime(job.started_at)} />
        <Metric
          label="Child updated"
          value={formatDateTime(
            activeScanProgress?.lastProgressAt ?? job.progress.activeScanProgressAt,
          )}
        />
        <Metric
          label="Riot budget"
          value={
            activeScanProgress?.rateLimitShortWindowLimit
              ? `${activeScanProgress.rateLimitShortWindowUsage ?? 0}/${activeScanProgress.rateLimitShortWindowLimit} short, ${activeScanProgress.rateLimitLongWindowUsage ?? 0}/${activeScanProgress.rateLimitLongWindowLimit ?? "?"} long`
              : "Pending"
          }
        />
        <Metric
          label="Wait episodes"
          value={
            activeScanProgress?.rateLimitWaitEpisodes
              ? `${activeScanProgress.rateLimitWaitEpisodes} episodes`
              : "None"
          }
        />
        <Metric
          label="Requests delayed"
          value={activeScanProgress?.rateLimitRequestsDelayed ?? 0}
        />
        <Metric label="Riot 429s" value={activeScanProgress?.riot429Responses ?? 0} />
        <Metric
          label="Matches remaining"
          value={activeScanProgress?.workerRemainingMatches ?? "Pending"}
        />
        <Metric label="Worker state" value={activeScanProgress?.workerState ?? "Pending"} />
        <Metric
          label="Worker heartbeat"
          value={formatDateTime(activeScanProgress?.workerHeartbeatAt)}
        />
        <Metric
          label="Lease expires"
          value={formatDateTime(activeScanProgress?.workerLeaseExpiresAt)}
        />
      </div>
      {job.stop_reason ? (
        <div className="mt-4 rounded-md border border-white/10 bg-black/15 p-3 text-sm text-zinc-300">
          <p>{riotCollectionStopReasonLabels[job.stop_reason]}</p>
          {job.stop_detail ? <p className="mt-2 text-zinc-400">{job.stop_detail}</p> : null}
        </div>
      ) : job.progress.lastMessage ? (
        <p className="mt-4 rounded-md border border-white/10 bg-black/15 p-3 text-sm text-zinc-300">
          {job.progress.lastMessage}
        </p>
      ) : null}
      {discoveryDiagnostics ? (
        <div className="mt-4 rounded-md border border-cyan-300/20 bg-black/15 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">
            Seed discovery diagnostics
          </p>
          <div className="mt-3 grid gap-2 text-xs text-zinc-300 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Sources attempted" value={discoveryDiagnostics.sourcesAttempted} />
            <Metric label="Ladder pages fetched" value={discoveryDiagnostics.pagesFetched} />
            <Metric label="Ladder entries returned" value={discoveryDiagnostics.entriesFetched} />
            <Metric label="Direct PUUIDs" value={discoveryDiagnostics.identifiers.directPuuids} />
            <Metric
              label="PUUID lookups"
              value={discoveryDiagnostics.identifiers.lookupsAttempted}
            />
            <Metric label="PUUIDs resolved" value={discoveryDiagnostics.identifiers.resolved} />
            <Metric label="Existing reused" value={discoveryDiagnostics.candidates.reused} />
            <Metric label="New candidates" value={discoveryDiagnostics.candidates.created} />
            <Metric
              label="Candidates enriched"
              value={discoveryDiagnostics.candidates.enriched}
            />
            <Metric
              label="Missing enrichment"
              value={discoveryDiagnostics.candidates.missingEnrichment ?? 0}
            />
            <Metric
              label="Rank snapshots"
              value={discoveryDiagnostics.candidates.rankSnapshotsInserted}
            />
            <Metric
              label="Candidates evaluated"
              value={discoveryDiagnostics.eligibility?.candidatesEvaluated ?? 0}
            />
            <Metric
              label="Rows refetched"
              value={discoveryDiagnostics.pipeline?.candidateRowsFetchedAfterEnrichment ?? 0}
            />
            <Metric
              label="Qualification input"
              value={discoveryDiagnostics.pipeline?.qualificationInput ?? 0}
            />
            <Metric
              label="Ready seeds"
              value={discoveryDiagnostics.lifecycle.eligibleSeedsProduced}
            />
            <Metric
              label="Rejected candidates"
              value={discoveryDiagnostics.eligibility?.candidatesRejected ?? 0}
            />
            <Metric
              label="Selected seeds"
              value={discoveryDiagnostics.eligibility?.candidatesSelectedAsSeeds ?? 0}
            />
            <Metric label="Low signal" value={discoveryDiagnostics.lifecycle["low-signal"]} />
            <Metric label="API failures" value={discoveryDiagnostics.api.failures} />
          </div>
          {discoveryDiagnostics.progress ? (
            <div className="mt-4 border border-white/10 bg-black/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
                Discovery progress
              </p>
              <div className="mt-3 grid gap-2 text-xs text-zinc-300 sm:grid-cols-2 lg:grid-cols-3">
                <Metric
                  label="Target ready seeds"
                  value={discoveryDiagnostics.progress.targetReadySeeds}
                />
                <Metric
                  label="Ready seeds found"
                  value={discoveryDiagnostics.progress.readySeedsFound}
                />
                <Metric
                  label="Remaining seeds"
                  value={discoveryDiagnostics.progress.remainingSeedsNeeded}
                />
                <Metric
                  label="Discovery iterations"
                  value={discoveryDiagnostics.progress.iterations.length}
                />
                <Metric
                  label="Current source"
                  value={discoveryDiagnostics.progress.currentSource ?? "Pending"}
                />
                <Metric
                  label="Current page"
                  value={discoveryDiagnostics.progress.currentPage ?? "Pending"}
                />
                <Metric
                  label="Unique inspected"
                  value={discoveryDiagnostics.progress.uniqueCandidatesInspected}
                />
                <Metric
                  label="Duplicate PUUIDs"
                  value={discoveryDiagnostics.progress.duplicatePuuidsSkipped}
                />
                <Metric
                  label="Duplicate candidates"
                  value={discoveryDiagnostics.progress.duplicateCandidatesSkipped}
                />
                <Metric
                  label="Sources exhausted"
                  value={discoveryDiagnostics.progress.exhaustedSourceKeys.length}
                />
                <Metric
                  label="Stop reason"
                  value={discoveryDiagnostics.progress.stopReason ?? "Running"}
                />
              </div>
              {discoveryDiagnostics.progress.iterations.length > 0 ? (
                <div className="mt-3 space-y-2 text-xs text-zinc-400">
                  {discoveryDiagnostics.progress.iterations.slice(-3).map((iteration) => (
                    <div
                      className="grid gap-2 border border-white/10 bg-white/[0.03] p-2 sm:grid-cols-2 lg:grid-cols-4"
                      key={`${iteration.iteration}-${iteration.source}-${iteration.page}`}
                    >
                      <span className="text-cyan-100">
                        {iteration.iteration}. {iteration.source} p{iteration.page}
                      </span>
                      <span>{iteration.entriesReturned} entries</span>
                      <span>{iteration.candidatesEvaluated} evaluated</span>
                      <span>{iteration.readySeedsFound} ready</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {discoveryDiagnostics.pipeline ? (
            <div className="mt-4 border border-white/10 bg-black/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
                Qualification pipeline
              </p>
              <div className="mt-3 grid gap-2 text-xs text-zinc-300 sm:grid-cols-2 lg:grid-cols-3">
                <Metric label="Discovered PUUIDs" value={discoveryDiagnostics.pipeline.discoveredPuuids} />
                <Metric
                  label="Persisted IDs"
                  value={discoveryDiagnostics.pipeline.persistedCandidateIds}
                />
                <Metric
                  label="Enriched IDs"
                  value={discoveryDiagnostics.pipeline.enrichedCandidateIds}
                />
                <Metric
                  label="Rows after refetch"
                  value={discoveryDiagnostics.pipeline.candidateRowsFetchedAfterEnrichment}
                />
                <Metric
                  label="Eligibility results"
                  value={discoveryDiagnostics.pipeline.eligibilityResults}
                />
                <Metric
                  label="Invariant issues"
                  value={discoveryDiagnostics.pipeline.invariantErrors.length}
                />
              </div>
              {discoveryDiagnostics.pipeline.invariantErrors.length > 0 ? (
                <p className="mt-3 text-xs text-rose-200">
                  Invariants: {discoveryDiagnostics.pipeline.invariantErrors.join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}
          {discoveryDiagnostics.eligibility ? (
            <div className="mt-4 grid gap-3 text-xs text-zinc-300 lg:grid-cols-2">
              <DiagnosticSummaryList
                emptyLabel="No hard rejections recorded."
                items={discoveryDiagnostics.eligibility.hardRejections}
                title="Eligibility rejection summary"
              />
              <DiagnosticSummaryList
                emptyLabel="No warning-only conditions recorded."
                items={discoveryDiagnostics.eligibility.warnings}
                title="Eligibility warnings"
              />
            </div>
          ) : null}
          {discoveryDiagnostics.eligibility?.rejectionSamples?.length ? (
            <div className="mt-4 border border-white/10 bg-black/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
                Rejected candidate samples
              </p>
              <div className="mt-3 grid gap-2 text-xs text-zinc-400 md:grid-cols-2">
                {discoveryDiagnostics.eligibility.rejectionSamples.map((sample) => (
                  <div className="border border-white/10 bg-white/[0.03] p-2" key={sample.id}>
                    <p className="font-mono text-cyan-100">{sample.id}</p>
                    <p className="mt-1">Rank: {sample.rank}</p>
                    <p>Role: {sample.role}</p>
                    <p>Hard: {sample.hardReasons.join(", ") || "None"}</p>
                    <p>Warnings: {sample.warnings.join(", ") || "None"}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {discoveryDiagnostics.reasonCodes.length > 0 ? (
            <p className="mt-3 text-xs text-zinc-500">
              Reason codes: {discoveryDiagnostics.reasonCodes.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
          disabled={!canResume || statusLoading}
          onClick={onResume}
          size="sm"
          type="button"
          variant="ghost"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Resume
        </Button>
        <Button
          className="border-amber-300/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
          disabled={!canPause || statusLoading}
          onClick={onPause}
          size="sm"
          type="button"
          variant="ghost"
        >
          Pause
        </Button>
        <Button
          className="border-rose-300/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
          disabled={!canCancel || statusLoading}
          onClick={onCancel}
          size="sm"
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function DiagnosticSummaryList({
  emptyLabel,
  items,
  title,
}: {
  emptyLabel: string;
  items: Record<string, number>;
  title: string;
}) {
  const entries = Object.entries(items ?? {}).sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  );

  return (
    <div className="border border-white/10 bg-black/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-300">{title}</p>
      {entries.length > 0 ? (
        <dl className="mt-3 space-y-2">
          {entries.map(([reason, count]) => (
            <div className="flex items-center justify-between gap-3" key={reason}>
              <dt className="text-zinc-400">{formatEnumLabel(reason)}</dt>
              <dd className="font-mono text-cyan-100">{count}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 text-zinc-500">{emptyLabel}</p>
      )}
    </div>
  );
}

function RiotSeedCandidatesPanel({
  champions,
  championDisplayNamesById,
  getAccessToken,
  onAddPuuids,
  onFocusScanner,
  onScanStarted,
  refreshSignal,
}: {
  champions: AdminLeagueChampion[];
  championDisplayNamesById: Map<string, string>;
  getAccessToken: () => Promise<
    | {
        accessToken: string;
        ok: true;
      }
    | {
        error: string;
        ok: false;
      }
  >;
  onAddPuuids: (puuids: string[]) => number;
  onFocusScanner: () => void;
  onScanStarted: (job: RiotScanJobView) => void;
  refreshSignal: number;
}) {
  const [candidateGroups, setCandidateGroups] = useState<SeedCandidateGroupStates>(
    createInitialSeedCandidateGroupStates,
  );
  const [activeRankGroup, setActiveRankGroup] =
    useState<RiotSeedCandidateRankGroupId>("master-plus");
  const [lifecycleFilter, setLifecycleFilter] = useState<SeedCandidateLifecycleState | "all">(
    "ready-to-scan",
  );
  const [lifecycleCounts, setLifecycleCounts] = useState<
    Record<SeedCandidateLifecycleState, number>
  >(createEmptyLifecycleCounts);
  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(null);
  const [platformRegion, setPlatformRegion] = useState("EUW1");
  const [statusFilter, setStatusFilter] = useState<RiotSeedCandidateStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<RiotSeedCandidateSource | "all">("all");
  const [rankStatusFilter, setRankStatusFilter] = useState<
    RiotSeedCandidateRankEnrichmentStatus | "all"
  >("all");
  const [rankTierFilter, setRankTierFilter] =
    useState<(typeof seedCandidateRankTiers)[number]>("all");
  const [rankedStateFilter, setRankedStateFilter] =
    useState<NonNullable<RiotSeedCandidateFilters["rankedState"]>>("all");
  const [primaryRoleFilter, setPrimaryRoleFilter] = useState<LeagueRole | "all">("all");
  const [primaryChampionFilter, setPrimaryChampionFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [minimumObservedGames, setMinimumObservedGames] = useState("");
  const [minimumPrimaryRoleShare, setMinimumPrimaryRoleShare] = useState("");
  const [minimumPrimaryChampionShare, setMinimumPrimaryChampionShare] = useState("");
  const [lastScannedFilter, setLastScannedFilter] =
    useState<NonNullable<RiotSeedCandidateFilters["lastScanned"]>>("all");
  const [rankLastRefreshedFilter, setRankLastRefreshedFilter] =
    useState<NonNullable<RiotSeedCandidateFilters["rankLastRefreshed"]>>("all");
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(() => new Set());
  const [selectedCandidateCache, setSelectedCandidateCache] = useState<
    Map<string, RiotSeedCandidateView>
  >(() => new Map());
  const [showScanPanel, setShowScanPanel] = useState(false);
  const [bulkMode, setBulkMode] = useState<RiotScanMode>("discovery");
  const [bulkRole, setBulkRole] = useState<LeagueRole>("mid");
  const [bulkMatchCount, setBulkMatchCount] = useState("20");
  const [bulkCurrentPatchOnly, setBulkCurrentPatchOnly] = useState(true);
  const [bulkMinimumGames, setBulkMinimumGames] = useState("2");
  const [bulkDisplayLimit, setBulkDisplayLimit] = useState("20");
  const [bulkDiscoveryFocusChampion, setBulkDiscoveryFocusChampion] = useState("");
  const [bulkEnemyChampionInput, setBulkEnemyChampionInput] = useState("Ahri");
  const [bulkCounterChampionInput, setBulkCounterChampionInput] = useState("Yasuo");
  const [status, setStatus] = useState<FormStatus>({
    error: null,
    isLoading: false,
    success: null,
  });
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const selectedCandidates = useMemo(
    () =>
      [...selectedCandidateIds]
        .map((candidateId) => selectedCandidateCache.get(candidateId))
        .filter((candidate): candidate is RiotSeedCandidateView => Boolean(candidate)),
    [selectedCandidateCache, selectedCandidateIds],
  );
  const selectedRecentScanCount = selectedCandidates.filter((candidate) =>
    wasCandidateScannedRecently(candidate.last_scanned_at),
  ).length;
  const selectedRecentRankRefreshCount = selectedCandidates.filter((candidate) =>
    wasCandidateRankRefreshedRecently(candidate.rank_last_success_at),
  ).length;

  useEffect(() => {
    void loadCandidateGroups({ groupIds: [activeRankGroup] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (refreshSignal === 0) {
      return;
    }

    void loadCandidateGroups({ groupIds: [activeRankGroup] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  function buildCandidateFilters(): RiotSeedCandidateFilters {
    const parsedMinimumGames = Number(minimumObservedGames);
    const parsedMinimumPrimaryRoleShare = Number(minimumPrimaryRoleShare);
    const parsedMinimumPrimaryChampionShare = Number(minimumPrimaryChampionShare);
    const filters: RiotSeedCandidateFilters = {
      lastScanned: lastScannedFilter,
      lifecycleState: lifecycleFilter,
      platformRegion,
      primaryChampion: primaryChampionFilter,
      primaryRole: primaryRoleFilter,
      rankLastRefreshed: rankLastRefreshedFilter,
      rankedState: rankedStateFilter,
      rankStatus: rankStatusFilter,
      rankTier: rankTierFilter,
      search: searchFilter,
      source: sourceFilter,
      status: statusFilter,
    };

    if (Number.isInteger(parsedMinimumGames) && parsedMinimumGames > 0) {
      filters.minObservedGames = parsedMinimumGames;
    }

    if (Number.isFinite(parsedMinimumPrimaryRoleShare) && parsedMinimumPrimaryRoleShare > 0) {
      filters.minPrimaryRoleShare = parsedMinimumPrimaryRoleShare;
    }

    if (
      Number.isFinite(parsedMinimumPrimaryChampionShare) &&
      parsedMinimumPrimaryChampionShare > 0
    ) {
      filters.minPrimaryChampionShare = parsedMinimumPrimaryChampionShare;
    }

    return filters;
  }

  async function loadCandidateGroups({
    filterOverrides = {},
    groupIds = [activeRankGroup],
    overrides = {},
    resetPages = false,
  }: {
    filterOverrides?: Partial<RiotSeedCandidateFilters>;
    groupIds?: RiotSeedCandidateRankGroupId[];
    overrides?: Partial<Record<RiotSeedCandidateRankGroupId, Partial<SeedCandidateGroupState>>>;
    resetPages?: boolean;
  } = {}) {
    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setStatus({ error: tokenResult.error, isLoading: false, success: null });
      return;
    }

    setStatus({ error: null, isLoading: true, success: null });
    setCandidateGroups((currentGroups) => {
      const nextGroups = { ...currentGroups };

      for (const groupId of groupIds) {
        nextGroups[groupId] = {
          ...nextGroups[groupId],
          error: null,
          isLoading: true,
        };
      }

      return nextGroups;
    });
    const groups: RiotSeedCandidateGroupPageRequest[] = groupIds.map((groupId) => {
      const currentGroup = {
        ...candidateGroups[groupId],
        ...(overrides[groupId] ?? {}),
      };

      return {
        page: resetPages ? 1 : currentGroup.page,
        pageSize: currentGroup.pageSize,
        rankGroup: groupId,
        sort: currentGroup.sort,
        sortDirection: currentGroup.sortDirection,
      };
    });

    const result = await getPaginatedRiotSeedCandidates({
      accessToken: tokenResult.accessToken,
      filters: {
        ...buildCandidateFilters(),
        ...filterOverrides,
      },
      groups,
    });

    if (!result.ok) {
      setStatus({ error: result.error, isLoading: false, success: null });
      setCandidateGroups((currentGroups) => {
        const nextGroups = { ...currentGroups };

        for (const groupId of groupIds) {
          nextGroups[groupId] = {
            ...nextGroups[groupId],
            error: result.error,
            isLoading: false,
          };
        }

        return nextGroups;
      });
      return;
    }

    setLifecycleCounts(result.lifecycleCounts);

    setCandidateGroups((currentGroups) => {
      const nextGroups = { ...currentGroups };

      for (const rankGroup of riotSeedCandidateRankGroups) {
        const groupResult = result.groups[rankGroup.id];

        nextGroups[rankGroup.id] = {
          ...nextGroups[rankGroup.id],
          error: null,
          isLoading: false,
          totalCount: result.counts[rankGroup.id] ?? 0,
          ...(groupResult
            ? {
                candidates: groupResult.candidates,
                loaded: true,
                page: groupResult.page,
                pageSize: groupResult.pageSize,
                totalPages: groupResult.totalPages,
              }
            : {}),
        };
      }

      for (const groupRequest of groups) {
        nextGroups[groupRequest.rankGroup] = {
          ...nextGroups[groupRequest.rankGroup],
          sort: groupRequest.sort,
          sortDirection: groupRequest.sortDirection,
        };
      }

      return nextGroups;
    });
    setSelectedCandidateCache((currentCache) => {
      const nextCache = new Map(currentCache);

      for (const groupResult of Object.values(result.groups)) {
        for (const candidate of groupResult?.candidates ?? []) {
          nextCache.set(candidate.id, candidate);
        }
      }

      return nextCache;
    });
    setStatus({
      error: null,
      isLoading: false,
      success: "Seed candidate groups refreshed.",
    });
  }

  function applyFilters() {
    setSelectedCandidateIds(new Set());
    setSelectedCandidateCache(new Map());
    setShowScanPanel(false);
    setCandidateGroups((currentGroups) => {
      const nextGroups = { ...currentGroups };

      for (const rankGroup of riotSeedCandidateRankGroups) {
        nextGroups[rankGroup.id] = {
          ...nextGroups[rankGroup.id],
          candidates: [],
          loaded: false,
          page: 1,
        };
      }

      return nextGroups;
    });
    void loadCandidateGroups({ groupIds: [activeRankGroup], resetPages: true });
  }

  function changeActiveRankGroup(rankGroup: RiotSeedCandidateRankGroupId) {
    setActiveRankGroup(rankGroup);
    setSelectedCandidateIds(new Set());
    setSelectedCandidateCache(new Map());
    setShowScanPanel(false);
    void loadCandidateGroups({ groupIds: [rankGroup], resetPages: true });
  }

  function toggleRankGroupSection(rankGroup: RiotSeedCandidateRankGroupId) {
    setCandidateGroups((currentGroups) => ({
      ...currentGroups,
      [rankGroup]: {
        ...currentGroups[rankGroup],
        isExpanded: !currentGroups[rankGroup].isExpanded,
      },
    }));
  }

  function changeLifecycleFilter(nextLifecycleFilter: SeedCandidateLifecycleState | "all") {
    setLifecycleFilter(nextLifecycleFilter);
    setSelectedCandidateIds(new Set());
    setSelectedCandidateCache(new Map());
    setShowScanPanel(false);
    void loadCandidateGroups({
      filterOverrides: {
        lifecycleState: nextLifecycleFilter,
      },
      groupIds: [activeRankGroup],
      resetPages: true,
    });
  }

  async function copyPuuid(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus("PUUID copied.");
    } catch {
      setCopyStatus("Copy failed.");
    }
  }

  function toggleCandidateSelection(candidate: RiotSeedCandidateView) {
    if (!candidate.lifecycle.isSelectableForScan) {
      setStatus({
        error: getCandidateSelectionDisabledMessage(candidate),
        isLoading: false,
        success: null,
      });
      return;
    }

    setSelectedCandidateIds((currentSelection) => {
      const nextSelection = new Set(currentSelection);

      if (nextSelection.has(candidate.id)) {
        nextSelection.delete(candidate.id);
      } else {
        nextSelection.add(candidate.id);
      }

      return nextSelection;
    });
    setSelectedCandidateCache((currentCache) => {
      const nextCache = new Map(currentCache);
      nextCache.set(candidate.id, candidate);

      return nextCache;
    });
  }

  function selectAllVisibleCandidates(rankGroup: RiotSeedCandidateRankGroupId) {
    const visibleCandidates = candidateGroups[rankGroup].candidates.filter(
      (candidate) => candidate.lifecycle.isSelectableForScan,
    );

    setSelectedCandidateIds((currentSelection) => {
      const nextSelection = new Set(currentSelection);

      for (const candidate of visibleCandidates) {
        nextSelection.add(candidate.id);
      }

      return nextSelection;
    });
    setSelectedCandidateCache((currentCache) => {
      const nextCache = new Map(currentCache);

      for (const candidate of visibleCandidates) {
        nextCache.set(candidate.id, candidate);
      }

      return nextCache;
    });
    setStatus({
      error: null,
      isLoading: false,
      success: `${visibleCandidates.length} visible ${visibleCandidates.length === 1 ? "candidate" : "candidates"} selected.`,
    });
  }

  function clearSelectedCandidates() {
    setSelectedCandidateIds(new Set());
    setShowScanPanel(false);
    setStatus({ error: null, isLoading: false, success: "Selection cleared." });
  }

  function changeRankGroupPage(rankGroup: RiotSeedCandidateRankGroupId, page: number) {
    const currentGroup = candidateGroups[rankGroup];
    const nextPage = Math.min(Math.max(page, 1), currentGroup.totalPages);

    setCandidateGroups((currentGroups) => ({
      ...currentGroups,
      [rankGroup]: {
        ...currentGroups[rankGroup],
        page: nextPage,
      },
    }));
    void loadCandidateGroups({
      groupIds: [rankGroup],
      overrides: {
        [rankGroup]: {
          page: nextPage,
        },
      },
    });
  }

  function changeRankGroupPageSize(rankGroup: RiotSeedCandidateRankGroupId, pageSize: number) {
    setCandidateGroups((currentGroups) => ({
      ...currentGroups,
      [rankGroup]: {
        ...currentGroups[rankGroup],
        page: 1,
        pageSize,
      },
    }));
    void loadCandidateGroups({
      groupIds: [rankGroup],
      overrides: {
        [rankGroup]: {
          page: 1,
          pageSize,
        },
      },
    });
  }

  function changeRankGroupSort(
    rankGroup: RiotSeedCandidateRankGroupId,
    nextSort: RiotSeedCandidateSort,
  ) {
    const sortDirection = getDefaultRiotSeedCandidateSortDirection(nextSort);

    setCandidateGroups((currentGroups) => ({
      ...currentGroups,
      [rankGroup]: {
        ...currentGroups[rankGroup],
        page: 1,
        sort: nextSort,
        sortDirection,
      },
    }));
    void loadCandidateGroups({
      groupIds: [rankGroup],
      overrides: {
        [rankGroup]: {
          page: 1,
          sort: nextSort,
          sortDirection,
        },
      },
    });
  }

  function addSelectedToScanner() {
    if (selectedCandidates.length === 0) {
      setStatus({ error: "No candidates selected.", isLoading: false, success: null });
      return;
    }

    const blockedCandidate = selectedCandidates.find(
      (candidate) => !candidate.lifecycle.isSelectableForScan,
    );

    if (blockedCandidate) {
      setStatus({
        error: getCandidateSelectionDisabledMessage(blockedCandidate),
        isLoading: false,
        success: null,
      });
      return;
    }

    const addedCount = onAddPuuids(selectedCandidates.map((candidate) => candidate.puuid));

    onFocusScanner();
    setStatus({
      error: null,
      isLoading: false,
      success:
        addedCount > 0
          ? `${addedCount} seed ${addedCount === 1 ? "candidate" : "candidates"} added to the scanner.`
          : "Selected candidates were already in the scanner.",
    });
  }

  async function refreshCandidateRank(candidateId: string) {
    await refreshCandidateRanks([candidateId], true);
  }

  async function refreshSelectedRanks() {
    if (selectedCandidates.length === 0) {
      setStatus({ error: "No candidates selected.", isLoading: false, success: null });
      return;
    }

    if (selectedCandidates.length > maxSeedCandidateRankRefreshBatch) {
      setStatus({
        error: `Refresh rank for up to ${maxSeedCandidateRankRefreshBatch} candidates at a time.`,
        isLoading: false,
        success: null,
      });
      return;
    }

    await refreshCandidateRanks(
      selectedCandidates.map((candidate) => candidate.id),
      true,
    );
  }

  async function refreshCandidateRanks(candidateIds: string[], force: boolean) {
    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setStatus({ error: tokenResult.error, isLoading: false, success: null });
      return;
    }

    setStatus({ error: null, isLoading: true, success: null });

    const result = await refreshRiotSeedCandidateRanks({
      accessToken: tokenResult.accessToken,
      candidateIds,
      force,
    });

    if (!result.ok) {
      setStatus({ error: result.error, isLoading: false, success: null });
      return;
    }

    setStatus({
      error: null,
      isLoading: false,
      success: [
        `${result.total} rank ${result.total === 1 ? "refresh" : "refreshes"} completed.`,
        `${result.rankedCount} ranked`,
        `${result.unrankedCount} unranked`,
        result.skippedCount > 0 ? `${result.skippedCount} skipped by cooldown` : null,
        result.failedCount > 0 ? `${result.failedCount} failed` : null,
      ]
        .filter(Boolean)
        .join(" "),
    });
    await loadCandidateGroups();
  }

  async function rejectSelectedCandidates() {
    if (selectedCandidates.length === 0) {
      setStatus({ error: "No candidates selected.", isLoading: false, success: null });
      return;
    }

    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setStatus({ error: tokenResult.error, isLoading: false, success: null });
      return;
    }

    setStatus({ error: null, isLoading: true, success: null });

    const result = await rejectRiotSeedCandidates({
      accessToken: tokenResult.accessToken,
      candidateIds: selectedCandidates.map((candidate) => candidate.id),
      reason: "Rejected from Counter Pick seed lifecycle UI.",
    });

    if (!result.ok) {
      setStatus({ error: result.error, isLoading: false, success: null });
      return;
    }

    clearSelectedCandidates();
    setStatus({
      error: null,
      isLoading: false,
      success: `${result.updatedCount} seed ${result.updatedCount === 1 ? "candidate" : "candidates"} rejected.`,
    });
    await loadCandidateGroups();
  }

  async function restoreSelectedCandidates() {
    if (selectedCandidates.length === 0) {
      setStatus({ error: "No candidates selected.", isLoading: false, success: null });
      return;
    }

    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setStatus({ error: tokenResult.error, isLoading: false, success: null });
      return;
    }

    setStatus({ error: null, isLoading: true, success: null });

    const result = await restoreRiotSeedCandidates({
      accessToken: tokenResult.accessToken,
      candidateIds: selectedCandidates.map((candidate) => candidate.id),
    });

    if (!result.ok) {
      setStatus({ error: result.error, isLoading: false, success: null });
      return;
    }

    clearSelectedCandidates();
    setStatus({
      error: null,
      isLoading: false,
      success: `${result.updatedCount} seed ${result.updatedCount === 1 ? "candidate" : "candidates"} restored.`,
    });
    await loadCandidateGroups();
  }

  async function resetSelectedFailures() {
    if (selectedCandidates.length === 0) {
      setStatus({ error: "No candidates selected.", isLoading: false, success: null });
      return;
    }

    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setStatus({ error: tokenResult.error, isLoading: false, success: null });
      return;
    }

    setStatus({ error: null, isLoading: true, success: null });

    const result = await resetRiotSeedCandidateFailures({
      accessToken: tokenResult.accessToken,
      candidateIds: selectedCandidates.map((candidate) => candidate.id),
    });

    if (!result.ok) {
      setStatus({ error: result.error, isLoading: false, success: null });
      return;
    }

    clearSelectedCandidates();
    setStatus({
      error: null,
      isLoading: false,
      success: `${result.updatedCount} seed ${result.updatedCount === 1 ? "candidate" : "candidates"} reset.`,
    });
    await loadCandidateGroups();
  }

  function openSelectedScanPanel() {
    if (!showScanPanel) {
      if (primaryRoleFilter !== "all") {
        setBulkRole(primaryRoleFilter);
      }

      if (primaryChampionFilter.trim()) {
        setBulkDiscoveryFocusChampion(primaryChampionFilter);
      }
    }

    setShowScanPanel((current) => !current);
  }

  async function scanSelectedCandidates() {
    if (selectedCandidates.length === 0) {
      setStatus({ error: "No candidates selected.", isLoading: false, success: null });
      return;
    }

    const blockedCandidate = selectedCandidates.find(
      (candidate) => !candidate.lifecycle.isSelectableForScan,
    );

    if (blockedCandidate) {
      setStatus({
        error: getCandidateSelectionDisabledMessage(blockedCandidate),
        isLoading: false,
        success: null,
      });
      return;
    }

    if (selectedCandidates.length > maxSeedCandidatesPerScan) {
      setStatus({
        error: `You selected ${selectedCandidates.length} candidates. The maximum per scan job is ${maxSeedCandidatesPerScan}.`,
        isLoading: false,
        success: null,
      });
      return;
    }

    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      setStatus({ error: tokenResult.error, isLoading: false, success: null });
      return;
    }

    const parsedMatchCount = Number(bulkMatchCount);
    const parsedMinimumGames = Number(bulkMinimumGames);
    const parsedDisplayLimit = Number(bulkDisplayLimit);
    const enemyChampion = resolveChampionId(bulkEnemyChampionInput, champions);
    const counterChampion = resolveChampionId(bulkCounterChampionInput, champions);
    const discoveryFocusChampion = bulkDiscoveryFocusChampion.trim()
      ? resolveChampionId(bulkDiscoveryFocusChampion, champions)
      : null;

    if (
      !Number.isInteger(parsedMatchCount) ||
      parsedMatchCount < 1 ||
      parsedMatchCount > maxMatchCount
    ) {
      setStatus({
        error: `Match count must be between 1 and ${maxMatchCount}.`,
        isLoading: false,
        success: null,
      });
      return;
    }

    if (bulkMode === "target" && (!enemyChampion || !counterChampion)) {
      setStatus({
        error: "Select valid target champions.",
        isLoading: false,
        success: null,
      });
      return;
    }

    if (bulkMode === "target" && enemyChampion === counterChampion) {
      setStatus({
        error: "Enemy and counter champion cannot be the same.",
        isLoading: false,
        success: null,
      });
      return;
    }

    if (bulkMode === "discovery" && bulkDiscoveryFocusChampion.trim() && !discoveryFocusChampion) {
      setStatus({
        error: "Select a valid discovery focus champion.",
        isLoading: false,
        success: null,
      });
      return;
    }

    setStatus({ error: null, isLoading: true, success: null });

    const result = await startRiotScanJob({
      accessToken: tokenResult.accessToken,
      counterChampion,
      currentPatchOnly: bulkCurrentPatchOnly,
      discoveryFocusChampion,
      enemyChampion,
      matchCount: parsedMatchCount,
      maxDisplayedResults:
        bulkMode === "discovery" && Number.isInteger(parsedDisplayLimit) ? parsedDisplayLimit : 20,
      minimumGames:
        bulkMode === "discovery" && Number.isInteger(parsedMinimumGames) ? parsedMinimumGames : 1,
      mode: bulkMode,
      role: bulkRole,
      seedPuuids: selectedCandidates.map((candidate) => candidate.puuid),
    });

    if (!result.ok) {
      setStatus({ error: result.error, isLoading: false, success: null });
      return;
    }

    onScanStarted(result.job);
    setStatus({
      error: null,
      isLoading: false,
      success: `${selectedCandidates.length} selected seed ${selectedCandidates.length === 1 ? "candidate" : "candidates"} sent to the scanner.`,
    });
    setShowScanPanel(false);
    setSelectedCandidateIds(new Set());
    await loadCandidateGroups();
  }

  return (
    <Card className="border-white/10 bg-[#10182b]/90 text-white shadow-xl shadow-black/15">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="font-mono text-xl">Riot Seed Candidates</CardTitle>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Read-only candidate pool built from resolved Riot IDs and processed Riot matches.
            </p>
          </div>
          <Button
            className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
            disabled={status.isLoading}
            onClick={() => void loadCandidateGroups({ groupIds: [activeRankGroup] })}
            type="button"
            variant="ghost"
          >
            {status.isLoading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            Refresh candidates
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {seedCandidateLifecycleStates.map((lifecycleState) => (
            <div
              className={cn(
                "rounded-md border p-3",
                lifecycleState === lifecycleFilter
                  ? "border-cyan-300/30 bg-cyan-500/10"
                  : "border-white/10 bg-black/15",
              )}
              key={lifecycleState}
            >
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                {seedCandidateLifecycleLabels[lifecycleState]}
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-100">
                {formatNumber(lifecycleCounts[lifecycleState] ?? 0)}
              </p>
            </div>
          ))}
        </div>

        <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="flex flex-wrap gap-2">
            {riotSeedCandidateRankGroups.map((rankGroup) => (
              <button
                className={cn(
                  "rounded-md border px-3 py-2 text-sm font-semibold transition",
                  activeRankGroup === rankGroup.id
                    ? "border-cyan-300/30 bg-cyan-500/15 text-cyan-100"
                    : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]",
                )}
                key={rankGroup.id}
                onClick={() => changeActiveRankGroup(rankGroup.id)}
                type="button"
              >
                {rankGroup.label}
                <span className="ml-2 text-xs text-zinc-500">
                  {formatNumber(candidateGroups[rankGroup.id].totalCount)}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Lifecycle
            </span>
            {seedCandidateLifecycleFilters.map((candidateLifecycleState) => (
              <button
                className={cn(
                  "rounded-md border px-2.5 py-1.5 text-xs font-semibold transition",
                  lifecycleFilter === candidateLifecycleState
                    ? "border-violet-300/30 bg-violet-500/15 text-violet-100"
                    : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06]",
                )}
                key={candidateLifecycleState}
                onClick={() => changeLifecycleFilter(candidateLifecycleState)}
                type="button"
              >
                {candidateLifecycleState === "all"
                  ? "All"
                  : seedCandidateLifecycleLabels[candidateLifecycleState]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Platform</span>
            <Input
              className="h-10 border-white/10 bg-white/5 text-zinc-100 focus-visible:border-violet-400/70 focus-visible:ring-violet-400/20"
              onChange={(event) => setPlatformRegion(event.target.value)}
              value={platformRegion}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Search</span>
            <Input
              className="h-10 border-white/10 bg-white/5 text-zinc-100 focus-visible:border-violet-400/70 focus-visible:ring-violet-400/20"
              onChange={(event) => setSearchFilter(event.target.value)}
              placeholder="PUUID or champion"
              value={searchFilter}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Status</span>
            <select
              className={`${fieldClassName} h-10`}
              onChange={(event) =>
                setStatusFilter(event.target.value as RiotSeedCandidateStatus | "all")
              }
              value={statusFilter}
            >
              {seedCandidateStatuses.map((candidateStatus) => (
                <option
                  className={selectOptionClassName}
                  key={candidateStatus}
                  value={candidateStatus}
                >
                  {formatEnumLabel(candidateStatus)}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Source</span>
            <select
              className={`${fieldClassName} h-10`}
              onChange={(event) =>
                setSourceFilter(event.target.value as RiotSeedCandidateSource | "all")
              }
              value={sourceFilter}
            >
              {seedCandidateSources.map((source) => (
                <option className={selectOptionClassName} key={source} value={source}>
                  {formatEnumLabel(source)}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Rank status</span>
            <select
              className={`${fieldClassName} h-10`}
              onChange={(event) =>
                setRankStatusFilter(
                  event.target.value as RiotSeedCandidateRankEnrichmentStatus | "all",
                )
              }
              value={rankStatusFilter}
            >
              {seedCandidateRankStatuses.map((rankStatus) => (
                <option className={selectOptionClassName} key={rankStatus} value={rankStatus}>
                  {formatEnumLabel(rankStatus)}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Rank tier</span>
            <select
              className={`${fieldClassName} h-10`}
              onChange={(event) =>
                setRankTierFilter(event.target.value as (typeof seedCandidateRankTiers)[number])
              }
              value={rankTierFilter}
            >
              {seedCandidateRankTiers.map((rankTier) => (
                <option className={selectOptionClassName} key={rankTier} value={rankTier}>
                  {rankTier === "all" ? "All" : formatEnumLabel(rankTier)}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Ranked state</span>
            <select
              className={`${fieldClassName} h-10`}
              onChange={(event) =>
                setRankedStateFilter(
                  event.target.value as NonNullable<RiotSeedCandidateFilters["rankedState"]>,
                )
              }
              value={rankedStateFilter}
            >
              <option className={selectOptionClassName} value="all">
                All
              </option>
              <option className={selectOptionClassName} value="ranked">
                Ranked
              </option>
              <option className={selectOptionClassName} value="unranked">
                Unranked
              </option>
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Primary role</span>
            <select
              className={`${fieldClassName} h-10`}
              onChange={(event) => setPrimaryRoleFilter(event.target.value as LeagueRole | "all")}
              value={primaryRoleFilter}
            >
              <option className={selectOptionClassName} value="all">
                All
              </option>
              {leagueRoles.map((leagueRole) => (
                <option className={selectOptionClassName} key={leagueRole} value={leagueRole}>
                  {getRoleLabel(leagueRole)}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Champion</span>
            <Input
              className="h-10 border-white/10 bg-white/5 text-zinc-100 focus-visible:border-violet-400/70 focus-visible:ring-violet-400/20"
              onChange={(event) => setPrimaryChampionFilter(event.target.value)}
              placeholder="Ahri"
              value={primaryChampionFilter}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Min games</span>
            <Input
              className="h-10 border-white/10 bg-white/5 text-zinc-100 focus-visible:border-violet-400/70 focus-visible:ring-violet-400/20"
              min={0}
              onChange={(event) => setMinimumObservedGames(event.target.value)}
              type="number"
              value={minimumObservedGames}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Min role %</span>
            <Input
              className="h-10 border-white/10 bg-white/5 text-zinc-100 focus-visible:border-violet-400/70 focus-visible:ring-violet-400/20"
              min={0}
              onChange={(event) => setMinimumPrimaryRoleShare(event.target.value)}
              type="number"
              value={minimumPrimaryRoleShare}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Min champion %</span>
            <Input
              className="h-10 border-white/10 bg-white/5 text-zinc-100 focus-visible:border-violet-400/70 focus-visible:ring-violet-400/20"
              min={0}
              onChange={(event) => setMinimumPrimaryChampionShare(event.target.value)}
              type="number"
              value={minimumPrimaryChampionShare}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Last scanned</span>
            <select
              className={`${fieldClassName} h-10`}
              onChange={(event) =>
                setLastScannedFilter(
                  event.target.value as NonNullable<RiotSeedCandidateFilters["lastScanned"]>,
                )
              }
              value={lastScannedFilter}
            >
              {seedCandidateLastScannedFilters.map((filter) => (
                <option className={selectOptionClassName} key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Rank refreshed</span>
            <select
              className={`${fieldClassName} h-10`}
              onChange={(event) =>
                setRankLastRefreshedFilter(
                  event.target.value as NonNullable<RiotSeedCandidateFilters["rankLastRefreshed"]>,
                )
              }
              value={rankLastRefreshedFilter}
            >
              {seedCandidateRankRefreshFilters.map((filter) => (
                <option className={selectOptionClassName} key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-end justify-end gap-3">
          <Button
            className="h-10 bg-violet-500/80 px-4 text-white hover:bg-violet-500"
            disabled={status.isLoading}
            onClick={applyFilters}
            type="button"
          >
            {status.isLoading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="size-4" aria-hidden="true" />
            )}
            Apply filters
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
          <div>
            <p className="text-sm font-semibold text-zinc-100">
              {selectedCandidates.length}{" "}
              {selectedCandidates.length === 1 ? "candidate" : "candidates"} selected
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Select all applies to the visible page inside each rank group.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
              disabled={selectedCandidates.length === 0}
              onClick={clearSelectedCandidates}
              size="sm"
              type="button"
              variant="ghost"
            >
              <X className="size-3.5" aria-hidden="true" />
              Clear selection
            </Button>
            <Button
              className="border-cyan-300/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
              disabled={selectedCandidates.length === 0}
              onClick={addSelectedToScanner}
              size="sm"
              type="button"
              variant="ghost"
            >
              <UserPlus className="size-3.5" aria-hidden="true" />
              Add selected to scanner
            </Button>
            <Button
              className="border-amber-300/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
              disabled={status.isLoading || selectedCandidates.length === 0}
              onClick={() => void refreshSelectedRanks()}
              size="sm"
              type="button"
              variant="ghost"
            >
              {status.isLoading ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-3.5" aria-hidden="true" />
              )}
              Refresh rank for selected
            </Button>
            {selectedCandidates.some((candidate) => candidate.lifecycle.state === "failed") ? (
              <Button
                className="border-sky-300/20 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20"
                disabled={status.isLoading || selectedCandidates.length === 0}
                onClick={() => void resetSelectedFailures()}
                size="sm"
                type="button"
                variant="ghost"
              >
                Reset failed
              </Button>
            ) : null}
            {selectedCandidates.some((candidate) => candidate.lifecycle.state === "rejected") ? (
              <Button
                className="border-emerald-300/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
                disabled={status.isLoading || selectedCandidates.length === 0}
                onClick={() => void restoreSelectedCandidates()}
                size="sm"
                type="button"
                variant="ghost"
              >
                Restore selected
              </Button>
            ) : (
              <Button
                className="border-rose-300/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                disabled={status.isLoading || selectedCandidates.length === 0}
                onClick={() => void rejectSelectedCandidates()}
                size="sm"
                type="button"
                variant="ghost"
              >
                Reject selected
              </Button>
            )}
            <Button
              className="bg-violet-500/80 text-white hover:bg-violet-500"
              disabled={selectedCandidates.length === 0}
              onClick={openSelectedScanPanel}
              size="sm"
              type="button"
            >
              <Play className="size-3.5" aria-hidden="true" />
              Scan selected
            </Button>
          </div>
        </div>

        {selectedCandidates.length > maxSeedCandidatesPerScan ? (
          <p className="rounded-md border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-100">
            You selected {selectedCandidates.length} candidates. The maximum per scan job is{" "}
            {maxSeedCandidatesPerScan}.
          </p>
        ) : null}

        {selectedRecentScanCount > 0 ? (
          <p className="rounded-md border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100">
            {selectedRecentScanCount} selected{" "}
            {selectedRecentScanCount === 1 ? "candidate was" : "candidates were"} scanned within the
            last {recentSeedCandidateScanHours} hours.
          </p>
        ) : null}

        {selectedRecentRankRefreshCount > 0 ? (
          <p className="rounded-md border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100">
            {selectedRecentRankRefreshCount} selected{" "}
            {selectedRecentRankRefreshCount === 1 ? "candidate was" : "candidates were"} rank
            refreshed within the last {recentSeedCandidateRankRefreshHours} hours.
          </p>
        ) : null}

        {selectedCandidates.length > 0 && selectedRecentScanCount === selectedCandidates.length ? (
          <p className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-400">
            All selected candidates were scanned recently.
          </p>
        ) : null}

        {showScanPanel ? (
          <div className="space-y-4 rounded-lg border border-violet-300/20 bg-violet-500/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-violet-100">Scan selected</h4>
                <p className="mt-1 text-xs text-zinc-400">
                  {selectedCandidates.length} selected seed{" "}
                  {selectedCandidates.length === 1 ? "candidate" : "candidates"}
                </p>
              </div>
              <Button
                className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
                onClick={() => setShowScanPanel(false)}
                size="sm"
                type="button"
                variant="ghost"
              >
                <X className="size-3.5" aria-hidden="true" />
                Close
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="block space-y-2">
                <span className="text-sm text-zinc-300">Mode</span>
                <select
                  className={`${fieldClassName} h-10`}
                  onChange={(event) => setBulkMode(event.target.value as RiotScanMode)}
                  value={bulkMode}
                >
                  <option className={selectOptionClassName} value="discovery">
                    Matchup discovery
                  </option>
                  <option className={selectOptionClassName} value="target">
                    Target matchup
                  </option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-zinc-300">Role</span>
                <select
                  className={`${fieldClassName} h-10`}
                  onChange={(event) => setBulkRole(event.target.value as LeagueRole)}
                  value={bulkRole}
                >
                  {leagueRoles.map((leagueRole) => (
                    <option className={selectOptionClassName} key={leagueRole} value={leagueRole}>
                      {getRoleLabel(leagueRole)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-zinc-300">Matches per seed</span>
                <Input
                  className="h-10 border-white/10 bg-white/5 text-zinc-100 focus-visible:border-violet-400/70 focus-visible:ring-violet-400/20"
                  max={maxMatchCount}
                  min={1}
                  onChange={(event) => setBulkMatchCount(event.target.value)}
                  type="number"
                  value={bulkMatchCount}
                />
              </label>

              <label className="flex items-center gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2">
                <input
                  checked={bulkCurrentPatchOnly}
                  className="size-4 accent-cyan-400"
                  onChange={(event) => setBulkCurrentPatchOnly(event.target.checked)}
                  type="checkbox"
                />
                <span className="text-sm text-zinc-300">Current patch only</span>
              </label>
            </div>

            {bulkMode === "discovery" ? (
              <div className="grid gap-4 md:grid-cols-3">
                <ChampionSearchInput
                  disabled={status.isLoading}
                  label="Focus champion (optional)"
                  onChange={setBulkDiscoveryFocusChampion}
                  options={champions}
                  value={bulkDiscoveryFocusChampion}
                />
                <label className="block space-y-2">
                  <span className="text-sm text-zinc-300">Minimum games</span>
                  <Input
                    className="h-10 border-white/10 bg-white/5 text-zinc-100 focus-visible:border-violet-400/70 focus-visible:ring-violet-400/20"
                    min={1}
                    onChange={(event) => setBulkMinimumGames(event.target.value)}
                    type="number"
                    value={bulkMinimumGames}
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm text-zinc-300">Display limit</span>
                  <Input
                    className="h-10 border-white/10 bg-white/5 text-zinc-100 focus-visible:border-violet-400/70 focus-visible:ring-violet-400/20"
                    max={maxDisplayedResults}
                    min={1}
                    onChange={(event) => setBulkDisplayLimit(event.target.value)}
                    type="number"
                    value={bulkDisplayLimit}
                  />
                </label>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <ChampionSearchInput
                  disabled={status.isLoading}
                  label="Enemy champion"
                  onChange={setBulkEnemyChampionInput}
                  options={champions}
                  value={bulkEnemyChampionInput}
                />
                <ChampionSearchInput
                  disabled={status.isLoading}
                  label="Counter champion"
                  onChange={setBulkCounterChampionInput}
                  options={champions}
                  value={bulkCounterChampionInput}
                />
              </div>
            )}

            <Button
              className="bg-violet-500/80 text-white hover:bg-violet-500"
              disabled={status.isLoading || selectedCandidates.length > maxSeedCandidatesPerScan}
              onClick={() => void scanSelectedCandidates()}
              type="button"
            >
              {status.isLoading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="size-4" aria-hidden="true" />
              )}
              Confirm scan selected
            </Button>
          </div>
        ) : null}

        <StatusMessage status={status} />
        {copyStatus ? (
          <p className="rounded-md border border-cyan-400/20 bg-cyan-500/10 p-3 text-sm text-cyan-100">
            {copyStatus}
          </p>
        ) : null}

        <div className="space-y-3">
          {riotSeedCandidateRankGroups
            .filter((rankGroup) => rankGroup.id === activeRankGroup)
            .map((rankGroup) => (
              <SeedCandidateRankGroupSection
                championDisplayNamesById={championDisplayNamesById}
                expandedCandidateId={expandedCandidateId}
                group={rankGroup}
                groupState={candidateGroups[rankGroup.id]}
                key={rankGroup.id}
                onCandidateCopy={(candidate) => void copyPuuid(candidate.puuid)}
                onCandidateRefreshRank={(candidate) => void refreshCandidateRank(candidate.id)}
                onCandidateSelectionChange={toggleCandidateSelection}
                onCandidateToggle={(candidate) =>
                  setExpandedCandidateId((currentId) =>
                    currentId === candidate.id ? null : candidate.id,
                  )
                }
                onPageChange={(page) => changeRankGroupPage(rankGroup.id, page)}
                onPageSizeChange={(pageSize) => changeRankGroupPageSize(rankGroup.id, pageSize)}
                onRetry={() => void loadCandidateGroups({ groupIds: [rankGroup.id] })}
                onSelectAllVisible={() => selectAllVisibleCandidates(rankGroup.id)}
                onSortChange={(nextSort) => changeRankGroupSort(rankGroup.id, nextSort)}
                onToggle={() => toggleRankGroupSection(rankGroup.id)}
                selectedCandidateIds={selectedCandidateIds}
                selectedCount={
                  candidateGroups[rankGroup.id].candidates.filter((candidate) =>
                    selectedCandidateIds.has(candidate.id),
                  ).length
                }
              />
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SeedCandidateRankGroupSection({
  championDisplayNamesById,
  expandedCandidateId,
  group,
  groupState,
  onCandidateCopy,
  onCandidateRefreshRank,
  onCandidateSelectionChange,
  onCandidateToggle,
  onPageChange,
  onPageSizeChange,
  onRetry,
  onSelectAllVisible,
  onSortChange,
  onToggle,
  selectedCandidateIds,
  selectedCount,
}: {
  championDisplayNamesById: Map<string, string>;
  expandedCandidateId: string | null;
  group: (typeof riotSeedCandidateRankGroups)[number];
  groupState: SeedCandidateGroupState;
  onCandidateCopy: (candidate: RiotSeedCandidateView) => void;
  onCandidateRefreshRank: (candidate: RiotSeedCandidateView) => void;
  onCandidateSelectionChange: (candidate: RiotSeedCandidateView) => void;
  onCandidateToggle: (candidate: RiotSeedCandidateView) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRetry: () => void;
  onSelectAllVisible: () => void;
  onSortChange: (sort: RiotSeedCandidateSort) => void;
  onToggle: () => void;
  selectedCandidateIds: Set<string>;
  selectedCount: number;
}) {
  const range = getRiotSeedCandidateRange({
    page: groupState.page,
    pageSize: groupState.pageSize,
    totalCount: groupState.totalCount,
  });
  const selectableCandidates = groupState.candidates.filter(
    (candidate) => candidate.lifecycle.isSelectableForScan,
  );
  const visibleCandidatesSelected =
    selectableCandidates.length > 0 &&
    selectableCandidates.every((candidate) => selectedCandidateIds.has(candidate.id));
  const panelId = `riot-seed-candidates-${group.id}-panel`;

  return (
    <section className="overflow-hidden rounded-lg border border-white/10 bg-black/15">
      <button
        aria-controls={panelId}
        aria-expanded={groupState.isExpanded}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-white/[0.04]"
        onClick={onToggle}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-3">
          {groupState.isExpanded ? (
            <ChevronDown className="size-4 shrink-0 text-cyan-200" aria-hidden="true" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
          )}
          <span>
            <span className="block font-mono text-base text-white">{group.label}</span>
            <span className="mt-1 block text-xs text-zinc-500">{group.description}</span>
          </span>
        </span>
        <span className="shrink-0 text-right text-xs text-zinc-400">
          <span className="block font-semibold text-cyan-100">
            {formatNumber(groupState.totalCount)}{" "}
            {groupState.totalCount === 1 ? "candidate" : "candidates"}
          </span>
          {selectedCount > 0 ? (
            <span className="mt-1 block text-amber-100">{selectedCount} selected on this page</span>
          ) : null}
        </span>
      </button>

      {groupState.isExpanded ? (
        <div className="space-y-4 border-t border-white/10 p-4" id={panelId}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-xs text-zinc-400">Sort this group</span>
                <select
                  className={`${fieldClassName} h-9`}
                  disabled={groupState.isLoading}
                  onChange={(event) => onSortChange(event.target.value as RiotSeedCandidateSort)}
                  value={groupState.sort}
                >
                  {seedCandidateSorts.map((candidateSort) => (
                    <option
                      className={selectOptionClassName}
                      key={candidateSort.value}
                      value={candidateSort.value}
                    >
                      {candidateSort.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-xs text-zinc-400">Page size</span>
                <select
                  className={`${fieldClassName} h-9`}
                  disabled={groupState.isLoading}
                  onChange={(event) => onPageSizeChange(Number(event.target.value))}
                  value={groupState.pageSize}
                >
                  {riotSeedCandidatePageSizes.map((pageSize) => (
                    <option className={selectOptionClassName} key={pageSize} value={pageSize}>
                      {pageSize}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-500">
                Showing {range.from}-{range.to} of {formatNumber(groupState.totalCount)}
              </span>
              <Button
                className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
                disabled={groupState.page <= 1 || groupState.isLoading}
                onClick={() => onPageChange(groupState.page - 1)}
                size="sm"
                type="button"
                variant="ghost"
              >
                Previous
              </Button>
              <span className="text-xs text-zinc-400">
                Page {groupState.page} of {groupState.totalPages}
              </span>
              <Button
                className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
                disabled={groupState.page >= groupState.totalPages || groupState.isLoading}
                onClick={() => onPageChange(groupState.page + 1)}
                size="sm"
                type="button"
                variant="ghost"
              >
                Next
              </Button>
              <Button
                className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
                disabled={selectableCandidates.length === 0 || visibleCandidatesSelected}
                onClick={onSelectAllVisible}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Check className="size-3.5" aria-hidden="true" />
                Select all visible
              </Button>
            </div>
          </div>

          {groupState.isLoading ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-500">
              Loading {group.label} candidates...
            </div>
          ) : groupState.error ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
              <span>Could not load candidates.</span>
              <Button
                className="border-rose-300/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                onClick={onRetry}
                size="sm"
                type="button"
                variant="ghost"
              >
                Retry
              </Button>
            </div>
          ) : groupState.candidates.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-500">
              No {group.label} candidates match the current filters.
            </div>
          ) : (
            <div className="space-y-3">
              {groupState.candidates.map((candidate) => (
                <SeedCandidateRow
                  championDisplayNamesById={championDisplayNamesById}
                  candidate={candidate}
                  expanded={expandedCandidateId === candidate.id}
                  key={candidate.id}
                  onCopy={() => onCandidateCopy(candidate)}
                  onRefreshRank={() => onCandidateRefreshRank(candidate)}
                  onSelectionChange={() => onCandidateSelectionChange(candidate)}
                  onToggle={() => onCandidateToggle(candidate)}
                  selected={selectedCandidateIds.has(candidate.id)}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function createInitialSeedCandidateGroupStates(): SeedCandidateGroupStates {
  return riotSeedCandidateRankGroups.reduce((groups, group) => {
    const request = createDefaultRiotSeedCandidateGroupRequest(group.id);

    groups[group.id] = {
      candidates: [],
      error: null,
      isExpanded: group.id === "master-plus",
      isLoading: false,
      loaded: false,
      page: request.page,
      pageSize: request.pageSize,
      sort: request.sort,
      sortDirection: request.sortDirection,
      totalCount: 0,
      totalPages: 1,
    };

    return groups;
  }, {} as SeedCandidateGroupStates);
}

function createEmptyLifecycleCounts() {
  return seedCandidateLifecycleStates.reduce(
    (counts, lifecycleState) => {
      counts[lifecycleState] = 0;
      return counts;
    },
    {} as Record<SeedCandidateLifecycleState, number>,
  );
}

function SeedCandidateRow({
  candidate,
  championDisplayNamesById,
  expanded,
  onCopy,
  onRefreshRank,
  onSelectionChange,
  onToggle,
  selected,
}: {
  candidate: RiotSeedCandidateView;
  championDisplayNamesById: Map<string, string>;
  expanded: boolean;
  onCopy: () => void;
  onRefreshRank: () => void;
  onSelectionChange: () => void;
  onToggle: () => void;
  selected: boolean;
}) {
  const lifecycle = candidate.lifecycle;
  const selectionDisabled = !lifecycle.isSelectableForScan;

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-black/15">
      <div className="flex items-stretch">
        <label
          className={cn(
            "flex items-center border-r border-white/10 px-3",
            selectionDisabled ? "cursor-not-allowed opacity-40" : "",
          )}
          title={selectionDisabled ? getCandidateSelectionDisabledMessage(candidate) : undefined}
        >
          <input
            checked={selected}
            className="size-4 accent-cyan-400"
            disabled={selectionDisabled}
            onChange={onSelectionChange}
            type="checkbox"
          />
          <span className="sr-only">Select candidate</span>
        </label>
        <button
          className="grid min-w-0 flex-1 gap-3 p-3 text-left text-sm transition hover:bg-white/[0.04] md:grid-cols-[1fr_0.8fr_0.7fr_0.75fr_0.75fr_0.6fr_auto]"
          onClick={onToggle}
          type="button"
        >
          <span className="min-w-0">
            <span className="block truncate font-mono text-xs text-cyan-100">
              {shortenPuuid(candidate.puuid)}
            </span>
            <span className="mt-1 block text-xs text-zinc-500">
              {candidate.platform_region} - {candidate.regional_routing}
            </span>
          </span>
          <span>
            <span className="block text-xs uppercase tracking-wide text-zinc-500">Lifecycle</span>
            <span className="font-semibold text-zinc-100">
              {seedCandidateLifecycleLabels[lifecycle.state]}
            </span>
            <span className="mt-1 block text-xs text-zinc-500">
              {formatLifecycleReasons(lifecycle.reasonCodes)}
            </span>
          </span>
          <span>
            <span className="block text-xs uppercase tracking-wide text-zinc-500">Rank</span>
            <span className="font-semibold text-zinc-100">{formatCandidateRank(candidate)}</span>
          </span>
          <span>
            <span className="block text-xs uppercase tracking-wide text-zinc-500">Role</span>
            <span className="font-semibold text-zinc-100">
              {candidate.estimated_primary_role
                ? `${getRoleLabel(candidate.estimated_primary_role)} ${formatPercent(
                    candidate.primary_role_share,
                  )}`
                : "Pending"}
            </span>
          </span>
          <span>
            <span className="block text-xs uppercase tracking-wide text-zinc-500">Champion</span>
            <span className="font-semibold text-zinc-100">
              {candidate.primary_champion
                ? `${getChampionDisplayName(
                    championDisplayNamesById,
                    candidate.primary_champion,
                  )} ${formatPercent(candidate.primary_champion_share)}`
                : "Pending"}
            </span>
          </span>
          <span>
            <span className="block text-xs uppercase tracking-wide text-zinc-500">Games</span>
            <span className="font-semibold text-zinc-100">
              {formatNumber(candidate.observed_games)}
            </span>
          </span>
          <span className="text-xs font-semibold text-cyan-200">
            {expanded ? "Hide details" : "Details"}
          </span>
        </button>
      </div>

      {expanded ? (
        <div className="space-y-4 border-t border-white/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="break-all font-mono text-xs text-zinc-300">{candidate.puuid}</p>
            <Button
              className="border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
              onClick={onCopy}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Clipboard className="size-3.5" aria-hidden="true" />
              Copy PUUID
            </Button>
            <Button
              className="border-amber-300/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
              onClick={onRefreshRank}
              size="sm"
              type="button"
              variant="ghost"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Refresh rank
            </Button>
          </div>

          <div className="grid gap-2 text-xs text-zinc-400 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Source" value={formatEnumLabel(candidate.source)} />
            <Metric label="First seen" value={formatDateTime(candidate.first_seen_at)} />
            <Metric label="Last seen" value={formatDateTime(candidate.last_seen_at)} />
            <Metric label="Latest match" value={formatDateTime(candidate.latest_match_seen_at)} />
            <Metric label="First match" value={candidate.first_seen_match_id} />
            <Metric label="First scan job" value={candidate.first_seen_scan_job_id} />
            <Metric label="Last profiled" value={formatDateTime(candidate.last_profiled_at)} />
            <Metric label="Last scanned" value={formatDateTime(candidate.last_scanned_at)} />
            <Metric
              label="Last successful"
              value={formatDateTime(candidate.last_successful_scan_at)}
            />
            <Metric
              label="Next eligible"
              value={formatDateTime(candidate.lifecycle.nextEligibleAt)}
            />
            <Metric label="Lifecycle" value={seedCandidateLifecycleLabels[lifecycle.state]} />
            <Metric
              label="Lifecycle reason"
              value={formatLifecycleReasons(lifecycle.reasonCodes)}
            />
            <Metric label="Latest scan job" value={candidate.latest_scan_job_id} />
            <Metric label="New unique matches" value={candidate.last_scan_unique_matches_found} />
            <Metric label="Match IDs fetched" value={candidate.last_scan_match_ids_fetched} />
            <Metric
              label="Duplicate matches"
              value={candidate.last_scan_duplicate_matches_skipped}
            />
            <Metric label="Duplicate rate" value={formatLastScanDuplicateRate(candidate)} />
            <Metric
              label="Useful observations"
              value={candidate.last_scan_matchup_observations_inserted}
            />
            <Metric
              label="Candidate observations"
              value={candidate.last_scan_candidate_observations_discovered}
            />
            <Metric label="Times scanned" value={candidate.times_scanned} />
            <Metric label="Successful scans" value={candidate.successful_scan_count} />
            <Metric label="Failed scans" value={candidate.failed_scan_count} />
            <Metric label="Consecutive failures" value={candidate.consecutive_scan_failures} />
            <Metric label="Last scan error" value={candidate.last_scan_error_code} />
            <Metric label="Retry at" value={formatDateTime(candidate.next_retry_at)} />
            <Metric label="Rejected at" value={formatDateTime(candidate.manually_rejected_at)} />
            <Metric label="Rejection reason" value={candidate.rejection_reason} />
            <Metric label="Rank status" value={formatEnumLabel(candidate.rank_enrichment_status)} />
            <Metric label="Rank" value={formatCandidateRank(candidate)} />
            <Metric label="Rank win rate" value={formatPercent(candidate.rank_win_rate)} />
            <Metric label="Rank record" value={formatRankRecord(candidate)} />
            <Metric label="Rank refreshed" value={formatDateTime(candidate.rank_last_success_at)} />
            <Metric
              label="Rank next eligible"
              value={formatDateTime(candidate.rank_next_eligible_at)}
            />
            <Metric label="Rank attempts" value={candidate.rank_enrichment_attempts} />
            <Metric label="Rank failures" value={candidate.rank_enrichment_failures} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <CandidateRoleDistribution candidate={candidate} />
            <CandidateTopChampions
              championDisplayNamesById={championDisplayNamesById}
              champions={candidate.top_champions ?? []}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CandidateRoleDistribution({ candidate }: { candidate: RiotSeedCandidateView }) {
  const entries = leagueRoles
    .map((leagueRole) => ({
      role: leagueRole,
      value: candidate.role_distribution?.[leagueRole],
    }))
    .filter((entry) => entry.value);

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <h4 className="text-sm font-semibold text-white">Role distribution</h4>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">Pending</p>
      ) : (
        <div className="mt-3 space-y-2">
          {entries.map((entry) => (
            <div
              className="flex items-center justify-between gap-3 text-xs text-zinc-300"
              key={entry.role}
            >
              <span>{getRoleLabel(entry.role)}</span>
              <span>
                {entry.value?.games ?? 0} games - {formatPercent(entry.value?.share)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CandidateTopChampions({
  championDisplayNamesById,
  champions,
}: {
  championDisplayNamesById: Map<string, string>;
  champions: RiotSeedCandidateTopChampion[];
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <h4 className="text-sm font-semibold text-white">Top champions</h4>
      {champions.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">Pending</p>
      ) : (
        <div className="mt-3 space-y-2">
          {champions.map((champion) => (
            <div
              className="grid grid-cols-[1fr_auto] gap-3 text-xs text-zinc-300"
              key={`${champion.champion}-${champion.role}`}
            >
              <span className="font-semibold text-zinc-100">
                {getChampionDisplayName(championDisplayNamesById, champion.champion)}{" "}
                {getRoleLabel(champion.role)}
              </span>
              <span>
                {champion.games} games - {champion.wins}W {champion.losses}L -{" "}
                {formatPercent(champion.share)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "rounded-md px-3 py-2 text-sm font-semibold transition",
        active ? "bg-cyan-500/20 text-cyan-100" : "text-zinc-400 hover:bg-white/5 hover:text-white",
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function ChampionSearchInput({
  disabled,
  label,
  onChange,
  options,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  options: AdminLeagueChampion[];
  value: string;
}) {
  const listId = `riot-scanner-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <label className="block space-y-2">
      <span className="text-sm text-zinc-300">{label}</span>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
          aria-hidden="true"
        />
        <Input
          className="h-10 border-white/10 bg-white/5 pl-9 text-zinc-100 placeholder:text-zinc-500 focus-visible:border-violet-400/70 focus-visible:ring-violet-400/20"
          disabled={disabled}
          list={listId}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search champion..."
          value={value}
        />
      </div>
      <datalist id={listId}>
        {options.map((champion) => (
          <option key={champion.id} value={champion.name}>
            {champion.id}
          </option>
        ))}
      </datalist>
    </label>
  );
}

function RiotScanJobDetails({
  championDisplayNamesById,
  job,
}: {
  championDisplayNamesById: Map<string, string>;
  job: RiotScanJobView;
}) {
  const result = job.results;
  const targetResult = !Array.isArray(result) ? result : null;
  const discoveryResults = Array.isArray(result) ? result : [];
  const riotApiFailure = getRiotApiFailure(job);
  const focusChampionLabel = job.focus_champion_id
    ? (championDisplayNamesById.get(job.focus_champion_id) ??
      job.summary.focusChampionDisplayName ??
      job.focus_champion_id)
    : null;

  return (
    <div className="space-y-4 rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Job #{job.id}</h3>
          <p className="mt-1 text-xs text-zinc-500">
            {getModeLabel(job.mode)} - {getRoleLabel(job.role)} - {job.seed_count} seed{" "}
            {job.seed_count === 1 ? "PUUID" : "PUUIDs"}
          </p>
          {focusChampionLabel ? (
            <p className="mt-1 text-xs font-semibold text-cyan-200">
              Focus champion: {focusChampionLabel}
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            "rounded-md border px-2 py-1 text-xs font-semibold",
            job.status === "completed"
              ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
              : job.status === "failed"
                ? "border-rose-300/20 bg-rose-500/10 text-rose-100"
                : "border-cyan-300/20 bg-cyan-500/10 text-cyan-100",
          )}
        >
          {getRiotScanJobStatusLabel(job)}
        </span>
      </div>

      {riotApiFailure ? <RiotApiAuthenticationFailureWarning job={job} /> : null}

      {job.error_message && !riotApiFailure ? (
        <p className="rounded-md border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-100">
          {job.error_message}
        </p>
      ) : null}

      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Matchup data collection
        </h4>
        <div className="grid gap-2 text-xs text-zinc-400 sm:grid-cols-2 lg:grid-cols-3">
          <Metric label="Fetched match IDs" value={job.progress.fetchedMatchIds} />
          <Metric label="Unique match IDs" value={job.progress.uniqueMatchIds} />
          <Metric label="Scanned matches" value={job.progress.matchesScanned} />
          <Metric label="Patch skipped" value={job.progress.patchSkipped} />
          <Metric label="Queue skipped" value={job.progress.queueSkipped} />
          <Metric label="Role skipped" value={job.progress.roleSkipped} />
          <Metric
            label="Selected-role matchups found"
            value={job.progress.selectedRoleMatchupsFound}
          />
          <Metric
            label="All-role observations attempted"
            value={job.progress.allRoleObservationsAttempted}
          />
          <Metric
            label="Technical invalid observations skipped"
            value={job.progress.observationsSkippedTechnicalInvalid}
          />
          {job.mode === "target" ? (
            <Metric label="Champion pair matched" value={job.progress.championPairMatched} />
          ) : null}
          <Metric
            label="Champion identifiers processed"
            value={job.progress.champion_identifiers_processed}
          />
          <Metric
            label="Champion identifiers normalized"
            value={job.progress.champion_identifiers_normalized}
          />
          <Metric
            label="Champion aliases resolved"
            value={job.progress.champion_aliases_resolved}
          />
          <Metric
            label="Champion normalization failures"
            value={job.progress.champion_normalization_failures}
          />
          <Metric
            label="Champion identifier conflicts"
            value={job.progress.champion_identifier_conflicts}
          />
          <Metric label="Matchup pairs discovered" value={job.progress.matchupPairsDiscovered} />
          <Metric label="Observations found" value={job.progress.observationsFound} />
          <Metric label="Top observations" value={job.progress.observationsByRole?.top} />
          <Metric label="Jungle observations" value={job.progress.observationsByRole?.jungle} />
          <Metric label="Mid observations" value={job.progress.observationsByRole?.mid} />
          <Metric label="ADC observations" value={job.progress.observationsByRole?.adc} />
          <Metric label="Support observations" value={job.progress.observationsByRole?.support} />
          <Metric
            label="Matchup observations validated"
            value={job.progress.matchupObservationsValidated}
          />
          <Metric
            label="Matchup observations rejected"
            value={job.progress.matchupObservationsRejected}
          />
          <Metric label="New observations saved" value={job.progress.observationsInserted} />
          <Metric
            label="Duplicate observations skipped"
            value={job.progress.observationDuplicatesSkipped}
          />
          <Metric
            label="Rank attributions attempted"
            value={job.progress.matchupRankAttributionsAttempted}
          />
          <Metric
            label="Two-player rank attributions"
            value={job.progress.matchupRankAttributionsTwoPlayer}
          />
          <Metric
            label="Single-player rank attributions"
            value={job.progress.matchupRankAttributionsSinglePlayer}
          />
          <Metric
            label="Unknown rank attributions"
            value={job.progress.matchupRankAttributionsUnknown}
          />
          <Metric label="Rank snapshots too old" value={job.progress.matchupRankSnapshotTooOld} />
          <Metric
            label="Rank participants not found"
            value={job.progress.matchupRankParticipantsNotFound}
          />
          <Metric
            label="Rank attribution failures"
            value={job.progress.matchupRankAttributionFailures}
          />
          <Metric
            label="Observation insert failures"
            value={job.progress.observationInsertFailures}
          />
          <Metric label="Matchup batch splits" value={job.progress.matchupObservationBatchSplits} />
          <Metric
            label="Matchup isolated failures"
            value={job.progress.matchupObservationIsolatedFailures}
          />
          <Metric label="Counter pick stat rows updated" value={job.progress.statsRowsUpdated} />
          <Metric
            label="Counter pick aggregates validated"
            value={job.progress.counterPickAggregatesValidated}
          />
          <Metric
            label="Counter pick aggregate validation failures"
            value={job.progress.counterPickAggregateValidationFailures}
          />
          <Metric
            label="Counter pick aggregate insert failures"
            value={job.progress.counterPickAggregateInsertFailures}
          />
          <Metric label="Started" value={formatDateTime(job.started_at)} />
          <Metric label="Completed" value={formatDateTime(job.completed_at)} />
        </div>
      </div>

      {focusChampionLabel ? (
        <div className="space-y-3 rounded-md border border-cyan-300/20 bg-cyan-500/10 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-cyan-100">
            Focused discovery
          </h4>
          <div className="grid gap-2 text-xs text-zinc-400 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Focus champion" value={focusChampionLabel} />
            <Metric label="Focus matches found" value={job.progress.focus_champion_matches_found} />
            <Metric
              label="Focus matchup pairs"
              value={job.progress.focus_matchup_pairs_discovered}
            />
            <Metric label="Focus wins" value={job.progress.focus_champion_wins} />
            <Metric label="Focus losses" value={job.progress.focus_champion_losses} />
            <Metric
              label="Focus observations new"
              value={job.progress.focus_champion_observations_new}
            />
            <Metric
              label="Focus observations duplicate"
              value={job.progress.focus_champion_observations_duplicate}
            />
          </div>
        </div>
      ) : null}

      <ValidationIssueSummary job={job} />
      <PersistenceRecoverySummary job={job} />

      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Seed candidate discovery
        </h4>
        <div className="grid gap-2 text-xs text-zinc-400 sm:grid-cols-2 lg:grid-cols-3">
          <Metric
            label="Participant PUUIDs observed"
            value={job.progress.participantPuuidsObserved}
          />
          <Metric
            label="Unique candidates encountered"
            value={job.progress.uniqueCandidatesEncountered}
          />
          <Metric label="New candidates created" value={job.progress.newCandidatesCreated} />
          <Metric
            label="Existing candidates updated"
            value={job.progress.existingCandidatesUpdated}
          />
          <Metric label="Candidate IDs resolved" value={job.progress.candidateIdsResolved} />
          <Metric
            label="Unique candidate ID resolution failures"
            value={job.progress.candidateUniqueIdResolutionFailures}
          />
          <Metric
            label="Candidate observation resolution failures"
            value={job.progress.candidateObservationResolutionFailures}
          />
          <Metric
            label="Candidate observations found"
            value={job.progress.candidateObservationsFound}
          />
          <Metric
            label="Candidate observations validated"
            value={job.progress.candidateObservationsValidated}
          />
          <Metric
            label="Candidate observations rejected"
            value={job.progress.candidateObservationsRejected}
          />
          <Metric
            label="Candidate observations inserted"
            value={job.progress.candidateObservationsInserted}
          />
          <Metric
            label="Candidate observation duplicates skipped"
            value={job.progress.candidateObservationDuplicatesSkipped}
          />
          <Metric
            label="Candidate observation insert failures"
            value={job.progress.candidateObservationInsertFailures}
          />
          <Metric
            label="Candidate observation batch splits"
            value={job.progress.candidateObservationBatchSplits}
          />
          <Metric
            label="Candidate isolated failures"
            value={job.progress.candidateObservationIsolatedFailures}
          />
          <Metric
            label="Candidate profiles rebuilt"
            value={job.progress.candidateProfilesRebuilt}
          />
          <Metric
            label="Candidate profile failures"
            value={job.progress.candidateProfileFailures}
          />
          <Metric label="Candidate ID lookup chunks" value={job.progress.candidateIdLookupChunks} />
          <Metric
            label="Candidate ID lookup chunk failures"
            value={job.progress.candidateIdLookupChunkFailures}
          />
          <Metric
            label="Candidate discovery skipped"
            value={job.progress.candidateDiscoverySkipped}
          />
        </div>
      </div>

      {targetResult ? <TargetResult result={targetResult as RiotScanTargetResult} /> : null}
      {discoveryResults.length > 0 ? (
        <DiscoveryResultTable results={discoveryResults as RiotScanDiscoveryResult[]} />
      ) : null}
    </div>
  );
}

function RiotApiAuthenticationFailureWarning({ job }: { job: RiotScanJobView }) {
  const failure = getRiotApiFailure(job);

  if (!failure) {
    return null;
  }

  return (
    <div className="rounded-md border border-rose-300/30 bg-rose-500/10 p-4 text-sm text-rose-50">
      <div className="flex gap-3">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-rose-200" aria-hidden="true" />
        <div className="min-w-0">
          <h4 className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-rose-100">
            Riot API Authentication Failed
          </h4>
          <p className="mt-2 leading-6 text-rose-50">
            Riot rejected the current API credentials. The developer key may be expired or
            invalid. Update the configured Riot API key before resuming or restarting this scan.
          </p>
          {job.error_message ? (
            <p className="mt-2 leading-6 text-rose-100/90">{job.error_message}</p>
          ) : null}
          <div className="mt-3 grid gap-2 text-xs text-rose-100/80 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="HTTP status" value={failure.status ?? "Pending"} />
            <Metric label="Failed stage" value={formatEnumLabel(failure.stage)} />
            <Metric label="Endpoint" value={failure.endpointGroup} />
            <Metric label="Detected" value={formatDateTime(failure.detectedAt)} />
            <Metric
              label="Aggregation"
              value={failure.aggregationSkipped ? "Skipped" : "Pending"}
            />
            <Metric label="Retryable" value={failure.retryable ? "Yes" : "No"} />
            <Metric label="Reason code" value={formatEnumLabel(failure.code)} />
            <Metric label="Riot message" value={failure.responseSummary ?? "Hidden"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ValidationIssueSummary({ job }: { job: RiotScanJobView }) {
  const summaries = [
    {
      label: "Matchup observation validation",
      summary: job.progress.matchupObservationValidationSummary,
    },
    {
      label: "Candidate observation validation",
      summary: job.progress.candidateObservationValidationSummary,
    },
    {
      label: "Counter-pick aggregate validation",
      summary: job.progress.counterPickAggregateValidationSummary,
    },
  ].filter((entry) => entry.summary && entry.summary.totalRejected > 0);

  if (summaries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-md border border-amber-300/20 bg-amber-500/10 p-3">
      <h4 className="text-sm font-semibold text-amber-100">Validation warnings</h4>
      <div className="grid gap-3 lg:grid-cols-3">
        {summaries.map((entry) => (
          <div className="rounded-md border border-white/10 bg-black/15 p-3" key={entry.label}>
            <p className="text-xs font-semibold text-zinc-100">{entry.label}</p>
            <p className="mt-1 text-xs text-zinc-400">
              {entry.summary?.totalRejected ?? 0} rejected
            </p>
            <div className="mt-2 space-y-1 text-xs text-zinc-400">
              {Object.entries(entry.summary?.issuesByCode ?? {}).map(([code, count]) => (
                <div className="flex justify-between gap-3" key={code}>
                  <span>{formatEnumLabel(code.toLowerCase())}</span>
                  <span className="font-semibold text-zinc-100">{count}</span>
                </div>
              ))}
            </div>
            {entry.summary?.samples?.length ? (
              <div className="mt-3 space-y-1 border-t border-white/10 pt-2 text-xs text-zinc-500">
                {entry.summary.samples.slice(0, 3).map((sample) => (
                  <p
                    className="break-words"
                    key={`${sample.code}-${sample.field}-${sample.safeValue}`}
                  >
                    {sample.field}: {sample.safeValue ?? "empty"}{" "}
                    {sample.matchId ? `(${sample.matchId})` : ""}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function PersistenceRecoverySummary({ job }: { job: RiotScanJobView }) {
  const summaries = [
    {
      attempts: job.progress.candidateObservationBatchAttempts,
      duplicates: job.progress.candidateObservationDuplicatesSkipped,
      errorGroups: job.progress.candidateObservationPersistenceErrorGroups,
      failedAttempts: job.progress.candidateObservationFailedBatchAttempts,
      failures: job.progress.candidateObservationInsertFailures,
      inserted: job.progress.candidateObservationsInserted,
      isolated: job.progress.candidateObservationIsolatedFailures,
      label: "Candidate observations",
      samples: job.progress.candidateObservationPersistenceFailureSamples,
      splits: job.progress.candidateObservationBatchSplits,
      successful: job.progress.candidateObservationSuccessfulBatches,
      transientRetries: job.progress.candidateObservationTransientRetries,
      unresolved: job.progress.candidateObservationUnresolvedBatchFailures,
    },
    {
      attempts: job.progress.matchupObservationBatchAttempts,
      duplicates: job.progress.observationDuplicatesSkipped,
      errorGroups: job.progress.matchupObservationPersistenceErrorGroups,
      failedAttempts: job.progress.matchupObservationFailedBatchAttempts,
      failures: job.progress.observationInsertFailures,
      inserted: job.progress.observationsInserted,
      isolated: job.progress.matchupObservationIsolatedFailures,
      label: "Matchup observations",
      samples: job.progress.matchupObservationPersistenceFailureSamples,
      splits: job.progress.matchupObservationBatchSplits,
      successful: job.progress.matchupObservationSuccessfulBatches,
      transientRetries: job.progress.matchupObservationTransientRetries,
      unresolved: job.progress.matchupObservationUnresolvedBatchFailures,
    },
    {
      attempts: job.progress.counterPickAggregateBatchAttempts,
      duplicates: 0,
      errorGroups: job.progress.counterPickAggregatePersistenceErrorGroups,
      failedAttempts: job.progress.counterPickAggregateFailedBatchAttempts,
      failures: job.progress.counterPickAggregateInsertFailures,
      inserted: job.progress.statsRowsUpdated,
      isolated: job.progress.counterPickAggregateIsolatedFailures,
      label: "Counter-pick aggregates",
      samples: job.progress.counterPickAggregatePersistenceFailureSamples,
      splits: job.progress.counterPickAggregateBatchSplits,
      successful: job.progress.counterPickAggregateSuccessfulBatches,
      transientRetries: job.progress.counterPickAggregateTransientRetries,
      unresolved: job.progress.counterPickAggregateUnresolvedBatchFailures,
    },
  ].filter((entry) => hasPersistenceRecoveryActivity(entry));

  if (summaries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-md border border-cyan-300/20 bg-cyan-500/10 p-3">
      <h4 className="text-sm font-semibold text-cyan-100">Persistence recovery</h4>
      <div className="grid gap-3 lg:grid-cols-3">
        {summaries.map((entry) => (
          <div className="rounded-md border border-white/10 bg-black/15 p-3" key={entry.label}>
            <p className="text-xs font-semibold text-zinc-100">{entry.label}</p>
            <p className="mt-1 text-xs text-zinc-400">
              {Number(entry.inserted ?? 0) + Number(entry.duplicates ?? 0)} rows persisted,{" "}
              {entry.failures ?? 0} failed
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-400">
              <Metric label="Batch attempts" value={entry.attempts} />
              <Metric label="Successful batches" value={entry.successful} />
              <Metric label="Failed attempts" value={entry.failedAttempts} />
              <Metric label="Batch splits" value={entry.splits} />
              <Metric label="Transient retries" value={entry.transientRetries} />
              <Metric label="Isolated rows" value={entry.isolated} />
              <Metric label="Unresolved rows" value={entry.unresolved} />
            </div>
            {entry.errorGroups?.length ? (
              <div className="mt-3 space-y-1 border-t border-white/10 pt-2 text-xs text-zinc-400">
                {entry.errorGroups.slice(0, 3).map((group) => (
                  <div
                    className="flex justify-between gap-3"
                    key={`${group.errorClass}-${group.errorCode}-${group.messageFingerprint}`}
                  >
                    <span>{formatEnumLabel(group.errorClass)}</span>
                    <span className="font-semibold text-zinc-100">{group.failureCount}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {entry.samples?.length ? (
              <details className="mt-3 border-t border-white/10 pt-2 text-xs text-zinc-400">
                <summary className="cursor-pointer font-semibold text-cyan-100">
                  Failure samples
                </summary>
                <div className="mt-2 space-y-2">
                  {entry.samples.slice(0, 5).map((sample) => (
                    <div
                      className="rounded-md border border-white/10 bg-black/20 p-2"
                      key={`${sample.table}-${sample.rowIdentity}-${sample.errorClass}`}
                    >
                      <p className="font-semibold text-zinc-200">
                        {sample.rowIdentity} - {formatEnumLabel(sample.errorClass)}
                      </p>
                      <p className="mt-1 break-words text-zinc-500">{sample.message}</p>
                      <div className="mt-2 space-y-1">
                        {Object.entries(sample.safeFields).map(([field, value]) => (
                          <div className="flex justify-between gap-3" key={field}>
                            <span>{formatEnumLabel(field)}</span>
                            <span className="break-all text-right text-zinc-300">
                              {String(value ?? "empty")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function hasPersistenceRecoveryActivity(entry: {
  failedAttempts?: number;
  failures?: number;
  isolated?: number;
  splits?: number;
  transientRetries?: number;
  unresolved?: number;
}) {
  return [
    entry.failedAttempts,
    entry.failures,
    entry.isolated,
    entry.splits,
    entry.transientRetries,
    entry.unresolved,
  ].some((value) => Number(value ?? 0) > 0);
}

function TargetResult({ result }: { result: RiotScanTargetResult }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/15 p-3">
      <h4 className="text-sm font-semibold text-white">Target scan result</h4>
      <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2 lg:grid-cols-3">
        <Metric
          label="Enemy champion"
          value={result.enemyChampionDisplayName ?? result.enemyChampion}
        />
        <Metric
          label="Counter champion"
          value={result.counterChampionDisplayName ?? result.counterChampion}
        />
        <Metric label="Role" value={getRoleLabel(result.role)} />
        <Metric label="Games" value={result.games} />
        <Metric label="Wins" value={result.wins} />
        <Metric label="Losses" value={result.losses} />
        <Metric label="Win rate" value={`${result.winRate}%`} />
        <Metric label="Tier" value={result.tier} />
        <Metric label="Written to stats" value={result.wasWrittenToStats ? "Yes" : "No"} />
        <Metric label="Total stored games" value={result.storedGamesAfterAggregation} />
      </div>
    </div>
  );
}

function DiscoveryResultTable({ results }: { results: RiotScanDiscoveryResult[] }) {
  const hasFocusedResults = results.some(
    (result) => result.focusChampion || result.opponentChampion,
  );

  if (hasFocusedResults) {
    return <FocusedDiscoveryResultTable results={results} />;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-white/10 bg-black/15">
      <div className="grid grid-cols-[1.1fr_1.1fr_0.55fr_0.6fr_0.75fr_0.75fr_0.8fr] gap-3 border-b border-white/10 px-3 py-2 text-xs font-semibold text-zinc-400">
        <span>Champion A</span>
        <span>Champion B</span>
        <span>Role</span>
        <span>Games</span>
        <span>A wins</span>
        <span>B wins</span>
        <span>Stored stats</span>
      </div>
      <div className="max-h-72 overflow-auto">
        {results.map((result) => (
          <div
            className="grid grid-cols-[1.1fr_1.1fr_0.55fr_0.6fr_0.75fr_0.75fr_0.8fr] gap-3 border-b border-white/5 px-3 py-2 text-xs text-zinc-300 last:border-b-0"
            key={`${result.championA}-${result.championB}-${result.role}`}
          >
            <span className="font-semibold text-white">
              {result.championADisplayName ?? result.championA}
            </span>
            <span className="font-semibold text-white">
              {result.championBDisplayName ?? result.championB}
            </span>
            <span>{getRoleLabel(result.role)}</span>
            <span>{result.games}</span>
            <span>
              {result.championAWins} - {result.championAWinRate}%
            </span>
            <span>
              {result.championBWins} - {result.championBWinRate}%
            </span>
            <span>{result.representedInStats ? "Yes" : "Pending"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FocusedDiscoveryResultTable({ results }: { results: RiotScanDiscoveryResult[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-white/10 bg-black/15">
      <div className="grid min-w-[980px] grid-cols-[1fr_1fr_0.55fr_0.65fr_0.7fr_0.75fr_0.7fr_0.85fr_0.75fr_0.55fr] gap-3 border-b border-white/10 px-3 py-2 text-xs font-semibold text-zinc-400">
        <span>Focus champion</span>
        <span>Opponent</span>
        <span>Role</span>
        <span>Scan games</span>
        <span>Focus wins</span>
        <span>Opponent wins</span>
        <span>Focus WR</span>
        <span>Total stored games</span>
        <span>Stored status</span>
        <span>Tier</span>
      </div>
      <div className="max-h-72 overflow-auto">
        {results.map((result) => (
          <div
            className="grid min-w-[980px] grid-cols-[1fr_1fr_0.55fr_0.65fr_0.7fr_0.75fr_0.7fr_0.85fr_0.75fr_0.55fr] gap-3 border-b border-white/5 px-3 py-2 text-xs text-zinc-300 last:border-b-0"
            key={`${result.focusChampion ?? result.championA}-${result.opponentChampion ?? result.championB}-${result.role}`}
          >
            <span className="font-semibold text-white">
              {result.focusChampionDisplayName ??
                result.championADisplayName ??
                result.focusChampion ??
                result.championA}
            </span>
            <span className="font-semibold text-white">
              {result.opponentChampionDisplayName ??
                result.championBDisplayName ??
                result.opponentChampion ??
                result.championB}
            </span>
            <span>{getRoleLabel(result.role)}</span>
            <span>{result.games}</span>
            <span>{result.focusChampionWins ?? result.championAWins}</span>
            <span>{result.opponentWins ?? result.championBWins}</span>
            <span>{result.focusChampionWinRate ?? result.championAWinRate}%</span>
            <span>{result.storedGamesAfterAggregation ?? 0}</span>
            <span>{result.representedInStats ? "Stored" : "Pending"}</span>
            <span>{result.storedTier ?? "Pending"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string | null | undefined }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/15 p-2">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 font-semibold text-zinc-100">
        {typeof value === "number" ? formatNumber(value) : (value ?? "Pending")}
      </p>
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

function parseSeedPuuids(value: string) {
  return uniqueStrings(value.split(/\r?\n/));
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function resolveChampionId(value: string, champions: AdminLeagueChampion[]) {
  const normalizedValue = normalizeChampionSearchValue(value);

  return (
    champions.find(
      (champion) =>
        normalizeChampionSearchValue(champion.id) === normalizedValue ||
        normalizeChampionSearchValue(champion.name) === normalizedValue,
    )?.id ?? ""
  );
}

function normalizeChampionSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getModeLabel(mode: RiotScanMode) {
  return mode === "target" ? "Target matchup" : "Matchup discovery";
}

function getStatusLabel(status: RiotScanJobView["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getRiotScanJobStatusLabel(job: RiotScanJobView) {
  if (job.status === "failed" && getRiotApiFailure(job)) {
    return "Failed - Riot authentication";
  }

  return getStatusLabel(job.status);
}

function getRiotApiFailure(job: RiotScanJobView) {
  const failure = job.progress.riotApiFailure ?? job.summary.riotApiFailure;
  const code = failure?.code ?? job.progress.riotApiFailureCode ?? job.summary.riotApiFailureCode;

  return code === "riot-authentication-failed" || code === "riot-access-denied" ? failure : null;
}

function getRoleLabel(role: LeagueRole) {
  return role === "adc" ? "ADC" : role.charAt(0).toUpperCase() + role.slice(1);
}

function getChampionDisplayName(championDisplayNamesById: Map<string, string>, championId: string) {
  return championDisplayNamesById.get(championId) ?? championId;
}

function shortenPuuid(value: string) {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-8)}`;
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "Pending";
  }

  return `${Math.round(value * 100)}%`;
}

function formatCandidateRank(candidate: RiotSeedCandidateView) {
  if (candidate.rank_enrichment_status === "unranked") {
    return "Unranked";
  }

  if (candidate.rank_enrichment_status === "not_found") {
    return "Not found";
  }

  if (!candidate.rank_tier) {
    return formatEnumLabel(candidate.rank_enrichment_status ?? "pending");
  }

  return [
    formatEnumLabel(candidate.rank_tier),
    candidate.rank_division,
    typeof candidate.rank_league_points === "number" ? `${candidate.rank_league_points} LP` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function formatRankRecord(candidate: RiotSeedCandidateView) {
  if (typeof candidate.rank_wins !== "number" || typeof candidate.rank_losses !== "number") {
    return "Pending";
  }

  return `${candidate.rank_wins}W ${candidate.rank_losses}L`;
}

function formatLifecycleReasons(reasonCodes: string[]) {
  if (reasonCodes.length === 0) {
    return "Pending";
  }

  return reasonCodes
    .map((reasonCode) =>
      reasonCode in seedCandidateLifecycleReasonLabels
        ? seedCandidateLifecycleReasonLabels[
            reasonCode as keyof typeof seedCandidateLifecycleReasonLabels
          ]
        : formatEnumLabel(reasonCode),
    )
    .join(", ");
}

function getCandidateSelectionDisabledMessage(candidate: RiotSeedCandidateView) {
  if (candidate.lifecycle.isSelectableForScan) {
    return "Ready to scan.";
  }

  const nextEligibleAt = candidate.lifecycle.nextEligibleAt
    ? formatDateTime(candidate.lifecycle.nextEligibleAt)
    : null;
  const reason = formatLifecycleReasons(candidate.lifecycle.reasonCodes);

  return nextEligibleAt ? `${reason}. Available again ${nextEligibleAt}.` : reason;
}

function formatLastScanDuplicateRate(candidate: RiotSeedCandidateView) {
  const fetched = candidate.last_scan_match_ids_fetched;
  const duplicates = candidate.last_scan_duplicate_matches_skipped;

  if (typeof fetched !== "number" || fetched <= 0 || typeof duplicates !== "number") {
    return "Pending";
  }

  return formatPercent(duplicates / fetched);
}

function formatEnumLabel(value: string) {
  return value
    .split(/[-_]/g)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatRole(value: string) {
  return value === "adc" ? "ADC" : formatEnumLabel(value);
}

function formatNumber(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString() : "Pending";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function wasCandidateScannedRecently(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();

  return (
    Number.isFinite(timestamp) &&
    Date.now() - timestamp < recentSeedCandidateScanHours * 60 * 60 * 1000
  );
}

function wasCandidateRankRefreshedRecently(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();

  return (
    Number.isFinite(timestamp) &&
    Date.now() - timestamp < recentSeedCandidateRankRefreshHours * 60 * 60 * 1000
  );
}
