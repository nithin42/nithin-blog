// Generate explanatory in-article figures for blog posts.
//
// This is the companion to `scripts/generate-hero.mjs`. Where the hero
// generator makes ONE decorative image per post, this reads a post section by
// section, asks a chat model which sections genuinely need a picture to be
// understandable by readers of every experience level, generates a labeled
// concept diagram for each of those, and writes the `<Figure>` markup into the
// post's MDX.
//
// It uses the SAME Azure OpenAI endpoint, deployments, and Entra ID auth as the
// hero generator (see `scripts/lib/azure-openai.mjs`).
//
// Usage:
//   npm run figures -- <slug>                 analyze one post and generate its figures
//   npm run figures -- <slug1> <slug2>        several posts in one run
//   npm run figures -- <slug> --dry-run       print the plan + prompts, generate nothing
//   npm run figures -- <slug> --force         regenerate figures that already exist
//   npm run figures -- --all                  every published post
//   npm run figures -- --all --include-drafts ...including drafts
//   npm run figures -- <slug> --max 2         cap figures per post (default 3)
//
// This is a LOCAL / CI generator — never run it at page-build time. It calls a
// paid image API, is non-deterministic, and needs Entra ID auth. Generate once,
// review the result, and commit the .webp files with the post.
//
// Configuration (via .env locally, or environment variables in CI):
//   AZURE_OPENAI_ENDPOINT          https://<resource>.openai.azure.com
//   AZURE_OPENAI_IMAGE_DEPLOYMENT  deployment name for a gpt-image-1 model
//   AZURE_OPENAI_CHAT_DEPLOYMENT   REQUIRED here — the chat model is what decides
//                                  which sections warrant a figure
//   AZURE_OPENAI_API_VERSION       optional, defaults to 2025-04-01-preview

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  fail,
  loadConfig,
  requestChatJson,
  requestImage,
  readImageBase64,
} from "./lib/azure-openai.mjs";
import {
  ROOT,
  exists,
  parseFrontmatter,
  resolvePostPath,
  listPosts,
  splitSections,
} from "./lib/posts.mjs";

const DEFAULT_MAX_FIGURES = 3;
const MAX_SECTION_CHARS = 900;
const MAX_ANALYSIS_CHARS = 14000;

// --- Section analysis ---------------------------------------------------------

