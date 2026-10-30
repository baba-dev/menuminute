"use client";

import type { ReactNode } from "react";
import { isInternalAssistantPayload } from "@/modules/intelligence/answer-quality";

/**
 * Strict, text-only Markdown subset. Model content never becomes HTML, active
 * links or event handlers. First-party navigation stays in the route registry.
 */
const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g;
function inline(text: string): ReactNode[] {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}
function cells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|")
    .map((v) => v.trim()).slice(0, 8);
}
function tableDivider(line: string): boolean {
  const parts = cells(line);
  return parts.length > 1 && parts.every((part) => /^:?-{3,}:?$/.test(part));
}
const heading = /^(#{1,3})\s+(.+)$/;
const bullet = /^\s*[-*]\s+(.+)$/;
const number = /^\s*\d+[.)]\s+(.+)$/;
const fence = /^```/;

function renderMarkdown(text: string): ReactNode[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").slice(0, 250);
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!.trim();
    if (!line) { i++; continue; }
    const key = i, match = line.match(heading);
    if (match) {
      const title = inline(match[2]!);
      blocks.push(match[1]!.length === 1
        ? <h3 key={key}>{title}</h3>
        : <h4 key={key}>{title}</h4>);
      i++;
      continue;
    }
    if (fence.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !fence.test(lines[i]!.trim())) code.push(lines[i++]!);
      if (i < lines.length) i++;
      blocks.push(<pre key={key}><code>{code.join("\n")}</code></pre>);
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && tableDivider(lines[i + 1]!)) {
      const headers = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.includes("|") &&
        lines[i]!.trim() && rows.length < 30) {
        rows.push(cells(lines[i++]!));
      }
      blocks.push(
        <div className="mm-ember-table-scroll" role="region" aria-label="Answer table" tabIndex={0} key={key}>
          <table>
            <thead><tr>{headers.map((cell, n) =>
              <th key={n} scope="col">{inline(cell)}</th>)}</tr></thead>
            <tbody>{rows.map((row, n) =>
              <tr key={n}>{headers.map((_, j) =>
                <td key={j}>{inline(row[j] ?? "")}</td>)}</tr>
            )}</tbody>
          </table>
        </div>
      );
      continue;
    }
    if (bullet.test(line) || number.test(line)) {
      const ordered = number.test(line), re = ordered ? number : bullet;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i]!.trim()) && items.length < 40)
        items.push(lines[i++]!.trim().match(re)![1]!);
      const children = items.map((item, n) => <li key={n}>{inline(item)}</li>);
      blocks.push(ordered ? <ol key={key}>{children}</ol> : <ul key={key}>{children}</ul>);
      continue;
    }
    if (line.startsWith("> ")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("> "))
        quote.push(lines[i++]!.trim().slice(2));
      blocks.push(<blockquote key={key}>{inline(quote.join(" "))}</blockquote>);
      continue;
    }
    const paragraph: string[] = [];
    while (i < lines.length && lines[i]!.trim()) {
      const next = lines[i]!.trim();
      if (paragraph.length && (heading.test(next) || fence.test(next) ||
        bullet.test(next) || number.test(next) || next.startsWith("> ") ||
        (next.includes("|") && i + 1 < lines.length && tableDivider(lines[i + 1]!))))
        break;
      paragraph.push(next);
      i++;
    }
    blocks.push(<p key={key}>{inline(paragraph.join(" "))}</p>);
  }
  return blocks;
}

export function EmberRichAnswer({ text }: { text: string | null }) {
  if (!text?.trim() || isInternalAssistantPayload(text))
    return <p role="status">I couldn't prepare a reliable answer to that question. No changes were made. Please ask again.</p>;
  return <div className="mm-ember-rich-answer">{renderMarkdown(text)}</div>;
}
