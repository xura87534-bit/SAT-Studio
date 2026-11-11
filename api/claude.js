// POST /api/claude  { prompt: string, json: boolean }
// Streams Claude's reply back as plain text. Only signed-in users may call it,
// and each user gets a daily request allowance by plan: FREE_DAILY_AI_LIMIT on the
// free plan, DAILY_AI_LIMIT on Pro (see supabase/billing-2026-11.sql).
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
const DAILY_LIMIT = Number(process.env.DAILY_AI_LIMIT || 150); // Pro
const FREE_DAILY_LIMIT = Number(process.env.FREE_DAILY_AI_LIMIT || 10);
// Optional: a different model per plan. Unset = CLAUDE_MODEL for everyone.
const MODEL_FREE = process.env.CLAUDE_MODEL_FREE || MODEL;
const MODEL_PRO = process.env.CLAUDE_MODEL_PRO || MODEL;
// Ceiling across ALL users per UTC day, so a wave of throwaway accounts can't drain the API budget.
const GLOBAL_DAILY_LIMIT = Number(process.env.GLOBAL_DAILY_AI_LIMIT || 3000);
const MAX_PROMPT_CHARS = 60000;

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY

const JSON_SYSTEM =
  "You generate content for an SAT practice app. Reply with only the JSON the user asks for: no prose, no markdown code fences.";
const CHAT_SYSTEM = "You are a patient SAT tutor inside a practice app. Follow the formatting rules in the user's message.";

export async function POST(request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return new Response("Sign in first.", { status: 401 });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return new Response("Sign in again.", { status: 401 });

  let body;
  try { body = await request.json(); } catch { return new Response("Bad request.", { status: 400 }); }
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  if (!prompt.trim() || prompt.length > MAX_PROMPT_CHARS) return new Response("Prompt missing or too long.", { status: 400 });

  // Counts this call against the user's allowance; runs as the user, so RLS keys it to them.
  let plan = "pro", limit = DAILY_LIMIT, status;
  const { data: credit, error: planErr } = await supabase.rpc("use_ai_credit_plan", { p_free: FREE_DAILY_LIMIT, p_pro: DAILY_LIMIT, p_global: GLOBAL_DAILY_LIMIT });
  if (!planErr && credit) {
    ({ status, plan, limit } = credit);
  } else if (planErr && (planErr.code === "PGRST202" || planErr.code === "42883")) {
    // billing-2026-11.sql hasn't been run yet: keep the one-limit-for-everyone behaviour.
    const { data: allowed, error: rateErr } = await supabase.rpc("use_ai_credit", { p_limit: DAILY_LIMIT, p_global: GLOBAL_DAILY_LIMIT });
    if (rateErr) { console.error("use_ai_credit failed", rateErr); return new Response("Couldn't check your Claude allowance.", { status: 500 }); }
    status = allowed;
  } else {
    console.error("use_ai_credit_plan failed", planErr);
    return new Response("Couldn't check your Claude allowance.", { status: 500 });
  }
  if (status === "global") return new Response("Claude is at capacity for today. Try again tomorrow.", { status: 429 });
  if (status !== "ok") {
    const msg = plan === "free"
      ? `You've used today's ${limit} free Claude answers. Go Pro for ${DAILY_LIMIT} a day, or come back tomorrow.`
      : `You've used today's ${limit} Claude requests. They reset at midnight UTC.`;
    return new Response(msg, { status: 429, headers: { "x-sat-plan": plan } });
  }

  const model = plan === "free" ? MODEL_FREE : MODEL_PRO;
  // Haiku has no server-side refusal fallback, and rejects a fallback list.
  const fallback = /haiku/.test(model) ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
  const json = !!body.json;
  const stream = anthropic.beta.messages.stream(
    {
      model,
      max_tokens: json ? 32000 : 4000,
      system: json ? JSON_SYSTEM : CHAT_SYSTEM,
      output_config: { effort: json ? "medium" : "low" },
      messages: [{ role: "user", content: prompt }],
      ...fallback, // a declined request is retried on Anthropic's recommended fallback model
    },
    { signal: request.signal },
  );

  const enc = new TextEncoder();
  const out = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(enc.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") controller.enqueue(enc.encode("\u0000ERR:Claude couldn't help with this request."));
      } catch (e) {
        if (!request.signal.aborted) {
          console.error("claude stream failed", e);
          controller.enqueue(enc.encode("\u0000ERR:Claude is busy right now. Try again in a minute."));
        }
      } finally {
        controller.close();
      }
    },
    cancel() { stream.abort(); },
  });
  return new Response(out, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
