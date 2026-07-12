import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panelSource = readFileSync(
  new URL("../src/components/admin/league/riot-match-scanner-panel.tsx", import.meta.url),
  "utf8",
);
const actionsSource = readFileSync(
  new URL("../src/app/admin/league/counter-picks/actions.ts", import.meta.url),
  "utf8",
);
const adminNavSource = readFileSync(
  new URL("../src/components/admin/admin-nav.tsx", import.meta.url),
  "utf8",
);
const counterPickSectionSource = readFileSync(
  new URL("../src/components/admin/league/league-counter-pick-section.tsx", import.meta.url),
  "utf8",
);
const counterPickOverviewPageSource = readFileSync(
  new URL("../src/app/admin/counter-picks/page.tsx", import.meta.url),
  "utf8",
);
const counterPickCollectPageSource = readFileSync(
  new URL("../src/app/admin/counter-picks/collect/page.tsx", import.meta.url),
  "utf8",
);
const counterPickShadowPageSource = readFileSync(
  new URL("../src/app/admin/counter-picks/shadow-ranking/page.tsx", import.meta.url),
  "utf8",
);
const counterPickProfileReviewPageSource = readFileSync(
  new URL("../src/app/admin/counter-picks/profile-review/page.tsx", import.meta.url),
  "utf8",
);

testResolverPanelRemoved();
testCoverageQueueLazyLoaded();
testSeedCandidateAccordionControlled();
testCollectionPollingIsPassive();
testCounterPickDomainRoutes();
testCounterRankingV2ShadowProfileSelection();
testCounterRankingV2ShadowCandidateAccordion();
testCounterRankingV2ShadowReviewFilters();
testCounterRankingV2PublicEligibilityControls();
testCounterRankingV2PublicReviewCompactCurationTable();
testCounterRankingV2ReviewProgressSummary();
testCounterRankingV2PublicPreview();
testCounterRankingV2DirectionCopy();
testLeagueChampionRegistryAdminSync();

console.log("Counter Pick admin panel cleanup regression tests passed.");

function testResolverPanelRemoved() {
  assert.equal(panelSource.includes("function RiotIdResolverPanel"), false);
  assert.equal(panelSource.includes("Riot ID to PUUID Resolver"), false);
  assert.equal(panelSource.includes("ResolverResultRow"), false);
  assert.equal(panelSource.includes("resolveRiotIdsToPuuids"), false);
  assert.equal(actionsSource.includes("export async function resolveRiotIdsToPuuids"), false);
  assert.equal(actionsSource.includes("RiotIdResolverResult"), false);
}

function testCoverageQueueLazyLoaded() {
  assert.equal(panelSource.includes("const [isExpanded, setIsExpanded] = useState(false);"), true);
  assert.equal(
    panelSource.includes("const [hasLoadedQueue, setHasLoadedQueue] = useState(false);"),
    true,
  );
  assert.equal(panelSource.includes('const [limit, setLimit] = useState("20");'), true);
  assert.equal(panelSource.includes("aria-expanded={isExpanded}"), true);
  assert.equal(
    panelSource.includes("if (nextExpanded && !hasLoadedQueue && !status.isLoading)"),
    true,
  );
  assert.equal(
    panelSource.includes(
      "void loadQueue();\n    // eslint-disable-next-line react-hooks/exhaustive-deps",
    ),
    false,
  );
  assert.equal(actionsSource.includes("limit = 20"), true);
  assert.equal(actionsSource.includes("maxMatchupRankCoverageLimit"), true);
}

function testSeedCandidateAccordionControlled() {
  assert.equal(panelSource.includes("function toggleRankGroupSection"), true);
  assert.equal(panelSource.includes("onToggle={() => toggleRankGroupSection(rankGroup.id)}"), true);
  assert.equal(panelSource.includes("onToggle={() => void loadCandidateGroups"), false);
  assert.equal(panelSource.includes("aria-expanded={groupState.isExpanded}"), true);
  assert.equal(panelSource.includes("isExpanded: true,"), false);
  assert.equal(panelSource.includes('isExpanded: group.id === "master-plus"'), true);
}

function testCollectionPollingIsPassive() {
  assert.equal(panelSource.includes("function refreshCollection"), true);
  assert.equal(panelSource.includes("getRiotCollectionJob"), true);
  assert.equal(
    panelSource.includes("void refreshCollection(activeJob.id, { silent: true });"),
    true,
  );
  assert.equal(
    panelSource.includes("void resumeCollection(activeJob.id, { silent: true });"),
    false,
  );
  assert.equal(panelSource.includes('label="Child stage"'), true);
  assert.equal(panelSource.includes('label="Matches scanned"'), true);
}

