# Phase 18 — AI Assistant Layer *(built last, by design)*

| | |
| --- | --- |
| **Status** | ⬜ Not Started |
| **Depends on** | Phases 0–17, all working without AI |
| **Blocks** | Nothing |
| **Estimate** | 8 focused hours |
| **Started** | — |
| **Completed** | — |

## Objective

Add the personal academic assistant the brief describes — **on top of a product that is already
complete**. Every AI feature here enhances something that already works deterministically. Turning
AI off must leave a fully functional product with no broken UI (ADR-012).

This is last for two reasons: AI credits are scarce, and an AI feature that fails takes its whole
surface down with it unless there is something underneath.

## The rule that governs this entire phase

> **`AI_ENABLED=false` must produce a complete, working product with no broken or empty UI.**
> Every AI surface has a deterministic fallback that shipped in an earlier phase and still works.

| AI feature | Its deterministic fallback | Shipped in |
| --- | --- | --- |
| Assistant navigation and "how do I…" | Command palette + help centre search | 1, 2 |
| Semantic search | Postgres full-text search | 11 |
| Teammate suggestions | Skill-overlap scoring with explanations | 11 |
| Project summarisation | The author-written summary field | 8 |
| Related projects | Trigram + tag similarity | 11 |
| Deadline and workload nudges | Rule-based reminders | 7, 10 |
| Documentation drafting | Per-section guidance prompts and examples | 8 |
| Feed ranking | The deterministic scoring function | 10 |

## In scope

- The `AIProvider` interface, a real provider, and `NullProvider`
- The assistant surface with grounded, cited answers
- Summarisation, semantic search, enriched suggestions, drafting help
- Caching, quotas and a hard budget cap

## Out of scope

- Autonomous agents · Auto-published content · Automated grading (**never** — an academic
  evaluation must be made by a named human, and automating it would be indefensible)

## Deliverables

### The provider layer
- [ ] `lib/ai/provider.ts` — the interface: `complete()`, `summarise()`, `embed()`, `classify()`
- [ ] `lib/ai/anthropic.ts` — the real provider (Claude), with the model id in configuration
- [ ] `lib/ai/null.ts` — `NullProvider` returning a typed "unavailable" that every caller handles
- [ ] `AI_ENABLED` gates provider selection; **no feature imports a provider directly**
- [ ] **Response caching keyed by a content hash** — the same project summarised twice costs once
- [ ] Per-user daily token quota, enforced before the call
- [ ] A hard global monthly budget cap; on exhaustion the system falls back to `NullProvider`
      silently and logs it
- [ ] Every call: timeout, one retry with backoff, and a fallback path on failure
- [ ] A usage dashboard at `/platform/ai` — tokens, cost, cache hit rate, per-feature breakdown

### The assistant — `/assistant` and ⌘K
- [ ] Extends the Phase 1 command palette rather than replacing it. **With AI off it is still the
      command palette**, which is why it was built in Phase 1.
- [ ] Grounded in real data: the user's projects, tasks, deadlines, groups, notifications, plus the
      help centre and route registry
