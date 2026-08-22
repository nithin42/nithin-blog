import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const contentRoot = path.join(root, "src", "content");
const sourceRoot = path.join(root, "src");
const siteOrigin = process.env.SITE_URL || "https://nithin42.github.io/Nithin-gitblog";
const failures = [];
const utcDateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

const fail = message => failures.push(message);

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(entryPath)));
    } else {
      files.push(entryPath);
    }
  }
  return files;
}

function routeFor(filePath) {
  return path.relative(dist, filePath).replaceAll("\\", "/");
}

function canonicalFor(route) {
  if (route === "index.html") return `${siteOrigin}/`;
  if (route.endsWith("/index.html")) {
    return `${siteOrigin}/${route.slice(0, -"index.html".length)}`;
  }
  return `${siteOrigin}/${route.replace(/\.html$/, "/")}`;
}

function pathnameFor(route) {
  return new URL(canonicalFor(route)).pathname;
}

async function resolveSiteFile(pathname) {
  const decodedPath = decodeURIComponent(pathname);
  const relativePath = decodedPath.replace(/^\/+/, "").replace(/\/$/, "");
  const candidates = path.extname(relativePath)
    ? [path.join(dist, relativePath)]
    : [
        path.join(dist, relativePath, "index.html"),
        path.join(dist, `${relativePath}.html`),
      ];

  if (!relativePath) candidates.unshift(path.join(dist, "index.html"));

  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  return null;
}

function plainText(contents) {
  return contents
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .trim();
}

function hasAccessibleName(
  attributes,
  contents = "",
  labelledText = new Map()
) {
  if (
    /\baria-label="[^"]+"/i.test(attributes) ||
    /\btitle="[^"]+"/i.test(attributes)
  ) {
    return true;
  }

  const labelledBy = attributes.match(/\baria-labelledby="([^"]+)"/i)?.[1];
  if (
    labelledBy
      ?.split(/\s+/)
      .some(id => (labelledText.get(id) ?? "").trim().length > 0)
  ) {
    return true;
  }

  const text = plainText(contents);
  return text.length > 0 || /<img\b[^>]*\balt="[^"]+"/i.test(contents);
}

function extractCalls(source, pattern) {
  const calls = [];
  for (const match of source.matchAll(pattern)) {
    const openParen = source.indexOf("(", match.index);
    let depth = 0;
    let quote = "";
    let escaped = false;

    for (let index = openParen; index < source.length; index += 1) {
      const character = source[index];
      if (quote) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === quote) {
          quote = "";
        }
        continue;
      }
      if (character === '"' || character === "'" || character === "`") {
        quote = character;
      } else if (character === "(") {
        depth += 1;
      } else if (character === ")" && --depth === 0) {
        calls.push(source.slice(match.index, index + 1));
        break;
      }
    }
  }
  return calls;
}

for (const required of [
  "index.html",
  "404.html",
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png",
  "og-default.png",
  "rss.xml",
  "search.json",
  "site.webmanifest",
  "sitemap-index.xml",
  "staticwebapp.config.json",
]) {
  if (!(await exists(path.join(dist, required)))) {
    fail(`Missing required build output: ${required}`);
  }
}

const staticWebAppConfig = JSON.parse(
  await readFile(path.join(dist, "staticwebapp.config.json"), "utf8")
);
const globalHeaders = staticWebAppConfig.globalHeaders ?? {};
for (const header of [
  "Content-Security-Policy",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
  "Permissions-Policy",
  "Referrer-Policy",
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "X-Permitted-Cross-Domain-Policies",
]) {
  if (!globalHeaders[header]) {
    fail(`Static Web Apps config is missing ${header}`);
  }
}
for (const directive of [
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src-attr 'none'",
  "style-src-attr 'none'",
  "worker-src 'none'",
]) {
  if (!globalHeaders["Content-Security-Policy"]?.includes(directive)) {
    fail(`Content Security Policy is missing ${directive}`);
  }
}
const astroAssetRoute = staticWebAppConfig.routes?.find(
  route => route.route === "/_astro/*"
);
if (
  astroAssetRoute?.headers?.["Cache-Control"] !==
  "public, max-age=31536000, immutable"
) {
  fail("Hashed Astro assets are missing immutable cache headers");
}

