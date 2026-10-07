# 💸 Minha Vida Financeira

Aplicativo (PWA) para controlar sua vida financeira no celular:
entradas, saídas, **cartões de crédito** e **gastos de terceiros no seu cartão**.

---

## Estrutura (tudo na raiz — facilita o upload)

```
PLANILHA_DE_GASTOS/
├── index.html            # estrutura das telas
├── styles.css            # visual (mobile-first)
├── store.js              # camada de DADOS + login/sincronização (nuvem)
├── app.js                # telas, formulários e cálculos
├── manifest.webmanifest  # torna instalável (PWA)
├── sw.js                 # cache offline
├── icon.svg              # ícone do app
├── privacidade.html      # política de privacidade (link na tela de login)
└── README.md             # este arquivo
```

> A pasta `js/` é antiga e **não deve ser subida** para o GitHub.

---

## 🚀 Publicar no GitHub Pages (passo a passo completo)

Você vai precisar criar uma conta gratuita no GitHub (se ainda não tem).

### 1. Criar a conta e o repositório

1. Acesse <https://github.com> → **Sign up** (pode usar seu e-mail).
2. Depois de logado, clique no **＋** no canto superior direito → **New repository**.
3. **Repository name:** `financas-app` (pode ser esse nome).
4. Marque **Public** (obrigatório para o Pages gratuito).
5. Clique em **Create repository**.

### 2. Enviar os arquivos

1. Na página do repositório, clique em **adding an existing file**
   (ou *Add file* → *Upload files*).
2. **Arraste todos os 8 arquivos** da pasta `PLANILHA_DE_GASTOS`
   (os da raiz, **não** a pasta `js/`).
3. Clique em **Commit changes** → de novo em **Commit changes**.

### 3. Ligar o GitHub Pages

1. Na página do repositório, clique na aba **Settings** (engrenagem).
2. No menu da esquerda, clique em **Pages**.
3. Em **Build and deployment → Source**, escolha **Deploy from a branch**.
4. Em **Branch**, escolha `main` / `master` e a pasta `/ (root)` → **Save**.
5. Aguarde ~1 minuto e recarregue a página.

### 4. Descobrir o endereço do app

O endereço será:

```
https://SEU-USUARIO.github.io/financas-app/
```

(Seu nome de usuário aparece no canto superior direito do GitHub.)
Abra esse endereço no **PC primeiro** para conferir que carregou.

### 5. Instalar no celular

1. Abra o endereço no **Chrome (Android)** ou **Safari (iPhone)** do celular.
2. **Android:** menu ⋮ → *Instalar app* / *Adicionar à tela inicial*.
   **iPhone:** botão compartilhar → *Adicionar à Tela de Início*.
3. Pronto: ícone na tela, tela cheia e **funciona offline**.

> **Não existe APK nem Play Store.** É um app web instalado pelo navegador
> (PWA) — o ícone é só um atalho para o site. Por isso **atualizar é automático**:
> você nunca mais precisa instalar nada de novo.

> Dica: dentro do app, vá em **⚙️ Ajustes → 📲 Instalar no celular**
> para ver esse passo a passo de novo.

### Atualizar o app depois

1. Antes de publicar, **suba a versão** nos dois arquivos (mesmo número):
   - `app.js` → `APP_VERSION = "1.5.1"` e `BUILD_DATE = "06/10/2026"`
   - `sw.js` → `const VERSION = "1.5.1"`
2. Repita o passo 2 (arrastar os arquivos novos → Commit changes).
   Em ~1 minuto o site atualiza.
3. No celular, feche e abra o app (ou toque em **🔄 Verificar atualização**
   nos Ajustes) para pegar a versão nova.

O número da versão aparece no topo do Painel (`.v1.5.1`) e no fim dos
**Ajustes**. Quando sair versão nova, uma faixa "⬆️ Nova versão disponível"
aparece sozinha no rodapé do app.

---

## 🖥️ Alternativa: testar sem publicar (servidor local)

```bash
# opção 1 — Node.js
npx serve .

# opção 2 — Python
python -m http.server 8080
```

Abra `http://localhost:8080` no PC. Pelo celular (mesma rede Wi-Fi):
`http://SEU_IP:8080` (descubra o IP com `ipconfig` no Windows).

---

## O que já está pronto (Fase 1 — MVP)

