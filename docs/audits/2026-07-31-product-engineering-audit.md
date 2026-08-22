# Product & Engineering Audit — July 31, 2026

## Audit record

| Field | Value |
| --- | --- |
| Repository | `russrimm/Russ-Rimmerman-Blog` |
| Platform | Astro 7, Tailwind CSS 4, Azure Static Web Apps |
| Audit date | July 30–31, 2026 |
| Primary implementation commit | `a189775` — `feat: harden blog experience and delivery` |
| Technical accuracy follow-up | `aaa7a74` — `docs: correct stale technical guidance` |
| Deployment performed | No |
| Azure or GitHub settings changed | No |

## Executive summary

The audit reviewed the blog and portfolio as both a reader-facing product and a
production web application. It covered discoverability, navigation, search,
taxonomy, newsletter and comment states, portfolio credibility, accessibility,
responsive behavior, SEO, structured data, Open Graph, RSS, sitemap behavior,
security and privacy, dependency health, image loading, error pages, CI, Azure
Static Web Apps packaging, documentation, and the published content library.

The implementation focused on changes that were high confidence, low risk, and
locally verifiable. It did not deploy the site, change cloud resources, select
external vendors, add analytics, invent professional proof, or silently rewrite
technical conclusions that still need the author's evidence.

The main outcomes were:

- Restored a clear homepage reader promise and valid page-level heading.
- Reworked navigation for branding, keyboard use, and tablet/mobile layouts.
- Added a complete SEO and social-sharing metadata model with JSON-LD.
- Added article bylines, related reading, responsive images, and local assets.
- Made newsletter availability explicit and comment loading privacy-conscious.
- Added a privacy page and hardened Azure Static Web Apps response headers.
- Corrected Static Web Apps configuration packaging for prebuilt deployments.
- Added generated-site checks for metadata, accessibility, links, images, and
  sitemap exclusions.
- Improved CI so validation runs without Azure credentials on fork and
  Dependabot pull requests.
- Patched dependency vulnerabilities and added Dependabot update configuration.
- Corrected objectively stale published guidance using current first-party
  Microsoft, GitHub, and Python documentation.

## Scope and guardrails

### Reviewed

- Content discoverability and information architecture
- Homepage positioning and conversion paths
- Header, footer, mobile navigation, topics, tags, and search
- Blog and portfolio credibility
- Newsletter and comment behavior
- Accessibility and responsive design
- SEO metadata, canonical URLs, Open Graph, JSON-LD, RSS, robots, and sitemap
- Error handling and empty states
- Privacy and third-party loading
- Security headers and Azure Static Web Apps routing/configuration
- Performance-sensitive image and script loading
- Dependency vulnerabilities and update hygiene
- Build validation, generated-output tests, and GitHub Actions
- Published and draft blog content quality and technical accuracy

### Explicitly excluded

- Deploying the site or changing Azure resources
- Enabling GitHub repository settings
- Choosing or configuring a newsletter or analytics vendor
- Fabricating biography, certifications, speaking engagements, traffic,
  conversions, rankings, or Core Web Vitals
- Rewriting unpublished drafts when first-party evidence did not establish a
  single correct conclusion
- Replacing author judgment on disputed technical diagnoses

## Implemented product changes

### Homepage and positioning

- Restored `Hero.astro` on the homepage so the site has one clear `<h1>`, a
  concise reader promise, primary and secondary calls to action, and populated
  topic shortcuts.
- Preserved the existing featured-post and recent-post experience beneath the
  hero.
- Kept the homepage content grounded in existing biography and site constants;
  no new credentials or professional claims were invented.

Affected files:

- `src/pages/index.astro`
- `src/components/Hero.astro` (reused, not rewritten)

### Navigation and responsive behavior

- Rebuilt the header around a linked `RR` brand mark and site name.
- Moved primary navigation to the `lg` breakpoint to prevent tablet-width
  collisions and overflow.
- Kept the support link visible on wide screens and placed it in the mobile menu
  on narrower screens.
- Increased icon controls to 40×40 CSS pixels and added clear hover/focus states.
- Added accurate open/close labels to the mobile menu button.
- Added Escape-key handling that closes the mobile menu and returns focus to the
  toggle.