// Readable prose for one section: no fenced code, no JSX, no markdown noise.
function sectionProse(body) {
  return body
    .replace(/```[\s\S]*?```/g, " [code block] ")
    .replace(/~~~[\s\S]*?~~~/g, " [code block] ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// A section already carrying an image does not need a generated one.
function hasExistingImage(body) {
  return /<Figure\b|<Screenshot\b|<Image\b|!\[[^\]]*\]\(/.test(body);
}

const ANALYSIS_SYSTEM = [
  "You are a technical editor for a Microsoft cloud engineering blog. You decide where an article",
  "genuinely needs an explanatory diagram so that readers of EVERY experience level can follow it.",
  "",
  "Respond with ONLY a JSON object of the form:",
  '{"figures":[{"heading":"<exact heading text>","name":"<kebab-case-name>","concept":"<what the reader must understand>","depiction":"<what the diagram should show: the specific boxes, actors, arrows, steps, boundaries, and short labels>","alt":"<one sentence describing the diagram for a screen reader>","caption":"<one short sentence placed under the figure>"}]}',
  "",
  "Propose a figure ONLY when a picture does work that prose cannot, for example:",
  "- a multi-hop trust, token, or authentication chain",
  "- an architecture or integration topology with several components and the traffic between them",
  "- a sequence of steps or a state machine where ordering or branching is the point",
  "- a permission, network, or tenant boundary that determines what is and is not allowed",
  "- a comparison or decision between approaches with distinct tradeoffs",
  "- a data or event pipeline where something is transformed at each stage",
  "",
  "Do NOT propose a figure for: opinion, narrative, or background sections; a plain list of commands,",
  "settings, or prerequisites; anything a short code block already shows clearly; a section whose only",
  "value would be decoration. It is correct and expected to return an EMPTY figures array for posts",
  "that do not need diagrams. Never pad the list to reach a limit.",
  "",
  '"heading" MUST be copied character for character from the supplied section list. "name" is 2-4',
  'kebab-case words, unique within the response. "depiction" is 25-60 words and must be concrete: name',
  "the actual components, actors, and labels from THIS article, not generic shapes. Use the article's",
  "real product names. No markdown, no code fences, no commentary outside the JSON.",
].join("\n");

async function planFigures({ slug, fm, sections, cfg, max }) {
  const candidates = sections.filter(
    s => !hasExistingImage(s.body) && sectionProse(s.body).length > 200
  );
  if (candidates.length === 0) return [];

  let outline = "";
  for (const s of candidates) {
    const prose = sectionProse(s.body).slice(0, MAX_SECTION_CHARS);
    const entry = `\n### ${s.heading}\n${prose}\n`;
    if (outline.length + entry.length > MAX_ANALYSIS_CHARS) break;
    outline += entry;
  }

  const user = [
    `Article title: ${fm.title}`,
    `Summary: ${fm.description}`,
    `Tags: ${fm.tags.join(", ") || "(none)"}`,
    `Return at most ${max} figures.`,
    "",
    "Sections available for a figure (use these exact heading strings):",
    outline,
  ].join("\n");

  const parsed = await requestChatJson({
    cfg,
    system: ANALYSIS_SYSTEM,
    user,
    temperature: 0.3,
    maxTokens: 1200,
  });
  if (!parsed) {
    console.warn(`  ! could not analyze "${slug}" — skipping.`);
    return null;
  }

  const raw = Array.isArray(parsed) ? parsed : parsed.figures;
  if (!Array.isArray(raw)) return [];

  const byHeading = new Map(candidates.map(s => [normalize(s.heading), s]));
  const seenNames = new Set();
  const figures = [];

  for (const item of raw) {
    if (figures.length >= max) break;
    const section = byHeading.get(normalize(String(item?.heading ?? "")));
    if (!section) {
      console.warn(
        `  ! model proposed a figure for an unknown section "${item?.heading}" — ignoring.`
      );
      continue;
    }
    if (figures.some(f => f.section === section)) continue;

    const name = slugify(item?.name) || `figure-${figures.length + 1}`;
    if (seenNames.has(name)) continue;
    seenNames.add(name);

    const alt = sanitizeText(item?.alt);
    if (!alt) {
      console.warn(
        `  ! model returned no alt text for "${section.heading}" — ignoring (alt text is required).`
      );
      continue;
    }

    figures.push({
      section,
      name,
      concept: sanitizeText(item?.concept),
      depiction: sanitizeText(item?.depiction),
      alt,
      caption: sanitizeText(item?.caption),
    });
  }

  return figures;
}

function normalize(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// JSX attributes are written with double quotes, so strip any the model emits.
function sanitizeText(value, maxLength = 220) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/["“”]/g, "'")
    .replace(/[{}]/g, "")
    .trim()
    .slice(0, maxLength);
}

function identifierFor(name, taken) {
  const pascal = name
    .split("-")
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join("");
  let candidate = `fig${pascal || "Figure"}`;
  let n = 2;
  while (taken.has(candidate)) candidate = `fig${pascal}${n++}`;
  taken.add(candidate);
  return candidate;
}

// --- Prompt -------------------------------------------------------------------

function buildFigurePrompt({
  title,
  heading,
  concept,
  depiction,
  technologies,
}) {
  return [
    "You are a senior technical illustrator producing an explanatory diagram for a Microsoft cloud engineering article.",
    "GOAL (mandatory): the image must TEACH. A reader who has never seen this technology should understand the relationship, sequence, or boundary it shows without reading the surrounding text. Clarity beats beauty. This is a diagram, not decoration.",
    `Article: ${title}.`,
    `Section this diagram belongs to: ${heading}.`,
    concept ? `The idea the reader must grasp: ${concept}.` : "",
    depiction ? `Depict exactly this: ${depiction}.` : "",
    technologies
      ? `Products and technologies involved — label each component with its short official product name, spelled exactly as given: ${technologies}.`
      : "",
    "COMPOSITION: a single clean 16:9 technical diagram on a light neutral background. Use clearly separated rectangular components with rounded corners, directional arrows showing the flow between them, numbered step markers where order matters, and dashed boundary containers for trust, network, or tenant boundaries. Lay the flow out left to right, or top to bottom for a sequence. Leave generous margins and breathing room between components — an uncluttered diagram with six well-labeled elements is far better than a dense one with twenty.",
    "LABELS: every component, arrow, and boundary carries a short label of one to four correctly-spelled English words. Labels are the whole point of this image, so render them crisply in a clean modern sans-serif at a size that stays readable when the image is displayed 768 pixels wide. Never invent words, never produce jumbled or partial letters, and never leave squiggle-text where a label belongs. If a phrase will not render legibly, shorten it. Do not add a title bar, watermark, caption, or paragraph of body text — the article supplies those.",
    "STYLE: modern enterprise documentation diagram. Flat vector shapes, confident thin line work, a restrained palette of deep navy, slate grey, and white with muted teal fills and a single warm accent (orange or red) reserved for the most important element or a failure path. Subtle soft shadows at most.",
    "Strictly avoid: photorealism, 3D renders, isometric skyscrapers, glowing neon, circuit-board backgrounds, holograms, robots, brains, clip-art people, any recognizable human likeness, any product logo used decoratively, dark sci-fi backgrounds, cartoon or childish styling, misspelled or garbled text, and any decorative element that does not carry meaning.",
  ]
    .filter(Boolean)
    .join(" ");
}

// --- MDX editing --------------------------------------------------------------

// Find a safe blank line to insert markup at: after the section's first block of
// content, never inside a fenced code block or a multi-line JSX component.
function findInsertLine(lines, info, section) {
  let sawContent = false;
  for (let i = section.startLine + 1; i <= section.endLine; i += 1) {
    if (lines[i].trim() !== "") {
      sawContent = true;
      continue;
    }
    if (sawContent && !info[i].inFence && info[i].jsxDepth === 0) return i;
  }
  return null;
}

function figureMarkup({ identifier, alt, caption }) {
  const lines = ["<Figure", `  src={${identifier}}`, `  alt="${alt}"`];
  if (caption) lines.push(`  caption="${caption}"`);
  lines.push("/>");
  return lines;
}

// Insert the component + asset imports into the post's existing import block,
// or start one directly under the frontmatter.
function insertImports(lines, statements) {
  let frontmatterEnd = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "---") {
      frontmatterEnd = i;
      break;
    }
  }
  if (frontmatterEnd === -1) return lines;

  let lastImport = -1;
  for (let i = frontmatterEnd + 1; i < lines.length; i += 1) {
    const text = lines[i].trim();
    if (text === "") continue;
    if (/^import\s/.test(text)) {
      lastImport = i;
      continue;
    }
    break;
  }

  if (lastImport !== -1) {
    return [
      ...lines.slice(0, lastImport + 1),
      ...statements,
      ...lines.slice(lastImport + 1),
    ];
  }
  return [
    ...lines.slice(0, frontmatterEnd + 1),
    "",
    ...statements,
    ...lines.slice(frontmatterEnd + 1),
  ];
}

// --- Generation ---------------------------------------------------------------

async function generateImage({ cfg, prompt, outPath }) {
  const res = await requestImage({ cfg, prompt });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(
      `    \u2716 image API returned ${res.status} ${res.statusText}\n${text}`
    );
    return false;
  }
  const b64 = await readImageBase64(res);
  if (!b64) {
    console.error("    \u2716 API response had no image data.");
    return false;
  }
  await mkdir(path.dirname(outPath), { recursive: true });
  await sharp(Buffer.from(b64, "base64"))
    .resize(1200, 800, { fit: "cover" })
    .webp({ quality: 82 })
    .toFile(outPath);
  return true;
}

