# PRD - Modulos de Assinatura e SaaS Admin

## 1. Visao Geral

Este documento define os requisitos de produto para dois modulos centrais de qualquer microSaaS multi-tenant:

- `Assinatura`: modulo responsavel por planos, contratacao, faturamento, cobranca, acompanhamento de pagamento, controle de limites e recuperacao de acesso.
- `SaaS Admin`: modulo responsavel pela operacao global da plataforma, com visao consolidada de tenants, planos, cobrancas e saude comercial do negocio.

O PRD foi estruturado a partir da analise funcional da implementacao atual, mas foi deliberadamente redigido de forma:

- modular
- reutilizavel
- independente de framework, banco, gateway ou provedor de pagamento
- adaptavel a qualquer microSaaS B2B ou B2B2C com organizacoes/tenants

## 2. Objetivo do Produto

Permitir que a plataforma:

- monetize clientes por meio de planos recorrentes
- controle elegibilidade e limites de uso por plano
- recupere receita por meio de cobranca e regularizacao de pendencias
- centralize a governanca comercial e operacional em um painel administrativo global
- mantenha segregacao entre administracao do tenant e administracao da plataforma

## 3. Problema a Ser Resolvido

Sem estes modulos, a plataforma tende a sofrer com:

- baixa governanca sobre quem paga, quanto paga e quando vence
- dificuldade para controlar o crescimento por tenant
- ausencia de visibilidade global sobre inadimplencia, trials, conversao e expansao
- risco de acesso indevido por tenants inadimplentes
- operacao manual de suporte, cobranca e administracao de planos

## 4. Metas de Negocio

- aumentar conversao de trial para plano pago
- reduzir churn involuntario por falha de cobranca
- padronizar operacao de renovacao e recuperacao de receita
- dar ao operador global da plataforma visao unificada de tenants e status comerciais
- permitir evolucao do produto por planos sem alterar o nucleo operacional do sistema

## 5. Escopo

### Incluido

- catalogo de planos
- assinatura atual do tenant
- comparacao entre uso real e limites contratados
- contratacao, troca de plano e renovacao
- cadastro de dados de faturamento
- geracao de cobranca
- exibicao de instrucoes de pagamento
- historico de cobrancas
- confirmacao de pagamento e reativacao
- bloqueio ou restricao de acesso por inadimplencia
- painel global para operacao SaaS
- listagem e monitoramento de tenants
- administracao global de planos
- visao consolidada de status comerciais e de faturamento

### Fora de escopo deste PRD

- contabilidade fiscal detalhada
- emissao obrigatoria de nota fiscal por legislacao local
- comissoes e afiliacao
- marketplace
- BI financeiro completo
- automacao de CRM de vendas

## 6. Principios de Produto

- `Separacao de dominios`: o tenant administra sua propria assinatura; a plataforma administra o negocio global.
- `Seguranca por backend`: regras de bloqueio, permissao e limite nao podem depender apenas da interface.
- `Estado explicito`: toda cobranca, assinatura e tenant deve possuir estados claros e auditaveis.
- `Adaptabilidade`: o modulo deve funcionar com qualquer meio de pagamento recorrente ou sob demanda.
- `Observabilidade`: cada mudanca relevante deve ser mensuravel e rastreavel.

## 7. Perfis de Usuario

### 7.1 Operador Global da Plataforma

Responsavel pela saude comercial e operacional do microSaaS.

Capacidades esperadas:

- ver todos os tenants
- identificar status comercial de cada tenant
- administrar planos globais
- acompanhar cobrancas e inadimplencia
- executar acoes operacionais autorizadas

### 7.2 Administrador do Tenant

Responsavel pelo contrato e pagamento da organizacao cliente.

Capacidades esperadas:

- visualizar plano atual
- comparar opcoes de plano
- contratar ou alterar plano
- preencher dados de cobranca
- acompanhar pagamento e historico
- regularizar pendencias

### 7.3 Usuario Operacional do Tenant

Usuario final da organizacao cliente que consome o produto, mas nao necessariamente o administra.

Capacidades esperadas:

- operar o produto conforme suas permissoes
- ser impactado por bloqueios do tenant quando aplicavel
- receber comunicacao clara quando houver restricao por pendencia financeira

### 7.4 Suporte ou Financeiro Interno