- Added a site-wide skip link and a focusable `#main-content` target.
- Added `touch-action: manipulation` to links and buttons.
- Disabled smooth scrolling for readers who prefer reduced motion.

Affected files:

- `src/components/Header.astro`
- `src/layouts/BaseLayout.astro`
- `src/styles/global.css`

### Theme behavior

- Changed the initial theme from a hard-coded dark default to:
  1. the visitor's stored preference, or
  2. the operating system preference when no choice has been stored.
- Kept the no-flash pre-paint theme application.
- Updated the browser theme color when the theme changes.
- Added precise toggle labels such as `Switch to dark theme` and
  `Switch to light theme`.
- Continued synchronizing the active theme with the comment embed.

Affected files:

- `src/components/BaseHead.astro`
- `src/components/ThemeToggle.astro`

### Blog article experience

- Added an author byline linked to the About page.
- Passed article hero images into social metadata.
- Added `updatedDate` support to article metadata and structured data.
- Added up to three related articles, ranked by shared tag count and recency.
- Kept article hero images eager/high priority while moving non-critical card
  images to responsive lazy loading.
- Added responsive `srcset`/`sizes` behavior for article and project images.

Affected files:

- `src/layouts/BlogPost.astro`
- `src/pages/blog/[...slug].astro`
- `src/components/PostCard.astro`
- `src/components/FeaturedPost.astro`
- `src/components/ProjectCard.astro`
- `src/pages/projects/[slug].astro`

### Search

- Preserved search state in the URL through the `q` query parameter.
- Preserved Astro ClientRouter history metadata when updating the query, so
  back/forward direction and scroll restoration continue to work.
- Removed automatic focus after the search index loads, avoiding unwanted
  mobile keyboard activation.
- Added an initial loading state and a no-JavaScript fallback.
- Added explicit handling for failed or malformed search-index responses.
- Escaped generated result URLs as well as titles, descriptions, tags, and
  reading-time values.
- Marked the search page `noindex, follow` and excluded it from the sitemap to
  prevent low-value query/result pages from competing in search results.

Affected files:

- `src/pages/search.astro`
- `astro.config.mjs`

### Topics and tags

- Renamed the `/tags` page heading from `Topics` to `Tags` so it no longer
  duplicates the curated `/topics` concept.
- Updated supporting copy and back-navigation labels.
- Fixed missing whitespace in tag post counts.
- Filtered curated topic chips so they only link to tag routes that actually
  exist, eliminating a broken `/tags/m365-copilot` target.
- Fixed spacing in topic article counts.

Affected files:

- `src/pages/tags/index.astro`
- `src/pages/tags/[tag].astro`
- `src/pages/topics/[topic].astro`

### About and portfolio credibility

- Replaced the decorative initials block on the About page with the existing
  author headshot asset.
- Preserved the existing biography, role, experience, and project claims.
- Added responsive and intrinsic image behavior to project cards and project
  detail heroes.
- Marked decorative external-link and GitHub icons hidden from assistive
  technology.

Affected files:

- `src/pages/about.astro`
- `src/components/ProjectCard.astro`
- `src/pages/projects/[slug].astro`

### Error page

- Marked the generated 404 page `noindex, follow`.
- Retained the existing recovery links to the homepage and blog.
- Removed the global SPA-style navigation fallback that rewrote every unknown
  route to `404.html`, avoiding soft-404 behavior for static routes.
- Kept the Azure Static Web Apps `404` response override so missing routes still
  receive the custom page with an actual 404 response.

Affected files:

- `src/pages/404.astro`
- `public/staticwebapp.config.json`

## SEO, discovery, and structured data

### Global metadata

`BaseHead.astro` was expanded to provide:

- Canonical URLs based on the configured production site
- Standard title, description, author, generator, and color-scheme metadata
- Open Graph URL, title, description, image, image alt text, dimensions, locale,
  type, and site name
- Twitter large-card metadata using the same canonical social image
- Article published date, modified date, and tags
- Optional `noindex, follow`
- RSS, sitemap, favicon, and web manifest discovery links

### Structured data

