/* =====================================================================
   store.js — camada de dados (local-first)
   Hoje: localStorage. Futuro (Fase 2): trocar "persist()" por chamadas
   ao Supabase mantendo a MESMA API pública. Nada mais no app acessa
   o localStorage diretamente.
   Valores monetários são SEMPRE inteiros em centavos.
   ===================================================================== */
(function () {
  "use strict";

  const KEY = "planilha_gastos_v1";

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

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch (e) {
      console.error("Falha ao salvar dados", e);
    }
  }

  const Store = {
    DEFAULT_CATS,

    init() {
      if (db) return db;
      try {
        const raw = localStorage.getItem(KEY);
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
       cria da 4/12 até a 12/12, sem tocar nos meses já quitados. */
    addInstallments(base, n, start, total) {
      const gid = "g_" + Store.uid();
      const ini = Math.max(1, Number(start) || 1);
      const fim = ini + Math.max(1, n) - 1;
      const tot = Number(total) >= fim ? Number(total) : fim;
      const [y, m] = base.date.slice(0, 7).split("-").map(Number);
      const created = [];
      for (let i = 0; i < n; i++) {
        const dt = new Date(y, m - 1 + i, Number(base.date.slice(8, 10)) || 1);
        const iso = dt.toISOString().slice(0, 10);
        created.push(
          Store.addTx(
            Object.assign({}, base, {
              date: iso,
              group: { gid, n: ini + i, total: tot }
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

  window.Store = Store;
})();
