/**
 * The settings screen.
 *
 * Every knob that changes how Floor behaves lives here, in one place, editable
 * without a terminal. Before this existed the floor threshold, the model routing
 * and the spend cap were reachable only through the API, which meant the tool
 * was fully operable only by whoever wrote it.
 *
 * Each setting states what it changes and what happens when you change it,
 * because a number in a form with no consequence attached is a trap.
 *
 * This lives in its own file rather than in views.js so it does not collide with
 * concurrent work on the main view layer.
 */

const esc = (s) => String(s ?? "")
  .replace(/\s*—\s*/g, ", ")
  .replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Model ids and display names are data; the one-line "why" is copy, so it is
   resolved per-language at render time via the keys in the third column. */
const MODELS = [
  ["claude-opus-5", "Opus 5", "set.modelOpus"],
  ["claude-sonnet-5", "Sonnet 5", "set.modelSonnet"],
  ["claude-haiku-4-5", "Haiku 4.5", "set.modelHaiku"],
];

function field({ id, label, value, hint, effect, type = "text", suffix = "", options = null }) {
  const input = options
    ? `<select id="${id}" class="set-input">${options.map(([v, l]) =>
        `<option value="${esc(v)}"${String(v) === String(value) ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`
    : `<input id="${id}" class="set-input" type="${type}" value="${esc(value)}">`;
  return `
  <div class="set-row" data-key="${id}">
    <div class="set-label">
      <label for="${id}">${esc(label)}</label>
      <span class="set-hint">${hint}</span>
    </div>
    <div class="set-control">${input}${suffix ? `<span class="set-suffix">${esc(suffix)}</span>` : ""}</div>
    <div class="set-effect">${effect}</div>
  </div>`;
}

export async function renderSettings(env, data, ctx = {}) {
  const s = data.settings;
  const t = ctx.t || ((k) => k);
  const lang = ctx.lang || "en";

  const body = `
  <section class="hero">
    <div class="lede">
      <span class="eyebrow">${esc(t("set.eyebrow"))}</span>
      <h1>${esc(t("set.title"))}</h1>
      <p>${esc(t("set.lede"))}</p>
    </div>
    <div class="statgrid">
      <div><span class="k">${esc(t("queue.assessed"))}</span><span class="v">${data.assessed}</span><span class="d">${esc(t("queue.ofAccounts", { n: data.total_accounts }))}</span></div>
      <div><span class="k">${esc(t("set.spentToday"))}</span><span class="v mono">$${Number(data.budget.spent).toFixed(2)}</span><span class="d">${esc(t("set.ofCap", { cap: `$${Number(data.budget.cap).toFixed(2)}` }))}</span></div>
      <div><span class="k">${esc(t("queue.costPer"))}</span><span class="v mono">$${Number(data.cost_per_account).toFixed(4)}</span><span class="d">${esc(t("set.measured"))}</span></div>
    </div>
  </section>

  <section class="panel">
    <div class="panel-head">${esc(t("set.qualTitle"))} <span class="sub">${esc(t("set.qualSub"))}</span></div>
    ${field({
      id: "floor_txn", label: t("set.floorLabel"), value: s.floor_txn, type: "number", suffix: t("set.floorSuffix"),
      hint: esc(t("set.floorHint")),
      effect: t("set.floorEffect"),
    })}
    ${field({
      id: "cooldown_days", label: t("set.cdLabel"), value: s.cooldown_days, type: "number", suffix: t("field.days"),
      hint: esc(t("set.cdHint")),
      effect: t("set.cdEffect"),
    })}
  </section>

  <section class="panel">
    <div class="panel-head">${esc(t("set.routeTitle"))} <span class="sub">${esc(t("set.routeSub"))}</span></div>
    ${field({
      id: "model_research", label: t("stage.research"), value: s.model_research, options: MODELS.map(([v, l]) => [v, l]),
      hint: esc(t("set.researchHint")),
      effect: t("set.futureOnlyEvidence"),
    })}
    ${field({
      id: "model_extract", label: t("stage.extract"), value: s.model_extract, options: MODELS.map(([v, l]) => [v, l]),
      hint: esc(t("set.extractHint")),
      effect: t("set.futureOnly"),
    })}
    ${field({
      id: "model_critic", label: t("stage.critic"), value: s.model_critic, options: MODELS.map(([v, l]) => [v, l]),
      hint: esc(t("set.criticHint")),
      effect: t("set.criticEffect"),
    })}
    <div class="set-note">${MODELS.map(([v, l, whyKey]) => `<span><b>${esc(l)}</b> ${esc(t(whyKey))}</span>`).join("")}</div>
  </section>

  <section class="panel">
    <div class="panel-head">${esc(t("set.costTitle"))} <span class="sub">${esc(t("set.costSub"))}</span></div>
    ${field({
      id: "daily_cap_usd", label: t("set.capLabel"), value: s.daily_cap_usd ?? data.budget.cap, type: "number", suffix: t("set.capSuffix"),
      hint: esc(t("set.capHint")),
      effect: t("set.capEffect"),
    })}
    ${field({
      id: "search_usd", label: t("set.searchLabel"), value: s.search_usd, type: "number",
      hint: esc(t("set.searchHint")),
      effect: t("set.searchEffect"),
    })}
  </section>

  <section class="panel">
    <div class="panel-head">${esc(t("set.evTitle"))} <span class="sub">${esc(t("set.evSub"))}</span></div>
    ${field({
      id: "tier_unclassified_weight", label: t("set.uwLabel"), value: s.tier_unclassified_weight ?? "0.35", type: "number",
      hint: esc(t("set.uwHint")),
      effect: t("set.uwEffect"),
    })}
    <div class="set-link"><a href="/sources#rules-panel">${esc(t("set.rulesLink"))}</a><span>${esc(t("set.rulesLinkNote"))}</span></div>
  </section>

  <section class="panel">
    <div class="panel-head">${esc(t("set.impactTitle"))} <span class="sub">${esc(t("set.impactSub"))}</span></div>
    ${field({
      id: "acv_usd", label: t("set.acvLabel"), value: s.acv_usd || "", type: "number", suffix: "USD",
      hint: esc(t("set.acvHint")),
      effect: t("set.acvEffect"),
    })}
  </section>

  <div class="set-bar" id="set-bar">
    <span id="set-status">${esc(t("set.noUnsaved"))}</span>
    <button class="btn primary" id="set-save" disabled>${esc(t("set.save"))}</button>
  </div>`;

  return { body, lang };
}

export function settingsScript() {
  // Copy comes from the FLOOR_I18N object the shell already injects, resolved
  // to the page's language server-side. English literals remain as fallbacks
  // only, so the script cannot go mute if a key ever goes missing.
  return `
  (function(){
    const C = (window.FLOOR_I18N && window.FLOOR_I18N.copy) || {};
    const T = function(k, fb, vars){
      let s = C[k] || fb;
      if (vars) for (const v in vars) s = s.replaceAll('{' + v + '}', String(vars[v]));
      return s;
    };
    const dirty = new Set();
    const bar = document.getElementById('set-bar');
    const status = document.getElementById('set-status');
    const save = document.getElementById('set-save');
    if (!save) return;
    const initial = {};
    document.querySelectorAll('.set-input').forEach(function(el){
      initial[el.id] = el.value;
      el.addEventListener('input', function(){
        if (el.value === initial[el.id]) dirty.delete(el.id); else dirty.add(el.id);
        el.closest('.set-row').classList.toggle('changed', dirty.has(el.id));
        save.disabled = dirty.size === 0;
        bar.classList.toggle('on', dirty.size > 0);
        status.textContent = dirty.size === 0 ? T('set.noUnsaved', 'No unsaved changes')
          : dirty.size === 1 ? T('set.unsavedOne', '1 unsaved change')
          : T('set.unsavedMany', '{n} unsaved changes', { n: dirty.size });
      });
    });
    save.addEventListener('click', async function(){
      save.disabled = true; status.textContent = T('set.saving', 'Saving…');
      const payload = {};
      dirty.forEach(function(k){ payload[k] = document.getElementById(k).value; });
      try {
        const r = await fetch('/api/settings', {
          method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(payload)
        }).then(function(x){ return x.json(); });
        if (r.ok === false) { status.textContent = T('common.notSaved', 'Not saved: {err}', { err: r.error || 'unknown' }); save.disabled = false; return; }
        status.textContent = T('set.saved', 'Saved. Reloading to re-grade…');
        setTimeout(function(){ location.reload(); }, 600);
      } catch (e) {
        status.textContent = T('set.saveFail', 'Could not save: {err}', { err: e.message }); save.disabled = false;
      }
    });
  })();`;
}
