# Spec Funcional - Modulos de Assinatura e SaaS Admin

## 1. Objetivo do Documento

Este documento converte o PRD de `Assinatura` e `SaaS Admin` em uma especificacao funcional pronta para orientar design, backend, frontend, QA, integracoes e homologacao.

O foco desta spec e descrever:

- comportamento funcional esperado
- atores e permissoes
- fluxos operacionais
- regras de negocio aplicadas em cada etapa
- entradas, saidas e validacoes
- respostas do sistema em sucesso, erro e excecao
- criterios objetivos de aceite funcional

Este documento e agnostico de tecnologia e pode ser adaptado para qualquer microSaaS multi-tenant.

## 2. Escopo Funcional

Esta spec cobre exclusivamente:

- modulo `Assinatura`
- modulo `SaaS Admin`

Nao cobre:

- faturamento contabil ou fiscal avancado
- emissao legal de nota fiscal
- CRM comercial
- afiliacao, comissoes ou marketplace

## 3. Atores

### 3.1 Operador Global

Perfil da plataforma com visao global do negocio.

Pode:

- acessar o modulo `SaaS Admin`
- visualizar todos os tenants
- editar planos globais
- monitorar cobrancas e status comerciais
- executar acoes de reconciliacao operacional

Nao deve:

- ser bloqueado pela logica de inadimplencia do tenant

### 3.2 Administrador do Tenant

Perfil responsavel pela relacao comercial da organizacao cliente.

Pode:

- acessar o modulo `Assinatura`
- consultar plano, limites e historico
- contratar, trocar ou regularizar plano
- cadastrar ou atualizar dados de faturamento
- gerar e acompanhar cobrancas

Pode ser impactado por:

- bloqueio comercial do proprio tenant

### 3.3 Usuario Operacional

Perfil usuario final do tenant.

Pode:

- utilizar o produto conforme suas permissoes

Pode ser impactado por:

- reducao ou bloqueio de acesso quando o tenant estiver inadimplente

## 4. Premissas Funcionais

- existe o conceito de tenant como unidade isolada de operacao
- existe autenticacao e identificacao do perfil do usuario
- existe pelo menos um catalogo de planos ativos
- existe um mecanismo de cobranca integrado a um provedor externo ou interno
- o backend e a fonte de verdade dos estados comerciais

## 5. Glossario Funcional

- `tenant`: cliente organizacional da plataforma
- `plano`: pacote comercial ofertado
- `assinatura`: vinculo ativo ou historico entre tenant e plano
- `cobranca`: registro financeiro de um ciclo
- `ciclo`: periodo de vigencia comercial
- `restricao`: limitacao de acesso por regra comercial
- `instrumento de pagamento`: meio exibido para pagamento, como link, boleto, PIX ou equivalente

## 6. Visao Geral dos Modulos

### 6.1 Modulo Assinatura

Responsabilidade:

- exibir situacao comercial do tenant
- permitir adesao ou alteracao de plano
- gerenciar dados de faturamento
- gerar cobranca
- acompanhar pagamento
- apoiar regularizacao
- refletir o impacto comercial no acesso

### 6.2 Modulo SaaS Admin

Responsabilidade:

- apresentar visao consolidada da base de tenants
- exibir indicadores comerciais
- permitir governanca de planos
- apoiar operacao, suporte e reconciliacao

## 7. Matriz de Acesso

| Funcionalidade | Operador Global | Admin do Tenant | Usuario Operacional |
|---|---|---|---|
| Visualizar modulo Assinatura | Sim | Sim | Nao |
| Contratar ou alterar plano | Nao | Sim | Nao |
| Atualizar dados de faturamento | Nao | Sim | Nao |
| Visualizar cobrancas do proprio tenant | Nao | Sim | Nao |
| Regularizar pendencia do tenant | Nao | Sim | Nao |
| Acessar SaaS Admin | Sim | Nao | Nao |
| Visualizar todos os tenants | Sim | Nao | Nao |
| Editar planos globais | Sim | Nao | Nao |
| Reconciliar cobrancas globalmente | Sim | Nao | Nao |

