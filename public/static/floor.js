/* Floor · client foundation (foundation author only)
   ---------------------------------------------------------------------
   Small on purpose; the server owns every number. This file owns the
   behaviours every page shares, so no page rebinds or reinvents them:

   - Floor.* helpers (post, toast, flash, confirm, replace, t)
   - row menus (⋯): open/close, keyboard, in-menu destructive confirm
   - dialogs: openers, backdrop close
   - selection + the bulk bar
   - data-href rows, data-hotkey keys, Esc discipline

   Everything is event delegation on document, so Floor.replace() never
   needs a rebind pass. Page actions surface as CustomEvents:

     "floor:action"  detail { action, id, el }   one object
     "floor:bulk"    detail { action, ids }      the selection

   Pages listen for those and do their POSTs with Floor.post, confirming
   with Floor.flash or Floor.toast. No location.reload(), ever.
   --------------------------------------------------------------------- */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const I18N = window.FLOOR_I18N || { lang: "en", copy: {} };

  /* ============================ Floor.* ============================ */

  const t = (key, vars) => {
    let s = I18N.copy?.[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };

  /** POST json, parse json. Throws on transport failure, HTTP failure,
   *  and on { ok:false } payloads, so callers write one catch. */
  const post = async (path, body) => {
    const r = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    let data = null;
    try { data = await r.json(); } catch { /* non-json error body */ }
    if (!r.ok) throw new Error(data?.error || data?.detail || `${r.status}`);
    if (data && data.ok === false) throw new Error(data.detail || data.error || "failed");
    return data;
  };

  /* ---- toasts: bottom-left, 8s, undo when offered ---- */

  const toastRegion = () => {
    let el = $("#toasts");
    if (!el) {
      el = document.createElement("div");
      el.id = "toasts";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    return el;
  };

  /* Entry motion is a transition off an .enter class, applied for one
     frame; under prefers-reduced-motion the transition is dead and the
     element simply appears. Nothing here loops. */
  const enter = (el) => {
    el.classList.add("enter");
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("enter")));
  };

  const toast = (msg, { undo, ms = 8000 } = {}) => {
    const region = toastRegion();
    while (region.children.length >= 4) region.firstElementChild.remove();
    const el = document.createElement("div");
    el.className = "toast";
    const text = document.createElement("span");
    text.textContent = msg;
    el.appendChild(text);
    let timer;
    const dismiss = () => { clearTimeout(timer); el.remove(); };
    if (typeof undo === "function") {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn btn-text btn-sm";
      b.textContent = t("kit.undo");
      b.addEventListener("click", () => { dismiss(); undo(); });
      el.appendChild(b);
    }
    region.appendChild(el);
    enter(el);
    timer = setTimeout(dismiss, ms);
    return dismiss;
  };

  /* ---- flash: the 300ms accent-hairline confirm ---- */

  const flash = (el) => {
    if (!el) return;
    el.classList.remove("flash");
    void el.offsetWidth;                 // restart if re-flashed
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 600);
  };

  /* ---- confirm: a C2 dialog, promised ---- */

  const confirmDlg = ({ title, body, danger } = {}) => new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "dlg";
    const okCls = danger ? "btn btn-text btn-danger" : "btn btn-primary";
    dlg.innerHTML = `<form method="dialog" class="dlg-f">
      <h2 class="dlg-t"></h2>
      <div class="dlg-b"><p></p></div>
      <div class="dlg-a">
        <button type="submit" value="cancel" class="btn btn-quiet"></button>
        <button type="submit" value="confirm" class="${okCls}"></button>
      </div>
    </form>`;
    dlg.querySelector(".dlg-t").textContent = title || "";
    dlg.querySelector(".dlg-b p").textContent = body || "";
    const [cancelBtn, okBtn] = dlg.querySelectorAll(".dlg-a button");
    cancelBtn.textContent = t("kit.cancel");
    okBtn.textContent = t("kit.confirm");
    dlg.addEventListener("close", () => {
      resolve(dlg.returnValue === "confirm");
      dlg.remove();
    });
    document.body.appendChild(dlg);
    dlg.showModal();
    (danger ? cancelBtn : okBtn).focus();
  });

  /* ---- replace: in-place region swap; delegation needs no rebind ---- */

  const replace = (selector, html) => {
    const el = typeof selector === "string" ? $(selector) : selector;
    if (!el) return null;
    const tpl = document.createElement("template");
    tpl.innerHTML = html.trim();
    const next = tpl.content.firstElementChild;
    if (!next) { el.remove(); return null; }
    el.replaceWith(tpl.content);
    return next;
  };

  window.Floor = { post, toast, flash, confirm: confirmDlg, replace, t };

  /* ===================== action dispatch ============================ */

  const dispatchAction = (el) => {
    const action = el.dataset.action;
    if (!action) return;
    const id = el.closest("[data-id]")?.dataset.id ?? el.closest("dialog")?.id ?? null;
    el.dispatchEvent(new CustomEvent("floor:action", {
      bubbles: true, detail: { action, id, el },
    }));
  };

  /* ========================= row menus (⋯) ========================== */
  /* The menu element lives next to its button in the markup; while open
     it is portaled to <body> as position:fixed so table overflow can
     never clip it, then returned on close. */

  let openMenu = null;   // { menu, btn, marker, confirmRow, hidden }

  const closeMenu = (refocus) => {
    if (!openMenu) return;
    const { menu, btn, marker, confirmRow, hidden } = openMenu;
    if (confirmRow) { confirmRow.remove(); if (hidden) hidden.hidden = false; }
    menu.hidden = true;
    menu.style.position = menu.style.left = menu.style.top = "";
    marker.parentNode?.insertBefore(menu, marker);
    marker.remove();
    btn.setAttribute("aria-expanded", "false");
    if (refocus) btn.focus();
    openMenu = null;
  };

  const openMenuFor = (btn) => {
    const menu = btn.parentElement?.querySelector(".menu");
    if (!menu) return;
    closeMenu(false);
    const marker = document.createComment("menu-slot");
    menu.parentNode.insertBefore(marker, menu);
    // Carry the source row's id along: once portaled to <body>, the menu
    // is outside its row, and action dispatch still needs the object id.
    const srcId = btn.closest("[data-id]")?.dataset.id;
    if (srcId != null) menu.dataset.id = srcId;
    document.body.appendChild(menu);
    menu.hidden = false;
    menu.style.position = "fixed";
    menu.style.visibility = "hidden";
    const r = btn.getBoundingClientRect();
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    let left = Math.max(8, Math.min(r.right - mw, innerWidth - mw - 8));
    let top = r.bottom + 4;
    if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 4);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.visibility = "";
    btn.setAttribute("aria-expanded", "true");
    openMenu = { menu, btn, marker, confirmRow: null, hidden: null };
    menu.querySelector(".menu-item")?.focus();
  };

  /* in-menu destructive confirm: the item swaps to "word? · Confirm / Cancel" */
  const armDanger = (item) => {
    const row = document.createElement("div");
    row.className = "menu-confirm";
    const q = document.createElement("span");
    q.className = "q";
    q.textContent = `${item.textContent.trim()}?`;
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "btn btn-text btn-danger btn-sm";
    ok.textContent = t("kit.confirm");
    ok.dataset.action = item.dataset.action || "";
    const no = document.createElement("button");
    no.type = "button";
    no.className = "btn btn-text btn-sm";
    no.textContent = t("kit.cancel");
    row.append(q, ok, no);
    item.hidden = true;
    item.after(row);
    if (openMenu) { openMenu.confirmRow = row; openMenu.hidden = item; }
    ok.addEventListener("click", () => { dispatchAction(ok); closeMenu(true); });
    no.addEventListener("click", () => {
      row.remove(); item.hidden = false;
      if (openMenu) { openMenu.confirmRow = null; openMenu.hidden = null; }
      item.focus();
    });
    ok.focus();
  };

  document.addEventListener("click", (e) => {
    const mbtn = e.target.closest(".menu-btn");
    if (mbtn) {
      e.preventDefault();
      if (openMenu?.btn === mbtn) closeMenu(true); else openMenuFor(mbtn);
      return;
    }
    const item = e.target.closest(".menu-item");
    if (item && openMenu?.menu.contains(item)) {
      if (item.dataset.danger) { e.preventDefault(); armDanger(item); return; }
      if (item.dataset.action) dispatchAction(item);
      closeMenu(false);       // links inside menus navigate on their own
      return;
    }
    if (openMenu && !openMenu.menu.contains(e.target)) closeMenu(false);
  });

  document.addEventListener("keydown", (e) => {
    if (!openMenu) return;
    const items = $$(".menu-item:not([hidden]), .menu-confirm button", openMenu.menu);
    const idx = items.indexOf(document.activeElement);
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeMenu(true); }
    else if (e.key === "ArrowDown") { e.preventDefault(); items[(idx + 1) % items.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); items[(idx - 1 + items.length) % items.length]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); items[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); items[items.length - 1]?.focus(); }
    else if (e.key === "Tab") closeMenu(false);
  }, true);

  ["scroll", "resize"].forEach((ev) =>
    addEventListener(ev, () => closeMenu(false), { passive: true }));

  /* =========================== dialogs ============================== */

  document.addEventListener("click", (e) => {
    const opener = e.target.closest("[data-open-dialog]");
    if (opener) {
      const dlg = document.getElementById(opener.dataset.openDialog);
      if (dlg?.showModal) dlg.showModal();
      return;
    }
    // backdrop click closes (the target is the dialog itself only there)
    if (e.target instanceof HTMLDialogElement && e.target.classList.contains("dlg")) {
      const r = e.target.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) e.target.close("cancel");
    }
  });

  /* ================= generic [data-action] controls ================= */
  /* Buttons from kit.btn() and dialog confirm buttons. Menu items are
     handled above (danger arming), so they are excluded here. */

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el || el.closest(".menu") || el.closest(".menu-confirm")) return;
    if (el.tagName === "A" && el.getAttribute("href") && el.getAttribute("href") !== "#") return;
    dispatchAction(el);
  });

  /* ==================== selection + the bulk bar ==================== */

  const selectedIds = () => $$(".row-sel:checked").map((c) => c.dataset.id).filter(Boolean);

  const syncRowClasses = () => {
    $$(".row-sel").forEach((c) => c.closest("tr")?.classList.toggle("is-sel", c.checked));
    $$(".sel-all").forEach((all) => {
      const table = all.closest("table");
      const boxes = $$(".row-sel", table);
      const on = boxes.filter((b) => b.checked).length;
      all.checked = on > 0 && on === boxes.length;
      all.indeterminate = on > 0 && on < boxes.length;
    });
  };

  const renderBulkBar = () => {
    const ids = selectedIds();
    let bar = $("#bulkbar");
    if (!ids.length) { bar?.remove(); return; }
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "bulkbar";
      const n = document.createElement("span");
      n.className = "bulk-n";
      bar.appendChild(n);
      const tpl = $("template[data-bulk]");
      if (tpl) {
        const sep = document.createElement("span");
        sep.className = "bulk-sep";
        bar.appendChild(sep);
        bar.appendChild(tpl.content.cloneNode(true));
      }
      const sep2 = document.createElement("span");
      sep2.className = "bulk-sep";
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "btn btn-text btn-sm";
      clear.textContent = t("kit.bulk.clear");
      clear.addEventListener("click", clearSelection);
      bar.append(sep2, clear);
      bar.addEventListener("click", (e) => {
        const el = e.target.closest("[data-action]");
        if (!el) return;
        e.stopPropagation();          // bulk actions are not row actions
        el.dispatchEvent(new CustomEvent("floor:bulk", {
          bubbles: true, detail: { action: el.dataset.action, ids: selectedIds() },
        }));
      }, true);
      document.body.appendChild(bar);
      enter(bar);
    }
    $(".bulk-n", bar).textContent = t("kit.bulk.selected", { n: ids.length });
  };

  const clearSelection = () => {
    $$(".row-sel:checked, .sel-all:checked").forEach((c) => { c.checked = false; });
    $$(".sel-all").forEach((c) => { c.indeterminate = false; });
    syncRowClasses();
    renderBulkBar();
  };

  document.addEventListener("change", (e) => {
    if (e.target.classList?.contains("sel-all")) {
      const table = e.target.closest("table");
      $$(".row-sel", table).forEach((c) => { c.checked = e.target.checked; });
    } else if (!e.target.classList?.contains("row-sel")) {
      return;
    }
    syncRowClasses();
    renderBulkBar();
  });

  /* ========================= data-href rows ========================= */

  const rowNav = (tr) => { if (tr?.dataset.href) location.href = tr.dataset.href; };

  document.addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-href]");
    if (!tr) return;
    if (e.target.closest("a, button, input, select, textarea, label, .menu, dialog")) return;
    rowNav(tr);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const tr = e.target.closest?.("tr[data-href]");
    if (tr && e.target === tr) { e.preventDefault(); rowNav(tr); }
  });

  /* ==================== keys: hotkeys + Esc order ==================== */

  const typing = (el) =>
    el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      // menus first (handled above in capture), then selection
      if (!openMenu && !document.querySelector("dialog[open]") && selectedIds().length) {
        e.preventDefault();
        clearSelection();
      }
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (typing(e.target) || document.querySelector("dialog[open]")) return;
    const el = document.querySelector(`[data-hotkey="${CSS.escape(e.key)}"]`);
    if (!el) return;
    e.preventDefault();
    if (typing(el) || el.tagName === "INPUT") el.focus(); else el.click();
  });

  /* initial state: a server-rendered page may arrive with checks ticked */
  syncRowClasses();
  renderBulkBar();
})();
