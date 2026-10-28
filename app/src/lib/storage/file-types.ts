/**
 * FILE TYPE VERIFICATION BY CONTENT.
 *
 * Acceptance criterion 6 of Phase 7: an upload whose bytes disagree with its
 * claimed type is rejected. Not renamed, not quarantined more carefully —
 * rejected, because a file that lies about what it is has no honest use in a
 * coursework workspace.
 *
 * The check is deliberately *not* "does the extension appear in a list". An
 * extension is a suffix on a string the uploader chose. These signatures are
 * the first bytes of the file itself, which the uploader also chose but cannot
 * change without changing what the file actually is.
 *
 * Two categories need care and are handled explicitly below:
 *
 *  · **Text has no magic bytes.** A `.txt`, a `.csv`, a `.md` or a `.py` is
 *    just bytes. We verify it decodes as UTF-8 without control characters
 *    rather than pretending to recognise a signature we cannot.
 *  · **ZIP-container formats share one signature.** `.docx`, `.xlsx`, `.pptx`
 *    and `.zip` all begin `PK\x03\x04`. We accept the family and let the
 *    declared extension pick the label; there is nothing dangerous in the
 *    ambiguity because none of them is ever executed by us.
 */

export type FileKind = "image" | "pdf" | "text" | "archive" | "media" | "other";

export type AllowedType = {
  /** The canonical MIME type we store, whatever the client claimed. */
  mime: string;
  extensions: readonly string[];
  kind: FileKind;
  /** Rendered inline in the preview pane rather than downloaded. */
  previewable: boolean;
};

type Signature = {
  bytes: readonly (number | null)[];
  offset?: number;
  type: AllowedType;
};

const t = (
  mime: string,
  extensions: readonly string[],
  kind: FileKind,
  previewable = false,
): AllowedType => ({ mime, extensions, kind, previewable });

/* ------------------------------------------------------------- signatures */

const PNG = t("image/png", ["png"], "image", true);
const JPEG = t("image/jpeg", ["jpg", "jpeg"], "image", true);
const GIF = t("image/gif", ["gif"], "image", true);
const WEBP = t("image/webp", ["webp"], "image", true);
const PDF = t("application/pdf", ["pdf"], "pdf", true);
const ZIP = t("application/zip", ["zip"], "archive");
const DOCX = t(
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ["docx"],
  "archive",
);
const XLSX = t(
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ["xlsx"],
  "archive",
);
const PPTX = t(
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ["pptx"],
  "archive",
);
const MP4 = t("video/mp4", ["mp4"], "media");
const MP3 = t("audio/mpeg", ["mp3"], "media");

/**
 * SVG is accepted and is the one type with a standing warning attached: it is
 * markup, it can carry script, and it is therefore **never inlined** — the file
 * route serves it with a sandbox CSP and it is rendered through `<img>` only
 * (docs/SECURITY.md §3). Our own illustrations are source code and unaffected.
 */
const SVG = t("image/svg+xml", ["svg"], "image", false);

const TEXT = t("text/plain", ["txt", "md", "csv", "json", "log"], "text", true);
const CODE = t(
  "text/plain",
  [
    "js",
    "ts",
    "tsx",
    "jsx",
    "py",
    "java",
    "c",
    "cpp",
    "h",
    "cs",
    "go",
    "rs",
    "sql",
    "sh",
    "yml",
    "yaml",
    "html",
    "css",
    "ipynb",
  ],
  "text",
  true,
);

/** `null` matches any byte — used for the four-byte size prefix in MP4. */
const SIGNATURES: readonly Signature[] = [
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], type: PNG },
  { bytes: [0xff, 0xd8, 0xff], type: JPEG },
  { bytes: [0x47, 0x49, 0x46, 0x38], type: GIF },
  { bytes: [0x25, 0x50, 0x44, 0x46, 0x2d], type: PDF },
  { bytes: [0x49, 0x44, 0x33], type: MP3 },
  { bytes: [0xff, 0xfb], type: MP3 },
  { bytes: [null, null, null, null, 0x66, 0x74, 0x79, 0x70], type: MP4 },
];

const ZIP_FAMILY: readonly AllowedType[] = [DOCX, XLSX, PPTX, ZIP];

const ALL_TYPES: readonly AllowedType[] = [
  PNG,
  JPEG,
  GIF,
  WEBP,
  PDF,
  SVG,
  ZIP,
  DOCX,
  XLSX,
  PPTX,
  MP4,
  MP3,
  TEXT,
  CODE,
];

export const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set(
  ALL_TYPES.flatMap((type) => type.extensions),
);

