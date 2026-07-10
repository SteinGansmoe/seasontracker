import Link from "next/link";
import { Pencil } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { cn } from "@/src/lib/utils";

export function AdminSectionCard({
  actionLabel = "Open section",
  count,
  eyebrow,
  href,
  label,
  muted = false,
  summary,
  tag,
}: {
  actionLabel?: string;
  count: number | null;
  eyebrow?: string;
  href?: string;
  label: string;
  muted?: boolean;
  summary: string;
  tag?: string;
}) {
  return (
    <Card
      className={cn(
        "border-white/10 p-5 text-white shadow-xl shadow-black/15",
        muted ? "bg-[#0d1424]/80" : "bg-[#10182b]/90",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          {eyebrow ? (
            <p className="mb-2 text-xs font-semibold uppercase text-cyan-200/70">{eyebrow}</p>
          ) : null}
          <p className="font-mono text-xl font-semibold">{label}</p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{summary}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-3xl font-semibold text-violet-100">
            {count === null ? "..." : count}
          </p>
          {tag ? <p className="mt-1 text-xs text-zinc-500">{tag}</p> : null}
        </div>
      </div>
      {href ? (
        <Button
          asChild
          className="mt-5 border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
          variant="ghost"
        >
          <Link href={href} transitionTypes={["admin-section"]}>
            <Pencil className="size-3.5" aria-hidden="true" />
            {actionLabel}
          </Link>
        </Button>
      ) : (
        <div className="mt-5 inline-flex rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-500">
          Planned
        </div>
      )}
    </Card>
  );
}