| Recurso | Descrição |
|---|---|
| 🏠 Painel | **Caixa acumulado** (saldo que veio do mês anterior + mês atual), entradas × saídas, faturas, a receber, **comparativo com o mês anterior (gastei X% a mais/a menos)** |
| 💰 Contas | **Saldo separado por conta** (Conta, Cofrinho, Dinheiro...) + 💸 transferência e 📈 rendimento — a soma das contas é o Caixa do Painel |
| 🧾 Lançamentos | Entrada/saída, categorias, contas, filtro por mês e por tipo, **🔍 busca em todos os meses**, **agrupar por dia 📅 ou por categoria 🏷️ (com total)** |
| 💳 Cartões | Fatura do mês, limite usado/disponível, fechamento, vencimento, próximas faturas |
| 🔢 Parcelamento | Compra parcelada vira um lançamento por mês (1/3, 2/3...) — o seletor **Valor total / Valor da parcela** divide o preço para você, e o campo **"Já paguei"** cria só as parcelas restantes, rotuladas **4/12 … 12/12** |
| 📈 Onde entrou o dinheiro | Ranking das **entradas** por categoria com % do total — é ali que aparece quanto rendeu o cofrinho |
| 👥 Terceiros | **Menu de visão 📅 mês · 📊 resumo geral · 👤 por pessoa**, **filtro por pessoa no mês**, **✅ marcar todos como devolvidos de uma vez (com ↩ desfazer)**, filtro por mês (‹ ›), quem comprou **com o seu cartão**, **parcelado (n/total + já paguei)**, quanto, e se já devolveu |
| 📊 Relatórios | Gráfico de 6 meses, ranking de categorias, médias, **filtro por categoria (com detalhe mês a mês)** e **⚖️ comparação de dois meses lado a lado** |
| 🎯 Orçamento | **Limite por categoria no mês** (ex.: R$ 800 no mercado) com barra de progresso e **aviso quando chega perto ou estoura** |
| 🔁 Contas fixas | Aluguel, luz, internet, assinaturas **e também entradas** (salário, rendimento): cadastro uma vez e o app **lança sozinho todo mês**, no dia marcado + lembrete de vencimento de fatura |
| 🔒 Bloqueio | **PIN de 4 a 6 dígitos** para abrir o app (+ digital/rosto quando o aparelho tem), código de recuperação e "Bloquear agora" |
| 🔐 Exclusão segura | **↩ Desfazer** em toda exclusão + escolha entre **só esta parcela** ou **a compra inteira** |
| 🔔 Avisos | Notificação no celular quando a **fatura está para vencer (3 dias)** + aviso de teste (⚙️ Ajustes) |
| ⚙️ Ajustes | **Contas (nome, saldo inicial, nova conta)**, categorias próprias, **📐 tamanho da tela (barra deslizante 80–150%)**, **📱 compartilhar (QR Code + link)**, **🔔 avisos de vencimento**, **backup exportar/importar (.json)**, bloqueio, verificar atualização |
| 📲 Instalação | Botão de instalar + funciona offline |

### A regra de ouro dos "terceiros"

Quando alguém compra **usando o seu cartão**, registre em **Terceiros**:

- o valor **entra na fatura** do cartão (o banco cobra de qualquer forma);
- o valor **não conta no seu gasto pessoal** (seu saldo fica limpo);
- fica registrado **quanto falta receber** e de quem.

**Parcelado (v1.6.4)**: em Terceiros dá para escolher **Cartão usado**,
**Parcelas** e **Já paguei** — a mesma regra dos lançamentos. Cada parcela vira
um registro no mês dela, e a lista mostra **n/total** e o **total da compra**
ao lado do valor da parcela.

### Onde ficam os dados

Em **dois lugares ao mesmo tempo**: uma cópia no `localStorage` do aparelho
(para funcionar sem internet) e a mesma cópia na **nuvem**, ligada ao seu login.
Cada conta vê **apenas os próprios dados** — quem entra com outra conta não vê
nada seu.

O backup por arquivo continua valendo (⚙️ Ajustes → Exportar backup): é a sua
cópia independente, para guardar onde quiser.

### 💾 Backup: exportar e importar

**Exportar (fazer o backup)** — ⚙️ Ajustes → 📤 **Exportar**:

- no celular abre a folha do Android: mande o arquivo para **Google Drive,
  WhatsApp, E-mail ou Arquivos do aparelho**;
- no PC ele é baixado como `backup-financas-AAAA-MM-DD.json`;
- guarde em **dois lugares** (nuvem + PC, por exemplo).