## 8. Estados Funcionais

### 8.1 Estados da Assinatura

- `trial`
- `ativa`
- `aguardando_pagamento`
- `inadimplente`
- `cancelada`
- `expirada`

### 8.2 Estados da Cobranca

- `preparando`
- `pendente`
- `paga`
- `vencida`
- `cancelada`
- `falhou`

### 8.3 Regras Gerais de Interpretacao

- `preparando` nao bloqueia acesso
- `pendente` pode bloquear, conforme politica de tolerancia
- `paga` regulariza o tenant
- `vencida` pode elevar risco e reforcar bloqueio
- `cancelada` nao deve ser considerada cobranca ativa para bloqueio

## 9. Politica de Restricao de Acesso

### 9.1 Objetivo

Garantir coerencia comercial sem impedir o caminho de regularizacao.

### 9.2 Comportamento Esperado

- o operador global nunca e bloqueado
- o administrador do tenant deve manter acesso ao modulo `Assinatura`
- o usuario operacional deve seguir a politica de restricao definida pela plataforma
- o sistema deve sempre explicar o motivo da restricao e o proximo passo esperado

### 9.3 Politicas Minimas

- cobranca em `preparando` nao bloqueia
- cobranca em `pendente` ou `vencida` pode bloquear
- o bloqueio deve considerar janela de tolerancia configuravel
- a reativacao deve ocorrer apos confirmacao de pagamento

## 10. Spec Funcional do Modulo Assinatura

## 10.1 Objetivo do Modulo

Permitir que o administrador do tenant gerencie a relacao comercial com a plataforma de forma autonoma.

## 10.2 Estrutura Funcional da Tela

O modulo deve conter, no minimo, os seguintes blocos:

- resumo da assinatura atual
- status comercial atual
- data de renovacao ou vencimento
- resumo de uso por limite contratado
- catalogo de planos
- formulario de faturamento
- area de cobranca atual
- historico de cobrancas
- mensagens de restricao ou regularizacao

## 10.3 Bloco A - Resumo da Assinatura

### Objetivo

Apresentar rapidamente a situacao contratual atual do tenant.

### Conteudo Minimo

- nome do plano atual
- status da assinatura
- data de renovacao ou vencimento
- status visual destacado

### Regras

- se houver assinatura ativa, o plano atual deve ser identificado visualmente
- se houver pendencia, a mensagem de alerta deve ter prioridade visual
- se nao houver assinatura formal, o sistema deve indicar claramente o estado atual

## 10.4 Bloco B - Uso e Limites

### Objetivo

Permitir comparacao entre uso real e capacidade contratada.

### Entradas

- metricas de consumo do tenant
- limites definidos pelo plano atual

### Saidas

- valores atuais por recurso
- limite contratado por recurso
- indicador visual de normalidade, atencao ou excesso

### Regras

- o modulo deve exibir ao menos os recursos criticos do negocio
- quando um limite for ilimitado, a interface deve deixar isso explicito
- quando o uso superar o limite, o sistema deve destacar esse excesso

## 10.5 Bloco C - Catalogo de Planos

### Objetivo

Permitir ao administrador avaliar e selecionar planos disponiveis.

### Conteudo Minimo por Plano

- nome
- descricao
- preco
- limites
- beneficios
- estado de elegibilidade

### Regras

- o plano atual deve ser marcado como ativo
- planos inelegiveis para downgrade devem ter CTA desabilitado
- o sistema deve explicar por que um plano nao pode ser contratado
- a exibicao deve suportar quantidade variavel de planos

## 10.6 Bloco D - Acao de Contratacao ou Alteracao

### Gatilho

O administrador seleciona um plano elegivel.

### Resultado Esperado

- o sistema abre o fluxo de confirmacao da assinatura
- o sistema exige dados de faturamento validos antes da geracao da cobranca

