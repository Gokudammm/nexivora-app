import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { detectFileType, extensionOf, kindOf, servedInline } from "./file-types";
import { isWorkspaceFileKey, sanitiseFilename, storageKey, workspaceFileKey } from "./provider";

/**
 * Acceptance criterion 6: an upload with a mismatched magic byte is rejected.
 *
 * The interesting cases are all *disagreements* — a file whose bytes say one
 * thing and whose name says another. That is the only shape this check exists
 * to catch, so the happy path here is the small half of the file.
 */

const bytes = (...values: number[]) => new Uint8Array(values);
const utf8 = (text: string) => new TextEncoder().encode(text);

const PNG_HEADER = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13);
const JPEG_HEADER = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46);
const PDF_HEADER = utf8("%PDF-1.7\nstuff");
const ZIP_HEADER = bytes(0x50, 0x4b, 0x03, 0x04, 20, 0, 6, 0);
const GIF_HEADER = utf8("GIF89a");

/* ------------------------------------------------------------- agreement */

describe("detectFileType — bytes and name agree", () => {
  it("accepts a PNG named .png", () => {
    const result = detectFileType("diagram.png", PNG_HEADER);
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.type.mime, "image/png");
  });

  it("accepts a JPEG under either spelling", () => {
    for (const name of ["photo.jpg", "photo.jpeg", "PHOTO.JPG"]) {
      assert.equal(detectFileType(name, JPEG_HEADER).ok, true, name);
    }
  });

  it("accepts a PDF", () => {
    const result = detectFileType("report.pdf", PDF_HEADER);
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.type.kind, "pdf");
  });

  it("accepts the ZIP family and labels it from the extension", () => {
    // .docx, .xlsx, .pptx and .zip are the same container. The extension is the
    // only thing that can tell them apart, and that is fine — none is executed.
    const docx = detectFileType("report.docx", ZIP_HEADER);
    assert.equal(docx.ok, true);
    assert.match(docx.ok ? docx.type.mime : "", /wordprocessingml/);

    assert.equal(detectFileType("data.xlsx", ZIP_HEADER).ok, true);
    assert.equal(detectFileType("source.zip", ZIP_HEADER).ok, true);
  });

  it("accepts text and source files, which have no signature to check", () => {
    assert.equal(detectFileType("notes.md", utf8("# Notes\n\nSome prose.")).ok, true);
    assert.equal(detectFileType("train.py", utf8("import torch\n\nprint('hi')\n")).ok, true);
    assert.equal(detectFileType("readings.csv", utf8("t,moisture\n1,42\n")).ok, true);
  });

  it("accepts UTF-8 text that is not ASCII", () => {
    assert.equal(detectFileType("notes.txt", utf8("मृदा नमी सेंसर · 42%\n")).ok, true);
  });

  it("accepts an SVG that actually contains an SVG document", () => {
    const svg = utf8('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>');
    assert.equal(detectFileType("chart.svg", svg).ok, true);
  });
});

/* ---------------------------------------------------------- disagreement */

describe("detectFileType — the bytes win", () => {
  it("rejects a PNG renamed to .pdf", () => {
    const result = detectFileType("totally-a-report.pdf", PNG_HEADER);
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.reason, /image\/png.*named \.pdf/);
  });

  it("rejects an executable renamed to .png", () => {
    // MZ header — a Windows PE. The extension list would have waved this
    // through; the first two bytes do not.
    const result = detectFileType("kitten.png", bytes(0x4d, 0x5a, 0x90, 0x00, 0x03));
    assert.equal(result.ok, false);
  });

  it("rejects binary content renamed to .txt", () => {
    const result = detectFileType("notes.txt", bytes(0x00, 0x01, 0x02, 0x03, 0xff, 0xfe));
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.reason, /binary data, not text/);
  });

  it("rejects invalid UTF-8 renamed to .md", () => {
    // A lone continuation byte: never valid UTF-8, and not caught by a control
    // byte scan either, which is why the decoder runs as well.
    const result = detectFileType("readme.md", bytes(0x48, 0x69, 0x80, 0x80));
    assert.equal(result.ok, false);
  });

  it("rejects a ZIP renamed to .png", () => {
    const result = detectFileType("image.png", ZIP_HEADER);
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.reason, /ZIP archive/);
  });

  it("rejects an HTML page renamed to .svg", () => {
    const result = detectFileType("chart.svg", utf8("<html><body>hello</body></html>"));
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.reason, /does not contain an SVG document/);
  });

  it("rejects a GIF renamed to .jpg", () => {
    assert.equal(detectFileType("photo.jpg", GIF_HEADER).ok, false);
  });
});

