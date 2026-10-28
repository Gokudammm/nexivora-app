import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/display";
import { Alert } from "@/components/ui/feedback";
import { requireAuth } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { buildMetadata } from "@/lib/seo/metadata";

import { PrivacyForm } from "./_form";

export const metadata = buildMetadata({
  title: "Privacy",
  description:
    "Choose exactly who can see each part of your Nexivora profile. Everything starts at the most private useful setting.",
  index: false,
  path: "/settings/privacy",
});

export default async function PrivacyPage() {
  const viewer = await requireAuth("/settings/privacy");

  const user = await db.user.findUnique({
    where: { id: viewer.userId },
    select: { username: true, privacy: true },
  });

  if (!user) return null;

  return (
    <div className="grid gap-8">
      <Alert tone="info" title="Private until you say otherwise">
        Nothing here is public unless you turn it on. Under the DPDP Act consent has to be specific
        and opt-in, and that happens to be the right default anyway — a student who discovers their
        roll number was public will not forgive it.
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Who can see your profile</CardTitle>
          <CardDescription>
            This is the outer gate. Individual fields below can only narrow it, never widen it.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <PrivacyForm privacy={user.privacy} username={user.username} />
        </CardBody>
      </Card>
    </div>
  );
}