### Regras

- nao e permitido contratar plano inelegivel
- nao e permitido finalizar contratacao sem dados obrigatorios
- a mudanca deve registrar responsavel, tenant, plano de destino e momento da operacao

## 10.7 Bloco E - Formulario de Faturamento

### Objetivo

Coletar ou atualizar os dados necessarios para cobranca.

### Campos Minimos

- nome do responsavel
- email de cobranca
- telefone
- documento
- nome empresarial ou nome da organizacao
- endereco completo

### Validacoes

- email obrigatorio e valido
- documento obrigatorio e valido conforme pais ou configuracao local
- telefone obrigatorio
- endereco obrigatorio quando exigido pela politica comercial

### Comportamento

- deve permitir pre-preenchimento com dados existentes
- deve permitir edicao antes da confirmacao
- deve preservar consistencia entre tenant e perfil de faturamento

### Mensagens de Erro

- campo obrigatorio ausente
- formato invalido
- documento invalido
- tenant sem contexto de organizacao
- falha ao persistir dados

## 10.8 Bloco F - Geracao de Cobranca

### Objetivo

Criar uma cobranca vinculada a assinatura ou regularizacao.

### Fluxo Funcional

1. Validar permissao do ator.
2. Validar elegibilidade do plano.
3. Validar dados de faturamento.
4. Persistir alteracao da assinatura ou intencao comercial.
5. Criar cobranca com valor, vencimento e referencia de ciclo.
6. Solicitar instrumento de pagamento ao provedor.
7. Atualizar cobranca com os dados retornados.
8. Exibir instrumento de pagamento ao usuario.

### Dados Minimos da Cobranca

- identificador
- tenant
- assinatura
- plano de referencia
- valor
- vencimento
- status inicial
- identificador externo quando houver

### Regras

- a cobranca nao deve ser duplicada para o mesmo ciclo sem justificativa funcional
- a cobranca deve refletir o plano escolhido no momento da geracao
- a cobranca deve permanecer rastreavel mesmo se a integracao externa falhar

## 10.9 Bloco G - Exibicao do Instrumento de Pagamento

### Objetivo

Apresentar ao administrador tudo o que ele precisa para pagar.

### Conteudo Minimo

- valor
- vencimento
- status atual
- dados do instrumento de pagamento
- acoes de copia, abertura ou reuso quando aplicavel

### Regras

- o instrumento deve ficar vinculado a cobranca correta
- se o instrumento expirar, o sistema deve permitir acao conforme politica
- o sistema deve tratar diferenca entre cobranca criada e instrumento ainda nao emitido

## 10.10 Bloco H - Confirmacao de Pagamento

### Objetivo

Refletir rapidamente que o pagamento foi identificado.

### Origem Possivel do Evento

- webhook
- polling
- conciliacao manual
- processamento assíncrono

### Comportamento Esperado

- atualizar cobranca para `paga`
- atualizar assinatura para estado regular
- remover ou reduzir restricoes de acesso
- atualizar interface sem obrigar novo login
- registrar evento de auditoria

### Regras

- a confirmacao deve ser idempotente
- nao deve haver duplicidade de efeitos caso o mesmo pagamento seja confirmado duas vezes

## 10.11 Bloco I - Historico de Cobrancas

### Objetivo

Fornecer transparencia e rastreabilidade para o tenant.

### Conteudo Minimo

- lista cronologica de cobrancas
- valor
- vencimento
- data de pagamento
- status
- acesso ao detalhamento

### Regras

- cobrancas abertas devem ter prioridade visual
- cobrancas pagas devem permanecer consultaveis
- cobrancas canceladas nao devem se confundir com cobrancas ativas

## 10.12 Fluxos Funcionais do Modulo Assinatura

### Fluxo AS-F01 - Contratar plano

Pre-condicoes:

- usuario autenticado como administrador do tenant
- tenant valido
- pelo menos um plano disponivel