**Importar (restaurar)** — ⚙️ Ajustes → 📥 **Importar** e escolha o arquivo.
É o que você faz ao **trocar de celular** ou depois de apagar os dados.

Como o app se protege:

- o cartão de backup mostra **quantos lançamentos, cartões e pessoas** existem e
  **quando foi o último export** (fica laranja se passar de 7 dias);
- se fizer 7 dias sem exportar, aparece **um aviso por dia** — só avisar;
- importar **substitui** os dados do aparelho: a confirmação mostra os números
  antes, e o conselho é exportar primeiro (assim nada se perde);
- arquivos que não sejam backup deste app são **recusados** — não dá para
  importar um arquivo errado sem querer.

---

## ☁️ Novidades da v1.6.0 — conta na nuvem

### Login obrigatório

Ao abrir o app pela primeira vez aparece a **tela de entrada**:

- **Entrar com Google** (o caminho mais rápido);
- ou **e-mail + senha** (dá para criar a conta na hora, com 6+ caracteres).

Sem entrar não abre — é isso que garante que **cada pessoa enxerga apenas os
próprios dados**. O e-mail fica guardado no aparelho; a senha nunca é guardada.

### 🔄 Sincronização automática

Tudo o que você lança é salvo **no aparelho e na nuvem** ao mesmo tempo:

- **sem internet** o app continua normalmente e avisa *"Sem internet — salvo
  neste aparelho"*;
- quando a conexão volta, ele sincroniza sozinho;
- em **⚙️ Ajustes → 👤 Conta na nuvem** ficam o seu e-mail, o status
  (*Sincronizado ✓*), o botão **🔄 Sincronizar** e o **Sair da conta**.

### Primeira entrada com dados antigos

Se o aparelho já tinha dados (versões anteriores), na primeira abertura da sua
conta aparece:

> **Importar o que já estava aqui?**
> Encontramos neste aparelho X lançamento(s), Y cartão(ões) e Z registro(s) de
> terceiros. Quer começar a usar com eles?

**Importar** traz tudo e já sincroniza; **Cancelar** começa do zero.

### Perguntas frequentes

- **Esqueci a senha / perdi o celular?** Entre com o Google ou crie um novo
  acesso com o mesmo e-mail — os dados estão na nuvem e voltam sozinhos.
- **Dá para usar no celular e no PC?** Sim: entre com a mesma conta nos dois.
- **Quer apagar tudo?** ⚙️ Ajustes → Apagar todos os dados (some do aparelho e
  da nuvem na próxima sincronização).
- **Privacidade:** o texto que aparece na tela de consentimento do Google está
  em `privacidade.html`.

---

## 🏦🐷 Novidades da v1.5.0 — saldo por conta

### Cada conta tem o seu saldo

**⚙️ Ajustes → 💰 Contas**: renomeie, edite o **saldo inicial** de cada uma e crie
quantas quiser (ex.: 🐷 Cofrinho, 🏦 Conta, 💵 Dinheiro, 📈 Poupança). No **Painel**,
logo abaixo do Caixa, aparece o saldo de cada conta e o **Total** — a soma delas é
sempre igual ao Caixa do mês.

> **Regra de ouro:** transferir dinheiro **não é gasto** (só muda de lugar);
> rendimento **é entrada** (dinheiro novo).

### 💸 Transferir e 📈 Registrar rendimento

Painel → **💰 Contas → 💸 transferir** abre a folha com dois modos:

- **💸 Transferir** — sai de uma conta e entra em outra; o Caixa total **não muda**
  (aparece a última movimentação embaixo das contas);
- **📈 Rendimento** — cria uma **entrada** na categoria 📈 Rendimentos: o saldo da
  conta **e** o Caixa sobem juntos. É como registrar quanto o cofrinho rendeu.

### 💳 Cartão: de qual conta sai o dinheiro

No cadastro do cartão existe o campo **Conta que paga**: as compras daquele cartão
descontam do saldo dessa conta no mês de cada parcela — assim o saldo da sua
bancária nunca mente.

### Migração automática (ao atualizar)

O "Saldo inicial" único das versões antigas virou saldo de uma conta: **o total do
caixa não muda**. Backups antigos importam normalmente (o app separa sozinho).

---

## 📈 Novidades da v1.4.0

### Compra parcelada antiga — campo **"Já paguei"**

