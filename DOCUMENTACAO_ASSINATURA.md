# Documentacao Tecnica da Secao de Assinaturas

## 1. Objetivo e Escopo

Este documento descreve o funcionamento atual da secao de assinaturas do projeto `UBSF Stock Guardian`, com base em:

- leitura do codigo frontend e das migrations do Supabase;
- inspecao do comportamento em execucao no ambiente de desenvolvimento;
- validacao pratica do fluxo com tenant de QA dedicado;
- confirmacao dos efeitos em banco de dados, webhook PIX e bloqueio de acesso.

O foco aqui e documentar o comportamento real do sistema, incluindo inconsistencias entre:

- codigo frontend;
- migrations versionadas;
- comportamento observado no banco ativo;
- documentacao anterior do projeto.

## 2. Resumo Executivo

A secao de assinaturas implementa um billing SaaS multi-tenant com:

- planos armazenados em `plans`;
- assinatura ativa por tenant em `subscriptions`;
- cobrancas recorrentes em `subscription_invoices`;
- autenticacao e autorizacao via Supabase Auth + tabela `profiles`;
- geracao de PIX por webhook externo configurado em `VITE_N8N_WEBHOOK_URL`.

O desenho atual nao possui camada backend HTTP propria para billing. O frontend fala diretamente com:

- Supabase (consultas, updates e RPCs);
- webhook externo n8n para geracao do PIX.

Pontos centrais confirmados:

1. a adesao a um plano atualiza a assinatura antes do pagamento ser confirmado;
2. a cobranca inicial e criada com `status = waiting`;
3. o webhook retorna os dados PIX e a mesma fatura e atualizada com `pix_code`, `pix_qr_code_url` e `pix_id`;
4. quando uma fatura muda para `paid`, o banco gera automaticamente a proxima fatura mensal;
5. o bloqueio por inadimplencia depende de combinacao entre RPC no banco, calculo no frontend e sincronizacao manual/automatica de status;
6. nao existe fluxo completo de cancelamento implementado na UI.

## 3. Arquitetura Geral

```text
+--------------------------- Frontend React/Vite ----------------------------+
|                                                                           |
| SubscriptionPage                                                          |
|  |- consulta assinatura atual                                             |
|  |- consulta planos                                                       |
|  |- consulta historico de faturas                                         |
|  |- faz polling de pagamento                                              |
|  |- abre SubscriptionForm                                                 |
|                                                                           |
| SubscriptionForm                                                          |
|  |- atualiza tenant                                                       |
|  |- atualiza subscription                                                 |
|  |- insere invoice waiting                                                |
|  |- envia POST para webhook n8n                                           |
|  |- atualiza invoice com dados PIX                                        |
|                                                                           |
| PaymentHistoryTable                                                       |
|  |- exibe invoices                                                        |
|  |- deriva status visual (waiting/late/pending/paid)                      |
|  |- pode regenerar PIX                                                    |
|  |- pode sincronizar status atrasado                                      |
|  |- super admin pode alterar status/excluir                               |
|                                                                           |
+-----------------------------------|---------------------------------------+
                                    |
                                    v
+----------------------------- Supabase / Postgres --------------------------+
|                                                                           |
| Tabelas:                                                                  |
|  |- plans                                                                 |
|  |- subscriptions                                                         |
|  |- subscription_invoices                                                 |
|  |- tenants                                                               |
|  |- profiles                                                              |
|                                                                           |
| RPCs / gatilhos:                                                          |
|  |- is_tenant_blocked                                                     |
|  |- force_sync_invoice_status                                             |
|  |- sync_all_unpaid_invoices                                              |
|  |- handle_next_invoice_generation (trigger ao pagar invoice)             |
|                                                                           |
+-----------------------------------|---------------------------------------+
                                    |
                                    v
+--------------------------- Integracao Externa -----------------------------+
|                                                                           |
| n8n webhook                                                               |
|  |- recebe payload da fatura                                              |
|  |- integra com provedor de pagamento                                     |
|  |- retorna codigo PIX / QR Code / pix_id                                |
|                                                                           |
+---------------------------------------------------------------------------+
```

## 4. Componentes do Frontend

### 4.1 Pagina Principal

Arquivo principal: `src/pages/subscription/SubscriptionPage.tsx`

Responsabilidades:

- carregar estatisticas de uso do tenant;
- carregar assinatura atual;
- carregar planos disponiveis;
- carregar historico de invoices;
- derivar se existe invoice pendente;
- iniciar polling para detectar nova invoice paga;
- abrir modal de checkout;
- permitir edicao de planos para `SUPER_ADMIN`;
- chamar sincronizacao global de faturas.