/* ---------------------------------------------------------------- detect */

export type Detection =
  { ok: true; type: AllowedType; extension: string } | { ok: false; reason: string };

export function extensionOf(filename: string): string {
  const match = /\.([A-Za-z0-9]+)$/.exec(filename.trim());
  return match ? match[1]!.toLowerCase() : "";
}

function matches(bytes: Uint8Array, signature: Signature): boolean {
  const offset = signature.offset ?? 0;
  if (bytes.length < offset + signature.bytes.length) return false;

  return signature.bytes.every((expected, index) => {
    if (expected === null) return true;
    return bytes[offset + index] === expected;
  });
}

const isZip = (bytes: Uint8Array): boolean =>
  bytes.length >= 4 &&
  bytes[0] === 0x50 &&
  bytes[1] === 0x4b &&
  (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07);

const isWebp = (bytes: Uint8Array): boolean =>
  bytes.length >= 12 &&
  String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
  String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";

/**
 * Bytes that must not appear in something claiming to be text: NUL and the C0
 * control range, minus tab, newline and carriage return. Checked on the raw
 * bytes rather than the decoded string, which is safe precisely because UTF-8
 * never encodes a continuation byte below 0x80 — a C0 byte in the stream is a
 * C0 character, never part of a multi-byte sequence.
 *
 * A binary payload renamed to `.txt` trips this within the first few hundred
 * bytes; a real source file never does.
 */
function hasControlBytes(bytes: Uint8Array): boolean {
  for (const byte of bytes) {
    if (byte === 0x09 || byte === 0x0a || byte === 0x0d) continue;
    if (byte < 0x20 || byte === 0x7f) return true;
  }
  return false;
}

/** Text, verified rather than assumed: valid UTF-8 with no control characters. */
function looksLikeText(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, 4096);
  if (hasControlBytes(sample)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(sample);
    return true;
  } catch {
    return false;
  }
}

/** SVG must parse as text and contain an `<svg` root, not merely claim to. */
function looksLikeSvg(bytes: Uint8Array): boolean {
  if (!looksLikeText(bytes)) return false;
  const head = new TextDecoder().decode(bytes.subarray(0, 1024)).toLowerCase();
  return head.includes("<svg");
}

/**
 * Decide what a file actually is.
 *
 * The declared extension is an *input*, never the answer: it disambiguates
 * within the ZIP family and labels a text file, and it must agree with what the
 * bytes say. Disagreement is a rejection.
 */
export function detectFileType(filename: string, bytes: Uint8Array): Detection {
  const extension = extensionOf(filename);

  if (!extension) return { ok: false, reason: "The file has no extension." };
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return { ok: false, reason: `Files of type .${extension} are not accepted.` };
  }
  if (bytes.length === 0) return { ok: false, reason: "The file is empty." };

  const agree = (type: AllowedType): Detection =>
    type.extensions.includes(extension)
      ? { ok: true, type, extension }
      : {
          ok: false,
          reason: `This file is a ${type.mime}, but it is named .${extension}. Rename it to match its contents.`,
        };

  for (const signature of SIGNATURES) {
    if (matches(bytes, signature)) return agree(signature.type);
  }

  if (isWebp(bytes)) return agree(WEBP);

  if (isZip(bytes)) {
    const declared = ZIP_FAMILY.find((type) => type.extensions.includes(extension));
    return declared
      ? { ok: true, type: declared, extension }
      : { ok: false, reason: `This file is a ZIP archive, but it is named .${extension}.` };
  }

  if (extension === "svg") {
    return looksLikeSvg(bytes)
      ? { ok: true, type: SVG, extension }
      : { ok: false, reason: "This file is named .svg but does not contain an SVG document." };
  }

  const textType = [TEXT, CODE].find((type) => type.extensions.includes(extension));
  if (textType) {
    return looksLikeText(bytes)
      ? { ok: true, type: textType, extension }
      : {
          ok: false,
          reason: `This file is named .${extension} but contains binary data, not text.`,
        };
  }

  return {
    ok: false,
    reason: `The contents of this file do not match any accepted type. It is named .${extension}.`,
  };
}

/** Files served inline. Everything else gets `Content-Disposition: attachment`. */
export function servedInline(mime: string): boolean {
  return ALL_TYPES.some((type) => type.mime === mime && type.previewable);
}

/** The display category, for choosing an icon and a preview component. */
export function kindOf(mime: string): FileKind {
  return ALL_TYPES.find((type) => type.mime === mime)?.kind ?? "other";
}
