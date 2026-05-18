# Arquitetura Recomendada - Billing Core Central

## 1. Objetivo

Este documento define a solucao mais simples e recomendada para reutilizar a logica de `Assinatura` e `SaaS Admin` em qualquer outro sistema sem precisar copiar todo o codigo interno de cada projeto.

A recomendacao e criar um sistema externo central de:

- billing
- assinatura
- cobranca
- inadimplencia
- bloqueio e liberacao de acesso

Cada sistema integrado passa a consultar esse servico central para decidir se um tenant pode operar normalmente ou deve ficar restrito.

## 2. Recomendacao Final

Ao inves de tentar migrar automaticamente o codigo dessas seções para qualquer sistema, a recomendacao e implementar:

- um `Billing Core Central`
- uma `API de status de acesso`
- um `Painel Administrativo Central`
- um `Webhook de pagamento`
- um `Adaptador leve` dentro de cada sistema cliente

Essa abordagem e a mais simples porque:

- evita copiar e adaptar codigo grande entre projetos
- concentra a regra comercial em um unico lugar
- reduz retrabalho
- facilita manutencao
- garante comportamento consistente entre varios sistemas

## 3. O Que Sera Construido

### 3.1 Sistema Externo Central

Um sistema independente responsavel por:

- cadastrar produtos ou sistemas gerenciados
- cadastrar tenants de cada sistema
- gerenciar planos
- gerenciar assinaturas
- gerar cobrancas
- processar pagamentos
- definir status comercial
- informar se o tenant esta `liberado` ou `bloqueado`

### 3.2 Adaptador em Cada Sistema

Uma camada pequena dentro de cada sistema integrado responsavel por:

- identificar qual tenant esta autenticado
- consultar o Billing Core Central
- receber o status do tenant
- aplicar a regra local de acesso
- redirecionar para a tela de assinatura local ou central quando necessario

## 4. O Que Nao Sera Feito na Abordagem Recomendada

- nao sera criada uma ferramenta que injeta codigo automaticamente em qualquer sistema
- nao sera feita copia integral das telas e da logica para cada projeto
- nao sera criada dependencia forte entre o sistema gerenciado e a estrutura interna deste repositorio

## 5. Arquitetura de Alto Nivel

```text
Sistema Cliente A ----\
Sistema Cliente B -----\ 
Sistema Cliente C ------> Billing Core Central ---> Gateway de Pagamento
Sistema Cliente N -----/            |
                                   |
                           Painel SaaS Admin Central
```

## 6. Componentes do Billing Core Central

## 6.1 Catalogo de Sistemas

Responsavel por registrar quais sistemas externos sao gerenciados.

Cada sistema deve possuir pelo menos:

- identificador unico
- nome do sistema
- status
- credenciais de integracao
- politica de bloqueio

Exemplos:

- ERP A
- CRM B
- Portal C

## 6.2 Catalogo de Tenants

Responsavel por registrar todos os tenants de todos os sistemas integrados.

Cada tenant deve possuir pelo menos:

- identificador global no Billing Core
- identificador do sistema de origem
- identificador local no sistema cliente
- nome organizacional
- email principal
- status operacional

## 6.3 Catalogo de Planos

Responsavel por manter os planos comerciais disponiveis.

Campos minimos:

- nome
- descricao
- valor
- periodicidade
- beneficios
- limites
- status do plano

## 6.4 Assinaturas

Responsavel por vincular:

- tenant
- sistema
- plano
- ciclo
- status comercial

Estados minimos:

- trial
- ativa
- aguardando_pagamento
- inadimplente
- cancelada
- expirada

## 6.5 Cobrancas

Responsavel por:

- gerar cobranca
- armazenar vencimento
- armazenar valor
- armazenar instrumento de pagamento
- receber confirmacao de pagamento
- alimentar o status de acesso

Estados minimos:

- preparando
- pendente
- paga
- vencida
- cancelada
- falhou

## 6.6 Motor de Bloqueio

Responsavel por transformar estado comercial em decisao de acesso.

Saida principal:

- `allowed`
- `restricted`
- `blocked`

Esse motor deve considerar:

- status da assinatura
- status da cobranca
- janela de tolerancia
- tipo de usuario consultado
- regras especiais de excecao

## 6.7 Painel Administrativo Central

Responsavel por operar toda a base.

Deve permitir:

- ver todos os sistemas
- ver todos os tenants
- ver status comerciais
- editar planos
- acompanhar cobrancas
- monitorar inadimplencia
- executar reconciliacoes

## 6.8 Processador de Pagamentos

Responsavel por:

- criar cobrancas no provedor
- receber webhooks
- atualizar status internos
- disparar reativacao

## 7. Fluxo Principal de Funcionamento

## 7.1 Cadastro e Vinculo

1. Um sistema cliente e registrado no Billing Core.
2. Cada tenant desse sistema passa a ter um identificador global.
3. O tenant e vinculado a um plano ou trial.

## 7.2 Consulta de Acesso

1. O usuario entra no sistema cliente.
2. O sistema cliente identifica o tenant local.
3. O sistema cliente consulta o Billing Core.
4. O Billing Core retorna o status de acesso.
5. O sistema cliente libera, restringe ou bloqueia a navegacao.

## 7.3 Contratacao ou Regularizacao

1. O admin do tenant acessa a area de assinatura.
2. O sistema cliente ou portal central solicita acao ao Billing Core.
3. O Billing Core gera cobranca.
4. O provedor de pagamento devolve o instrumento.
5. O usuario paga.
6. O Billing Core confirma o pagamento.
7. O Billing Core altera o status para regular.
8. Os sistemas clientes voltam a liberar acesso.

## 8. Onde a Tela de Assinatura Vai Ficar

Existem duas opcoes validas.

### Opcao A - Tela centralizada no Billing Core

O usuario e redirecionado para um portal central de assinatura.

Vantagens:

- mais simples de manter
- uma unica interface para todos os sistemas
- menos codigo em cada sistema cliente

Desvantagens:

- experiencia pode parecer externa ao sistema principal

### Opcao B - Tela local em cada sistema

Cada sistema possui sua propria tela, mas consome a API central.

Vantagens:

- experiencia mais integrada ao produto local

Desvantagens:

- exige mais manutencao
- maior risco de divergencia de interface

### Recomendacao

Para o caminho mais simples, usar `Opcao A - Tela centralizada no Billing Core`.

## 9. Contrato Minimo de Integracao com os Sistemas Clientes

Cada sistema integrado precisa apenas de quatro capacidades.

### 9.1 Identificar o tenant autenticado

O sistema precisa saber:

- qual tenant esta logado
- qual usuario esta tentando acessar
- qual tipo de usuario ele e

### 9.2 Consultar o Billing Core

Endpoint conceitual:

```text
GET /access-status?system_id={systemId}&tenant_id={tenantId}&user_type={userType}
```

Resposta conceitual:

```json
{
  "tenant_id": "abc",
  "system_id": "erp-x",
  "subscription_status": "inadimplente",
  "access_status": "blocked",
  "reason": "pending_invoice",
  "redirect_url": "https://billing.exemplo.com/assinatura/abc"
}
```

### 9.3 Aplicar a regra de acesso

Se `access_status` for:

- `allowed`: libera acesso normal
- `restricted`: permite apenas rotas permitidas
- `blocked`: bloqueia e redireciona para regularizacao

### 9.4 Permitir retorno automatico apos regularizacao

Depois da regularizacao:

- o sistema deve reconsultar o Billing Core
- se o tenant estiver regular, o acesso volta automaticamente

## 10. Regra Recomendada de Bloqueio

### 10.1 Perfis

- operador global do Billing Core nunca bloqueia
- administrador do tenant mantem acesso a regularizacao
- usuario operacional pode ser limitado ou bloqueado

### 10.2 Politica minima

- cobranca em `preparando` nao bloqueia
- cobranca em `pendente` pode bloquear apos janela de tolerancia
- cobranca em `vencida` bloqueia conforme politica
- cobranca em `paga` remove bloqueio

## 11. MVP Recomendado

Para entregar rapido e com menor risco, o MVP do Billing Core deve conter apenas:

- cadastro de sistemas
- cadastro de tenants
- catalogo de planos
- assinatura por tenant
- cobranca por tenant
- integracao com um unico meio de pagamento
- webhook de confirmacao
- API de `access-status`
- tela central de assinatura
- painel admin central basico

## 12. O Que Fica Para Depois

Fase posterior:

- multiplos gateways de pagamento
- cupons
- add-ons
- downgrade automatico
- cobranca anual
- notificacoes multicanal
- SDK completo
- UI kit compartilhado

## 13. Modelo de Dados Conceitual

Entidades minimas:

- `systems`
- `tenants`
- `plans`
- `subscriptions`
- `invoices`
- `billing_profiles`
- `audit_logs`

Relacionamentos minimos:

- um `system` possui varios `tenants`
- um `tenant` possui uma assinatura ativa ou historica
- uma `subscription` gera varias `invoices`
- um `tenant` possui um `billing_profile`

## 14. Rotas ou APIs Conceituais do Billing Core

## 14.1 APIs para sistemas clientes

- `GET /access-status`
- `GET /subscription-summary`
- `POST /billing/checkout`
- `GET /billing/invoices`

## 14.2 APIs administrativas

- `GET /admin/systems`
- `GET /admin/tenants`
- `GET /admin/plans`
- `PATCH /admin/plans/{id}`
- `POST /admin/reconcile`

## 14.3 Webhooks

- `POST /webhooks/payment-provider`

## 15. A Menor Integracao Possivel no Sistema Cliente

Cada sistema cliente precisa apenas:

- middleware ou guard de acesso
- redirecionamento para portal central de assinatura
- armazenamento local do `system_id`
- acesso ao `tenant_id` do usuario logado

Isso significa que o sistema cliente nao precisa implementar:

- logica completa de cobranca
- logica completa de webhook
- logica completa de reconciliacao
- painel admin global

## 16. Vantagens da Abordagem Recomendada

- uma unica logica de negocio
- uma unica fonte de verdade comercial
- menos codigo repetido
- menor custo de manutencao
- mais facil evoluir
- mais facil integrar novos sistemas

## 17. Riscos da Abordagem e Como Reduzir

### Risco 1 - Dependencia do Billing Core

Mitigacao:

- criar cache curto do ultimo status
- definir comportamento de degradacao controlada

### Risco 2 - Mapeamento incorreto de tenant

Mitigacao:

- contrato claro entre `system_id`, `tenant_id local` e `tenant_id global`

### Risco 3 - Divergencia entre autenticacao local e permissao comercial

Mitigacao:

- consultar o Billing Core sempre em pontos criticos de navegacao

### Risco 4 - UX fragmentada

Mitigacao:

- usar portal central com branding consistente
- ou depois criar UI kit compartilhado

## 18. Ordem Recomendada de Implementacao

### Fase 1 - Core Central

- criar modelo de dados central
- criar API de status
- criar planos, assinaturas e cobrancas
- integrar um gateway de pagamento
- criar webhook

### Fase 2 - Portal Central

- criar tela central de assinatura
- criar historico de cobrancas
- criar fluxo de regularizacao

### Fase 3 - Painel Admin Central

- criar dashboard global
- criar listagem de tenants
- criar gestao de planos
- criar reconciliacao basica

### Fase 4 - Integracao dos Sistemas

- adicionar `system_id`
- adicionar consulta de status
- adicionar guard de bloqueio
- adicionar redirecionamento para assinatura

## 19. O Que Eu Recomendo Fazer Agora

Passo imediato recomendado:

- nao tentar portar o codigo atual para outro sistema ainda
- primeiro transformar a logica em `servico central`
- depois integrar o primeiro sistema piloto
- depois replicar a integracao para os outros sistemas

## 20. Definicao Final

Se o objetivo e o caminho mais simples e recomendado, a decisao correta e:

- construir um `Billing Core Central`
- manter a cobranca e a logica de bloqueio fora dos sistemas clientes
- integrar cada sistema com uma camada fina de validacao e redirecionamento

Essa abordagem entrega o que voce quer com menos risco, menor custo de manutencao e muito mais chance de ficar estavel e realmente reutilizavel.