function testCounterPickDomainRoutes() {
  assert.equal(adminNavSource.includes('label: "Platform"'), false);
  assert.equal(adminNavSource.includes('label: "Counter Pick"'), true);
  assert.equal(adminNavSource.includes('href: "/admin/counter-picks"'), true);
  assert.equal(adminNavSource.includes('href: "/admin/counter-picks/collect"'), true);
  assert.equal(adminNavSource.includes('href: "/admin/counter-picks/shadow-ranking"'), true);
  assert.equal(adminNavSource.includes('href: "/admin/counter-picks/profile-review"'), true);
  assert.equal(counterPickOverviewPageSource.includes('section="counter-picks-overview"'), true);
  assert.equal(counterPickCollectPageSource.includes('section="counter-picks-collect"'), true);
  assert.equal(
    counterPickShadowPageSource.includes('section="counter-picks-shadow-ranking"'),
    true,
  );
  assert.equal(
    counterPickProfileReviewPageSource.includes('section="counter-picks-profile-review"'),
    true,
  );
  assert.equal(counterPickSectionSource.includes('view === "collect"'), true);
  assert.equal(counterPickSectionSource.includes('view === "shadow-ranking"'), true);
  assert.equal(counterPickSectionSource.includes('view === "profile-review"'), true);
  assert.equal(counterPickSectionSource.includes("<RiotMatchScannerPanel"), true);
  assert.equal(counterPickSectionSource.includes("<CounterRankingV2ShadowPanel"), true);
  assert.equal(counterPickSectionSource.includes("<CounterRankingV2ProfileReviewPanel"), true);
}

function testCounterRankingV2ShadowProfileSelection() {
  assert.equal(
    counterPickSectionSource.includes("const counterRankingV2DefaultChampionId = useMemo"),
    true,
  );
  assert.equal(
    counterPickSectionSource.includes("const isCounterRankingV2ProfileWorkspace"),
    true,
  );
  assert.equal(
    counterPickSectionSource.includes(
      'text="This champion does not have a mechanical profile yet."',
    ),
    true,
  );
  assert.match(
    counterPickSectionSource,
    /async function loadCounterRankingV2Reviews\(\)[\s\S]*if \(!effectiveSelectedChampionId \|\| !hasSelectedCounterRankingV2Profile\)[\s\S]*setCounterRankingV2ReviewsByCandidateId\(new Map\(\)\);[\s\S]*return;/,
    "Missing V2 profiles should clear review state without querying review rows.",
  );
  assert.match(
    counterPickSectionSource,
    /async function loadCounterRankingV2ObservedStats\(\)[\s\S]*if \(!effectiveSelectedChampionId \|\| !hasSelectedCounterRankingV2Profile\)[\s\S]*setCounterRankingV2ObservedByChampionId\(new Map\(\)\);[\s\S]*return;/,
    "Missing V2 profiles should clear observed state without fetching observed stats.",
  );
  assert.equal(counterPickSectionSource.includes("formatCounterRankingV2ProfileAvailability"), true);
  assert.equal(counterPickSectionSource.includes("No mechanical profile"), true);
  assert.equal(counterPickSectionSource.includes("Mechanical profile · ${formatProfileStatus"), true);
  assert.equal(counterPickSectionSource.includes("Profile revision ${profile.version}"), true);
  assert.equal(
    counterPickSectionSource.includes("Profile revision is the mechanical profile data version"),
    true,
  );
  assert.equal(counterPickSectionSource.includes("Reviewed v${profile.version}"), false);
  assert.equal(counterPickSectionSource.includes("profile v${profile.version}"), false);
  assert.equal(counterPickSectionSource.includes("Champion Counter Profiles"), true);
  assert.equal(adminNavSource.includes('label: "Counter Pick Dashboard"'), true);
  assert.equal(adminNavSource.includes('label: "Data Collector"'), true);
  assert.equal(adminNavSource.includes('label: "Counter Suggestions"'), true);
  assert.equal(adminNavSource.includes('label: "Public Counter Review"'), true);
  assert.equal(adminNavSource.includes('label: "Champion Counter Profiles"'), true);
  assert.equal(counterPickSectionSource.includes("Promote to Reviewed"), true);
  assert.match(
    counterPickSectionSource,
    /if \(view === "profile-review"\)[\s\S]*<CounterRankingV2ProfileReviewPanel[\s\S]*if \(view === "review"\)[\s\S]*<CounterRankingV2AdminReviewPanel[\s\S]*if \(view === "shadow-ranking"\)/,
    "Champion Counter Profiles and Public Counter Review should render on their own pages before the Counter Suggestions view.",
  );
  assert.equal(counterPickSectionSource.includes("No observed stats are available"), true);
  assert.equal(counterPickSectionSource.includes("No review rows have been saved"), true);
  assert.equal(
    counterPickSectionSource.includes("includeSelectedChampionOption(championOptions, selectedChampion)"),
    true,
  );
  assert.equal(counterPickSectionSource.includes("const canonicalCounterChampionId"), true);
  assert.equal(counterPickSectionSource.includes("const canonicalEnemyChampionId"), true);
  assert.equal(counterPickSectionSource.includes("counterChampionId: canonicalCounterChampionId"), true);
  assert.equal(counterPickSectionSource.includes("enemyChampionId: canonicalEnemyChampionId"), true);
  assert.equal(counterPickSectionSource.includes("sortCounterRankingV2RowsByReviewPriority"), true);
  assert.equal(counterPickSectionSource.includes("Sorted by review priority"), true);
}

