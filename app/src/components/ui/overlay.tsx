"use client";

import * as RadixAccordion from "@radix-ui/react-accordion";
import * as RadixContextMenu from "@radix-ui/react-context-menu";
import * as RadixDialog from "@radix-ui/react-dialog";
import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import * as RadixPopover from "@radix-ui/react-popover";
import * as RadixTabs from "@radix-ui/react-tabs";
import * as RadixTooltip from "@radix-ui/react-tooltip";

import { CheckIcon, ChevronDownIcon, CloseIcon } from "@/components/icons";
import { cn } from "@/lib/utils/cn";

/**
 * Overlays, on Radix.
 *
 * Radix supplies the behaviour that is genuinely hard and easy to get subtly
 * wrong — focus trapping, focus restoration, escape handling, scroll locking,
 * collision-aware positioning, roving tabindex. We style it once, here, and no
 * feature phase re-implements any of it.
 */

const overlayClass = cn(
  "fixed inset-0 z-[var(--z-overlay)] bg-surface-overlay",
  "data-[state=open]:animate-in data-[state=open]:fade-in-0",
  "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
);

const panelBase = "bg-surface border-border shadow-lg";

/* ----------------------------------------------------------------- Dialog */

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
  size = "md",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const width = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" }[size];
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className={overlayClass} />
      <RadixDialog.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-[var(--z-modal)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2",
          "rounded-xl border p-6",
          "max-h-[calc(100vh-4rem)] overflow-y-auto",
          panelBase,
          width,
          className,
        )}
      >
        <RadixDialog.Title className="font-display text-lg font-semibold">
          {title}
        </RadixDialog.Title>
        {description ? (
          <RadixDialog.Description className="mt-1 text-sm text-fg-muted">
            {description}
          </RadixDialog.Description>
        ) : (
          // Radix warns without a description; this keeps the a11y tree correct
          // without forcing every dialog to carry visible subtitle text.
          <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
        )}

        <div className="mt-4">{children}</div>

        <RadixDialog.Close
          aria-label="Close"
          className="absolute top-4 right-4 grid size-8 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-surface-sunken hover:text-fg focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:outline-none"
        >
          <CloseIcon size={18} />
        </RadixDialog.Close>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

/* ------------------------------------------------------------------ Sheet */

export const Sheet = RadixDialog.Root;
export const SheetTrigger = RadixDialog.Trigger;
export const SheetClose = RadixDialog.Close;

export function SheetContent({
  title,
  description,
  side = "right",
  children,
  className,
}: {
  title: string;
  description?: string;
  side?: "left" | "right";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className={overlayClass} />
      <RadixDialog.Content
        className={cn(
          "fixed inset-y-0 z-[var(--z-modal)] flex w-[min(24rem,90vw)] flex-col border-y-0 p-6",
          side === "right" ? "right-0 border-l" : "left-0 border-r",
          "overflow-y-auto",
          panelBase,
          className,
        )}
      >
        <RadixDialog.Title className="font-display text-lg font-semibold">
          {title}
        </RadixDialog.Title>
        <RadixDialog.Description className={description ? "mt-1 text-sm text-fg-muted" : "sr-only"}>
          {description ?? title}
        </RadixDialog.Description>

        <div className="mt-5 flex-1">{children}</div>

        <RadixDialog.Close
          aria-label="Close"
          className="absolute top-4 right-4 grid size-8 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-surface-sunken hover:text-fg focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:outline-none"
        >
          <CloseIcon size={18} />
        </RadixDialog.Close>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

/* ---------------------------------------------------------------- Popover */

export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;
export const PopoverAnchor = RadixPopover.Anchor;

export function PopoverContent({
  children,
  className,
  align = "center",
  sideOffset = 8,
}: {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
  sideOffset?: number;
}) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          "z-[var(--z-popover)] w-72 rounded-lg border p-4",
          panelBase,
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          className,
        )}
      >
        {children}
      </RadixPopover.Content>
    </RadixPopover.Portal>
  );
}

/* ----------------------------------------------------------- DropdownMenu */

export const DropdownMenu = RadixDropdown.Root;
export const DropdownMenuTrigger = RadixDropdown.Trigger;

const menuItemClass = cn(
  "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none",
  "data-[highlighted]:bg-surface-sunken data-[highlighted]:text-fg",
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
);

export function DropdownMenuContent({
  children,
  className,
  align = "end",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
}) {
  return (
    <RadixDropdown.Portal>
      <RadixDropdown.Content
        align={align}
        sideOffset={6}
        collisionPadding={12}
        className={cn(
          "z-[var(--z-dropdown)] min-w-48 rounded-lg border p-1.5",
          panelBase,
          className,
        )}
      >
        {children}
      </RadixDropdown.Content>
    </RadixDropdown.Portal>
  );
}

