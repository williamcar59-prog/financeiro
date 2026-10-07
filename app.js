/* =====================================================================
   app.js — telas, modais e interações do MVP
   ===================================================================== */
(function () {
  "use strict";

  Store.init();

  /* ---------------- versão do app ----------------
     >>> ao publicar uma atualização: mude AQUI e no sw.js (mesmo número) */
  const APP_VERSION = "1.6.1";
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
  let pendingCancel = null;

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
    const cancelou = pendingCancel;
    $("#modal-root").innerHTML = "";
    pendingConfirm = null;
    pendingCancel = null;
    if (cancelou) cancelou();
  }
  function askConfirm(title, text, fn, okLabel, onCancel) {
    pendingConfirm = fn;
    pendingCancel = typeof onCancel === "function" ? onCancel : null;
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
    const somaContas = Store.accBalances(mk).reduce((s, x) => s + x.v, 0);

    if (!list.length && !cards.length && !Store.data.third.length && Store.openingTotal() === 0) {
      return (
        headerHome() +
        '<div class="empty"><div class="big">💸</div><h3>Vamos começar</h3>' +
        "<p>Registre seu primeiro lançamento, cadastre seus cartões de crédito e controle quem gasta com o seu cartão.</p>" +
        '<div class="form-actions">' +
        '<button class="btn" data-act="new-tx">Novo lançamento</button>' +
        "</div>" +
        '<div style="height:10px"></div>' +
        '<button class="btn ghost" data-act="settings">💰 Definir meu dinheiro (contas)</button>' +
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

      /* contas: saldo separado de cada uma (soma = caixa acima) */
      '<div class="sec-title">💰 Contas <button data-act="move">💸 transferir</button></div>' +
      '<div class="card pad0">' +
      Store.accBalances(mk).map(accRow).join("") +
      '<div class="acc-row total"><span>💰 Total</span><b>' + fmt(somaContas) + "</b></div>" +
      ultimaMovHtml() +
      "</div>" +

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

  /* linha de conta com saldo (usada no Painel) */
  function accRow(x) {
    return (
      '<div class="acc-row"><span class="ai">' + (x.a.icon || "🏦") + " " + esc(x.a.name) + "</span>" +
      '<b class="' + (x.v < 0 ? "neg" : "") + '">' + fmt(x.v) + "</b></div>"
    );
  }

  /* rodapé da caixa de contas: última transferência registrada */
  function ultimaMovHtml() {
    const t = Store.lastTransfer();
    if (!t) return "";
    const de = Store.account(t.from), para = Store.account(t.to);
    return (
      '<div class="acc-mov">↔️ ' + fmt(t.amount) + " · " +
      esc(de ? de.name : "?") + " → " + esc(para ? para.name : "?") +
      " · " + esc(String(t.date).split("-").reverse().slice(0, 2).join("/")) + "</div>"
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
      body +
      recsSection()
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

  /* linha de um limite no relatório */
  function orcRow(o) {
    const cor = o.estourou ? "var(--out)" : o.pct >= 80 ? "var(--warn)" : "var(--brand)";
    const cls = o.estourou ? "estourou" : o.pct >= 80 ? "quase" : "";
    const texto = o.estourou
      ? "⚠️ Estourou " + fmt(o.gasto - o.limite)
      : "Faltam " + fmt(o.faltou);
    return (
      '<div class="cat-row orc"><div class="top-l">' +
      '<b><span class="bar-ico">' + catIcon(o.catId) + "</span>" + esc(catName(o.catId)) + "</b>" +
      '<span class="orc-valor ' + cls + '">' + fmt(o.gasto) + " / " + fmt(o.limite) + "</span></div>" +
      '<div class="track"><i style="width:' + o.pct + "%;background:" + cor + '"></i></div>' +
      '<div class="orc-dica ' + cls + '">' + texto + " · " + o.pct + "% do limite</div>" +
      "</div>"
    );
  }

  /* ---------------- contas fixas ---------------- */
  function recsSection() {
    const recs = Store.recurrences();
    return (
      '<div class="sec-title">🔁 Contas fixas ' +
      '<button data-act="new-rec">' + (recs.length ? "＋ adicionar" : "cadastrar") + "</button></div>" +
      (recs.length
        ? '<div class="card pad0">' + recs.map(recRow).join("") + "</div>" +
          '<div class="orc-dica" style="margin-top:-4px">Criadas sozinhas todo mês, no dia marcado.</div>'
        : '<div class="card"><p style="margin:0 0 12px;font-size:14px;color:var(--ink-2);line-height:1.5">' +
          "Aluguel, luz, internet, assinaturas — e também o que <b>entra</b> todo mês " +
          "(salário, rendimento do cofrinho): cadastre uma vez e o app lança sozinho, sem você esquecer.</p>" +
          '<button class="btn ghost" data-act="new-rec">＋ Adicionar conta fixa</button></div>')
    );
  }

  function recRow(r) {
    const c = r.cardId ? Store.card(r.cardId) : null;
    return (
      '<div class="rec-item">' +
      '<div class="row-ico">' + catIcon(r.catId) + "</div>" +
      '<div class="row-mid"><div class="t">' + esc(r.note || catName(r.catId)) + "</div>" +
      '<div class="s">todo dia ' + r.day +
      (c ? '<span class="pill card-pill">' + esc(c.name) + "</span>" : "") +
      "</div></div>" +
      '<div class="row-val ' + (r.type === "in" ? "in" : "out") + '">' +
      (r.type === "in" ? "+" : "−") + fmt(r.amount) + "</div>" +
      '<button class="rec-del" data-act="del-rec" data-id="' + r.id + '" aria-label="Remover conta fixa">×</button>' +
      "</div>"
    );
  }

  function recSheet() {
    const cats = Store.categories().filter(
      (c) => !(c.id.indexOf("in_") === 0 || c.kind === "in")
    );
    const cards = Store.cards();
    const destOpts =
      '<optgroup label="Contas">' +
      Store.accounts()
        .map((a) => '<option value="acc:' + a.id + '">' + esc(a.name) + "</option>")
        .join("") +
      "</optgroup>" +
      (cards.length
        ? '<optgroup label="Cartões de crédito">' +
          cards
            .map(
              (c) =>
                '<option value="card:' + c.id + '">' + esc(c.name) +
                (c.final ? " •" + esc(c.final) : "") + "</option>"
            )
            .join("") +
          "</optgroup>"
        : "");

    openSheet(
      "<h2>🔁 Nova conta fixa</h2>" +
      '<p class="sheet-intro">Todo mês, no dia escolhido, o app cria o lançamento sozinho ' +
      "— pode ser saída (aluguel, assinaturas) ou entrada (salário, rendimento).</p>" +
      '<form data-form="rec">' +
      '<div class="seg">' +
      '<label class="s-out"><input type="radio" name="type" value="out" checked><span>↓ Saída</span></label>' +
      '<label class="s-in"><input type="radio" name="type" value="in"><span>↑ Entrada</span></label>' +
      "</div>" +
      '<div class="field"><label>Valor</label><div class="amount-wrap"><span class="cur">R$</span>' +
      '<input name="amount" inputmode="decimal" placeholder="0,00" required></div></div>' +
      '<div class="field"><label>Nome / descrição</label>' +
      '<input name="note" placeholder="Ex.: Aluguel, Salário, Netflix..."></div>' +
      '<div class="row2">' +
      '<div class="field"><label>Dia do mês</label>' +
      '<input name="day" type="number" min="1" max="31" value="5" required></div>' +
      '<div class="field"><label>Categoria</label><select name="catId">' +
      catOptions("out", "out_moradia") + "</select></div>" +
      "</div>" +
      '<div class="field"><label>Conta ou cartão</label><select name="dest">' + destOpts + "</select></div>" +
      '<div class="form-actions">' +
      '<button class="btn ghost" type="button" data-act="close-modal">Cancelar</button>' +
      '<button class="btn" type="submit">Criar conta fixa</button></div></form>'
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

    /* de onde veio o dinheiro (entradas por categoria) */
    const listIn = Store.txOfMonth(cur).filter((t) => t.type === "in");
    const totalIn = listIn.reduce((s, t) => s + t.amount, 0);
    const byIn = {};
    listIn.forEach((t) => (byIn[t.catId] = (byIn[t.catId] || 0) + t.amount));
    const catsIn = Object.keys(byIn)
      .map((id) => ({ id, v: byIn[id] }))
      .sort((a, b) => b.v - a.v);
    const entHtml = catsIn.length
      ? '<div class="sec-title">Onde entrou o dinheiro em ' + esc(monthLabel(cur)) + "</div>" +
        '<div class="card">' +
        catsIn
          .map((c) => {
            const pct = totalIn ? Math.round((c.v / totalIn) * 100) : 0;
            return (
              '<div class="cat-row cat-in"><div class="top-l"><b><span class="bar-ico">' +
              catIcon(c.id) +
              "</span>" + esc(catName(c.id)) +
              "</b><span>" + fmt(c.v) + " · " + pct + "%</span></div>" +
              '<div class="track"><i style="width:' + pct + '%"></i></div></div>'
            );
          })
          .join("") +
        '<div class="orc-dica">Total recebido no mês: <b>' + fmt(totalIn) + "</b></div>" +
        "</div>"
      : "";

    /* limites por categoria */
    const orcamentos = Store.budgetStatus(cur);
    const orcHtml = orcamentos.length
      ? '<div class="sec-title">🎯 Orçamento de ' + esc(monthLabel(cur)) + "</div>" +
        '<div class="card">' + orcamentos.map(orcRow).join("") + "</div>"
      : "";

    return (
      '<div class="top"><div><h1>Relatórios</h1><div class="sub">Últimos 6 meses</div></div>' +
      monthNav() + "</div>" +

      '<div class="card">' + chart + "</div>" +

      '<div class="grid3">' +
      mini("📊", "Média saídas", fmt(avgOut), "bad") +
      mini("📈", "Média entradas", fmt(avgIn), "ok") +
      mini("👥", "A receber", fmt(tdOpen), "warn") +
      "</div>" +

      '<div class="sec-title">Onde foi o dinheiro em ' + esc(monthLabel(cur)) +
      ' <button data-act="budgets">🎯 limites</button></div>' +
      '<div class="card">' + catHtml + "</div>" +

      entHtml +
      orcHtml +

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
        "</select>" +
        '<div class="seg seg-vmode" id="vmodeField" hidden>' +
        '<label class="s-tot"><input type="radio" name="vmode" value="total" checked><span>Valor total</span></label>' +
        '<label class="s-pc"><input type="radio" name="vmode" value="parc"><span>Valor da parcela</span></label>' +
        "</div>" +
        '<div class="hint strong" id="parcPreview"></div>' +
        '<div class="hint">Cada parcela vira um lançamento no mês correspondente.</div></div>' +
        '<div class="field" id="paidField" hidden><label>Já paguei</label>' +
        '<input name="paid" type="number" min="0" max="23" inputmode="numeric" value="0">' +
        '<div class="hint">Compra antiga? As parcelas quitadas não geram lançamento ' +
        "— ex.: 12x com 3 pagas cria só da <b>4/12</b> até a <b>12/12</b>.</div></div>";

    openSheet(
      '<h2>' + (t ? "Editar lançamento" : "Novo lançamento") + "</h2>" +
      '<form data-form="tx" data-id="' + (t ? t.id : "") + '">' +
      '<div class="seg">' +
      '<label class="s-in"><input type="radio" name="type" value="in" ' + (type === "in" ? "checked" : "") + "><span>↑ Entrada</span></label>" +
      '<label class="s-out"><input type="radio" name="type" value="out" ' + (type === "out" ? "checked" : "") + "><span>↓ Saída</span></label>" +
      "</div>" +
      '<div class="field"><label id="amtLabel">Valor</label><div class="amount-wrap"><span class="cur">R$</span>' +
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

  /* mostra/esconde parcelas e "já paguei" conforme destino/tipo */
  function syncDest() {
    const form = $("#modal-root form");
    if (!form) return;
    const dest = form.dest;
    const tipo = form.querySelector('[name="type"]:checked');
    const saida = !tipo || tipo.value === "out";
    const noCartao = !!dest && (dest.value || "").startsWith("card:");
    const parc = $("#parcField", form);
    const verParc = noCartao && saida;
    if (parc) parc.hidden = !verParc;
    const pago = $("#paidField", form);
    if (pago) {
      const n = Number(form.installments ? form.installments.value : 1) || 1;
      pago.hidden = !(verParc && n > 1);
    }
    syncParcelas(form);
  }

  /* seletor "valor total / valor da parcela" + prévia do cálculo.
     Só aparece em compra de cartão parcelada (n > 1). */
  function syncParcelas(form) {
    if (!form) return;
    const tipo = form.querySelector('[name="type"]:checked');
    const saida = !tipo || tipo.value === "out";
    const destino = form.dest ? String(form.dest.value || "") : "";
    const n = Number(form.installments ? form.installments.value : 1) || 1;
    const ativo = destino.indexOf("card:") === 0 && saida && n > 1;
    const vm = $("#vmodeField", form);
    if (vm) vm.hidden = !ativo;
    const marcas = form.querySelector('[name="vmode"]:checked');
    const modo = ativo && marcas && marcas.value === "parc" ? "parc" : "total";
    const lbl = $("#amtLabel", form);
    if (lbl) {
      lbl.textContent = !ativo
        ? "Valor"
        : modo === "total"
          ? "Valor total da compra"
          : "Valor da parcela";
    }
    const prev = $("#parcPreview", form);
    if (!prev) return;
    if (!ativo) {
      prev.textContent = "";
      return;
    }
    const bruto = parseMoney(form.amount ? form.amount.value : "");
    if (modo === "total") {
      const unit = Math.floor(bruto / n);
      const resto = bruto - unit * n;
      prev.textContent = !bruto
        ? "Informe o total da compra — ele é dividido em " + n + "x"
        : n +
          "x de " +
          fmt(unit) +
          (resto ? " a " + fmt(unit + 1) : "") +
          " = " +
          fmt(bruto);
    } else {
      prev.textContent = !bruto
        ? "Informe o valor de cada parcela"
        : "Total da compra: " + fmt(bruto * n);
    }
  }

  /* =====================================================================
     MODAIS: CARTÃO
     ===================================================================== */
  /* de qual conta sai o dinheiro das compras deste cartão */
  function cardAccRow(c) {
    const alvo = (c && c.accId) || Store.defaultAccId();
    return (
      '<div class="field"><label>Conta que paga</label><select name="accId">' +
      Store.accounts()
        .map((a) => '<option value="' + a.id + '"' + (a.id === alvo ? " selected" : "") + ">" +
          (a.icon || "🏦") + " " + esc(a.name) + "</option>")
        .join("") +
      '</select><div class="hint">As compras do cartão já descontam do saldo desta conta no mês da parcela.</div></div>'
    );
  }

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
      (Store.accounts().length > 1 ? cardAccRow(c) : "") +
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
      st.third + " pessoa(s)" + (st.recs ? " · 🔁 " + st.recs + " conta(s) fixa(s)" : "") +
      (st.accs ? " · 💰 " + st.accs + " conta(s)" : "") + "</div>" +
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

  /* folha de limites por categoria */
  function budgetsSheet() {
    const b = Store.budgets();
    const cats = Store.categories().filter(
      (c) => !(c.id.indexOf("in_") === 0 || c.kind === "in")
    );
    const linhas = cats
      .map((c) => {
        const v = b[c.id] || 0;
        return (
          '<div class="field orc-linha"><label>' + c.icon + " " + esc(c.name) + "</label>" +
          '<div class="amount-wrap"><span class="cur">R$</span>' +
          '<input name="b_' + c.id + '" inputmode="decimal" placeholder="Sem limite" value="' +
          (v ? (v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "") +
          '"></div></div>'
        );
      })
      .join("");

    openSheet(
      "<h2>🎯 Orçamento por categoria</h2>" +
      '<p class="sheet-intro">Quanto você quer gastar por mês em cada categoria? ' +
      "Quando chegar perto do limite, o app avisa. Deixe em branco o que não quiser controlar.</p>" +
      '<form data-form="budgets">' + linhas +
      '<div class="form-actions">' +
      '<button class="btn ghost" type="button" data-act="close-modal">Cancelar</button>' +
      '<button class="btn" type="submit">Salvar limites</button></div></form>'
    );
  }

  /* =====================================================================
     MODAIS: MOVIMENTAR ENTRE CONTAS (transferência / rendimento)
     ===================================================================== */
  function moveSheet() {
    const accs = Store.accounts();
    if (accs.length < 2) return toast("Cadastre pelo menos 2 contas nos Ajustes");
    const opt = (sel) =>
      accs
        .map((a) => '<option value="' + a.id + '"' + (a.id === sel ? " selected" : "") + ">" +
          (a.icon || "🏦") + " " + esc(a.name) + "</option>")
        .join("");
    const banco = Store.defaultAccId();

    openSheet(
      "<h2>💸 Movimentar contas</h2>" +
      '<p class="sheet-intro">Transferir <b>não</b> é gasto — o dinheiro só muda de lugar. ' +
      "Rendimento é dinheiro novo e entra como <b>entrada</b>.</p>" +
      '<form data-form="move">' +
      '<div class="seg">' +
      '<label class="s-mv"><input type="radio" name="modo" value="tr" checked><span>💸 Transferir</span></label>' +
      '<label class="s-rd"><input type="radio" name="modo" value="rd"><span>📈 Rendimento</span></label>' +
      "</div>" +
      '<div id="blocoTr">' +
      '<div class="row2">' +
      '<div class="field"><label>Sai de</label><select name="from">' + opt(accs[0].id) + "</select></div>" +
      '<div class="field"><label>Entra em</label><select name="to">' +
      opt(accs.length > 1 ? accs[1].id : accs[0].id) + "</select></div>" +
      "</div>" +
      "</div>" +
      '<div id="blocoRd" hidden>' +
      '<div class="field"><label>Entrou em</label><select name="acc">' + opt(banco) + "</select></div>" +
      '<div class="field"><label>Descrição</label><input name="note" value="Rendimento"></div>' +
      "</div>" +
      '<div class="row2">' +
      '<div class="field"><label>Valor</label><div class="amount-wrap"><span class="cur">R$</span>' +
      '<input name="amount" inputmode="decimal" placeholder="0,00" required></div></div>' +
      '<div class="field"><label>Data</label><input name="date" type="date" value="' + today() + '"></div>' +
      "</div>" +
      '<div class="form-actions">' +
      '<button class="btn ghost" type="button" data-act="close-modal">Cancelar</button>' +
      '<button class="btn" type="submit">Salvar</button></div></form>'
    );
  }

  /* mostra o bloco certo (transferir x rendimento) */
  function syncMove(form) {
    if (!form || form.dataset.form !== "move") return;
    const modo = form.querySelector("[name=modo]:checked");
    const m = modo ? modo.value : "tr";
    const tr = form.querySelector("#blocoTr");
    const rd = form.querySelector("#blocoRd");
    if (tr) tr.hidden = m !== "tr";
    if (rd) rd.hidden = m !== "rd";
  }

  function pinSheet(trocando) {
    openSheet(
      (trocando ? "<h2>Trocar PIN</h2>" : "<h2>🔒 Ativar bloqueio</h2>") +
      '<p class="sheet-intro">Escolha um PIN de 4 a 6 números. É ele que será pedido toda vez que alguém abrir o app.</p>' +
      '<form data-form="pin">' +
      '<div class="row2">' +
      '<div class="field"><label>Novo PIN</label>' +
      '<input name="pin" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="••••" autocomplete="new-password" required></div>' +
      '<div class="field"><label>Repita o PIN</label>' +
      '<input name="pin2" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="••••" autocomplete="new-password" required></div>' +
      "</div>" +
      '<div class="form-actions">' +
      '<button class="btn ghost" type="button" data-act="close-modal">Cancelar</button>' +
      '<button class="btn" type="submit">' + (trocando ? "Salvar PIN" : "Ativar bloqueio") + "</button>" +
      "</div></form>"
    );
  }

  /* mostra o código de recuperação logo após ativar o bloqueio */
  function codigoSheet() {
    const cod = Store.settings().recCode || "";
    openSheet(
      "<h2>📌 Anote seu código de recuperação</h2>" +
      '<p class="sheet-intro">Se você esquecer o PIN, é com este código que entra. ' +
      "Guarde em um lugar seguro — anote no papel ou mande para você mesmo (WhatsApp/Drive).</p>" +
      '<div class="rec-code">' + esc(cod) + "</div>" +
      '<div class="form-actions"><button class="btn" data-act="close-modal">Já anotei</button></div>'
    );
  }

  /* seção do bloqueio dentro dos Ajustes */
  function lockSection() {
    const s = Store.settings();
    const ativo = Store.pinAtivo();
    const temCred = !!s.cred;
    const bioOk = state.bioDisp === true && "credentials" in navigator;

    if (!ativo) {
      return (
        '<div class="sec-title">🔒 Bloqueio do app</div>' +
        '<div class="card">' +
        '<p style="margin:0 0 12px;font-size:14px;color:var(--ink-2);line-height:1.5">' +
        "Peça o PIN toda vez que abrir o app: ninguém que pegue seu celular vê seus lançamentos.</p>" +
        '<button class="btn ghost" data-act="pin-on">Ativar bloqueio com PIN</button>' +
        "</div>"
      );
    }

    return (
      '<div class="sec-title">🔒 Bloqueio do app</div>' +
      '<div class="card">' +
      '<div class="bk-resumo">🔒 Ativo · ' + (s.pinLen || 4) + " dígito" +
      ((s.pinLen || 4) > 1 ? "s" : "") + (temCred ? " · digital/rosto" : "") + "</div>" +
      '<div class="bk-btns">' +
      '<button class="btn ghost" data-act="pin-change">Trocar PIN</button>' +
      '<button class="btn danger" data-act="pin-off">Desativar</button>' +
      "</div>" +
      (bioOk
        ? '<div class="bk-btns"><button class="btn ghost" data-act="' +
          (temCred ? "bio-off" : "bio-on") + '">' +
          (temCred ? "Remover digital/rosto" : "🔓 Abrir com digital/rosto") + "</button></div>"
        : '<div class="bk-dica">Este navegador não oferece digital/rosto — o PIN é o caminho.</div>') +
      '<div class="bk-btns"><button class="btn ghost" data-act="lock-now">Bloquear agora</button></div>' +
      '<div class="bk-dica">📌 Código de recuperação: <b>' + esc(s.recCode || "—") +
      "</b> — guarde em local seguro; é por ele que você volta a entrar se esquecer o PIN.</div>" +
      "</div>"
    );
  }

  /* se o aparelho tem digital/rosto de verdade (só a API não basta) */
  function checarBio() {
    if (!window.PublicKeyCredential || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable)
      return;
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      .then((ok) => {
        state.bioDisp = ok;
        const h2 = document.querySelector("#modal-root h2");
        if (h2 && h2.textContent.trim() === "Ajustes") settingsSheet();
      })
      .catch(() => {});
  }

  /* conta conectada + sincronização (seção dos Ajustes) */
  function contaSection() {
    const st = Store.auth.status();
    return (
      '<div class="sec-title">👤 Conta na nuvem</div>' +
      '<div class="card" style="margin:0">' +
      '<div class="conta-email">' + esc(st.email) + "</div>" +
      '<div class="conta-sync" id="syncTxt">' + esc(st.label) + "</div>" +
      '<p style="margin:8px 0 12px;font-size:13px;color:var(--ink-2);line-height:1.5">' +
      "Seus dados ficam salvos na nuvem e aparecem em qualquer aparelho onde você entrar com esta conta. " +
      "Sem internet, o app continua funcionando e sincroniza sozinho depois.</p>" +
      '<div class="conta-acoes">' +
      '<button class="btn ghost" data-act="sync-now">🔄 Sincronizar</button>' +
      '<button class="btn ghost" data-act="logout">Sair da conta</button>' +
      "</div></div>"
    );
  }

  function settingsSheet() {
    const cats = Store.categories();
    const accs = Store.accounts();
    const somaIni = Store.openingTotal();
    const linhasAcc = accs
      .map((a) => {
        const v = a.opening || 0;
        const usada = Store.accUsed(a.id);
        return (
          '<div class="field orc-linha acc-linha">' +
          '<span class="ai">' + (a.icon || "🏦") + "</span>" +
          '<input class="acc-name" name="n_' + a.id + '" value="' + esc(a.name) + '" aria-label="Nome da conta">' +
          '<div class="amount-wrap"><span class="cur">R$</span>' +
          '<input name="o_' + a.id + '" inputmode="decimal" placeholder="0,00" value="' +
          (v ? (v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "") +
          '"></div>' +
          (usada
            ? ""
            : '<button type="button" class="rec-del" data-act="del-acc" data-id="' + a.id + '" title="Remover conta">×</button>') +
          "</div>"
        );
      })
      .join("");
    openSheet(
      "<h2>Ajustes</h2>" +
      '<div class="settings-list">' +
      '<button data-act="install">📲 Instalar no celular<span class="arrow">›</span></button>' +
      '<button data-act="check-update">🔄 Verificar atualização<span class="arrow">›</span></button>' +
      "</div>" +
      backupCard() +
      lockSection() +
      '<div class="sec-title">💰 Contas (dinheiro separado)</div>' +
      '<form data-form="openings">' +
      linhasAcc +
      '<div class="form-actions">' +
      '<button class="btn" type="submit">Salvar contas</button></div>' +
      "</form>" +
      '<div class="hint">Saldo inicial = o que você <b>já tem</b> em cada conta antes do primeiro lançamento. ' +
      "A soma das contas é o <b>Caixa</b> do Painel (agora " + fmt(somaIni) + ").</div>" +
      '<div class="field" style="margin-top:14px"><label>Nova conta</label>' +
      '<form data-form="acc" style="display:flex;gap:8px">' +
      '<input name="icon" value="🏦" maxlength="4" style="width:56px;text-align:center" aria-label="Ícone da conta">' +
      '<input name="name" placeholder="Ex.: Cofrinho" required style="flex:1;min-width:0">' +
      '<button class="btn small" type="submit" style="align-self:center">＋</button>' +
      "</form>" +
      '<div class="hint">Ex.: 🐷 Cofrinho, 🏦 Conta, 💵 Dinheiro, 📈 Poupança.</div></div>' +
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
      contaSection() +
      '<div class="settings-list danger">' +
      '<button data-act="reset">🗑️ Apagar todos os dados deste aparelho<span class="arrow">›</span></button>' +
      "</div>" +
      '<div class="app-version">Finanças · versão ' + APP_VERSION + " · publicado em " +
      BUILD_DATE + "</div>" +
      '<input type="file" id="importFile" accept="application/json,.json" hidden>'
    );
  }

  /* =====================================================================
     TELA: LOGIN (obrigatório — cada pessoa vê só os próprios dados)
     ===================================================================== */
  function loginHTML() {
    return (
      '<div class="login-box">' +
      '<img class="login-logo" src="icon.svg" alt="">' +
      "<h1>Minha Vida Financeira</h1>" +
      '<p class="login-sub">Entre para guardar seus dados na nuvem e usar o app em qualquer aparelho.</p>' +
      '<button type="button" class="btn btn-google" data-act="login-google">' +
      '<span class="g-ico">G</span> Entrar com Google</button>' +
      '<div class="login-div"><span>ou com e-mail</span></div>' +
      '<form data-form="login">' +
      '<input type="email" name="email" placeholder="Seu e-mail" autocomplete="email" inputmode="email" required>' +
      '<input type="password" name="pass" placeholder="Senha (mín. 6 caracteres)" autocomplete="current-password" minlength="6" required>' +
      '<div class="login-err" id="loginErr" role="alert"></div>' +
      '<div class="login-btns">' +
      '<button class="btn" type="submit" name="op" value="in">Entrar</button>' +
      '<button class="btn ghost" type="submit" name="op" value="up">Criar conta</button>' +
      "</div></form>" +
      '<a class="login-link" href="privacidade.html" target="_blank" rel="noopener">Política de privacidade</a>' +
      "</div>"
    );
  }

  function mostrarLogin(msg) {
    const root = document.getElementById("login-root");
    if (!root) return;
    root.innerHTML = loginHTML();
    document.body.classList.add("nao-logado");
    const err = document.getElementById("loginErr");
    if (msg && err) err.textContent = msg;
  }

  /* traduz os erros do serviço em português */
  function erroLogin(e) {
    const m = String((e && e.message) || e || "");
    if (/Failed to fetch|NetworkError|Network request failed/i.test(m))
      return "Sem conexão — verifique a internet";
    if (/Invalid login credentials/i.test(m))
      return "E-mail ou senha incorretos";
    if (/already registered|already been registered/i.test(m))
      return "Este e-mail já tem conta — toque em Entrar";
    if (/password/i.test(m) && /characters/i.test(m))
      return "A senha precisa de pelo menos 6 caracteres";
    if (/Email not confirmed/i.test(m))
      return "Confirme o link enviado ao seu e-mail";
    if (e && e.status === 429)
      return "Muitas tentativas — aguarde alguns minutos";
    if (e && e.status >= 500) return "Serviço fora do ar — tente em instantes";
    return m || "Não foi possível entrar";
  }

  function entrarComForm(form, fd, ev) {
    const email = String(fd.get("email") || "").trim();
    const pass = String(fd.get("pass") || "");
    const criar = ev && ev.submitter && ev.submitter.value === "up";
    const err = document.getElementById("loginErr");
    if (err) err.textContent = "";
    const btn = (ev && ev.submitter) || form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    const fn = criar ? Store.auth.signUp : Store.auth.signIn;
    fn(email, pass)
      .then(() => location.reload())
      .catch((e) => {
        if (btn) btn.disabled = false;
        const el = document.getElementById("loginErr");
        if (el) el.textContent = erroLogin(e);
      });
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
    if (!Store.auth || !Store.auth.session()) return; /* sem login não há app */
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
    /* ---------------- conta / nuvem ---------------- */
    "login-google"() {
      const el = document.getElementById("loginErr");
      if (el) el.textContent = "Abrindo o Google…";
      Store.auth.signInGoogle().catch((e) => {
        if (el) el.textContent = erroLogin(e);
      });
    },
    "sync-now"() {
      const el = document.getElementById("syncTxt");
      if (el) el.textContent = "Sincronizando…";
      Store.auth.syncNow()
        .then(() => {
          if (el) el.textContent = Store.auth.status().label;
          toast("Sincronizado ✓");
        })
        .catch((e) => {
          if (el) el.textContent = Store.auth.status().label;
          toast(erroLogin(e));
        });
    },
    logout() {
      askConfirm(
        "Sair da conta?",
        "Seus dados continuam guardados na nuvem. Para usar de novo, é só entrar.",
        () => {
          Store.auth.signOut().then(() => location.reload());
        },
        "Sair"
      );
    },

    goto(el) { go(el.dataset.route); },
    month(el) { state.month = addMonths(state.month, Number(el.dataset.d)); render(); },
    filter(el) {
      if (el.dataset.kind === "tx") state.txFilter = el.dataset.f;
      else state.thirdFilter = el.dataset.f;
      render();
    },
    "close-modal"() { closeSheet(); },
    budgets() { budgetsSheet(); },
    move() { moveSheet(); },
    "del-acc"(el) {
      const id = el.dataset.id;
      const a = Store.account(id);
      if (!a) return;
      if (Store.accUsed(id))
        return toast("A conta " + a.name + " tem movimentação — não dá para remover");
      askConfirm(
        "Remover conta " + a.name + "?",
        "A conta está sem movimentação, então nada muda nos seus saldos.",
        () => {
          Store.removeAccount(id);
          settingsSheet();
          render();
          toast("Conta removida");
        },
        "Remover"
      );
    },
    "new-rec"() { recSheet(); },
    "del-rec"(el) {
      const r = Store.rec(el.dataset.id);
      if (!r) return;
      askConfirm(
        "Remover conta fixa?",
        (r.note || catName(r.catId)) + " · " + fmt(r.amount) + " todo dia " + r.day +
          ". Os lançamentos já criados continuam na sua lista.",
        () => {
          Store.removeRec(r.id);
          closeSheet();
          render();
          toast("Conta fixa removida");
        },
        "Remover"
      );
    },

    /* ---------------- bloqueio ---------------- */
    "pin-on"() { pinSheet(false); },
    "pin-change"() { pinSheet(true); },
    "pin-key"(el) { pinDigite(el.dataset.k); },
    "pin-back"() { pinApaga(); },
    "lock-bio"() { if (Store.settings().cred) desbloquearBio(); },
    "lock-rec-show"() {
      const r = document.getElementById("lockRec");
      if (r) {
        r.hidden = false;
        const i = r.querySelector("input");
        if (i) i.focus();
      }
    },
    "lock-now"() { mostrarLock(); },
    "pin-off"() {
      askConfirm(
        "Desativar bloqueio?",
        "O app volta a abrir sem pedir PIN. Seus dados continuam salvos neste aparelho.",
        () => {
          Store.clearPin();
          settingsSheet();
          toast("Bloqueio desativado");
        },
        "Desativar"
      );
    },
    async "bio-on"() {
      try {
        if (!navigator.credentials || !window.PublicKeyCredential)
          return toast("Este navegador não suporta digital/rosto");
        const disp = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (!disp)
          return toast("Nenhuma digital/rosto cadastrada neste aparelho");
        const cred = await navigator.credentials.create({
          publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            rp: { name: "Minha Vida Financeira" },
            user: {
              id: crypto.getRandomValues(new Uint8Array(16)),
              name: "usuario",
              displayName: "Você"
            },
            pubKeyCredParams: [
              { type: "public-key", alg: -7 },
              { type: "public-key", alg: -257 }
            ],
            authenticatorSelection: {
              authenticatorAttachment: "platform",
              userVerification: "required",
              residentKey: "preferred"
            },
            attestation: "none",
            timeout: 30000
          }
        });
        if (!cred) return;
        Store.setSetting("cred", bufToB64(cred.rawId));
        settingsSheet();
        toast("Digital/rosto ativado ✓");
      } catch (e) {
        toast("Não foi possível ativar (talvez cancelado)");
      }
    },
    "bio-off"() {
      Store.setSetting("cred", null);
      settingsSheet();
      toast("Digital/rosto removido");
    },
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
      pendingCancel = null; /* confirmou: o "cancelar" não vale mais */
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

    settings() {
      settingsSheet();
      checarBio();
    },
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
    if (e.target.name === "installments" || e.target.name === "type") syncDest();
    if (e.target.name === "vmode")
      syncParcelas(e.target.closest("form"));
    if (e.target.name === "modo") syncMove(e.target.closest("form"));
  });

  /* a prévia do parcelamento acompanha o valor enquanto digita */
  document.addEventListener("input", (e) => {
    if (e.target.name === "amount") syncParcelas(e.target.closest("form"));
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

    if (kind === "login") return entrarComForm(form, fd, e);
    if (kind === "tx") return saveTx(form, fd);
    if (kind === "card") return saveCard(form, fd);
    if (kind === "third") return saveThird(form, fd);
    if (kind === "openings") {
      Store.accounts().forEach((a) => {
        const nome = String(fd.get("n_" + a.id) || "").trim();
        Store.updateAccount(a.id, {
          name: nome || a.name,
          opening: parseMoney(fd.get("o_" + a.id))
        });
      });
      settingsSheet();
      render();
      toast("Contas atualizadas ✓");
      return;
    }
    if (kind === "acc") {
      const nome = String(fd.get("name") || "").trim();
      if (!nome) return toast("Informe o nome da conta");
      Store.addAccount({
        name: nome,
        icon: String(fd.get("icon") || "").trim() || "🏦",
        type: "bank",
        opening: 0
      });
      settingsSheet();
      render();
      toast("Conta criada — informe o saldo inicial dela ✓");
      return;
    }
    if (kind === "move") {
      const amount = parseMoney(fd.get("amount"));
      if (amount <= 0) return toast("Informe o valor");
      const date = String(fd.get("date") || today());
      if (fd.get("modo") === "rd") {
        const accId = String(fd.get("acc") || "") || Store.defaultAccId();
        Store.addTx({
          type: "in",
          amount,
          date,
          catId: "in_invest",
          accId,
          cardId: null,
          note: String(fd.get("note") || "").trim() || "Rendimento"
        });
        closeSheet();
        render();
        toast("📈 Rendimento de " + fmt(amount) + " registrado ✓");
        return;
      }
      const from = String(fd.get("from") || "");
      const to = String(fd.get("to") || "");
      if (!from || !to) return toast("Escolha as contas");
      if (from === to) return toast("Escolha duas contas diferentes");
      Store.addTransfer({ from, to, amount, date, note: "" });
      closeSheet();
      render();
      toast("💸 " + fmt(amount) + " movido entre contas ✓ (não é gasto)");
      return;
    }
    if (kind === "rec") {
      const amount = parseMoney(fd.get("amount"));
      if (amount <= 0) return toast("Informe o valor");
      const dest = String(fd.get("dest") || "");
      const isCard = dest.indexOf("card:") === 0;
      const tipo = fd.get("type") === "in" ? "in" : "out";
      Store.addRec({
        type: tipo,
        amount,
        day: Math.min(31, Math.max(1, Number(fd.get("day")) || 1)),
        catId: fd.get("catId") || (tipo === "in" ? "in_salario" : "out_outros"),
        note: String(fd.get("note") || "").trim(),
        cardId: isCard ? dest.slice(5) : null,
        accId: isCard ? null : dest.slice(4) || null,
        start: today().slice(0, 7)
      });
      const gerados = Store.syncRecs(today());
      closeSheet();
      go("tx");
      toast(
        gerados.length
          ? "Conta fixa criada — já lançei a de " + monthLabel(today().slice(0, 7)) + " ✓"
          : "Conta fixa criada ✓"
      );
      return;
    }
    if (kind === "pin") {
      const p1 = String(fd.get("pin") || "").trim();
      const p2 = String(fd.get("pin2") || "").trim();
      if (!/^\d{4,6}$/.test(p1)) return toast("O PIN precisa de 4 a 6 números");
      if (p1 !== p2) return toast("Os PINs não são iguais");
      Store.setPin(p1).then(() => {
        if (!Store.settings().recCode) Store.setSetting("recCode", gerarCodigo());
        render();
        codigoSheet();
        toast("🔒 Bloqueio ativado");
      });
      return;
    }
    if (kind === "rec-code") {
      const cod = String(fd.get("code") || "").trim().toUpperCase();
      if (cod && cod === Store.settings().recCode) {
        Store.clearPin();
        destravar();
        render();
        toast("PIN removido — ative um novo nos Ajustes");
      } else {
        toast("Código incorreto");
      }
      return;
    }
    if (kind === "budgets") {
      const mapa = {};
      Store.categories().forEach((c) => {
        const v = parseMoney(fd.get("b_" + c.id));
        if (v > 0) mapa[c.id] = v;
      });
      Store.setBudgets(mapa);
      budgetsSheet();
      render();
      toast(Object.keys(mapa).length ? "Limites salvos" : "Orçamentos removidos");
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
      const total =
        isCard && base.type === "out" ? Math.max(1, Number(fd.get("installments")) || 1) : 1;
      const pagas = Math.max(0, Math.floor(Number(fd.get("paid")) || 0));
      const restam = total - pagas;
      if (total > 1) {
        if (restam <= 0)
          return toast("Todas as " + total + " parcelas já foram pagas — nada a lançar");
        /* modo "Valor total": o que foi digitado é o preço da compra inteira;
           cada parcela recebe total ÷ n (com o ajuste de centavos nas primeiras) */
        let valores = null;
        if (fd.get("vmode") !== "parc") {
          const unit = Math.floor(base.amount / total);
          if (unit <= 0)
            return toast(
              "Valor total baixo demais para " + total + " parcelas"
            );
          const resto = base.amount - unit * total;
          valores = [];
          for (let i = 0; i < total; i++)
            valores.push(unit + (i < resto ? 1 : 0));
        }
        Store.addInstallments(base, restam, pagas + 1, total, valores);
        toast(
          restam + "x parcela criada" +
            (valores ? " de " + fmt(valores[pagas]) : "") +
            (pagas ? " · da " + (pagas + 1) + "/" + total : "")
        );
      } else {
        Store.addTx(base);
        toast("Lançamento adicionado");
      }
    }
    closeSheet();
    render();
    const aviso = avisoOrcamento(base);
    if (aviso) setTimeout(() => toast(aviso), 1500);
  }

  /* avisa quando um lançamento encosta/estoura o limite da categoria */
  function avisoOrcamento(t) {
    if (!t || t.type !== "out") return null;
    const limite = Store.budgets()[t.catId] || 0;
    if (!limite) return null;
    const gasto = Store.spentInMonth(monthKey(t.date), t.catId);
    if (gasto > limite)
      return "⚠️ Estourou " + catName(t.catId) + ": " + fmt(gasto) + " de " + fmt(limite);
    if (gasto >= limite * 0.8)
      return "🟡 " + catName(t.catId) + " já usou " +
        Math.round((gasto / limite) * 100) + "% do limite (" + fmt(limite) + ")";
    return null;
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
    if (form.querySelector('[name="accId"]')) patch.accId = fd.get("accId") || null;
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

  /* =====================================================================
     BLOQUEIO DO APP (PIN + digital/rosto)
     ===================================================================== */
  let pinBuf = "";
  let ultimaSaida = 0;

  function bufToB64(buf) {
    let s = "";
    new Uint8Array(buf).forEach((b) => (s += String.fromCharCode(b)));
    return btoa(s);
  }
  function b64ToBuf(b64) {
    const s = atob(b64);
    const u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u.buffer;
  }
  function gerarCodigo() {
    const alf = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let c = "";
    for (let i = 0; i < 6; i++) c += alf[Math.floor(Math.random() * alf.length)];
    return c;
  }

  function lockHTML() {
    const s = Store.settings();
    const len = s.pinLen || 4;
    const temBio = !!s.cred && "credentials" in navigator;
    return (
      '<div class="lock" id="lock">' +
      '<div class="lock-box">' +
      '<div class="lock-ico">🔐</div>' +
      "<h2>Minha Vida Financeira</h2>" +
      '<div class="lock-msg">Digite seu PIN de ' + len + " dígito" + (len > 1 ? "s" : "") + "</div>" +
      '<div class="pin-dots" id="pinDots"></div>' +
      '<div class="lock-err" id="lockErr"></div>' +
      '<div class="keypad">' +
      [1, 2, 3, 4, 5, 6, 7, 8, 9]
        .map((n) => '<button type="button" data-act="pin-key" data-k="' + n + '">' + n + "</button>")
        .join("") +
      '<button type="button" data-act="lock-bio" class="kp-bio' + (temBio ? "" : " hide") + '" aria-label="Usar digital">🔓</button>' +
      '<button type="button" data-act="pin-key" data-k="0">0</button>' +
      '<button type="button" data-act="pin-back" aria-label="Apagar">⌫</button>' +
      "</div>" +
      '<button type="button" class="lock-rec-link" data-act="lock-rec-show">Esqueci meu PIN</button>' +
      '<div class="lock-rec" id="lockRec" hidden>' +
      '<div class="lock-msg">Digite o código de recuperação que você guardou ao ativar o bloqueio:</div>' +
      '<form data-form="rec-code" class="lock-rec-form">' +
      '<input name="code" placeholder="Ex.: K7M2Q9" autocapitalize="characters" maxlength="8" required>' +
      '<button class="btn small" type="submit">Desbloquear</button>' +
      "</form></div>" +
      "</div></div>"
    );
  }

  function mostrarLock() {
    if (!Store.auth.session()) return; /* sem login não mostra o PIN */
    if (!Store.pinAtivo()) return;
    if (document.getElementById("lock")) return;
    pinBuf = "";
    $("#lock-root").innerHTML = lockHTML();
    pinAtualizar();
  }
  function destravar() {
    pinBuf = "";
    $("#lock-root").innerHTML = "";
  }
  function pinAtualizar() {
    const len = Store.settings().pinLen || 4;
    const dots = document.getElementById("pinDots");
    if (!dots) return;
    let h = "";
    for (let i = 0; i < len; i++) h += '<i class="' + (i < pinBuf.length ? "on" : "") + '"></i>';
    dots.innerHTML = h;
    if (pinBuf.length >= len) {
      Store.checkPin(pinBuf).then((ok) => {
        const err = document.getElementById("lockErr");
        if (ok) return destravar();
        pinBuf = "";
        pinAtualizar();
        const box = document.querySelector(".lock-box");
        if (box) {
          box.classList.remove("shake");
          void box.offsetWidth; /* reinicia a animação */
          box.classList.add("shake");
        }
        if (err) { const e2 = document.getElementById("lockErr"); if (e2) e2.textContent = "PIN incorreto"; }
      });
    }
  }
  function pinDigite(k) {
    const len = Store.settings().pinLen || 4;
    if (pinBuf.length >= len) pinBuf = "";
    pinBuf += k;
    pinAtualizar();
  }
  function pinApaga() {
    pinBuf = pinBuf.slice(0, -1);
    pinAtualizar();
  }
  async function desbloquearBio() {
    try {
      const cred = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [
            { type: "public-key", id: b64ToBuf(Store.settings().cred) }
          ],
          userVerification: "required",
          timeout: 30000
        }
      });
      if (cred) destravar();
    } catch (e) {
      toast("Biometria não concluída — use o PIN");
    }
  }

  /* ---------------- boot ---------------- */
  let deferredInstall = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstall = e;
  });

  window.addEventListener("hashchange", () => go(location.hash.slice(1)));

  /* primeira sincronização ao abrir: puxa o que está na nuvem e, no
     primeiro acesso desta conta neste aparelho, pergunta se quer começar
     com os dados que já estavam guardados aqui (versão antiga/local). */
  async function primeiraVez() {
    const sessao = Store.auth.session();
    if (!sessao) return;
    const marca = "fin_login_v1_" + sessao.user_id;
    let primeira = false;
    try {
      primeira = !localStorage.getItem(marca);
    } catch (e) {}
    try {
      const r = await Store.auth.pull();
      if (primeira) {
        try {
          localStorage.setItem(marca, "1");
        } catch (e) {}
        const st = Store.stats();
        const semDadosAqui =
          !st.tx && !st.cards && !st.third && !st.recs && !st.trf;
        if (semDadosAqui) {
          const legado = Store.auth.legacyInfo();
          if (legado && (legado.tx || legado.cards || legado.third)) {
            /* nem a nuvem nem esta conta têm nada aqui: oferece os dados
               que já estavam guardados neste aparelho (versão anterior) */
            askConfirm(
              "Importar o que já estava aqui?",
              "Encontramos neste aparelho " +
                legado.tx +
                " lançamento(s), " +
                legado.cards +
                " cartão(ões) e " +
                legado.third +
                " registro(s) de terceiros. Quer começar a usar com eles?",
              () => {
                if (Store.auth.useLegacy()) {
                  render();
                  toast("Dados importados ✓ Sincronizando…");
                }
              },
              "Importar",
              () => Store.auth.startFresh() /* recusou: começa do zero */
            );
          } else {
            Store.auth.startFresh();
          }
        } else if (r === "empty") {
          /* dados só neste aparelho: sobe sem perguntar */
          Store.auth.push().catch(() => {});
        } else if (r === "applied") {
          render();
          toast("Dados sincronizados da nuvem ✓");
        } else {
          /* nuvem mais antiga: o que está aqui manda */
          Store.auth.push().catch(() => {});
        }
      } else if (r === "applied") {
        render();
      }
    } catch (e) {
      /* sem internet: segue com o que está no aparelho; tenta de novo na próxima */
      syncFallback();
    }
  }

  function syncFallback() {
    const el = document.getElementById("syncTxt");
    if (el) el.textContent = Store.auth.status().label;
  }

  function iniciarApp() {
    go(location.hash.slice(1) || "home");

    /* contas fixas: cria sozinho o que já venceu neste mês */
    try {
    const gerados = Store.syncRecs(today());
    if (gerados.length)
      setTimeout(
        () => toast("🔁 " + gerados.length + " conta(s) fixa(s) lançada(s) por você"),
        1400
      );
  } catch (e) {}

  /* lembrete de vencimento de fatura (3 dias) — 1 aviso por mês */
  try {
    const dHoje = new Date().getDate();
    const mk = today().slice(0, 7);
    const perto = Store.cards().filter((c) => {
      const dias = (Number(c.due) || 10) - dHoje;
      return dias >= 0 && dias <= 3;
    });
    if (perto.length) {
      const flag = "fin_aviso_fatura_" + mk;
      if (localStorage.getItem(flag) !== today()) {
        localStorage.setItem(flag, today());
        const c = perto[0];
        const dias = (Number(c.due) || 10) - dHoje;
        setTimeout(() => {
          const inv = Store.cardInvoice(c.id, mk);
          toast(
            "💳 Fatura " + c.name +
              (dias === 0 ? " vence HOJE" : " vence em " + dias + " dia(s)") +
              (inv.total ? " · " + fmt(inv.total) : "")
          );
        }, 5600);
      }
    }
  } catch (e) {}

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
        4200
      );
    } catch (e) {}
  })();

    /* ---------------- bloqueio: inicia travado + trava ao voltar pro app ---------------- */
    if (Store.pinAtivo()) mostrarLock();

    /* nuvem: puxa o que está salvo na conta (e oferece o import no 1º acesso) */
    primeiraVez();
  } /* fim iniciarApp() */

  /* sessão caiu no meio do uso → volta para a tela de login */
  Store.auth.onExpired(() => {
    try {
      closeSheet();
    } catch (e) {}
    mostrarLogin("Sua sessão expirou — entre de novo");
  });

  /* veio do Google com os tokens? limpa a URL. Sem conta: tela de login. */
  Store.auth.consumeRedirect()
    .then(() => {
      if (Store.auth.session()) iniciarApp();
      else mostrarLogin();
    })
    .catch((e) => {
      console.error("Login Google:", e);
      if (Store.auth.session()) iniciarApp();
      else
        mostrarLogin(
          "Não foi possível entrar com o Google — tente de novo"
        );
    });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      ultimaSaida = Date.now();
    } else if (ultimaSaida && Date.now() - ultimaSaida > 60000) {
      mostrarLock();
      ultimaSaida = 0;
    }
  });

  /* teclado físico no PIN (quando o bloqueio está aberto) */
  document.addEventListener("keydown", (e) => {
    if (!document.getElementById("lock")) return;
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      pinDigite(e.key);
    } else if (e.key === "Backspace") {
      e.preventDefault();
      pinApaga();
    }
  });

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
