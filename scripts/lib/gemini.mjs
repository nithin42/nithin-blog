import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_IMAGEN_MODEL = "imagen-3.0-generate-002";
export const DEFAULT_CHAT_MODEL = "gemini-2.5-flash";

export function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

export function loadConfig({ requireChat = false } = {}) {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      for (const line of envContent.split(/\r?\n/)) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let val = match[2] || '';
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  } catch {}

  const apiKey = process.env.GEMINI_API_KEY;
  const imageModel = process.env.GEMINI_IMAGE_MODEL || DEFAULT_IMAGEN_MODEL;
  const chatModel = process.env.GEMINI_CHAT_MODEL || DEFAULT_CHAT_MODEL;

  if (!apiKey) {
    fail(
      "Missing GEMINI_API_KEY. Set GEMINI_API_KEY in your .env or environment variables."
    );
  }

  return { apiKey, imageModel, chatModel };
}

// Derive a JSON brief using Gemini Chat
export async function requestChatJson({
  cfg,
  system,
  user,
  temperature = 0.7,
}) {
  if (!cfg?.apiKey) return null;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.chatModel}:generateContent?key=${cfg.apiKey}`;
    const payload = {
      system_instruction: {
        parts: [{ text: system }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: user }],
        },
      ],
      generationConfig: {
        temperature,
        responseMimeType: "application/json",
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.warn(`Gemini Chat API returned ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (err) {
    console.warn(`Gemini Chat error: ${err.message}`);
    return null;
  }
}

// Generate an image via Google Imagen 3
export async function requestImage({ cfg, prompt, aspectRatio = "16:9" }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.imageModel}:predict?key=${cfg.apiKey}`;
  const payload = {
    instances: [
      {
        prompt,
      },
    ],
    parameters: {
      sampleCount: 1,
      aspectRatio,
      outputMimeType: "image/jpeg",
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return res;
}
