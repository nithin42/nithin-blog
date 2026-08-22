const { app } = require("@azure/functions");

// Basic RFC-5322-ish email sanity check. The provider does the authoritative
// validation; this just avoids obviously bad input reaching the API.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROVIDER_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 1_024;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1_000;
const RATE_LIMIT_MAX_CLIENTS = 1_000;
// This is a worker-local abuse brake. Distributed enforcement belongs at the
// Azure edge because Functions instances do not share process memory.
const instanceRateLimits = new Map();

function clientAddress(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",").at(-1)?.trim().slice(0, 128) || "unknown";
}

function hostOf(value) {
  if (!value) return "";
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return "";
  }
}

function splitHeaderList(value) {
  return (value ?? "")
    .split(",")
    .map(entry => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Hosts this function is willing to accept browser form posts from.
 *
 * Static Web Apps proxies `/api/*` to a managed Functions host, so `request.url`
 * carries that internal hostname rather than the one the browser typed. Deriving
 * the expected origin from `request.url` therefore rejects every real browser
 * request, because browsers send `Origin` on POST even when it is same-origin.
 *
 * Testing against a deployed environment showed Static Web Apps does not pass
 * the public hostname through in `x-forwarded-host` or `host` either, so
 * ALLOWED_ORIGINS is the source of truth in production and must list every
 * hostname the site is served from. The forwarded headers are kept as a
 * fallback so local `swa start` development works without extra configuration.
 *
 * Neither source is attacker-controlled from a browser: a cross-site page cannot
 * add its own forwarded headers without tripping a CORS preflight that this
 * function never answers.
 */
function allowedHosts(request) {
  const configured = splitHeaderList(process.env.ALLOWED_ORIGINS).map(
    entry => hostOf(entry) || entry
  );

  const forwarded = [
    ...splitHeaderList(request.headers.get("x-forwarded-host")),
    ...splitHeaderList(request.headers.get("host")),
  ];

  return new Set([...configured, ...forwarded].filter(Boolean));
}

function isAllowedOrigin(request) {
  const origin = request.headers.get("origin");
  // Non-browser clients omit Origin, and there is no cross-site risk to defend
  // against when no browser is involved.
  if (!origin) return true;

  const originHost = hostOf(origin);
  if (!originHost) return false;

  return allowedHosts(request).has(originHost);
}

function consumeRateLimit(request, now = Date.now()) {
  const key = clientAddress(request);
  const existing = instanceRateLimits.get(key);
  const current =
    !existing || now - existing.startedAt >= RATE_LIMIT_WINDOW_MS
      ? { startedAt: now, count: 0 }
      : existing;

  current.count += 1;
  instanceRateLimits.delete(key);
  instanceRateLimits.set(key, current);

  for (const [client, limit] of instanceRateLimits) {
    if (now - limit.startedAt >= RATE_LIMIT_WINDOW_MS) {
      instanceRateLimits.delete(client);
    }
  }
  while (instanceRateLimits.size > RATE_LIMIT_MAX_CLIENTS) {
    instanceRateLimits.delete(instanceRateLimits.keys().next().value);
  }

  return {
    allowed: current.count <= RATE_LIMIT_MAX,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((current.startedAt + RATE_LIMIT_WINDOW_MS - now) / 1_000)
    ),
  };
}

async function readBoundedBody(request) {
  if (request.body && typeof request.body.getReader === "function") {
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let byteLength = 0;
    let text = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_BODY_BYTES) {
        await reader.cancel();
        return { tooLarge: true, text: "" };
      }
      text += decoder.decode(value, { stream: true });
    }

    text += decoder.decode();
    return { tooLarge: false, text };
  }

  const text = await request.text();
  return {
    tooLarge: Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES,
    text,
  };
}

/**
 * Subscribe an email address to the configured newsletter provider.
 *
 * The provider API key is read from Azure app settings (environment variables)
 * so it is never exposed to the browser. Configure ONE provider:
 *
 *   Buttondown:
 *     NEWSLETTER_PROVIDER=buttondown
 *     BUTTONDOWN_API_KEY=<token>
 *
 *   Mailchimp:
 *     NEWSLETTER_PROVIDER=mailchimp
 *     MAILCHIMP_API_KEY=<key-with-dc-suffix, e.g. abc123-us21>
 *     MAILCHIMP_LIST_ID=<audience id>
 *
 * If no provider is configured the endpoint returns 501 and the form shows a
 * friendly "not available yet" message — it never silently discards a signup.
 */
