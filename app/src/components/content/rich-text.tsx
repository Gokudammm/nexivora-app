import { Fragment } from "react";

import { Prose } from "@/components/layout/primitives";
import { cn } from "@/lib/utils/cn";

/**
 * Markdown-lite renderer for fixture bodies.
 *
 * Deliberately small: `##`/`###` headings, paragraphs, `-` lists, `1.` ordered
 * lists, blockquotes, pipe tables, `**bold**`, `*italic*`, `` `code` `` and
 * `[text](href)`. That is the whole grammar our content uses.
 *
 * **Why not a markdown library.** Phase 8 renders user-authored project sections
 * through this same surface, and at that point the input is untrusted. A full
 * markdown parser accepts raw HTML by default, which is an XSS hole that has to
 * be closed with a sanitiser anyway. A renderer that only ever produces React
 * elements — and never `dangerouslySetInnerHTML` — cannot inject markup at all.
 * The inline formatter below escapes nothing because it interpolates text as
 * React children, which React escapes by construction.
 *
 * Phase 8 keeps this for rendering and adds Tiptap for authoring.
 */

type Block =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; text: string }
  | { type: "table"; header: string[]; rows: string[][] };

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{2,3})\s+(.*)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1]!.length === 2 ? 2 : 3,
        text: heading[2]!.trim(),
      });
      index += 1;
      continue;
    }

    // Pipe table: a header row, a separator row, then body rows.
    if (line.trim().startsWith("|") && (lines[index + 1] ?? "").includes("---")) {
      const cells = (row: string) =>
        row
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
      const header = cells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && (lines[index] ?? "").trim().startsWith("|")) {
        rows.push(cells(lines[index]!));
        index += 1;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const parts: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index] ?? "")) {
        parts.push((lines[index] ?? "").replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "quote", text: parts.join(" ").trim() });
      continue;
    }

    const bullet = /^[-*]\s+/;
    const numbered = /^\d+\.\s+/;
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const matcher = ordered ? numbered : bullet;
      const items: string[] = [];
      while (index < lines.length && matcher.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(matcher, "").trim());
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const parts: string[] = [];
    while (
      index < lines.length &&
      (lines[index] ?? "").trim() &&
      !/^(#{2,3})\s/.test(lines[index] ?? "") &&
      !bullet.test(lines[index] ?? "") &&
      !numbered.test(lines[index] ?? "") &&
      !/^>\s?/.test(lines[index] ?? "") &&
      !(lines[index] ?? "").trim().startsWith("|")
    ) {
      parts.push((lines[index] ?? "").trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: parts.join(" ") });
  }

  return blocks;
}

/**
 * Inline formatting. Returns React children, never a markup string — which is
 * what makes this safe for untrusted input in Phase 8.
 */
function inline(text: string, keyPrefix = "i"): React.ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const out: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let n = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) out.push(text.slice(cursor, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${n++}`;

    if (token.startsWith("**")) {
      out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      out.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("[")) {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        const href = link[2]!;
        // Only relative and https links are rendered as links. A javascript:
        // URL in user content must never become an anchor.
        const safe = href.startsWith("/") || href.startsWith("https://");
        out.push(
          safe ? (
            <a key={key} href={href}>
              {link[1]}
            </a>
          ) : (
            <Fragment key={key}>{link[1]}</Fragment>
          ),
        );
      } else {
        out.push(token);
      }
    } else {
      out.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    cursor = match.index + token.length;
  }

  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

export function RichText({ body, className }: { body: string; className?: string }) {
  const blocks = parseBlocks(body);

  return (
    <Prose className={className}>
      {blocks.map((block, i) => {
        const key = `b-${i}`;
        switch (block.type) {
          case "heading":
            return block.level === 2 ? (
              <h2 key={key}>{inline(block.text, key)}</h2>
            ) : (
              <h3 key={key}>{inline(block.text, key)}</h3>
            );
          case "list":
            return block.ordered ? (
              <ol key={key}>
                {block.items.map((item, j) => (
                  <li key={`${key}-${j}`}>{inline(item, `${key}-${j}`)}</li>
                ))}
              </ol>
            ) : (
              <ul key={key}>
                {block.items.map((item, j) => (
                  <li key={`${key}-${j}`}>{inline(item, `${key}-${j}`)}</li>
                ))}
              </ul>
            );
          case "quote":
            return <blockquote key={key}>{inline(block.text, key)}</blockquote>;
          case "table":
            return (
              // Wide content scrolls inside its own container so the page body
              // never scrolls horizontally.
              <div key={key} className={cn("my-6 overflow-x-auto rounded-lg border border-border")}>
                <table className="w-full border-collapse text-sm">
                  <thead className="border-b border-border bg-surface-raised">
                    <tr>
                      {block.header.map((cell, j) => (
                        <th
                          key={j}
                          scope="col"
                          className="px-4 py-2.5 text-left font-semibold text-fg-muted"
                        >
                          {inline(cell, `${key}-h-${j}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {block.rows.map((row, j) => (
                      <tr key={j}>
                        {row.map((cell, k) => (
                          <td key={k} className="px-4 py-2.5 align-top">
                            {inline(cell, `${key}-${j}-${k}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return <p key={key}>{inline(block.text, key)}</p>;
        }
      })}
    </Prose>
  );
}
