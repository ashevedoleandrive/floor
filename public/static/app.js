/* Floor client. Small on purpose; the server owns every number.
   The client's job is to make the queue feel operated, not browsed:
   instant filter, sort and search, drill-down under every row, and a
   live stage tracker while an assessment runs. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const post = (url, body) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json());

const fmt = (n) => {
  if (n == null || isNaN(n)) return "";
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return Math.round(n / 1e3) + "k";
  return String(Math.round(n));
};
const clock = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const escT = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Interface copy, resolved to one language server-side and emitted by the
   shell as window.FLOOR_I18N. The client never ships a second dictionary;
   English literals below are fallbacks only, so nothing can render blank. */
const I18N = window.FLOOR_I18N || { lang: "en", copy: {} };
const LANG = I18N.lang || "en";
const T = (key, fallback, vars) => {
  let s = I18N.copy?.[key] ?? fallback ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
};

/* ================================ queue ================================ */

const qbody = $("#qbody");

const state = { band: "all", text: "" };

function applyQueueView() {
  if (!qbody) return;
  const rows = $$("tr.r", qbody);
  const visibleByBand = {};
  for (const tr of rows) {
    const bandOk = state.band === "all" || tr.dataset.band === state.band;
    const textOk = !state.text || (tr.dataset.name || "").includes(state.text);
    const show = bandOk && textOk;
    tr.style.display = show ? "" : "none";
    const xp = tr.nextElementSibling;
    if (xp?.classList.contains("xp")) {
      xp.style.display = show && tr.getAttribute("aria-expanded") === "true" ? "table-row" : "none";
    }
    if (show) visibleByBand[tr.dataset.band] = (visibleByBand[tr.dataset.band] || 0) + 1;
  }
  for (const g of $$("tr.grp", qbody)) {
    g.style.display = visibleByBand[g.dataset.band] ? "" : "none";
  }
}

$$(".f[data-f]").forEach((b) => b.addEventListener("click", () => {
  $$(".f[data-f]").forEach((x) => x.classList.remove("on"));
  b.classList.add("on");
  state.band = b.dataset.f;
  applyQueueView();
}));

const qsearch = $("#qsearch");
if (qsearch) qsearch.addEventListener("input", () => {
  state.text = qsearch.value.trim().toLowerCase();
  applyQueueView();
});

/* Row drill-down: click anywhere on the row that is not a link or button. */
if (qbody) {
  qbody.addEventListener("click", (e) => {
    if (e.target.closest("a, button, input")) return;
    const tr = e.target.closest("tr.r");
    if (!tr) return;
    toggleRow(tr);
  });
  qbody.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const tr = e.target.closest?.("tr.r");
    if (!tr || e.target !== tr) return;
    e.preventDefault();
    toggleRow(tr);
  });
}
function toggleRow(tr) {
  const open = tr.getAttribute("aria-expanded") === "true";
  tr.setAttribute("aria-expanded", open ? "false" : "true");
  const xp = tr.nextElementSibling;
  if (xp?.classList.contains("xp")) xp.style.display = open ? "none" : "table-row";
}

/* Sort within band groups. Rank order is the product's opinion; sorting is
   the operator's question, so it re-orders inside each band, never across. */
$$("th.sortable").forEach((th) => th.addEventListener("click", () => {
  const key = th.dataset.sort;
  const dir = th.dataset.dir === "desc" ? "asc" : "desc";
  $$("th.sortable").forEach((x) => { delete x.dataset.dir; x.classList.remove("s-on"); });
  th.dataset.dir = dir;
  th.classList.add("s-on");

  // Walk the tbody into groups: [grp header, [row, xp] pairs...]
  const nodes = [...qbody.children];
  const groups = [];
  let cur = null;
  for (const n of nodes) {
    if (n.classList.contains("grp")) { cur = { head: n, pairs: [] }; groups.push(cur); }
    else if (n.classList.contains("r")) {
      const xp = n.nextElementSibling?.classList.contains("xp") ? n.nextElementSibling : null;
      cur?.pairs.push([n, xp]);
    }
  }
  for (const g of groups) {
    g.pairs.sort((a, b) => {
      const av = Number(a[0].dataset[key] ?? -1), bv = Number(b[0].dataset[key] ?? -1);
      return dir === "desc" ? bv - av : av - bv;
    });
    let anchor = g.head;
    for (const [r, xp] of g.pairs) {
      anchor.after(r);
      if (xp) r.after(xp);
      anchor = xp || r;
    }
  }
}));

