import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import { unified } from "@astrojs/markdown-remark";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { transformerStyleToClass } from "@shikijs/transformers";

// Shiki paints tokens with inline style attributes, which the site CSP blocks
// via style-src-attr 'none'. This moves the palette into classes instead. One
// instance for the whole build so the class registry dedupes across pages.
const shikiStyleToClass = transformerStyleToClass();

function accessibleCodeBlocks() {
  return tree => {
    const visit = node => {
      if (node?.type === "element" && node.tagName === "pre") {
        node.properties = {
          ...node.properties,
          "aria-label": "Code example",
          tabindex: 0,
        };
      }

      for (const child of node?.children ?? []) visit(child);
    };

    visit(tree);
  };
}

// Emits the rules for the classes above. Runs after highlighting, so the
// registry already holds every class this page uses.
function shikiPaletteStyles() {
  return tree => {
    let hasCodeBlock = false;
    const visit = node => {
      if (node?.type === "element" && node.tagName === "pre") {
        hasCodeBlock = true;
      }

      for (const child of node?.children ?? []) visit(child);
    };

    visit(tree);
    if (!hasCodeBlock) return;

    const css = shikiStyleToClass.getCSS();
    if (!css) return;

    tree.children.push({
      type: "element",
      tagName: "style",
      properties: {},
      children: [{ type: "text", value: css }],
    });
  };
}

// https://astro.build/config
export default defineConfig({
  site: process.env.SITE_URL || 'https://nithin42.github.io',
  base: process.env.BASE_PATH || '/Nithin-gitblog',
  markdown: {
    processor: unified({
      rehypePlugins: [accessibleCodeBlocks, shikiPaletteStyles],
    }),
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      wrap: true,
      transformers: [shikiStyleToClass],
    },
  },
  integrations: [
    mdx(),
    sitemap({
      filter: page => !page.endsWith('/search/'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    build: {
      assetsInlineLimit: 0,
    },
  },
})

