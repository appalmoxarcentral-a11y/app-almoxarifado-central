# Estrutura e Funcionamento da Página de Assinatura

Este documento detalha a arquitetura, lógica e componentes da página de Assinatura do projeto **UBSF Stock Guardian**, com o objetivo de servir como guia para replicação em outros projetos.

## 1. Visão Geral
A página de Assinatura permite que as unidades (tenants) gerenciem seu plano atual, visualizem limites operacionais (usuários, produtos, pacientes), realizem upgrades de plano e acompanhem o histórico de faturamento. O sistema utiliza **PIX** como método de pagamento principal, integrado via webhook.

---

## 2. Perfis e Responsabilidades

A gestão do sistema e dos pagamentos é dividida em dois papéis principais:

### A. Administrador do Sistema (Dono/Super Admin)
O **Super Admin** é o responsável global pela plataforma. Ele possui privilégios que transcendem as unidades individuais (tenants).
- **Criação**: O primeiro Super Admin é definido diretamente no banco de dados (tabela `profiles`), alterando o campo `tipo` para `SUPER_ADMIN`.
- **Privilégios na Página de Assinatura**:
  - Pode editar os valores e limites (usuários, produtos, pacientes) de qualquer plano disponível.
  - Tem acesso ao botão "Sincronizar", que atualiza faturas pendentes com novos preços ou regras.
  - Não é bloqueado por faturas pendentes da sua unidade.

### B. Usuário Responsável pelo Pagamento (Gestor da Unidade)
Geralmente o usuário com o papel de `ADMIN` da unidade, que realizou o cadastro inicial.
- **Definição no Cadastro**: Ao se cadastrar e realizar o **Onboarding**, o usuário cria o `tenant` (organização) e é automaticamente vinculado a ele. Ele recebe um período de teste (*trial*) de 7 dias.
- **Responsabilidade Financeira**: O responsável pelo pagamento é definido formalmente no preenchimento do `SubscriptionForm`. 
  - Os dados inseridos (Nome, CPF/CNPJ, E-mail) são os que constarão na fatura e serão enviados ao provedor de pagamento via webhook.
  - O e-mail utilizado no formulário torna-se o destino das notificações de cobrança.

---

## 3. Arquitetura de Dados (Supabase)

O sistema de assinatura baseia-se em quatro tabelas principais:

### `plans`
Armazena as opções de planos disponíveis.
- `id`: UUID (PK)
- `name`: Nome do plano (ex: Básico, Profissional, Empresarial)
- `description`: Descrição curta.
- `price`: Preço mensal (Numeric).
- `max_users`: Limite de usuários permitidos.
- `max_products`: Limite de produtos (null = ilimitado).
- `max_patients`: Limite de pacientes (null = ilimitado).
- `features`: Array de strings ou JSON com as funcionalidades incluídas.

### `subscriptions`
Vincula um `tenant` a um `plan`.
- `id`: UUID (PK)
- `tenant_id`: Referência à unidade.
- `plan_id`: Referência ao plano ativo.
- `status`: Estado da assinatura (`active`, `past_due`, `canceled`).
- `current_period_start`: Data de início do ciclo atual.
- `current_period_end`: Data de renovação/vencimento.

### `subscription_invoices`
Registra cada cobrança gerada.
- `id`: UUID (PK)
- `tenant_id`: Referência à unidade.
- `subscription_id`: Referência à assinatura.
- `amount`: Valor da fatura.
- `status`: `waiting` (aguardando geração de PIX), `pending` (aguardando pagamento), `paid` (pago), `expired`.
- `pix_code`: Código "Copia e Cola" do PIX.
- `pix_qr_code_url`: URL da imagem do QR Code.
- `pix_id`: ID da transação no provedor de pagamentos.
- `due_date`: Data de vencimento.
- `payment_date`: Data em que o pagamento foi confirmado.

### `tenants`
Armazena dados da organização para faturamento.
- `name`, `document` (CPF/CNPJ), `address`, `city`, `state`, `postal_code`, `phone`.

---

## 3. Fluxo de Funcionamento

### A. Seleção e Adesão
1. O usuário visualiza os cards de planos em `SubscriptionPage`.
2. O sistema verifica se o uso atual da unidade (contagem de usuários, produtos e pacientes) é compatível com o plano selecionado.
3. Se compatível, o botão "Ativar Plano" abre o `SubscriptionForm`.

### B. Geração de Cobrança (Integração n8n)
1. O usuário preenche os dados de faturamento no `SubscriptionForm`.
2. Ao confirmar:
   - Os dados do `tenant` são atualizados.
   - A `subscription` é atualizada com o novo `plan_id`.
   - Uma nova `invoice` é criada com status `waiting`.
   - O frontend envia um **POST** para um webhook do **n8n** (`VITE_N8N_WEBHOOK_URL`) contendo os dados do cliente e da fatura.
3. O n8n processa o pagamento junto ao provedor (ex: Mercado Pago, EFI), gera o PIX e retorna o código e QR Code.
4. O frontend atualiza a `invoice` com os dados do PIX e exibe o `PaymentDetailsDialog`.