/* Assess-now buttons inside expanded unscored rows. */
$$(".assess-now").forEach((b) => b.addEventListener("click", () => {
  const form = $("#assess-form");
  const input = $("#assess-domain");
  if (!form || !input) return;
  input.value = b.dataset.domain;
  form.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  form.requestSubmit();
}));

/* Cool-down tunable: debounce, persist, re-rank. */
const cooldown = $("#cooldown");
if (cooldown) {
  let t;
  cooldown.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      await post("/api/settings", { cooldown_days: cooldown.value });
      location.reload();
    }, 700);
  });
}

/* ============================ the live run ============================= */

const STAGES = [
  ["research", T("stage.research", "Research"), T("stage.research.blurb", "searching public sources, keeping the URLs it reads")],
  ["extract", T("stage.extract", "Extract"), T("stage.extract.blurb", "turning prose into typed, cited claims")],
  ["critic", T("stage.critic", "Critic"), T("stage.critic.blurb", "adversarial pass, trying to refute every claim")],
  ["scoring", T("stage.score", "Score"), T("stage.score.blurb", "deterministic arithmetic, no model")],
];

function stageTracker(domain, stageKey, elapsedMs, stageStarts) {
  const idx = Math.max(STAGES.findIndex(([k]) => k === stageKey), 0);
  return `<div class="stages">
    <div class="stg-head">
      <span class="who">${escT(T("run.assessing", "Assessing"))} <span class="dom">${escT(domain)}</span></span>
      <span class="el">${clock(elapsedMs)}</span>
    </div>
    ${STAGES.map(([k, name, blurb], i) => {
      const st = i < idx ? "done" : i === idx ? "active" : "";
      const took = i < idx && stageStarts[k] != null && stageStarts[STAGES[i + 1]?.[0]] != null
        ? clock(stageStarts[STAGES[i + 1][0]] - stageStarts[k]) : "";
      return `<div class="stg ${st}">
        <span class="dot">${i < idx ? "✓" : ""}</span>
        <span class="lab"><b>${name}</b> ${blurb}</span>
        <span class="rt">${i === idx ? clock(elapsedMs - (stageStarts[k] ?? elapsedMs)) : took}</span>
        ${i === idx ? `<span class="bar"><i></i></span>` : ""}
      </div>`;
    }).join("")}
  </div>`;
}

function resultCard(domain, job, detail, elapsedMs) {
  const a = detail?.assessment || {};
  const sc = detail?.scored || {};
  const link = `<a href="/account/${encodeURIComponent(domain)}">${escT(T("run.openFull", "Open the full evidence →"))}</a>`;
  const meta = `<span class="meta">$${Number(job.cost_usd || 0).toFixed(5)} · ${clock(elapsedMs)}<br>${link}</span>`;
  if (a.abstained) {
    // The reason is verbatim model output, stored in English by design.
    // On the Spanish interface, say so rather than quietly mixing languages.
    const verbatim = LANG === "es" ? ` <span class="verbatim">${escT(T("ev.verbatim", "model output, stored verbatim in English"))}</span>` : "";
    return `<div class="res abstain"><div>
      <span class="lbl">${escT(T("verdict.abstained", "Abstained"))}</span>
      <span class="big">${escT(T("verdict.noEstimate", "No estimate issued"))}</span>
      <p class="sub">${escT(a.abstain_reason || T("run.noCarry", "Evidence would not carry a number."))}${a.abstain_reason ? verbatim : ""}</p>
    </div>${meta}</div>`;
  }
  const label = sc.floor_verdict === "clears" ? T("verdict.clears", "Clears the floor")
    : sc.floor_verdict === "borderline" ? T("verdict.borderline", "Straddles the floor") : T("verdict.below", "Below the floor");
  return `<div class="res ${escT(sc.floor_verdict || "borderline")}"><div>
    <span class="lbl">${escT(label)}</span>
    <span class="big">${fmt(a.txn_mid)} <span style="font-size:14px;color:var(--ink-4);font-family:var(--sans)">${escT(T("unit.txnMo", "txn / mo"))}</span></span>
    <p class="sub">${T("acct.rangeConf", "range {min}&ndash;{max} · confidence {conf}", { min: fmt(a.txn_min), max: fmt(a.txn_max), conf: `${Math.round((a.confidence || 0) * 100)}%` })}</p>
  </div>${meta}</div>`;
}

