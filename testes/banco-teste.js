/* =====================================================================
   testes/banco-teste.js — SEMENTE DO BANCO DE TESTE (v1.12.0)
   ----------------------------------------------------------------------
   Cria uma carteira COMPLETA de demonstração dentro da conta em que você
   estiver logado: contas, cartões (crédito/vale/empréstimo), parcelas,
   terceiros e cinco meses de lançamentos.

   PARA QUE SERVE?
   Serve para você testar as funções do app numa conta SEPARADA da sua,
   sem medo de apagar os dados de verdade. É a mesma ideia de um "banco
   de teste" de programador.

   COMO USAR (3 passos):
     1. Abra o app (local ou publicado) e entre com a conta de teste
        (a de teste, NÃO a sua).
     2. Abra o console do navegador (F12 → aba Console) e cole o
        conteúdo DESTE arquivo, inteiro, e aperte Enter.
     3. Pronto: a carteira de demonstração aparece na tela. Recarregue
        a página para ver tudo no lugar.

   O script é de propósito "destrutivo": ele ZERA os lançamentos, cartões,
   terceiros, transferências e contas da conta logada e monta a carteira
   de demonstração do zero. Por isso só se usa em conta de teste, nunca na
   sua. As categorias não são tocadas.

   NÃO vai para o repositório publicado (é ferramenta de desenvolvedor).
   ===================================================================== */