async function processPost(slug, { cfg, force, dryRun, max }) {
  const postPath = await resolvePostPath(slug);
  if (!postPath) {
    console.warn(`\u2716 No post found for "${slug}" — skipping.`);
    return "skipped";
  }

  const raw = await readFile(postPath, "utf8");
  const fm = parseFrontmatter(raw);
  if (!fm) {
    console.warn(`\u2716 "${slug}" has no frontmatter — skipping.`);
    return "skipped";
  }

  const { lines, info, sections, eol } = splitSections(raw);
  console.log(`\n\u25b6 ${fm.title || slug}`);
  if (sections.length === 0) {
    console.log("  no headings to anchor a figure to — skipping.");
    return "skipped";
  }

  const planned = await planFigures({ slug, fm, sections, cfg, max });
  if (planned === null) return "failed";
  if (planned.length === 0) {
    console.log("  no section needs an explanatory figure. Nothing to do.");
    return "skipped";
  }

  console.log(`  ${planned.length} figure(s) proposed:`);

  const assetDir = path.join(ROOT, "src/assets/blog", slug);
  const taken = new Set([...raw.matchAll(/^import\s+(\w+)/gm)].map(m => m[1]));
  const technologies = fm.tags.join(", ");
  const inserts = [];
  const imports = [];
  let generated = 0;

  for (const figure of planned) {
    const fileName = `figure-${figure.name}.webp`;
    const outPath = path.join(assetDir, fileName);
    const relPath = `@/assets/blog/${slug}/${fileName}`;
    const prompt = buildFigurePrompt({
      title: fm.title,
      heading: figure.section.heading,
      concept: figure.concept,
      depiction: figure.depiction,
      technologies,
    });

    console.log(`\n  \u2022 ${figure.section.heading} \u2192 ${fileName}`);
    console.log(`    concept: ${figure.concept || "(none)"}`);
    console.log(`    alt:     ${figure.alt}`);
    console.log(`    prompt:  ${prompt}`);

    const insertLine = findInsertLine(lines, info, figure.section);
    if (insertLine === null) {
      console.warn(
        "    ! no safe insertion point in this section — skipping figure."
      );
      continue;
    }

    if (dryRun) continue;

    if ((await exists(outPath)) && !force) {
      console.log(
        "    \u2013 image already exists — use --force to regenerate."
      );
    } else if (!(await generateImage({ cfg, prompt, outPath }))) {
      continue;
    } else {
      console.log(
        `    \u2714 wrote ${path.relative(ROOT, outPath).replace(/\\/g, "/")}`
      );
      generated += 1;
    }

    if (raw.includes(relPath)) {
      console.log(
        "    \u2013 already referenced in the post — markup unchanged."
      );
      continue;
    }

    const identifier = identifierFor(figure.name, taken);
    imports.push(`import ${identifier} from "${relPath}";`);
    inserts.push({
      line: insertLine,
      markup: figureMarkup({
        identifier,
        alt: figure.alt,
        caption: figure.caption,
      }),
    });
  }

  if (dryRun) {
    console.log("\n  (dry run — no images generated, no files changed)");
    return "dry-run";
  }
  if (inserts.length === 0) {
    return generated > 0 ? "generated" : "skipped";
  }

  // Apply body insertions bottom-up so earlier line numbers stay valid, then
  // add the imports at the top.
  let next = [...lines];
  for (const insert of [...inserts].sort((a, b) => b.line - a.line)) {
    next = [
      ...next.slice(0, insert.line),
      "",
      ...insert.markup,
      ...next.slice(insert.line),
    ];
  }
  if (!/^import\s+Figure\s+from/m.test(raw)) {
    imports.unshift('import Figure from "@/components/Figure.astro";');
  }
  next = insertImports(next, imports);

  await writeFile(postPath, next.join(eol));
  console.log(
    `\n  \u2714 inserted ${inserts.length} figure(s) into ${path
      .relative(ROOT, postPath)
      .replace(/\\/g, "/")}`
  );
  return "generated";
}