Perfil opcional, derivado do operador global, para atuar em cobranca, regularizacao e apoio ao cliente.

## 8. Conceitos de Dominio

- `Tenant`: organizacao cliente isolada das demais.
- `Plano`: pacote comercial com preco, limites, beneficios e regras.
- `Assinatura`: vinculo contratual entre tenant e plano.
- `Cobranca`: registro financeiro vinculado a uma assinatura e a um ciclo.
- `Ciclo de cobranca`: janela temporal que define vencimento e renovacao.
- `Status de pagamento`: estado operacional da cobranca.
- `Restricao de acesso`: reducao parcial ou total de acesso por regra comercial.
- `Uso do tenant`: consumo real de recursos comparado com o contratado.

## 9. Modelo Conceitual de Dados

O sistema deve suportar pelo menos as seguintes entidades logicas:

### 9.1 Plano

Campos recomendados:

- identificador
- nome
- descricao
- preco recorrente
- periodicidade
- lista de beneficios
- limites quantitativos por recurso
- status do plano
- ordem de exibicao
- regras comerciais opcionais

### 9.2 Tenant

Campos recomendados:

- identificador
- nome organizacional
- documento fiscal quando aplicavel
- dados de contato
- endereco de cobranca
- status operacional
- data de criacao

### 9.3 Assinatura

Campos recomendados:

- identificador
- tenant vinculado
- plano ativo
- status da assinatura
- inicio do ciclo atual
- fim do ciclo atual
- data prevista de renovacao
- origem da contratacao
- responsavel pela assinatura

### 9.4 Cobranca

Campos recomendados:

- identificador
- tenant
- assinatura
- plano associado no momento da cobranca
- valor
- vencimento
- data de pagamento
- status da cobranca
- identificador externo do pagamento
- payload de retorno do provedor quando aplicavel

### 9.5 Perfil de Faturamento

Campos recomendados:

- nome do responsavel
- email de cobranca
- telefone
- documento
- razao social ou nome da empresa
- endereco

### 9.6 Registro de Auditoria

Campos recomendados:

- entidade afetada
- antes e depois
- ator responsavel
- acao executada
- data e origem da acao

## 10. Estados e Transicoes

### 10.1 Assinatura

Estados minimos recomendados:

- `trial`
- `ativa`
- `aguardando_pagamento`
- `inadimplente`
- `cancelada`
- `expirada`

Transicoes esperadas:

- `trial -> ativa`
- `ativa -> aguardando_pagamento`
- `aguardando_pagamento -> ativa`
- `aguardando_pagamento -> inadimplente`
- `inadimplente -> ativa`
- `ativa -> cancelada`
- `trial -> expirada`

### 10.2 Cobranca

Estados minimos recomendados:

- `preparando`
- `pendente`
- `paga`
- `vencida`
- `cancelada`
- `falhou`

Recomendacao funcional:

- `preparando` representa cobranca criada internamente, mas ainda sem instrumento final de pagamento emitido
- `pendente` representa cobranca emitida e aguardando pagamento
- `paga` libera ou mantem acesso
- `vencida` ou `inadimplente` alimenta politicas de restricao

## 11. Matriz de Permissao

### 11.1 Operador Global da Plataforma

- acessa `SaaS Admin`
- visualiza todos os tenants
- gerencia planos globais
- acompanha cobrancas e inadimplencia
- nunca deve ser bloqueado pela propria logica comercial do tenant

### 11.2 Administrador do Tenant

- acessa `Assinatura`
- visualiza plano atual, limites e historico
- cria ou atualiza dados de cobranca
- gera nova cobranca quando permitido
- regulariza pendencias
- pode sofrer bloqueio por inadimplencia do proprio tenant

### 11.3 Usuario Operacional

- nao administra assinatura
- pode ter acesso reduzido quando o tenant estiver bloqueado
- deve receber mensagem orientativa clara

## 12. Modulo 1 - Assinatura

## 12.1 Objetivo

Dar ao administrador do tenant autonomia para contratar, acompanhar e regularizar sua relacao comercial com a plataforma.

## 12.2 Capacidades Obrigatorias