Passos:

1. O usuario acessa `Assinatura`.
2. O sistema carrega assinatura, uso, planos e cobrancas.
3. O usuario seleciona um plano elegivel.
4. O sistema abre o formulario de faturamento.
5. O usuario confirma os dados.
6. O sistema gera a cobranca.
7. O sistema exibe o instrumento de pagamento.

Pos-condicoes:

- cobranca criada
- assinatura atualizada ou marcada para o novo ciclo
- evento de auditoria registrado

### Fluxo AS-F02 - Regularizar pendencia

Pre-condicoes:

- tenant com restricao comercial

Passos:

1. O administrador acessa `Assinatura`.
2. O sistema exibe alerta de restricao.
3. O sistema destaca a cobranca em aberto.
4. O usuario acessa ou reemite o instrumento.
5. O pagamento e confirmado.
6. O sistema reativa o tenant.

Pos-condicoes:

- tenant volta ao estado regular
- interface reflete a liberacao de acesso

### Fluxo AS-F03 - Consultar status sem alterar plano

Pre-condicoes:

- usuario com permissao de visualizar assinatura

Passos:

1. O usuario acessa o modulo.
2. O sistema apresenta resumo, consumo e historico.
3. Nenhuma alteracao contratual e executada.

Pos-condicoes:

- nenhuma mutacao de dados

## 10.13 Cenarios de Excecao do Modulo Assinatura

### EX-AS-01 - Plano inelegivel

- sistema impede a continuidade
- sistema informa o recurso que excede o limite

### EX-AS-02 - Falha ao salvar dados de faturamento

- sistema nao gera cobranca
- sistema exibe erro acionavel
- usuario pode corrigir e reenviar

### EX-AS-03 - Falha ao gerar instrumento de pagamento

- cobranca permanece registrada
- status deve refletir falha ou preparacao incompleta
- sistema oferece reprocessamento quando permitido

### EX-AS-04 - Tenant sem contexto organizacional

- sistema bloqueia a contratacao
- sistema orienta o usuario a concluir cadastro estrutural do tenant

### EX-AS-05 - Pagamento confirmado mas interface desatualizada

- sistema deve atualizar automaticamente em janela curta
- em ultimo caso, um refresh manual deve refletir o estado correto

## 10.14 Regras de Negocio Consolidadas do Modulo Assinatura

- `AS-RN-01`: o plano atual nao deve ser contratavel como se fosse um novo plano, salvo politica explicita de renovacao manual.
- `AS-RN-02`: o sistema deve impedir downgrade incompatível com uso atual.
- `AS-RN-03`: o sistema nao deve bloquear tenant apenas por cobranca em preparacao.
- `AS-RN-04`: apenas cobrancas efetivamente cobraveis podem disparar restricao.
- `AS-RN-05`: o administrador do tenant deve manter caminho funcional para regularizacao.
- `AS-RN-06`: o sistema deve preservar historico comercial mesmo quando o plano for alterado.

## 10.15 Criticos de QA do Modulo Assinatura

- validar contratacao com sucesso
- validar erro de elegibilidade por excesso de uso
- validar erro de documento invalido
- validar reativacao apos pagamento
- validar bloqueio de usuario operacional em inadimplencia
- validar permanencia de acesso do administrador a area de regularizacao

## 11. Spec Funcional do Modulo SaaS Admin

## 11.1 Objetivo do Modulo

Oferecer governanca comercial e operacional global sobre a base de tenants.

## 11.2 Estrutura Funcional da Tela

O modulo deve conter, no minimo:

- indicadores executivos
- visao consolidada de tenants
- status comercial por tenant
- resumo de plano e valor por tenant
- acoes de gestao global
- area de administracao de planos

## 11.3 Bloco A - Indicadores Executivos

### Objetivo

Permitir leitura rapida da saude comercial da base.

### Indicadores Minimos

- total de tenants
- total de tenants ativos
- total de tenants em trial
- total de tenants com pendencia, quando disponivel