### C. Confirmação em Tempo Real (Polling)
1. A página `SubscriptionPage` possui um `useEffect` que consulta a tabela `subscription_invoices` a cada 3 segundos.
2. Se detectar uma fatura com status `paid` que não estava paga anteriormente:
   - Dispara a animação de celebração (`PaymentCelebration`).
   - Invalida os caches do React Query para atualizar a UI.

### D. Bloqueio de Acesso
- O `AuthContext` executa uma função RPC (`is_tenant_blocked`) no Supabase.
- Se houver faturas vencidas, o campo `subscription_blocked` é ativado no perfil do usuário.
- O sistema exibe um alerta de "Acesso Restrito" e pode limitar funcionalidades específicas.

---

## 4. Design e Identidade Visual

A interface foi projetada com um foco em **UX de Saúde**, utilizando cores que transmitem confiança e profissionalismo, além de uma estrutura responsiva moderna.

### A. Paleta de Cores (Baseada em HSL)
O projeto utiliza um sistema de variáveis CSS para facilitar o gerenciamento de temas (Light/Dark):
- **Primary (Azul Saúde)**: `hsl(214 100% 38%)` - Usado em botões principais, ícones de destaque e estados ativos.
- **Secondary (Verde Sucesso)**: `hsl(159 64% 42%)` - Usado para badges de "Plano Ativo" e indicadores de faturas pagas.
- **Background**: `hsl(0 0% 100%)` no modo claro e `hsl(222.2 84% 4.9%)` no modo escuro.
- **Gradients**: `medical-gradient` (Linear 135deg do Primary para o Secondary).

### B. Elementos de Interface (UI Patterns)
- **Cards**: Utilizam `rounded-3xl` (bordas bem arredondadas) e `shadow-xl` para criar profundidade.
- **Glassmorphism**: Aplicação de `backdrop-blur-sm` e fundos com baixa opacidade (`bg-primary/10` ou `bg-muted/30`) em painéis de resumo.
- **Limites Operacionais**: Barras de progresso dinâmicas que mudam de cor (Primary para Destructive) caso o limite seja excedido.
- **Tipografia**: Família de fontes **Inter**, priorizando pesos `font-black` para títulos e `font-medium` para descrições.

### C. Estrutura de Layout (Grid)
- **Mobile-First**: Layout em coluna única em dispositivos móveis, expandindo para 3 colunas em telas `lg` para os cards de planos.
- **Espaçamento**: Uso consistente de `gap-6` a `gap-10` para separar seções de faturamento e histórico.
- **Feedback Visual**:
  - `PaymentCelebration`: Overlay animado com Confetes após confirmação de pagamento.
  - `Animate Pulse`: No item "Assinatura" do menu lateral quando o acesso está bloqueado.

---

## 5. Estrutura de Componentes (Frontend)

Localização: `src/components/subscription/` e `src/pages/subscription/`

- **`SubscriptionPage.tsx`**: Container principal. Gerencia o estado global da página, fetch de dados e polling de pagamento.
- **`SubscriptionForm.tsx`**: Formulário modal que coleta dados de faturamento e dispara a integração com o webhook.
- **`PaymentDetailsDialog.tsx`**: Modal que exibe o QR Code e o código Copia e Cola após a geração da cobrança.
- **`PaymentHistoryTable.tsx`**: Tabela que lista as faturas anteriores e pendentes, permitindo visualizar detalhes de pagamentos em aberto.
- **`PaymentCelebration.tsx`**: Overlay de animação (Lottie ou CSS) que comemora a confirmação do pagamento.

### E. Destaque na Navegação (`AppSidebar.tsx`)
O sistema de navegação monitora o estado `isSubscriptionBlocked`. Se ativado:
- A maioria dos itens de menu é ocultada (mantendo apenas Dashboard e Assinatura).
- O item "Assinatura" muda de nome para "Assinatura Pendente".
- O ícone da assinatura ganha uma cor vermelha e uma animação de pulso (`animate-pulse`) para atrair a atenção do usuário.

---

## 6. Dependências Principais
- **React Query (@tanstack/react-query)**: Gerenciamento de estado assíncrono e cache.
- **Lucide React**: Ícones da interface.
- **Shadcn UI**: Componentes de base (Dialog, Card, Button, Input, Toast).
- **Supabase SDK**: Comunicação com o banco de dados e autenticação.
- **React Hook Form**: Manipulação do formulário de faturamento.

---

## 7. Dicas para Replicação
1. **Webhook**: Certifique-se de configurar a variável de ambiente `VITE_N8N_WEBHOOK_URL`. O webhook deve aceitar um JSON e retornar os campos `chave-pix-copia-cola` e `qr-code`.
2. **RLS (Row Level Security)**: Configure as políticas do Supabase para que apenas administradores do tenant possam visualizar/editar dados de assinatura.
3. **RPC de Bloqueio**: Implemente a lógica de verificação de inadimplência no banco de dados para garantir segurança, não dependendo apenas do frontend.
