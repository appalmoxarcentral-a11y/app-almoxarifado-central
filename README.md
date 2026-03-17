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

---
*Desenvolvido com foco em eficiência, clareza e escalabilidade.*
