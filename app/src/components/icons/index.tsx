import type { SVGProps } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * The Nexivora icon set.
 *
 * Inline SVG components on a 24px grid, 1.5px stroke, round caps and joins,
 * drawn with `currentColor`. No icon font, no sprite fetch, no icon library
 * dependency — these are source code we own, so they cost zero requests and
 * theme for free.
 *
 * Every icon is decorative by default (`aria-hidden`). Pass a `title` only when
 * the icon is the sole label for a control, and prefer a real text label.
 */

export type IconProps = SVGProps<SVGSVGElement> & {
  /** Pixel size. Defaults to 20 — the size used beside body text. */
  size?: number;
  /** Renders the icon as meaningful with an accessible name. */
  title?: string;
};

function Icon({
  size = 20,
  title,
  className,
  children,
  ...rest
}: IconProps & { children: React.ReactNode }) {
  const a11y = title
    ? ({ role: "img" as const, "aria-label": title } as const)
    : ({ "aria-hidden": true as const, focusable: "false" as const } as const);

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      {...a11y}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/* ---------------------------------------------------------------- navigation */

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
  </Icon>
);
export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
);
export const MenuIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);
export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
);
export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);
export const ChevronUpIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 15 6-6 6 6" />
  </Icon>
);
export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m15 6-6 6 6 6" />
  </Icon>
);
export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
);
export const ArrowRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12h16" />
    <path d="m14 6 6 6-6 6" />
  </Icon>
);
export const ArrowLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 12H4" />
    <path d="m10 6-6 6 6 6" />
  </Icon>
);
export const ExternalIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 4h6v6" />
    <path d="m20 4-8 8" />
    <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Icon>
);
export const MoreIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </Icon>
);
export const FilterIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 6h16l-6 7v6l-4-2v-4L4 6Z" />
  </Icon>
);
export const SortIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4v16m0 0-3-3m3 3 3-3" />
    <path d="M17 20V4m0 0-3 3m3-3 3 3" />
  </Icon>
);

/* ------------------------------------------------------------------ projects */

export const ProjectIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18" />
    <path d="M7.5 13h5" />
    <path d="M7.5 16.5h9" />
  </Icon>
);
export const LineageIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="5" r="2.2" />
    <circle cx="6" cy="19" r="2.2" />
    <circle cx="18" cy="19" r="2.2" />
    <path d="M12 7.2v3.3a2 2 0 0 1-.6 1.4l-3.9 3.9M12 7.2v3.3a2 2 0 0 0 .6 1.4l3.9 3.9" />
  </Icon>
);
export const ArchiveIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
    <path d="M10 12h4" />
  </Icon>
);
export const IdeaIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 17.5h6" />
    <path d="M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.4.3.5.7.5 1.1v.5h6v-.5c0-.4.1-.8.5-1.1A6 6 0 0 0 12 3Z" />
  </Icon>
);
export const MilestoneIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 21V4" />
    <path d="M6 5h11l-2.2 3.3L17 12H6" />
  </Icon>
);
export const PrototypeIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="12" rx="2" />
    <path d="M8 21h8" />
    <path d="M12 17v4" />
    <path d="m9.5 8.5 2.5 2.5-2.5 2.5" />
    <path d="M14 13.5h1.8" />
  </Icon>
);
export const ResearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 3v5.2a2 2 0 0 1-.3 1L4.4 17a2 2 0 0 0 1.7 3h11.8a2 2 0 0 0 1.7-3l-4.3-7.8a2 2 0 0 1-.3-1V3" />
    <path d="M8 3h8" />
    <path d="M7.5 15h9" />
  </Icon>
);
export const SdgIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17" />
    <path d="M12 3.5c2.2 2.4 3.4 5.4 3.4 8.5s-1.2 6.1-3.4 8.5c-2.2-2.4-3.4-5.4-3.4-8.5S9.8 5.9 12 3.5Z" />
  </Icon>
);
export const CitationIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.5 7.5C8 8.3 7 9.8 7 11.5h2.5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1v-3c0-3 1.6-5.3 4-6.3Z" />
    <path d="M18 7.5c-1.5.8-2.5 2.3-2.5 4H18a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-3c0-3 1.6-5.3 4-6.3Z" />
  </Icon>
);

/* ------------------------------------------------------- groups & the ledger */

