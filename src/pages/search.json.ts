import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { readingTimeLabel } from "@/utils/readingTime";
import { url } from "@/utils/paths";

function searchableBody(body: string | undefined) {
  return (body ?? "")
    .replace(/^(?:import|export)\s.+$/gm, " ")
    .replace(/^```.*$/gm, " ")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_~`]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// The client matches each whitespace-delimited query term against a lowercased
// haystack, so no term ever spans a token. Keeping one copy of each token is
// therefore equivalent for matching, and it keeps the index payload bounded as
// posts get longer.
function searchableTokens(body: string | undefined) {
  const seen = new Set<string>();
  for (const token of searchableBody(body).toLowerCase().split(" ")) {
    if (token) seen.add(token);
  }
  return [...seen].join(" ");
}

// Build-time JSON index consumed by the client-side search on /search.
export const GET: APIRoute = async () => {
  const posts = (await getCollection("blog", ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );

  const index = posts.map(post => ({
    title: post.data.title,
    description: post.data.description,
    tags: post.data.tags,
    url: url(`/blog/${post.id}/`),
    pubDate: post.data.pubDate.toISOString(),
    readingTime: readingTimeLabel(post.body),
    content: searchableTokens(post.body),
  }));

  return new Response(JSON.stringify(index), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
