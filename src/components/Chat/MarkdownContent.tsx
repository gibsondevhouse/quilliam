"use client";

import React from "react";

/**
 * Lightweight markdown renderer for chat messages.
 * Handles the subset Ollama models commonly produce:
 *   - Fenced code blocks (```)
 *   - ATX headers (# / ## / ### / ####)
 *   - Unordered lists (- / * / +)
 *   - Ordered lists (1. / 2.)
 *   - Horizontal rules (--- / ***)
 *   - Blank-line-separated paragraphs
 *   - Inline: **bold**, *italic*, `code`
 */

// ---------------------------------------------------------------------------
// Inline-level formatting
// ---------------------------------------------------------------------------

function renderInline(raw: string, key: string | number): React.ReactNode {
  // Split on bold, italic, and inline-code delimiters, preserving them
  const parts = raw.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return (
    <React.Fragment key={key}>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return <code key={i} className="md-code-inline">{part.slice(1, -1)}</code>;
        }
        return part;
      })}
    </React.Fragment>
  );
}

// ---------------------------------------------------------------------------
// Block-level parsing
// ---------------------------------------------------------------------------

type Block =
  | { kind: "h1" | "h2" | "h3" | "h4"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "hr" }
  | { kind: "code"; lang: string; text: string }
  | { kind: "p"; text: string };

function parseBlocks(md: string): Block[] {
  const lines = md.split("\n");
  const blocks: Block[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trimStart().startsWith("```")) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ kind: "code", lang, text: codeLines.join("\n") });
      continue;
    }

    // ATX headers
    const hMatch = line.match(/^(#{1,4})\s+(.*)/);
    if (hMatch) {
      const level = hMatch[1].length as 1 | 2 | 3 | 4;
      blocks.push({
        kind: (`h${level}` as "h1" | "h2" | "h3" | "h4"),
        text: hMatch[2].trim(),
      });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push({ kind: "hr" });
      i++;
      continue;
    }

    // Unordered list — collect consecutive list items
    if (/^[\s]*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\s]*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[\s]*[-*+]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    // Ordered list
    if (/^[\s]*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\s]*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[\s]*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    // Blank line — skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph — collect until blank line or block element
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,4}\s/.test(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) &&
      !/^[\s]*[-*+]\s+/.test(lines[i]) &&
      !/^[\s]*\d+\.\s+/.test(lines[i]) &&
      !lines[i].trimStart().startsWith("```")
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ kind: "p", text: paraLines.join(" ") });
    }
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface MarkdownContentProps {
  children: string;
  className?: string;
  /** When true, shows a blinking cursor at the end (streaming) */
  streaming?: boolean;
}

export function MarkdownContent({ children, className, streaming }: MarkdownContentProps) {
  const blocks = parseBlocks(children);

  const renderBlock = (block: Block, idx: number): React.ReactNode => {
    switch (block.kind) {
      case "h1":
        return <h1 key={idx} className="md-h1">{renderInline(block.text, 0)}</h1>;
      case "h2":
        return <h2 key={idx} className="md-h2">{renderInline(block.text, 0)}</h2>;
      case "h3":
        return <h3 key={idx} className="md-h3">{renderInline(block.text, 0)}</h3>;
      case "h4":
        return <h4 key={idx} className="md-h4">{renderInline(block.text, 0)}</h4>;
      case "hr":
        return <hr key={idx} className="md-hr" />;
      case "code":
        return (
          <pre key={idx} className="md-pre">
            <code className={block.lang ? `language-${block.lang}` : ""}>{block.text}</code>
          </pre>
        );
      case "ul":
        return (
          <ul key={idx} className="md-ul">
            {block.items.map((item, j) => (
              <li key={j}>{renderInline(item, j)}</li>
            ))}
          </ul>
        );
      case "ol":
        return (
          <ol key={idx} className="md-ol">
            {block.items.map((item, j) => (
              <li key={j}>{renderInline(item, j)}</li>
            ))}
          </ol>
        );
      case "p":
        return <p key={idx} className="md-p">{renderInline(block.text, 0)}</p>;
    }
  };

  return (
    <div className={["md-prose", className].filter(Boolean).join(" ")}>
      {blocks.map(renderBlock)}
      {streaming && <span className="chat-cursor" />}
    </div>
  );
}
