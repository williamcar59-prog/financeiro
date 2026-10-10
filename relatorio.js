/* =====================================================================
   relatorio.js — PDF do mês (v1.11.0 · completo na v1.12.0)
   ----------------------------------------------------------------------
   Monta um PDF de verdade, dentro do navegador, com o jsPDF (guardado
   em jspdf.umd.min.js — nada de internet, funciona offline).

   v1.12.0 — O PDF deixou de ser só o resumo:
     · página 1: resumo (igual sempre foi)
     · tabela linha a linha dos lançamentos (data, descrição, categoria,
       parcela e valor) — repete o cabeçalho em cada página nova
     · faturas dos cartões de crédito + total das faturas
     · total de compras parceladas no mês
     · gastos de terceiros por pessoa (e quanto saiu do SEU cartão)
   E o jsPDF (356 KB) agora só é baixado na hora de gerar o PDF —
   antes ele era lido em toda abertura do app.

   Este arquivo NÃO conhece o app: ele só recebe os números prontos e
   devolve o documento pronto. Assim dá para testar sozinho, sem tocar
   nos dados de ninguém.

   Uso (feito pelo app.js):
     await RelatorioPDF.carregar();            // traz o jsPDF se faltar
     const doc = RelatorioPDF.gerar({ mesLabel: "outubro de 2026", ... });
     doc.save("relatorio-2026-10.pdf");
   ===================================================================== */