function testCounterRankingV2ShadowCandidateAccordion() {
  assert.equal(counterPickSectionSource.includes("function CounterRankingV2ShadowRows"), true);
  assert.equal(counterPickSectionSource.includes("function CounterRankingV2ShadowCandidateRow"), true);
  assert.equal(
    counterPickSectionSource.includes("<CounterRankingV2ShadowCandidateRow"),
    true,
  );
  assert.equal(counterPickSectionSource.includes("isExpanded={expandedCandidateId"), false);
  assert.equal(counterPickSectionSource.includes("Counter suggestion review"), true);
  assert.equal(counterPickSectionSource.includes("Review/Edit"), true);
  assert.equal(counterPickSectionSource.includes("setIsDrawerOpen"), true);
  assert.equal(counterPickSectionSource.includes("Target champion"), true);
  assert.equal(counterPickSectionSource.includes("Candidate champion"), true);
  assert.equal(counterPickSectionSource.includes("Suggestion classification"), true);
  assert.equal(counterPickSectionSource.includes("Relevant mechanical tags/signals"), true);
  assert.equal(counterPickSectionSource.includes("<ChevronDown"), true);
  assert.equal(counterPickSectionSource.includes("<ChevronRight"), true);
  assert.equal(counterPickSectionSource.includes('label="Manual review score"'), true);
  assert.equal(counterPickSectionSource.includes("Save review"), true);
  assert.equal(counterPickSectionSource.includes("hasLowObservedSample"), true);
  assert.equal(counterPickSectionSource.includes("No observed data"), true);
}

function testCounterRankingV2ShadowReviewFilters() {
  assert.equal(counterPickSectionSource.includes("CounterRankingV2ReviewFilter"), true);
  assert.equal(
    counterPickSectionSource.includes("counterRankingV2ShadowReviewFilterOptions"),
    true,
  );
  assert.equal(counterPickSectionSource.includes('label: "All"'), true);
  assert.equal(counterPickSectionSource.includes('label: "Auto suggested"'), true);
  assert.equal(counterPickSectionSource.includes('label: "Auto approval candidate"'), true);
  assert.equal(counterPickSectionSource.includes('label: "Needs review automation"'), true);
  assert.equal(counterPickSectionSource.includes('label: "Manual approved"'), true);
  assert.equal(counterPickSectionSource.includes('label: "Manual rejected"'), true);
  assert.equal(counterPickSectionSource.includes('label: "Unreviewed"'), true);
  assert.equal(counterPickSectionSource.includes('label: "Verified strong counter"'), true);
  assert.equal(counterPickSectionSource.includes('label: "Verified soft counter"'), true);
  assert.equal(counterPickSectionSource.includes('label: "Not a counter"'), true);
  assert.equal(counterPickSectionSource.includes('label: "Needs more data"'), true);
  assert.equal(counterPickSectionSource.includes('label: "Incorrect suggestion"'), true);
  assert.equal(counterPickSectionSource.includes('label: "Public eligible"'), true);
  assert.equal(counterPickSectionSource.includes('label: "Low sample"'), true);
  assert.equal(counterPickSectionSource.includes("filterCounterRankingV2RowsByReviewFilter"), true);
  assert.equal(counterPickSectionSource.includes("const [reviewFilter, setReviewFilter]"), true);
  assert.equal(counterPickSectionSource.includes("CounterRankingV2ShadowCandidateTab"), true);
  assert.equal(counterPickSectionSource.includes("counterRankingV2ShadowCandidateTabs"), true);
  assert.equal(counterPickSectionSource.includes('tab: "best_suggestions"'), true);
  assert.equal(counterPickSectionSource.includes('tab: "auto_approval_candidates"'), true);
  assert.equal(counterPickSectionSource.includes('tab: "blocked"'), true);
  assert.equal(counterPickSectionSource.includes("Candidate search"), true);
  assert.equal(counterPickSectionSource.includes("Advanced status"), true);
  assert.equal(
    counterPickSectionSource.includes(
      'const [candidateTab, setCandidateTab] =\n    useState<CounterRankingV2ShadowCandidateTab>("best_suggestions")',
    ),
    true,
  );
  assert.equal(
    counterPickSectionSource.includes(
      'const [densityMode, setDensityMode] = useState<CounterRankingV2AdminReviewDensity>("compact")',
    ),
    true,
  );
  assert.equal(counterPickSectionSource.includes("CounterRankingV2ShadowCollapsibleSection"), true);
  assert.equal(counterPickSectionSource.includes("Automation blockers"), true);
  assert.equal(counterPickSectionSource.includes("Debug details"), true);
  assert.equal(counterPickSectionSource.includes("filteredRows.length} of {rows.length} counter candidates"), true);
  assert.equal(counterPickSectionSource.includes("aria-pressed={isActiveFilter}"), true);
  assert.equal(counterPickSectionSource.includes('text="No mechanical candidates match this filter."'), true);
  assert.equal(counterPickSectionSource.includes("rows={filteredRows}"), true);
}