const files = await walk(dist);
const htmlFiles = files.filter(file => file.endsWith(".html"));
const htmlCache = new Map();

async function readHtml(file) {
  if (!htmlCache.has(file)) {
    htmlCache.set(file, await readFile(file, "utf8"));
  }
  return htmlCache.get(file);
}

async function validateInternalTarget(context, target, baseUrl) {
  if (
    target.startsWith("//") ||
    target.startsWith("/api/") ||
    target.includes("${")
  ) {
    return;
  }

  const url = new URL(target, baseUrl);
  if (
    url.pathname !== "/" &&
    !url.pathname.endsWith("/") &&
    !path.extname(url.pathname) &&
    (await exists(
      path.join(dist, url.pathname.replace(/^\/+/, ""), "index.html")
    ))
  ) {
    fail(`${context}: non-canonical internal target ${url.pathname}`);
  }

  const targetFile = await resolveSiteFile(url.pathname);
  if (!targetFile) {
    fail(`${context}: broken internal target ${url.pathname}`);
    return;
  }

  if (url.hash) {
    const targetHtml = await readHtml(targetFile);
    const targetId = decodeURIComponent(url.hash.slice(1));
    const targetIds = new Set(
      [...targetHtml.matchAll(/\bid="([^"]+)"/gi)].map(match => match[1])
    );
    if (!targetIds.has(targetId)) {
      fail(`${context}: broken internal anchor ${url.pathname}${url.hash}`);
    }
  }
}