### Regras

- os indicadores devem refletir a mesma base de dados da listagem
- o calculo deve evitar duplicidade de tenant

## 11.4 Bloco B - Listagem Global de Tenants

### Objetivo

Concentrar a visao operacional da carteira.

### Colunas Minimas

- nome do tenant
- identificador ou documento
- plano atual
- valor do plano
- status comercial
- vencimento ou fim do ciclo

### Regras

- cada tenant deve aparecer uma unica vez na listagem
- o status exibido deve refletir a informacao comercial mais relevante
- tenants sem plano ou com dados incompletos devem continuar listados

## 11.5 Bloco C - Status Comercial Consolidado

### Objetivo

Determinar o estado comercial exibido para cada tenant.

### Regra Funcional

O sistema deve consolidar:

- assinatura mais recente
- cobranca mais recente relevante
- possiveis excecoes operacionais

### Prioridade Recomendada

1. cobranca paga ou regular
2. cobranca pendente ou vencida
3. trial
4. sem plano ou inativo

Observacao:

- a prioridade pode ser adaptada, desde que seja unica, consistente e documentada

## 11.6 Bloco D - Gestao Global de Planos

### Objetivo

Permitir ao operador global manter o catalogo comercial.

### Campos Editaveis Minimos

- descricao
- preco
- limites quantitativos
- beneficios exibidos
- status do plano

### Regras

- apenas operador global autorizado pode editar
- alteracoes devem gerar auditoria
- a plataforma deve definir se a alteracao afeta apenas ciclos futuros ou tambem ciclos abertos

## 11.7 Bloco E - Reconciliacao Operacional

### Objetivo

Resolver divergencias entre dados internos e comportamento comercial esperado.

### Casos de Uso

- atualizar cobrancas abertas com nova configuracao permitida
- reprocessar estados inconsistentes
- sincronizar dados apos ajuste operacional

### Regras

- a operacao deve ser idempotente
- o sistema deve informar sucesso parcial, total ou falha
- a operacao deve registrar responsavel, horario e escopo

## 11.8 Fluxos Funcionais do Modulo SaaS Admin

### Fluxo SA-F01 - Monitorar base de tenants

Pre-condicoes:

- usuario autenticado como operador global

Passos:

1. O usuario acessa `SaaS Admin`.
2. O sistema carrega os indicadores.
3. O sistema carrega a listagem consolidada.
4. O usuario identifica tenants por status e risco.

Pos-condicoes:

- nenhuma alteracao de dados obrigatoria

### Fluxo SA-F02 - Editar plano global

Pre-condicoes:

- usuario com permissao global de gestao comercial
- plano existente

Passos:

1. O usuario seleciona um plano.
2. O sistema abre formulario de edicao.
3. O usuario altera campos permitidos.
4. O sistema valida os dados.
5. O sistema persiste a alteracao.
6. O sistema atualiza a listagem e registra auditoria.

Pos-condicoes:

- plano atualizado
- auditoria registrada

### Fluxo SA-F03 - Executar reconciliacao

Pre-condicoes:

- usuario com permissao administrativa global

Passos:

1. O usuario aciona a funcao de reconciliacao.
2. O sistema executa o processamento definido.
3. O sistema atualiza os dados afetados.
4. O sistema retorna resultado resumido.

Pos-condicoes:

- estados atualizados conforme a regra
- evento administrativo registrado

## 11.9 Cenarios de Excecao do Modulo SaaS Admin

### EX-SA-01 - Usuario nao autorizado

- sistema bloqueia o acesso ao modulo
- sistema exibe mensagem de acesso restrito

### EX-SA-02 - Dados incompletos do tenant

- tenant continua listado
- campos indisponiveis devem ser mostrados como nao informados

### EX-SA-03 - Falha ao editar plano

- nenhuma alteracao parcial invisivel deve persistir sem rastreabilidade
- sistema exibe erro e permite nova tentativa

