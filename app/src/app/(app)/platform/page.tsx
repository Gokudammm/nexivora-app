import { forbidden } from "next/navigation";

import {
  Badge,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { requireAuth } from "@/lib/auth/guards";
import { readAudit } from "@/lib/audit";
import { db } from "@/lib/db/client";
import { buildMetadata } from "@/lib/seo/metadata";

import { VerificationDecision } from "./_decision";

export const metadata = buildMetadata({
  title: "Verification queue",
  description:
    "Colleges waiting for verification. Nothing from an unverified college is publicly visible, so this queue is the gate.",
  index: false,
  path: "/platform",
});

/**
 * The platform verification queue.
 *
 * Platform admin only, and deliberately manual. A college that could verify
 * itself is not a trust gate, and an automated check would be one — the whole
 * value of the badge is that a person looked.
 */
export default async function PlatformPage() {
  const viewer = await requireAuth("/platform");
  if (!viewer.isPlatformAdmin) forbidden();

  const [pending, recent] = await Promise.all([
    db.college.findMany({
      where: { verification: { in: ["PENDING", "UNVERIFIED", "REJECTED"] } },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        state: true,
        website: true,
        emailDomains: true,
        verification: true,
        createdAt: true,
        _count: { select: { memberships: true, projects: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.college.findMany({
      where: { verification: "VERIFIED" },
      select: { id: true, name: true, verifiedAt: true },
      orderBy: { verifiedAt: "desc" },
      take: 10,
    }),
  ]);

  // The evidence a college submitted lives in the audit log, where it cannot be
  // edited after the fact.
  const evidence = new Map<string, string>();
  for (const college of pending) {
    const entries = await readAudit({
      collegeId: college.id,
      action: "college.verify.request",
      take: 1,
    });
    if (entries[0]?.reason) evidence.set(college.id, entries[0].reason);
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-8">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Verification queue</h1>
        <p className="text-fg-muted">
          Nothing from an unverified college is publicly listed or indexable. This queue is that
          gate, and it is reviewed by hand on purpose.
        </p>
      </header>

      {pending.length === 0 ? (
        <EmptyState
          title="Nothing waiting"
          description="Every college has been reviewed."
          action={null}
        />
      ) : (
        <ul className="grid gap-4">
          {pending.map((college) => (
            <li key={college.id}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    {college.name}
                    <Badge tone={college.verification === "PENDING" ? "outline" : "neutral"}>
                      {college.verification.toLowerCase()}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {college.city}, {college.state} · {college._count.memberships} members ·{" "}
                    {college._count.projects} projects
                  </CardDescription>
                </CardHeader>
                <CardBody className="grid gap-4">
                  <dl className="grid gap-2 text-sm">
                    <div className="flex gap-3">
                      <dt className="w-32 shrink-0 text-fg-subtle">Domains</dt>
                      <dd>
                        {college.emailDomains.join(", ") || (
                          <span className="text-fg-subtle">none declared</span>
                        )}
                      </dd>
                    </div>
                    <div className="flex gap-3">
                      <dt className="w-32 shrink-0 text-fg-subtle">Website</dt>
                      <dd>{college.website ?? <span className="text-fg-subtle">none</span>}</dd>
                    </div>
                    <div className="flex gap-3">
                      <dt className="w-32 shrink-0 text-fg-subtle">Evidence</dt>
                      <dd className="text-fg-muted">
                        {evidence.get(college.id) ?? "No request submitted yet."}
                      </dd>
                    </div>
                  </dl>

                  {college.verification === "PENDING" ? (
                    <VerificationDecision collegeId={college.id} />
                  ) : null}
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {recent.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">Recently verified</h2>
          <ul className="grid gap-1 text-sm text-fg-muted">
            {recent.map((college) => (
              <li key={college.id}>
                {college.name}
                {college.verifiedAt
                  ? ` — ${college.verifiedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                  : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