export const GroupIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.3a3 3 0 0 1 0 5.4" />
    <path d="M17.5 14.2A5.5 5.5 0 0 1 20.5 19" />
  </Icon>
);
export const LedgerIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
    <path d="M8 16.5v-4" />
    <path d="M12 16.5v-8" />
    <path d="M16 16.5v-6" />
  </Icon>
);
export const TaskIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="m8 12 2.5 2.5L16 9" />
  </Icon>
);
export const BoardIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="5" height="16" rx="1.5" />
    <rect x="9.5" y="4" width="5" height="11" rx="1.5" />
    <rect x="16" y="4" width="5" height="14" rx="1.5" />
  </Icon>
);
export const AttestIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 4.5 6v5.5c0 4.3 3 8.2 7.5 9.5 4.5-1.3 7.5-5.2 7.5-9.5V6L12 3Z" />
    <path d="m8.8 11.8 2.2 2.2 4.2-4.2" />
  </Icon>
);
export const PeerReviewIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5h16v10H9l-5 4V5Z" />
    <path d="m9.5 9.8 1.6 1.6 3.4-3.4" />
  </Icon>
);
export const HealthIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 13h4l2-5 3 9 2.5-6 1.5 2h5" />
  </Icon>
);

/* --------------------------------------------------------- files & documents */

export const FileIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4Z" />
    <path d="M14 3v4h4" />
  </Icon>
);
export const FolderIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 7a1 1 0 0 1 1-1h5l2 2.5h8a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z" />
  </Icon>
);
export const UploadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 16V4" />
    <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
    <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </Icon>
);
export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v12" />
    <path d="m7.5 11.5 4.5 4.5 4.5-4.5" />
    <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </Icon>
);
export const PdfIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4Z" />
    <path d="M14 3v4h4" />
    <path d="M9 16.5c2-.6 3.5-2.2 4.2-4 .3-.8-.7-1.4-1.2-.7-.9 1.4.4 4 3 4.7" />
  </Icon>
);
export const LinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.4 1.4" />
    <path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.4-1.4" />
  </Icon>
);
export const CodeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 8-5 4 5 4" />
    <path d="m15 8 5 4-5 4" />
  </Icon>
);

/* ---------------------------------------------------------- time & calendar */

export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17" />
    <path d="M8 3v4M16 3v4" />
  </Icon>
);
export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7v5.2l3.2 2" />
  </Icon>
);
export const DeadlineIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="13" r="7.5" />
    <path d="M12 9v4.2l2.6 1.6" />
    <path d="m9 2.5 6 0" />
    <path d="m18.8 6.8 1.6-1.6" />
  </Icon>
);
export const MeetingIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="6" width="12" height="12" rx="2" />
    <path d="m15 10 6-3v10l-6-3v-4Z" />
  </Icon>
);

/* ------------------------------------------------------------ feed & social */

export const FeedIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="4" width="17" height="16" rx="2" />
    <path d="M7 8.5h6" />
    <path d="M7 12h10" />
    <path d="M7 15.5h10" />
  </Icon>
);
export const CommentIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5h16v10.5H9.5L4 20V5Z" />
  </Icon>
);
export const InsightfulIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m12 3.5 2.4 5.3 5.6.7-4.2 3.9 1.2 5.6-5-2.9-5 2.9 1.2-5.6L4 9.5l5.6-.7L12 3.5Z" />
  </Icon>
);
export const UsefulIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Z" />
    <path d="M7 11l4-7.5a2 2 0 0 1 3.7 1.3L14 9h4.6a2 2 0 0 1 2 2.5l-1.8 7A2 2 0 0 1 16.8 20H7" />
  </Icon>
);
export const SaveIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" />
  </Icon>
);
export const ShareIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="18" cy="6" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="18" r="2.5" />
    <path d="m8.3 10.8 7.4-3.6M8.3 13.2l7.4 3.6" />
  </Icon>
);
export const FollowIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10" cy="8" r="3.2" />
    <path d="M3.8 20a6.2 6.2 0 0 1 12.4 0" />
    <path d="M18.5 6.5v5M16 9h5" />
  </Icon>
);
export const BellIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 10a6 6 0 0 1 12 0c0 3.2.8 5 1.5 6h-15C5.2 15 6 13.2 6 10Z" />
    <path d="M10 19.5a2.2 2.2 0 0 0 4 0" />
  </Icon>
);

/* -------------------------------------------------------------------- roles */

export const StudentIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m12 4 9 4.5-9 4.5-9-4.5L12 4Z" />
    <path d="M7 11v4.5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V11" />
    <path d="M20.5 9v5" />
  </Icon>
);
export const FacultyIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="12" rx="1.5" />
    <path d="M8 20h8" />
    <path d="M12 16v4" />
    <path d="M7.5 8.5h6M7.5 12h4" />
  </Icon>
);
export const CollegeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 20h18" />
    <path d="M5 20V9.5L12 5l7 4.5V20" />
    <path d="M10 20v-5h4v5" />
    <path d="M9 11h1.5M13.5 11H15" />
  </Icon>
);
export const AlumniIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="3.2" />
    <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="m17.5 3.5 1 2 2 .3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2L14.5 5.8l2-.3 1-2Z" />
  </Icon>
);
export const CompanyIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 20h18" />
    <rect x="4" y="7" width="9" height="13" rx="1" />
    <path d="M13 11h7v9" />
    <path d="M7 10.5h2.5M7 14h2.5M16 14.5h1" />
  </Icon>
);
export const ResearcherIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10.5" cy="10.5" r="5.5" />
    <path d="m14.5 14.5 5 5" />
    <path d="M8.5 10.5h4M10.5 8.5v4" />
  </Icon>
);
export const AdminIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 5 6v5.5c0 4.2 2.8 8 7 9.5 4.2-1.5 7-5.3 7-9.5V6l-7-3Z" />
    <path d="M12 9.5v3M12 15h.01" />
  </Icon>
);
export const UserIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </Icon>
);

