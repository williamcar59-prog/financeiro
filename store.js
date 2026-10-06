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
        { id: "acc_cash", name: "Dinheiro", type: "cash" },
        { id: "acc_bank", name: "Conta bancária", type: "bank" }
      ],
      cards: [],
      categories: DEFAULT_CATS.slice(),
      transactions: [],
      third: [],
      createdAt: new Date().toISOString()
    };
  }

  let db = null;

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
      const item = Object.assign({ id: "acc_" + Store.uid(), type: "bank" }, a);
      Store.data.accounts.push(item);
      persist();
      return item;
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
      Store.data.cards = Store.data.cards.filter((c) => c.id !== id);
      Store.data.transactions.forEach((t) => {
        if (t.cardId === id) t.cardId = null;
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
    /* cria N parcelas vinculadas (mês a mês) */
    addInstallments(base, n) {
      const gid = "g_" + Store.uid();
      const [y, m] = base.date.slice(0, 7).split("-").map(Number);
      const created = [];
      for (let i = 0; i < n; i++) {
        const dt = new Date(y, m - 1 + i, Number(base.date.slice(8, 10)) || 1);
        const iso = dt.toISOString().slice(0, 10);
        created.push(
          Store.addTx(
            Object.assign({}, base, {
              date: iso,
              group: { gid, n: i + 1, total: n }
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
    /* gasto do mês já descontando o que é de terceiro
       (lançamentos feitos por terceiros entram em out_terceiros) */
    monthOutReal(mk) {
      return Store.sumOut(Store.txOfMonth(mk));
    },

    /* ---------- backup ---------- */
    exportJSON() {
      return JSON.stringify(db, null, 2);
    },
    importJSON(text) {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || !parsed.transactions)
        throw new Error("Arquivo inválido");
      db = parsed;
      if (!db.categories) db.categories = DEFAULT_CATS.slice();
      persist();
      return true;
    },
    reset() {
      db = seed();
      persist();
    }
  };

  window.Store = Store;
})();
