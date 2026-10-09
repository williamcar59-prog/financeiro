/* =====================================================================
   relatorio.js — PDF do mês (v1.11.0)
   ----------------------------------------------------------------------
   Monta um PDF de verdade, dentro do navegador, com o jsPDF (guardado
   em jspdf.umd.min.js — nada de internet, funciona offline).

   Este arquivo NÃO conhece o app: ele só recebe os números prontos e
   devolve o documento pronto. Assim dá para testar sozinho, sem tocar
   nos dados de ninguém.

   Uso (feito pelo app.js):
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

  function gerar(o) {
    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) throw new Error("jsPDF não carregado");

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const L = 18; /* margem esquerda */
    const W = 210 - L * 2; /* largura útil = 174 */
    const num = (v) => (Number(v) || 0);

    /* ---------------- topo ---------------- */
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

    /* ---------------- 4 cartões de resumo ---------------- */
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

    /* ---------------- barras: 6 meses ---------------- */
    let y = 72;
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

    /* ---------------- resumo em números ---------------- */
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

    /* ---------------- rodapé ---------------- */
    doc.setDrawColor(C.line[0], C.line[1], C.line[2]);
    doc.line(L, 272, 210 - L, 272);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(C.ink2[0], C.ink2[1], C.ink2[2]);
    doc.text(
      "Gerado por Minha Vida Financeira" + (o.versao ? " v" + o.versao : "") +
        " — seus dados nunca saem do seu aparelho.",
      105,
      278,
      { align: "center" }
    );

    return doc;
  }

  window.RelatorioPDF = { gerar: gerar, moeda: moeda };
})();