Queries principais:

- `['tenant-usage-stats', tenant_id]`
- `['my-subscription', tenant_id]`
- `['available-plans']`
- `['my-invoices', tenant_id]`

Comportamento importante:

- o botao do plano atual fica desabilitado;
- outros planos continuam acionaveis, funcionando como mudanca de plano;
- a renovacao exibida no card usa `payment_date` da ultima fatura paga, quando existir;
- o polling consulta invoices `paid` a cada 3 segundos.

### 4.2 Modal de Checkout

Arquivo principal: `src/components/subscription/SubscriptionForm.tsx`

Responsabilidades:

- prefill de dados do usuario e do tenant;
- validacao de CPF/CNPJ;
- atualizacao de `tenants`;
- atualizacao de `subscriptions`;
- criacao de `subscription_invoices`;
- chamada ao webhook n8n;
- persistencia dos dados PIX na invoice;
- abertura do `PaymentDetailsDialog`.

Observacoes de negocio:

- a assinatura e promovida para `active` antes da confirmacao do pagamento;
- a fatura inicial e criada como `waiting`;
- o vencimento inicial e calculado para amanha as `23:59`;
- `next_cycle_date` e definido para um mes apos esse vencimento;
- se `VITE_N8N_WEBHOOK_URL` nao estiver configurado, o fluxo falha com erro explicito.

### 4.3 Dialog de PIX

Arquivo: `src/components/subscription/PaymentDetailsDialog.tsx`

Responsabilidades:

- exibir QR Code PIX;
- exibir codigo copia e cola;
- permitir copia manual;
- servir como tela de conclusao operacional do faturamento.

### 4.4 Historico de Pagamentos

Arquivo: `src/components/subscription/PaymentHistoryTable.tsx`

Responsabilidades:

- listar faturas do tenant;
- exibir status visual derivado;
- abrir detalhes do PIX;
- regenerar PIX para faturas nao pagas;
- sincronizar visualmente faturas atrasadas;
- permitir mudanca manual de status por `SUPER_ADMIN`;
- permitir exclusao manual por `SUPER_ADMIN`.

Comportamentos relevantes:

- antes da consulta, chama `is_tenant_blocked`;
- para invoices `waiting`, o frontend deriva:
  - `waiting` se ainda nao venceu;
  - `late` se venceu ha ate 10 dias;
  - `pending` se venceu ha mais de 10 dias;
- se identificar mais de 10 dias de atraso, tenta persistir `pending` via `force_sync_invoice_status`;
- regeneracao de PIX reutiliza a invoice existente.

### 4.5 Guardas de Acesso

Arquivos principais:

- `src/components/auth/ProtectedRoute.tsx`
- `src/contexts/AuthContext.tsx`
- `src/components/AppSidebar.tsx`

Responsabilidades:

- bloquear o tenant inadimplente;
- restringir acessos com base em `user.tipo`;
- forcar navegacao para `/assinatura` quando `ADMIN` esta bloqueado;
- manter `SUPER_ADMIN` fora da regra de bloqueio;
- sinalizar no menu lateral quando ha pendencia financeira.

## 5. Estrutura de Backend e Banco

## 5.1 Ausencia de Backend HTTP Proprio

Nao existem rotas REST/HTTP internas do repositorio para billing. Toda a logica operacional de assinatura acessa diretamente:

- Supabase JS client;
- RPCs SQL;
- webhook externo.

Isso implica que a "camada backend" da funcionalidade esta distribuida entre:

- banco Postgres/Supabase;
- policies RLS;
- triggers SQL;
- frontend React.

## 5.2 Tabelas Principais

### `plans`

Responsavel por:

- nome do plano;
- descricao;
- preco;
- limites operacionais;
- lista de funcionalidades (`features`).

Campos relevantes:

- `id`
- `name`
- `description`
- `price`
- `max_users`
- `max_products`
- `max_patients`
- `features`

### `subscriptions`

Responsavel por vincular tenant e plano.

Campos relevantes:

- `id`
- `tenant_id`
- `plan_id`
- `status`
- `current_period_start`
- `current_period_end`
- `created_at`

Status efetivamente encontrados no codigo:

- `trialing`
- `active`

Status citados em documentacoes/migrations, mas nao implementados integralmente na UI:

- `canceled`
- `past_due`

### `subscription_invoices`

Responsavel por armazenar cobrancas.

Campos relevantes:

- `id`
- `tenant_id`
- `subscription_id`
- `plan_id`
- `amount`
- `status`
- `pix_code`
- `pix_qr_code_url`
- `pix_id`
- `payment_date`
- `due_date`
- `next_cycle_date`
- `created_at`