- exibir assinatura atual
- exibir plano atual e seu status
- exibir comparativo de uso versus limites contratados
- exibir opcoes de planos disponiveis
- impedir downgrade para plano incompativel com o uso atual
- coletar e atualizar dados de faturamento
- gerar cobranca para contratacao ou regularizacao
- exibir instrucoes de pagamento
- listar historico de cobrancas
- detectar confirmacao de pagamento e atualizar o estado da conta
- informar restricao de acesso quando houver pendencia financeira

## 12.3 Jornada Principal

### Jornada A - Contratacao ou troca de plano

1. O administrador acessa a area de assinatura.
2. O sistema exibe o plano atual, status, renovacao e consumo.
3. O sistema apresenta os planos disponiveis.
4. O administrador escolhe um plano elegivel.
5. O sistema valida compatibilidade entre consumo atual e limites do plano alvo.
6. O administrador confirma ou atualiza os dados de faturamento.
7. O sistema registra a alteracao da assinatura.
8. O sistema gera uma cobranca para o ciclo correspondente.
9. O sistema apresenta o instrumento de pagamento.
10. O sistema aguarda confirmacao.
11. Apos confirmacao, o sistema atualiza status, libera acesso e registra o novo ciclo.

### Jornada B - Regularizacao de pendencia

1. O tenant entra em estado de restricao por inadimplencia.
2. O administrador mantem acesso ao modulo de assinatura.
3. O sistema destaca a cobranca em aberto e a urgencia da regularizacao.
4. O administrador reabre ou gera novo instrumento de pagamento conforme regra.
5. O sistema confirma o pagamento.
6. O acesso total e restaurado.

### Jornada C - Consulta operacional

1. O administrador acessa a area.
2. O sistema exibe historico, proximos vencimentos, cobrancas abertas e limites de uso.
3. O administrador usa a area apenas para acompanhamento, sem alterar o plano.

## 12.4 Requisitos Funcionais

### Visao da assinatura

- `AS-01`: o sistema deve exibir o plano atual do tenant.
- `AS-02`: o sistema deve exibir o status atual da assinatura.
- `AS-03`: o sistema deve exibir a data de renovacao ou vencimento relevante.
- `AS-04`: o sistema deve exibir o consumo atual dos principais recursos contratados.
- `AS-05`: o sistema deve destacar quando o consumo estiver proximo ou acima do limite.

### Catalogo e comparacao de planos

- `AS-06`: o sistema deve listar planos disponiveis para contratacao.
- `AS-07`: o sistema deve exibir preco, beneficios e limites de cada plano.
- `AS-08`: o sistema deve identificar visualmente o plano atual.
- `AS-09`: o sistema deve bloquear a selecao de um plano incompativel com o consumo atual.
- `AS-10`: o sistema deve informar qual limite impede a contratacao de um plano inferior.

### Perfil de faturamento

- `AS-11`: o sistema deve coletar e armazenar os dados do responsavel financeiro.
- `AS-12`: o sistema deve permitir pre-preenchimento com dados existentes do tenant.
- `AS-13`: o sistema deve validar documento, email e campos obrigatorios.
- `AS-14`: o sistema deve manter historico ou trilha de alteracoes dos dados de faturamento quando exigido.

### Geracao de cobranca

- `AS-15`: ao confirmar a contratacao ou regularizacao, o sistema deve gerar uma cobranca vinculada ao tenant e ao ciclo.
- `AS-16`: a cobranca deve registrar valor, vencimento e status inicial.
- `AS-17`: o sistema deve ser compativel com mais de um provedor de pagamento.
- `AS-18`: o sistema deve exibir o instrumento de pagamento gerado.
- `AS-19`: o sistema deve permitir reemitir ou renovar a cobranca conforme politica comercial.

### Confirmacao e atualizacao

- `AS-20`: o sistema deve detectar pagamento confirmado por evento assincrono, consulta agendada ou ambos.
- `AS-21`: ao confirmar pagamento, o sistema deve atualizar a cobranca para estado pago.
- `AS-22`: ao confirmar pagamento, o sistema deve atualizar a assinatura para estado regular.
- `AS-23`: o sistema deve atualizar automaticamente a experiencia do usuario sem depender de nova autenticacao.
- `AS-24`: o sistema deve preparar o proximo ciclo de cobranca conforme regra definida.

### Historico e suporte ao pagamento

