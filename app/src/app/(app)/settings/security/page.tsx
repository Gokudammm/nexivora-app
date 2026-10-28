import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/display";
import { requireAuth } from "@/lib/auth/guards";
import { listSessions } from "@/lib/auth/session";
import { buildMetadata } from "@/lib/seo/metadata";

import { ChangePasswordForm, SessionList } from "./_components";

export const metadata = buildMetadata({
  title: "Security",
  description:
    "Change your Nexivora password and review every device that is currently signed in to your account.",
  index: false,
  path: "/settings/security",
});

export default async function SecurityPage() {
  const viewer = await requireAuth("/settings/security");
  const sessions = await listSessions(viewer.userId);

  return (
    <div className="grid gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            Changing it signs out every other device. If you are changing it because it may have
            been seen, that is the part that matters.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <ChangePasswordForm />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signed-in devices</CardTitle>
          <CardDescription>
            Anything here can open your account. Revoke what you do not recognise.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <SessionList sessions={sessions} />
        </CardBody>
      </Card>
    </div>
  );
}
