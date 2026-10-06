# 💸 Minha Vida Financeira

Aplicativo (PWA) para controlar sua vida financeira no celular:
entradas, saídas, **cartões de crédito** e **gastos de terceiros no seu cartão**.

---

## Estrutura (tudo na raiz — facilita o upload)

```
PLANILHA_DE_GASTOS/
├── index.html            # estrutura das telas
├── styles.css            # visual (mobile-first)
├── store.js              # camada de DADOS (local hoje, nuvem amanhã)
├── app.js                # telas, formulários e cálculos
├── manifest.webmanifest  # torna instalável (PWA)
├── sw.js                 # cache offline
├── icon.svg              # ícone do app
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

> Dica: dentro do app, vá em **⚙️ Ajustes → 📲 Instalar no celular**
> para ver esse passo a passo de novo.

### Atualizar o app depois

1. Antes de publicar, **suba a versão** nos dois arquivos (mesmo número):
   - `app.js` → `APP_VERSION = "1.1.0"` e `BUILD_DATE = "06/10/2026"`
   - `sw.js` → `const VERSION = "1.1.0"`
2. Repita o passo 2 (arrastar os arquivos novos → Commit changes).
   Em ~1 minuto o site atualiza.
3. No celular, feche e abra o app (ou toque em **🔄 Verificar atualização**
   nos Ajustes) para pegar a versão nova.

O número da versão aparece no topo do Painel (`.v1.1.0`) e no fim dos
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
| 🏠 Painel | **Caixa acumulado** (saldo que veio do mês anterior + mês atual), entradas × saídas, faturas, a receber |
| 🧾 Lançamentos | Entrada/saída, categorias, contas, filtro por mês e por tipo |
| 💳 Cartões | Fatura do mês, limite usado/disponível, fechamento, vencimento, próximas faturas |
| 🔢 Parcelamento | Compra parcelada vira um lançamento por mês (1/3, 2/3...) |
| 👥 Terceiros | Quem comprou **com o seu cartão**, quanto, e se já devolveu |
| 📊 Relatórios | Gráfico de 6 meses, ranking de categorias, médias |
| ⚙️ Ajustes | Categorias próprias, **backup exportar/importar (.json)**, saldo inicial, verificar atualização |
| 📲 Instalação | Botão de instalar + funciona offline |

### A regra de ouro dos "terceiros"

Quando alguém compra **usando o seu cartão**, registre em **Terceiros**:

- o valor **entra na fatura** do cartão (o banco cobra de qualquer forma);
- o valor **não conta no seu gasto pessoal** (seu saldo fica limpo);
- fica registrado **quanto falta receber** e de quem.

### Onde ficam os dados

Neste aparelho, no `localStorage` do navegador — ninguém mais acessa.
Por isso: **⚙️ Ajustes → Exportar backup** de vez em quando.

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

## Próximas fases

- **Fase 2 — Nuvem com login:** Supabase (autenticação + banco) para sincronizar
  entre dispositivos. A camada `store.js` já está isolada: só `persist()` e
  `Store.init()` mudam — o resto do app não mexe.
- **Fase 3 — Ajustes finos:** metas por categoria, lembrete de vencimento,
  recorrências fixas (aluguel/assinaturas).
- **Fase 4 — Polimento:** ícone PNG 512×512 e sombras/bordas por aparelho.