### EX-SA-04 - Reconciliacao executada com falha parcial

- sistema informa quais registros foram afetados e quais falharam
- o operador pode reexecutar sem criar duplicidade

## 11.10 Regras de Negocio Consolidadas do Modulo SaaS Admin

- `SA-RN-01`: o operador global nao deve sofrer restricao por inadimplencia do tenant.
- `SA-RN-02`: a listagem global deve evitar duplicidade logica do mesmo tenant.
- `SA-RN-03`: o status mostrado deve ser consistente entre indicadores e tabela.
- `SA-RN-04`: alteracoes de plano devem ser auditaveis.
- `SA-RN-05`: reconciliacoes devem ser seguras para repeticao.

## 11.11 Criticos de QA do Modulo SaaS Admin

- validar bloqueio de acesso para perfil nao autorizado
- validar listagem unica por tenant
- validar coerencia entre indicadores e tabela
- validar edicao de plano com auditoria
- validar reconciliacao sem duplicar cobrancas

## 12. Contratos Funcionais Entre Modulos

### 12.1 Assinatura -> Cobranca

Quando uma contratacao ou regularizacao for confirmada:

- deve existir uma cobranca vinculada
- a cobranca deve possuir ciclo e valor
- o instrumento de pagamento deve ser recuperavel

### 12.2 Cobranca -> Controle de Acesso

Quando o estado comercial mudar:

- o modulo de acesso deve refletir a nova politica
- a mudanca deve atingir o tenant correto

### 12.3 SaaS Admin -> Catalogo de Planos

Quando um plano for alterado:

- o catalogo visivel no modulo `Assinatura` deve ser atualizado
- a regra comercial de aplicacao deve ser respeitada

## 13. Requisitos de Auditoria

O sistema deve registrar, no minimo:

- criacao de cobranca
- alteracao de status de cobranca
- troca de plano
- edicao de plano global
- execucao de reconciliacao
- reativacao de tenant

Cada registro deve conter:

- quem executou
- o que executou
- quando executou
- em qual tenant ou entidade
- resultado da acao

## 14. Requisitos de Observabilidade

Eventos funcionais minimos:

- visualizacao de `Assinatura`
- clique em selecionar plano
- bloqueio por ineligibilidade
- envio de faturamento
- cobranca criada
- instrumento exibido
- pagamento confirmado
- tenant reativado
- visualizacao de `SaaS Admin`
- edicao de plano
- reconciliacao executada

## 15. Requisitos Nao Funcionais com Impacto Funcional

- o sistema deve responder com mensagens compreensiveis
- a atualizacao de pagamento deve refletir em tempo operacional aceitavel
- a navegacao em estado bloqueado deve preservar o caminho de regularizacao
- dados entre tenants nao podem ser expostos de forma cruzada

## 16. Criterios Gerais de Homologacao

O conjunto desta spec sera considerado homologado quando:

- o administrador do tenant conseguir contratar ou regularizar plano ponta a ponta
- o sistema impedir downgrade incompatível
- o pagamento regularizar o tenant corretamente
- o usuario operacional sofrer a politica de restricao correta
- o operador global visualizar a base sem duplicidade
- o operador global editar plano com rastreabilidade
- a reconciliacao administrativa puder ser repetida sem efeitos indevidos

## 17. Entregaveis Recomendados a Partir Desta Spec

- historias de usuario
- casos de teste funcionais
- matriz de permissao detalhada
- contrato de integracao com pagamento
- wireframes ou prototipos por fluxo
- modelo de auditoria

## 18. Resumo Executivo

Esta spec funcional define como os modulos `Assinatura` e `SaaS Admin` devem se comportar em operacao real. O modulo `Assinatura` cobre a jornada comercial do tenant, da escolha do plano ate a regularizacao. O modulo `SaaS Admin` cobre a governanca global do negocio, da leitura da base ate a administracao do catalogo e a reconciliacao operacional.