export function DropdownMenuItem({
  children,
  className,
  ...props
}: RadixDropdown.DropdownMenuItemProps) {
  return (
    <RadixDropdown.Item className={cn(menuItemClass, className)} {...props}>
      {children}
    </RadixDropdown.Item>
  );
}

export function DropdownMenuCheckboxItem({
  children,
  className,
  ...props
}: RadixDropdown.DropdownMenuCheckboxItemProps) {
  return (
    <RadixDropdown.CheckboxItem className={cn(menuItemClass, "pl-8", className)} {...props}>
      <RadixDropdown.ItemIndicator className="absolute left-2.5">
        <CheckIcon size={14} />
      </RadixDropdown.ItemIndicator>
      {children}
    </RadixDropdown.CheckboxItem>
  );
}

export function DropdownMenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <RadixDropdown.Label className="px-2.5 py-1.5 text-xs font-semibold tracking-wide text-fg-subtle uppercase">
      {children}
    </RadixDropdown.Label>
  );
}

export function DropdownMenuSeparator() {
  return <RadixDropdown.Separator className="my-1.5 h-px bg-border" />;
}

/* ------------------------------------------------------------ ContextMenu */

export const ContextMenu = RadixContextMenu.Root;
export const ContextMenuTrigger = RadixContextMenu.Trigger;

export function ContextMenuContent({ children }: { children: React.ReactNode }) {
  return (
    <RadixContextMenu.Portal>
      <RadixContextMenu.Content
        className={cn("z-[var(--z-dropdown)] min-w-44 rounded-lg border p-1.5", panelBase)}
      >
        {children}
      </RadixContextMenu.Content>
    </RadixContextMenu.Portal>
  );
}

export function ContextMenuItem({ children, ...props }: RadixContextMenu.ContextMenuItemProps) {
  return (
    <RadixContextMenu.Item className={menuItemClass} {...props}>
      {children}
    </RadixContextMenu.Item>
  );
}

/* ---------------------------------------------------------------- Tooltip */

export const TooltipProvider = RadixTooltip.Provider;

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: string;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="z-[var(--z-popover)] max-w-xs rounded-md bg-surface-inverse px-2.5 py-1.5 text-xs text-fg-inverse shadow-md"
        >
          {content}
          <RadixTooltip.Arrow className="fill-surface-inverse" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

/* ------------------------------------------------------------------- Tabs */

export const Tabs = RadixTabs.Root;

export function TabsList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <RadixTabs.List className={cn("flex gap-1 overflow-x-auto border-b border-border", className)}>
      {children}
    </RadixTabs.List>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <RadixTabs.Trigger
      value={value}
      className={cn(
        "relative -mb-px border-b-2 border-transparent px-3.5 py-2.5 text-sm font-medium whitespace-nowrap text-fg-muted",
        "transition-colors duration-[var(--duration-state)]",
        "hover:text-fg",
        "data-[state=active]:border-primary-600 data-[state=active]:text-fg",
        "rounded-t-md focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:outline-none",
      )}
    >
      {children}
    </RadixTabs.Trigger>
  );
}

export function TabsContent({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <RadixTabs.Content value={value} className="focus-visible:outline-none">
      {children}
    </RadixTabs.Content>
  );
}

/* -------------------------------------------------------------- Accordion */

export function Accordion({
  items,
  className,
}: {
  items: { value: string; trigger: string; content: React.ReactNode }[];
  className?: string;
}) {
  return (
    <RadixAccordion.Root
      type="single"
      collapsible
      className={cn("divide-y divide-border", className)}
    >
      {items.map((item) => (
        <RadixAccordion.Item key={item.value} value={item.value}>
          <RadixAccordion.Header>
            <RadixAccordion.Trigger
              className={cn(
                "group flex w-full items-center justify-between gap-4 py-4 text-left text-base font-medium",
                "rounded-md focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:outline-none",
              )}
            >
              {item.trigger}
              <ChevronDownIcon
                size={18}
                className="shrink-0 text-fg-subtle transition-transform duration-[var(--duration-state)] group-data-[state=open]:rotate-180"
              />
            </RadixAccordion.Trigger>
          </RadixAccordion.Header>
          <RadixAccordion.Content className="pb-4 text-sm text-fg-muted">
            {item.content}
          </RadixAccordion.Content>
        </RadixAccordion.Item>
      ))}
    </RadixAccordion.Root>
  );
}
