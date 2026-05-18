# UBSF Stock Guardian 🛡️

Sistema robusto de gestão de estoque e dispensação para Unidades Básicas de Saúde da Família (UBSF).

## 🚀 Tecnologias Utilizadas

- **Frontend**: React + TypeScript + Vite
- **UI/UX**: Tailwind CSS + shadcn/ui
- **Backend/Database**: Supabase (PostgreSQL, Auth, RLS)
- **Integração**: n8n (Webhooks para pagamentos)

## 🛠️ Configuração Local

1. **Clone o repositório**:
   ```bash
   git clone <URL_DO_REPOSITORIO>
   cd ubsf-stock-guardian-27
   ```

2. **Instale as dependências**:
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente**:
   Crie um arquivo `.env` na raiz do projeto baseado no `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Preencha com suas credenciais do Supabase e n8n.

4. **Inicie o servidor de desenvolvimento**:
   ```bash
   npm run dev
   ```

## 🌐 Deploy na Vercel

Siga os passos abaixo para hospedar o projeto na Vercel:

1. **Conectar Repositório**:
   - No dashboard da [Vercel](https://vercel.com/dashboard), clique em **"Add New..."** -> **"Project"**.
   - Importe este repositório.

2. **Configurações de Build**:
   - **Framework Preset**: Vite (detectado automaticamente).
   - **Build Command**: `npm run build`.
   - **Output Directory**: `dist`.

3. **Variáveis de Ambiente**:
   Adicione as seguintes chaves em **Environment Variables**:

   | Chave | Descrição |
   | :--- | :--- |
   | `VITE_SUPABASE_URL` | URL do projeto Supabase |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon Key do Supabase |
   | `VITE_N8N_WEBHOOK_URL` | URL do Webhook do n8n para pagamentos |

4. **Finalizar**:
   - Clique em **Deploy**. A Vercel cuidará do restante.

## ⚙️ Notas Adicionais

- O arquivo `vercel.json` está configurado para suportar Single Page Application (SPA).
- O banco de dados utiliza **Row Level Security (RLS)** para isolamento de dados entre unidades de saúde (Multi-tenancy).

## 📋 Regra De Negocio Da Tela De Pedidos

- A organizacao descrita abaixo vale apenas para a tela principal de `Pedidos`.
- O modal de selecao de lotes nao deve reutilizar essa mesma ordenacao.
- Produtos com `prioridade` `1`, `2` e `3` devem aparecer no topo da lista.
- Dentro do bloco prioritario, a ordenacao deve seguir primeiro um ciclo fixo:
  - primeiro todos os itens com `Qtd. Reposicao > 0`
  - depois itens com `Unid Destino > 0`
  - depois itens com `Unid Origem > 0`
  - em seguida reinicia o ciclo com os itens `= 0`:
  - `Qtd. Reposicao = 0`
  - `Unid Destino = 0`
  - `Unid Origem = 0`
  - por fim reinicia o ciclo com os itens `< 0`:
  - `Qtd. Reposicao < 0`
  - `Unid Destino < 0`
  - `Unid Origem < 0`
- Se dois itens estiverem na mesma etapa do ciclo, usar a prioridade como desempate: `1`, depois `2`, depois `3`.
- Dentro de cada etapa do ciclo da mesma prioridade, os produtos devem ser organizados em ordem alfabetica de `A` a `Z`, usando a descricao.
- Produtos fora das prioridades `1` a `3` permanecem abaixo do bloco prioritario, tambem em ordem alfabetica de `A` a `Z`.

---
*Desenvolvido com foco em eficiência, clareza e escalabilidade.*
