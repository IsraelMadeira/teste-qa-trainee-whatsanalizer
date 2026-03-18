# WhatsAnalizer - AI Chat Insights

Este repositorio contem a entrega completa do desafio tecnico em duas partes:

- Etapa 1 (desenvolvimento): aplicacao Angular para upload de conversa, calibracao de prompt/modelo e geracao de insights via Z.AI.
- Etapa 2 (QA e automacao): estrategia de testes, automacao E2E com Playwright e artefatos de qualidade/produto/performance.

## Visao geral da solucao

O fluxo principal da aplicacao e:

1. Informar token de API.
2. Ajustar calibracao (system prompt, modelo e temperature).
3. Fazer upload de arquivo `.txt` com conversa.
4. Enviar para analise da IA.
5. Visualizar dashboard com resumo, sentimento, envolvidos, tarefas, prazos, riscos e conflitos.
6. Aplicar filtros por participante.

## Arquitetura e implementacao

- Frontend em Angular standalone.
- Estado reativo com Signals e `computed` para derivacoes (submit, listas filtradas, KPIs e chips de filtro).
- Integracao HTTP com Z.AI em servico dedicado (`ZAiApiService`).
- Contrato JSON validado de forma estrita antes de renderizar dados no dashboard.
- Tratamento de erros com mensagens semanticas (token invalido, timeout, 429, erro generico e resposta invalida da IA).

## Estrutura do repositorio

- `src/app`: componente principal, modelos, prompt e servico de integracao.
- `tests`: cenarios E2E Playwright.
- `tests/data` e `data`: massas de teste para cenarios automatizados.
- `Artefatos`: documentos de entrega, QA, produto, performance e retrospectiva.

## Como executar localmente

1. Instalar dependencias:
  - `npm install`
2. Subir aplicacao em desenvolvimento:
  - `npm start`
3. Gerar build de producao:
  - `npm run build`

## Automacao E2E (Playwright)

1. Instalar browsers do Playwright:
  - `npx playwright install`
2. Executar testes:
  - `npm run test:e2e`
3. Executar com navegador visivel:
  - `npm run test:e2e:headed`
4. Executar no modo UI:
  - `npm run test:e2e:ui`

Observacao:
- O Playwright usa `webServer` para subir a aplicacao automaticamente em `http://127.0.0.1:4200` durante os testes.
- Os testes E2E mockam a API para garantir estabilidade e reprodutibilidade.

## Modelo IA

- Modelo padrao da UI: `GLM-5`.
- Modelos disponiveis na calibracao: `GLM-5`, `GLM-4.7`, `GLM-4.5 Flash`.
- Em uso real, a aplicacao envia a requisicao para Z.AI com o modelo selecionado e `response_format` em JSON.

## Artefatos principais

- `Artefatos/DOCUMENTO_ENTREGA.md`: relato tecnico de desenvolvimento e decisoes.
- `Artefatos/CENARIOS.md`: cenarios de teste e cobertura.
- `Artefatos/EXECUCAO.md`: guia de execucao dos testes.
- `Artefatos/PERFORMANCE.md`: achados e recomendacoes de performance.
- `Artefatos/PRODUTO.md`: analise de produto e UX.
- `Artefatos/RETROSPECTIVA.md`: pontos fortes, riscos e melhorias.