- `AS-25`: o sistema deve listar cobrancas do tenant em ordem temporal.
- `AS-26`: o sistema deve permitir visualizar detalhes de cobrancas em aberto.
- `AS-27`: o sistema deve destacar cobrancas pendentes, vencidas e pagas.
- `AS-28`: o sistema deve exibir meios de copiar, compartilhar ou reutilizar os dados do pagamento quando aplicavel.

### Restricao de acesso

- `AS-29`: o sistema deve aplicar politica de restricao com base no estado comercial do tenant.
- `AS-30`: o administrador do tenant deve manter acesso ao modulo de assinatura mesmo durante bloqueio comercial.
- `AS-31`: usuarios operacionais devem ter acesso total, parcial ou nulo conforme politica definida.
- `AS-32`: o sistema deve explicar de forma clara o motivo da restricao e o caminho de regularizacao.

## 12.5 Regras de Negocio

- `RB-AS-01`: tenants com cobranca apenas em fase preparatoria nao devem ser bloqueados.
- `RB-AS-02`: tenants com cobranca efetivamente pendente ou vencida podem entrar em restricao conforme janela de tolerancia.
- `RB-AS-03`: o operador global da plataforma nao deve ser impactado pelo bloqueio comercial do tenant.
- `RB-AS-04`: o tenant nao pode contratar plano com limites inferiores ao consumo atual, salvo se houver politica explicita de excecao.
- `RB-AS-05`: uma nova cobranca nao deve ser duplicada se ja existir cobranca aberta equivalente para o mesmo ciclo, salvo regra de reemissao.
- `RB-AS-06`: o valor da cobranca deve refletir o plano vigente e a regra comercial do momento de geracao.
- `RB-AS-07`: a alteracao de plano deve registrar o contexto da operacao: origem, responsavel e data.
- `RB-AS-08`: a restauracao de acesso apos pagamento deve ocorrer automaticamente ou no menor prazo operacional possivel.

## 12.6 Comunicacao e Feedback ao Usuario

- banner de restricao com linguagem objetiva
- destaque visual para assinatura pendente
- confirmacao clara quando o pagamento for identificado
- feedback imediato em caso de falha na geracao da cobranca
- visibilidade do proximo passo apos cada acao

## 12.7 Requisitos de Analytics

- visualizacao da pagina de assinatura
- inicio de selecao de plano
- tentativa bloqueada por ineligibilidade
- envio do formulario de faturamento
- cobranca gerada
- instrumento de pagamento visualizado
- pagamento confirmado
- tenant reativado

## 12.8 Criterios de Aceite do Modulo Assinatura

- um administrador consegue contratar plano sem suporte manual
- um downgrade incompativel e impedido com justificativa clara
- uma cobranca paga reativa o tenant corretamente
- um tenant inadimplente nao acessa areas bloqueadas
- o administrador do tenant continua conseguindo acessar a area de regularizacao

## 13. Modulo 2 - SaaS Admin

## 13.1 Objetivo

Dar ao operador global uma visao consolidada e controlavel da operacao comercial do microSaaS, com foco em tenants, planos, cobrancas e saude da base.

## 13.2 Capacidades Obrigatorias

- listar todos os tenants
- exibir plano, valor, status e vencimento por tenant
- consolidar dados de assinatura e cobranca mais recentes
- destacar tenants em trial, regulares, pendentes e inadimplentes
- permitir administracao global de planos
- permitir sincronizacao ou reconciliacao operacional quando houver divergencia entre regra comercial e dados armazenados

## 13.3 Jornada Principal

### Jornada A - Monitoramento global

1. O operador global acessa o painel SaaS Admin.
2. O sistema apresenta visao consolidada da base de clientes.
3. O operador identifica volumes por status.
4. O operador acessa tenants com risco comercial ou operacional.

### Jornada B - Ajuste de plano global

1. O operador global revisa o catalogo de planos.
2. O operador atualiza preco, descricao, limites ou beneficios.
3. O sistema registra a alteracao e preserva rastreabilidade.
4. O sistema aplica a nova configuracao para ciclos futuros conforme regra da plataforma.

### Jornada C - Reconciliacao operacional

1. O operador identifica divergencias em cobrancas abertas.
2. O operador executa acao de sincronizacao ou reprocessamento.
3. O sistema atualiza os registros afetados.
4. O operador confirma o resultado com visao consolidada atualizada.

