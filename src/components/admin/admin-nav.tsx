import Link from "next/link";

import type { AdminSection } from "./types";
import { cn } from "@/src/lib/utils";

type AdminNavItem =
  | {
      href: string;
      label: string;
      section: AdminSection;
      status?: never;
    }
  | {
      href: string;
      label: string;
      section?: never;
      status: "inside";
    };

const adminNavGroups: Array<{
  items: AdminNavItem[];
  label: string;
}> = [
  {
    label: "Matchups",
    items: [
      {
        href: "/admin/league/matchups",
        label: "Matchups overview",
        section: "league-matchups",
      },
      {
        href: "/admin/league/matchups#generation-queue",
        label: "Generation queue",
        status: "inside",
      },
      {
        href: "/admin/league/matchups#coverage-review",
        label: "Coverage / Review",
        status: "inside",
      },
    ],
  },
  {
    label: "Counter Pick",
    items: [
      {
        href: "/admin/counter-picks",
        label: "Counter Pick overview",
        section: "counter-picks-overview",
      },
      {
        href: "/admin/counter-picks/collect",
        label: "Collect data",
        section: "counter-picks-collect",
      },
      {
        href: "/admin/counter-picks/shadow-ranking",
        label: "Shadow ranking",
        section: "counter-picks-shadow-ranking",
      },
      {
        href: "/admin/counter-picks/review",
        label: "Counter Review",
        section: "counter-picks-review",
      },
      {
        href: "/admin/counter-picks/profile-review",
        label: "Counter Profile Review",
        section: "counter-picks-profile-review",
      },
    ],
  },
];

export function AdminNavigation({ activeSection }: { activeSection: AdminSection }) {
  return (
    <nav
      className="grid gap-4 border border-cyan-100/15 bg-[#06111f]/78 p-4 md:grid-cols-2 xl:grid-cols-4"
      aria-label="Admin sections"
    >
      {adminNavGroups.map((group) => (
        <div className="space-y-2" key={group.label}>
          <p className="px-1 text-xs font-semibold uppercase text-zinc-500">{group.label}</p>
          <div className="flex flex-wrap gap-2">
            {group.items.map((item) => {
              const isActive =
                item.section === activeSection ||
                (item.section === "counter-picks-overview" &&
                  activeSection === "league-counter-picks") ||
                (item.status === "inside" && activeSection === "league-matchups");

              return (
                <Link
                  className={cn(
                    "rounded border px-3 py-2 text-sm transition",
                    isActive
                      ? "border-cyan-300/35 bg-cyan-400/[0.08] text-cyan-100"
                      : "border-cyan-100/15 bg-white/[0.035] text-zinc-300 hover:border-cyan-300/30 hover:bg-cyan-400/[0.06] hover:text-cyan-100",
                  )}
                  href={item.href}
                  key={`${group.label}-${item.label}`}
                  transitionTypes={["admin-section"]}
                >
                  {item.label}
                  {item.status === "inside" ? (
                    <span className="ml-2 text-[0.65rem] uppercase opacity-70">Inside</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