const assessForm = $("#assess-form");
if (assessForm) {
  assessForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const domain = $("#assess-domain").value.trim();
    if (!domain) return;
    const out = $("#assess-out");
    const btn = assessForm.querySelector("button[type=submit]");
    btn.disabled = true;
    const t0 = Date.now();
    const stageStarts = { research: 0 };
    let currentStage = "research";
    out.innerHTML = stageTracker(domain, "research", 0, stageStarts);

    let ticker, poll;
    const stop = () => { clearInterval(ticker); clearInterval(poll); btn.disabled = false; };

    try {
      const start = await post("/api/assess", { domain, last_touched_at: $("#assess-touched").value || null });
      if (start.cached) {
        out.innerHTML = `<div class="res abstain"><div><span class="lbl">${escT(T("run.cachedMode", "Cached mode"))}</span><p class="sub">${escT(start.note)}</p></div></div>`;
        btn.disabled = false; return;
      }
      if (!start.job_id) {
        out.innerHTML = `<p class="res-err">${T("run.stopped", "Stopped: {err}", { err: escT(start.error || "unknown") })}</p>`;
        btn.disabled = false; return;
      }

      // One-second ticker keeps the elapsed clock honest between polls.
      ticker = setInterval(() => {
        out.innerHTML = stageTracker(domain, currentStage, Date.now() - t0, stageStarts);
      }, 1000);

      poll = setInterval(async () => {
        let j;
        try { j = await fetch(`/api/job/${start.job_id}`).then((r) => r.json()); }
        catch { return; }
        const job = j.job || {};
        if (job.status === "running" || job.status === "queued") {
          if (job.stage && job.stage !== currentStage) {
            currentStage = job.stage;
            if (stageStarts[currentStage] == null) stageStarts[currentStage] = Date.now() - t0;
          }
          return;
        }
        stop();
        const elapsed = Date.now() - t0;
        if (job.status === "error") {
          out.innerHTML = `<p class="res-err">${T("run.stoppedAfter", "Stopped after {t}: {err}", { t: clock(elapsed), err: escT(job.detail || "error") })}</p>`;
          return;
        }
        out.innerHTML = resultCard(domain, job, j.detail, elapsed);
        setTimeout(() => location.reload(), 6000);
      }, 2500);
    } catch (err) {
      stop();
      out.innerHTML = `<p class="res-err">${T("run.error", "Error: {err}", { err: escT(err.message) })}</p>`;
    }
  });
}

/* ============================ add accounts ============================= */

const addOpen = $("#add-open");
if (addOpen) {
  addOpen.addEventListener("click", () => $("#add-dlg").showModal());
  $("#add-go")?.addEventListener("click", async () => {
    const text = $("#add-text").value.trim();
    if (!text) return;
    await post("/api/import", { text });
    location.reload();
  });
}

/* ============================== backlog ================================ */

const cardOpen = $("#card-open");
if (cardOpen) {
  cardOpen.addEventListener("click", () => $("#card-dlg").showModal());
  $("#c-save")?.addEventListener("click", async () => {
    const title = $("#c-title").value.trim();
    if (!title) return;
    await post("/api/backlog", {
      area: $("#c-area").value, title, gap: $("#c-gap").value,
      metric: $("#c-metric").value, owner: $("#c-owner").value, status: $("#c-status").value,
    });
    location.reload();
  });
}

/* =============================== evals ================================= */

