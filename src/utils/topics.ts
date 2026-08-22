import type { CollectionEntry } from "astro:content";
import type { IconName } from "./icons";

export interface TopicDef {
  /** URL slug used at /topics/{slug}. */
  slug: string;
  /** Display name. */
  title: string;
  /** Short summary used on cards. */
  description: string;
  /** Longer lede shown on the hub header. */
  intro: string;
  /** Line icon key. */
  icon: IconName;
  /** Content tags (case-insensitive) that belong to this topic. */
  tags: string[];
  /** "What you'll find here" bullet points. */
  focus: string[];
}

/**
 * Curated topic hubs. A hub is only surfaced when it has matching published
 * content, so readers are never sent to an empty page.
 */
export const TOPICS: TopicDef[] = [
  {
    slug: "ai-and-agents",
    title: "AI & Agents",
    description:
      "Agentic systems, LLM security, and building AI applications that actually ship.",
    intro:
      "Notes on designing and shipping AI systems on the Microsoft and Azure stack — LLM fine-tuning, automated governance, grounding, and keeping models secure by default.",
    icon: "sparkles",
    tags: ["AI", "OpenAI", "LLM", "Agents", "MCP", "Machine Learning", "MLOps", "Python"],
    focus: [
      "AI security, PII auditing, and model governance",
      "LLM fine-tuning and prompt injection defense",
      "Azure ML pipeline automation and Responsible AI",
    ],
  },
  {
    slug: "azure-and-cloud",
    title: "Azure & Cloud",
    description:
      "Architecture, security, and governance patterns across the Azure platform.",
    intro:
      "Field-tested architecture, security, and governance guidance for Azure — building resilient cloud solutions that hold up in enterprise production.",
    icon: "shield",
    tags: ["Azure", "Azure Security", "Cloud", "Machine Learning", "OpenAI"],
    focus: [
      "Azure OpenAI and Azure Machine Learning architecture",
      "Enterprise security, governance, and compliance gates",
      "Zero-Trust design and production MLOps workflows",
    ],
  },
  {
    slug: "security-and-identity",
    title: "Security & Identity",
    description:
      "Cybersecurity, LLM memorization audits, and privacy governance.",
    intro:
      "Security is where AI solutions quietly break. Notes on privacy audits, prompt injection defenses, PII detection, and compliance standards (GDPR & HIPAA) in production AI.",
    icon: "key",
    tags: ["Cybersecurity", "Azure Security", "Security", "Identity", "Privacy", "LLM"],
    focus: [
      "Automated PII leakage and memorization audits",
      "Responsible AI governance and compliance gates",
      "Securing fine-tuned models and API endpoints",
    ],
  },
  {
    slug: "vibe-coding",
    title: "Vibe Coding",
    description:
      "Shipping software by steering AI — planning, skills, and MCP tooling.",
    intro:
      "How to rapidly prototype and ship production software using AI assistants, Model Context Protocol, and agentic workflows.",
    icon: "code",
    tags: ["Vibe Coding", "Python", "Tooling"],
    focus: [
      "Agentic coding and rapid prototyping",
      "Model Context Protocol (MCP) integrations",
      "Turning concepts into production-grade repositories",
    ],
  },
];

/** True when a post carries any tag that belongs to the topic. */
export const postMatchesTopic = (
  post: CollectionEntry<"blog">,
  topic: TopicDef
): boolean => {
  const topicTags = topic.tags.map(t => t.toLowerCase());
  return post.data.tags.some(tag => topicTags.includes(tag.toLowerCase()));
};

/** Posts belonging to a topic, sorted newest first. */
export const getTopicPosts = (
  topic: TopicDef,
  posts: CollectionEntry<"blog">[]
): CollectionEntry<"blog">[] =>
  posts
    .filter(post => postMatchesTopic(post, topic))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

/** Look up a topic by its slug. */
export const getTopicBySlug = (slug: string): TopicDef | undefined =>
  TOPICS.find(topic => topic.slug === slug);
