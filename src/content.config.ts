import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string(),
        description: z.string(),
        pubDate: z.coerce.date(),
        updatedDate: z.coerce.date().optional(),
        heroImage: image().optional(),
        heroAlt: z.string().trim().min(1).optional(),
        tags: z.array(z.string()).default([]),
        draft: z.boolean().default(false),
        featured: z.boolean().default(false),
      })
      .superRefine((data, context) => {
        if (data.heroImage && !data.heroAlt) {
          context.addIssue({
            code: "custom",
            path: ["heroAlt"],
            message: "heroAlt is required when heroImage is set",
          });
        }
      }),
});

const projects = defineCollection({
  loader: glob({ base: "./src/content/projects", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string(),
        summary: z.string(),
        tech: z.array(z.string()).default([]),
        repoUrl: z.url().optional(),
        liveUrl: z.url().optional(),
        image: image().optional(),
        imageAlt: z.string().trim().min(1).optional(),
        order: z.number().default(0),
        featured: z.boolean().default(false),
      })
      .superRefine((data, context) => {
        if (data.image && !data.imageAlt) {
          context.addIssue({
            code: "custom",
            path: ["imageAlt"],
            message: "imageAlt is required when image is set",
          });
        }
      }),
});

export const collections = { blog, projects };
