import Anthropic from "@anthropic-ai/sdk";

/**
 * Per-MTok pricing, used for the cost-per-account figure the demo shows.
 * Source: Anthropic published rates.
 *   Sonnet 5 carries introductory pricing of $2 / $10 per MTok through
 *   2026-08-31; standard is $3 / $15. We compute BOTH and report the standard
 *   rate as the headline so the number can only be pessimistic, never
 *   optimistically wrong in front of the people being pitched.
 * Cached reads bill at ~0.1x input; cache writes at ~1.25x input (5m TTL).
 */
export const PRICING = {
  "claude-opus-5":   { in: 5.00, out: 25.00 },
  "claude-sonnet-5": { in: 3.00, out: 15.00, introIn: 2.00, introOut: 10.00, introUntil: "2026-08-31" },
  "claude-haiku-4-5":{ in: 1.00, out:  5.00 },
};

/**
 * Web search is billed per search request on top of tokens. We do NOT hardcode
 * a price we have not verified — the search COUNT is recorded per call and
 * surfaced separately, with the per-search rate configurable in settings.
 * A number we cannot source does not get asserted on screen.
 */
export const DEFAULT_SEARCH_USD = 0; // set via settings.search_usd_per_call

export function priceCall(model, usage, searchUsdPerCall = 0, searches = 0) {
  const p = PRICING[model] || PRICING["claude-sonnet-5"];
  const inTok    = usage?.input_tokens ?? 0;
  const outTok   = usage?.output_tokens ?? 0;
  const cacheRd  = usage?.cache_read_input_tokens ?? 0;
  const cacheWr  = usage?.cache_creation_input_tokens ?? 0;
  const M = 1_000_000;
  const tokenCost =
    (inTok   / M) * p.in +
    (outTok  / M) * p.out +
    (cacheRd / M) * p.in * 0.1 +
    (cacheWr / M) * p.in * 1.25;
  return {
    tokenCost,
    searchCost: searches * searchUsdPerCall,
    total: tokenCost + searches * searchUsdPerCall,
    inTok, outTok, cacheRd, cacheWr,
  };
}

/** Count the server-side web searches Claude actually ran this turn. */
function countSearches(content) {
  return (content || []).filter(
    (b) => b.type === "server_tool_use" && b.name === "web_search"
  ).length;
}

/**
 * Pull every distinct source URL the search tool returned, AND every search
 * error it hit.
 *
 * The errors matter as much as the results. Server-tool failures come back as
 * HTTP 200 with an error object inside the result block, not as an exception —
 * so silently skipping them lets a run report "6 searches" while every one of
 * them returned nothing. That happened on the very first production run: all
 * six searches failed, the extractor then reconstructed seven plausible claims
 * from prior knowledge with guessed URLs, and only the critic caught it.
 * Search health is now a first-class signal, not an inference.
 */
export function collectSources(content) {
  const out = [];
  const errors = [];
  for (const block of content || []) {
    if (block.type !== "web_search_tool_result") continue;
    const c = block.content;
    // On success .content is a LIST of web_search_result.
    // On failure it is an OBJECT carrying error_code. Branch before indexing.
    if (!Array.isArray(c)) {
      if (c?.error_code) errors.push(c.error_code);
      continue;
    }
    for (const r of c) {
      if (r?.url) out.push({ url: r.url, title: r.title || null });
    }
  }
  const seen = new Set();
  const sources = out.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)));
  return { sources, errors };
}

/**
 * Join EVERY text block, not the first one.
 *
 * A response that interleaves web searches with commentary comes back as many
 * short text blocks split around the tool calls. Returning only content[0]
 * yields the model's opening line and silently discards the actual findings,
 * which is precisely what happened here: research reliably produced a good
 * cited brief, the pipeline read a 210-character preamble, and the critic
 * correctly reported that there was nothing to work with. The tool was not
 * failing to research. It was failing to read its own research.
 */
