/* =====================================================================
   app.js — telas, modais e interações do MVP
   ===================================================================== */
(function () {
  "use strict";

  Store.init();

  /* ---------------- versão do app ----------------
     >>> ao publicar uma atualização: mude AQUI e no sw.js (mesmo número) */
  const APP_VERSION = "1.2.0";
  const BUILD_DATE = "06/10/2026"; /* data da publicação */

  /* ---------------- helpers ---------------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const DIAS = ["dom","seg","ter","qua","qui","sex","sáb"];

  function fmt(cents) {
    return (cents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }
  function fmtShort(cents) {
    const v = cents / 100;
    if (Math.abs(v) >= 1000)
      return "R$ " + (v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "k";
    return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  }
  function parseMoney(s) {
    s = String(s == null ? "" : s).trim().replace(/R\$\s?/g, "");
    if (!s) return 0;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    s = s.replace(/[^\d.\-]/g, "");
    const n = parseFloat(s);
    return isNaN(n) ? 0 : Math.round(n * 100);
  }
  function today() {
    return new Date().toISOString().slice(0, 10);
  }
  function monthKey(iso) {
    return iso.slice(0, 7);
  }
  function monthLabel(mk) {
    const [y, m] = mk.split("-");
    return MESES[Number(m) - 1] + " " + y;
  }
  function addMonths(mk, n) {
    const [y, m] = mk.split("-").map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }
  function dateLabel(iso) {
    const t = today();
    if (iso === t) return "hoje";
    const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    if (iso === y) return "ontem";
    const [yy, mm, dd] = iso.split("-");
    const d = new Date(Number(yy), Number(mm) - 1, Number(dd));
    return DIAS[d.getDay()] + ", " + dd + "/" + mm;
  }
  function fullDate(iso) {
    const [y, m, d] = iso.split("-");
    return d + "/" + m + "/" + y;
  }
  function catIcon(id) {
    const c = Store.cat(id);
    return c ? c.icon : "📦";
  }
  function catName(id) {
    const c = Store.cat(id);
    return c ? c.name : "Sem categoria";
  }
  function destLabel(t) {
    if (t.cardId) {
      const c = Store.card(t.cardId);
      return c ? c.name + (c.final ? " •" + c.final : "") : "Cartão";
    }
    if (t.accId) {
      const a = Store.account(t.accId);
      return a ? a.name : "Conta";
    }
    return "";
  }
  const CARD_COLORS = ["#0f172a", "#2563eb", "#7c3aed", "#db2777", "#059669", "#d97706"];

  /* ---------------- estado de navegação ---------------- */
  const state = {
    route: "home",
    month: monthKey(today()),
    txFilter: "all",
    thirdFilter: "open"
  };
  let pendingConfirm = null;

  /* ---------------- toast ---------------- */
  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  /* ---------------- sheet (modal) ---------------- */
  function openSheet(html) {
    $("#modal-root").innerHTML =
      '<div class="sheet-back" data-act="close-modal"></div><div class="sheet">' +
      '<div class="grab"></div>' + html + "</div>";
    /* foca só nos campos onde digitar é o primeiro passo — evita que o
       teclado abra sozinho ao mexer nos Ajustes */
    const f = $(
      "#modal-root [data-form='tx'] input[name='amount'], " +
        "#modal-root [data-form='third'] input[name='amount'], " +
        "#modal-root [data-form='card'] input[name='name']"
    );
    if (f) setTimeout(() => f.focus(), 60);
  }
  function closeSheet() {
    $("#modal-root").innerHTML = "";
    pendingConfirm = null;
  }
  function askConfirm(title, text, fn, okLabel) {
    pendingConfirm = fn;
    openSheet(
      '<h2>' + esc(title) + "</h2>" +
      '<p style="color:var(--ink-2);font-size:14.5px;line-height:1.5;margin:0 0 18px">' + esc(text) + "</p>" +
      '<div class="form-actions"><button class="btn ghost" data-act="close-modal">Cancelar</button>' +
      '<button class="btn danger" data-act="confirm-yes">' + esc(okLabel || "Excluir") + "</button></div>"
    );
  }

  /* =====================================================================
     TELA: PAINEL
     ===================================================================== */
  function viewHome() {
    const mk = state.month;
    const list = Store.txOfMonth(mk);
    const inc = Store.sumIn(list);
    const out = Store.sumOut(list);
    const saldo = inc - out;
    const tdOpen = Store.thirdOpenSum();
    const before = Store.balanceBefore(mk);
    const cash = before + saldo;
    const prevLabel = monthLabel(addMonths(mk, -1));
    const cards = Store.cards();
    const invTotal = cards.reduce((s, c) => s + Store.cardInvoice(c.id, mk).total, 0);

    if (!list.length && !cards.length && !Store.data.third.length) {
      return (
        headerHome() +
        '<div class="empty"><div class="big">💸</div><h3>Vamos começar</h3>' +
        "<p>Registre seu primeiro lançamento, cadastre seus cartões de crédito e controle quem gasta com o seu cartão.</p>" +
        '<div class="form-actions">' +
        '<button class="btn" data-act="new-tx">Novo lançamento</button>' +
        "</div>" +
        '<div style="height:10px"></div>' +
        '<button class="btn ghost" data-act="new-card">Cadastrar cartão</button>' +
        "</div>"
      );
    }

    const recent = Store.data.transactions
      .filter((t) => t.date <= today())
      .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt))
      .slice(0, 6);

    return (
      headerHome() +
      /* caixa acumulado */
      '<div class="card hero">' +
      '<div class="label">Caixa em ' + esc(monthLabel(mk)) + "</div>" +
      '<div class="value' + (cash < 0 ? " neg" : "") + '">' + fmt(cash) + "</div>" +
      '<div class="carry">' +
      (before === 0
        ? "→ Saldo anterior: nenhum (primeiro mês)"
        : "↳ veio de " + esc(prevLabel) + ": " + fmt(before)) +
      "</div>" +
      '<div class="row">' +
      '<div><div class="k"><i class="dot g"></i>Entradas</div><div class="v">' + fmt(inc) + "</div></div>" +
      '<div><div class="k"><i class="dot r"></i>Saídas</div><div class="v">' + fmt(out) + "</div></div>" +
      '<div><div class="k"><i class="dot b"></i>Saldo do mês</div><div class="v' + (saldo < 0 ? " neg" : "") + '">' + fmt(saldo) + "</div></div>" +
      "</div></div>" +

      /* indicadores */
      '<div class="grid3">' +
      mini("💳", "Faturas do mês", fmt(invTotal)) +
      mini("👥", "A receber", fmt(tdOpen), "warn") +
      mini("🧾", "Lançamentos", String(list.length)) +
      "</div>" +

      /* cartões */
      (cards.length
        ? '<div class="sec-title">Cartões <button data-act="goto" data-route="cards">ver todos</button></div>' +
          '<div class="card pad0">' +
          cards.slice(0, 3).map((c) => cardRow(c, mk)).join("") +
          "</div>"
        : '<div class="sec-title">Cartões</div>' +
          '<div class="card"><button class="btn ghost" data-act="new-card">+ Cadastrar cartão de crédito</button></div>') +

      /* recentes */
      '<div class="sec-title">Últimos lançamentos <button data-act="goto" data-route="tx">ver todos</button></div>' +
      (recent.length
        ? '<div class="rows">' + recent.map(rowTx).join("") + "</div>"
        : '<div class="card" style="text-align:center;color:var(--ink-2);font-size:14px">Nenhum lançamento em ' + esc(monthLabel(mk)) + "</div>")
    );
  }

  function headerHome() {
    return (
      '<div class="top"><div><h1>Olá! 👋<span class="ver">v' + APP_VERSION + "</span></h1>" +
      '<div class="sub">Visão geral de ' + esc(monthLabel(state.month)) + "</div></div>" +
      '<div style="display:flex;gap:8px;align-items:center">' +
      monthNav() +
      '<button class="icon-btn" data-act="settings" aria-label="Ajustes">⚙️</button>' +
      "</div></div>"
    );
  }

  function mini(ico, k, v, cls) {
    return (
      '<div class="mini ' + (cls || "") + '"><div class="k">' + ico + " " + esc(k) +
      '</div><div class="v">' + esc(v) + "</div></div>"
    );
  }

  function monthNav() {
    const atual = monthLabel(state.month); /* "Outubro 2026" */
    const p = atual.split(" ");
    /* versão curta ("Out 2026") usada em telas estreitas — ver @media 400px */
    const curto = p[0].slice(0, 3) + " " + (p[1] || "");
    return (
      '<div class="month-nav">' +
      '<button data-act="month" data-d="-1" aria-label="Mês anterior">‹</button>' +
      '<span class="mlabel"><span class="lb-full">' + esc(atual) + "</span>" +
      '<span class="lb-short">' + esc(curto) + "</span></span>" +
      '<button data-act="month" data-d="1" aria-label="Próximo mês">›</button>' +
      "</div>"
    );
  }

  function cardRow(c, mk) {
    const inv = Store.cardInvoice(c.id, mk);
    const [y, m] = mk.split("-").map(Number);
    const due = new Date(y, m - 1, Math.min(Number(c.due) || 1, 28));
    const dueStr = String(due.getDate()).padStart(2, "0") + "/" + String(due.getMonth() + 1).padStart(2, "0");
    return (
      '<div class="row-item" data-act="edit-card" data-id="' + c.id + '">' +
      '<div class="row-ico">💳</div>' +
      '<div class="row-mid"><div class="t">' + esc(c.name) + (c.final ? " •" + esc(c.final) : "") + "</div>" +
      '<div class="s"><span class="pill">vence ' + dueStr + "</span>" +
      (inv.others ? '<span class="pill parcela">terceiros ' + fmt(inv.others) + "</span>" : "") +
      "</div></div>" +
      '<div class="row-val out">' + fmt(inv.total) + "</div></div>"
    );
  }

  /* =====================================================================
     TELA: LANÇAMENTOS
     ===================================================================== */
  function viewTx() {
    let list = Store.txOfMonth(state.month);
    const inc = Store.sumIn(list);
    const out = Store.sumOut(list);
    if (state.txFilter !== "all")
      list = list.filter((t) => t.type === state.txFilter);
    list = list.sort((a, b) =>
      (b.date + String(b.createdAt)).localeCompare(a.date + String(a.createdAt))
    );

    const groups = {};
    list.forEach((t) => (groups[t.date] = groups[t.date] || []).push(t));

    let body = "";
    if (!list.length) {
      body =
        '<div class="empty"><div class="big">🗒️</div><h3>Nada por aqui</h3>' +
        "<p>Nenhum lançamento em " + esc(monthLabel(state.month)) +
        '. Toque no botão <b>+</b> para registrar uma entrada ou saída.</p></div>';
    } else {
      body = Object.keys(groups)
        .sort()
        .reverse()
        .map(
          (d) =>
            '<div class="day-group"><div class="day-label">' +
            esc(dateLabel(d)) +
            '</div><div class="rows">' +
            groups[d].map(rowTx).join("") +
            "</div></div>"
        )
        .join("");
    }

    return (
      '<div class="top"><div><h1>Lançamentos</h1>' +
      '<div class="sub">Entradas ' + fmt(inc) + " · Saídas " + fmt(out) + "</div></div>" +
      monthNav() +
      "</div>" +
      '<div class="chips">' +
      chip("all", "Todos", state.txFilter, "tx") +
      chip("in", "Entradas", state.txFilter, "tx") +
      chip("out", "Saídas", state.txFilter, "tx") +
      "</div>" +
      body
    );
  }

  function chip(val, label, current, kind) {
    return (
      '<button class="chip ' + (current === val ? "active" : "") +
      '" data-act="filter" data-kind="' + kind + '" data-f="' + val + '">' +
      esc(label) + "</button>"
    );
  }

  function rowTx(t) {
    const isCard = !!t.cardId;
    const parcela = t.group
      ? '<span class="pill parcela">' + t.group.n + "/" + t.group.total + "</span>"
      : "";
    const dest = destLabel(t);
    const sub = [];
    if (t.note) sub.push(esc(catName(t.catId)));
    if (dest) sub.push('<span class="pill ' + (isCard ? "card-pill" : "") + '">' + esc(dest) + "</span>");
    if (parcela) sub.push(parcela);

    return (
      '<button class="row-item" data-act="edit-tx" data-id="' + t.id + '">' +
      '<div class="row-ico">' + catIcon(t.catId) + "</div>" +
      '<div class="row-mid"><div class="t">' +
      esc(t.note || catName(t.catId)) +
      '</div><div class="s">' + sub.join("") + "</div></div>" +
      '<div class="row-val ' + (t.type === "in" ? "in" : "out") + '">' +
      (t.type === "in" ? "+" : "−") + fmt(t.amount) +
      "</div></button>"
    );
  }

  /* =====================================================================
     TELA: CARTÕES
     ===================================================================== */
  function viewCards() {
    const cards = Store.cards();
    const mk = state.month;
    const cur = monthKey(today());

    let body;
    if (!cards.length) {
      body =
        '<div class="empty"><div class="big">💳</div><h3>Nenhum cartão cadastrado</h3>' +
        "<p>Cadastre seus cartões para acompanhar fatura, limite disponível, fechamento e vencimento — e para registrar quem gasta com o seu cartão.</p>" +
        '<button class="btn" data-act="new-card">Cadastrar cartão</button></div>';
    } else {
      body = cards.map((c) => ccCard(c, mk, cur)).join("");
    }

    return (
      '<div class="top"><div><h1>Cartões de crédito</h1>' +
      '<div class="sub">' + (cards.length ? cards.length + " cartão(s) ativo(s)" : "Fatura, limite e vencimento") + "</div></div>" +
      '<button class="icon-btn" data-act="new-card" aria-label="Novo cartão">＋</button></div>' +
      body
    );
  }

  function ccCard(c, mk, cur) {
    const inv = Store.cardInvoice(c.id, mk);
    const used = Store.cardUsed(c.id);
    const pct = c.limit > 0 ? Math.min(100, Math.round((used / c.limit) * 100)) : 0;
    const available = c.limit > 0 ? c.limit - used : null;
    const [y, m] = mk.split("-").map(Number);
    const dClose = new Date(y, m - 1, Math.min(Number(c.closing) || 1, 28));
    const dDue = new Date(y, m - 1, Math.min(Number(c.due) || 1, 28));
    /* cor do cartão: usa a salva ou a padrão (protege dados antigos/importados) */
    const cor = /^#[0-9a-f]{6}$/i.test(c.color || "") ? c.color : CARD_COLORS[0];

    return (
      '<div class="cc" style="background:linear-gradient(135deg,' + cor + "," + shade(cor) + ')">' +
      '<div class="cc-actions">' +
      '<button data-act="edit-card" data-id="' + c.id + '" aria-label="Editar">✏️</button>' +
      '<button data-act="del-card" data-id="' + c.id + '" aria-label="Excluir">🗑️</button>' +
      "</div>" +
      '<div class="nm">' + esc(c.name) + "</div>" +
      '<div class="num">' + (c.final ? "•••• " + esc(c.final) : "••••") + "</div>" +
      '<div class="inv"><small>Fatura de ' + esc(monthLabel(mk)) + "</small>" + fmt(inv.total) + "</div>" +
      (inv.others
        ? '<div class="bar-lbl">🧩 inclui ' + fmt(inv.others) + " gastos de terceiros</div>"
        : "") +
      '<div class="meta">' +
      "<div>Fechamento<b>" + String(dClose.getDate()).padStart(2, "0") + "/" + String(dClose.getMonth() + 1).padStart(2, "0") + "</b></div>" +
      "<div>Vencimento<b>" + String(dDue.getDate()).padStart(2, "0") + "/" + String(dDue.getMonth() + 1).padStart(2, "0") + "</b></div>" +
      "<div>Próx. faturas<b>" + fmt(Store.cardFuture(c.id, addMonths(cur, 1))) + "</b></div>" +
      "</div>" +
      (c.limit > 0
        ? '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
          '<div class="bar-lbl">Limite usado ' + pct + "% · disponível " + fmt(available) + "</div>"
        : '<div class="bar-lbl">Sem limite cadastrado</div>') +
      "</div>"
    );
  }

  function shade(hex) {
    /* escurece uma cor hex em ~22% para o gradiente (com fallback seguro) */
    let h = String(hex || "").replace("#", "");
    if (h.length === 3)
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-f]{6}$/i.test(h)) h = "0f172a";
    const n = parseInt(h, 16);
    const r = Math.max(0, ((n >> 16) & 255) - 56);
    const g = Math.max(0, ((n >> 8) & 255) - 56);
    const b = Math.max(0, (n & 255) - 56);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  /* =====================================================================
     TELA: TERCEIROS (gastos no MEU cartão)
     ===================================================================== */
  function viewThird() {
    const all = Store.data.third.slice().sort((a, b) =>
      (b.date + String(b.createdAt)).localeCompare(a.date + String(a.createdAt))
    );
    const open = all.filter((t) => t.status === "open");
    const paid = all.filter((t) => t.status === "paid");
    const sumOpen = open.reduce((s, t) => s + t.amount, 0);
    const sumPaid = paid.reduce((s, t) => s + t.amount, 0);

    let list = all;
    if (state.thirdFilter === "open") list = open;
    if (state.thirdFilter === "paid") list = paid;

    const body = list.length
      ? '<div class="rows">' + list.map(rowThird).join("") + "</div>"
      : '<div class="empty"><div class="big">👥</div><h3>' +
        (state.thirdFilter === "open" ? "Nenhuma dívida em aberto" : "Nada registrado") +
        "</h3><p>Registre aqui quando alguém comprar usando <b>o seu cartão</b>. Assim você separa o que é gasto seu do gasto dos outros.</p>" +
        '<button class="btn" data-act="new-third">Novo gasto de terceiro</button></div>';

    return (
      '<div class="top"><div><h1>Gastos de terceiros</h1>' +
      '<div class="sub">Compras feitas por outros no seu cartão</div></div>' +
      '<button class="icon-btn" data-act="new-third" aria-label="Novo">＋</button></div>' +

      '<div class="card hero">' +
      '<div class="label">Total a receber de terceiros</div>' +
      '<div class="value">' + fmt(sumOpen) + "</div>" +
      '<div class="row">' +
      '<div><div class="k"><i class="dot y"></i>Em aberto</div><div class="v">' + open.length + " lançamento(s)</div></div>" +
      '<div><div class="k"><i class="dot g"></i>Devolvido</div><div class="v">' + fmt(sumPaid) + "</div></div>" +
      "</div></div>" +

      '<div class="chips">' +
      chip("open", "Em aberto (" + open.length + ")", state.thirdFilter, "third") +
      chip("paid", "Devolvidos (" + paid.length + ")", state.thirdFilter, "third") +
      chip("all", "Todos", state.thirdFilter, "third") +
      "</div>" +
      body
    );
  }

  function rowThird(t) {
    const isPaid = t.status === "paid";
    const card = t.cardId ? Store.card(t.cardId) : null;
    const sub = [];
    if (t.note) sub.push(esc(t.note));
    sub.push('<span class="pill">' + esc(fullDate(t.date)) + "</span>");
    if (card) sub.push('<span class="pill card-pill">' + esc(card.name) + (card.final ? " •" + esc(card.final) : "") + "</span>");
    sub.push('<span class="' + (isPaid ? "status-paid" : "status-open") + '">' + (isPaid ? "✓ devolvido" : "a devolver") + "</span>");

    return (
      '<div class="td-item">' +
      '<div class="avatar ' + (isPaid ? "paid" : "") + '">' + esc((t.person || "?").slice(0, 2)) + "</div>" +
      '<div class="row-mid" data-act="edit-third" data-id="' + t.id + '" style="cursor:pointer">' +
      '<div class="t">' + esc(t.person || "Sem nome") + "</div>" +
      '<div class="s">' + sub.join("") + "</div></div>" +
      '<div style="text-align:right">' +
      '<div class="row-val ' + (isPaid ? "" : "out") + '" style="' + (isPaid ? "color:var(--ink-3)" : "") + '">' + fmt(t.amount) + "</div>" +
      "</div>" +
      '<button class="check ' + (isPaid ? "done" : "") + '" data-act="toggle-third" data-id="' + t.id + '" aria-label="Marcar como devolvido">' +
      (isPaid ? "✓" : "") + "</button>" +
      "</div>"
    );
  }

  /* =====================================================================
     TELA: RELATÓRIOS
     ===================================================================== */
  function viewReport() {
    const cur = state.month;
    const months = [];
    for (let i = 5; i >= 0; i--) months.push(addMonths(cur, -i));

    const data = months.map((mk) => {
      const l = Store.txOfMonth(mk);
      return { mk, in: Store.sumIn(l), out: Store.sumOut(l) };
    });
    const max = Math.max(1, ...data.map((d) => Math.max(d.in, d.out)));

    const chart =
      '<div class="chart">' +
      data
        .map((d) => {
          const hi = Math.round((d.in / max) * 100);
          const ho = Math.round((d.out / max) * 100);
          const [y, m] = d.mk.split("-");
          return (
            '<div class="col"><div class="bars">' +
            '<div class="b in" style="height:' + hi + '%" title="' + fmt(d.in) + '"></div>' +
            '<div class="b out" style="height:' + ho + '%" title="' + fmt(d.out) + '"></div>' +
            "</div><div class=\"cl\">" + MESES[Number(m) - 1].slice(0, 3) + "</div></div>"
          );
        })
        .join("") +
      "</div>" +
      '<div class="legend"><span><i class="dot g" style="margin-right:5px"></i>Entradas</span>' +
      '<span><i class="dot r" style="margin-right:5px"></i>Saídas</span></div>';

    /* categorias do mês */
    const list = Store.txOfMonth(cur).filter((t) => t.type === "out");
    const totalOut = list.reduce((s, t) => s + t.amount, 0);
    const byCat = {};
    list.forEach((t) => (byCat[t.catId] = (byCat[t.catId] || 0) + t.amount));
    const cats = Object.keys(byCat)
      .map((id) => ({ id, v: byCat[id] }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 8);

    const catHtml = cats.length
      ? cats
          .map((c) => {
            const pct = totalOut ? Math.round((c.v / totalOut) * 100) : 0;
            return (
              '<div class="cat-row"><div class="top-l"><b><span class="bar-ico">' +
              catIcon(c.id) +
              "</span>" + esc(catName(c.id)) + "</b><span>" + fmt(c.v) + " · " + pct + "%</span></div>" +
              '<div class="track"><i style="width:' + pct + '%"></i></div></div>'
            );
          })
          .join("")
      : '<p style="color:var(--ink-2);font-size:14px">Sem saídas registradas em ' + esc(monthLabel(cur)) + ".</p>";

    const avgOut = Math.round(data.reduce((s, d) => s + d.out, 0) / data.length);
    const avgIn = Math.round(data.reduce((s, d) => s + d.in, 0) / data.length);
    const biggest = list.slice().sort((a, b) => b.amount - a.amount)[0];
    const tdOpen = Store.thirdOpenSum();

    return (
      '<div class="top"><div><h1>Relatórios</h1><div class="sub">Últimos 6 meses</div></div>' +
      monthNav() + "</div>" +

      '<div class="card">' + chart + "</div>" +

      '<div class="grid3">' +
      mini("📊", "Média saídas", fmt(avgOut), "bad") +
      mini("📈", "Média entradas", fmt(avgIn), "ok") +
      mini("👥", "A receber", fmt(tdOpen), "warn") +
      "</div>" +

      '<div class="sec-title">Onde foi o dinheiro em ' + esc(monthLabel(cur)) + "</div>" +
      '<div class="card">' + catHtml + "</div>" +

      '<div class="sec-title">Resumo</div>' +
      '<div class="card stat-list">' +
      '<div class="s"><span>Saldo anterior (' + esc(monthLabel(addMonths(cur, -1))) + ')</span><b class="' + (Store.balanceBefore(cur) < 0 ? "r" : "") + '">' + fmt(Store.balanceBefore(cur)) + "</b></div>" +
      '<div class="s"><span>Entradas do mês</span><b style="color:var(--in)">' + fmt(Store.sumIn(Store.txOfMonth(cur))) + "</b></div>" +
      '<div class="s"><span>Saídas do mês</span><b style="color:var(--out)">' + fmt(totalOut) + "</b></div>" +
      '<div class="s"><span>Saldo do mês (o que sobrou)</span><b class="' + (Store.balanceOf(cur) < 0 ? "r" : "g") + '">' + fmt(Store.balanceOf(cur)) + "</b></div>" +
      '<div class="s"><span><b>Caixa ao fim do mês</b></span><b class="' + (Store.cashAt(cur) < 0 ? "r" : "g") + '">' + fmt(Store.cashAt(cur)) + "</b></div>" +
      '<div class="s"><span>Maior gasto</span><b>' + (biggest ? esc(catName(biggest.catId)) + " · " + fmt(biggest.amount) : "—") + "</b></div>" +
      '<div class="s"><span>Dívidas de terceiros</span><b>' + fmt(tdOpen) + "</b></div>" +
      "</div>"
    );
  }

  /* =====================================================================
     MODAIS: LANÇAMENTO
     ===================================================================== */
  function txSheet(id) {
    const t = id ? Store.tx(id) : null;
    const type = t ? t.type : "out";
    const dest = t ? (t.cardId ? "card:" + t.cardId : "acc:" + (t.accId || "")) : "";
    const accounts = Store.accounts();
    const cards = Store.cards();

    const destOpts =
      '<optgroup label="Contas">' +
      accounts.map((a) => '<option value="acc:' + a.id + '">' + esc(a.name) + "</option>").join("") +
      "</optgroup>" +
      (cards.length
        ? '<optgroup label="Cartões de crédito">' +
          cards
            .map(
              (c) =>
                '<option value="card:' + c.id + '">' + esc(c.name) + (c.final ? " •" + esc(c.final) : "") + "</option>"
            )
            .join("") +
          "</optgroup>"
        : "");

    const parcelasRow = t
      ? '<div class="field"><label>Parcela</label><div class="field" style="margin:0"><input value="' +
        (t.group ? t.group.n + " de " + t.group.total : "à vista") + '" disabled></div>' +
        '<div class="hint">Ao editar, altera apenas esta parcela.</div></div>'
      : '<div class="field" id="parcField" hidden><label>Parcelas</label>' +
        '<select name="installments">' +
        Array.from({ length: 24 }, (_, i) => i + 1)
          .map((n) => '<option value="' + n + '"' + (n === 1 ? " selected" : "") + ">" + n + "x " + (n > 1 ? "(mês a mês)" : "à vista") + "</option>")
          .join("") +
        '</select><div class="hint">Cada parcela vira um lançamento no mês correspondente.</div></div>';

    openSheet(
      '<h2>' + (t ? "Editar lançamento" : "Novo lançamento") + "</h2>" +
      '<form data-form="tx" data-id="' + (t ? t.id : "") + '">' +
      '<div class="seg">' +
      '<label class="s-in"><input type="radio" name="type" value="in" ' + (type === "in" ? "checked" : "") + "><span>↑ Entrada</span></label>" +
      '<label class="s-out"><input type="radio" name="type" value="out" ' + (type === "out" ? "checked" : "") + "><span>↓ Saída</span></label>" +
      "</div>" +
      '<div class="field"><label>Valor</label><div class="amount-wrap"><span class="cur">R$</span>' +
      '<input name="amount" inputmode="decimal" placeholder="0,00" value="' +
      (t ? (t.amount / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "") +
      '" required></div></div>' +
      '<div class="field"><label>Categoria</label><select name="catId" id="catSel">' +
      catOptions(type, t ? t.catId : null) +
      "</select></div>" +
      '<div class="field"><label>Pago com</label><select name="dest" id="destSel">' + destOpts + "</select></div>" +
      parcelasRow +
      '<div class="row2">' +
      '<div class="field"><label>Data</label><input type="date" name="date" value="' + (t ? t.date : today()) + '"></div>' +
      '<div class="field"><label>Descrição</label><input name="note" placeholder="Opcional" value="' + esc(t ? t.note : "") + '"></div>' +
      "</div>" +
      '<div class="form-actions">' +
      (t ? '<button type="button" class="btn danger" data-act="del-tx" data-id="' + t.id + '">Excluir</button>' : "") +
      '<button class="btn" type="submit">' + (t ? "Salvar" : "Adicionar") + "</button>" +
      "</div></form>"
    );
    setTimeout(syncDest, 0);
  }

  function catOptions(kind, selected) {
    return Store.categories(kind)
      .map(
        (c) =>
          '<option value="' + c.id + '"' + (c.id === selected ? " selected" : "") + ">" +
          c.icon + " " + esc(c.name) + "</option>"
      )
      .join("");
  }

  /* mostra/esconde parcelas conforme destino (cartão) */
  function syncDest() {
    const form = $("#modal-root form");
    if (!form) return;
    const dest = form.dest;
    const parc = $("#parcField", form);
    if (dest && parc) parc.hidden = !(dest.value || "").startsWith("card:");
  }

  /* =====================================================================
     MODAIS: CARTÃO
     ===================================================================== */
  function cardSheet(id) {
    const c = id ? Store.card(id) : null;
    const color = c ? c.color : CARD_COLORS[0];
    openSheet(
      "<h2>" + (c ? "Editar cartão" : "Novo cartão") + "</h2>" +
      '<form data-form="card" data-id="' + (c ? c.id : "") + '">' +
      '<div class="field"><label>Nome do cartão</label><input name="name" placeholder="Ex.: Nubank, Itaú..." value="' +
      esc(c ? c.name : "") + '" required></div>' +
      '<div class="row2">' +
      '<div class="field"><label>Final (4 dígitos)</label><input name="final" inputmode="numeric" maxlength="4" placeholder="1234" value="' + esc(c ? c.final : "") + '"></div>' +
      '<div class="field"><label>Limite total</label><input name="limit" inputmode="decimal" placeholder="Opcional" value="' +
      (c && c.limit ? (c.limit / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "") + '"></div>' +
      "</div>" +
      '<div class="row2">' +
      '<div class="field"><label>Dia do fechamento</label><input name="closing" type="number" min="1" max="31" value="' + (c ? c.closing : 1) + '"></div>' +
      '<div class="field"><label>Dia do vencimento</label><input name="due" type="number" min="1" max="31" value="' + (c ? c.due : 10) + '"></div>' +
      "</div>" +
      '<div class="field"><label>Cor</label><div class="tag-list" id="colorList">' +
      CARD_COLORS.map(
        (col) =>
          '<button type="button" class="tag" data-color="' + col + '" style="' +
          (col === color ? "border-color:var(--ink);box-shadow:0 0 0 2px var(--ink) inset" : "") +
          '"><span style="width:18px;height:18px;border-radius:50%;background:' + col + '"></span></button>'
      ).join("") +
      '<input type="hidden" name="color" value="' + color + '"></div></div>' +
      '<div class="form-actions">' +
      (c ? '<button type="button" class="btn danger" data-act="del-card" data-id="' + c.id + '">Excluir</button>' : "") +
      '<button class="btn" type="submit">' + (c ? "Salvar" : "Cadastrar") + "</button>" +
      "</div></form>"
    );
  }

  /* =====================================================================
     MODAIS: TERCEIRO
     ===================================================================== */
  function thirdSheet(id) {
    const t = id ? Store.thirdItem(id) : null;
    const cards = Store.cards();
    const cardOpts =
      '<option value="">— sem cartão —</option>' +
      cards
        .map(
          (c) =>
            '<option value="' + c.id + '"' + (t && t.cardId === c.id ? " selected" : "") + ">" +
            esc(c.name) + (c.final ? " •" + esc(c.final) : "") + "</option>"
        )
        .join("");

    openSheet(
      "<h2>" + (t ? "Editar gasto de terceiro" : "Gasto de terceiro") + "</h2>" +
      '<form data-form="third" data-id="' + (t ? t.id : "") + '">' +
      '<div class="field"><label>Quem comprou</label><input name="person" placeholder="Nome da pessoa" value="' +
      esc(t ? t.person : "") + '" required></div>' +
      '<div class="field"><label>Valor</label><div class="amount-wrap"><span class="cur">R$</span>' +
      '<input name="amount" inputmode="decimal" placeholder="0,00" value="' +
      (t ? (t.amount / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "") +
      '" required></div></div>' +
      '<div class="row2">' +
      '<div class="field"><label>Data da compra</label><input type="date" name="date" value="' + (t ? t.date : today()) + '"></div>' +
      '<div class="field"><label>Cartão usado</label><select name="cardId">' + cardOpts + "</select></div>" +
      "</div>" +
      '<div class="field"><label>Obs.</label><input name="note" placeholder="Ex.: comprou meu sapato" value="' + esc(t ? t.note : "") + '"></div>' +
      (t
        ? '<div class="field"><label>Situação</label><select name="status">' +
          '<option value="open"' + (t.status === "open" ? " selected" : "") + ">A devolver</option>" +
          '<option value="paid"' + (t.status === "paid" ? " selected" : "") + ">Já devolvido</option>" +
          "</select></div>"
        : "") +
      '<div class="form-actions">' +
      (t ? '<button type="button" class="btn danger" data-act="del-third" data-id="' + t.id + '">Excluir</button>' : "") +
      '<button class="btn" type="submit">' + (t ? "Salvar" : "Adicionar") + "</button>" +
      "</div></form>"
    );
  }

  /* =====================================================================
     MODAL: AJUSTES / BACKUP
     ===================================================================== */
  /* bloco de backup dentro dos Ajustes */
  function backupCard() {
    const st = Store.stats();
    const lb = Store.settings().lastBackup;
    const dias = lb ? Math.floor((Date.now() - new Date(lb).getTime()) / 86400000) : null;
    const velho = !lb || dias >= 7;
    const quando = lb ? new Date(lb).toLocaleDateString("pt-BR") : "nunca";
    const idade =
      !lb ? "você nunca fez backup"
      : dias === 0 ? "feito hoje"
      : dias === 1 ? "feito ontem"
      : "feito há " + dias + " dias";
    return (
      '<div class="sec-title">Backup dos seus dados</div>' +
      '<div class="card bk">' +
      '<div class="bk-resumo">📦 ' + st.tx + " lançamento(s) · " + st.cards + " cartão(ões) · " +
      st.third + " pessoa(s)</div>" +
      '<div class="bk-ultimo' + (velho && (st.tx || st.cards || st.third) ? " warn" : "") + '">' +
      "Último export: " + quando + " <span>(" + idade + ")</span></div>" +
      '<div class="bk-btns">' +
      '<button class="btn" data-act="export">📤 Exportar</button>' +
      '<button class="btn ghost" data-act="import">📥 Importar</button>' +
      "</div>" +
      '<div class="bk-dica">Exportar gera um arquivo <b>.json</b> com tudo — envie para o Google Drive, ' +
      "WhatsApp ou Arquivos do celular. Para trocar de aparelho, é só Importar lá.</div>" +
      "</div>"
    );
  }

  function settingsSheet() {
    const cats = Store.categories();
    const ini = Store.settings().initialBalance || 0;
    openSheet(
      "<h2>Ajustes</h2>" +
      '<div class="settings-list">' +
      '<button data-act="install">📲 Instalar no celular<span class="arrow">›</span></button>' +
      '<button data-act="check-update">🔄 Verificar atualização<span class="arrow">›</span></button>' +
      "</div>" +
      backupCard() +
      '<div class="sec-title">Saldo inicial (caixa de partida)</div>' +
      '<div class="field">' +
      '<form data-form="initial" style="display:flex;gap:8px">' +
      '<div class="amount-wrap" style="flex:1"><span class="cur">R$</span>' +
      '<input name="initial" inputmode="decimal" placeholder="0,00" value="' +
      (ini ? (ini / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "") +
      '"></div>' +
      '<button class="btn small" type="submit" style="align-self:center">Salvar</button>' +
      "</form>" +
      '<div class="hint">Dinheiro que você já tem hoje. Entra como saldo do mês anterior ao seu primeiro lançamento — assim o caixa bate com a realidade.</div>' +
      "</div>" +
      '<div class="sec-title">Categorias</div>' +
      '<div class="field"><label>Adicionar categoria</label>' +
      '<form data-form="cat" style="display:flex;gap:8px">' +
      '<input name="name" placeholder="Nome da categoria" required style="flex:1">' +
      '<select name="kind" style="width:110px"><option value="out">Saída</option><option value="in">Entrada</option></select>' +
      '<button class="btn small" type="submit">＋</button></form></div>' +
      '<div class="tag-list">' +
      cats
        .map(
          (c) =>
            '<span class="tag">' + c.icon + " " + esc(c.name) +
            (c.id.indexOf("out_") === 0 || c.id.indexOf("in_") === 0
              ? ""
              : ' <button data-act="del-cat" data-id="' + c.id + '">×</button>') +
            "</span>"
        )
        .join("") +
      "</div>" +
      '<div class="hint" style="font-size:12px;color:var(--ink-3);margin-top:10px">' +
      "Categorias padrão não podem ser removidas.</div>" +
      '<div class="sec-title">Conta na nuvem</div>' +
      '<div class="card" style="margin:0"><p style="margin:0 0 12px;font-size:14px;color:var(--ink-2);line-height:1.5">' +
      "A Fase 2 adiciona login e sincronização entre dispositivos (Supabase). Nesta versão os dados ficam somente neste aparelho — faça backup regularmente.</p>" +
      '<button class="btn ghost" data-act="close-modal">Entendi</button></div>' +
      '<div class="settings-list danger">' +
      '<button data-act="reset">🗑️ Apagar todos os dados deste aparelho<span class="arrow">›</span></button>' +
      "</div>" +
      '<div class="app-version">Finanças · versão ' + APP_VERSION + " · publicado em " +
      BUILD_DATE + "</div>" +
      '<input type="file" id="importFile" accept="application/json,.json" hidden>'
    );
  }

  /* =====================================================================
     RENDER
     ===================================================================== */
  const VIEWS = {
    home: viewHome,
    tx: viewTx,
    cards: viewCards,
    third: viewThird,
    report: viewReport
  };

  function render() {
    $("#view").innerHTML = (VIEWS[state.route] || viewHome)();
    $$("#tabbar button").forEach((b) =>
      b.classList.toggle("active", b.dataset.route === state.route)
    );
    $("#fab").hidden = !(state.route === "home" || state.route === "tx");
    if (location.hash.slice(1) !== state.route)
      history.replaceState(null, "", "#" + state.route);
  }

  function go(route) {
    if (!VIEWS[route]) route = "home";
    state.route = route;
    window.scrollTo(0, 0);
    render();
  }

  /* =====================================================================
     AÇÕES
     ===================================================================== */
  /* ---------------- atualização do app ---------------- */
  /* lê a versão publicada direto no sw.js (sem cache) */
  function remoteVersion() {
    return fetch("sw.js", { cache: "no-store" })
      .then((r) => r.text())
      .then((t) => {
        const m = t.match(/VERSION\s*=\s*"([^"]+)"/);
        return m ? m[1] : null;
      })
      .catch(() => null);
  }

  /* faixa fixa avisando que saiu versão nova */
  function showUpdateBar(v) {
    if (document.getElementById("update-bar")) return;
    const bar = document.createElement("div");
    bar.id = "update-bar";
    bar.innerHTML =
      '⬆️ Nova versão <b>v' + esc(v) + '</b> disponível <button type="button">Atualizar</button>';
    bar.querySelector("button").onclick = () => {
      bar.textContent = "Atualizando…";
      navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {});
      setTimeout(() => location.reload(), 900);
    };
    document.body.appendChild(bar);
  }

  const actions = {
    goto(el) { go(el.dataset.route); },
    month(el) { state.month = addMonths(state.month, Number(el.dataset.d)); render(); },
    filter(el) {
      if (el.dataset.kind === "tx") state.txFilter = el.dataset.f;
      else state.thirdFilter = el.dataset.f;
      render();
    },
    "close-modal"() { closeSheet(); },
    "check-update"() {
      closeSheet();
      if (location.protocol.indexOf("http") !== 0) {
        toast("Executando localmente · versão " + APP_VERSION);
        return;
      }
      toast("Verificando atualização…");
      remoteVersion().then((v) => {
        if (!v) { toast("Não foi possível verificar agora"); return; }
        if (v === APP_VERSION) { toast("Você já está na versão " + APP_VERSION + " ✅"); return; }
        toast("Nova versão " + v + " encontrada! Atualizando…");
        navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {});
        setTimeout(() => location.reload(), 1200);
      });
    },
    "confirm-yes"() {
      const fn = pendingConfirm;
      closeSheet();
      if (fn) fn();
    },

    "new-tx"() { txSheet(null); },
    "edit-tx"(el) { txSheet(el.dataset.id); },
    "del-tx"(el) {
      const t = Store.tx(el.dataset.id);
      if (!t) return;
      askConfirm(
        "Excluir lançamento?",
        t.group
          ? "Esta parcela (" + t.group.n + " de " + t.group.total + ") será removida. As demais parcelas continuam."
          : fmt(t.amount) + " · " + (t.note || catName(t.catId)),
        () => { Store.removeTx(t.id); closeSheet(); render(); toast("Lançamento excluído"); }
      );
    },

    "new-card"() { cardSheet(null); },
    "edit-card"(el) { cardSheet(el.dataset.id); },
    "del-card"(el) {
      const c = Store.card(el.dataset.id);
      if (!c) return;
      askConfirm(
        "Excluir cartão?",
        "Os lançamentos vinculados a " + c.name + " serão mantidos, apenas sem vínculo.",
        () => { Store.removeCard(c.id); closeSheet(); render(); toast("Cartão excluído"); }
      );
    },

    "new-third"() { thirdSheet(null); },
    "edit-third"(el) { thirdSheet(el.dataset.id); },
    "toggle-third"(el) {
      const t = Store.thirdItem(el.dataset.id);
      if (!t) return;
      const paid = t.status === "paid";
      Store.updateThird(t.id, {
        status: paid ? "open" : "paid",
        paidAt: paid ? null : today()
      });
      render();
      toast(paid ? "Voltou para 'a devolver'" : "Marcado como devolvido ✓");
    },
    "del-third"(el) {
      const t = Store.thirdItem(el.dataset.id);
      if (!t) return;
      askConfirm("Excluir registro?", t.person + " · " + fmt(t.amount),
        () => { Store.removeThird(t.id); closeSheet(); render(); toast("Registro excluído"); });
    },

    settings() { settingsSheet(); },
    install() {
      if (deferredInstall) {
        deferredInstall.prompt();
        deferredInstall.userChoice.then(() => (deferredInstall = null));
        return;
      }
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      openSheet(
        "<h2>📲 Instalar no celular</h2>" +
        '<div style="font-size:14.5px;line-height:1.6;color:var(--ink-2)">' +
        (ios
          ? "<b style=\"color:var(--ink)\">iPhone / iPad (Safari)</b><br>1. Abra o app no Safari.<br>2. Toque no botão <b>Compartilhar</b> (quadrado com seta).<br>3. Escolha <b>Adicionar à Tela de Início</b>.<br>4. Confirme em <b>Adicionar</b>."
          : "<b style=\"color:var(--ink)\">Android (Chrome)</b><br>1. Abra o app no Chrome.<br>2. Toque nos três pontos ⋮.<br>3. Escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.<br>4. Confirme em <b>Instalar</b>.") +
        "</div>" +
        '<div class="card" style="margin-top:14px;font-size:13.5px;line-height:1.55;color:var(--ink-2)">' +
        "⚠️ O endereço precisa ser <b>http://</b> ou <b>https://</b> (ex.: um servidor local ou um site público) — " +
        "arquivo direto (<code>file://</code>) não pode ser instalado. Depois de instalado, funciona offline.</div>" +
        '<div class="form-actions"><button class="btn" data-act="close-modal">Entendi</button></div>'
      );
    },
    "del-cat"(el) {
      if (!Store.removeCategory(el.dataset.id)) {
        toast("Categoria em uso — não foi possível remover");
        return;
      }
      settingsSheet();
      render();
      toast("Categoria removida");
    },
    export() {
      const texto = Store.exportJSON();
      const nome = "backup-financas-" + today() + ".json";
      const arquivo = new File([texto], nome, { type: "application/json" });

      /* celular: abre a folha do Android — manda direto para o Google Drive,
         WhatsApp, E-mail ou Arquivos do aparelho */
      if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
        navigator
          .share({ files: [arquivo], title: "Backup Minha Vida Financeira" })
          .then(() => {
            Store.markBackup();
            settingsSheet();
            toast("Backup compartilhado ✓");
          })
          .catch(() => {
            settingsSheet();
            toast("Exportação cancelada");
          });
        return;
      }

      /* PC / navegador sem compartilhamento: baixa o arquivo */
      const blob = new Blob([texto], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = nome;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      Store.markBackup();
      settingsSheet();
      toast("Backup salvo: " + nome);
    },
    import() {
      const st = Store.stats();
      const abrir = () => {
        /* reabre os Ajustes para o input de arquivo existir no DOM */
        settingsSheet();
        const inp = $("#importFile");
        if (!inp) return;
        inp.onchange = () => {
          const f = inp.files[0];
          if (!f) { settingsSheet(); return; }
          const r = new FileReader();
          r.onload = () => {
            try {
              const res = Store.importJSON(r.result);
              closeSheet();
              render();
              toast("Backup importado ✓ " + res.tx + " lançamentos");
            } catch (e) {
              settingsSheet();
              toast("Arquivo inválido — use um backup .json deste app");
            }
          };
          r.onerror = () => { settingsSheet(); toast("Não foi possível ler o arquivo"); };
          r.readAsText(f);
        };
        inp.oncancel = () => settingsSheet();
        inp.click();
      };

      if (st.tx || st.cards || st.third) {
        askConfirm(
          "Importar backup?",
          "O arquivo escolhido vai SUBSTITUIR tudo o que está neste aparelho (" +
            st.tx + " lançamentos, " + st.cards + " cartões, " + st.third +
            " pessoas). Se quiser guardar o que tem agora, cancele e exporte primeiro.",
          abrir,
          "Substituir tudo"
        );
      } else {
        abrir();
      }
    },
    reset() {
      askConfirm("Apagar tudo?", "Todos os lançamentos, cartões e terceiros serão perdidos.",
        () => { Store.reset(); closeSheet(); go("home"); toast("Dados apagados"); });
    }
  };

  /* ---------------- eventos globais ---------------- */
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (el) {
      const fn = actions[el.dataset.act];
      if (fn) { e.preventDefault(); fn(el); }
      return;
    }
    const tab = e.target.closest("#tabbar [data-route]");
    if (tab) go(tab.dataset.route);
  });

  document.addEventListener("change", (e) => {
    if (e.target.name === "type") {
      const form = e.target.closest("form");
      const sel = form && form.querySelector("[name=catId]");
      if (sel) {
        const keep = Store.cat(sel.value);
        sel.innerHTML = catOptions(e.target.value, keep && keep.kind === e.target.value ? keep.id : null);
      }
    }
    if (e.target.name === "dest") syncDest();
  });

  document.addEventListener("click", (e) => {
    const sw = e.target.closest("#colorList [data-color]");
    if (!sw) return;
    const list = $("#colorList");
    $$("[data-color]", list).forEach((b) => (b.style.cssText = ""));
    sw.style.cssText = "border-color:var(--ink);box-shadow:0 0 0 2px var(--ink) inset";
    list.querySelector("[name=color]").value = sw.dataset.color;
  });

  document.addEventListener("submit", (e) => {
    const form = e.target.closest("form[data-form]");
    if (!form) return;
    e.preventDefault();
    const kind = form.dataset.form;
    const fd = new FormData(form);

    if (kind === "tx") return saveTx(form, fd);
    if (kind === "card") return saveCard(form, fd);
    if (kind === "third") return saveThird(form, fd);
    if (kind === "initial") {
      Store.setSetting("initialBalance", parseMoney(fd.get("initial")));
      settingsSheet();
      render();
      toast("Saldo inicial atualizado");
      return;
    }
    if (kind === "cat") {
      const name = String(fd.get("name") || "").trim();
      if (!name) return;
      Store.addCategory({ name, kind: fd.get("kind"), icon: fd.get("kind") === "in" ? "➕" : "📌" });
      settingsSheet();
      render();
      toast("Categoria adicionada");
    }
  });

  function saveTx(form, fd) {
    const amount = parseMoney(fd.get("amount"));
    if (amount <= 0) return toast("Informe o valor");
    const dest = String(fd.get("dest") || "");
    const isCard = dest.indexOf("card:") === 0;
    const base = {
      type: fd.get("type"),
      amount,
      date: fd.get("date") || today(),
      catId: fd.get("catId"),
      note: String(fd.get("note") || "").trim(),
      cardId: isCard ? dest.slice(5) : null,
      accId: isCard ? null : dest.slice(4) || null
    };
    const id = form.dataset.id;
    if (id) {
      Store.updateTx(id, base);
      toast("Lançamento atualizado");
    } else {
      const n = isCard && base.type === "out" ? Math.max(1, Number(fd.get("installments")) || 1) : 1;
      if (n > 1) {
        Store.addInstallments(base, n);
        toast(n + "x parcela criada");
      } else {
        Store.addTx(base);
        toast("Lançamento adicionado");
      }
    }
    closeSheet();
    render();
  }

  function saveCard(form, fd) {
    const name = String(fd.get("name") || "").trim();
    if (!name) return toast("Informe o nome do cartão");
    const patch = {
      name,
      final: String(fd.get("final") || "").replace(/\D/g, "").slice(0, 4),
      limit: parseMoney(fd.get("limit")),
      closing: Math.min(31, Math.max(1, Number(fd.get("closing")) || 1)),
      due: Math.min(31, Math.max(1, Number(fd.get("due")) || 10)),
      color: fd.get("color") || CARD_COLORS[0]
    };
    if (form.dataset.id) {
      Store.updateCard(form.dataset.id, patch);
      toast("Cartão atualizado");
    } else {
      Store.addCard(patch);
      toast("Cartão cadastrado");
    }
    closeSheet();
    render();
  }

  function saveThird(form, fd) {
    const amount = parseMoney(fd.get("amount"));
    const person = String(fd.get("person") || "").trim();
    if (!person) return toast("Informe quem comprou");
    if (amount <= 0) return toast("Informe o valor");
    const patch = {
      person,
      amount,
      date: fd.get("date") || today(),
      cardId: fd.get("cardId") || null,
      note: String(fd.get("note") || "").trim()
    };
    if (fd.has("status")) {
      patch.status = fd.get("status");
      patch.paidAt = patch.status === "paid" ? today() : null;
    }
    if (form.dataset.id) {
      Store.updateThird(form.dataset.id, patch);
      toast("Registro atualizado");
    } else {
      Store.addThird(patch);
      toast("Gasto de terceiro registrado");
    }
    closeSheet();
    render();
  }

  /* ---------------- boot ---------------- */
  let deferredInstall = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstall = e;
  });

  window.addEventListener("hashchange", () => go(location.hash.slice(1)));
  go(location.hash.slice(1) || "home");

  /* lembrete de backup: se passar 7 dias sem exportar, avisa uma vez por dia */
  (function lembreteBackup() {
    try {
      if (location.protocol.indexOf("http") !== 0) return;
      const st = Store.stats();
      if (!st.tx && !st.cards && !st.third) return;
      const lb = Store.settings().lastBackup;
      const dias = lb ? Math.floor((Date.now() - new Date(lb).getTime()) / 86400000) : 0;
      if (lb && dias < 7) return;
      const hoje = today();
      if (localStorage.getItem("fin_aviso_backup") === hoje) return;
      localStorage.setItem("fin_aviso_backup", hoje);
      setTimeout(
        () =>
          toast(
            lb
              ? "Faz " + dias + " dias sem exportar backup ⚙️"
              : "Você ainda não fez backup ⚙️ Ajustes"
          ),
        2600
      );
    } catch (e) {}
  })();

  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    navigator.serviceWorker
      .register("sw.js")
      .then(function (reg) {
        /* força checagem de versão para não ficar preso no cache antigo */
        reg.update();
        /* compara a versão publicada com a que está rodando */
        remoteVersion().then(function (v) {
          if (v && v !== APP_VERSION) showUpdateBar(v);
        });
      })
      .catch(function () {});
  } else {
    /* modo local (file://) — mostra a versão uma vez por sessão */
    console.info("Finanças v" + APP_VERSION + " (" + BUILD_DATE + ")");
  }
})();