// --- Main ---------------------------------------------------------------------

// Exported so the MDX-editing logic can be exercised without calling the API.
export { findInsertLine, insertImports, figureMarkup, identifierFor, slugify };

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter(a => a.startsWith("--")));
  const positional = [];
  let max = DEFAULT_MAX_FIGURES;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--max") {
      const value = Number.parseInt(args[i + 1] ?? "", 10);
      if (!Number.isInteger(value) || value < 1) {
        fail("--max needs a positive integer, e.g. --max 2");
      }
      max = value;
      i += 1;
      continue;
    }
    if (!arg.startsWith("--")) positional.push(arg);
  }

  const force = flags.has("--force");
  const dryRun = flags.has("--dry-run");
  const includeDrafts = flags.has("--include-drafts");

  let targets;
  if (flags.has("--all")) {
    targets = [];
    for (const slug of await listPosts()) {
      const postPath = await resolvePostPath(slug);
      const fm = parseFrontmatter(await readFile(postPath, "utf8"));
      if (!fm) continue;
      if (fm.draft && !includeDrafts) continue;
      targets.push(slug);
    }
  } else if (positional.length) {
    targets = positional;
  } else {
    fail(
      "Provide a post slug, or use --all. See the header of this file for usage."
    );
  }

  // The chat deployment is required: it is what decides whether a section needs
  // a figure at all.
  const cfg = loadConfig({ requireChat: true });

  const results = { generated: 0, skipped: 0, failed: 0, "dry-run": 0 };
  for (const slug of targets) {
    const status = await processPost(slug, { cfg, force, dryRun, max });
    results[status] = (results[status] ?? 0) + 1;
  }

  console.log(
    `\nDone. posts with figures: ${results.generated}, skipped: ${results.skipped}, failed: ${results.failed}` +
      (dryRun ? `, dry-run: ${results["dry-run"]}` : "")
  );
  if (results.failed > 0) process.exit(1);
}

if (import.meta.main) await main();