function testCounterRankingV2PublicEligibilityControls() {
  assert.equal(counterPickSectionSource.includes("isCounterRankingV2ReviewStatusPublicEligible"), true);
  assert.equal(counterPickSectionSource.includes("isPublicEligibleChecked"), true);
  assert.equal(counterPickSectionSource.includes("isSavedPublicEligible"), true);
  assert.equal(counterPickSectionSource.includes("Public eligible"), true);
  assert.equal(counterPickSectionSource.includes("Internal review only"), true);
  assert.equal(counterPickSectionSource.includes("Low sample mechanical counter"), true);
  assert.equal(
    counterPickSectionSource.includes("Choose a reviewed status before enabling public eligibility."),
    true,
  );
  assert.equal(
    counterPickSectionSource.includes("${formatCounterRankingV2ReviewStatus(reviewForm.reviewStatus)} rows cannot be public eligible."),
    true,
  );
  assert.equal(
    counterPickSectionSource.includes("This will be treated as a low-sample mechanical counter."),
    true,
  );
  assert.match(
    counterPickSectionSource,
    /event\.target\.value === "incorrect_suggestion" \|\|[\s\S]*event\.target\.value === "not_a_counter" \|\|[\s\S]*event\.target\.value === "unreviewed"/,
    "Changing to unreviewed, not a counter, or incorrect suggestion should clear public eligibility.",
  );
  assert.equal(actionsSource.includes("normalizeCounterRankingV2PublicEligible"), true);
  assert.equal(actionsSource.includes("public_eligible: validation.publicEligible"), true);
}

function testCounterRankingV2PublicReviewCompactCurationTable() {
  assert.equal(counterPickSectionSource.includes("CounterRankingV2AdminReviewDensity"), true);
  assert.equal(
    counterPickSectionSource.includes(
      'const [densityMode, setDensityMode] = useState<CounterRankingV2AdminReviewDensity>("compact")',
    ),
    true,
  );
  assert.equal(counterPickSectionSource.includes("function CounterRankingV2AdminReviewRow"), true);
  assert.equal(counterPickSectionSource.includes("Counter review editor"), true);
  assert.equal(counterPickSectionSource.includes("Candidate into target"), true);
  assert.equal(counterPickSectionSource.includes("Public status"), true);
  assert.equal(counterPickSectionSource.includes("Advanced filters"), true);
  assert.equal(counterPickSectionSource.includes("Overview"), true);
  assert.equal(counterPickSectionSource.includes("Public preview"), true);
  assert.equal(counterPickSectionSource.includes("setIsPublicPreviewOpen"), true);
  assert.equal(counterPickSectionSource.includes("top-3 z-20"), true);
  assert.equal(counterPickSectionSource.includes("Observed games"), true);
}