Quando o destino é **cartão** e você escolhe mais de 1 parcela, aparece o campo
**Já paguei**. Ele serve para compra antiga: 12x com 3 pagas → o app **cria só
da 4/12 até a 12/12** (os meses quitados não viram lançamento e nada fica
vermelho no histórico).

### 💲 Valor total ou valor da parcela (v1.6.1)

Escolhendo **mais de 1x** no cartão aparece um seletor logo abaixo do campo de
parcelas, com dois modos:

- **Valor total** *(padrão)*: digite o preço da compra inteira. A prévia mostra
  **12x de R$ 100,00 = R$ 1.200,00** enquanto você digita, e o app divide sozinho
  — até quando não divide certo: R$ 350,00 em 12x vira **8x de R$ 29,17 e 4x de
  R$ 29,16** (o total bate certinho);
- **Valor da parcela**: digite o valor de cada mês, como antes — a prévia mostra
  **Total da compra: R$ 600,00** para 6x de R$ 100.

O rótulo do campo muda junto (**"Valor total da compra"** / **"Valor da
parcela"**), então dá para conferir antes de tocar em Adicionar.

### 👥 Terceiros parcelado e total + parcela nas duas listas (v1.6.4)

- **Terceiros** ganhou o mesmo bloco dos lançamentos: **Parcelas** (só aparece
  ao escolher o cartão), seletor **Valor total / Valor da parcela** com prévia e
  **Já paguei**. O registro avulso continua sendo o jeito de comprar à vista.
- Quem comprou em 10x com 5 pagas gera **5 registros** (6/10 até 10/10) — e o
  campo **TOTAL A RECEBER DE TERCEIROS** soma o que ainda está em aberto.
- **Nas duas listas** (Lançamentos e Terceiros) a linha agora traz os dois
  valores: o **valor da parcela** em destaque + a pílula **n/total** + a pílula
  **total R$ …** com o preço da compra inteira (ex.: `183,33 · 6/12 ·
  total R$ 2.200,00`).
- Ao **editar** uma parcela aparece `Valor da parcela R$ 80,00 · total da
  compra R$ 800,00` — dá para conferir os dois valores sem voltar à lista.
- **Próximas faturas** do cartão agora incluem as parcelas de terceiros também
  (o banco cobra tudo, independentemente de quem gastou).

### 📅 Terceiros separado por mês (v1.6.5)

A tela de **Terceiros** ganhou a mesma navegação de mês dos **Lançamentos**
(`‹ Outubro 2026 ›`) no cabeçalho:

- a lista mostra **só as compras daquele mês** — no parcelado, cada mês traz a
  parcela da vez (em janeiro aparece a `9/10`, em fevereiro a `10/10`);
- o cartão de topo passa a mostrar **"A receber em outubro 2026"** com o valor
  do mês, os lançamentos em aberto e o que já foi devolvido **naquele mês**;
- logo abaixo, a linha **"Total em aberto (todos os meses)"** mantém o valor
  global de quem ainda te deve (aparece só quando difere do mês);
- os filtros **Em aberto / Devolvidos / Todos** também valem para o mês
  selecionado, e o mês vazio avisa `Nenhuma dívida em aberto em março 2027`;
- o **＋** virou o mesmo botão flutuante dos Lançamentos (canto inferior
  direito), deixando o cabeçalho idêntico ao da outra tela.

### 🍔 Menu de visão nos Terceiros + tamanho da tela ajustável (v1.6.6)

Logo abaixo do cabeçalho de **Terceiros** agora há um menu **"Ver"** com três
jeitos de olhar os mesmos dados:

- **📅 Compras do mês** — o comportamento da v1.6.5 (padrão);
- **📊 Resumo geral · todos os valores** — junta **tudo** em um cartão só
  (Total geral · A receber · Devolvido · `N compra(s) · M pessoa(s)`) e lista
  **uma linha por pessoa** com a soma das compras dela e o que ela ainda te
  deve; tocar na pessoa abre a visão dela;
- **👤 Nome da pessoa** — todas as compras daquela pessoa **de todos os
  meses**, com o **valor total** no cartão (A receber / Devolvido / `N
  compra(s)`) e os mesmos filtros Em aberto / Devolvidos / Todos.

A navegação de mês some nessas duas últimas visões (valem todos os meses).

**⚙️ Ajustes → 📐 Tamanho da tela**: barra deslizante de **80% a 150%** que
deixa o aplicativo inteiro maior ou menor **naquele aparelho** (ajuste por
celular, guardado no próprio telefone) + botão **Voltar ao padrão (100%)**.
Serve para adaptar o app a celulares de tamanhos diferentes e ao gosto de cada
um.

Também nessa versão: **migração dos registros antigos de terceiros**
(campos `who/desc/value` viram `person/note/amount`), eliminando um
`R$ NaN` que aparecia em listas criadas em versões muito antigas.

### 🔐 Segurança + 🔍 busca + 🔔 avisos (v1.7.0)

- **Esqueci minha senha** — link novo na tela de login (abaixo de "Criar
  conta"). Digite o e-mail, toque no link e o Supabase manda um e-mail com o
  link para criar outra senha. Quem não lembra do acesso por e-mail não fica
  preso só ao Google.
- **↩ Desfazer em toda exclusão** — ao excluir um lançamento ou um registro de
  terceiro aparece um aviso com o botão **Desfazer** (6 segundos) que recoloca
  o registro exatamente como estava.
- **Só esta parcela ou a compra inteira** — ao excluir uma parcela o app pergunta:
  **Só esta** (as demais continuam) ou **Compra inteira** (todas as parcelas,
  total incluído) — sem apagar sem querer 10 lançamentos de uma vez.
- **🔍 Busca nos lançamentos** — campo de busca no topo da lista que procura
  em **todos os meses** por descrição, categoria, conta/cartão e valor; mostra
  a data cheia em cada resultado e tem o **×** para limpar.
- **Pessoa na visão por mês de Terceiros** — se houver mais de uma pessoa,
  aparece o seletor **Pessoa (👥 Todas / 👤 Fulano)** logo abaixo do menu de
  visão: filtra a lista **e o cartão "A receber"** do mês escolhido.
- **🔔 Avisos de vencimento (novo em Ajustes)** — botão **"Ativar avisos"**
  pede a permissão do navegador; a partir daí, quando uma fatura estiver para
  vencer (3 dias), o celular recebe uma **notificação na barra** (mesmo com o
  app minimizado) além do aviso interno. Tem **aviso de teste** para conferir.
  Limite honesto: sem servidor de push, o aviso depende do app estar aberto
  ou instalado — não é igual a notificação de banco.

### ⚡ Comparativos, agrupamento e QR Code (v1.8.0 · v1.8.1)

- **Comparativo no Painel** — o cartão do Caixa agora mostra a linha
  **"👇 Gastos 12% a menos que em setembro · R$ 304,25 vs R$ 346,00"**
  (verde quando gastou menos, vermelho quando gastou mais). Comparação
  automática com o mês anterior.
- **⚖️ Comparar dois meses lado a lado (Relatórios)** — escolha na lista
  "Comparar outubro com…" um dos últimos 12 meses e veja as duas colunas
  (entradas · saídas · saldo) com a diferença logo abaixo.
- **Filtro por categoria nos Relatórios** — seletor **Categoria** acima de
  "Onde foi o dinheiro": o ranking mostra só aquela categoria e abre um
  **detalhe** com gasto do mês, média de 6 meses, maior mês, gráfico
  mês a mês e a lista dos gastos dela no mês.
- **🏷️ Agrupar lançamentos por categoria** — botões **📅 Por dia / 🏷️ Por
  categoria** abaixo dos filtros: em vez de dias, vira um grupo por categoria
  já com o total (Maior valor primeiro). Volta para "por dia" quando quiser.
- **✅ Marcar todos como devolvidos (Terceiros)** — botão novo embaixo dos
  chips: marca **todos os registros em aberto do mês** (ou de uma pessoa)
  como "Já devolvido" de uma vez, com confirmação e **↩ Desfazer**.
- **📱 Compartilhar o app (novo em ⚙️ Ajustes)** — mostra o **QR Code** do
  aplicativo + o link, com botões **📤 Compartilhar** (abre o WhatsApp etc.
  no celular) e **📋 Copiar link**. É o jeito mais rápido de instalar em
  outro aparelho: aponta a câmera e pronto.
- **Correções (v1.8.1)** — categoria com **R$ 0,00** no período agora aceita
  ser escolhida no filtro dos Relatórios (antes voltava para "Todas"), e a
  cópia do link tem um método de reserva quando a área de transferência
  moderna é bloqueada pelo navegador.

**Como ficar com o caixa certo** — regra única do app:

> Caixa = Saldo inicial + (todas as entradas − todas as saídas), de qualquer data.

- **Caminho simples (recomendado):** ⚙️ Ajustes → Saldo inicial = o dinheiro que
  você tem **hoje**; lance a compra com **data de hoje** e as parcelas
  **restantes**. O passado fica vazio e o caixa bate com a realidade.
- **Caminho histórico:** só se você refizer também os 3 meses anteriores
  (entradas e saídas). Se lançar as parcelas de trás **sem** refazer os meses,
  o caixa é descontado duas vezes e fica baixo demais.

### 📈 Onde entrou o dinheiro (Relatórios)

Novo bloco em **Relatórios** com as entradas do mês por categoria e o %
do total: `📈 Rendimentos · R$ 87,30 · 4%` — é o jeito de ver quanto o
cofrinho rendeu sem somar na mão.

### 🔁 Contas fixas também para entrada

**Lançamentos → 🔁 Contas fixas** agora tem o seletor **↓ Saída / ↑ Entrada**:
salário e rendimento fixo podem ser criados sozinhos todo mês, no dia escolhido.

### Cofrinho (Itaú Cofrinho / Nubank Caixinha) — o que lançar

- ❌ **Não lance** aplicação nem resgate: mover dinheiro para o cofrinho não é
  gasto, o dinheiro continua seu (o app tem um caixa só);
- ✅ **Lance só o rendimento como entrada**, categoria **📈 Rendimentos**, no mês
  em que o banco creditar — ele aparece em Entradas e no ranking acima.

---

## 🎯🔁🔒 Os três recursos da v1.3.0

### 🎯 Orçamento por categoria

**Relatórios → 🎯 limites**: defina um valor máximo por categoria
(ex.: R$ 800 no mercado). Durante o mês aparece uma barra de progresso:

- 🟢 **até 79%** — tranquilo;
- 🟡 **80% ou mais** — o app avisa quando você lançar algo: *"Alimentação já
  usou 95% do limite"*;
- 🔴 **estourou** — aviso na hora do lançamento e no relatório
  *"Estourou Alimentação: R$ 1.050 de R$ 1.000"*.

Categorias sem limite não são controladas (basta deixar em branco).

### 🔁 Contas fixas (aluguel, luz, internet, assinaturas)

Em **Lançamentos → 🔁 Contas fixas**, cadastre uma vez: valor, dia do mês,
categoria e com o que você paga. A partir daí o app **cria o lançamento
sozinho** no dia marcado — inclusive para os meses que já passaram desde o
cadastro. Na primeira abertura do mês aparece um aviso dizendo o que foi
lançado.

Também aparece **um lembrete de vencimento de fatura** — uma vez por mês, no
dia em que faltam 3 dias ou menos para o vencimento de algum cartão.

### 🔒 Bloqueio com PIN

**⚙️ Ajustes → 🔒 Bloqueio do app**: crie um PIN de 4 a 6 números. O app passa
a pedir esse PIN toda vez que abrir.

- ao ativar, aparece um **código de recuperação** (ex.: `K7M2Q9`) — anote em
  lugar seguro, é ele que te faz entrar se esquecer o PIN;
- se o aparelho tiver digital/rosto (como o Galaxy S20 FE), o botão
  **🔓 Abrir com digital/rosto** aparece sozinho nos Ajustes;
- **Bloquear agora** trava na hora; o app também trava sozinho se ficar mais
  de 1 minuto em segundo plano;
- o PIN é guardado só como código ilegível (hash) — nem ele mesmo consegue ser
  recuperado, por isso o código de recuperação.

---


- ~~**Fase 3 — Ajustes finos:** metas por categoria, lembrete de vencimento,
  recorrências fixas (aluguel/assinaturas).~~ ✅ **Feito na v1.3.0**
  (orçamento por categoria, contas fixas, lembrete de fatura e bloqueio por PIN).
- ~~**Fase 2 — Nuvem com login:** Supabase (autenticação + banco) para sincronizar
  entre dispositivos. A camada `store.js` já está isolada: só `persist()` e
  `Store.init()` mudam — o resto do app não mexe.~~ ✅ **Feito na v1.6.0**
- ~~**Fase 4 (início):** saldo por conta (Pix/poupança/cofrinho).~~ ✅ **Feito na
  v1.5.0** (contas com saldo próprio, transferência e rendimento).
- **Fase 4 — Polimento:** ícone PNG 512×512,
  busca de lançamentos, importar extrato do banco (.OFX).
