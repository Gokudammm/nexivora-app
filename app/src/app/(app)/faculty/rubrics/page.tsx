import { forbidden } from "next/navigation";

import { RubricManager } from "@/components/faculty/rubric-manager";
import { RUBRIC_TEMPLATES } from "@/lib/evaluation/rubric";
import { requireAuth } from "@/lib/auth/guards";
import { listRubrics, supervisedSubjectIds } from "@/lib/db/queries/faculty";
import { db } from "@/lib/db/client";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Rubrics",
  description: "Named criteria with weights summing to 100, versioned rather than edited.",
  index: false,
  path: "/faculty/rubrics",
});

/**
 * `/faculty/rubrics`.
 *
 * The versioning rule is surfaced at the point of editing rather than explained
 * in a help article: a rubric that has been used to mark work says so, and
 * saving creates version n+1. An edited rubric that retroactively changes past
 * marks is — the spec's words — a serious academic integrity problem, and the
 * only reliable way to prevent it is to make the alternative obvious while
 * somebody is in the form.
 */
export default async function RubricsPage() {
  const viewer = await requireAuth("/faculty/rubrics");

  const subjectIds = supervisedSubjectIds(viewer);
  if (subjectIds.length === 0) forbidden();

  const collegeId = viewer.teaches[0]?.collegeId;
  if (!collegeId) forbidden();

  const [rubrics, subjects] = await Promise.all([
    listRubrics(viewer, collegeId),
    db.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true, name: true, code: true },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <RubricManager
      collegeId={collegeId}
      subjects={subjects}
      templates={RUBRIC_TEMPLATES.map((template) => ({
        key: template.key,
        name: template.name,
        description: template.description,
        criteria: template.criteria.map((criterion) => ({
          name: criterion.name,
          weight: criterion.weight,
          descriptors: [...criterion.descriptors],
        })),
      }))}
      rubrics={rubrics.map((rubric) => ({
        id: rubric.id,
        name: rubric.name,
        version: rubric.version,
        subjectId: rubric.subjectId,
        subjectLabel: rubric.subject ? `${rubric.subject.code} ${rubric.subject.name}` : null,
        creatorName: rubric.creator.name,
        evaluationCount: rubric._count.evaluations,
        criteria: rubric.criteria.map((criterion) => ({
          id: criterion.id,
          name: criterion.name,
          weight: criterion.weight,
          descriptors: Array.isArray(criterion.descriptors)
            ? (criterion.descriptors as string[])
            : [],
        })),
      }))}
    />
  );
}
