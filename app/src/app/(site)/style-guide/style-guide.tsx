"use client";

import { useState } from "react";

import { Logo } from "@/components/Logo";
import * as Icons from "@/components/icons";
import {
  ArchiveScene,
  CollaborationScene,
  EmptyFeedScene,
  EmptyWorkspaceScene,
  HeroGraphic,
  NoResultsScene,
  NotFoundScene,
  ServerErrorScene,
  SuccessScene,
} from "@/components/illustrations";
import { GeneratedAvatar, GeneratedProjectCover } from "@/components/illustrations/generated";
import { useCommandPalette } from "@/components/layout/command-palette";
import { Container, PageHeader, Prose } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Combobox, CopyButton } from "@/components/ui/combobox";
import {
  Avatar,
  AvatarGroup,
  Badge,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Chip,
  Divider,
  Kbd,
  StatusPill,
  TierBadge,
  type ProjectStatus,
} from "@/components/ui/display";
import {
  Alert,
  CardSkeleton,
  EmptyState,
  ErrorState,
  Progress,
  ProgressRing,
  Skeleton,
  Spinner,
} from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import {
  Checkbox,
  DatePicker,
  Input,
  RadioGroup,
  Select,
  Slider,
  Switch,
  Textarea,
} from "@/components/ui/input";
import { Breadcrumbs, Pagination, Stepper, Timeline } from "@/components/ui/navigation";
import {
  Accordion,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  Dialog,
  DialogContent,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Sheet,
  SheetContent,
  SheetTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
} from "@/components/ui/overlay";
import { Table, type Column } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

/* -------------------------------------------------------------------------- */

