import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const blogRoot = path.join(root, "src", "content", "blog");
const postExtensions = new Set([".md", ".mdx"]);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(entryPath)));
    } else if (postExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }
  return files;
}

function slugFor(filePath) {
  const relative = path.relative(blogRoot, filePath).replaceAll("\\", "/");
  return relative.replace(/\.mdx?$/, "");
}

// Astro treats the leading `---` block as YAML frontmatter, so every edit here
// is scoped to that block to avoid touching `draft` in the post body.
function splitFrontmatter(source) {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = source.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    return null;
  }
  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---"
  );
  if (closingIndex === -1) {
    return null;
  }
  return { lines, closingIndex, newline };
}

function readDraft(source) {
  const parsed = splitFrontmatter(source);
  if (!parsed) {
    return null;
  }
  for (let index = 1; index < parsed.closingIndex; index += 1) {
    const match = /^draft:\s*(true|false)\s*$/.exec(parsed.lines[index]);
    if (match) {
      return match[1] === "true";
    }
  }
  return false;
}

function applyDraft(source, draft) {
  const parsed = splitFrontmatter(source);
  if (!parsed) {
    throw new Error("post is missing a frontmatter block");
  }
  const { lines, closingIndex, newline } = parsed;
  for (let index = 1; index < closingIndex; index += 1) {
    if (/^draft:\s*/.test(lines[index])) {
      lines[index] = `draft: ${draft}`;
      return lines.join(newline);
    }
  }
  lines.splice(closingIndex, 0, `draft: ${draft}`);
  return lines.join(newline);
}

function withTrailingNewline(source, updated) {
  return source.endsWith("\n") && !updated.endsWith("\n")
    ? `${updated}${source.endsWith("\r\n") ? "\r\n" : "\n"}`
    : updated;
}

function readPubDate(source) {
  const parsed = splitFrontmatter(source);
  if (!parsed) {
    return null;
  }
  for (let index = 1; index < parsed.closingIndex; index += 1) {
    const match = /^pubDate:\s*"?'?(\d{4}-\d{2}-\d{2})/.exec(
      parsed.lines[index]
    );
    if (match) {
      return match[1];
    }
  }
  return null;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/set-draft.mjs --list",
    "  node scripts/set-draft.mjs --slug <post-slug> --draft <true|false>",
    "  node scripts/set-draft.mjs --publish-due [--today <YYYY-MM-DD>]",
  ].join("\n");
}

function parseArguments(argv) {
  const options = {
    list: false,
    publishDue: false,
    slug: undefined,
    draft: undefined,
    today: undefined,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--list") {
      options.list = true;
    } else if (argument === "--publish-due") {
      options.publishDue = true;
    } else if (argument === "--slug") {
      options.slug = argv[(index += 1)];
    } else if (argument === "--draft") {
      options.draft = argv[(index += 1)];
    } else if (argument === "--today") {
      options.today = argv[(index += 1)];
    } else {
      throw new Error(`unknown argument: ${argument}\n\n${usage()}`);
    }
  }
  return options;
}

async function loadPosts() {
  const files = await walk(blogRoot);
  const posts = await Promise.all(
    files.map(async filePath => {
      const source = await readFile(filePath, "utf8");
      return {
        filePath,
        slug: slugFor(filePath),
        draft: readDraft(source),
        pubDate: readPubDate(source),
        source,
      };
    })
  );
  return posts.sort((a, b) => a.slug.localeCompare(b.slug));
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const posts = await loadPosts();

  if (options.list) {
    for (const post of posts) {
      const state =
        post.draft === null ? "unknown" : post.draft ? "draft" : "live";
      console.log(
        `${state.padEnd(7)} ${post.pubDate ?? "??????????"} ${post.slug}`
      );
    }
    return;
  }

  // Dates are compared as plain YYYY-MM-DD strings so a post publishes on its
  // stated date regardless of the runner's timezone.
  if (options.publishDue) {
    const today = options.today ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
      throw new Error(`--today must be YYYY-MM-DD, received "${today}"`);
    }
    const due = posts.filter(
      post => post.draft === true && post.pubDate && post.pubDate <= today
    );
    if (due.length === 0) {
      console.log(`No drafts are due as of ${today}.`);
      return;
    }
    for (const post of due) {
      const updated = applyDraft(post.source, false);
      await writeFile(
        post.filePath,
        withTrailingNewline(post.source, updated),
        "utf8"
      );
      console.log(`Published ${post.slug} (pubDate ${post.pubDate}).`);
    }
    return;
  }

  if (
    !options.slug ||
    (options.draft !== "true" && options.draft !== "false")
  ) {
    throw new Error(usage());
  }

  const slug = options.slug.trim().replace(/\.mdx?$/, "");
  const post = posts.find(candidate => candidate.slug === slug);
  if (!post) {
    const known = posts.map(candidate => `  ${candidate.slug}`).join("\n");
    throw new Error(`no post matches slug "${slug}". Known slugs:\n${known}`);
  }

  const draft = options.draft === "true";
  if (post.draft === draft) {
    console.log(
      `No change: ${post.slug} is already ${draft ? "a draft" : "live"}.`
    );
    return;
  }

  const updated = applyDraft(post.source, draft);
  await writeFile(
    post.filePath,
    withTrailingNewline(post.source, updated),
    "utf8"
  );
  console.log(`Set draft: ${draft} on ${post.slug}.`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