function allText(content) {
  return (content || [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n\n")
    .trim();
}

/** Structured-output responses put valid JSON in the first text block. */
function parseJson(content) {
  const t = allText(content).trim();
  if (!t) return null;
  try { return JSON.parse(t); } catch { /* fall through */ }
  // Defensive fallback: a fenced block, in case a model wraps it.
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) { try { return JSON.parse(m[1]); } catch { /* noop */ } }
  return null;
}

export class Model {
  constructor(env, budget) {
    this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    this.env = env;
    this.budget = budget;      // { remaining(), charge(usd, searches) }
    this.searchUsd = budget?.searchUsd ?? DEFAULT_SEARCH_USD;
    this.traces = [];
  }

  get spent() {
    return this.traces.reduce((a, t) => a + t.cost_usd, 0);
  }

  /**
   * One model call, fully instrumented.
   * Returns { ok, json, text, sources, trace } — never throws for a refusal or
   * a budget stop; both are reported as ok:false with a reason, because this
   * runs behind a public URL a panel is invited to hammer.
   */
  async call({ step, model, system, user, tools, schema, effort = "medium", maxTokens = 8000 }) {
    if (this.budget && this.budget.remaining() <= 0) {
      return { ok: false, reason: "budget_exhausted", trace: null };
    }

    const req = {
      model,
      max_tokens: maxTokens,
      // No temperature / top_p / top_k — removed on Opus 5 and Sonnet 5 (400).
      // Thinking is ON by default on both; max_tokens caps thinking + text
      // together, which is why these budgets are generous for small payloads.
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
      output_config: { effort },
    };
    if (tools) req.tools = tools;
    if (schema) req.output_config.format = { type: "json_schema", schema };

    const t0 = Date.now();
    let res, err = null;
    try {
      // STREAM, always. A research call with web search runs well past ninety
      // seconds, and a non-streaming request that long idles its connection
      // until Cloudflare drops it: the job dies mid-stage with no error and no
      // cost recorded. Three separate attempts died this way before the cause
      // was clear. Streaming keeps bytes moving, so the connection stays alive;
      // .finalMessage() gives back the same assembled Message the non-streaming
      // path would have returned, so nothing downstream changes.
      const stream = this.client.messages.stream(req);
      res = await stream.finalMessage();
    } catch (e) {
      err = e;
    }
    const latency = Date.now() - t0;

    if (err) {
      const trace = {
        step, model, effort, input_tokens: 0, output_tokens: 0, cache_read: 0,
        cache_write: 0, searches: 0, cost_usd: 0, latency_ms: latency,
        stop_reason: "error", note: String(err?.message || err).slice(0, 300),
      };
      this.traces.push(trace);
      return { ok: false, reason: "api_error", detail: trace.note, trace };
    }

    const searches = countSearches(res.content);
    const cost = priceCall(model, res.usage, this.searchUsd, searches);
    const trace = {
      step, model, effort,
      input_tokens: cost.inTok, output_tokens: cost.outTok,
      cache_read: cost.cacheRd, cache_write: cost.cacheWr,
      searches, cost_usd: cost.total, latency_ms: latency,
      stop_reason: res.stop_reason || null, note: null,
    };
    this.traces.push(trace);
    if (this.budget) await this.budget.charge(cost.total, searches);

    // Check stop_reason BEFORE reading content. Opus 5 ships elevated
    // safety classifiers; a decline is an HTTP 200 with empty/partial content,
    // not an exception. Reading content[0] unconditionally breaks here.
    if (res.stop_reason === "refusal") {
      trace.note = `refusal:${res.stop_details?.category || "unknown"}`;
      return { ok: false, reason: "refusal", detail: trace.note, trace };
    }

    const { sources, errors } = collectSources(res.content);
    if (errors.length) {
      trace.note = `search_errors:${[...new Set(errors)].join(",")}`;
    }
    // A research step that ran searches and got zero usable sources is a failed
    // step, not a thin one. Saying so here stops the next stage from filling
    // the gap with recalled facts.
    const searchFailed = tools && searches > 0 && sources.length === 0;

    return {
      ok: true,
      json: schema ? parseJson(res.content) : null,
      text: allText(res.content),
      sources,
      searchErrors: [...new Set(errors)],
      searchFailed,
      trace,
    };
  }
}