for (const file of htmlFiles) {
  const route = routeFor(file);
  const html = await readHtml(file);
  const markup = html.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  const headingLevels = [...markup.matchAll(/<h([1-6])\b/gi)].map(match =>
    Number(match[1])
  );
  const h1Count = headingLevels.filter(level => level === 1).length;

  if (!/<html\b[^>]*\blang="en"/i.test(html)) {
    fail(`${route}: missing html[lang="en"]`);
  }
  if (!/<meta\b[^>]*\bname="description"/i.test(html)) {
    fail(`${route}: missing meta description`);
  }
  const appleIconTag = markup.match(
    /<link\b[^>]*\brel="apple-touch-icon"[^>]*>/i
  )?.[0];
  if (
    !appleIconTag ||
    !/\bsizes="180x180"/i.test(appleIconTag) ||
    !/\bhref="\/apple-touch-icon\.png"/i.test(appleIconTag)
  ) {
    fail(`${route}: missing Apple touch icon metadata`);
  }
  const canonicalMatch = html.match(
    /<link\b[^>]*\brel="canonical"[^>]*\bhref="([^"]+)"/i
  );
  if (!canonicalMatch) {
    fail(`${route}: missing canonical link`);
  } else if (canonicalMatch[1] !== canonicalFor(route)) {
    fail(`${route}: unexpected canonical URL ${canonicalMatch[1]}`);
  }
  if (!/<main\b[^>]*\bid="main-content"/i.test(html)) {
    fail(`${route}: missing #main-content`);
  }
  if (!/href="#main-content"/i.test(html)) {
    fail(`${route}: missing skip link`);
  }
  if (!/<main\b[^>]*\bid="main-content"[^>]*\btabindex="-1"/i.test(markup)) {
    fail(`${route}: skip link target is not programmatically focusable`);
  }
  if (h1Count !== 1) {
    fail(`${route}: expected exactly 1 h1, found ${h1Count}`);
  }
  for (let index = 1; index < headingLevels.length; index += 1) {
    if (headingLevels[index] > headingLevels[index - 1] + 1) {
      fail(
        `${route}: heading level skips from h${headingLevels[index - 1]} to h${headingLevels[index]}`
      );
    }
  }

  const mainCount = (markup.match(/<main\b/gi) ?? []).length;
  const footerCount = (markup.match(/<footer\b/gi) ?? []).length;
  const mainStart = markup.search(/<main\b/i);
  const bannerCount =
    mainStart >= 0
      ? (markup.slice(0, mainStart).match(/<header\b/gi) ?? []).length
      : 0;
  if (mainCount !== 1 || footerCount !== 1 || bannerCount !== 1) {
    fail(
      `${route}: expected one banner, main, and footer landmark; found ${bannerCount}/${mainCount}/${footerCount}`
    );
  }

  const ids = [...markup.matchAll(/\bid="([^"]+)"/gi)].map(match => match[1]);
  const labelledText = new Map();
  for (const match of markup.matchAll(
    /<([a-z][\w-]*)\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/gi
  )) {
    labelledText.set(match[2], plainText(match[3]));
  }
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  for (const id of new Set(duplicateIds)) {
    fail(`${route}: duplicate id "${id}"`);
  }

  for (const match of markup.matchAll(/\btabindex="([^"]+)"/gi)) {
    const tabIndex = Number(match[1]);
    if (Number.isFinite(tabIndex) && tabIndex > 0) {
      fail(`${route}: positive tabindex ${tabIndex} disrupts document order`);
    }
  }

  for (const match of markup.matchAll(
    /<(a|button|input|select|textarea)\b([^>]*)>/gi
  )) {
    const [, element, attributes] = match;
    if (
      /\baria-hidden="true"/i.test(attributes) &&
      !/\btabindex="-1"/i.test(attributes)
    ) {
      fail(`${route}: focusable ${element.toLowerCase()} is aria-hidden`);
    }

    const className = attributes.match(/\bclass="([^"]*)"/i)?.[1] ?? "";
    if (
      className.includes("focus-visible:outline-none") &&
      !/focus-visible:(?:ring|decoration|border)|focus-visible:after:ring/.test(
        className
      )
    ) {
      fail(
        `${route}: ${element.toLowerCase()} removes its focus outline without a replacement`
      );
    }
  }

  const currentPath = pathnameFor(route);
  const expectedCurrent =
    currentPath === "/"
      ? "/"
      : [
          "/blog/",
          "/topics/",
          "/projects/",
          "/about/",
          "/contact/",
          "/search/",
        ].find(href => currentPath.startsWith(href));
  if (expectedCurrent) {
    const hasExpectedCurrent = [...markup.matchAll(/<a\b([^>]*)>/gi)].some(
      match => {
        const attributes = match[1];
        return (
          /\baria-current="page"/i.test(attributes) &&
          attributes.match(/\bhref="([^"]+)"/i)?.[1] === expectedCurrent
        );
      }
    );
    if (!hasExpectedCurrent) {
      fail(
        `${route}: active navigation link ${expectedCurrent} is missing aria-current`
      );
    }
  }

  const jsonLdMatch = html.match(
    /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i
  );
  if (!jsonLdMatch) {
    fail(`${route}: missing JSON-LD`);
  } else {
    try {
      const data = JSON.parse(jsonLdMatch[1]);
      const graph = Array.isArray(data?.["@graph"]) ? data["@graph"] : [];
      if (!graph.some(item => item?.["@type"] === "WebSite")) {
        fail(`${route}: JSON-LD is missing WebSite data`);
      }
      if (
        route.startsWith("blog/") &&
        route !== "blog/index.html" &&
        !graph.some(item => item?.["@type"] === "BlogPosting")
      ) {
        fail(`${route}: JSON-LD is missing BlogPosting data`);
      }
    } catch {
      fail(`${route}: JSON-LD is not valid JSON`);
    }
  }

  if (
    (route === "404.html" || route === "search/index.html") &&
    !/<meta\b[^>]*\bname="robots"[^>]*\bcontent="noindex, follow"/i.test(html)
  ) {
    fail(`${route}: expected noindex robots metadata`);
  }
  if (
    route === "blog/portal-of-portals-deep-dive/index.html" &&
    !/<nav\b[^>]*\baria-label="On this page"[^>]*\bdata-table-of-contents/i.test(
      markup
    )
  ) {
    fail(`${route}: long article is missing its table of contents`);
  }
  if (
    route.startsWith("blog/") &&
    route !== "blog/index.html" &&
    !/<nav\b[^>]*\baria-label="More articles"/i.test(markup)
  ) {
    fail(`${route}: article is missing chronological navigation`);
  }

  for (const match of markup.matchAll(/<img\b([^>]*)>/gi)) {
    const attributes = match[1];
    const altMatch = attributes.match(/\balt(?:="([^"]*)")?(?=\s|$)/i);
    if (!altMatch) {
      fail(`${route}: image is missing alt text`);
    } else if ((altMatch[1] ?? "").trim() === "") {
      const preceding = markup.slice(0, match.index);
      const openAnchor = preceding.lastIndexOf("<a");
      const closeAnchor = preceding.lastIndexOf("</a>");
      const anchorTag =
        openAnchor > closeAnchor
          ? preceding.slice(openAnchor, preceding.indexOf(">", openAnchor) + 1)
          : "";
      if (
        anchorTag &&
        !/\baria-hidden="true"/i.test(anchorTag) &&
        !hasAccessibleName(anchorTag, "", labelledText)
      ) {
        fail(`${route}: linked decorative image has no accessible link name`);
      }
    }

    if (
      !/\bwidth="\d+"/i.test(attributes) ||
      !/\bheight="\d+"/i.test(attributes)
    ) {
      fail(`${route}: image is missing intrinsic dimensions`);
    }
  }

  const labels = new Set(
    [...markup.matchAll(/<label\b[^>]*\bfor="([^"]+)"/gi)].map(
      match => match[1]
    )
  );
  for (const match of markup.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)) {
    const attributes = match[2];
    if (/\btype="hidden"/i.test(attributes)) continue;
    const id = attributes.match(/\bid="([^"]+)"/i)?.[1];
    if (
      !hasAccessibleName(attributes, "", labelledText) &&
      (!id || !labels.has(id))
    ) {
      fail(`${route}: ${match[1].toLowerCase()} control is missing a label`);
    }
  }

  for (const match of markup.matchAll(
    /<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi
  )) {
    const [, element, attributes, contents] = match;
    if (/\baria-hidden="true"/i.test(attributes)) continue;
    if (!hasAccessibleName(attributes, contents, labelledText)) {
      fail(
        `${route}: ${element.toLowerCase()} control is missing an accessible name`
      );
    }
  }

  for (const match of markup.matchAll(
    /<button\b([^>]*)\bdata-term-trigger\b([^>]*)>/gi
  )) {
    const attributes = `${match[1]} ${match[2]}`;
    const tooltipId = attributes.match(/\baria-describedby="([^"]+)"/i)?.[1];
    if (
      !tooltipId ||
      !new RegExp(`<[^>]+\\bid="${tooltipId}"[^>]+\\brole="tooltip"`, "i").test(
        markup
      )
    ) {
      fail(`${route}: term trigger is not linked to its tooltip`);
    }
  }

  for (const match of markup.matchAll(
    /<time\b[^>]*\bdatetime="([^"]+)"[^>]*>([^<]+)<\/time>/gi
  )) {
    const date = new Date(match[1]);
    const expected = utcDateFormatter.format(date);
    if (Number.isNaN(date.valueOf()) || match[2].trim() !== expected) {
      fail(`${route}: visible date does not match ${match[1]} in UTC`);
    }
  }

  for (const match of markup.matchAll(/<pre\b([^>]*)>/gi)) {
    if (
      !/\btabindex="0"/i.test(match[1]) ||
      !/\baria-label="Code example"/i.test(match[1])
    ) {
      fail(`${route}: code block is missing keyboard accessibility metadata`);
    }
  }

  const internalTargets = [...markup.matchAll(/\b(?:href|src)="([^"]*)"/gi)]
    .map(match => match[1].replaceAll("&amp;", "&"))
    .filter(
      target =>
        target.startsWith("/") ||
        target.startsWith("#") ||
        target.startsWith(siteOrigin)
    );

  for (const target of internalTargets) {
    await validateInternalTarget(route, target, canonicalFor(route));
  }
}

