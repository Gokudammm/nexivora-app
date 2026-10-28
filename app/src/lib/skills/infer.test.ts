import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { RESERVED_USERNAMES, checkUsername } from "@/config/reserved-usernames";
import { projects } from "@/content/projects";

import { inferSkills, mergeSkills, skillSlug, type ProjectEvidence } from "./infer";

/**
 * The skill graph and the username rules.
 *
 * Both are heuristics with real consequences — one decides whether a profile
 * reads as evidence or as a CV, the other decides whether somebody's public URL
 * can shadow a route — so both are asserted against real inputs rather than
 * invented ones.
 */

/* -------------------------------------------------------------- usernames */

/**
 * Acceptance criterion 6, tested against the **actual route list** rather than
 * against the reserved set.
 *
 * Asserting that the reserved list contains what the reserved list contains
 * would prove nothing. Reading the routes off the filesystem means a route
 * added in a later phase without a matching reservation fails here, which is
 * the only version of this test that keeps working.
 */
function topLevelRoutes(): string[] {
  const appDir = path.resolve(import.meta.dirname, "..", "..", "app");
  const found = new Set<string>();

  const walk = (dir: string, depth: number) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (!statSync(full).isDirectory()) continue;

      // Route groups — `(site)`, `(app)` — are not URL segments; descend
      // through them without counting them.
      if (entry.startsWith("(") && entry.endsWith(")")) {
        walk(full, depth);
        continue;
      }

      // Dynamic segments and private folders are not reservable names.
      if (entry.startsWith("[") || entry.startsWith("_") || entry.startsWith(".")) continue;

      if (depth === 0) found.add(entry);
    }
  };

  walk(appDir, 0);
  return [...found];
}

describe("reserved usernames", () => {
  const routes = topLevelRoutes();

  it("finds the real routes to check against", () => {
    assert.ok(routes.length > 10, `expected the app's routes, found ${routes.length}`);
    assert.ok(routes.includes("login"), "sanity: /login should be among them");
  });

  it("reserves every top-level route, so a username can never shadow one", () => {
    const unreserved = routes.filter((route) => !RESERVED_USERNAMES.has(route));

    assert.deepEqual(
      unreserved,
      [],
      `these routes are not reserved and a user could take them: ${unreserved.join(", ")}`,
    );
  });

  it("refuses a reserved name", () => {
    for (const name of ["admin", "settings", "explore", "support", "nexivora"]) {
      assert.equal(checkUsername(name).ok, false, `"${name}" should be refused`);
    }
  });

  it("enforces the shape a URL needs", () => {
    assert.equal(checkUsername("ab").ok, false, "too short");
    assert.equal(checkUsername("a".repeat(31)).ok, false, "too long");
    assert.equal(checkUsername("Ananya").ok, false, "uppercase");
    assert.equal(checkUsername("ananya sharma").ok, false, "space");
    assert.equal(checkUsername("ananya_sharma").ok, false, "underscore");
    assert.equal(checkUsername("-ananya").ok, false, "leading hyphen");
    assert.equal(checkUsername("ananya-").ok, false, "trailing hyphen");
    assert.equal(checkUsername("ananya--sharma").ok, false, "double hyphen");
    assert.equal(checkUsername("12345").ok, false, "digits only");
  });

  it("accepts an ordinary handle", () => {
    assert.equal(checkUsername("ananya-sharma").ok, true);
    assert.equal(checkUsername("rohit2").ok, true);
  });

  it("says why, not just no", () => {
    const result = checkUsername("admin");
    assert.equal(result.ok, false);
    assert.ok(result.ok === false && result.reason.length > 10);
  });
});

/* ----------------------------------------------------------------- skills */

/** Build evidence from the real corpus, so the inference is tested on real stacks. */
function evidenceFor(username: string): ProjectEvidence[] {
  return projects
    .filter((project) => project.members.some((member) => member.username === username))
    .map((project) => {
      const member = project.members.find((m) => m.username === username);

      return {
        slug: project.slug,
        title: project.title,
        // The fixtures use the lowercase content vocabulary; the inference
        // takes the database enum.
        status:
          project.status === "completed"
            ? "COMPLETED"
            : project.status === "archived"
              ? "ARCHIVED"
              : project.status === "progress"
                ? "IN_PROGRESS"
                : "DRAFT",
        techStack: project.techStack,
        domain: project.domain,
        topics: project.topics,
        role: member?.role ?? "",
      } satisfies ProjectEvidence;
    });
}

describe("skillSlug", () => {
  it("produces a stable, URL-safe slug", () => {
    assert.equal(skillSlug("Machine Learning"), "machine-learning");
    assert.equal(skillSlug("C++"), "c");
    assert.equal(skillSlug("Café"), "cafe");
  });
});