## 13.4 Requisitos Funcionais

### Visao consolidada de tenants

- `SA-01`: o sistema deve listar todos os tenants em uma unica visao administrativa global.
- `SA-02`: para cada tenant, o sistema deve exibir no minimo nome, identificador, plano atual, valor, status e vencimento.
- `SA-03`: o sistema deve consolidar o ultimo estado comercial relevante, priorizando a informacao de cobranca mais recente quando aplicavel.
- `SA-04`: o sistema deve evitar duplicidade de exibicao do mesmo tenant.

### Indicadores executivos

- `SA-05`: o sistema deve exibir total de tenants.
- `SA-06`: o sistema deve exibir total de tenants ativos ou monetizados.
- `SA-07`: o sistema deve exibir total de tenants em trial.
- `SA-08`: o sistema deve permitir evolucao futura para indicadores de MRR, inadimplencia e conversao.

### Gestao global de planos

- `SA-09`: o sistema deve permitir editar atributos comerciais dos planos.
- `SA-10`: o sistema deve permitir ajustar limites quantitativos por plano.
- `SA-11`: o sistema deve permitir ajustar descricoes e beneficios exibidos.
- `SA-12`: o sistema deve garantir que apenas perfis globais autorizados executem alteracoes.
- `SA-13`: o sistema deve registrar auditoria das alteracoes de plano.

### Operacoes administrativas

- `SA-14`: o sistema deve permitir acao de reconciliacao ou sincronizacao de cobrancas quando houver necessidade operacional.
- `SA-15`: o sistema deve atualizar a visao global apos a reconciliacao.
- `SA-16`: o sistema deve apresentar mensagens claras em caso de falha de permissao ou processamento.

### Governanca de acesso

- `SA-17`: o painel SaaS Admin deve ser visivel apenas para perfis globais autorizados.
- `SA-18`: o sistema deve impedir que usuarios comuns ou administradores de tenant acessem o painel global.
- `SA-19`: o operador global deve manter acesso mesmo se o tenant de origem estiver inadimplente.

## 13.5 Regras de Negocio

- `RB-SA-01`: o status exibido do tenant deve refletir o estado comercial mais relevante para operacao.
- `RB-SA-02`: alteracoes em planos devem afetar cobrancas futuras ou conforme politica explicitamente configurada.
- `RB-SA-03`: operacoes globais nao podem violar o isolamento de tenant sem justificativa e trilha de auditoria.
- `RB-SA-04`: qualquer automacao de sincronizacao deve ser idempotente quando executada repetidamente.
- `RB-SA-05`: o painel deve continuar funcional mesmo se alguns tenants tiverem dados incompletos.

## 13.6 Exibicao Recomendada

Componentes conceituais recomendados:

- cards de indicadores
- tabela ou grade de tenants
- filtros por status, plano, periodo e risco
- busca por nome ou identificador
- acoes administrativas globais
- detalhamento rapido por tenant

## 13.7 Analytics do Modulo SaaS Admin

- acesso ao painel global
- filtro aplicado
- tenant visualizado
- plano alterado
- reconciliacao executada
- erro administrativo por falta de permissao ou dado inconsistente

## 13.8 Criterios de Aceite do Modulo SaaS Admin

- o operador global visualiza toda a base de tenants sem duplicidade
- o status comercial mais recente do tenant e exibido corretamente
- alteracoes de plano globais ficam auditadas
- perfis nao autorizados nao acessam o modulo
- a reconciliacao nao cria duplicidade de cobrancas

## 14. Requisitos Compartilhados

## 14.1 Multi-tenant

- isolamento logico entre tenants
- consultas administrativas globais permitidas apenas para perfis da plataforma
- toda operacao contextualizada por tenant quando aplicavel

## 14.2 Auditoria

Deve haver rastreabilidade de:

- alteracao de plano
- geracao de cobranca
- mudanca de status de cobranca
- reativacao de tenant
- operacoes administrativas globais

## 14.3 Integracao com Pagamentos

O modulo deve operar com um contrato abstrato de pagamento contendo:

- criacao de cobranca
- consulta de status
- confirmacao de pagamento
- cancelamento ou expiracao
- armazenamento de identificadores externos

