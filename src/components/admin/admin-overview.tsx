import type { ReactNode } from "react";
import { Database } from "lucide-react";

import { Card } from "@/src/components/ui/card";
import { AdminSectionCard } from "./shared/admin-section-card";

function AdminStatCard({
  label,
  tone = "default",
  value,
}: {
  label: string;
  tone?: "default" | "primary";
  value: number;
}) {
  return (
    <Card
      className={`border-white/10 p-5 text-white shadow-xl shadow-black/15 ${
        tone === "primary" ? "bg-cyan-500/10" : "bg-[#10182b]/90"
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex size-11 items-center justify-center rounded-lg ring-1 ${
            tone === "primary"
              ? "bg-cyan-400/15 text-cyan-100 ring-cyan-300/20"
              : "bg-sky-500/15 text-sky-200 ring-sky-300/20"
          }`}
        >
          <Database className="size-5" aria-hidden="true" />
        </div>
        <div>
          <p className="font-mono text-3xl font-semibold">{value}</p>
          <p className="text-sm text-zinc-400">{label}</p>
        </div>
      </div>
    </Card>
  );
}

function AdminProductArea({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-mono text-2xl font-semibold text-white">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function AdminOverview({
  leagueChampionsCount,
  leagueCounterPicksCount,
  leagueDraftMatchupsCount,
  leagueMatchupsCount,
  leagueReviewedMatchupsCount,
}: {
  leagueChampionsCount: number;
  leagueCounterPicksCount: number | null;
  leagueDraftMatchupsCount: number;
  leagueMatchupsCount: number;
  leagueReviewedMatchupsCount: number;
}) {
  return (
    <div className="space-y-10">
      <div className="grid gap-4 md:grid-cols-4">
        <AdminStatCard label="League matchups" tone="primary" value={leagueMatchupsCount} />
        <AdminStatCard label="Champions" value={leagueChampionsCount} />
        <AdminStatCard label="Draft matchups" value={leagueDraftMatchupsCount} />
        <AdminStatCard label="Reviewed matchups" value={leagueReviewedMatchupsCount} />
      </div>

      <AdminProductArea
        title="League"
        description="Primary workspace for the actively developed LaneStomp matchup tool and the League-specific systems that will grow around it."
      >
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <AdminSectionCard
            actionLabel="Open matchups"
            count={leagueMatchupsCount}
            eyebrow="Active"
            href="/admin/league/matchups"
            label="Matchups"
            summary="Create, generate, review, and publish champion matchup guidance."
            tag="records"
          />
          <AdminSectionCard
            actionLabel="Open dashboard"
            count={leagueCounterPicksCount}
            eyebrow="Public"
            href="/admin/counter-picks"
            label="Counter Picks"
            summary="Collect Riot data, inspect suggestions, review champion profiles, and curate public counter recommendations."
            tag="counters"
          />
          <AdminSectionCard
            count={leagueDraftMatchupsCount}
            eyebrow="Inside matchups"
            href="/admin/league/matchups"
            label="Generation queue"
            summary="Batch-generate missing drafts and continue queue work from the matchup manager."
            tag="drafts"
          />
          <AdminSectionCard
            count={leagueReviewedMatchupsCount}
            eyebrow="Inside matchups"
            href="/admin/league/matchups"
            label="Coverage / review"
            summary="Track reviewed coverage by champion and lane before new lane expansion."
            tag="reviewed"
          />
        </div>
      </AdminProductArea>
    </div>
  );
}