function Block({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 py-10">
      <h2 className="border-b border-border pb-2 font-display text-xl font-bold md:text-2xl">
        {title}
      </h2>
      {note ? <p className="mt-2 max-w-2xl text-sm text-fg-muted">{note}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 border-b border-border py-4 last:border-b-0 sm:grid-cols-[10rem_1fr] sm:items-center">
      <p className="font-mono text-xs text-fg-subtle">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

const SECTIONS = [
  ["brand", "Brand"],
  ["colour", "Colour"],
  ["type", "Typography"],
  ["icons", "Icons"],
  ["illustrations", "Illustrations"],
  ["generated", "Generated imagery"],
  ["buttons", "Buttons"],
  ["forms", "Forms"],
  ["display", "Display"],
  ["proof", "Status & proof"],
  ["overlays", "Overlays"],
  ["navigation", "Navigation"],
  ["data", "Data"],
  ["states", "Empty, loading & error"],
  ["a11y", "Accessibility"],
] as const;

const STATUSES: ProjectStatus[] = [
  "draft",
  "proposed",
  "approved",
  "progress",
  "review",
  "completed",
  "archived",
];

const SWATCHES = [
  ["surface", "bg-surface border border-border", "text-fg"],
  ["surface-raised", "bg-surface-raised", "text-fg"],
  ["surface-sunken", "bg-surface-sunken", "text-fg"],
  ["primary-fill", "bg-primary-fill", "text-fg-on-primary"],
  ["accent-fill", "bg-accent-fill", "text-fg-on-accent"],
  [
    "highlight-fill",
    "bg-highlight-fill border border-highlight-fill-border",
    "text-fg-on-highlight",
  ],
  ["success", "bg-success", "text-success-fg"],
  ["warning", "bg-warning", "text-warning-fg"],
  ["danger", "bg-danger", "text-danger-fg"],
  ["info", "bg-info", "text-info-fg"],
  ["surface-inverse", "bg-surface-inverse", "text-fg-inverse"],
  ["fg-muted", "bg-surface border border-border", "text-fg-muted"],
] as const;

const DOMAINS = [
  ["ai", "AI/ML"],
  ["software", "Software"],
  ["hardware", "Hardware"],
  ["healthcare", "Healthcare"],
  ["education", "Education"],
  ["sustainability", "Sustainability"],
  ["social", "Social impact"],
  ["research", "Research"],
] as const;

type LedgerRow = { member: string; tasks: number; files: number; share: number };

const LEDGER: LedgerRow[] = [
  { member: "Ananya Sharma", tasks: 18, files: 12, share: 34 },
  { member: "Rohit Verma", tasks: 14, files: 9, share: 27 },
  { member: "Priya Nair", tasks: 12, files: 11, share: 25 },
  { member: "Karan Mehta", tasks: 4, files: 2, share: 9 },
  { member: "Zoya Khan", tasks: 2, files: 1, share: 5 },
];

const LEDGER_COLUMNS: Column<LedgerRow>[] = [
  { key: "member", header: "Member", cell: (r) => r.member, sortValue: (r) => r.member },
  {
    key: "tasks",
    header: "Tasks closed",
    cell: (r) => r.tasks,
    sortValue: (r) => r.tasks,
    align: "right",
  },
  {
    key: "files",
    header: "Files",
    cell: (r) => r.files,
    sortValue: (r) => r.files,
    align: "right",
  },
  {
    key: "share",
    header: "Share",
    align: "right",
    sortValue: (r) => r.share,
    cell: (r) => <span className="font-mono tabular-nums">{r.share}%</span>,
  },
];

/* -------------------------------------------------------------------------- */

export function StyleGuide() {
  const { toast } = useToast();
  const { setOpen } = useCommandPalette();
  const [combo, setCombo] = useState("ai-ml");
  const [page, setPage] = useState(3);

  return (
    <div>
      <Container className="py-12">
        <PageHeader
          eyebrow="Design system"
          title="Style guide"
          description="Every component, every variant, every state — in both themes. This page is the reference and the regression test. A component that is not here does not exist."
        />

        <nav aria-label="Style guide sections" className="mt-8 flex flex-wrap gap-2">
          {SECTIONS.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-full border border-border px-3 py-1 text-sm text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* ------------------------------------------------------------ brand */}
        <Block
          id="brand"
          title="Brand"
          note="One component renders every variant. The mark is checked at 16px because that is the size a browser tab actually uses."
        >
          <Row label="lockup">
            <Logo variant="lockup" size="sm" />
            <Logo variant="lockup" size="md" />
            <Logo variant="lockup" size="lg" />
          </Row>
          <Row label="stacked">
            <Logo variant="stacked" size="sm" />
            <Logo variant="stacked" size="md" />
          </Row>
          <Row label="mark">
            <Logo variant="mark" size="sm" />
            <Logo variant="mark" size="md" />
            <Logo variant="mark" size="lg" />
          </Row>
          <Row label="16px check">
            <span className="inline-flex items-center gap-2 rounded border border-border px-2 py-1">
              <Logo variant="mark" size="sm" className="size-4" />
              <span className="text-xs text-fg-muted">favicon size — must stay legible</span>
            </span>
          </Row>
          <Row label="mono / reversed">
            <Logo variant="lockup" size="md" mono />
            <span className="rounded-md bg-surface-inverse px-4 py-2 text-fg-inverse">
              <Logo variant="lockup" size="md" reversed />
            </span>
          </Row>
        </Block>

        {/* ----------------------------------------------------------- colour */}
        <Block
          id="colour"
          title="Colour"
          note="Every pairing here is measured by scripts/check-contrast.mjs and fails npm run check below WCAG AA. Filled controls use the *-fill tokens, never a ramp step (ADR-015)."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {SWATCHES.map(([name, bg, fg]) => (
              <div key={name} className={`${bg} ${fg} rounded-lg px-4 py-6 text-sm font-medium`}>
                {name}
              </div>
            ))}
          </div>

          <h3 className="mt-8 mb-3 text-sm font-semibold">Domain set (8, contrast-checked)</h3>
          <div className="flex flex-wrap gap-2">
            {DOMAINS.map(([key, label]) => (
              <span
                key={key}
                className="rounded-full border border-border px-3 py-1 text-sm font-medium"
                style={{ color: `var(--color-domain-${key})` }}
              >
                {label}
              </span>
            ))}
          </div>
        </Block>

        {/* ------------------------------------------------------------- type */}
        <Block id="type" title="Typography" note="Three families. No fourth.">
          <div className="space-y-3">
            <p className="font-display text-5xl font-bold">Display 5xl — Plus Jakarta Sans</p>
            <p className="font-display text-3xl font-bold">Display 3xl</p>
            <p className="text-xl">Body xl — Inter</p>
            <p className="text-base">
              Body base — the quick brown fox jumps over the lazy dog. Body copy caps at 68ch so a
              line never becomes hard to track back from.
            </p>
            <p className="text-sm text-fg-muted">Body sm muted</p>
            <p className="text-xs text-fg-subtle">Body xs subtle</p>
            <p className="font-mono text-sm">Mono — NXV-NIT-2026-7Q4KX2</p>
          </div>

          <Divider className="my-8" label="Prose" />
          <Prose>
            <h2>A heading inside Prose</h2>
            <p>
              Prose styles descendants directly, because it wraps rendered rich text where we do not
              control the element classes. It is what Phase 8&rsquo;s project sections render into.
            </p>
            <ul>
              <li>Lists get spacing that reads properly</li>
              <li>
                Links are <a href="#type">underlined by default</a>
              </li>
            </ul>
          </Prose>
        </Block>

        {/* ------------------------------------------------------------ icons */}
        <Block
          id="icons"
          title="Icons"
          note="Inline SVG components on a 24px grid, 1.5px stroke, currentColor. No icon font, no sprite, no library dependency."
        >
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-8">
            {Object.entries(Icons)
              .filter(([name]) => name.endsWith("Icon") && name !== "Icon")
              .map(([name, Cmp]) => {
                const IconCmp = Cmp as React.ComponentType<{ size?: number }>;
                return (
                  <div
                    key={name}
                    className="flex flex-col items-center gap-2 rounded-md border border-border p-3"
                  >
                    <IconCmp size={22} />
                    <span className="text-center font-mono text-[0.625rem] break-all text-fg-subtle">
                      {name.replace(/Icon$/, "")}
                    </span>
                  </div>
                );
              })}
          </div>
        </Block>

        {/* ---------------------------------------------------- illustrations */}
        <Block
          id="illustrations"
          title="Illustrations"
          note="Geometric and structural, built from the logo's visual language. Abstract rather than figurative — it ages better and never has to depict a person of a particular appearance."
        >
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["Empty workspace", <EmptyWorkspaceScene key="w" width={200} />],
                ["Empty feed", <EmptyFeedScene key="f" width={200} />],
                ["No results", <NoResultsScene key="n" width={200} />],
                ["Collaboration", <CollaborationScene key="c" width={200} />],
                ["Archive", <ArchiveScene key="a" width={200} />],
                ["404", <NotFoundScene key="4" width={200} />],
                ["500", <ServerErrorScene key="5" width={200} />],
                ["Success", <SuccessScene key="s" width={200} />],
              ] as const
            ).map(([label, node]) => (
              <div key={label} className="grid gap-2 rounded-lg border border-border p-4">
                {node}
                <p className="text-center text-xs text-fg-subtle">{label}</p>
              </div>
            ))}
          </div>

          <h3 className="mt-8 mb-3 text-sm font-semibold">Hero graphic</h3>
          <div className="max-w-xl rounded-lg border border-border p-6">
            <HeroGraphic />
          </div>
        </Block>

        {/* -------------------------------------------------------- generated */}
        <Block
          id="generated"
          title="Generated imagery"
          note="Deterministic from a seed. This is why every user has a real avatar and every project a real cover with zero upload effort — the difference between seed data that looks alive and seed data that looks like a wireframe."
        >
          <Row label="avatars">
            {[
              "u_ananya",
              "u_rohit",
              "u_priya",
              "u_karan",
              "u_zoya",
              "u_dev",
              "u_meera",
              "u_arjun",
            ].map((seed) => (
              <GeneratedAvatar key={seed} seed={seed} size={44} />
            ))}
          </Row>
          <h3 className="mt-6 mb-3 text-sm font-semibold">Project covers</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <GeneratedProjectCover
              seed="smart-irrigation"
              title="Smart irrigation using soil moisture sensors"
              domain="sustainability"
              sdgs={[6, 2, 13]}
            />
            <GeneratedProjectCover
              seed="triage-model"
              title="Triage prioritisation model"
              domain="healthcare"
              sdgs={[3]}
            />
            <GeneratedProjectCover
              seed="campus-mesh"
              title="Campus mesh network"
              domain="hardware"
            />
          </div>
        </Block>

        {/* ---------------------------------------------------------- buttons */}
        <Block
          id="buttons"
          title="Buttons"
          note="Every state defined once, here. No call site re-implements them."
        >
          <Row label="variants">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="accent">Accent</Button>
            <Button variant="highlight">Highlight</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="link">Link</Button>
          </Row>
          <Row label="sizes">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </Row>
          <Row label="states">
            <Button disabled>Disabled</Button>
            <Button loading>Loading</Button>
            <Button variant="outline" loading>
              Saving
            </Button>
          </Row>
          <Row label="icon">
            <Button iconOnly aria-label="Add">
              <Icons.PlusIcon />
            </Button>
            <Button iconOnly variant="outline" aria-label="Settings">
              <Icons.SettingsIcon />
            </Button>
            <Button>
              <Icons.UploadIcon size={16} />
              With icon
            </Button>
          </Row>
          <Row label="full width">
            <div className="w-full max-w-sm">
              <Button fullWidth>Full width</Button>
            </div>
          </Row>
        </Block>

        {/* ------------------------------------------------------------ forms */}
        <Block
          id="forms"
          title="Forms"
          note="Every control lives inside a Field, which owns the label, hint, error and the aria-describedby wiring. A bare control outside a Field is a review failure."
        >
          <div className="grid max-w-xl gap-5">
            <Field label="Project title" hint="Specific beats clever. This becomes the public URL.">
              <Input placeholder="Smart irrigation using soil moisture sensors" />
            </Field>

            <Field label="Email" error="That address is already registered." required>
              <Input
                type="email"
                defaultValue="ananya@nit.ac.in"
                leadingIcon={<Icons.UserIcon size={16} />}
              />
            </Field>

            <Field label="Problem statement" hint="What is actually wrong, and for whom?">
              <Textarea placeholder="Describe the problem this project addresses…" />
            </Field>

            <Field label="Department">
              <Select defaultValue="cse">
                <option value="cse">Computer Science &amp; Engineering</option>
                <option value="ece">Electronics &amp; Communication</option>
                <option value="mech">Mechanical Engineering</option>
              </Select>
            </Field>

            <Field label="Domain" hint="Searchable — type to filter.">
              <Combobox
                value={combo}
                onChange={setCombo}
                options={[
                  {
                    value: "ai-ml",
                    label: "AI / Machine learning",
                    description: "Models, data, inference",
                  },
                  {
                    value: "iot",
                    label: "IoT & embedded",
                    description: "Sensors, devices, firmware",
                  },
                  { value: "health", label: "Healthcare", description: "Clinical and diagnostic" },
                  {
                    value: "sustain",
                    label: "Sustainability",
                    description: "Energy, water, climate",
                  },
                ]}
              />
            </Field>

            <Field label="Target completion">
              <DatePicker />
            </Field>

            <Field label="Disabled">
              <Input placeholder="Not editable" disabled />
            </Field>

            <Divider label="Choice" />

            <Checkbox
              label="Make this project public when approved"
              description="Public projects are indexable and become part of the permanent archive."
              defaultChecked
            />

            <RadioGroup
              defaultValue="college"
              options={[
                { value: "private", label: "Private", description: "Only the group can see it" },
                { value: "college", label: "College", description: "Anyone at your college" },
                { value: "public", label: "Public", description: "Anyone, indexable" },
              ]}
            />

            <Switch
              label="Email digest"
              description="A weekly summary instead of individual notifications."
              defaultChecked
            />

            <Field label="Contribution weight" hint="Used by the ledger scoring in Phase 7.">
              <Slider defaultValue={[60]} max={100} step={5} />
            </Field>
          </div>
        </Block>

        {/* ---------------------------------------------------------- display */}
        <Block id="display" title="Display">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Smart irrigation</CardTitle>
                <CardDescription>
                  Soil-moisture driven water control for campus grounds
                </CardDescription>
              </CardHeader>
              <CardBody>
                <p className="text-sm text-fg-muted">
                  Card, CardHeader, CardTitle, CardDescription, CardBody and CardFooter compose —
                  rather than one Card with twenty props.
                </p>
              </CardBody>
              <CardFooter>
                <Button size="sm">Open</Button>
                <Button size="sm" variant="ghost">
                  Save
                </Button>
              </CardFooter>
            </Card>

            <Card interactive className="p-5">
              <p className="text-sm font-medium">Interactive card</p>
              <p className="mt-1 text-sm text-fg-muted">
                Lifts on hover. Used for anything clickable.
              </p>
            </Card>
          </div>

          <Row label="badges">
            <Badge>Neutral</Badge>
            <Badge tone="primary">Primary</Badge>
            <Badge tone="accent">Accent</Badge>
            <Badge tone="success">Success</Badge>
            <Badge tone="warning">Warning</Badge>
            <Badge tone="danger">Danger</Badge>
            <Badge tone="info">Info</Badge>
            <Badge tone="outline">Outline</Badge>
          </Row>

          <Row label="chips">
            <Chip label="Python" />
            <Chip label="TensorFlow" onRemove={() => undefined} />
            <Chip label="Arduino" onRemove={() => undefined} />
          </Row>

          <Row label="avatars">
            <Avatar name="Ananya Sharma" seed="u_ananya" size="xs" />
            <Avatar name="Ananya Sharma" seed="u_ananya" size="sm" />
            <Avatar name="Ananya Sharma" seed="u_ananya" size="md" />
            <Avatar name="Dr Meera Rao" seed="u_meera" size="lg" verified />
            <AvatarGroup
              people={[
                { name: "Ananya", seed: "u_ananya" },
                { name: "Rohit", seed: "u_rohit" },
                { name: "Priya", seed: "u_priya" },
                { name: "Karan", seed: "u_karan" },
                { name: "Zoya", seed: "u_zoya" },
                { name: "Dev", seed: "u_dev" },
              ]}
            />
          </Row>

          <Row label="misc">
            <Kbd>⌘K</Kbd>
            <Kbd>Esc</Kbd>
            <CopyButton value="NXV-NIT-2026-7Q4KX2" label="Copy citation ID" />
          </Row>
        </Block>

        {/* ------------------------------------------------------------ proof */}
        <Block
          id="proof"
          title="Status & proof"
          note="The tier badges are load-bearing (Phase 12). They must be distinguishable at a glance AND in greyscale, because they appear on printed portfolio PDFs — so each differs by icon and fill, not by colour alone."
        >
          <Row label="project status">
            {STATUSES.map((status) => (
              <StatusPill key={status} status={status} />
            ))}
          </Row>
          <Row label="proof tiers">
            <TierBadge tier="self" />
            <TierBadge tier="evidenced" />
            <TierBadge tier="attested" attestedBy="Dr Meera Rao" />
          </Row>
          <Row label="greyscale check">
            <span className="flex flex-wrap items-center gap-3 grayscale">
              <TierBadge tier="self" />
              <TierBadge tier="evidenced" />
              <TierBadge tier="attested" attestedBy="Dr Meera Rao" />
            </span>
          </Row>
        </Block>

        {/* --------------------------------------------------------- overlays */}
        <Block
          id="overlays"
          title="Overlays"
          note="On Radix, which supplies the behaviour that is genuinely hard: focus trapping and restoration, escape handling, scroll locking, collision-aware positioning."
        >
          <Row label="dialog / sheet">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open dialog</Button>
              </DialogTrigger>
              <DialogContent
                title="Submit for review"
                description="This locks editing until faculty respond."
              >
                <p className="text-sm text-fg-muted">
                  Focus is trapped, Escape closes, and focus returns to the trigger on close.
                </p>
                <div className="mt-5 flex gap-3">
                  <Button size="sm">Submit</Button>
                  <Button size="sm" variant="ghost">
                    Cancel
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Open sheet</Button>
              </SheetTrigger>
              <SheetContent title="Filters" description="Narrow the project list">
                <p className="text-sm text-fg-muted">
                  Used for filter panels and mobile navigation.
                </p>
              </SheetContent>
            </Sheet>
          </Row>

          <Row label="menus">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Dropdown <Icons.ChevronDownIcon size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem>
                  <Icons.EditIcon size={16} /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Icons.ShareIcon size={16} /> Share
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Icons.TrashIcon size={16} /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">Popover</Button>
              </PopoverTrigger>
              <PopoverContent>
                <p className="text-sm font-medium">Contribution share</p>
                <p className="mt-1 text-sm text-fg-muted">
                  Computed from the ledger. Every figure links to its evidence.
                </p>
              </PopoverContent>
            </Popover>

            <Tooltip content="Tooltips carry a label the icon alone cannot">
              <Button variant="ghost" iconOnly aria-label="Help">
                <Icons.InfoIcon />
              </Button>
            </Tooltip>

            <ContextMenu>
              <ContextMenuTrigger asChild>
                <span className="rounded-md border border-dashed border-border px-4 py-2 text-sm">
                  Right-click me
                </span>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem>
                  <Icons.EditIcon size={16} /> Rename
                </ContextMenuItem>
                <ContextMenuItem>
                  <Icons.CopyIcon size={16} /> Duplicate
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </Row>

          <Row label="toast / palette">
            <Button
              variant="outline"
              onClick={() =>
                toast({
                  title: "Milestone closed",
                  description: "Peer review is now open.",
                  tone: "success",
                })
              }
            >
              Success toast
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast({
                  title: "Upload failed",
                  description: "The file type is not allowed.",
                  tone: "error",
                  action: { label: "Retry", onClick: () => undefined },
                })
              }
            >
              Error toast
            </Button>
            <Button variant="outline" onClick={() => setOpen(true)}>
              Open command palette <Kbd>⌘K</Kbd>
            </Button>
          </Row>

          <h3 className="mt-8 mb-3 text-sm font-semibold">Tabs</h3>
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="ledger">Ledger</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <p className="py-4 text-sm text-fg-muted">Roving tabindex, arrow-key navigation.</p>
            </TabsContent>
            <TabsContent value="ledger">
              <p className="py-4 text-sm text-fg-muted">
                The contribution ledger lives here in Phase 7.
              </p>
            </TabsContent>
            <TabsContent value="files">
              <p className="py-4 text-sm text-fg-muted">Versioned file library.</p>
            </TabsContent>
          </Tabs>

          <h3 className="mt-8 mb-3 text-sm font-semibold">Accordion</h3>
          <Accordion
            items={[
              {
                value: "a",
                trigger: "What is the contribution ledger?",
                content:
                  "An automatic, append-only record of who did what inside a group workspace, written in the same transaction as the work itself.",
              },
              {
                value: "b",
                trigger: "Who can see it?",
                content:
                  "Every member of the group, and the faculty who supervise it. Transparency is the design — a hidden ledger is surveillance.",
              },
            ]}
          />
        </Block>

        {/* ------------------------------------------------------- navigation */}
        <Block
          id="navigation"
          title="Navigation"
          note="Breadcrumbs emit their own BreadcrumbList JSON-LD so a page cannot render a trail and forget the markup. Pagination renders real anchors, because a button-based pager is invisible to a crawler."
        >
          <Row label="breadcrumbs">
            <Breadcrumbs
              crumbs={[
                { label: "Explore", href: "/explore" },
                { label: "Sustainability", href: "/topics/sustainability" },
                { label: "Smart irrigation", href: "/projects/smart-irrigation" },
              ]}
            />
          </Row>

          <h3 className="mt-6 mb-3 text-sm font-semibold">Pagination</h3>
          <Pagination page={page} totalPages={12} hrefFor={(p) => `#page-${p}`} />
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Simulate previous
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.min(12, p + 1))}>
              Simulate next
            </Button>
          </div>

          <h3 className="mt-8 mb-3 text-sm font-semibold">Stepper</h3>
          <Stepper
            current={2}
            steps={[
              { label: "Proposal", description: "Submitted" },
              { label: "Approved", description: "By faculty" },
              { label: "In progress", description: "Milestones running" },
              { label: "Review" },
              { label: "Archived" },
            ]}
          />

          <h3 className="mt-8 mb-3 text-sm font-semibold">Timeline</h3>
          <Timeline
            entries={[
              { title: "Project archived", meta: "12 May", tone: "muted" },
              { title: "Attested by Dr Meera Rao", meta: "08 May", tone: "accent" },
              { title: "Milestone 3 closed", meta: "02 May" },
              { title: "Prototype uploaded", meta: "24 Apr" },
            ]}
          />
        </Block>

        {/* ------------------------------------------------------------- data */}
        <Block
          id="data"
          title="Data"
          note="Sortable, sticky-headed, and below md each row becomes a definition list. The card fallback is not a nicety — a wide table on a phone either overflows the page or shrinks below legibility."
        >
          <Table
            caption="Contribution ledger for the demo group"
            columns={LEDGER_COLUMNS}
            rows={LEDGER}
            rowKey={(row) => row.member}
          />
          <p className="mt-3 text-sm text-fg-subtle">
            Resize below <code className="font-mono">768px</code> to see the card fallback.
          </p>

          <h3 className="mt-8 mb-3 text-sm font-semibold">Progress</h3>
          <div className="flex flex-wrap items-center gap-8">
            <div className="w-64">
              <Progress value={68} label="Project completion" showValue />
            </div>
            <ProgressRing value={68} label="Completion" />
            <ProgressRing value={24} size={56} />
          </div>
        </Block>

        {/* ----------------------------------------------------------- states */}
        <Block
          id="states"
          title="Empty, loading & error"
          note="Every data view ships all three. An empty state without an action is a dead end, so `action` is a required prop, not an optional one."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <EmptyState
              illustration={<EmptyWorkspaceScene width={200} />}
              title="No tasks yet"
              description="Add the first task and the board starts working. Everything the group closes here feeds the contribution ledger."
              action={<Button size="sm">Add a task</Button>}
              secondaryAction={
                <Button size="sm" variant="ghost">
                  Import from a template
                </Button>
              }
            />
            <ErrorState onRetry={() => undefined} />
          </div>

          <h3 className="mt-8 mb-3 text-sm font-semibold">Loading</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <CardSkeleton />
            <div className="space-y-3">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="flex items-center">
              <Spinner label="Loading projects" />
            </div>
          </div>

          <h3 className="mt-8 mb-3 text-sm font-semibold">Alerts</h3>
          <div className="grid gap-3">
            <Alert tone="info" title="Similarity check">
              This problem statement is 87% similar to an archived project. That is not a block — a
              project that builds on previous work should look similar.
            </Alert>
            <Alert tone="warning" title="Milestone at risk">
              Two members have no ledger activity in 14 days.
            </Alert>
            <Alert tone="danger" title="Upload rejected">
              The file&rsquo;s content does not match its extension.
            </Alert>
            <Alert tone="success" title="Attestation issued">
              Dr Meera Rao attested Ananya&rsquo;s contribution to the classification model.
            </Alert>
          </div>
        </Block>

        {/* ------------------------------------------------------------- a11y */}
        <Block id="a11y" title="Accessibility" note="The floor, not the ceiling. WCAG 2.1 AA.">
          <ul className="grid max-w-2xl gap-2 text-sm text-fg-muted">
            <li>
              <strong className="text-fg">Contrast is measured, not eyeballed.</strong>{" "}
              <code className="font-mono">npm run check</code> fails on any pair below AA, in both
              themes. Three real failures were caught this way in Phase 0.
            </li>
            <li>
              <strong className="text-fg">Focus rings are never removed.</strong> Tab through this
              page — every interactive element shows a visible ring on a token colour that clears
              3:1 against every surface.
            </li>
            <li>
              <strong className="text-fg">Every control is inside a Field</strong>, so its label,
              hint and error are programmatically associated.
            </li>
            <li>
              <strong className="text-fg">Errors are announced</strong> via{" "}
              <code className="font-mono">aria-live</code>, associated with their field, and never
              signalled by colour alone.
            </li>
            <li>
              <strong className="text-fg">Touch targets are 44&times;44 minimum</strong>, which is
              why the md and lg icon buttons are not smaller than they look like they could be.
            </li>
            <li>
              <strong className="text-fg">prefers-reduced-motion</strong> collapses durations to
              0.01ms rather than removing transitions, so transitionend callbacks still fire.
            </li>
            <li>
              <strong className="text-fg">The skip link</strong> is the first focusable element on
              every page — press Tab from the top of this page.
            </li>
            <li className="text-fg-subtle">
              Not yet done, and not claimed: the axe pass, the screen-reader pass and the keyboard
              audit are Phase 16. Contrast is verified; the rest is not, and the accessibility
              statement will not claim conformance before then.
            </li>
          </ul>
        </Block>
      </Container>
    </div>
  );
}