Status reais envolvidos no fluxo:

- `waiting`: fatura criada / aguardando pagamento;
- `late`: status apenas visual no frontend;
- `pending`: usado para bloqueio/inadimplencia;
- `paid`: pagamento confirmado;
- `failed`: previsto na UI, mas pouco presente no fluxo pratico observado.

### `tenants`

Responsavel por dados corporativos e de faturamento:

- nome;
- documento;
- telefone;
- endereco;
- cidade;
- estado;
- CEP;
- slug.

### `profiles`

Responsavel por:

- role do usuario;
- tenant vinculado;
- unidade vinculada;
- permissoes;
- base para montar `user.subscription_blocked`.

## 5.3 RPCs e Gatilhos

### `is_tenant_blocked`

Uso:

- chamado pelo `AuthContext` para definir `subscription_blocked`;
- chamado por `PaymentHistoryTable` antes de buscar invoices.

Comportamento validado:

- o tenant fica bloqueado quando existe invoice vencida em cenario de inadimplencia;
- no banco ativo, o retorno pratico nao depende apenas de invoice ja gravada como `pending`;
- a chamada nao necessariamente persiste a mudanca de `waiting` para `pending`.

Consequencia:

- ha divergencia entre status persistido no banco e status visual mostrado na UI;
- parte da sincronizacao de atraso fica delegada ao frontend.

### `force_sync_invoice_status`

Uso:

- chamada pelo frontend quando uma invoice `waiting` esta vencida ha mais de 10 dias;
- usada para persistir `pending` com `security definer`.

### `sync_all_unpaid_invoices`

Uso:

- disparada por `SUPER_ADMIN` na tela de assinatura;
- objetivo aparente: atualizar invoices em aberto com dados correntes dos planos.

### Trigger `handle_next_invoice_generation`

Uso:

- executado quando uma invoice muda para `paid`;
- gera automaticamente a proxima invoice mensal se nao houver outra invoice `pending` ou `waiting`.

Comportamento validado:

- confirmado em ambiente real: ao marcar a invoice paga, uma nova invoice `waiting` e criada automaticamente com o mesmo `plan_id` e valor do plano.

## 6. Fluxos Funcionais

### 6.1 Cadastro e Onboarding

Fluxo esperado pelo desenho:

1. usuario faz signup;
2. usuario cria tenant em `/onboarding`;
3. sistema cria assinatura trial;
4. usuario acessa area de assinatura para converter trial em plano pago.

Fluxo real observado:

- o `SignUp` nao envia `role = admin` explicitamente;
- o perfil criado apareceu com `role = user` durante a validacao inicial;
- `ProtectedRoute` bloqueia `/onboarding` para usuario sem `unidade_id` fora do contexto `/admin`;
- isso empurra usuarios para `/select-unidade` antes do onboarding do tenant;
- para validar a assinatura, foi necessario normalizar o perfil de QA manualmente.

Conclusao:

- o onboarding self-service nao esta coerente com o fluxo de assinatura documentado anteriormente.

### 6.2 Adesao ao Plano / Geracao da Cobranca

Fluxo implementado:

1. usuario entra em `/assinatura`;
2. escolhe um plano;
3. modal `SubscriptionForm` e aberto;
4. sistema preenche dados de `profiles` e `tenants`;
5. ao submeter:
   - atualiza `tenants`;
   - atualiza `subscriptions` para o novo plano e `status = active`;
   - insere invoice `waiting`;
   - envia payload ao webhook;
   - atualiza invoice com dados PIX;
   - abre `PaymentDetailsDialog`.

Validacao pratica:

- modal abriu com dados prefill corretos apos normalizacao do tenant;
- a automacao do navegador integrado nao conseguiu disparar os botoes do modal com confianca;
- o mesmo fluxo foi reproduzido diretamente contra o projeto Supabase ativo e o webhook mock do ambiente;
- o resultado foi confirmado:
  - assinatura mudou de `trialing` para `active`;
  - plano mudou para `Profissional`;
  - invoice foi criada com `status = waiting`;
  - PIX mock foi persistido com sucesso.

### 6.3 Exibicao de PIX

Fluxo implementado:

- apos retorno do webhook com `pix_code`, `qr-code` e `id-pix`, a invoice e atualizada;
- os detalhes podem ser exibidos no `PaymentDetailsDialog`;
- a tabela de historico exibe acao de visualizacao e botao de copia de PIX.

Validacao pratica:

- invoice de QA passou a aparecer no historico com:
  - vencimento;
  - valor;
  - status `AGUARDANDO`;
  - botao `PIX`.

