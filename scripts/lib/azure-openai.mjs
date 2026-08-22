// Shared Azure OpenAI helpers for the local / CI content generators
// (`scripts/generate-hero.mjs`, `scripts/generate-figures.mjs`).
//
// Auth is Microsoft Entra ID — NO API KEY. DefaultAzureCredential resolves a
// short-lived, RBAC-scoped token from, in order: environment / workload
// identity / managed identity, the Azure CLI (`az login`), Azure Developer CLI,
// and VS Code. Locally, run `az login`; in CI, use federated OIDC
// (azure/login). The signed-in principal needs the "Cognitive Services OpenAI
// User" role on the Azure OpenAI resource.

import { DefaultAzureCredential } from "@azure/identity";

export const DEFAULT_API_VERSION = "2025-04-01-preview";

export function fail(message) {
  console.error(`\n\u2716 ${message}\n`);
  process.exit(1);
}

let cachedToken = null;
export async function getAccessToken() {
  if (cachedToken) return cachedToken;
  try {
    const credential = new DefaultAzureCredential();
    const token = await credential.getToken(
      "https://cognitiveservices.azure.com/.default"
    );
    cachedToken = token?.token;
  } catch (err) {
    fail(
      `Could not get an Entra ID token: ${err.message}\nRun \`az login\` first.`
    );
  }
  if (!cachedToken) fail("Entra ID token was empty. Run `az login` and retry.");
  return cachedToken;
}

// Read the Azure OpenAI configuration from the environment. `requireChat`
// makes the chat deployment mandatory (the figure generator cannot reason about
// a post without it); otherwise callers decide how to handle its absence.
export function loadConfig({ requireChat = false } = {}) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT;
  const chatDeployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || null;
  const apiVersion =
    process.env.AZURE_OPENAI_API_VERSION || DEFAULT_API_VERSION;

  if (!endpoint || !deployment) {
    fail(
      "Missing Azure OpenAI config. Set AZURE_OPENAI_ENDPOINT and " +
        "AZURE_OPENAI_IMAGE_DEPLOYMENT (in .env locally, or as CI env vars)."
    );
  }
  if (requireChat && !chatDeployment) {
    fail(
      "AZURE_OPENAI_CHAT_DEPLOYMENT is required: the post is read by a chat " +
        "model to decide which sections need an explanatory figure."
    );
  }

  return { endpoint, deployment, chatDeployment, apiVersion };
}

function deploymentUrl(cfg, deployment, route) {
  return (
    `${cfg.endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}` +
    `/${route}?api-version=${cfg.apiVersion}`
  );
}

// Ask the chat deployment for a JSON object. Returns the parsed value, or null
// on any failure so callers can fall back instead of crashing a batch run.
export async function requestChatJson({
  cfg,
  system,
  user,
  temperature = 0.7,
  maxTokens = 800,
}) {
  if (!cfg?.chatDeployment) return null;

  try {
    const token = await getAccessToken();
    const res = await fetch(
      deploymentUrl(cfg, cfg.chatDeployment, "chat/completions"),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        `  ! chat model returned ${res.status} ${res.statusText}.\n${text}`
      );
      return null;
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    const cleaned = content
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      console.warn("  ! chat model did not return parseable JSON.");
      return null;
    }
  } catch (err) {
    console.warn(`  ! chat model failed (${err.message}).`);
    return null;
  }
}

// Request one image from Azure OpenAI. When reference images are supplied
// (author headshot, article screenshots), use the image-edit endpoint
// (multipart) so the model can lean on them for likeness and visual context;
// otherwise use pure text-to-image generation. Returns the raw `fetch` Response
// so callers can report status codes themselves.
export async function requestImage({
  cfg,
  prompt,
  images = [],
  size = "1536x1024",
  quality = "medium",
}) {
  const token = await getAccessToken();

  if (images.length > 0) {
    const form = new FormData();
    form.append("prompt", prompt);
    form.append("size", size);
    form.append("quality", quality);
    form.append("n", "1");
    const field = images.length > 1 ? "image[]" : "image";
    for (const img of images) {
      form.append(
        field,
        new Blob([img.buffer], { type: "image/png" }),
        img.filename
      );
    }
    return fetch(deploymentUrl(cfg, cfg.deployment, "images/edits"), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  }

  return fetch(deploymentUrl(cfg, cfg.deployment, "images/generations"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, size, quality, n: 1 }),
  });
}

// Pull the base64 payload out of an image response, or return null.
export async function readImageBase64(res) {
  const json = await res.json();
  return json?.data?.[0]?.b64_json ?? null;
}