Every page now emits a JSON-LD graph containing:

- `Person` for the author, linked to the About page and existing social profiles
- `WebSite` for the site identity and description
- `SearchAction` pointing to `/search/?q={search_term_string}`

Blog posts additionally emit:

- `BlogPosting`
- Headline and description
- Social image dimensions
- Published and modified dates
- Keywords from tags
- Author and publisher references
- Canonical main entity URL

The JSON-LD payload escapes `<` before inline serialization.

### Social-image fallback

- Added an authored `1200×630` SVG Open Graph card.
- Generated a corresponding 1200×630 PNG for social platforms that do not use
  SVG social images.
- Blog posts with hero images use their optimized Astro asset URL instead of the
  generic fallback.

Affected files:

- `src/components/BaseHead.astro`
- `src/layouts/BaseLayout.astro`
- `src/layouts/BlogPost.astro`
- `public/og-default.svg`
- `public/og-default.png`
- `public/site.webmanifest`

## Newsletter changes

### Managed API

- Added `GET /api/subscribe` as a no-store availability endpoint.
- Reports availability only when the selected provider has the required
  configuration.
- Retained `POST /api/subscribe` for submissions.
- Continued validating email shape and maximum length server-side.
- Continued using a honeypot that returns a success-shaped response to bots.
- Replaced provider response-detail logging with upstream status logging so
  provider errors do not place email addresses or other response details in
  application logs.
- Added `Cache-Control: no-store` to API responses.

### Reader-facing form

- Added `inputmode`, `autocapitalize`, and `spellcheck` attributes appropriate
  for email entry.
- Associated validation/status text through `aria-describedby`.
- Sets `aria-invalid` on failed client-side validation.
- Checks production availability before submission and disables the field and
  button when no provider is configured.
- Skips the availability request on localhost because the standalone Astro
  server does not host the managed API.
- Preserved loading, success, error, reset, and focus behavior.

Affected files:

- `api/src/functions/subscribe.js`
- `src/components/NewsletterSignup.astro`
- `api/package.json`
- `api/package-lock.json`

## Comment and privacy changes

### Comments

- Replaced automatic Giscus loading with an explicit `Load comments` button.
- Discloses that loading comments connects the browser to Giscus and GitHub.
- Adds accessible loading, loaded, and retry states.
- Continues using the configured repository, category, pathname mapping,
  reactions, language, and input position.
- Uses a persistent `astro:page-load` initializer so the control works after
  client-side article-to-article navigation.
- Synchronizes the active site theme with an already loaded Giscus iframe.

### Privacy page

Added `/privacy` with factual disclosures covering:

- No current first-party advertising or analytics
- Theme preference storage in browser local storage
- Newsletter address processing by the managed API and configured provider
- Honeypot use
- Opt-in loading of Giscus and GitHub Discussions
- Azure Static Web Apps hosting
- External-link privacy boundaries
- Contact address for privacy questions

The footer now links to the privacy page.

Affected files:

- `src/components/Comments.astro`
- `src/pages/privacy.astro`
- `src/components/Footer.astro`

## Performance changes

- Added responsive image widths and sizes to blog cards, the featured post,
  project cards, article heroes, and project detail heroes.
- Lazy-loaded and asynchronously decoded below-the-fold card images.
- Kept only article/project detail hero images eager with high fetch priority.
- Changed duplicate linked card images to empty alt text because the nearby
  linked heading already supplies the accessible name.
- Replaced three externally hosted Markdown screenshots in the launch article
  with existing local assets rendered through the Astro `Screenshot` component.
- Deferred the Giscus script, stylesheet, iframe, and API requests until reader
  interaction.
- Did not add remote fonts, analytics, or new production JavaScript libraries.

Affected files:

- `src/components/PostCard.astro`
- `src/components/FeaturedPost.astro`
- `src/components/ProjectCard.astro`
- `src/layouts/BlogPost.astro`
- `src/pages/projects/[slug].astro`
- `src/content/blog/starting-a-new-blog.mdx`
- `src/components/Comments.astro`

## Security and Azure Static Web Apps changes

### Response headers

The deployable Static Web Apps configuration now includes:

- `Strict-Transport-Security`
- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- A restrictive `Permissions-Policy`

The CSP:

- Defaults to same-origin resources
- Blocks plugins with `object-src 'none'`
- Prevents framing with `frame-ancestors 'none'`
- Restricts forms to the same origin
- Permits Giscus only for its script, connection, and frame requirements
- Allows local images plus data and HTTPS images
- Upgrades insecure requests

The policy retains `unsafe-inline` for scripts/styles because the current Astro
theme/configuration implementation uses inline scripts and generated CSS.

### Correct deployment packaging

- Moved `staticwebapp.config.json` into `public/`.
- Astro now copies it into `dist/staticwebapp.config.json`.
- This is required because the Azure deployment uses `skip_app_build: true` and
  deploys `dist` as the application location.
- Added `"apiRuntime": "node:20"` for the managed Azure Functions API.
- Added the web manifest MIME type.

Affected files:

- `public/staticwebapp.config.json`
- `README.md`

## Dependencies and supply-chain hygiene

- Upgraded `sharp` from `^0.33.5` to `^0.35.3`.
- Applied a non-forced npm audit fix to resolve the transitive `fast-uri`
  advisory.
- Upgraded `@azure/functions` from `^4.5.0` to `^4.16.2`.
- Added `api/package-lock.json` for deterministic API installs and auditing.
- Updated the root lockfile.
- Added Dependabot update configuration for:
  - Root npm dependencies
  - API npm dependencies
  - GitHub Actions
- Dependabot update PRs are limited to five per ecosystem and scheduled weekly.
- The GitHub API reported that Dependabot alerts were disabled at the repository
  level; repository settings were not changed during this audit.

Affected files:

- `package.json`
- `package-lock.json`
- `api/package.json`
- `api/package-lock.json`
- `.github/dependabot.yml`

## CI and validation changes

### GitHub Actions workflow

The Azure Static Web Apps workflow now separates validation from deployment.

The validation job:

- Runs for pushes and non-closed pull requests.
- Checks out submodules.
- Uses Node 24 with npm caching.
- Installs root and API dependencies with `npm ci`.
- Checks the newsletter function syntax.
- Runs the production build and generated-site checks.
- Uploads the validated `dist` directory as a one-day artifact.

The deployment job:

- Depends on validation.
- Downloads the exact validated artifact.
- Uses OIDC to sign in to Azure.
- Retrieves and masks the Static Web Apps deployment token at runtime.
- Deploys the prebuilt `dist` directory and managed API.
- Sets `output_location` to an empty string as required with
  `skip_app_build: true`.
- Runs only for main pushes or eligible same-repository pull requests.
- Excludes Dependabot-authored pull requests because normal Actions secrets are
  unavailable to Dependabot pull-request workflows.

The preview-close job:

- Runs only for eligible same-repository pull requests.
- Excludes Dependabot-authored pull requests.
- Uses the same OIDC and runtime-token pattern.

Fork and Dependabot pull requests still receive the full validation job without
attempting Azure authentication.

Affected files:

- `.github/workflows/azure-static-web-apps.yml`

### Generated-site checker

Added `scripts/check-site.mjs` and wired it through:

- `npm run check:site`
- `npm test` (`npm run build && npm run check:site`)

The checker walks every generated HTML page and verifies:

- Required build outputs exist
- `html[lang="en"]`
- Meta descriptions
- Canonical links
- The skip link and `#main-content`
- Exactly one `<h1>` per page
- Valid JSON-LD
- `WebSite` data on all pages
- `BlogPosting` data on blog posts
- `noindex, follow` on 404 and search
- Image alt attributes
- Intrinsic image width and height
- Internal `href` and `src` targets
- Search and 404 exclusion from generated sitemaps

Required outputs include:

- `index.html`
- `404.html`
- `og-default.png`
- `rss.xml`
- `search.json`
- `site.webmanifest`
- `sitemap-index.xml`
- `staticwebapp.config.json`

Affected files:

- `scripts/check-site.mjs`
- `package.json`
- `README.md`

## Content-library changes in the primary audit

The content audit covered ten accessible posts: eight published and two drafts.
No traffic, ranking, engagement, conversion, or field performance metrics were
available, so editorial conclusions were based on the content itself.