### 6.4 Confirmacao de Pagamento

Fluxo implementado:

- a tela principal faz polling a cada 3 segundos buscando invoice `paid`;
- ao detectar novo pagamento, deve:
  - disparar `PaymentCelebration`;
  - invalidar caches;
  - exibir toast.

Validacao pratica:

- a mudanca de invoice para `paid` foi confirmada no banco;
- a geracao automatica da proxima invoice mensal foi confirmada;
- a celebracao visual nao foi validada por automacao de clique/pagina com o mesmo grau de confianca, mas o polling e o gatilho SQL estao presentes no codigo.

### 6.5 Renovacao

Nao existe wizard especifico de renovacao.

A renovacao acontece por composicao de regras:

1. invoice atual vira `paid`;
2. trigger SQL gera a proxima `waiting`;
3. historico passa a exibir a nova cobranca;
4. tenant pode gerar novo PIX se necessario.

### 6.6 Atualizacao de Plano

Nao existe fluxo separado de upgrade/downgrade.

Comportamento atual:

- escolher outro plano reaproveita o mesmo `SubscriptionForm`;
- a assinatura ativa e atualizada imediatamente para o novo `plan_id`;
- uma nova invoice e criada para o novo valor do plano.

Consequencia:

- a mudanca de plano acontece antes da confirmacao financeira;
- nao ha logica robusta de prorata, ciclo parcial ou agendamento para proximo ciclo.

### 6.7 Cancelamento

Nao ha fluxo funcional de cancelamento implementado na interface atual.

Nao foi encontrado:

- botao de cancelar assinatura;
- confirmacao de cancelamento;
- rotina de encerramento de renovacao;
- gravacao de `subscriptions.status = canceled` na UI.

Conclusao:

- cancelamento e requisito parcialmente ausente no estado atual do sistema.

### 6.8 Bloqueio por Inadimplencia

Fluxo observado:

1. `AuthContext` chama `is_tenant_blocked`;
2. se houver bloqueio, `user.subscription_blocked = true`;
3. `ProtectedRoute` restringe o acesso:
   - `ADMIN` so pode permanecer em `/assinatura`;
   - `COMUM` so pode permanecer em `/`;
   - `SUPER_ADMIN` nao e bloqueado;
4. `AppSidebar` destaca a secao de assinatura;
5. a propria pagina mostra banner `Acesso Restrito`.

Validacao pratica:

- o bloqueio foi reproduzido com tenant de QA;
- apos refresh da sessao/pagina, o banner de restricao foi exibido em `/assinatura`;
- a invoice em atraso pode permanecer `waiting` no banco enquanto a aplicacao ja considera o tenant bloqueado;
- quando `force_sync_invoice_status` grava `pending`, UI e persistencia passam a convergir.

## 7. Dependencias Internas e Externas

## 7.1 Frontend

- React
- TypeScript
- Vite
- React Router
- `@tanstack/react-query`
- `react-hook-form`
- shadcn/ui
- `lucide-react`
- Supabase JS client

## 7.2 Infra e Integracoes

- Supabase Auth
- Supabase PostgREST
- Supabase RPC
- Postgres triggers / functions
- webhook n8n para cobranca PIX

## 7.3 Dependencias Funcionais

- `profiles` para role e tenant atual;
- `tenants` para dados de faturamento;
- `subscriptions` para plano atual;
- `subscription_invoices` para ciclo financeiro;
- `plans` para catalogo comercial.

## 8. Validacao Pratica Realizada

Ambiente validado:

- app Vite local em `http://127.0.0.1:4173`;
- webhook mock local em `http://127.0.0.1:8787/webhook`;
- projeto Supabase efetivamente usado pela aplicacao:
  - `https://lfirydxemunavhdnnqkq.supabase.co`

Tenant de QA utilizado:

- usuario: `teste.assinatura.qa.20260517@example.com`
- role operacional ajustada para `admin`
- tenant dedicado com assinatura trial inicial

Fluxos efetivamente confirmados:

- login e acesso a `/assinatura`;
- renderizacao de planos;
- renderizacao de historico vazio inicial;
- abertura do modal de assinatura;
- prefill de dados de tenant/perfil;
- atualizacao da assinatura de `trialing` para `active`;
- criacao da primeira invoice `waiting`;
- retorno e persistencia do PIX;
- exibicao da invoice no historico;
- confirmacao de pagamento da invoice;
- geracao automatica da proxima invoice mensal;
- bloqueio visual e logico por inadimplencia.

Limitacao de validacao:

- a automacao do navegador integrado nao conseguiu interagir com os botoes do modal de forma confiavel, inclusive `Cancelar`;
- por isso, a submissao do checkout foi validada executando o mesmo fluxo real contra o Supabase e o webhook do ambiente, sem alterar a implementacao do produto.

## 9. Fragilidades e Pontos de Melhoria

### 9.1 Exposicao Critica de Credencial Supabase

Achado mais grave:

- no ambiente Vite validado, `VITE_SUPABASE_PUBLISHABLE_KEY` estava preenchida com uma chave `service_role`;
- isso significa que a aplicacao frontend esta expondo uma credencial privilegiada no browser.

Impacto:

- bypass completo de RLS;
- leitura e escrita administrativa no banco a partir do cliente;
- risco critico de seguranca.

Acao recomendada:

- revogar imediatamente a chave exposta;
- substituir por chave anon/public apropriada;
- mover operacoes privilegiadas para edge functions ou backend seguro.

### 9.2 Inconsistencia Entre Migrations e Runtime do Bloqueio

Foi observada divergencia entre:

- versao de `is_tenant_blocked` descrita em migrations;
- comportamento efetivo do banco ativo;
- derivacao de status feita no frontend.

Impacto:

- documentacao anterior fica parcialmente incorreta;
- status persistido e status visual podem divergir;
- troubleshooting operacional fica dificil.

### 9.3 Onboarding Self-Service Quebrado

Problemas:

- signup nao define role administrativa;
- rota `/onboarding` conflita com a exigencia de `unidade_id`;
- fluxo teorico de criacao do tenant nao acontece de ponta a ponta.

Impacto:

- o caminho natural para conversao trial -> plano pago fica quebrado;
- suporte/manual intervention pode ser necessario.

### 9.4 Assinatura Ativada Antes do Pagamento

Problema:

- `SubscriptionForm` atualiza `subscriptions.status = active` antes de confirmar a quitacao.

Impacto:

- estado comercial e financeiro ficam desalinhados;
- tenant pode aparecer ativo com invoice ainda nao paga.

### 9.5 Ausencia de Cancelamento

Problema:

- nao ha UX nem regra operacional completa para cancelamento.

Impacto:

- requisito funcional nao atendido;
- dificil encerrar assinatura sem operacao manual no banco.

### 9.6 Mudanca de Plano Sem Prorata

Problema:

- upgrade/downgrade reutiliza o fluxo de nova cobranca, sem prorata e sem agenda para o proximo ciclo.

Impacto:

- risco de cobranca inesperada;
- regras comerciais pouco previsiveis.

### 9.7 Dependencia Excessiva do Frontend Para Sincronizar Inadimplencia

Problema:

- parte da consolidacao de atraso para `pending` acontece no `PaymentHistoryTable`.

Impacto:

- se o usuario nao abrir a tela, a persistencia do status pode nao refletir a regra esperada;
- regras criticas ficam acopladas a uma pagina especifica.

### 9.8 Multiplicidade de Projetos Supabase

Problema:

- o repositorio e o ambiente exibem referencias divergentes de projetos Supabase.

Impacto:

- risco de documentar o banco errado;
- risco de QA e suporte atuarem em ambiente incorreto;
- risco de incidentes operacionais.

## 10. Recomendacoes Prioritarias

1. corrigir imediatamente a exposicao da chave `service_role` no frontend;
2. centralizar billing sensivel em backend seguro ou edge functions;
3. unificar a regra de bloqueio por inadimplencia em uma unica fonte de verdade no banco;
4. corrigir o fluxo de signup/onboarding para criar tenant e role admin de forma consistente;
5. implementar cancelamento real de assinatura;
6. revisar o momento de ativacao da assinatura para acontecer somente apos pagamento confirmado;
7. definir regra comercial de upgrade/downgrade com prorata ou troca no proximo ciclo;
8. eliminar referencias obsoletas a projetos Supabase alternativos.

## 11. Estado Atual Conclusivo

A secao de assinaturas esta funcional para:

- listar planos;
- alterar plano;
- gerar cobranca PIX;
- registrar pagamento;
- criar proxima cobranca;
- bloquear tenant inadimplente.

No entanto, ela ainda apresenta lacunas estruturais importantes:

- seguranca critica nas credenciais;
- onboarding inconsistente;
- cancelamento ausente;
- regra de inadimplencia fragmentada;
- forte acoplamento entre frontend e operacao financeira.

Em outras palavras: o modulo funciona operacionalmente para cobranca e renovacao, mas ainda nao esta maduro como subsistema SaaS de billing confiavel sem revisoes de seguranca, fluxo e governanca.
