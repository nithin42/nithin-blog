// Shared blog-post parsing helpers for the local / CI content generators
// (`scripts/generate-hero.mjs`, `scripts/generate-figures.mjs`).
//
// These read `src/content/blog/*.{md,mdx}` directly rather than going through
// Astro's content collections, because the generators run outside a build.

import { readdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const BLOG_DIR = path.join(ROOT, "src/content/blog");

export async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export function parseFrontmatter(raw) {
  const clean = raw.replace(/^\uFEFF/, '').trimStart();
  const match = clean.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const body = match[1];

  const titleMatch = body.match(/^title:\s*(.+)$/m);
  const title = titleMatch
    ? titleMatch[1].trim().replace(/^['"]|['"]$/g, "")
    : "";

  const descMatch = body.match(/^description:\s*(.+)$/m);
  const description = descMatch
    ? descMatch[1].trim().replace(/^['"]|['"]$/g, "")
    : "";

  const tagsBlock = body.match(/^tags:\s*([\s\S]*?)(?=^\w|\Z)/m);
  const tags = tagsBlock
    ? [...tagsBlock[1].matchAll(/["']([^"']+)["']/g)].map(m => m[1])
    : [];

  return {
    title,
    description,
    tags,
    hasHero: /^heroImage:\s*\S/m.test(body),
    draft: /^draft:\s*true\s*$/m.test(body),
  };
}

// Strip frontmatter, imports, JSX tags and code fences to get readable prose
// for a model to reason about.
export function extractBody(raw) {
  return raw
    .replace(/^---\n[\s\S]*?\n---\n?/, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^import .*$/gm, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function resolvePostPath(slug) {
  for (const ext of [".mdx", ".md"]) {
    const p = path.join(BLOG_DIR, `${slug}${ext}`);
    if (await exists(p)) return p;
  }
  return null;
}

export async function listPosts() {
  const files = await readdir(BLOG_DIR);
  return files
    .filter(f => f.endsWith(".mdx") || f.endsWith(".md"))
    .map(f => f.replace(/\.mdx?$/, ""));
}

// Classify every line of a post so callers never insert markup inside a fenced
// code block or in the middle of a multi-line JSX component. JSX tracking only
// considers components written at column 0 (the convention in this repo's
// posts), which is exactly where it matters for safe insertion.
const FENCE_RE = /^(?:```|~~~)/;
const JSX_OPEN_RE = /^<([A-Z][A-Za-z0-9]*)\b/;
const JSX_CLOSE_RE = /^<\/([A-Z][A-Za-z0-9]*)>/;

export function scanLines(lines) {
  const info = [];
  let inFence = false;
  let depth = 0;
  // Set while a component's opening tag is still spread over several lines,
  // e.g. `<Screenshot`, `  src={x}`, `/>`.
  let pendingTag = null;

  for (const line of lines) {
    if (FENCE_RE.test(line)) {
      // The fence line itself belongs to the block it opens or closes.
      info.push({ inFence: true, jsxDepth: depth });
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      info.push({ inFence: true, jsxDepth: depth });
      continue;
    }

    const text = line.trimEnd();

    if (pendingTag) {
      info.push({ inFence: false, jsxDepth: depth + 1 });
      if (text.endsWith("/>")) {
        pendingTag = null;
      } else if (text.endsWith(">")) {
        pendingTag = null;
        depth += 1;
      }
      continue;
    }

    const close = text.match(JSX_CLOSE_RE);
    if (close) {
      depth = Math.max(0, depth - 1);
      info.push({ inFence: false, jsxDepth: depth });
      continue;
    }

    const open = text.match(JSX_OPEN_RE);
    if (!open) {
      info.push({ inFence: false, jsxDepth: depth });
      continue;
    }

    if (text.includes(`</${open[1]}>`) || text.endsWith("/>")) {
      // Opened and closed on this one line.
      info.push({ inFence: false, jsxDepth: depth });
    } else if (text.endsWith(">")) {
      info.push({ inFence: false, jsxDepth: depth });
      depth += 1;
    } else {
      pendingTag = open[1];
      info.push({ inFence: false, jsxDepth: depth + 1 });
    }
  }

  return info;
}

// Split a post body into heading-anchored sections. Headings inside fenced code
// blocks are ignored. `startLine` is the heading line itself; `endLine` is the
// last line before the next heading (inclusive). `eol` is the file's dominant
// line ending, so callers can rejoin without mangling CRLF files.
export function splitSections(raw) {
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = raw.split(/\r?\n/);
  const info = scanLines(lines);
  const sections = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (info[i].inFence) continue;
    const match = lines[i].match(/^(#{2,4})\s+(.+?)\s*$/);
    if (!match) continue;
    if (sections.length > 0) sections[sections.length - 1].endLine = i - 1;
    sections.push({
      level: match[1].length,
      heading: match[2].trim(),
      startLine: i,
      endLine: lines.length - 1,
    });
  }

  for (const section of sections) {
    section.body = lines
      .slice(section.startLine + 1, section.endLine + 1)
      .join("\n");
  }

  return { lines, info, sections, eol };
}