for (const sourceFile of (await walk(contentRoot)).filter(file =>
  /\.(?:md|mdx)$/i.test(file)
)) {
  const source = await readFile(sourceFile, "utf8");
  const targets = [
    ...source.matchAll(/\]\((\/[^)\s]+)\)/g),
    ...source.matchAll(/\bhref=["'](\/[^"']+)["']/g),
  ].map(match => match[1]);
  for (const target of targets) {
    const url = new URL(target, siteOrigin);
    if (
      url.pathname !== "/" &&
      !url.pathname.endsWith("/") &&
      !path.extname(url.pathname)
    ) {
      fail(
        `${path.relative(root, sourceFile)}: non-canonical content link ${url.pathname}`
      );
    }
    await validateInternalTarget(
      path.relative(root, sourceFile),
      target,
      siteOrigin
    );
  }
}

const sitemapFiles = files.filter(
  file => file.endsWith(".xml") && path.basename(file).startsWith("sitemap-")
);
const sitemap = (
  await Promise.all(sitemapFiles.map(file => readFile(file, "utf8")))
).join("\n");
for (const excluded of ["/404/", "/search/"]) {
  if (sitemap.includes(excluded)) {
    fail(`Sitemap includes excluded route: ${excluded}`);
  }
}

const rss = await readFile(path.join(dist, "rss.xml"), "utf8");
if (
  !/xmlns:atom="http:\/\/www\.w3\.org\/2005\/Atom"/i.test(rss) ||
  !/<atom:link\b[^>]*\bhref="https:\/\/nithin42\.github\.io\/Nithin-gitblog\/rss\.xml"[^>]*\brel="self"[^>]*\btype="application\/rss\+xml"/i.test(
    rss
  )
) {
  fail("RSS feed is missing its Atom self-reference");
}