A implementacao pode usar webhook, polling, filas, callbacks ou integracao direta, desde que o dominio de produto permaneca o mesmo.

## 14.4 Consistencia

- o backend deve ser a fonte de verdade para estados comerciais
- a interface deve refletir rapidamente mudancas confirmadas
- operacoes repetidas nao devem gerar efeitos colaterais indevidos

## 14.5 Resiliencia

- falhas temporarias do provedor de pagamento nao podem corromper a assinatura
- cobrancas em processamento devem permanecer recuperaveis
- divergencias entre status interno e externo devem ser conciliaveis

## 15. Requisitos Nao Funcionais

- `RNF-01`: seguranca de acesso baseada em papeis.
- `RNF-02`: protecao contra exibicao cruzada de dados entre tenants.
- `RNF-03`: disponibilidade adequada para funcoes de cobranca e regularizacao.
- `RNF-04`: mensagens de erro acionaveis e compreensiveis.
- `RNF-05`: atualizacao assincrona de status sem necessidade de recarregamento manual frequente.
- `RNF-06`: suporte a auditoria e troubleshooting.
- `RNF-07`: design responsivo e acessivel.
- `RNF-08`: internacionalizacao e localizacao de moeda, documento e idioma quando necessario.

## 16. KPIs e Metricas

### Assinatura

- taxa de conversao para plano pago
- tempo medio entre geracao de cobranca e pagamento
- percentual de cobrancas pagas no prazo
- percentual de tenants bloqueados por inadimplencia
- taxa de reativacao apos pendencia

### SaaS Admin

- total de tenants ativos
- total de tenants em trial
- total de tenants com pendencia
- tempo medio de resolucao de divergencias operacionais
- numero de alteracoes de plano por periodo

## 17. Riscos e Cuidados

- permitir downgrade sem validar consumo pode quebrar operacao do tenant
- bloquear acesso sem preservar caminho de regularizacao gera suporte desnecessario
- reconciliacao sem idempotencia pode duplicar cobrancas
- acoplamento do dominio a um unico gateway de pagamento reduz portabilidade
- ausencia de auditoria em alteracoes globais aumenta risco operacional

## 18. Dependencias de Implementacao

Qualquer projeto que implemente este PRD deve garantir:

- camada de autenticacao
- modelo de autorizacao por perfil
- persistencia de assinatura e cobrancas
- integracao com pelo menos um meio de pagamento
- mecanismo de atualizacao de status de pagamento
- regra centralizada de bloqueio comercial

## 19. Fases Sugeridas de Entrega

### Fase 1 - Nucleo de Assinatura

- catalogo de planos
- assinatura atual
- cobranca inicial
- historico basico
- bloqueio por inadimplencia

### Fase 2 - Operacao Comercial

- confirmacao automatica de pagamento
- reemissao de cobranca
- restauracao automatica de acesso
- indicadores basicos

### Fase 3 - SaaS Admin

- painel global de tenants
- gestao global de planos
- reconciliacao operacional
- auditoria expandida

## 20. Checklist de Prontidao

O modulo pode ser considerado pronto quando:

- o administrador do tenant consegue contratar, pagar e regularizar sem intervencao manual
- a plataforma consegue identificar claramente tenants ativos, em trial e inadimplentes
- a restricao de acesso respeita papeis e excecoes administrativas
- a visao global do negocio apresenta dados coerentes e atualizados
- planos e cobrancas possuem trilha de auditoria

## 21. Decisoes de Produto Recomendadas para Reuso

- tratar `plano`, `assinatura`, `tenant` e `cobranca` como dominios independentes
- separar `status comercial` de `status operacional` quando necessario
- manter politica de bloqueio configuravel por janela de tolerancia
- prever desde o inicio suporte a multiplos meios de pagamento
- permitir extensao futura para cupons, add-ons, anualizacao e auto-upgrade

## 22. Resumo Executivo

O modulo de `Assinatura` deve resolver a jornada completa de contratacao, cobranca, monitoramento e regularizacao do tenant. O modulo de `SaaS Admin` deve oferecer governanca global sobre a base de clientes, com visao consolidada, administracao de planos e operacao comercial segura.

Em conjunto, estes dois modulos formam o nucleo comercial de um microSaaS multi-tenant e devem ser tratados como capacidade de plataforma, nao como telas isoladas.
