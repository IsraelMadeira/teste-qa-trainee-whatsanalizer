# DOCUMENTO DE ENTREGA

## 1) Como voce desenvolveu
A implementacao seguiu uma ordem incremental para reduzir risco de regressao e manter validacao continua:

1. Base da aplicacao e rota principal: bootstrap standalone com `AppComponent` como ponto unico de entrada.
2. Layout e estrutura visual: definicao da tela em duas colunas (calibracao/entrada na esquerda e dashboard na direita), com responsividade para mobile.
3. Calibracao da IA: campos de system prompt, modelo e temperature, mantendo token no mesmo fluxo de entrada.
4. Upload e parsing: restricao para arquivo `.txt`, leitura local e parser de mensagens em formato de conversa.
5. Integracao com API Z.AI: servico dedicado para montagem de request, envio e tratamento de resposta.
6. Dashboard: renderizacao de KPIs, resumo, sentimento, envolvidos e listas operacionais.
7. Filtros: aplicacao de filtro por participante e exibicao visual de filtros ativos.

Decisoes de arquitetura:
- Todo o fluxo foi mantido em um unico componente por requisito do desafio.
- Mesmo com componente unico, a logica foi organizada internamente em blocos claros: ingestao, validacoes, integracao, mapeamento de erros, computeds de dashboard e funcoes utilitarias.
- A integracao com IA ficou isolada no servico `ZAiApiService`, preservando separacao entre camada de UI e camada de comunicacao HTTP.

Estado e reatividade:
- Estado principal com Signals para token, arquivo carregado, loading, erro, resultado da analise e filtros.
- Separacao entre estado de UI e estado de dados:
  - UI: mensagens de erro, loading, validade de submit, estado vazio.
  - Dados: mensagens parseadas, resposta da IA, listas e metricas derivadas.
- Uso de `computed` para:
  - listas filtradas (`filteredTasks`, `filteredDeadlines`, `filteredRisks`, `filteredConflicts`),
  - badges e KPIs,
  - controle de submit (`canSubmit`),
  - validacao visual do token,
  - filtros ativos em chips.

Integracao com Z.AI:
- Requisicao HTTP com `Authorization: Bearer <token>` e `Content-Type: application/json`.
- Body com `model`, `temperature`, `messages` e `response_format: { type: 'json_object' }`.
- Parsing seguro da resposta com `JSON.parse` dentro de bloco protegido.
- Validacao rigorosa de contrato JSON (campos obrigatorios e tipos esperados).
- Quando resposta invalida: erro semantico e bloqueio de renderizacao do dashboard.

## 2) Maiores desafios
### Desafio 1: validacao de JSON da IA
Problema:
- A IA pode responder com estrutura incompleta, tipos errados ou formato invalido.

Resolucao:
- Implementacao de validacao estrita no servico, sem confiar cegamente no payload.
- Verificacao de campos obrigatorios e tipos antes de aceitar o resultado.

Resultado final:
- Dados invalidos nao entram no dashboard.
- Usuario recebe mensagem amigavel: "Resposta da IA invalida. Tente novamente."

### Desafio 2: gerenciamento de estado com Signals em componente unico
Problema:
- Concentrar entrada, validacao, filtros e dashboard em um unico componente poderia gerar acoplamento alto.

Resolucao:
- Organizar estados e derivacoes por responsabilidade.
- Usar `computed` para toda regra derivada (submit, badges, filtros, KPIs), evitando logica duplicada no template.

Resultado final:
- Fluxo previsivel, com reatividade clara e baixo risco de estado inconsistente.

### Desafio 3: tratamento robusto de erros da API
Problema:
- Era necessario diferenciar timeout, rate limit e erro generico sem confundir o usuario.

Resolucao:
- Padronizacao de erros semanticos no servico.
- Mapeamento centralizado no componente para mensagens de UX.
- Inclusao de timeout de requisicao (~150s).

Resultado final:
- Erros sao interpretaveis e acionaveis para o usuario final.
- Loading sempre encerra com `finally`, em sucesso ou falha.

## 3) Tratamento de erros e edge cases
Cenarios tratados:
- Token ausente.
- Token invalido.
- Arquivo invalido (extensao diferente de `.txt`).
- Arquivo `.txt` sem conteudo parseavel.
- Timeout de requisicao (~150s).
- Rate limit (HTTP 429).
- Erro generico de API (ex.: 500).
- JSON invalido/contrato invalido retornado pela IA.

Como o usuario e informado:
- Mensagens claras e especificas por tipo de falha.
- Feedback visual no campo de token (borda vermelha + mensagem de validacao).
- Botao principal desabilitado quando envio e invalido.
- Estado de loading explicito com texto "Analisando...".

Garantias tecnicas:
- Loading local ao fluxo de analise (nao global para a aplicacao inteira).
- Encerramento garantido do estado de carregamento via `finally`.
- Sem renderizacao de dashboard para resposta de IA invalida.

## 4) Melhorias e trade-offs
Melhorias com mais tempo:
- Acessibilidade: navegacao completa por teclado, semantica ARIA mais aprofundada e melhoria de contraste em estados de erro.
- Testes: ampliar cobertura com cenarios de volume, testes de resiliencia e contrato mais detalhado por variante de payload.
- UX refinada: feedback progressivo por etapa (upload, parse, requisicao, renderizacao), microcopys adicionais e melhor tratamento de campos de data.
- Performance: estrategias para arquivos muito grandes, processamento incremental e telemetria de latencia.

Trade-offs assumidos:
- Manter tudo em um componente por requisito formal do teste.
- Nao criar backend intermediario: chamada direta para API externa conforme escopo atual.

## 5) O que voce faria diferente
Como organizaria em producao:
- Separaria em componentes menores (calibracao, upload, dashboard, listas e filtros).
- Isolaria regras de dominio em camadas de servico/facade para reduzir complexidade do componente.
- Introduziria backend intermediario para proteger segredos, versionar prompts e padronizar contrato de IA.

Melhorias tecnicas:
- Validacao de contrato com camada dedicada (ex.: validadores por schema interno, mantendo tipagem forte).
- Testes mais profundos: contract testing, testes de acessibilidade e cenarios de stress.
- Observabilidade: logs estruturados de erros e metricas de tempo por etapa.

Reflexao:
- Hoje eu definiria desde o inicio um contrato de resposta de IA mais restrito e versionado.
- Tambem priorizaria padroes de seletores de teste e criterios de erro como parte da definicao inicial do fluxo.
