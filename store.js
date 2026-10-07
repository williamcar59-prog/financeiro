/* =====================================================================
   store.js — camada de dados (local-first + nuvem)
   - No aparelho: localStorage, uma CHAVE por usuário (KEY + "::" + uid);
   - Na nuvem: Supabase, UM registro JSON por usuário (tabela user_data)
     com RLS — cada conta lê e grava apenas os próprios dados.
   Nada mais no app acessa o localStorage diretamente.
   Valores monetários são SEMPRE inteiros em centavos.
   ===================================================================== */
(function () {
  "use strict";

  const KEY = "planilha_gastos_v1";

  /* =====================================================================
     NUVEM (Supabase) — login por usuário + sincronização
     ===================================================================== */
  const SESSION_KEY = "fin_session_v1";
  const CLOUD_URL = "https://cfftreeptmhenbfylafo.supabase.co";
  const CLOUD_KEY = "sb_publishable_8VkpuzRmYk4Z2ifHJN1vvA_xv8VHk3-";
  const PKCE_KEY = "fin_pkce_v1";

  let dataKey = KEY;          /* chave do aparelho de quem está usando */
  let pushTimer = null;
  let syncState = "idle";     /* idle | saving | ok | offline | error */
  let syncAt = null;
  let expiredHook = null;

  function readSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch (e) {
      return null;
    }
  }
  function saveSession(s) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch (e) {}
    dataKey = s && s.user_id ? KEY + "::" + s.user_id : KEY;
  }
  function dropSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
    dataKey = KEY;
  }
  function b64u(str) {
    return str.replace(/-/g, "+").replace(/_/g, "/");
  }
  function decodeJwt(tok) {
    try {
      const p = tok.split(".")[1];
      const bin = atob(b64u(p));
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) {
      return {};
    }
  }
  function normSession(novo, antigo) {
    const s = Object.assign({}, antigo || {}, novo || {});
    if (novo && novo.user) {
      s.user_id = novo.user.id || s.user_id;
      s.email = novo.user.email || s.email;
    }
    if (!s.expires_at && s.expires_in)
      s.expires_at = Math.floor(Date.now() / 1000) + Number(s.expires_in);
    if (!s.user_id && s.access_token) {
      const j = decodeJwt(s.access_token);
      s.user_id = j.sub || s.user_id;
      s.email = j.email || s.email;
    }
    return s;
  }
  /* sessão inválida (refresh recusado): derruba o login e avisa o app */
  function sessaoInvalida() {
    dropSession();
    if (expiredHook) {
      try {
        expiredHook();
      } catch (e) {}
    }
  }
  async function supa(path, opts) {
    opts = opts || {};
    const headers = Object.assign(
      { apikey: CLOUD_KEY, "Content-Type": "application/json" },
      opts.headers || {}
    );
    const s = readSession();
    if (s && s.access_token && opts.auth !== false)
      headers.Authorization = "Bearer " + s.access_token;
    const res = await fetch(CLOUD_URL + path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body
    });
    const txt = await res.text();
    let json = null;
    try {
      json = txt ? JSON.parse(txt) : null;
    } catch (e) {}
    if (!res.ok) {
      const erro = new Error(
        (json &&
          (json.msg || json.message || json.error_description || json.error)) ||
          "Erro " + res.status
      );
      erro.status = res.status;
      throw erro;
    }
    return json;
  }
  /* renova o access_token quando está perto de expirar */
  async function sessaoViva() {
    const s = readSession();
    if (!s) throw new Error("Não conectado");
    if (s.expires_at && Date.now() / 1000 > s.expires_at - 60) {
      if (!s.refresh_token) {
        sessaoInvalida();
        throw new Error("Sessão expirada");
      }
      try {
        const novo = await supa("/auth/v1/token?grant_type=refresh_token", {
          method: "POST",
          auth: false,
          body: JSON.stringify({ refresh_token: s.refresh_token })
        });
        const n = normSession(novo, s);
        saveSession(n);
        return n;
      } catch (e) {
        if (e.status === 400 || e.status === 401) sessaoInvalida();
        throw e;
      }
    }
    return s;
  }
  function rotuloSync() {
    if (syncState === "saving") return "Sincronizando…";
    if (syncState === "offline") return "Sem internet — salvo neste aparelho";
    if (syncState === "error") return "Falha ao sincronizar — tente de novo";
    if (syncState === "ok" && syncAt)
      return (
        "Sincronizado ✓ " +
        new Date(syncAt).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit"
        })
      );
    return "Pronto para sincronizar";
  }
  function avisarSync() {
    try {
      const el = document.getElementById("syncTxt");
      if (el) el.textContent = rotuloSync();
    } catch (e) {}
  }
  function guardarLocal() {
    try {
      localStorage.setItem(dataKey, JSON.stringify(db));
    } catch (e) {
      console.error("Falha ao salvar dados", e);
    }
  }
  function agendarPush() {
    if (!readSession()) return;
    syncState = "saving";
    avisarSync();
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = null;
      Store.auth.push().catch(() => {});
    }, 1200);
  }
  async function puxar() {
    const s = readSession();
    if (!s) return "no-session";
    const vivo = await sessaoViva();
    const linhas = await supa(
      "/rest/v1/user_data?user_id=eq." +
        encodeURIComponent(vivo.user_id) +
        "&select=data,updated_at"
    );
    if (!linhas || !linhas.length) return "empty";
    const remoto = linhas[0];
    Store.init();
    const localAt = db && db.updatedAt ? String(db.updatedAt) : "";
    /* guarda o que é mais novo: quem salvou por último vence */
    if (
      remoto.updated_at &&
      localAt &&
      String(remoto.updated_at) <= localAt
    ) {
      syncState = "ok";
      syncAt = Date.now();
      avisarSync();
      return "local-newer";
    }
    if (!remoto.data || !Array.isArray(remoto.data.transactions))
      return "empty";
    db = remoto.data;
    if (!db.categories) db.categories = DEFAULT_CATS.slice();
    migrate();
    db.updatedAt = remoto.updated_at;
    guardarLocal();
    syncState = "ok";
    syncAt = Date.now();
    avisarSync();
    return "applied";
  }

  const DEFAULT_CATS = [
    { id: "out_moradia", kind: "out", name: "Moradia", icon: "🏠" },
    { id: "out_alimentacao", kind: "out", name: "Alimentação", icon: "🍽️" },
    { id: "out_transporte", kind: "out", name: "Transporte", icon: "🚗" },
    { id: "out_saude", kind: "out", name: "Saúde", icon: "💊" },
    { id: "out_educacao", kind: "out", name: "Educação", icon: "📚" },
    { id: "out_lazer", kind: "out", name: "Lazer", icon: "🎮" },
    { id: "out_compras", kind: "out", name: "Compras", icon: "🛍️" },
    { id: "out_servicos", kind: "out", name: "Serviços", icon: "🛠️" },
    { id: "out_assinaturas", kind: "out", name: "Assinaturas", icon: "📺" },
    { id: "out_cartao", kind: "out", name: "Conta de cartão", icon: "💳" },
    { id: "out_terceiros", kind: "out", name: "Gasto de terceiro", icon: "👥" },
    { id: "out_outros", kind: "out", name: "Outros", icon: "📦" },
    { id: "in_salario", kind: "in", name: "Salário", icon: "💼" },
    { id: "in_freela", kind: "in", name: "Freelance", icon: "💻" },
    { id: "in_reembolso", kind: "in", name: "Reembolso", icon: "↩️" },
    { id: "in_vendas", kind: "in", name: "Vendas", icon: "🏷️" },
    { id: "in_invest", kind: "in", name: "Rendimentos", icon: "📈" },
    { id: "in_outros", kind: "in", name: "Outras entradas", icon: "➕" }
  ];

  function seed() {
    return {
      version: 1,
      accounts: [
        { id: "acc_cash", name: "Dinheiro", type: "cash", icon: "💵", opening: 0 },
        { id: "acc_bank", name: "Conta bancária", type: "bank", icon: "🏦", opening: 0 }
      ],
      cards: [],
      categories: DEFAULT_CATS.slice(),
      transactions: [],
      third: [],
      transfers: [],
      budgets: {},
      recurrences: [],
      settings: { initialBalance: 0 },
      createdAt: new Date().toISOString()
    };
  }

  let db = null;

  /* normaliza dados antigos e garante o formato atual.
     - cada conta ganha saldo inicial (opening) e ícone;
     - existe o array de transferências (dinheiro que só muda de lugar);
     - o "saldo inicial" único das versões antigas vira saldo de uma conta,
       para que o total do caixa NÃO mude. */
  function migrate() {
    if (!db || typeof db !== "object" || Array.isArray(db)) db = seed();
    if (!Array.isArray(db.accounts) || !db.accounts.length) db.accounts = seed().accounts;
    db.accounts.forEach((a) => {
      if (typeof a.opening !== "number") a.opening = 0;
      if (!a.icon) a.icon = a.type === "cash" ? "💵" : "🏦";
      if (!a.name) a.name = "Conta";
    });
    if (!Array.isArray(db.transfers)) db.transfers = [];
    if (!db.settings || typeof db.settings !== "object") db.settings = { initialBalance: 0 };
    if (typeof db.settings.initialBalance !== "number") db.settings.initialBalance = 0;
    if (db.settings.initialBalance) {
      const alvo = db.accounts.find((a) => a.type === "bank") || db.accounts[0];
      alvo.opening += db.settings.initialBalance;
      db.settings.initialBalance = 0;
    }
  }

  /* grava localmente (sempre) e agenda o envio para a nuvem */
  function persist() {
    if (db && typeof db === "object") db.updatedAt = new Date().toISOString();
    guardarLocal();
    agendarPush();
  }

  const Store = {
    DEFAULT_CATS,

    init() {
      if (db) return db;
      /* quem está usando? (chave própria por usuário) */
      const sessaoAtual = readSession();
      dataKey =
        sessaoAtual && sessaoAtual.user_id
          ? KEY + "::" + sessaoAtual.user_id
          : KEY;
      try {
        const raw = localStorage.getItem(dataKey);
        db = raw ? JSON.parse(raw) : seed();
      } catch (e) {
        db = seed();
      }
      if (!db.categories) db.categories = DEFAULT_CATS.slice();
      if (!db.budgets || typeof db.budgets !== "object") db.budgets = {};
      if (!Array.isArray(db.recurrences)) db.recurrences = [];
      migrate();
      return db;
    },

    get data() {
      return Store.init();
    },

    uid() {
      return (
        Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)
      );
    },

    save: persist,

    /* ---------- categorias ---------- */
    categories(kind) {
      const list = Store.data.categories;
      return kind ? list.filter((c) => c.kind === kind) : list;
    },
    cat(id) {
      return Store.data.categories.find((c) => c.id === id) || null;
    },
    addCategory(c) {
      const item = Object.assign({ id: "cat_" + Store.uid() }, c);
      Store.data.categories.push(item);
      persist();
      return item;
    },
    removeCategory(id) {
      const used = Store.data.transactions.some((t) => t.catId === id);
      if (used) return false;
      Store.data.categories = Store.data.categories.filter((c) => c.id !== id);
      persist();
      return true;
    },

    /* ---------- contas ---------- */
    accounts() {
      return Store.data.accounts;
    },
    account(id) {
      return Store.data.accounts.find((a) => a.id === id) || null;
    },
    addAccount(a) {
      const item = Object.assign(
        { id: "acc_" + Store.uid(), type: "bank", icon: "🏦", opening: 0 },
        a
      );
      Store.data.accounts.push(item);
      persist();
      return item;
    },
    updateAccount(id, patch) {
      const a = Store.account(id);
      if (!a) return null;
      delete patch.id;
      Object.assign(a, patch);
      persist();
      return a;
    },
    /* conta padrão (para lançamentos sem destino definido) */
    defaultAccId() {
      const list = Store.accounts();
      if (!list.length) return null;
      const banco = list.find((a) => a.type === "bank");
      return (banco || list[0]).id;
    },
    /* conta dona de um lançamento:
       1) o "Pago com" (accId)  2) a conta que paga o cartão  3) conta padrão */
    txAccId(t) {
      if (t.accId && Store.account(t.accId)) return t.accId;
      if (t.cardId) {
        const c = Store.card(t.cardId);
        if (c && c.accId && Store.account(c.accId)) return c.accId;
      }
      return Store.defaultAccId();
    },
    /* a conta tem movimentação (não pode ser apagada)? */
    accUsed(id) {
      return (
        Store.data.transactions.some((t) => Store.txAccId(t) === id) ||
        Store.data.transfers.some((tr) => tr.from === id || tr.to === id) ||
        Store.data.cards.some((c) => c.accId === id)
      );
    },
    removeAccount(id) {
      if (Store.accounts().length <= 1) return false;
      if (Store.accUsed(id)) return false;
      Store.data.accounts = Store.data.accounts.filter((a) => a.id !== id);
      persist();
      return true;
    },
    /* saldo inicial somado — é o "caixa de partida" do Painel */
    openingTotal() {
      return Store.accounts().reduce((s, a) => s + (a.opening || 0), 0);
    },
    /* saldo de uma conta ao fim do mês (mk): soma com o caixa total */
    accBalanceAt(accId, mk) {
      const a = Store.account(accId);
      if (!a) return 0;
      let s = a.opening || 0;
      Store.data.transactions.forEach((t) => {
        if (t.date.slice(0, 7) > mk) return;
        if (Store.txAccId(t) !== accId) return;
        if (t.type === "in") s += t.amount;
        else if (t.type === "out") s -= t.amount;
      });
      Store.data.transfers.forEach((tr) => {
        if (String(tr.date || "").slice(0, 7) > mk) return;
        if (tr.to === accId) s += tr.amount;
        if (tr.from === accId) s -= tr.amount;
      });
      return s;
    },
    accBalances(mk) {
      return Store.accounts().map((a) => ({ a: a, v: Store.accBalanceAt(a.id, mk) }));
    },
    /* transferência: NÃO é entrada nem saída — só muda de lugar */
    addTransfer(tr) {
      const item = Object.assign(
        { id: "tr_" + Store.uid(), date: new Date().toISOString().slice(0, 10), note: "" },
        tr
      );
      Store.data.transfers.push(item);
      persist();
      return item;
    },
    removeTransfer(id) {
      Store.data.transfers = Store.data.transfers.filter((t) => t.id !== id);
      persist();
    },
    lastTransfer() {
      const list = Store.data.transfers.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
      return list[0] || null;
    },

    /* ---------- cartões ---------- */
    cards() {
      return Store.data.cards;
    },
    card(id) {
      return Store.data.cards.find((c) => c.id === id) || null;
    },
    addCard(c) {
      const item = Object.assign(
        {
          id: "card_" + Store.uid(),
          name: "Cartão",
          final: "",
          limit: 0,
          closing: 1,
          due: 10
        },
        c
      );
      Store.data.cards.push(item);
      persist();
      return item;
    },
    updateCard(id, patch) {
      const c = Store.card(id);
      if (!c) return null;
      Object.assign(c, patch);
      persist();
      return c;
    },
    removeCard(id) {
      const c = Store.card(id);
      /* para onde os lançamentos antigos passam a contar: a conta que
         pagava este cartão (senão o saldo delas mudaria sem motivo) */
      const alvo = c && c.accId && Store.account(c.accId) ? c.accId : Store.defaultAccId();
      Store.data.cards = Store.data.cards.filter((x) => x.id !== id);
      Store.data.transactions.forEach((t) => {
        if (t.cardId === id) {
          t.cardId = null;
          t.accId = alvo;
        }
      });
      persist();
    },

    /* ---------- transações ---------- */
    transactions() {
      return Store.data.transactions;
    },
    tx(id) {
      return Store.data.transactions.find((t) => t.id === id) || null;
    },
    addTx(t) {
      const item = Object.assign(
        {
          id: "tx_" + Store.uid(),
          type: "out",
          amount: 0,
          date: new Date().toISOString().slice(0, 10),
          catId: "out_outros",
          accId: null,
          cardId: null,
          note: "",
          group: null,
          createdAt: Date.now()
        },
        t
      );
      Store.data.transactions.push(item);
      persist();
      return item;
    },
    /* cria N parcelas vinculadas (mês a mês).
       start = número da primeira parcela a criar; total = total do contrato.
       Ex.: 12x com 3 já pagas → addInstallments(base, 9, 4, 12)
       cria da 4/12 até a 12/12, sem tocar nos meses já quitados.
       `valores` (opcional) = valor de cada parcela do contrato, da 1ª à
       última — usado quando o usuário digitou o VALOR TOTAL da compra. */
    addInstallments(base, n, start, total, valores) {
      const gid = "g_" + Store.uid();
      const ini = Math.max(1, Number(start) || 1);
      const fim = ini + Math.max(1, n) - 1;
      const tot = Number(total) >= fim ? Number(total) : fim;
      const [y, m] = base.date.slice(0, 7).split("-").map(Number);
      const created = [];
      for (let i = 0; i < n; i++) {
        const dt = new Date(y, m - 1 + i, Number(base.date.slice(8, 10)) || 1);
        const iso = dt.toISOString().slice(0, 10);
        const num = ini + i;
        const valor =
          valores && typeof valores[num - 1] === "number"
            ? valores[num - 1]
            : base.amount;
        created.push(
          Store.addTx(
            Object.assign({}, base, {
              amount: valor,
              date: iso,
              group: { gid, n: num, total: tot }
            })
          )
        );
      }
      return created;
    },
    updateTx(id, patch) {
      const t = Store.tx(id);
      if (!t) return null;
      delete patch.id;
      Object.assign(t, patch);
      persist();
      return t;
    },
    removeTx(id) {
      Store.data.transactions = Store.data.transactions.filter(
        (t) => t.id !== id
      );
      persist();
    },
    removeTxGroup(gid) {
      Store.data.transactions = Store.data.transactions.filter(
        (t) => !(t.group && t.group.gid === gid)
      );
      persist();
    },

    /* ---------- terceiros (gasto no MEU cartão) ---------- */
    third() {
      return Store.data.third;
    },
    thirdItem(id) {
      return Store.data.third.find((t) => t.id === id) || null;
    },
    addThird(t) {
      const item = Object.assign(
        {
          id: "td_" + Store.uid(),
          person: "",
          amount: 0,
          date: new Date().toISOString().slice(0, 10),
          cardId: null,
          note: "",
          status: "open",
          paidAt: null,
          createdAt: Date.now()
        },
        t
      );
      Store.data.third.push(item);
      persist();
      return item;
    },
    updateThird(id, patch) {
      const t = Store.thirdItem(id);
      if (!t) return null;
      Object.assign(t, patch);
      persist();
      return t;
    },
    removeThird(id) {
      Store.data.third = Store.data.third.filter((t) => t.id !== id);
      persist();
    },

    /* ---------- consultas / cálculos ---------- */
    txOfMonth(mk) {
      return Store.data.transactions.filter((t) => t.date.slice(0, 7) === mk);
    },
    sumIn(list) {
      return list
        .filter((t) => t.type === "in")
        .reduce((s, t) => s + t.amount, 0);
    },
    sumOut(list) {
      return list
        .filter((t) => t.type === "out")
        .reduce((s, t) => s + t.amount, 0);
    },
    /* fatura do cartão no mês = minhas compras + compras de terceiros
       (o banco cobra tudo, independentemente de quem gastou) */
    cardInvoice(cardId, mk) {
      const mine = Store.txOfMonth(mk)
        .filter((t) => t.cardId === cardId && t.type === "out")
        .reduce((s, t) => s + t.amount, 0);
      const others = Store.data.third
        .filter((t) => t.cardId === cardId && t.date.slice(0, 7) === mk)
        .reduce((s, t) => s + t.amount, 0);
      return { total: mine + others, mine, others };
    },
    /* parcelas que ainda vão cair (a partir do mês atual) */
    cardFuture(cardId, fromMk) {
      return Store.data.transactions
        .filter(
          (t) =>
            t.cardId === cardId &&
            t.type === "out" &&
            t.date.slice(0, 7) >= fromMk
        )
        .reduce((s, t) => s + t.amount, 0);
    },
    cardUsed(cardId) {
      const mine = Store.data.transactions
        .filter((t) => t.cardId === cardId && t.type === "out")
        .reduce((s, t) => s + t.amount, 0);
      const others = Store.data.third
        .filter((t) => t.cardId === cardId)
        .reduce((s, t) => s + t.amount, 0);
      return mine + others;
    },
    thirdOpenSum() {
      return Store.data.third
        .filter((t) => t.status === "open")
        .reduce((s, t) => s + t.amount, 0);
    },

    /* ---------- CAIXA: saldo acumulado mês a mês ---------- */
    settings() {
      const d = Store.init();
      if (!d.settings) d.settings = { initialBalance: 0 };
      return d.settings;
    },
    setSetting(key, value) {
      Store.settings()[key] = value;
      persist();
    },
    /* saldo que o mês fechou (entradas - saídas do próprio mês) */
    balanceOf(mk) {
      const l = Store.txOfMonth(mk);
      return Store.sumIn(l) - Store.sumOut(l);
    },
    /* o que "veio" do mês anterior: saldo inicial (somado das contas) + histórico */
    balanceBefore(mk) {
      const inicial = Store.openingTotal();
      const historico = Store.data.transactions
        .filter((t) => t.date.slice(0, 7) < mk)
        .reduce((s, t) => s + (t.type === "in" ? t.amount : -t.amount), 0);
      return inicial + historico;
    },
    /* caixa em mãos ao fim do mês (saldo anterior + mês) */
    cashAt(mk) {
      return Store.balanceBefore(mk) + Store.balanceOf(mk);
    },
    /* gasto do mês já descontando o que é de terceiro
       (lançamentos feitos por terceiros entram em out_terceiros) */
    monthOutReal(mk) {
      return Store.sumOut(Store.txOfMonth(mk));
    },

    /* ---------- ORÇAMENTO (limite por categoria no mês) ---------- */
    budgets() {
      const d = Store.init();
      if (!d.budgets || typeof d.budgets !== "object") d.budgets = {};
      return d.budgets;
    },
    setBudgets(map) {
      Store.budgets();
      Store.data.budgets = map || {};
      persist();
    },
    /* quanto já foi gasto no mês (saídas) */
    spentInMonth(mk, catId) {
      return Store.txOfMonth(mk)
        .filter((t) => t.type === "out" && (!catId || t.catId === catId))
        .reduce((s, t) => s + t.amount, 0);
    },
    /* situação dos limites num mês: [{catId, limite, gasto, pct, estourou}] */
    budgetStatus(mk) {
      const b = Store.budgets();
      return Object.keys(b)
        .filter((id) => b[id] > 0)
        .map((id) => {
          const limite = b[id];
          const gasto = Store.spentInMonth(mk, id);
          return {
            catId: id,
            limite,
            gasto,
            pct: Math.max(0, Math.min(100, Math.round((gasto / limite) * 100))),
            faltou: limite - gasto,
            estourou: gasto > limite
          };
        })
        .sort((a, c) => c.gasto / c.limite - a.gasto / a.limite);
    },

    /* ---------- CONTAS FIXAS (recorrências) ---------- */
    recurrences() {
      const d = Store.init();
      if (!Array.isArray(d.recurrences)) d.recurrences = [];
      return d.recurrences;
    },
    rec(id) {
      return Store.recurrences().find((r) => r.id === id) || null;
    },
    addRec(o) {
      const item = Object.assign(
        {
          id: "rec_" + Store.uid(),
          type: "out",
          amount: 0,
          day: 1,
          catId: "out_outros",
          note: "",
          cardId: null,
          accId: null,
          start: new Date().toISOString().slice(0, 7),
          active: true
        },
        o
      );
      Store.recurrences().push(item);
      persist();
      return item;
    },
    removeRec(id) {
      const l = Store.recurrences();
      const i = l.findIndex((r) => r.id === id);
      if (i > -1) l.splice(i, 1);
      persist();
    },
    /* cria sozinho os lançamentos das contas fixas até a data informada.
       Só gera o mês atual quando o dia já chegou — nada de data futura. */
    syncRecs(iso) {
      const hoje = iso || new Date().toISOString().slice(0, 10);
      const mkAtual = hoje.slice(0, 7);
      const criados = [];
      Store.recurrences().forEach((rec) => {
        if (rec.active === false || !(rec.amount > 0)) return;
        const inicio = rec.start || mkAtual;
        if (inicio > mkAtual) return;
        let mk = inicio;
        let guarda = 0;
        while (mk <= mkAtual && guarda++ < 120) {
          const p = mk.split("-").map(Number);
          const diasNoMes = new Date(p[0], p[1], 0).getDate();
          const dia = Math.min(Number(rec.day) || 1, diasNoMes);
          const data = mk + "-" + String(dia).padStart(2, "0");
          const devido = mk < mkAtual || data <= hoje;
          const jaTem = Store.data.transactions.some(
            (t) => t.rec === rec.id && t.date.slice(0, 7) === mk
          );
          if (devido && !jaTem) {
            criados.push(
              Store.addTx({
                type: rec.type || "out",
                amount: rec.amount,
                date: data,
                catId: rec.catId,
                note: rec.note,
                cardId: rec.cardId || null,
                accId: rec.accId || null,
                rec: rec.id
              })
            );
          }
          const nm = p[1] === 12 ? 1 : p[1] + 1;
          const ny = p[1] === 12 ? p[0] + 1 : p[0];
          mk = ny + "-" + String(nm).padStart(2, "0");
        }
      });
      return criados;
    },

    /* ---------- BLOQUEIO (PIN) ---------- */
    pinAtivo() {
      return !!Store.settings().pin;
    },
    async hashPin(pin) {
      const txt = "fin-pin:" + String(pin);
      if (self.crypto && crypto.subtle && crypto.subtle.digest) {
        try {
          const h = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(txt)
          );
          return Array.from(new Uint8Array(h))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        } catch (e) {
          /* cai no fallback */
        }
      }
      /* fallback simples onde não existe crypto.subtle */
      let h = 5381;
      for (let i = 0; i < txt.length; i++) h = ((h << 5) + h + txt.charCodeAt(i)) >>> 0;
      return "fb" + h.toString(16);
    },
    async setPin(pin) {
      const s = Store.settings();
      s.pin = await Store.hashPin(pin);
      s.pinLen = String(pin).length;
      persist();
    },
    async checkPin(pin) {
      const s = Store.settings();
      if (!s.pin) return true;
      return (await Store.hashPin(pin)) === s.pin;
    },
    clearPin() {
      const s = Store.settings();
      delete s.pin;
      delete s.pinLen;
      delete s.cred;
      persist();
    },

    /* ---------- backup ---------- */
    /* resumo do que existe hoje (para mostrar antes de exportar/importar) */
    stats() {
      const d = Store.init();
      return {
        tx: (d.transactions || []).length,
        cards: (d.cards || []).length,
        third: (d.third || []).length,
        recs: (d.recurrences || []).length,
        accs: (d.accounts || []).length,
        trf: (d.transfers || []).length
      };
    },
    markBackup() {
      Store.settings().lastBackup = new Date().toISOString();
      persist();
    },
    exportJSON() {
      return JSON.stringify(db, null, 2);
    },
    importJSON(text) {
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        throw new Error("Arquivo inválido — não é um backup .json");
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error("Arquivo inválido");
      if (!Array.isArray(parsed.transactions))
        throw new Error("Não parece um backup deste app");
      if (!Array.isArray(parsed.cards)) parsed.cards = [];
      if (!Array.isArray(parsed.third)) parsed.third = [];
      if (!Array.isArray(parsed.categories)) parsed.categories = DEFAULT_CATS.slice();
      if (!parsed.settings || typeof parsed.settings !== "object") parsed.settings = { initialBalance: 0 };
      if (typeof parsed.settings.initialBalance !== "number") parsed.settings.initialBalance = 0;
      if (!parsed.budgets || typeof parsed.budgets !== "object" || Array.isArray(parsed.budgets))
        parsed.budgets = {};
      if (!Array.isArray(parsed.recurrences)) parsed.recurrences = [];
      db = parsed;
      migrate();
      persist();
      return {
        tx: db.transactions.length,
        cards: db.cards.length,
        third: db.third.length,
        accs: db.accounts.length
      };
    },
    reset() {
      db = seed();
      persist();
    }
  };

  /* =====================================================================
     LOGIN + SINCRONIZAÇÃO (o app só conversa por aqui)
     ===================================================================== */
  Store.auth = {
    /* sessão guardada no aparelho (síncrona, usada na abertura do app) */
    session() {
      return readSession();
    },
    onExpired(fn) {
      expiredHook = fn;
    },

    async signIn(email, pass) {
      const j = await supa("/auth/v1/token?grant_type=password", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ email: email, password: pass })
      });
      saveSession(normSession(j));
      db = null;
      Store.init();
      return true;
    },

    async signUp(email, pass) {
      const j = await supa("/auth/v1/signup", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ email: email, password: pass })
      });
      if (!j || !j.access_token)
        throw new Error("Confirme o link enviado ao seu e-mail");
      saveSession(normSession(j));
      db = null;
      Store.init();
      return true;
    },

    /* entra pelo Google (redireciona e volta para cá com os tokens) */
    async signInGoogle() {
      let challenge = "";
      try {
        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        const verifier = btoa(String.fromCharCode.apply(null, Array.from(bytes)))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");
        const dig = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(verifier)
        );
        challenge = btoa(
          String.fromCharCode.apply(null, Array.from(new Uint8Array(dig)))
        )
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");
        try {
          localStorage.setItem(PKCE_KEY, verifier);
        } catch (e) {}
      } catch (e) {
        challenge = "";
      }
      const volta = location.origin + location.pathname + location.search;
      let url =
        CLOUD_URL +
        "/auth/v1/authorize?provider=google&redirect_to=" +
        encodeURIComponent(volta);
      if (challenge)
        url +=
          "&code_challenge=" +
          encodeURIComponent(challenge) +
          "&code_challenge_method=s256";
      location.href = url;
    },

    /* a página voltou do Google com os tokens na URL? */
    async consumeRedirect() {
      const hash = location.hash ? location.hash.slice(1) : "";
      const busca = location.search ? location.search.slice(1) : "";
      const hp = new URLSearchParams(hash);
      const qp = new URLSearchParams(busca);
      const code = qp.get("code");
      let sessao = null;
      if (hp.get("access_token")) {
        sessao = normSession({
          access_token: hp.get("access_token"),
          refresh_token: hp.get("refresh_token"),
          expires_in: hp.get("expires_in"),
          token_type: hp.get("token_type")
        });
      } else if (code) {
        let verifier = null;
        try {
          verifier = localStorage.getItem(PKCE_KEY);
        } catch (e) {}
        if (!verifier) return false;
        const j = await supa("/auth/v1/token?grant_type=pkce", {
          method: "POST",
          auth: false,
          body: JSON.stringify({ auth_code: code, code_verifier: verifier })
        });
        sessao = normSession(j);
      } else {
        return false;
      }
      try {
        localStorage.removeItem(PKCE_KEY);
      } catch (e) {}
      if (!sessao || !sessao.user_id) throw new Error("Falha ao entrar");
      saveSession(sessao);
      db = null;
      Store.init();
      history.replaceState(null, "", location.pathname + "#home");
      return true;
    },

    async signOut() {
      if (pushTimer) {
        clearTimeout(pushTimer);
        pushTimer = null;
      }
      try {
        if (readSession()) await supa("/auth/v1/logout", { method: "POST" });
      } catch (e) {}
      dropSession();
      db = null;
      syncState = "idle";
      syncAt = null;
    },

    /* puxa o que está na nuvem; devolve o que aconteceu */
    pull() {
      return puxar();
    },

    /* envia o que está neste aparelho */
    async push() {
      const s = readSession();
      if (!s) return "no-session";
      Store.init();
      try {
        const vivo = await sessaoViva();
        syncState = "saving";
        avisarSync();
        const quando = new Date().toISOString();
        await supa("/rest/v1/user_data", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({
            user_id: vivo.user_id,
            data: db,
            updated_at: quando
          })
        });
        db.updatedAt = quando;
        guardarLocal();
        syncState = "ok";
        syncAt = Date.now();
        avisarSync();
        return "ok";
      } catch (e) {
        syncState =
          typeof navigator !== "undefined" && navigator.onLine === false
            ? "offline"
            : "error";
        if (e.status === 401) sessaoInvalida();
        avisarSync();
        throw e;
      }
    },

    /* botão "Sincronizar agora": puxa e, se precisar, envia */
    async syncNow() {
      const r = await puxar();
      if (r === "local-newer" || r === "empty") await Store.auth.push();
      return r;
    },

    /* dados que já existiam neste aparelho antes do login */
    legacyInfo() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const d = JSON.parse(raw);
        if (!d || !Array.isArray(d.transactions)) return null;
        return {
          tx: d.transactions.length,
          cards: (d.cards || []).length,
          third: (d.third || []).length
        };
      } catch (e) {
        return null;
      }
    },
    useLegacy() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return false;
        const d = JSON.parse(raw);
        if (!d || !Array.isArray(d.transactions)) return false;
        db = d;
        if (!db.categories) db.categories = DEFAULT_CATS.slice();
        migrate();
        Store.save();
        return true;
      } catch (e) {
        return false;
      }
    },
    startFresh() {
      db = seed();
      Store.save();
      return true;
    },

    status() {
      const s = readSession();
      return {
        logged: !!s,
        email: (s && s.email) || "",
        sync: syncState,
        label: rotuloSync()
      };
    }
  };

  window.Store = Store;
})();
