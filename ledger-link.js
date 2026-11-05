/* 行程页 ↔ 旅游AA账本 联动
 * 行程页部署在账本同域的 /plan/ 下时，直接读取账本保存在本浏览器的数据（只读），
 * 在每个行程项目旁显示对应预算 / 已付金额，并提供跳转到账本对应条目的链接。
 * 同时负责渲染地图信息（评分、营业时间、到下一站的时间）与门票信息（票价、开售时间、购票渠道）。
 */
(function () {
  "use strict";

  const LEDGER_PREFIX = { budget: "aal$b$", txn: "aal$t$", settings: "aal$settingscfg", tripSource: "aaltripsrc$" };
  const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const MODE_ICON = { walk: "🚶", transit: "🚇", train: "🚆", bus: "🚌", drive: "🚗", taxi: "🚕", ferry: "⛴", flight: "✈️", bicycle: "🚲" };
  const MODE_TEXT = { walk: "步行", transit: "公共交通", train: "电车", bus: "巴士", drive: "开车", taxi: "打车", ferry: "渡轮", flight: "飞机", bicycle: "骑行" };

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function storage() {
    try { return window.localStorage; } catch (error) { return null; }
  }

  function readJson(key) {
    const ls = storage();
    if (!ls) return null;
    try { return JSON.parse(ls.getItem(key)); } catch (error) { return null; }
  }

  function listByPrefix(prefix) {
    const ls = storage();
    const out = [];
    if (!ls) return out;
    for (let i = 0; i < ls.length; i += 1) {
      const key = ls.key(i);
      if (key && key.indexOf(prefix) === 0) {
        try { out.push(JSON.parse(ls.getItem(key))); } catch (error) { /* ignore */ }
      }
    }
    return out;
  }

  /* ---------- 账本地址 ---------- */
  /* 部署在账本的 /plan/ 下时用同域的 ../；单独部署时用 metadata.ledgerUrl；都没有则不显示账本入口 */
  function ledgerBaseUrl(data) {
    const underLedger = /\/plan\/(index\.html)?$/.test(location.pathname);
    const configured = data?.metadata?.ledgerUrl;
    const base = underLedger ? "../" : configured;
    if (!base) return "";
    try { return new URL(base, location.href).href; } catch (error) { return ""; }
  }

  function planDataUrl() {
    try { return new URL("trip-data.json", location.href).href; } catch (error) { return ""; }
  }

  function ledgerUrl(data, params) {
    const base = ledgerBaseUrl(data);
    if (!base) return "";
    const url = new URL(base);
    const source = planDataUrl();
    if (source) url.searchParams.set("tripPage", source);
    Object.entries(params || {}).forEach(([key, value]) => { if (value) url.searchParams.set(key, value); });
    return url.href;
  }

  /* ---------- 读取账本 ---------- */
  function baseCurrencyCode() {
    const cfg = readJson(LEDGER_PREFIX.settings);
    return String(cfg?.baseCurrency || "CNY").split(" ")[0] || "CNY";
  }

  function ledgerSnapshot(tripId) {
    const ledgerTripId = storage()?.getItem(LEDGER_PREFIX.tripSource + tripId) || "";
    if (!ledgerTripId) return { linked: false, budgets: [], txnById: {}, base: baseCurrencyCode() };
    const budgets = listByPrefix(LEDGER_PREFIX.budget).filter((b) => b && b.trip === ledgerTripId);
    const txnById = {};
    listByPrefix(LEDGER_PREFIX.txn).forEach((t) => { if (t?.id) txnById[t.id] = t; });
    return { linked: true, ledgerTripId, budgets, txnById, base: baseCurrencyCode() };
  }

  function budgetBase(b) {
    return (Number(b.amount) || 0) * (Number(b.qty) || 1) * (Number(b.rate) || 1);
  }

  function paidBase(b, txnById) {
    const txn = b.expenseId && txnById[b.expenseId];
    if (txn) return (Number(txn.amount) || 0) * (Number(txn.rate) || 1);
    return b.status === "paid" ? budgetBase(b) : 0;
  }

  function money(value, code) {
    const symbol = { CNY: "¥", JPY: "J¥", USD: "$", EUR: "€", TWD: "NT$", HKD: "HK$" }[code] || `${code} `;
    return symbol + Number(value || 0).toLocaleString("zh-CN", { maximumFractionDigits: 0 });
  }

  function summarize(list, snapshot) {
    const budget = list.reduce((sum, b) => sum + budgetBase(b), 0);
    const paid = list.reduce((sum, b) => sum + paidBase(b, snapshot.txnById), 0);
    return { budget, paid, count: list.length };
  }

  /* ---------- 渲染：账本 ---------- */
  function itemLedgerMarkup(data, snapshot, item) {
    if (!item?.id) return "";
    const list = snapshot.budgets.filter((b) => b.planItemId === item.id);
    if (!snapshot.linked) return "";
    if (!list.length) return "";
    const href = ledgerUrl(data, { planRef: list[0].planRef || "", planItem: item.id });
    const s = summarize(list, snapshot);
    const state = s.paid >= s.budget - 0.5 && s.budget > 0 ? "is-paid" : s.paid > 0 ? "is-partial" : "";
    return `<a class="ledger-chip ${state}"${href ? ` href="${esc(href)}"` : ""} title="在账本中查看">💰 预算 ${esc(money(s.budget, snapshot.base))}${s.paid ? ` · 已付 ${esc(money(s.paid, snapshot.base))}` : ""}</a>`;
  }

  function dayLedgerMarkup(data, snapshot, day) {
    if (!snapshot.linked) return "";
    const list = snapshot.budgets.filter((b) => String(b.planDay || "") === String(day.day) || (!b.planDay && b.day === day.date));
    if (!list.length) return "";
    const s = summarize(list, snapshot);
    const href = ledgerUrl(data, { planDay: String(day.day) });
    const text = `💰 当天 ${s.count} 项预算 ${esc(money(s.budget, snapshot.base))} · 已付 ${esc(money(s.paid, snapshot.base))}`;
    return href ? `<a class="ledger-day-summary" href="${esc(href)}">${text} ›</a>` : `<div class="ledger-day-summary">${text}</div>`;
  }

  /* ---------- 渲染：地图信息 ---------- */
  function placesFor(data, item) {
    const ids = [...new Set([...(Array.isArray(item.placeIds) ? item.placeIds : []), ...(item.placeId ? [item.placeId] : [])])];
    return ids.map((id) => (data.places || []).find((p) => p.id === id) || (data.restaurants || []).find((r) => r.id === id)).filter(Boolean);
  }

  function hoursForDate(maps, date) {
    const hours = maps?.hours;
    if (!Array.isArray(hours) || hours.length !== 7 || !date) return "";
    const d = new Date(`${date}T12:00:00`);
    if (Number.isNaN(d.getTime())) return "";
    const index = (d.getDay() + 6) % 7; /* 周一=0 */
    return String(hours[index] || "").replace(/^[^:：]*[:：]\s*/, "") || "";
  }

  function placeInfoMarkup(day, item, data) {
    return placesFor(data, item).map((place) => {
      const maps = place.maps;
      if (!maps) return "";
      const parts = [];
      if (Number.isFinite(Number(maps.rating))) parts.push(`<span class="place-facts__rating">★ ${Number(maps.rating).toFixed(1)}${maps.ratingCount ? `<small>（${Number(maps.ratingCount).toLocaleString("zh-CN")}）</small>` : ""}</span>`);
      const todayHours = hoursForDate(maps, day.date);
      if (todayHours) parts.push(`<span>🕘 ${esc(WEEKDAYS[(new Date(`${day.date}T12:00:00`).getDay() + 6) % 7])} ${esc(todayHours)}</span>`);
      else if (maps.hoursNote) parts.push(`<span>🕘 ${esc(maps.hoursNote)}</span>`);
      if (maps.priceLevel) parts.push(`<span>${esc(maps.priceLevel)}</span>`);
      if (!parts.length) return "";
      const label = placesFor(data, item).length > 1 ? `<b>${esc(place.nameZh || place.name)}</b>` : "";
      const allHours = Array.isArray(maps.hours) && maps.hours.length === 7
        ? `<details class="place-facts__hours"><summary>全部营业时间</summary>${maps.hours.map((h) => `<div>${esc(h)}</div>`).join("")}${maps.checkedAt ? `<small>核对于 ${esc(maps.checkedAt)} · ${esc(maps.source || "Google Maps")}</small>` : ""}</details>`
        : "";
      return `<div class="place-facts">${label}${parts.join("")}${allHours}</div>`;
    }).join("");
  }

  function travelMarkup(item) {
    const t = item.travelToNext;
    if (!t || !(Number(t.minutes) > 0)) return "";
    const mode = String(t.mode || "").toLowerCase();
    const bits = [`${MODE_ICON[mode] || "➡️"} ${MODE_TEXT[mode] || "前往下一站"} 约 ${Math.round(Number(t.minutes))} 分钟`];
    if (Number(t.distanceKm) > 0) bits.push(`${Number(t.distanceKm).toFixed(Number(t.distanceKm) < 10 ? 1 : 0)} km`);
    if (t.note) bits.push(t.note);
    return `<div class="travel-next">${esc(bits.join(" · "))}</div>`;
  }

  /* ---------- 渲染：门票 ---------- */
  function ticketInfoMarkup(ticket) {
    const parts = [];
    if (ticket.price && (ticket.price.amount != null || ticket.price.label)) {
      const amount = ticket.price.amount != null ? `${ticket.price.currency || ""} ${Number(ticket.price.amount).toLocaleString("zh-CN")}` : "";
      parts.push(`<span>🎫 ${esc([amount.trim(), ticket.price.label].filter(Boolean).join(" · "))}${ticket.priceCheckedAt ? `<small>（核对于 ${esc(ticket.priceCheckedAt)}）</small>` : ""}</span>`);
    }
    const w = ticket.saleWindow;
    if (w && (w.opens || w.closes || w.note)) {
      parts.push(`<span>🗓 ${esc([w.opens && `开售 ${w.opens}`, w.closes && `截止 ${w.closes}`, w.note].filter(Boolean).join(" · "))}</span>`);
    }
    const channels = (ticket.buyChannels || []).filter((c) => c && c.url);
    if (channels.length) {
      parts.push(`<span>🛒 ${channels.map((c) => `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.name || "购票")}</a>`).join(" · ")}</span>`);
    }
    return parts.length ? `<div class="ticket-facts">${parts.join("")}</div>` : "";
  }

  /* ---------- 定位：#item-<id> ---------- */
  function focusFromHash() {
    const match = /^#item-(.+)$/.exec(location.hash || "");
    if (!match) return;
    const id = decodeURIComponent(match[1]);
    const el = document.getElementById(`item-${id}`);
    if (!el) return;
    const detail = el.closest(".day-detail");
    if (detail && detail.hidden) {
      const toggle = detail.closest(".day-card")?.querySelector(".day-toggle");
      if (toggle) toggle.click();
    }
    el.classList.add("is-focused");
    setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    setTimeout(() => el.classList.remove("is-focused"), 4000);
  }

  window.addEventListener("hashchange", focusFromHash);

  /* 顶部「💰 账本」入口：带上本行程，账本会自动导入或切换到这个行程 */
  function setupNavLink(data) {
    const link = document.getElementById("ledger-app-link");
    if (!link) return;
    const href = ledgerUrl(data, {});
    link.hidden = !href;
    if (href) link.href = href;
  }

  document.addEventListener("travel-data-ready", (event) => setupNavLink(event.detail));

  window.LedgerLink = {
    snapshot: ledgerSnapshot,
    ledgerUrl,
    ledgerBaseUrl,
    itemLedgerMarkup,
    dayLedgerMarkup,
    placeInfoMarkup,
    travelMarkup,
    ticketInfoMarkup,
    focusFromHash
  };
})();
