# 🧪 testes — ferramentas de desenvolvedor

Nada daqui aparece no app nem afeta quem usa. São os bancos de teste que
dão para abrir no navegador para conferir que uma mudança não quebrou
outra coisa.

> ⚠️ **Nunca rode isto logado na sua conta de verdade.** Use uma conta de
> teste — é para isso que ela existe. As páginas aqui escondem a sessão
> automaticamente antes de mexer em qualquer coisa, mas o hábito de usar
> conta de teste vale mais.

---

## 🌱 `banco-teste.js` — a carteira de demonstração

Um script que monta uma carteira **completa e realista** dentro da conta
logada: 3 contas, 3 cartões (crédito, VR/VA e empréstimo), 101
lançamentos de 5 meses, 22 parcelados, 9 terceiros e 2 transferências.

**Como usar (3 passos):**

1. Abra o app e entre com **conta de teste**.
2. Abra o console do navegador (**F12 → aba Console**), cole o conteúdo
   de `banco-teste.js` **inteiro** e aperte **Enter**.
3. Recarregue a página: a carteira aparece pronta.

> ⚠️ Ele **zera** lançamentos, cartões, terceiros, transferências e
> contas da conta logada e monta a carteira do zero. É de propósito —
> assim o banco de teste fica igualzinho toda vez. As categorias não são
> tocadas.

**Para que serve:** testar qualquer função do app sem medo de apagar
lançamento de verdade. O mês de **outubro de 2026** é o mais completo —
use-o para ver as faturas, as parcelas (`5/12`) e os terceiros no PDF.

---

## 📥 `_teste_importacao.html` — backups de versões antigas

Abra `http://localhost:8765/testes/_teste_importacao.html` (com o
servidor local ligado) e clique em **"Rodar o teste"**.

Confere que um backup exportado numa versão antiga ainda é importado
certo na atual. Passa por **3 formatos históricos** reais:

| Arquivo | De quando | O que exercita |
|---|---|---|
| `backups-antigos/v1-4-0.json` | v1.4.0 | sem contas, sem cartões, campo `value`, saldo inicial em `settings` |
| `backups-antigos/v1-6-0.json` | v1.6.0 | cartões ainda sem `kind`; terceiros no esquema `who`/`desc`/`value`/`paid` |
| `backups-antigos/v1-10-0.json` | v1.10.0 | `kind` nos cartões, transferências, categorias que faltam |

Mais **4 arquivos ruins** que o app precisa recusar (JSON inválido, objeto
sem `transactions`, "não parece backup", arquivo vazio).

**Resultado esperado:** `total: 26 ok · 0 falha(s)`.

A página guarda a sua sessão, roda tudo isolado e **devolve a sessão no
fim** — não empurra nada para a nuvem e não deixa sujeira.

---

## ✔ `_teste_conciliacao.html` — conciliar com o extrato

Abra `http://localhost:8765/testes/_teste_conciliacao.html` e clique em
**"Rodar o teste"**.

Confere a marcação de lançamento como *conferido contra o extrato do
banco* (v1.13.0): marcação individual, marcação em massa, contador do
mês, isolamento entre meses, parcelas, exclusão e o que acontece quando
o backup é de uma versão antiga (o campo não existe — vira null).

**Resultado esperado:** `total: 39 ok · 0 falha(s)`.

> 📌 **Cuidado que este teste ensinou:** o `importJSON` **troca o objeto
> de dados inteiro**. Se o seu teste guardar uma referência a um
> lançamento e chamar `importJSON` depois, essa referência vira órfã —
> procure de novo por `Store.tx(id)`.

---

## 📄 `_teste_relatorio.html` — o relatório em PDF

Abra `http://localhost:8765/_teste_relatorio.html` (na raiz) e clique em
**"Gerar PDF de teste"**.

Monta um relatório com **40 lançamentos** de mentira para forçar a tabela
a virar página, e confere 19 coisas no arquivo gerado: `%PDF` no começo,
`%%EOF` no fim, mais de uma página, cada seção (tabela, faturas, total
parcelado, terceiros, "A receber") e o rodapé com número de página.

**Resultado esperado:** `falhas: 0` e um PDF de ~3 páginas.

O botão **"2ª geração"** gera de novo na mesma sessão, para conferir que
o jsPDF já carregado é reaproveitado (não baixa de novo).

> 📌 **Dica para depurar:** o navegador pode servir a página de cache e
> você acaba testando o arquivo velho. Se um teste estranhar, entre com
> `?qualquercoisa=1` na URL para forçar a versão atual.

---

## 📖 `_gera_manual.html` — o manual do usuário

Abra `http://localhost:8765/_gera_manual.html` e clique em **"Gerar o
manual em PDF"**.

Monta o `MANUAL/manual-do-app.pdf` a partir do conteúdo escrito no
próprio arquivo e dos prints da pasta `MANUAL/prints/`. Sai em ~200 ms,
com 11 páginas e 7 prints.

Para **atualizar o manual** depois de mudar o app: tire os prints novos,
salve com os mesmos nomes em `MANUAL/prints/`, ajuste o texto em
`_gera_manual.html` e gere de novo.

> ⚠️ O jsPDF só desenha o alfabeto WinAnsi — **emoji e setas** (`⚙️`,
> `↑`) saem como lixo no papel. Por isso o gerador passa todo o texto
> pela função `limpo()`, que troca `→` por `->` e remove o resto. Se for
> escrever texto novo, escreva sem emoji (ou deixe o `limpo()` tratar).

---

## O que vai para o repositório

Tudo daqui é **ferramenta de desenvolvedor**, mas vai junto — é o que
dá para reaproveitar quando for mexer no código:

| Arquivo | O que é |
|---|---|
| `banco-teste.js` | semente da carteira de demonstração |
| `backups-antigos/*.json` | 3 fixtures de formato antigo (v1.4.0, v1.6.0, v1.10.0) |
| `_teste_importacao.html` | teste de importação de backups antigos (26 verificações) |
| `_teste_conciliacao.html` | teste da conciliação com o extrato (39 verificações) |
| `_teste_relatorio.html` | teste do relatório em PDF (19 verificações) |
| `_gera_manual.html` | gerador do `MANUAL/manual-do-app.pdf` |
| `README.md` | este arquivo |

**Não vão ao repositório:** `MANUAL/manual-do-app.pdf` e
`MANUAL/prints/` (gerados e pesados), `ATUALIZAÇÕES_FUTURAS.txt`,
`.nojekyll` e `BACKUP/`.

> As páginas `_teste_*` e `_gera_manual` ficam **fora do caminho do
> app** (o service worker não as pré-carrega) e só abrem se você digitar
> o endereço — quem usa o app nunca vai tropeçar nelas.
