# Roles & Permissions

This is the authorisation contract. It is implemented once, in `src/lib/authz/policy.ts`, and
asserted as a matrix in `src/lib/authz/policy.test.ts`. **No feature re-implements a permission
check.**

**Implemented in Phase 4 (2026-09-09):** 41 actions, 100 matrix assertions, plus a cross-college
sweep that is exhaustive over the action union. If this document and `policy.ts` ever disagree,
**this document is the specification and the code is the bug** — and the test is what tells you.

Two additions Phase 4 made to what is written below:

- **`GUEST` membership** (ADR-022) grants project-scoped access at a partner college and never
  college-wide reach. It requires an accepted `CollegePartnership`.
- **A platform admin cannot grade a project or submit a peer review.** An academic judgement belongs
  to the faculty member who supervised the work; the second would be a fabricated review. Every
  other action is permitted, and every one is written to the append-only `AuditLog`.

---

## The seven roles

| Role | Enum | Who | Primary surface |
| --- | --- | --- | --- |
| Student | `STUDENT` | Enrolled at a verified college | Feed, workspace, projects, portfolio |
| Faculty | `FACULTY` | Teaching staff at a verified college | Faculty dashboard, evaluation, attestation |
| College Admin | `COLLEGE_ADMIN` | Department or institution administrator | Admin console, hierarchy, roster, reports |
| Alumni | `ALUMNI` | A former student, transitioned from `STUDENT` | Feed, mentorship, college follow |
| Company | `COMPANY` | A verified employer or organisation | Talent discovery, opportunities, pipeline |
| Researcher | `RESEARCHER` | External academic or independent researcher | Collaboration, publications, project follow |
| Platform Admin | `PLATFORM_ADMIN` | Us | Verification queue, moderation, platform health |

**Roles are per-membership, not global.** A user can be `ALUMNI` at one college and `COMPANY` at an
employer simultaneously. `viewer.memberships` is a list, and every check resolves against the
membership relevant to the resource being accessed.

---

## The four scopes

Every permission answers two questions: *what action* and *within what scope*.

| Scope | Meaning |
| --- | --- |
| `OWN` | Resources the user created or is a member of |
| `GROUP` | Resources belonging to a group the user is a member of |
| `CLASS` / `SUBJECT` | Resources in a class the user is enrolled in or assigned to teach |
| `COLLEGE` | Resources anywhere inside the user's verified college |
| `PUBLIC` | Resources whose visibility is `PUBLIC` |

A faculty member can read every project in **their** subject, not every project in the college.
A college admin can read every project in the college but **cannot** grade one. These distinctions
are the whole point of the matrix.

---

## Permission matrix

Legend: **✅** allowed · **🔸** allowed within the named scope · **—** denied

### Projects

| Action | Student | Faculty | College Admin | Alumni | Company | Researcher | Platform Admin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Create project | 🔸 GROUP | 🔸 SUBJECT | — | — | — | — | — |
| Read project | 🔸 GROUP + visibility | 🔸 SUBJECT | 🔸 COLLEGE | 🔸 PUBLIC + college-only | 🔸 PUBLIC | 🔸 PUBLIC | ✅ |
| Edit sections | 🔸 GROUP | — (comments only) | — | — | — | — | — |
| Approve proposal | — | 🔸 SUBJECT | — | — | — | — | — |
| Change visibility | 🔸 GROUP lead | 🔸 SUBJECT | 🔸 COLLEGE | — | — | — | ✅ |
| Set embargo | 🔸 GROUP lead | 🔸 SUBJECT | 🔸 COLLEGE | — | — | — | — |
| Submit for review | 🔸 GROUP lead | — | — | — | — | — | — |
| Evaluate / grade | — | 🔸 SUBJECT | — | — | — | — | — |
| Archive | — | 🔸 SUBJECT | 🔸 COLLEGE | — | — | — | ✅ |
| Delete | 🔸 OWN draft only | — | — | — | — | — | ✅ |
| Build on (fork) | 🔸 any readable | 🔸 | — | — | — | 🔸 PUBLIC | ✅ |

### Group workspace

| Action | Student | Faculty | College Admin | Platform Admin |
| --- | --- | --- | --- | --- |
| Create group | 🔸 CLASS | 🔸 SUBJECT | 🔸 COLLEGE | ✅ |
| Join / leave group | 🔸 OWN | — | — | — |
| Invite / remove member | 🔸 GROUP lead | 🔸 SUBJECT | 🔸 COLLEGE | ✅ |
| Read workspace | 🔸 GROUP | 🔸 SUBJECT (read-only) | — | ✅ on report |
| Create / assign / close task | 🔸 GROUP | 🔸 SUBJECT | — | — |
| Upload / delete file | 🔸 GROUP | 🔸 SUBJECT (upload only) | — | — |
| Post in discussion | 🔸 GROUP | 🔸 SUBJECT | — | — |
| Schedule meeting | 🔸 GROUP | 🔸 SUBJECT | — | — |
| **Read contribution ledger** | 🔸 GROUP (all members see it) | 🔸 SUBJECT | 🔸 COLLEGE aggregate only | ✅ |
| Submit peer review | 🔸 GROUP | — | — | — |
| **Read individual peer review** | — (aggregate only) | 🔸 SUBJECT | — | ✅ on report |

