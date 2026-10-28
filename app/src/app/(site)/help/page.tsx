import type { Metadata } from "next";
import Link from "next/link";

import { AdminIcon, FacultyIcon, GroupIcon, StudentIcon } from "@/components/icons";
import { Container, PageHeader } from "@/components/layout/primitives";
import { Card } from "@/components/ui/display";
import { Breadcrumbs } from "@/components/ui/navigation";
import { helpArticles } from "@/content/site";
import type { HelpArticle } from "@/content/types";
import { JsonLd, breadcrumbList, itemList } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Help centre",
  description:
    "How to use Nexivora — creating a group, understanding the contribution ledger, project visibility and embargo, publishing, and setting up your college.",
  path: "/help",
});

const AUDIENCES: { key: HelpArticle["audience"]; label: string; icon: React.ReactNode }[] = [
  { key: "everyone", label: "Everyone", icon: <GroupIcon size={20} /> },
  { key: "student", label: "Students", icon: <StudentIcon size={20} /> },
  { key: "faculty", label: "Faculty", icon: <FacultyIcon size={20} /> },
  { key: "admin", label: "Administrators", icon: <AdminIcon size={20} /> },
];

export default function HelpPage() {
  const crumbs = [{ label: "Help", href: "/help" }];

  return (
    <>
      <JsonLd
        data={[
          itemList(
            helpArticles.map((h) => ({ name: h.title, url: `/help/${h.slug}` })),
            { name: "Nexivora help centre" },
          ),
          breadcrumbList(crumbs),
        ]}
      />
      <Container className="py-10 md:py-12">
        <Breadcrumbs crumbs={crumbs} className="mb-6" />
        <PageHeader
          eyebrow="Help"
          title="How Nexivora works"
          description="Short, specific guides. If something here is wrong or missing, tell us — we treat documentation gaps as defects."
        />

        <div className="mt-10 space-y-10">
          {AUDIENCES.map((audience) => {
            const items = helpArticles.filter((h) => h.audience === audience.key);
            if (items.length === 0) return null;
            return (
              <section key={audience.key}>
                <h2 className="flex items-center gap-2.5 border-b border-border pb-2 font-display text-xl font-bold">
                  <span className="text-fg-subtle">{audience.icon}</span>
                  {audience.label}
                </h2>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {items.map((item) => (
                    <Card key={item.slug} interactive className="relative p-5">
                      <h3 className="font-display text-base leading-snug font-semibold">
                        <Link href={`/help/${item.slug}`} className="after:absolute after:inset-0">
                          {item.title}
                        </Link>
                      </h3>
                      <p className="mt-2 text-sm text-fg-muted">{item.description}</p>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </Container>
    </>
  );
}