(function () {
  "use strict";

  /* cores iguaiszinhas às do app (styles.css) */
  const C = {
    brand: [5, 150, 105], /* #059669 — topo e títulos */
    inC: [22, 163, 74], /* #16a34a — entradas */
    outC: [225, 29, 72], /* #e11d48 — saídas */
    ink: [15, 23, 42], /* #0f172a — texto principal */
    ink2: [100, 116, 139], /* rótulos e rodapé */
    bg: [244, 246, 250], /* cartões */
    line: [203, 213, 225]
  };

  /* "R$ 1.234,56" a partir de centavos (igual o fmt do app) */
  function moeda(cents) {
    const n = (Number(cents) || 0) / 100;
    const neg = n < 0;
    const p = Math.abs(n).toFixed(2).split(".");
    const int = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (neg ? "-" : "") + "R$ " + int + "," + p[1];
  }
  /* quebra texto comprido para caber na largura dada */
  function curto(txt, largura, doc, size) {
    doc.setFontSize(size);
    let s = String(txt);
    if (doc.getTextWidth(s) <= largura) return s;
    while (s.length > 3 && doc.getTextWidth(s + "…") > largura) s = s.slice(0, -1);
    return s + "…";
  }

  /* ===================================================================
     v1.12.0 — o jsPDF só é trazido quando alguém pede o PDF.
     Guarda a promessa para não injetar o <script> duas vezes.
     =================================================================== */
  let carregando = null;
  function carregar() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(true);
    if (carregando) return carregando;
    carregando = new Promise(function (ok, falha) {
      const s = document.createElement("script");
      s.src = "jspdf.umd.min.js"; /* cacheado pelo service worker = offline */
      s.onload = function () {
        ok(true);
      };
      s.onerror = function () {
        carregando = null;
        falha(new Error("jsPDF não carregou"));
      };
      document.head.appendChild(s);
    });
    return carregando;
  }

  function gerar(o) {
    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) throw new Error("jsPDF não carregado");

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const L = 18; /* margem esquerda */
    const W = 210 - L * 2; /* largura útil = 174 */
    const num = (v) => (Number(v) || 0);
    const FIM = 266; /* último y que cabe antes do rodapé (272) */
    let y = 0;

    /* colunas da tabela de lançamentos (somam 174 = W) */
    const COLS = [
      { x: 0, w: 16, rot: "Data" },
      { x: 16, w: 84, rot: "Descrição" },
      { x: 100, w: 34, rot: "Categoria" },
      { x: 134, w: 14, rot: "Parc." },
      { x: 148, w: 26, rot: "Valor", dir: true }
    ];

    /* ---------------- página nova (continuação) ---------------- */
    function novaPagina() {
      doc.addPage();
      doc.setFillColor(C.brand[0], C.brand[1], C.brand[2]);
      doc.rect(0, 0, 210, 14, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text("Minha Vida Financeira", L, 9);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(o.mesLabel || "", 210 - L, 9, { align: "right" });
      y = 26;
    }
    /* abre página se o que vem a seguir não couber */
    function garante(n) {
      if (y + n > FIM) novaPagina();
    }
    function titulo(txt) {
      garante(24);
      doc.setTextColor(C.brand[0], C.brand[1], C.brand[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(txt, L, y + 5);
      y += 9;
    }
    function faixa(i, alt) {
      if (i % 2 === 0) {
        doc.setFillColor(C.bg[0], C.bg[1], C.bg[2]);
        doc.rect(L, y, W, alt, "F");
      }
    }
    function regua() {
      doc.setDrawColor(C.line[0], C.line[1], C.line[2]);
      doc.setLineWidth(0.4);
      doc.line(L, y, 210 - L, y);
    }
    /* texto alinhado à direita / à esquerda — o `yb` é a LINHA DE BASE
       (o topo da faixa é y; dentro de faixa de 9mm o texto vai em y+6) */
    function direita(yb, txt, bold, cor, size) {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size || 9.5);
      doc.setTextColor(cor[0], cor[1], cor[2]);
      doc.text(txt, 210 - L - 3, yb, { align: "right" });
    }
    function esquerda(yb, txt, bold, cor, size) {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size || 9.5);
      doc.setTextColor(cor[0], cor[1], cor[2]);
      doc.text(txt, L + 3, yb);
    }

    /* ================= PÁGINA 1 — RESUMO ================= */
    doc.setFillColor(C.brand[0], C.brand[1], C.brand[2]);
    doc.rect(0, 0, 210, 31, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text("Minha Vida Financeira", L, 15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Relatório de " + (o.mesLabel || ""), L, 23);
    doc.setFontSize(8.5);
    doc.text("Gerado em " + (o.geradoEm || ""), 210 - L, 23, { align: "right" });

    /* 4 cartões de resumo */
    const cartoes = [
      { r: "Entradas", v: moeda(o.entradas), c: C.inC },
      { r: "Saídas", v: moeda(o.saidas), c: C.outC },
      { r: "Saldo do mês", v: moeda(o.saldo), c: num(o.saldo) < 0 ? C.outC : C.ink },
      { r: "Caixa ao fim", v: moeda(o.caixa), c: num(o.caixa) < 0 ? C.outC : C.ink }
    ];
    const cw = (W - 3 * 4) / 4;
    const cy = 38;
    cartoes.forEach((k, i) => {
      const x = L + i * (cw + 4);
      doc.setFillColor(C.bg[0], C.bg[1], C.bg[2]);
      doc.roundedRect(x, cy, cw, 22, 2.5, 2.5, "F");
      doc.setTextColor(C.ink2[0], C.ink2[1], C.ink2[2]);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(curto(k.r, cw - 6, doc, 8), x + 3, cy + 8);
      doc.setTextColor(k.c[0], k.c[1], k.c[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12.5);
      doc.text(curto(k.v, cw - 6, doc, 12.5), x + 3, cy + 17);
    });

    /* barras: 6 meses */
    y = 72;
    doc.setTextColor(C.brand[0], C.brand[1], C.brand[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Comparativo dos últimos 6 meses", L, y);

    const serie = Array.isArray(o.serie) ? o.serie : [];
    const max = Math.max(1, ...serie.map((d) => Math.max(num(d.in), num(d.out))));
    const baseY = 118; /* linha do chão das barras */
    const alturaMax = 34;
    const pitch = W / Math.max(1, serie.length);
    serie.forEach((d, i) => {
      const cx = L + i * pitch + pitch / 2;
      const hi = Math.round((num(d.in) / max) * alturaMax);
      const ho = Math.round((num(d.out) / max) * alturaMax);
      doc.setFillColor(C.inC[0], C.inC[1], C.inC[2]);
      doc.rect(cx - 6.5, baseY - hi, 6, hi, "F");
      doc.setFillColor(C.outC[0], C.outC[1], C.outC[2]);
      doc.rect(cx + 0.5, baseY - ho, 6, ho, "F");
      doc.setTextColor(C.ink2[0], C.ink2[1], C.ink2[2]);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(String(d.rot || ""), cx, baseY + 5, { align: "center" });
    });
    doc.setDrawColor(C.line[0], C.line[1], C.line[2]);
    doc.setLineWidth(0.4);
    doc.line(L, baseY, 210 - L, baseY);
    /* legenda */
    doc.setFillColor(C.inC[0], C.inC[1], C.inC[2]);
    doc.rect(L, 127, 3.5, 3.5, "F");
    doc.setTextColor(C.ink2[0], C.ink2[1], C.ink2[2]);
    doc.setFontSize(8.5);
    doc.text("Entradas", L + 5, 130.2);
    doc.setFillColor(C.outC[0], C.outC[1], C.outC[2]);
    doc.rect(L + 26, 127, 3.5, 3.5, "F");
    doc.text("Saídas", L + 31, 130.2);

    /* resumo em números */
    y = 145;
    doc.setTextColor(C.brand[0], C.brand[1], C.brand[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Resumo em números", L, y);

    const linhas = [
      ["Entradas do mês", moeda(o.entradas) + " · média: " + moeda(o.mediaIn)],
      ["Saídas do mês", moeda(o.saidas) + " · média: " + moeda(o.mediaOut)],
      ["Saldo do mês (o que sobrou)", moeda(o.saldo)],
      ["Caixa ao fim do mês", moeda(o.caixa)],
      [
        "Maior gasto",
        o.maior
          ? (o.maior.catNome || "Sem categoria") + " · " + moeda(o.maior.amount) +
            (o.maior.data ? " (" + o.maior.data + ")" : "")
          : "—"
      ],
      ["Lançamentos no mês", String(num(o.nIn)) + " entrada(s) · " + String(num(o.nOut)) + " saída(s)"]
    ];
    let ry = y + 8;
    linhas.forEach((ln, i) => {
      if (i % 2 === 0) {
        doc.setFillColor(C.bg[0], C.bg[1], C.bg[2]);
        doc.rect(L, ry, W, 9, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(C.ink2[0], C.ink2[1], C.ink2[2]);
      doc.text(ln[0], L + 3, ry + 6);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(C.ink[0], C.ink[1], C.ink[2]);
      doc.text(curto(ln[1], W - 8 - doc.getTextWidth(ln[0]) - 8, doc, 9.5), 210 - L - 3, ry + 6, {
        align: "right"
      });
      ry += 9;
    });
    y = ry + 4;

    /* ============ TABELA: LANÇAMENTOS DO MÊS ============ */
    const lancs = Array.isArray(o.lancs) ? o.lancs : [];
    if (lancs.length) {
      titulo("Lançamentos do mês (" + lancs.length + ")");
      cabecalhoTabela();
      lancs.forEach((t, i) => {
        garante(7);
        faixa(i, 7);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(C.ink[0], C.ink[1], C.ink[2]);
        doc.text(String(t.d || ""), L + 2, y + 4.7);
        doc.text(curto(t.desc || "", COLS[1].w - 4, doc, 8.5), L + COLS[1].x + 2, y + 4.7);
        doc.setTextColor(C.ink2[0], C.ink2[1], C.ink2[2]);
        doc.text(curto(t.cat || "", COLS[2].w - 4, doc, 8.5), L + COLS[2].x + 2, y + 4.7);
        if (t.parc) doc.text(String(t.parc), L + COLS[3].x + 2, y + 4.7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(
          t.tipo === "in" ? C.inC[0] : C.outC[0],
          t.tipo === "in" ? C.inC[1] : C.outC[1],
          t.tipo === "in" ? C.inC[2] : C.outC[2]
        );
        doc.text(moeda(t.v), 210 - L - 2, y + 4.7, { align: "right" });
        y += 7;
      });

      /* fechamento da tabela */
      garante(16);
      y += 3;
      regua();
      y += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(C.ink2[0], C.ink2[1], C.ink2[2]);
      doc.text("No período: entradas " + moeda(o.entradas) + " · saídas " + moeda(o.saidas), L + 3, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor((num(o.saldo) < 0 ? C.outC : C.ink)[0], (num(o.saldo) < 0 ? C.outC : C.ink)[1], (num(o.saldo) < 0 ? C.outC : C.ink)[2]);
      doc.text("saldo " + moeda(o.saldo), 210 - L - 3, y, { align: "right" });
      y += 8;
    }

    /* cabeçalho da tabela (repete em cada página nova) */
    function cabecalhoTabela() {
      doc.setFillColor(C.brand[0], C.brand[1], C.brand[2]);
      doc.rect(L, y, W, 7, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      COLS.forEach((c) => {
        doc.text(c.rot, L + c.x + (c.dir ? c.w - 2 : 2), y + 4.7, {
          align: c.dir ? "right" : "left"
        });
      });
      y += 7;
    }

    /* ============ FATURAS DOS CARTÕES ============ */
    const faturas = Array.isArray(o.faturas) ? o.faturas.filter((f) => f) : [];
    if (faturas.length) {
      y += 6;
      titulo("Faturas dos cartões");
      faturas.forEach((f, i) => {
        garante(9);
        faixa(i, 9);
        let rot = f.nome || "Cartão";
        if (num(f.outros) > 0) rot += " — de terceiros " + moeda(f.outros);
        esquerda(y + 6, curto(rot, 112, doc, 9.5), false, C.ink, 9.5);
        direita(y + 6, moeda(f.total), true, num(f.total) > 0 ? C.outC : C.ink2, 9.5);
        y += 9;
      });
      const somaFat = faturas.reduce((s, f) => s + num(f.total), 0);
      garante(22);
      y += 2;
      regua();
      y += 6;
      esquerda(y, "Total das faturas", true, C.ink, 9.5);
      direita(y, moeda(somaFat), true, C.outC, 9.5);
      y += 8;
      if (num(o.parcelado) > 0) {
        garante(8);
        esquerda(
          y,
          "Compras parceladas no mês: " + moeda(o.parcelado) +
            (num(o.parceladoN) > 0 ? " (" + num(o.parceladoN) + " compras)" : ""),
          false,
          C.ink2,
          9
        );
        y += 7;
      }
    } else if (num(o.parcelado) > 0) {
      y += 6;
      titulo("Compras parceladas no mês");
      garante(9);
      esquerda(y, moeda(o.parcelado), true, C.outC, 10);
      y += 8;
      garante(8);
      esquerda(y, num(o.parceladoN) > 0 ? num(o.parceladoN) + " compras parceladas" : "", false, C.ink2, 9);
      y += 7;
    }

    /* ============ GASTOS DE TERCEIROS ============ */
    const pessoas = Array.isArray(o.terceiros) ? o.terceiros.filter((p) => p) : [];
    if (pessoas.length) {
      y += 6;
      titulo("Gastos de terceiros" + (o.mesLabel ? " — " + o.mesLabel : ""));
      pessoas.forEach((p, i) => {
        garante(9);
        faixa(i, 9);
        let rot = p.pessoa || "Sem nome";
        if (num(p.cartao) > 0) rot += " — no seu cartão " + moeda(p.cartao);
        esquerda(y + 6, curto(rot, 112, doc, 9.5), false, C.ink, 9.5);
        direita(y + 6, moeda(p.total), true, C.ink, 9.5);
        y += 9;
      });
      const somaTd = pessoas.reduce((s, p) => s + num(p.total), 0);
      garante(24);
      y += 2;
      regua();
      y += 6;
      esquerda(y, "Total de terceiros", true, C.ink, 9.5);
      direita(y, moeda(somaTd), true, C.ink, 9.5);
      y += 8;
      if (num(o.tdAbrir) > 0) {
        garante(8);
        esquerda(y, "A receber: " + moeda(o.tdAbrir), true, C.inC, 9.5);
        y += 7;
      }
    }

    /* ============ RODAPÉ EM TODAS AS PÁGINAS ============ */
    const paginas = doc.internal.getNumberOfPages();
    for (let p = 1; p <= paginas; p++) {
      doc.setPage(p);
      doc.setDrawColor(C.line[0], C.line[1], C.line[2]);
      doc.setLineWidth(0.4);
      doc.line(L, 272, 210 - L, 272);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(C.ink2[0], C.ink2[1], C.ink2[2]);
      doc.text(
        "Gerado por Minha Vida Financeira" + (o.versao ? " v" + o.versao : "") +
          " — página " + p + " de " + paginas +
          " — seus dados nunca saem do seu aparelho.",
        105,
        278,
        { align: "center" }
      );
    }

    return doc;
  }

  window.RelatorioPDF = { gerar: gerar, moeda: moeda, carregar: carregar };
})();