$$(".verify").forEach((b) => b.addEventListener("click", () => {
  $("#g-domain").value = b.dataset.domain;
  $("#g-metric").value = b.dataset.metric || "";
  $("#gold-dlg").showModal();
}));
$("#g-save")?.addEventListener("click", async () => {
  const r = await post("/api/gold", {
    domain: $("#g-domain").value, disclosed_metric: $("#g-metric").value,
    disclosed_value: $("#g-value").value, period: $("#g-period").value, source_url: $("#g-url").value,
  });
  if (!r.ok) { alert(T("common.notSaved", "Not saved: {err}", { err: r.error })); return; }
  location.reload();
});
$("#run-eval")?.addEventListener("click", async (e) => {
  e.target.disabled = true; e.target.textContent = T("eval.running", "running…");
  const r = await post("/api/evals/run", {});
  if (!r.ok) { alert(r.note || r.error); e.target.disabled = false; e.target.textContent = T("eval.run", "Run eval"); return; }
  location.reload();
});

/* ==================== account page: evidence + trace =================== */

$$(".f[data-ef]").forEach((b) => b.addEventListener("click", () => {
  $$(".f[data-ef]").forEach((x) => x.classList.remove("on"));
  b.classList.add("on");
  const f = b.dataset.ef;
  $$("#evbody tr").forEach((tr) => {
    tr.style.display = f === "all" || tr.dataset.ev === f ? "" : "none";
  });
}));

$$(".tr .tr-head[role=button]").forEach((h) => {
  const toggle = () => {
    const body = h.nextElementSibling;
    const open = h.getAttribute("aria-expanded") === "true";
    h.setAttribute("aria-expanded", open ? "false" : "true");
    h.parentElement.dataset.open = open ? "false" : "true";
    if (body) body.hidden = open;
  };
  h.addEventListener("click", toggle);
  h.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
});

/* ============================ sources page ============================= */

$$(".src .src-head").forEach((h) => {
  const toggle = () => {
    const body = h.nextElementSibling;
    const open = h.getAttribute("aria-expanded") === "true";
    h.setAttribute("aria-expanded", open ? "false" : "true");
    h.parentElement.dataset.open = open ? "false" : "true";
    if (body) body.hidden = open;
  };
  h.addEventListener("click", toggle);
  h.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
});

/* ============================ impact model ============================= */

const mInputs = ["m-sdrs","m-worked","m-mins","m-mins2","m-conv","m-conv2","m-win","m-win2","m-acv","m-cost"]
  .map((id) => $("#" + id)).filter(Boolean);

const tick = (el) => {
  el.classList.remove("tick");
  void el.offsetWidth; // restart the animation
  el.classList.add("tick");
};

function recompute(first) {
  const v = (id) => Number($("#" + id)?.value || 0);
  const sdrs = v("m-sdrs"), worked = v("m-worked");
  const mins = v("m-mins"), mins2 = v("m-mins2");
  const conv = v("m-conv") / 100, conv2 = v("m-conv2") / 100;
  const acv = v("m-acv"), cost = v("m-cost");

  const accountsNow = sdrs * worked;
  const hoursNow = (accountsNow * mins) / 60;
  const hoursNew = (accountsNow * mins2) / 60;
  const freed = hoursNow - hoursNew;
  // The freed hours are what pays for working more accounts, at the same
  // per-account research cost as the new (faster) process.
  const extra = mins2 > 0 ? Math.floor((freed * 60) / mins2) : 0;
  const opps = accountsNow * (conv2 - conv);
  const monthlyCost = (accountsNow + extra) * cost;

  const set = (id, text) => {
    const el = $("#" + id);
    if (!el || el.textContent === text) return;
    el.textContent = text;
    if (!first) tick(el);
  };
  set("o-hours", `${Math.round(freed)} h`);
  set("o-extra", `+${extra.toLocaleString()}`);
  set("o-opps", `+${opps.toFixed(1)}`);
  set("o-cost", `$${monthlyCost.toFixed(2)}`);

  const oValue = $("#o-value");
  if (acv > 0) {
    const annual = opps * 12 * acv * (v("m-win2") / 100);
    oValue.classList.remove("held-v");
    set("o-value", `$${Math.round(annual).toLocaleString()}`);
    const ratio = monthlyCost > 0 ? annual / (monthlyCost * 12) : 0;
    set("o-ratio", T("m.ratio", "at your {w}% target win rate · {r}x the tool's annual run cost", { w: v("m-win2"), r: Math.round(ratio).toLocaleString() }));
  } else {
    oValue.classList.add("held-v");
    set("o-value", T("m.enterAcv", "enter your ACV"));
    set("o-ratio", T("m.noInvent", "This tool will not invent your average contract value. Its whole argument is that its numbers can be trusted."));
  }
}
if (mInputs.length) { mInputs.forEach((i) => i.addEventListener("input", () => recompute(false))); recompute(true); }