**Faculty read access to a workspace is read-only by design**, except for tasks, feedback and
meetings. A faculty member who can silently edit a group's files destroys the evidentiary value of
the ledger, which is the entire feature.

### Institution administration

| Action | Faculty | College Admin | Platform Admin |
| --- | --- | --- | --- |
| Manage departments / programmes / subjects / terms | — | 🔸 COLLEGE | ✅ |
| Create class, assign faculty | — | 🔸 COLLEGE | ✅ |
| Import / manage student roster | — | 🔸 COLLEGE | ✅ |
| Issue invitations, set roles | — | 🔸 COLLEGE | ✅ |
| Suspend a member | — | 🔸 COLLEGE | ✅ |
| Edit college profile and branding | — | 🔸 COLLEGE | ✅ |
| Request college verification | — | 🔸 COLLEGE | — |
| **Grant college verification** | — | — | ✅ |
| Read audit log | — | 🔸 COLLEGE | ✅ |
| Generate accreditation export | — | 🔸 COLLEGE | ✅ |

### Social, feed & network

| Action | Student | Faculty | Alumni | Company | Researcher |
| --- | --- | --- | --- | --- | --- |
| Post (anchored) | ✅ | ✅ | ✅ | 🔸 own opportunities | ✅ |
| Comment / react / save | ✅ | ✅ | ✅ | ✅ | ✅ |
| Follow user / project / topic / college | ✅ | ✅ | ✅ | ✅ | ✅ |
| Send collaboration request | ✅ | ✅ | — | — | ✅ |
| Offer mentorship | — | ✅ | ✅ | ✅ | ✅ |
| Post an opportunity | — | — | — | 🔸 verified only | — |
| Contact a student directly | ✅ per privacy | ✅ | 🔸 per privacy | 🔸 per privacy + opt-in | 🔸 per privacy |
| Report content | ✅ | ✅ | ✅ | ✅ | ✅ |
| Moderate a report | — | 🔸 SUBJECT | 🔸 COLLEGE | — | — |

**A company cannot message a student unless the student has opted into being contacted.** This is
non-negotiable and it is the difference between a talent platform and a spam channel.

---

## Cross-college isolation

The hardest rule in the system, and the one worth stating on its own:

> **No query returns data from a college the viewer has no membership in, unless that data is
> explicitly `PUBLIC`.**

Enforced three ways, deliberately redundant:

1. `src/proxy.ts` redirects an unauthenticated request away from a signed-in route.
2. **Every scoped query takes `viewer` and applies the predicate. This is the boundary** — layers
   1 and 3 are convenience and evidence respectively (ADR-028).
3. `isolation.test.ts` attempts cross-college reads **with the proxy disabled** and asserts empty,
   with a positive control proving the predicate is not simply denying everything.

Cross-college collaboration (Phase 14) works by creating an **explicit `CollegePartnership` and a
per-project guest membership** — never by relaxing the isolation rule.

---

## Visibility resolution

For any resource, the effective visibility is the **most restrictive** of:

1. The resource's own `visibility` field
2. The owning group's visibility
3. The owning college's visibility policy
4. Any active `embargoUntil`
5. The author's per-field privacy settings (for profiles)

Computed once in `resolveVisibility()`. A page never composes this logic itself.

---

## Special states

| State | Effect |
| --- | --- |
| **Unverified college** | Members can use the product internally; **nothing from that college is publicly indexable** and it does not appear in inter-college surfaces. This is the anti-abuse gate. |
| **Unverified company** | Can create a profile; cannot post an opportunity, cannot contact a student, does not appear in search. |
| **Suspended membership** | Read-only on everything; cannot post, comment, submit or be assigned. |
| **Alumni transition** | On graduation, `STUDENT` becomes `ALUMNI`. Workspace access ends; **authorship of past projects and the portfolio persists forever.** Losing your own work on graduation would be the single worst possible bug in this product. |
| **Embargoed project** | Title, team and abstract are visible; all sections, files and results are hidden until `embargoUntil`. It is listed but not readable, so it can be *cited* without being *disclosed*. |
| **Deleted account** | Content is anonymised, not removed, where it is part of a group's shared record. Solely-authored content is hard-deleted. Detailed in `docs/SECURITY.md`. |

---

## Implementation shape

```ts
// src/lib/authz/policy.ts — the single source of truth
export type Action =
  | 'project:read' | 'project:edit' | 'project:approve' | 'project:evaluate'
  | 'workspace:read' | 'task:close' | 'ledger:read' | 'peerreview:read:individual'
  | 'college:manage' | 'opportunity:post' | /* … */;

export function can(viewer: Viewer, action: Action, resource?: Resource): boolean;

// every scoped query, without exception
export async function getX(viewer: Viewer, id: string): Promise<X | null>;
```

Two rules that are easy to get wrong:

- **A denied *read* returns `null`, not a 403.** A 403 confirms the resource exists, which leaks the
  existence of private projects and private profiles.
- **A denied *write* throws.** The user knew the resource existed; telling them they may not change
  it is correct and more helpful than a silent no-op.
