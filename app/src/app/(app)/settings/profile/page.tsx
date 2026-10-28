import Link from "next/link";

import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/display";
import { Alert, Progress } from "@/components/ui/feedback";
import { requireAuth } from "@/lib/auth/guards";
import { getOwnProfile, profileCompleteness } from "@/lib/db/queries/profile";
import { usernameIsChangeable, usernameLockDate } from "@/config/reserved-usernames";
import { buildMetadata } from "@/lib/seo/metadata";

import { ImageUpload } from "@/components/ui/image-upload";
import { saveAvatar } from "@/lib/profile/actions";

import { BasicsForm, LinksForm, RoleForm, SkillsForm, UsernameForm } from "./_forms";

export const metadata = buildMetadata({
  title: "Your profile",
  description:
    "Edit how you appear on Nexivora — your headline, bio, links, skills and the details specific to your role.",
  index: false,
  path: "/settings/profile",
});

export default async function ProfileSettingsPage() {
  const viewer = await requireAuth("/settings/profile");
  const profile = await getOwnProfile(viewer.userId);

  if (!profile) return null;

  const completeness = profileCompleteness(profile);
  const lockDate = profile.usernameLockedAt ?? usernameLockDate(profile.createdAt);
  const changeable = usernameIsChangeable(lockDate);

  const role = profile.memberships[0]?.role ?? "STUDENT";

  return (
    <div className="grid gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Profile completeness</CardTitle>
          <CardDescription>
            {completeness.percent}% — and the specific next thing, rather than just a number.
          </CardDescription>
        </CardHeader>
        <CardBody className="grid gap-3">
          <Progress value={completeness.percent} />
          {completeness.next ? (
            <p className="text-sm">
              <strong>Next:</strong> {completeness.next.label}
            </p>
          ) : (
            <p className="text-sm text-fg-muted">Nothing left — your profile is complete.</p>
          )}
          <p className="text-sm text-fg-muted">
            Your profile is only as visible as you have chosen.{" "}
            <Link href="/settings/privacy" className="underline underline-offset-4">
              Check your privacy settings
            </Link>
            .
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your photo</CardTitle>
          <CardDescription>
            Optional. Without one you get a generated mark derived from your name — never a grey
            silhouette.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <ImageUpload
            action={saveAvatar}
            currentUrl={profile.avatarUrl}
            name={profile.name}
            label="Avatar"
            hint="Shown beside your name across the product, including on public project pages."
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About you</CardTitle>
        </CardHeader>
        <CardBody>
          <BasicsForm profile={profile} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your username</CardTitle>
          <CardDescription>
            {changeable
              ? `This is your public link. It becomes fixed on ${lockDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}, because other people cite it.`
              : "Fixed. Your public link is cited and shared, so it stops changing after the first thirty days."}
          </CardDescription>
        </CardHeader>
        <CardBody>
          {changeable ? (
            <UsernameForm username={profile.username} />
          ) : (
            <Alert tone="info">
              You are <code>/p/{profile.username}</code>. If this is genuinely wrong, an
              administrator can change it.
            </Alert>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skills</CardTitle>
          <CardDescription>
            Claim what you know. As you finish projects, the ones your work backs up are promoted to
            evidenced automatically — and the difference is shown on your profile.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <SkillsForm skills={profile.skills} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Links</CardTitle>
          <CardDescription>A repository, a site, a paper — up to eight.</CardDescription>
        </CardHeader>
        <CardBody>
          <LinksForm links={profile.links} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {role === "FACULTY" ? "Teaching" : role === "ALUMNI" ? "Since graduating" : "Studying"}
          </CardTitle>
        </CardHeader>
        <CardBody>
          <RoleForm role={role} profile={profile} />
        </CardBody>
      </Card>
    </div>
  );
}