function testCounterRankingV2ReviewProgressSummary() {
  assert.equal(counterPickSectionSource.includes("getCounterRankingV2ReviewProgressSummary"), true);
  assert.equal(
    counterPickSectionSource.includes("function CounterRankingV2ReviewProgressSummaryPanel"),
    true,
  );
  assert.equal(counterPickSectionSource.includes("Review progress"), true);
  assert.equal(counterPickSectionSource.includes("Selected target and role"), true);
  assert.equal(counterPickSectionSource.includes("Total counter candidates"), true);
  assert.equal(counterPickSectionSource.includes("Reviewed counter candidates"), true);
  assert.equal(counterPickSectionSource.includes("Unreviewed counter candidates"), true);
  assert.equal(counterPickSectionSource.includes("Verified strong counters"), true);
  assert.equal(counterPickSectionSource.includes("Verified soft counters"), true);
  assert.equal(counterPickSectionSource.includes("Needs more data"), true);
  assert.equal(counterPickSectionSource.includes("Incorrect suggestions"), true);
  assert.equal(counterPickSectionSource.includes("Public eligible"), true);
}

function testCounterRankingV2PublicPreview() {
  assert.equal(counterPickSectionSource.includes("getCounterRankingV2PublicPreviewRows"), true);
  assert.equal(counterPickSectionSource.includes("function CounterRankingV2PublicPreviewPanel"), true);
  assert.equal(counterPickSectionSource.includes("Public preview: approved counters against"), true);
  assert.equal(counterPickSectionSource.includes("would appear as a"), true);
  assert.equal(counterPickSectionSource.includes("public counter against {targetLabel}"), true);
  assert.equal(
    counterPickSectionSource.includes("Preview only — public ordering unchanged"),
    true,
  );
  assert.equal(counterPickSectionSource.includes("Current public ranking"), true);
  assert.equal(counterPickSectionSource.includes("Manual review score"), true);
  assert.equal(counterPickSectionSource.includes("Observed games"), true);
  assert.equal(counterPickSectionSource.includes("Observed confidence"), true);
  assert.equal(counterPickSectionSource.includes("Low sample mechanical counter"), true);
  assert.equal(
    counterPickSectionSource.includes(
      "No public counters match the current target and role.",
    ),
    true,
  );
  assert.equal(
    counterPickSectionSource.includes(
      "Showing current public rows for the selected target/role, independent of queue filters.",
    ),
    true,
  );
}

function testCounterRankingV2DirectionCopy() {
  assert.equal(counterPickSectionSource.includes("Counter review target"), true);
  assert.equal(counterPickSectionSource.includes("Find counters against"), true);
  assert.equal(
    counterPickSectionSource.includes(
      "Every candidate below is evaluated as a champion picked into the selected target.",
    ),
    true,
  );
  assert.equal(counterPickSectionSource.includes("Review target"), true);
  assert.equal(counterPickSectionSource.includes("Counter Suggestions"), true);
  assert.equal(
    counterPickSectionSource.includes(
      "Inspect mechanical counter candidates, automation blockers, observed data, and review",
    ),
    true,
  );
  assert.equal(counterPickSectionSource.includes("Mechanical candidates into"), true);
  assert.equal(counterPickSectionSource.includes("into {targetLabel}"), true);
  assert.equal(counterPickSectionSource.includes("Selected target and role"), true);
}

function testLeagueChampionRegistryAdminSync() {
  assert.equal(actionsSource.includes("export async function syncLeagueChampionRegistryAdmin"), true);
  assert.match(
    actionsSource,
    /syncLeagueChampionRegistryAdmin[\s\S]*getAuthorizedAdmin\(accessToken, "sync League champion registry"\)/,
    "Registry sync action should keep admin authorization inside the server action.",
  );
  assert.match(
    actionsSource,
    /syncLeagueChampionRegistryAdmin[\s\S]*getServiceSupabaseClient\(\)/,
    "Registry sync action should use the service-role Supabase client.",
  );
  assert.match(
    actionsSource,
    /syncLeagueChampionRegistryAdmin[\s\S]*syncLeagueChampionRegistry\({[\s\S]*supabase: serviceClientResult\.supabase/,
    "Registry sync should delegate writes to the server-side registry sync module.",
  );
  assert.equal(panelSource.includes("syncLeagueChampionRegistryAdmin"), true);
  assert.equal(panelSource.includes("Sync missing champions"), true);
  assert.equal(panelSource.includes("remaining missing"), true);
  assert.equal(panelSource.includes('supabase.from("league_champions")'), false);
}
