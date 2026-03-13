# Deploy na Vercel - UBSF Stock Guardian

Este guia detalha como realizar o deploy deste projeto na Vercel e configurar as variáveis de ambiente necessárias.

## 🚀 Passo a Passo

1. **Conectar Repositório**:
   - Vá para o dashboard da [Vercel](https://vercel.com/dashboard).
   - Clique em **"Add New..."** -> **"Project"**.
   - Importe o repositório deste projeto.

2. **Configurações de Build**:
   - O Framework Preset deve ser detectado automaticamente como **Vite**.
   - **Build Command**: `npm run build` ou `bun run build`.
   - **Output Directory**: `dist`.
   - **Install Command**: `npm install` ou `bun install`.

3. **Variáveis de Ambiente**:
   No campo **Environment Variables**, adicione as seguintes chaves (conforme o seu `.env` local):

   | Chave | Valor |
   | :--- | :--- |
   | `VITE_SUPABASE_URL` | Sua URL do projeto Supabase |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Sua Anon Key do Supabase |
   | `VITE_N8N_WEBHOOK_URL` | URL do Webhook do n8n para pagamentos |

4. **Deploy**:
   - Clique em **Deploy**. A Vercel cuidará do restante.

## ⚙️ Configurações Adicionais

- O arquivo `vercel.json` já está configurado para lidar com rotas SPA (Single Page Application), redirecionando todas as requisições para o `index.html`.
- O `package.json` especifica a versão do Node.js >= 22 para compatibilidade.

## ⚠️ Observações Importantes

- Certifique-se de que o seu projeto Supabase permite o domínio gerado pela Vercel nas configurações de **Authentication -> URL Configuration -> Redirect URLs**.
- Se você usar o n8n para webhooks, garanta que o domínio da Vercel tenha permissão de CORS se necessário (embora geralmente webhooks POST não precisem disso se disparados pelo frontend).
