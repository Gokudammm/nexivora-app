import { AttestationManager } from "@/components/faculty/attestation-manager";
import { requireAuth } from "@/lib/auth/guards";
import { listAttestations, supervisedProjects } from "@/lib/db/queries/faculty";
import { db } from "@/lib/db/client";
import {
  prefillContributionStatement,
  prefillProjectStatement,
} from "@/lib/evaluation/attestation";
import { scoreMembers } from "@/lib/ledger/score";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Attestations",
  description:
    "The credential mechanism — issue, view and revoke. Never automatic: a named human vouches for it.",
  index: false,
  path: "/faculty/attestations",
});

/**
 * `/faculty/attestations`.
 *
 * The ledger writes a **first draft** of each sentence — counts and a share, no
 * adjectives — and the faculty member rewrites it before signing. That is the
 * whole design: pre-filling is the difference between an attestation taking
 * twenty seconds and taking two minutes, and that difference decides whether it
 * gets used at all, while the human is still the one asserting the claim.
 * `validateStatement` refuses text that still contains the draft prompt, so the
 * twenty-second path cannot quietly become an automatic one.
 *
 * The drafts are composed **here**, on the server, and passed down as strings.
 * `lib/evaluation/attestation.ts` imports `node:crypto` for the code generator,
 * so a client component that imported it to call the prefill would drag Node
 * built-ins into the browser bundle — the same class of trap as Phase 7's query
 * module leaking `pg`.
 */
export default async function AttestationsPage() {
  const viewer = await requireAuth("/faculty/attestations");

  const [issued, projects] = await Promise.all([
    listAttestations(viewer),
    db.project.findMany({
      where: {
        AND: [
          supervisedProjects(viewer),
          { status: { in: ["UNDER_REVIEW", "COMPLETED", "ARCHIVED"] } },
        ],
      },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        groupId: true,
        sections: { select: { kind: true, complete: true } },
        milestones: { select: { state: true } },
        members: {
          select: {
            role: true,
            user: { select: { id: true, name: true, username: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
  ]);

  const groupIds = [
    ...new Set(projects.map((project) => project.groupId).filter((id): id is string => !!id)),
  ];
  const memberIds = [...new Set(projects.flatMap((p) => p.members.map((m) => m.user.id)))];

  const [ledger, skills] = await Promise.all([
    groupIds.length === 0
      ? Promise.resolve([])
      : db.ledgerEvent.findMany({
          where: { groupId: { in: groupIds } },
          select: { groupId: true, userId: true, kind: true, weight: true, createdAt: true },
        }),
    memberIds.length === 0
      ? Promise.resolve([])
      : db.userSkill.findMany({
          where: { userId: { in: memberIds } },
          select: { userId: true, source: true, skill: { select: { name: true } } },
        }),
  ]);

  const candidates = projects.map((project) => {
    const events = ledger.filter((event) => event.groupId === project.groupId);
    const scores = scoreMembers(
      project.members.map((member) => member.user),
      events,
    );

    const completeSections = project.sections.filter((section) => section.complete).length;
    const milestonesClosed = project.milestones.filter((m) => m.state === "COMPLETE").length;

    return {
      slug: project.slug,
      title: project.title,
      status: project.status,
      projectDraft: prefillProjectStatement({
        projectTitle: project.title,
        memberCount: project.members.length,
        completeSections,
        totalSections: project.sections.length,
        milestonesClosed,
        hasPrototype: project.sections.some((s) => s.kind === "PROTOTYPE" && s.complete),
        hasResults: project.sections.some((s) => s.kind === "RESULTS" && s.complete),
      }),
      members: project.members.map((member) => {
        const score = scores.find((entry) => entry.member.id === member.user.id);
        const evidenced = skills
          .filter((row) => row.userId === member.user.id && row.source !== "SELF")
          .map((row) => row.skill.name)
          .slice(0, 6);

        return {
          id: member.user.id,
          name: member.user.name,
          avatarUrl: member.user.avatarUrl,
          role: member.role,
          share: score?.share ?? 0,
          skills: evidenced,
          draft: prefillContributionStatement({
            memberName: member.user.name,
            projectTitle: project.title,
            role: member.role.toLowerCase().replace(/_/g, " "),
            share: score?.share ?? 0,
            tasksClosed: score?.byKind.TASK_CLOSED.count ?? 0,
            filesContributed: score?.byKind.FILE_ADDED.count ?? 0,
            skills: evidenced,
          }),
        };
      }),
    };
  });

  return (
    <AttestationManager
      projects={candidates}
      issued={issued.map((attestation) => ({
        id: attestation.id,
        code: attestation.code,
        subjectType: attestation.subjectType,
        statement: attestation.statement,
        issuedAt: attestation.issuedAt,
        revokedAt: attestation.revokedAt,
        revokedReason: attestation.revokedReason,
        subjectName: attestation.subject?.name ?? null,
        projectTitle: attestation.project?.title ?? "a project that no longer exists",
      }))}
    />
  );
}
