import type { Metadata } from "next";
import Link from "next/link";

import { Container, PageHeader, Section } from "@/components/layout/primitives";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Breadcrumbs } from "@/components/ui/navigation";
import { attributionLine, isAttestationCode } from "@/lib/evaluation/attestation";
import { verifyAttestation } from "@/lib/evaluation/attestation-actions";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Verify an attestation",
  description:
    "Check an attestation code from a CV or a printed record. Shows who signed it, when, what they vouched for, and whether it still stands.",
  path: "/verify",
});

/**
 * `/verify` — public, deliberately.
 *
 * An attestation code on a CV is worth nothing if the person reading it needs
 * an account to check it. The reader here is a recruiter or an admissions
 * officer who has never heard of this product and will give it about fifteen
 * seconds: a box, a code, an answer.
 *
 * A **revoked** attestation still resolves, and says so. The alternative — a
 * dead lookup — is worse for everybody: the reader cannot tell a withdrawn
 * credential from a typo, and the person whose attestation it was gets the
 * same suspicion either way.
 *
 * The form is a GET, so a verified result has its own URL. Somebody checking
 * three candidates can keep three tabs, and a code can be linked directly.
 */
export default async function VerifyPage({ searchParams }: PageProps<"/verify">) {
  const { code } = await searchParams;
  const submitted = (typeof code === "string" ? code : "").trim().toUpperCase();

  const malformed = submitted.length > 0 && !isAttestationCode(submitted);
  const attestation =
    malformed || submitted.length === 0 ? null : await verifyAttestation(submitted);

  return (
    <>
      <Container>
        <Breadcrumbs crumbs={[{ label: "Verify", href: "/verify" }]} />
      </Container>

      <PageHeader
        title="Verify an attestation"
        description="Attestations on Nexivora are signed by a named faculty member at a named college. Enter the code printed on the record to see what they vouched for — no account needed."
      />

      <Section>
        <Container className="grid max-w-2xl gap-6">
          <form method="get" className="grid gap-3">
            <Field
              label="Attestation code"
              hint="Twelve characters in three groups, as printed — for example NX-4K2P-9XQR-M3TD."
              error={
                malformed
                  ? "That is not a valid code. Check the characters and try again."
                  : undefined
              }
            >
              <Input
                name="code"
                defaultValue={submitted}
                placeholder="NX-XXXX-XXXX-XXXX"
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                maxLength={17}
              />
            </Field>

            <div>
              <Button type="submit">Verify</Button>
            </div>
          </form>

          {submitted.length > 0 && !malformed && !attestation ? (
            <Alert tone="warning" title="No attestation with that code">
              Nothing on Nexivora carries this code. It may have been mistyped — the alphabet
              deliberately excludes I, L, O and U, so a character that looks like one of those is
              probably a 1, a 0 or something else.
            </Alert>
          ) : null}

          {attestation ? (
            <article className="grid gap-4 rounded-xl border border-border p-6">
              <div className="flex flex-wrap items-center gap-2">
                <code className="font-mono text-sm">{attestation.code}</code>
                {attestation.revokedAt ? (
                  <Badge tone="danger">revoked</Badge>
                ) : (
                  <Badge tone="success">valid</Badge>
                )}
                <Badge tone="outline">
                  {attestation.subjectType === "contribution"
                    ? "individual contribution"
                    : "project outcome"}
                </Badge>
              </div>

              {attestation.subject ? (
                <p className="text-lg font-semibold tracking-tight">
                  {attestation.subject.username ? (
                    <Link
                      href={`/p/${attestation.subject.username}`}
                      className="hover:text-primary"
                    >
                      {attestation.subject.name}
                    </Link>
                  ) : (
                    attestation.subject.name
                  )}
                </p>
              ) : null}

              <blockquote className="border-l-2 border-border-strong pl-4 text-sm whitespace-pre-wrap">
                {attestation.statement}
              </blockquote>

              <p className="text-sm text-fg-muted">
                {attributionLine({
                  attesterName: attestation.attester.name,
                  designation: attestation.attester.facultyProfile?.designation ?? null,
                  collegeName:
                    attestation.attester.memberships[0]?.college.name ?? "their institution",
                  issuedAt: attestation.issuedAt,
                  revokedAt: attestation.revokedAt,
                })}
              </p>

              {attestation.revokedAt ? (
                <Alert tone="warning" title="This attestation has been withdrawn">
                  {attestation.revokedReason ??
                    "The faculty member who issued it has withdrawn it. The record is kept rather than deleted so that a reader who saw the original can find out what happened to it."}
                </Alert>
              ) : null}
            </article>
          ) : null}

          <p className="text-sm text-fg-muted">
            An attestation is one person putting their name to a claim about work they supervised.
            It is never issued automatically, and there is no score that earns one.{" "}
            <Link href="/for-faculty" className="underline underline-offset-4 hover:text-fg">
              How attestation works
            </Link>
            .
          </p>
        </Container>
      </Section>
    </>
  );
}
