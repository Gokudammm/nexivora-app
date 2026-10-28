import { forbidden } from "next/navigation";

import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/display";
import { Alert } from "@/components/ui/feedback";
import { ImageUpload } from "@/components/ui/image-upload";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestVerification, saveCollege, saveCollegeBranding } from "@/lib/admin/actions";
import { db } from "@/lib/db/client";
import { buildMetadata } from "@/lib/seo/metadata";

import { ResourceForm } from "../_components/resource-form";

import { requireAuth } from "@/lib/auth/guards";
import { administeredCollegeIds } from "@/lib/db/queries/institution";

async function adminCollege() {
  const viewer = await requireAuth("/admin");
  const collegeId = administeredCollegeIds(viewer)[0];
  if (!collegeId) return null;
  return { viewer, collegeId };
}

export const metadata = buildMetadata({
  title: "College profile",
  description:
    "Your college's public details, its email domains, and the verification that decides whether any of it is publicly visible.",
  index: false,
  path: "/admin/college",
});

export default async function CollegeSettingsPage() {
  const context = await adminCollege();
  if (!context) forbidden();

  const college = await db.college.findUnique({ where: { id: context.collegeId } });
  if (!college) forbidden();

  return (
    <div className="grid gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Verification</CardTitle>
          <CardDescription>
            Until this completes, nothing from your college is publicly listed or indexable. It is
            reviewed by a person, which is what makes it mean anything.
          </CardDescription>
        </CardHeader>
        <CardBody className="grid gap-4">
          {college.verification === "VERIFIED" ? (
            <Alert tone="success">
              Verified
              {college.verifiedAt
                ? ` on ${college.verifiedAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
                : ""}
              . Your public pages and sitemap entries are live.
            </Alert>
          ) : college.verification === "PENDING" ? (
            <Alert tone="info">Submitted and waiting for review.</Alert>
          ) : (
            <>
              {college.verification === "REJECTED" ? (
                <Alert tone="warning">
                  The last request was rejected. You can submit again with more detail.
                </Alert>
              ) : null}

              <ResourceForm
                action={requestVerification}
                hidden={{ collegeId: college.id }}
                submitLabel="Request verification"
                fields={[
                  {
                    name: "evidence",
                    label: "Something we can check",
                    required: true,
                    hint: "A registration number, an official domain, or a contact who can confirm you.",
                    placeholder: "AICTE registration 1-234567890, official domain nit.edu.in",
                  },
                ]}
              />
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>What appears on your public college page.</CardDescription>
        </CardHeader>
        <CardBody>
          <ResourceForm
            action={saveCollege}
            hidden={{ collegeId: college.id }}
            submitLabel="Save"
            fields={[
              { name: "name", label: "Full name", required: true, defaultValue: college.name },
              {
                name: "shortName",
                label: "Short name",
                required: true,
                narrow: true,
                defaultValue: college.shortName,
              },
              {
                name: "city",
                label: "City",
                required: true,
                narrow: true,
                defaultValue: college.city,
              },
              {
                name: "state",
                label: "State",
                required: true,
                narrow: true,
                defaultValue: college.state,
              },
              {
                name: "timezone",
                label: "Timezone",
                required: true,
                narrow: true,
                defaultValue: college.timezone,
              },
              { name: "website", label: "Website", defaultValue: college.website ?? "" },
              {
                name: "description",
                label: "Description",
                required: true,
                defaultValue: college.description,
              },
              {
                name: "emailDomains",
                label: "Email domains",
                hint: "Anyone registering on these is associated with your college automatically. This is the trust gate — be careful what you list.",
                defaultValue: college.emailDomains.join(", "),
              },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>
            Your logo and accent colour appear on your college&rsquo;s public page and on every
            project published from it. Both changes are written to the audit log.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <ImageUpload
            action={saveCollegeBranding}
            hidden={{ collegeId: college.id }}
            currentUrl={college.logoUrl}
            name={college.shortName}
            label="Logo"
            hint="Square works best. It is shown as small as 40px, so fine detail will be lost."
            shape="square"
            fileField="logo"
            removeField="removeLogo"
          >
            <Field
              label="Accent colour"
              hint="A six-digit hex colour. Leave blank to use the Nexivora default."
            >
              <Input
                name="accentColor"
                type="text"
                maxLength={7}
                placeholder="#4f46e5"
                pattern="#[0-9a-fA-F]{6}"
                defaultValue={college.accentColor ?? ""}
              />
            </Field>
          </ImageUpload>
        </CardBody>
      </Card>
    </div>
  );
}