/* ------------------------------------------------------------- the gates */

describe("detectFileType — the outer gates", () => {
  it("rejects an extension that is not on the list, whatever the bytes say", () => {
    const result = detectFileType("setup.exe", bytes(0x4d, 0x5a));
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.reason, /\.exe are not accepted/);
  });

  it("rejects a double extension by reading only the last one", () => {
    // `report.pdf.exe` is the classic. `extensionOf` takes the final segment,
    // so this is an .exe and is refused — which is the point of not searching
    // the name for a known extension anywhere in it.
    assert.equal(extensionOf("report.pdf.exe"), "exe");
    assert.equal(detectFileType("report.pdf.exe", PDF_HEADER).ok, false);
  });

  it("rejects a file with no extension", () => {
    assert.equal(detectFileType("Makefile", utf8("all:\n\techo hi\n")).ok, false);
  });

  it("rejects an empty file", () => {
    assert.equal(detectFileType("empty.png", new Uint8Array()).ok, false);
  });
});

/* ------------------------------------------------------------- disposition */

describe("servedInline", () => {
  it("previews images, PDFs and text", () => {
    assert.equal(servedInline("image/png"), true);
    assert.equal(servedInline("application/pdf"), true);
    assert.equal(servedInline("text/plain"), true);
  });

  it("never previews SVG — it is markup and can carry script", () => {
    // docs/SECURITY.md §3. An uploaded SVG is downloaded or rendered through
    // <img>, never inlined into one of our documents.
    assert.equal(servedInline("image/svg+xml"), false);
  });

  it("never previews an archive or a video", () => {
    assert.equal(servedInline("application/zip"), false);
    assert.equal(servedInline("video/mp4"), false);
  });

  it("classifies a mime type for the file list icon", () => {
    assert.equal(kindOf("image/png"), "image");
    assert.equal(kindOf("application/pdf"), "pdf");
    assert.equal(kindOf("application/x-unknown"), "other");
  });
});

/* ------------------------------------------------------------------ names */

describe("sanitiseFilename", () => {
  it("keeps an ordinary name unchanged", () => {
    assert.equal(sanitiseFilename("Soil moisture report v2.pdf"), "Soil moisture report v2.pdf");
  });

  it("strips a path, in either separator", () => {
    assert.equal(sanitiseFilename("../../etc/passwd"), "passwd");
    assert.equal(sanitiseFilename("C:\\Users\\dell\\report.pdf"), "report.pdf");
  });

  it("strips quotes, which would otherwise break Content-Disposition", () => {
    assert.equal(sanitiseFilename('re"port".pdf'), "report.pdf");
  });

  it("never returns a dotfile or an empty string", () => {
    assert.equal(sanitiseFilename("....."), "file");
    assert.equal(sanitiseFilename("   "), "file");
    assert.equal(sanitiseFilename(".bashrc"), "bashrc");
  });

  it("caps the length", () => {
    assert.ok(sanitiseFilename(`${"a".repeat(400)}.pdf`).length <= 120);
  });
});

describe("storageKey", () => {
  it("never contains the uploaded filename", () => {
    const key = storageKey("groups", "grp_123", "pdf");
    assert.match(key, /^groups\/grp_123\/[0-9a-f]{32}\.pdf$/);
  });

  it("is unguessable — two calls never collide", () => {
    const keys = new Set(Array.from({ length: 500 }, () => storageKey("groups", "g", "png")));
    assert.equal(keys.size, 500);
  });

  it("strips anything that could shape a path out of the scope id", () => {
    assert.equal(storageKey("groups", "../../etc", "png").startsWith("groups/etc/"), true);
    assert.equal(storageKey("gro/ups", "g", "p/ng").startsWith("groups/g/"), true);
  });
});

describe("workspaceFileKey", () => {
  it("binds a direct-upload key to its group and uploader", () => {
    const key = workspaceFileKey("grp_123", "usr_456", "pdf");

    assert.equal(isWorkspaceFileKey(key, "grp_123", "usr_456", "pdf"), true);
    assert.equal(isWorkspaceFileKey(key, "grp_123", "usr_789", "pdf"), false);
    assert.equal(isWorkspaceFileKey(key, "grp_999", "usr_456", "pdf"), false);
    assert.equal(isWorkspaceFileKey(key, "grp_123", "usr_456", "png"), false);
  });

  it("rejects path-shaped and malformed keys", () => {
    assert.equal(isWorkspaceFileKey("groups/../../secret/file.pdf", "g", "u", "pdf"), false);
    assert.equal(isWorkspaceFileKey("groups/g_u/not-random.pdf", "g", "u", "pdf"), false);
  });
});