### Published metadata cleanup

Shortened the overlong frontmatter descriptions for:

- `favorite-ai-tools-for-vibe-coding.mdx`
- `intune-graph-scope-is-only-half-the-permission.mdx`
- `portal-of-portals-deep-dive.mdx`
- `servicenow-copilot-studio-user-login-sso.mdx`
- `starting-a-new-blog.mdx`
- `vibe-code-your-blog-part-1-setup.mdx`
- `vibe-code-your-blog-part-2-deploy.mdx`
- `vibe-coding-lessons.mdx`

### Other content fixes

- Corrected the heading `When the skill you need doesn't exist, build them` to
  `When the skill you need doesn't exist, build it`.
- Replaced three remote Microsoft Communications Portal screenshots with local,
  optimized screenshots and descriptive captions.

## Technical accuracy follow-up

Commit `aaa7a74` performed a separate, first-party-source-based review of
published setup, deployment, authentication, pricing, and version guidance.
Only objectively verifiable corrections were applied.

### Azure Static Web Apps deployment semantics

Corrected the claim that no long-lived secret exists anywhere:

- Azure creates a persistent, resettable Static Web Apps deployment token.
- OIDC removes the need to store a long-lived Azure sign-in credential in
  GitHub.
- The workflow leaves the durable deployment token in Azure instead of copying
  it into GitHub secrets.
- A short-lived OIDC token is used to authenticate to Azure.
- The workflow retrieves the Static Web Apps deployment token just in time for
  each deploy or preview-close action.

Also corrected `no server-side app` language:

- The Astro front end is prebuilt static content.
- `/api/subscribe` is still managed Azure Functions runtime code.
- The API still requires input validation, dependency patching, and monitoring.

Updated file:

- `src/content/blog/vibe-code-your-blog-part-2-deploy.mdx`

First-party sources:

- [Reset deployment tokens in Azure Static Web Apps](https://learn.microsoft.com/azure/static-web-apps/deployment-token-management)
- [Overview of API support in Azure Static Web Apps](https://learn.microsoft.com/azure/static-web-apps/apis-overview)

### GitHub Copilot plans and product terminology

Corrected:

- Copilot Pro pricing from `$21/month` to `$10 USD/month` as of July 2026.
- Unsupported claims about larger context windows, higher-tier models, and
  unqualified agent availability.
- Copilot Free limitations for the cloud-agent workflow used in the article.
- Student benefits from `Copilot Pro for free` to the distinct free
  `Copilot Student` plan.
- The false claim that students receive the same features and models as Pro.
- Teacher benefits to the documented no-charge Copilot Pro eligibility.
- The GitHub Copilot app from a web/mobile product to the native desktop
  experience for Windows, macOS, and Linux.
- Browser-based asynchronous branch/PR work to the correct product name:
  GitHub Copilot cloud agent.
- The setup guide now makes the desktop app, cloud agent, or both an explicit
  choice rather than requiring a desktop install.

Updated files:

- `src/content/blog/vibe-code-your-blog-part-1-setup.mdx`
- `src/content/blog/favorite-ai-tools-for-vibe-coding.mdx`

First-party sources:

- [Plans for GitHub Copilot](https://docs.github.com/en/copilot/get-started/plans)
- [GitHub Copilot app](https://github.com/features/ai/github-app)
- [About GitHub Copilot cloud agent](https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent)
- [GitHub Education for students](https://docs.github.com/en/education/about-github-education/github-education-for-students/about-github-education-for-students)
- [GitHub Education for teachers](https://docs.github.com/en/education/about-github-education/github-education-for-teachers/about-github-education-for-teachers)

### Python setup guidance

Corrected:

- The stale claim that current macOS and most Linux distributions ship Python 2
  as `python`.
- Platform checks to use `python` on Windows and `python3` on macOS/Linux.
- Pip checks to use `python -m pip` or `python3 -m pip`.
- The fixed `Python 3.13.x` expectation to a supported Python 3 release.
- PATH troubleshooting so it no longer assumes Windows installer behavior on
  macOS and Linux.
- Guidance not to replace operating-system-managed Python.

Updated file:

- `src/content/blog/vibe-code-your-blog-part-1-setup.mdx`

First-party source:

- [Using Python on macOS](https://docs.python.org/3/using/mac.html)

### ServiceNow and Microsoft Entra terminology

Corrected:

- `two Entra app registrations` to two Entra application identities.
- The customer-owned ServiceNow resource app remains an app registration.
- Microsoft's first-party connector remains a Microsoft-owned multitenant app.
- The customer tenant uses a local service principal, shown under
  **Enterprise applications**, after consent.
- Removed the inaccurate statement that the first-party app registration
  `already exists in every tenant`.
- Added a Microsoft source for connector client ID
  `c26b24aa-7874-4e06-ad55-7d06b1f79b63`.
- Clarified that `SSO` in the article describes delegated identity reuse; first
  use can still display an **Allow** card and sign-in prompt.

Updated file:

- `src/content/blog/servicenow-copilot-studio-user-login-sso.mdx`

First-party sources:

- [Application and service principal objects in Microsoft Entra ID](https://learn.microsoft.com/entra/identity-platform/app-objects-and-service-principals)
- [Microsoft ServiceNow integration guidance](https://learn.microsoft.com/microsoft-365/copilot/employee-self-service/servicenow-hrsd-itsm#servicenow-configuration)

## Validation evidence

### Build and generated output

- Astro diagnostics: no errors or warnings in the final validation pass.
- Production build: succeeded.
- Generated pages: 50.
- Generated-site checker: all 50 HTML pages passed.
- API function syntax: passed `node --check`.
- Git diff whitespace validation: passed.

### Browser validation

Verified with the production build at desktop and 375-pixel mobile widths:

- Exactly one homepage `<h1>`
- No horizontal overflow
- Mobile menu open/close behavior
- Escape closes the mobile menu and restores focus
- Theme state, stored preference, button label, and theme-color metadata
- Search query synchronization in the URL
- Astro ClientRouter history state preserved while typing
- Search noindex and canonical metadata
- Per-post Open Graph hero image and image dimensions
- `Person`, `WebSite`, and `BlogPosting` JSON-LD
- Related-post navigation
- Giscus does not load before reader interaction
- Giscus loads after direct navigation
- Giscus also loads after Astro article-to-article client navigation

### Link validation

- Initial library audit: 43 unique external Markdown URLs returned successfully,
  including redirects.
- Technical accuracy follow-up: 42 unique external links across the four
  corrected posts were fetched with redirects followed; 42 passed and none
  failed.
- Generated-site internal-link checks passed for all 50 HTML pages.

### Dependency validation

- Root dependency audit: zero known vulnerabilities after remediation.
- API dependency audit: zero known vulnerabilities after remediation.
- GitHub Dependabot alert API: unavailable because alerts are disabled in
  repository settings.

### Performance validation limits

- Responsive image generation, loading attributes, layout dimensions, network
  deferral, and mobile overflow were validated locally.
- Lighthouse was not available in the local toolchain and was not installed.
- No production analytics or real-user monitoring data was available.
- No claims were made about field Core Web Vitals, traffic, rankings, or
  conversion performance.

## Deferred recommendations

### Requires author evidence or editorial judgment

1. **Part 1 to Part 2 series handoff**  
   Part 1 promises a scaffold/build handoff, while Part 2 assumes the project and
   deployment files already exist. Fixing this requires a structural editorial
   decision, not a factual line edit.

2. **Intune 403 diagnosis**  
   `intune-graph-scope-is-only-half-the-permission.mdx` should identify the
   confirmed missing gate and narrow the thesis to the tested delegated or
   app-only scenario. The repository does not contain enough evidence to choose
   the diagnosis safely.

3. **ServiceNow article structure and title**  
   The article could be split into an integration-path comparison and an
   implementation guide. The title's use of `SSO` remains an editorial choice;
   the body now accurately discloses first-run consent and sign-in.

4. **Unpublished Copilot Studio authentication draft**  
   `copilot-studio-sso-changes-your-client.mdx` needs scenario-specific evidence
   before changing its SDK-versus-Direct-Line conclusion.

5. **Unpublished Foundry networking draft**  
   `foundry-agents-teams-private-endpoint.mdx` should revalidate prompt-agent IP
   scaling and networking capacity against current Microsoft guidance before
   publication.

6. **Portfolio proof**  
   Add certifications, speaking links, Microsoft Press ebook links, or other
   proof only after the author supplies verified assets. Relevant references:
   `PRODUCT.md` and `src/pages/about.astro`.

### Requires an external decision or setting

1. Enable Dependabot alerts in GitHub repository settings.
2. Select and configure the production newsletter provider.
3. Decide whether the newsletter should use double opt-in.
4. Add rate limiting or an edge abuse-control strategy after the deployment
   architecture and provider behavior are confirmed.
5. Choose an analytics or real-user-monitoring product only after defining the
   site's privacy and consent posture.
6. Consider a nonce/hash-based CSP migration if removing `unsafe-inline`
   becomes a priority.
7. Generated-site integrity checks currently run on pushes to `main` and pull
   requests targeting `main`, but not direct feature-branch pushes. If validation
   is broadened to all branch pushes, first add an explicit
   `github.ref == 'refs/heads/main'` condition to `build_and_deploy`; otherwise
   every branch push admitted by the workflow would deploy to production.

## Known limits and blockers

- The changes were not deployed during the audit.
- Azure resources and application settings were not inspected or modified.
- The production newsletter provider state was not verified.
- Production response headers were not observed over the public endpoint.
- Dependabot alerts remain disabled until changed in GitHub settings.
- Field performance and conversion behavior remain unknown without real-user
  telemetry.

## File inventory

### Added

- `.github/dependabot.yml`
- `api/package-lock.json`
- `public/og-default.png`
- `public/og-default.svg`
- `public/site.webmanifest`
- `scripts/check-site.mjs`
- `src/pages/privacy.astro`

### Moved

- `staticwebapp.config.json` → `public/staticwebapp.config.json`

### Updated application and delivery files

- `.github/workflows/azure-static-web-apps.yml`
- `.prettierignore`
- `README.md`
- `api/package.json`
- `api/src/functions/subscribe.js`
- `astro.config.mjs`
- `package.json`
- `package-lock.json`
- `src/components/BaseHead.astro`
- `src/components/Comments.astro`
- `src/components/FeaturedPost.astro`
- `src/components/Footer.astro`
- `src/components/Header.astro`
- `src/components/NewsletterSignup.astro`
- `src/components/PostCard.astro`
- `src/components/ProjectCard.astro`
- `src/components/ThemeToggle.astro`
- `src/layouts/BaseLayout.astro`
- `src/layouts/BlogPost.astro`
- `src/pages/404.astro`
- `src/pages/about.astro`
- `src/pages/blog/[...slug].astro`
- `src/pages/index.astro`
- `src/pages/projects/[slug].astro`
- `src/pages/search.astro`
- `src/pages/tags/[tag].astro`
- `src/pages/tags/index.astro`
- `src/pages/topics/[topic].astro`
- `src/styles/global.css`

### Updated content files

- `src/content/blog/favorite-ai-tools-for-vibe-coding.mdx`
- `src/content/blog/intune-graph-scope-is-only-half-the-permission.mdx`
- `src/content/blog/portal-of-portals-deep-dive.mdx`
- `src/content/blog/servicenow-copilot-studio-user-login-sso.mdx`
- `src/content/blog/starting-a-new-blog.mdx`
- `src/content/blog/vibe-code-your-blog-part-1-setup.mdx`
- `src/content/blog/vibe-code-your-blog-part-2-deploy.mdx`
- `src/content/blog/vibe-coding-lessons.mdx`

## Commit summary

### `a189775` — `feat: harden blog experience and delivery`

- 45 files changed
- 1,452 insertions
- 1,015 deletions
- Product, accessibility, SEO, privacy, performance, dependency, CI, and Azure
  packaging implementation

### `aaa7a74` — `docs: correct stale technical guidance`

- 4 files changed
- 119 insertions
- 97 deletions
- First-party-source-based corrections to published Azure, GitHub, Python, and
  ServiceNow guidance