/* ===================== source classification rules ===================== */
/* Operator-owned config. These people will not have access to whoever wrote
   the code, so every rule has to be readable and changeable from this page. */

const rulesBody = $("#rulesbody");
if (rulesBody) {
  const TIER_LABEL = {
    primary_filing: T("tier.primary", "Regulatory filing"),
    self_published: T("tier.self", "Company statement"),
    documentation: T("tier.doc", "Product documentation"),
    third_party: T("tier.third", "Third-party estimate"),
    unclassified: T("tier.unclassified", "Unclassified"),
  };

  const paint = (d) => {
    const rows = (d.rules || []).map((r) => `
      <tr class="${r.enabled ? "" : "off"}">
        <td class="num mono">${r.position}</td>
        <td class="mono">${escT(r.pattern)}</td>
        <td><span class="tier t-${escT(r.tier)}">${escT(r.label || TIER_LABEL[r.tier] || r.tier)}</span>${r.enabled ? "" : ` <span class="tier t-unclassified">${escT(T("rules.off", "off"))}</span>`}</td>
        <td class="num mono">${Number(r.weight).toFixed(2)}</td>
        <td class="num mono">${r.enabled ? (r.matches || 0) : "&ndash;"}</td>
        <td class="m">${escT(r.note || "")}</td>
        <td class="num">
          <button class="btn tiny ghost rule-toggle" data-id="${r.id}">${r.enabled ? escT(T("rules.disable", "Disable")) : escT(T("rules.enable", "Enable"))}</button>
          ${r.builtin ? "" : `<button class="btn tiny ghost rule-del" data-id="${r.id}">${escT(T("rules.delete", "Delete"))}</button>`}
        </td>
      </tr>`).join("");
    rulesBody.innerHTML = rows || `<tr><td colspan="7"><p class="empty">${escT(T("rules.empty", "No rules. Every source will fall through to unclassified."))}</p></td></tr>`;
    const foot = $("#rules-foot");
    if (foot) {
      foot.innerHTML = T("rules.footA", "{total} stored claims classified · <b>{unmatched}</b> matched no rule and fell through to unclassified at weight {w}.", { total: d.total || 0, unmatched: d.unmatched || 0, w: d.fallback_weight })
        + " " + (d.unmatched ? T("rules.footB", "Those are the domains worth adding a rule for.") : T("rules.footC", "Every source seen so far is classified."));
    }
    bind();
  };

  const bind = () => {
    $$(".rule-toggle").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true;
      paint(await post("/api/source-rules", { toggle_id: Number(b.dataset.id) }));
    }));
    $$(".rule-del").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true;
      paint(await post("/api/source-rules", { delete_id: Number(b.dataset.id) }));
    }));
  };

  fetch("/api/source-rules").then((r) => r.json()).then(paint).catch(() => {
    rulesBody.innerHTML = `<tr><td colspan="7"><p class="empty">${escT(T("rules.loadFail", "Could not load rules."))}</p></td></tr>`;
  });

  $("#rule-open")?.addEventListener("click", () => $("#rule-dlg").showModal());
  $("#r-save")?.addEventListener("click", async () => {
    const pattern = $("#r-pattern").value.trim();
    if (!pattern) return;
    const d = await post("/api/source-rules", {
      pattern,
      tier: $("#r-tier").value,
      label: $("#r-label").value.trim() || undefined,
      weight: Number($("#r-weight").value),
      position: Number($("#r-position").value),
      note: $("#r-note").value.trim() || undefined,
    });
    if (d.ok === false) { alert(T("common.notSaved", "Not saved: {err}", { err: d.error })); return; }
    $("#r-pattern").value = ""; $("#r-note").value = "";
    paint(d);
  });
}