/* ---------------------------------------------------------- status feedback */

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Icon>
);
export const CheckCircleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.3 12.2 2.5 2.5 4.9-5" />
  </Icon>
);
export const AlertIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4.5 21 19H3l9-14.5Z" />
    <path d="M12 10v4M12 16.5h.01" />
  </Icon>
);
export const InfoIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11.5v5M12 8h.01" />
  </Icon>
);
export const ErrorIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" />
  </Icon>
);
export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4.5" y="10" width="15" height="10" rx="2" />
    <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
  </Icon>
);
export const EyeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
    <circle cx="12" cy="12" r="2.8" />
  </Icon>
);
export const EyeOffIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 4.5 20 20" />
    <path d="M9.5 9.7a2.8 2.8 0 0 0 3.9 3.9" />
    <path d="M6.5 6.9C4.1 8.5 2.5 12 2.5 12s3.5 6 9.5 6a9.9 9.9 0 0 0 4-.8" />
    <path d="M17.6 15.4c2.2-1.6 3.9-3.4 3.9-3.4S18 6 12 6c-.6 0-1.1 0-1.6.1" />
  </Icon>
);

/* ------------------------------------------------------------------ editing */

export const EditIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="m15 6 3 3" />
  </Icon>
);
export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 6.5h16" />
    <path d="M9 6.5V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6.5 6.5 7.3 20a1 1 0 0 0 1 1h7.4a1 1 0 0 0 1-1l.8-13.5" />
  </Icon>
);
export const CopyIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
    <path d="M15.5 5.5v-1a1 1 0 0 0-1-1H4.5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h1" />
  </Icon>
);
export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
  </Icon>
);
export const LogoutIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 20H5.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1H10" />
    <path d="M15 8.5 18.5 12 15 15.5" />
    <path d="M18.5 12H9" />
  </Icon>
);

/* ------------------------------------------------------------------- theme */

export const SunIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
  </Icon>
);
export const MoonIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
  </Icon>
);
export const SystemIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4.5" width="18" height="12" rx="2" />
    <path d="M8.5 20h7" />
    <path d="M12 16.5V20" />
  </Icon>
);

/* ------------------------------------------------------------------- misc */

export const SparkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m12 3 1.7 4.8L18.5 9.5l-4.8 1.7L12 16l-1.7-4.8L5.5 9.5l4.8-1.7L12 3Z" />
    <path d="m18.5 15.5.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
  </Icon>
);
export const OpportunityIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8.5 7V5.5a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5V7" />
    <path d="M3 12h18" />
    <path d="M11 12v2h2v-2" />
  </Icon>
);
export const EventIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5 14.3 8l5 .7-3.6 3.5.9 5-4.6-2.4L7.4 17l.9-5L4.7 8.7l5-.7L12 3.5Z" />
    <path d="M6 21h12" />
  </Icon>
);
export const MentorIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="3" />
    <path d="M2.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="M15 6.5h6M15 10h4" />
    <path d="M15 13.5h6v6l-2.5-2H15v-4Z" />
  </Icon>
);
export const KnowledgeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z" />
    <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13Z" />
  </Icon>
);
export const AnalyticsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20V4" />
    <path d="M4 20h16" />
    <path d="M8 17v-5M12.5 17V7.5M17 17v-7" />
  </Icon>
);
export const AccreditationIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="9.5" r="5.5" />
    <path d="m9 14.5-1 6.5 4-2 4 2-1-6.5" />
    <path d="m10.3 9.5 1.3 1.3 2.4-2.4" />
  </Icon>
);
export const GlobeIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17" />
    <path d="M12 3.5c2.2 2.4 3.4 5.4 3.4 8.5s-1.2 6.1-3.4 8.5c-2.2-2.4-3.4-5.4-3.4-8.5S9.8 5.9 12 3.5Z" />
  </Icon>
);
export const CommandIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6Z" />
  </Icon>
);
export const DragIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="6" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="15" cy="6" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="9" cy="18" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="15" cy="18" r="1.3" fill="currentColor" stroke="none" />
  </Icon>
);
export const SpinnerIcon = ({ size = 20, className, ...rest }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    aria-hidden
    focusable="false"
    className={cn("shrink-0 animate-spin", className)}
    {...rest}
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export { Icon };