- [ ] Capabilities: navigate ("open my IoT project's task board") · answer ("what's due this
      week?") · explain ("how do I submit a project?") · summarise ("what happened in my group this
      week?") · find ("show me projects about water quality")
- [ ] **Every answer cites its source** and links to it. An assistant that asserts without a link is
      not usable in an academic context.
- [ ] **Strictly scoped to what the user may see.** The assistant queries through the same
      `viewer`-scoped functions as the UI; it never gets a privileged path. This must be tested
      adversarially — attempt to extract another college's data through the assistant.
- [ ] Conversation history per user, clearable
- [ ] Rate limited per user

### Summarisation
- [ ] Project summary from the nine sections — **a draft the group edits and approves**, never
      auto-published (`docs/SEO-CHECKLIST.md` §12: scaled content abuse)
- [ ] Group weekly digest — what happened, what is blocked, what is due
- [ ] Discussion thread summary for long threads
- [ ] Faculty briefing: a class overview before a review session
- [ ] Every summary is labelled as AI-generated and shows what it was generated from

### Semantic search
- [ ] Embeddings for projects, ideas and resources, computed on publish and cached
- [ ] **Hybrid retrieval: the Phase 11 lexical search produces a shortlist; embeddings re-rank it.**
      Never embedding-only — lexical is the floor and the fallback.
- [ ] "Find projects like this described in plain language"
- [ ] Falls back to pure lexical with no visible change in layout when AI is off

### Enhanced suggestions
- [ ] Teammate matching: the Phase 11 deterministic score, plus an AI-written explanation of *why*
      this person complements the team. **The score stays deterministic** — AI explains, it does not
      rank.
- [ ] Resource suggestions for a project's current stage
- [ ] Related-work suggestions from the archive
- [ ] Skill-gap suggestions with concrete free resources

### Documentation assistance
- [ ] Section drafting help: given the project context, suggest what belongs in this section
- [ ] Improve clarity of a passage the author already wrote — **never write it for them**
- [ ] Suggest tags, domain and SDG alignment from the problem statement
- [ ] Question refinement before posting to the feed
- [ ] **Every output is a draft in an editor the author must accept.** Nothing AI-generated is ever
      published unattended.

### Guardrails
- [ ] `AI_ENABLED=false` end-to-end test: **every AI surface degrades with no broken UI**
- [ ] Prompt-injection defence: user content is data, never instruction; project text cannot change
      the assistant's behaviour
- [ ] No PII in prompts beyond what the user already sees
- [ ] AI output labelled everywhere it appears
- [ ] `/legal/ai-policy` — what AI is used for, what data it sees, and how to opt out
- [ ] A per-user opt-out that fully disables AI features for that account

## Acceptance criteria

1. **With `AI_ENABLED=false`, every route works and no UI is broken or empty.** This is the phase's
   defining test.
2. With AI on, every assistant answer cites a source the user can open.
3. **The assistant cannot surface data the user is not authorised to see** — verified adversarially,
   including a direct attempt to name another college's private project.
4. Prompt injection through project content does not change assistant behaviour.
5. Cache hit rate above 60% on repeated operations.
6. Quota exhaustion degrades to the deterministic path with a clear, non-alarming message.
7. No AI output is published anywhere without an explicit human accept.
8. Semantic search improves relevance over lexical alone, measured on a fixed query set — and falls
   back cleanly.
9. Token spend per user per day stays within the configured quota.
10. `npm run check` clean.

## Key files this phase creates

```
src/lib/ai/provider.ts        The interface every feature talks to
src/lib/ai/anthropic.ts       The real provider
src/lib/ai/null.ts            NullProvider — the fallback that makes AI optional
src/lib/ai/{cache,quota,prompts}.ts
src/app/(app)/assistant/page.tsx
src/app/api/ai/route.ts
src/app/(app)/platform/ai/    Usage and cost dashboard
```

## Notes & risks

- **Test with AI off first, and often.** The failure mode is building an AI surface and only later
  discovering the off state renders an empty panel. Run the `AI_ENABLED=false` suite before shipping
  each feature, not at the end.
- **Never let AI rank anything that affects a student.** Teammate suggestions and search results
  stay deterministically ranked; AI explains and re-ranks a shortlist. A faculty member must be able
  to ask "why was this student suggested?" and get an arithmetic answer.
- **Never automate evaluation.** No AI grading, no AI-scored rubrics, no AI-written feedback sent as
  a faculty member's. This is an absolute line: an academic assessment must be made and owned by a
  named human.
- **Auto-publishing generated text is scaled content abuse** under Google's spam policies and it
  would put the entire SEO thesis at risk. Everything is a draft.
- Prompt injection is a real threat here because the assistant reads user-authored project content.
  Treat all retrieved content as untrusted data, wrapped and labelled, never as instructions.
- Cache aggressively. Project summaries change rarely; recomputing one on every page view is how the
  credits vanish in a week.
- Watch the budget from the first day it is on. Set the global cap before the first real call, not
  after the first surprise.

---

## Phase Summary

*Fill this in when the phase is complete.*

**What was built.**

**Key decisions made.**

**The AI-off test — what was verified, and what broke on the first attempt.**

**Cost and quota settings chosen.**

**Deviations from the spec above, and why.**

**Anything the next phase must know.**

**Verified by.**

| Check | Result |
| --- | --- |
| | |