(function () {
  "use strict";

  if (typeof Store === "undefined") {
    console.error("Abra o app primeiro (store.js precisa estar carregado).");
    return;
  }
  if (typeof Store.uid !== "function" || !Store.uid()) {
    console.error("Entre com a conta de teste antes de rodar a semente.");
    return;
  }

  /* ---------- 0) limpa o que já estava lá ----------
     Isto é um BANCO DE TESTE: ele começa do zero de propósito, para a
     carteira de demonstração ficar sempre igual (sem ficar acumulando
     dados de uma rodada na outra). As categorias continuam intactas. */
  Store.data.transactions = [];
  Store.data.cards = [];
  Store.data.third = [];
  Store.data.transfers = [];
  Store.data.accounts = [];
  Store.data.budgets = {};
  Store.data.recurrences = [];

  /* ---------- pequenos ajudantes ---------- */
  const uid = () => Store.uid();
  const catOut = (s) => {
    const c = Store.data.categories.find((x) => x.id.indexOf(s) >= 0 && x.kind === "out");
    return c ? c.id : "out_outros";
  };
  const catIn = (s) => {
    const c = Store.data.categories.find((x) => x.id.indexOf(s) >= 0 && x.kind === "in");
    return c ? c.id : "in_outros";
  };
  /* "2026-10" + dia → "2026-10-09" */
  const dia = (mk, d) => mk + "-" + (d < 10 ? "0" + d : String(d));
  const tx = (mk, d, tipo, valor, catId, desc, extra) =>
    Store.addTx(
      Object.assign(
        { type: tipo, amount: valor, date: dia(mk, d), catId: catId, desc: desc },
        extra || {}
      )
    );

  /* ---------- 1) contas ---------- */
  const banco = Store.addAccount({ name: "Conta corrente", type: "bank", icon: "🏦", opening: 150000 });
  const poupanca = Store.addAccount({ name: "Poupança", type: "saving", icon: "🐖", opening: 500000 });
  const dinheiro = Store.addAccount({ name: "Carteira", type: "cash", icon: "👛", opening: 5000 });

  /* ---------- 2) cartões ---------- */
  const nubank = Store.addCard({
    kind: "credito",
    name: "Nubank",
    final: "1234",
    limit: 800000,
    closing: 3,
    due: 10,
    accId: banco.id
  });
  const vale = Store.addCard({
    kind: "vale",
    name: "Alelo",
    final: "5678",
    credito: 60000,
    closing: 1,
    due: 5,
    accId: banco.id
  });
  const emprestimo = Store.addCard({
    kind: "emprestimo",
    name: "Empréstimo pessoal",
    final: "",
    parcelas: 24,
    valorParcela: 18000,
    taxa: 2.3,
    closing: 1,
    due: 15,
    accId: banco.id
  });

  /* ---------- 3) meses de demonstração (jun a out de 2026) ---------- */
  const MESES = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
  let lancamentos = 0;

  MESES.forEach((mk, mi) => {
    /* entrada fixa: salário no dia 5 */
    tx(mk, 5, "in", 320000, catIn("salario"), "Salário");
    /* freela eventual (3 meses) */
    if (mi % 2 === 0) tx(mk, 18, "in", 85000, catIn("freela"), "Freela — site do vizinho");

    /* moradia: aluguel dia 10 + condomínio */
    tx(mk, 10, "out", 95000, catOut("moradia"), "Aluguel");
    tx(mk, 10, "out", 28000, catOut("moradia"), "Condomínio");

    /* alimentação: mercado + feira + padaria */
    tx(mk, 7, "out", 62340, catOut("alimentacao"), "Mercado do mês", { cardId: nubank.id });
    tx(mk, 20, "out", 14500, catOut("alimentacao"), "Feira do sábado");
    tx(mk, 3, "out", 890, catOut("alimentacao"), "Padaria");

    /* transporte */
    tx(mk, 2, "out", 22000, catOut("transporte"), "Recarga transporte", { cardId: vale.id });
    tx(mk, 12, "out", 1350, catOut("transporte"), "Uber");

    /* saúde */
    tx(mk, 8, "out", 12900, catOut("saude"), "Farmácia");
    if (mi === 3) tx(mk, 22, "out", 25000, catOut("saude"), "Consulta dentista");

    /* lazer e serviços */
    tx(mk, 14, "out", 3200, catOut("lazer"), "Cinema", { cardId: nubank.id });
    tx(mk, 15, "out", 5590, catOut("assinaturas"), "Streaming", { cardId: nubank.id });
    tx(mk, 11, "out", 18990, catOut("servicos"), "Conta de luz");
    tx(mk, 11, "out", 8900, catOut("servicos"), "Internet");
    tx(mk, 11, "out", 5900, catOut("servicos"), "Celular");

    /* parcela do empréstimo, todo dia 15 */
    tx(mk, 15, "out", 18000, catOut("emprestimo"), "Empréstimo — parcela", { cardId: emprestimo.id });

    /* gastos de terceiros no SEU cartão (o que o app soma na fatura) */
    if (mi >= 2) {
      Store.addThird({ person: "João", amount: 45000, date: dia(mk, 9), cardId: nubank.id, note: "Jantar" });
      Store.addThird({ person: "Maria", amount: 12500, date: dia(mk, 21), cardId: nubank.id, note: "Presente" });
      Store.addThird({ person: "Padaria do Zé", amount: 3200, date: dia(mk, 25), cardId: null, note: "Fiado" });
    }
    lancamentos += 16;
  });

  /* ---------- 4) compras PARCELADAS (para o PDF mostrar 3/12 etc.) ---------- */
  /* geladeira em junho, 12x de R$ 150 — 5 já vencidas, as outras continuam */
  Store.addInstallments(
    {
      type: "out",
      amount: 15000,
      date: "2026-06-20",
      catId: catOut("compras"),
      desc: "Geladeira — 12x de R$ 150",
      cardId: nubank.id
    },
    12,
    1,
    12,
    null
  );
  /* notebook em agosto, 10x de R$ 320 */
  Store.addInstallments(
    {
      type: "out",
      amount: 32000,
      date: "2026-08-12",
      catId: catOut("compras"),
      desc: "Notebook — 10x de R$ 320",
      cardId: nubank.id
    },
    10,
    1,
    10,
    null
  );
  lancamentos += 22;

  /* ---------- 5) transferências entre contas ---------- */
  Store.addTransfer({ from: banco.id, to: poupanca.id, amount: 100000, date: "2026-07-05", note: "Guardar 10% do salário" });
  Store.addTransfer({ from: poupanca.id, to: banco.id, amount: 30000, date: "2026-09-20", note: "Retirada de emergência" });

  /* ---------- relatório no console ---------- */
  const total = Store.data.transactions.length;
  console.log(
    "%c✅ Banco de teste pronto!",
    "color:#059669;font-weight:bold;font-size:14px",
    "\nlançamentos: " + total +
      "\ncontas: " + Store.data.accounts.length +
      "\ncartões: " + Store.data.cards.length +
      " (crédito/vale/empréstimo)" +
      "\nterceiros: " + Store.data.third.length +
      "\ntransferências: " + Store.data.transfers.length +
      "\n\nDica: gere o PDF do mês em Relatórios → o mês de outubro de 2026" +
      " mostra a tabela linha a linha, as faturas e os terceiros."
  );
  console.log("Sincronize para levar tudo para a nuvem (⚡ ou feche e abra o app).");

  /* redesenha a tela, se o app estiver montado */
  if (typeof render === "function") render();
  else if (window.App && typeof window.App.render === "function") window.App.render();
})();