const searchIndex = await readFile(path.join(dist, "search.json"), "utf8");
const searchEntries = JSON.parse(searchIndex);
if (Buffer.byteLength(searchIndex, "utf8") > 250 * 1_024) {
  fail("Search index exceeds the 250 KiB payload budget");
}
for (const entry of searchEntries) {
  if (typeof entry.url !== "string") {
    fail("Search index entry is missing its URL");
  } else {
    await validateInternalTarget("search.json", entry.url, siteOrigin);
  }
  if (typeof entry.content !== "string" || entry.content.length === 0) {
    fail(
      `Search index entry ${entry.url ?? "(unknown)"} has no article content`
    );
  }
}
const searchSource = await readFile(
  path.join(sourceRoot, "pages", "search.astro"),
  "utf8"
);
if (/\.innerHTML\s*=/.test(searchSource)) {
  fail("Search results must not render index data through innerHTML");
}
if (!searchSource.includes("entry.content")) {
  fail("Search does not match against indexed article content");
}
if (!/timeZone:\s*[`'"]UTC[`'"]/.test(searchSource)) {
  fail("Search date formatter is not pinned to UTC");
}
const homeHtml = await readFile(path.join(dist, "index.html"), "utf8");
if (/<script\b[^>]*\btype="module"[^>]*>\s*[^<\s]/i.test(homeHtml)) {
  fail("Bundled component scripts must remain external and cacheable");
}

const sourceFiles = (await walk(sourceRoot)).filter(file =>
  /\.(?:astro|js|mjs|ts|tsx)$/i.test(file)
);
const dateFormatterFiles = [];
for (const sourceFile of sourceFiles) {
  const source = await readFile(sourceFile, "utf8");
  if (/(?:^|\s)placeholder:text-ink-400/.test(source)) {
    fail(
      `${path.relative(root, sourceFile)}: light-theme placeholder uses low-contrast ink-400`
    );
  }
  const dateFormatterCalls = extractCalls(
    source,
    /(?:toLocaleDateString|Intl\.DateTimeFormat)\s*\(/g
  );
  if (dateFormatterCalls.length > 0) {
    dateFormatterFiles.push(
      path.relative(root, sourceFile).replaceAll("\\", "/")
    );
    for (const call of dateFormatterCalls) {
      if (!/timeZone:\s*["']UTC["']/.test(call)) {
        fail(
          `${path.relative(root, sourceFile)}: date formatter is not pinned to UTC`
        );
      }
    }
  }
}
const expectedDateFormatterFiles = [
  "src/components/FormattedDate.astro",
  "src/pages/search.astro",
];
if (
  dateFormatterFiles.length !== expectedDateFormatterFiles.length ||
  expectedDateFormatterFiles.some(file => !dateFormatterFiles.includes(file))
) {
  fail(
    `Unexpected date formatter inventory: ${dateFormatterFiles.join(", ") || "none"}`
  );
}
for (const [input, expected] of [
  ["2026-08-01T00:00:00.000Z", "August 1, 2026"],
  ["2026-03-08T00:00:00.000Z", "March 8, 2026"],
]) {
  if (utcDateFormatter.format(new Date(input)) !== expected) {
    fail(`UTC date boundary case ${input} did not render as ${expected}`);
  }
}

const manifest = JSON.parse(
  await readFile(path.join(dist, "site.webmanifest"), "utf8")
);
for (const expected of [
  { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
  { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
]) {
  if (
    !manifest.icons?.some(
      icon =>
        icon.src === expected.src &&
        icon.sizes === expected.sizes &&
        icon.type === expected.type
    )
  ) {
    fail(`Web manifest is missing ${expected.src} metadata`);
  }
}

const css = (
  await Promise.all(
    files
      .filter(file => file.endsWith(".css"))
      .map(file => readFile(file, "utf8"))
  )
).join("\n");
const focusVisibleRules = [...css.matchAll(/:focus-visible\{([^}]*)\}/gi)].map(
  match => match[1]
);
if (
  !focusVisibleRules.some(
    rule =>
      /\boutline-width:\s*(?!0)/i.test(rule) &&
      /\boutline-color:/i.test(rule) &&
      !/\boutline(?:-style)?:\s*(?:none|0)/i.test(rule)
  )
) {
  fail("Generated CSS is missing a visible default focus indicator");
}
if (
  !/@media\s*\(prefers-reduced-motion:\s*reduce\)/i.test(css) ||
  !/transition-duration:\s*0?\.0+1ms\s*!important/i.test(css) ||
  !/animation-duration:\s*0?\.0+1ms\s*!important/i.test(css) ||
  !/animation-iteration-count:\s*1\s*!important/i.test(css)
) {
  fail("Generated CSS is missing the reduced-motion override");
}
if (
  !/@media\s+print/i.test(css) ||
  !/\[data-blog-article\]/i.test(css) ||
  !/\[data-comments\]/i.test(css) ||
  !/break-inside:\s*avoid/i.test(css)
) {
  fail("Generated CSS is missing article print safeguards");
}

const termSource = await readFile(
  path.join(sourceRoot, "components", "Term.astro"),
  "utf8"
);
for (const [pattern, behavior] of [
  [/:hover\s+\.term-tooltip/, "hover display"],
  [/:focus-within\s+\.term-tooltip/, "focus display"],
  [/pointer-events:\s*auto/, "hoverable content"],
  [/event\.key\s*!==\s*["']Escape["']/, "Escape dismissal"],
  [/dataset\.dismissed\s*=\s*["']true["']/, "dismissed state"],
  [/event\.stopPropagation\(\)/, "Escape event isolation"],
]) {
  if (!pattern.test(termSource)) {
    fail(`Term tooltip is missing ${behavior} behavior`);
  }
}

const headerSource = await readFile(
  path.join(sourceRoot, "components", "Header.astro"),
  "utf8"
);
for (const [pattern, behavior] of [
  [/document\.addEventListener\(["']keydown["']/, "document Escape dismissal"],
  [/document\.addEventListener\(\s*["']pointerdown["']/, "outside dismissal"],
  [/matchMedia\(["']\(min-width: 1024px\)["']\)/, "desktop breakpoint reset"],
  [/new AbortController\(\)/, "navigation-safe listener cleanup"],
]) {
  if (!pattern.test(headerSource)) {
    fail(`Mobile menu is missing ${behavior}`);
  }
}

if (failures.length > 0) {
  console.error(`Site checks failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Site checks passed for ${htmlFiles.length} HTML pages.`);