describe("inferSkills", () => {
  const rohit = evidenceFor("rohit-verma");

  it("finds evidence for someone with real projects", () => {
    assert.ok(rohit.length > 0, "the fixture should give this person projects");

    const skills = inferSkills(rohit);
    assert.ok(skills.length > 0, "expected inferred skills");
  });

  it("names the projects that produced each skill", () => {
    // "React — from 3 projects" is only worth anything if the three are named.
    for (const skill of inferSkills(rohit)) {
      assert.ok(skill.projectSlugs.length > 0, `${skill.name} has no evidence`);
      assert.equal(skill.projectSlugs.length, skill.projectTitles.length);
    }
  });

  it("ignores a draft, so a skill cannot be manufactured with an empty project", () => {
    const draft: ProjectEvidence = {
      slug: "not-real",
      title: "Not real",
      status: "DRAFT",
      techStack: ["Rust", "WebAssembly"],
      domain: "software",
      topics: [],
      role: "Backend",
    };

    assert.deepEqual(inferSkills([draft]), []);
  });

  it("drops stack noise that says nothing about a person", () => {
    const project: ProjectEvidence = {
      slug: "p",
      title: "P",
      status: "COMPLETED",
      techStack: ["Python", "JSON", "Git", "CSV"],
      domain: "software",
      topics: [],
      role: "Backend",
    };

    const names = inferSkills([project]).map((skill) => skill.name);

    assert.ok(names.includes("Python"));
    for (const noise of ["JSON", "Git", "CSV"]) {
      assert.ok(!names.includes(noise), `${noise} is not a skill`);
    }
  });

  it("reads the declared role, which is what distinguishes teammates", () => {
    const base = {
      slug: "p",
      title: "P",
      status: "COMPLETED" as const,
      techStack: ["ESP32"],
      domain: "hardware",
      topics: [],
    };

    const firmware = inferSkills([{ ...base, role: "Firmware & calibration" }]).map((s) => s.name);
    const writing = inferSkills([{ ...base, slug: "q", role: "Report write-up" }]).map(
      (s) => s.name,
    );

    assert.ok(firmware.includes("Embedded systems"));
    assert.ok(firmware.includes("Sensor calibration"));
    assert.ok(writing.includes("Technical writing"));
    assert.ok(
      !writing.includes("Embedded systems"),
      "the two roles must not infer the same skills",
    );
  });

  it("rates more projects as stronger evidence", () => {
    const make = (slug: string): ProjectEvidence => ({
      slug,
      title: slug,
      status: "COMPLETED",
      techStack: ["Python"],
      domain: "software",
      topics: [],
      role: "Backend",
    });

    const one = inferSkills([make("a")]).find((s) => s.name === "Python");
    const three = inferSkills([make("a"), make("b"), make("c")]).find((s) => s.name === "Python");

    assert.ok(one && three);
    assert.ok(three.strength > one.strength);
    assert.equal(three.projectSlugs.length, 3);
  });

  it("is stable across calls, so the list does not reshuffle on reload", () => {
    const a = inferSkills(rohit).map((s) => s.slug);
    const b = inferSkills(rohit).map((s) => s.slug);
    assert.deepEqual(a, b);
  });

  it("returns nothing for someone with no projects", () => {
    assert.deepEqual(inferSkills([]), []);
  });
});

describe("mergeSkills", () => {
  const project: ProjectEvidence = {
    slug: "p",
    title: "Irrigation controller",
    status: "COMPLETED",
    techStack: ["Python", "ESP32"],
    domain: "hardware",
    topics: [],
    role: "Firmware",
  };

  const inferred = inferSkills([project]);

  it("promotes a claim the projects corroborate", () => {
    const merged = mergeSkills([{ name: "Python", slug: "python", source: "SELF" }], inferred);
    const python = merged.find((skill) => skill.slug === "python");

    assert.ok(python);
    assert.equal(python.source, "PROJECT_INFERRED", "evidence should outrank the claim");
    assert.ok(python.projectSlugs.includes("p"));
  });

  it("keeps an unevidenced claim, clearly marked", () => {
    const merged = mergeSkills(
      [{ name: "Kubernetes", slug: "kubernetes", source: "SELF" }],
      inferred,
    );
    const k8s = merged.find((skill) => skill.slug === "kubernetes");

    assert.ok(k8s);
    assert.equal(k8s.source, "SELF");
    assert.equal(k8s.projectSlugs.length, 0);
    assert.ok(k8s.reason.includes("no project evidence"));
  });

  it("lets an attestation outrank everything", () => {
    const merged = mergeSkills(
      [{ name: "Sensor calibration", slug: "sensor-calibration", source: "ATTESTED" }],
      inferred,
    );

    const attested = merged.find((skill) => skill.slug === "sensor-calibration");
    assert.ok(attested);
    assert.equal(attested.source, "ATTESTED");
    assert.equal(attested.strength, 4);
  });

  it("puts the credible half of the list first", () => {
    const merged = mergeSkills(
      [
        { name: "Kubernetes", slug: "kubernetes", source: "SELF" },
        { name: "Python", slug: "python", source: "SELF" },
      ],
      inferred,
    );

    const firstSelf = merged.findIndex((skill) => skill.source === "SELF");
    const lastEvidenced = merged.map((skill) => skill.source).lastIndexOf("PROJECT_INFERRED");

    assert.ok(lastEvidenced < firstSelf, "self-declared skills must sink below evidenced ones");
  });

  it("does not list a skill twice", () => {
    const merged = mergeSkills([{ name: "Python", slug: "python", source: "SELF" }], inferred);
    const slugs = merged.map((skill) => skill.slug);

    assert.equal(new Set(slugs).size, slugs.length);
  });
});