async function subscribeButtondown(email) {
  const key = process.env.BUTTONDOWN_API_KEY;
  if (!key) {
    return { ok: false, status: 501, message: "Newsletter is not configured." };
  }

  const res = await fetch("https://api.buttondown.email/v1/subscribers", {
    method: "POST",
    headers: {
      Authorization: `Token ${key}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    body: JSON.stringify({ email_address: email }),
  });

  if (res.ok) {
    return {
      ok: true,
      status: 200,
      message: "You're subscribed. Thanks for joining!",
    };
  }

  // Buttondown flags a duplicate with an explicit error code, so match on that
  // rather than on the text of the response. A loose text match also catches
  // genuine failures such as `subscriber_blocked`, which would report a signup
  // as successful while silently dropping it.
  let payload = null;
  try {
    payload = JSON.parse(await res.text());
  } catch {
    /* non-JSON error body */
  }

  if (res.status === 400 && payload?.code === "email_already_exists") {
    return { ok: true, status: 200, message: "You're already on the list." };
  }

  return {
    ok: false,
    status: 502,
    message: "Subscription failed. Please try again later.",
    upstreamStatus: res.status,
    // The detail string embeds the subscriber's address, so only the code is
    // safe to carry into logs.
    upstreamCode: typeof payload?.code === "string" ? payload.code : undefined,
  };
}

async function subscribeMailchimp(email) {
  const key = process.env.MAILCHIMP_API_KEY;
  const listId = process.env.MAILCHIMP_LIST_ID;
  if (!key || !listId) {
    return { ok: false, status: 501, message: "Newsletter is not configured." };
  }

  const dc = key.split("-")[1];
  if (!dc) {
    return { ok: false, status: 500, message: "Newsletter is misconfigured." };
  }

  const res = await fetch(
    `https://${dc}.api.mailchimp.com/3.0/lists/${listId}/members`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${key}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      body: JSON.stringify({ email_address: email, status: "subscribed" }),
    }
  );

  if (res.ok) {
    return {
      ok: true,
      status: 200,
      message: "You're subscribed. Thanks for joining!",
    };
  }

  let body = {};
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }

  if (res.status === 400 && body.title === "Member Exists") {
    return { ok: true, status: 200, message: "You're already on the list." };
  }

  return {
    ok: false,
    status: 502,
    message: "Subscription failed. Please try again later.",
    upstreamStatus: res.status,
  };
}

async function handler(request, context) {
  const json = (status, payload, additionalHeaders = {}) => ({
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      ...additionalHeaders,
    },
    jsonBody: payload,
  });

  const provider = (process.env.NEWSLETTER_PROVIDER || "").toLowerCase();
  const available =
    (provider === "buttondown" && Boolean(process.env.BUTTONDOWN_API_KEY)) ||
    (provider === "mailchimp" &&
      Boolean(
        process.env.MAILCHIMP_API_KEY?.includes("-") &&
        process.env.MAILCHIMP_LIST_ID
      ));

  if (request.method === "GET") {
    return json(200, {
      available,
      message: available
        ? "Newsletter sign-up is available."
        : "Newsletter sign-up isn't available yet — check back soon.",
    });
  }

  if (!isAllowedOrigin(request)) {
    return json(403, { ok: false, message: "Request origin is not allowed." });
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return json(415, { ok: false, message: "Request must be JSON." });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json(413, { ok: false, message: "Request is too large." });
  }

  const body = await readBoundedBody(request);
  if (body.tooLarge) {
    return json(413, { ok: false, message: "Request is too large." });
  }

  let data;
  try {
    data = JSON.parse(body.text);
  } catch {
    return json(400, { ok: false, message: "Invalid request." });
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return json(400, { ok: false, message: "Invalid request." });
  }

  const rateLimit = consumeRateLimit(request);
  if (!rateLimit.allowed) {
    return json(
      429,
      {
        ok: false,
        message: "Too many subscription attempts. Please try again later.",
      },
      { "Retry-After": String(rateLimit.retryAfterSeconds) }
    );
  }

  // Honeypot: real users leave this empty. Bots fill it in.
  if (data && typeof data.website === "string" && data.website.trim() !== "") {
    // Pretend success so bots don't learn they were caught.
    return json(200, {
      ok: true,
      message: "You're subscribed. Thanks for joining!",
    });
  }

  const email =
    typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return json(400, {
      ok: false,
      message: "Please enter a valid email address.",
    });
  }

  let result;
  try {
    if (provider === "buttondown") {
      result = await subscribeButtondown(email);
    } else if (provider === "mailchimp") {
      result = await subscribeMailchimp(email);
    } else {
      result = {
        ok: false,
        status: 501,
        message: "Newsletter sign-up isn't available yet — check back soon.",
      };
    }
  } catch (err) {
    context.error("Newsletter subscription error", err);
    return json(502, {
      ok: false,
      message: "Subscription failed. Please try again later.",
    });
  }

  if (!result.ok && result.upstreamStatus) {
    context.warn(
      `Newsletter provider rejected signup with status ${result.upstreamStatus}${
        result.upstreamCode ? ` (${result.upstreamCode})` : ""
      }.`
    );
  }

  return json(result.status, { ok: result.ok, message: result.message });
}

app.http("subscribe", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "subscribe",
  handler,
});

module.exports = {
  handler,
  resetRateLimitsForTests: () => instanceRateLimits.clear(),
};
