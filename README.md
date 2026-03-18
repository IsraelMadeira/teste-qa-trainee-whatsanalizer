# WhatsAnalizer - QA e Automacao (Etapa 2)

Este repositorio contem a aplicacao Angular (Etapa 1) e a camada de qualidade da Etapa 2 com foco em estrategia de QA, automacao E2E com Playwright e analise de produto/performance.

## Estrutura
- Artefatos
  - CENARIOS.md
  - PERFORMANCE.md
  - PRODUTO.md
  - EXECUCAO.md
  - RETROSPECTIVA.md
  - DOCUMENTO_ENTREGA.md
- tests
  - whatsanalizer.spec.ts
- data
  - chat-valido.csv
  - filtros.csv

## Como instalar
1. npm install
2. npx playwright install

## Como executar testes
- npm run test:e2e
- npm run test:e2e:headed
- npm run test:e2e:ui

## Cobertura da automacao
- Upload de arquivo valido
- Erro de token
- Falha/timeout de API
- Funcionamento de filtro com massa externa CSV
- Renderizacao de dashboard

## Observacao
A execucao dos testes depende da aplicacao Angular subir em http://127.0.0.1:4200 (configurado automaticamente no Playwright via webServer).

## Modelo IA (GLM-5)
- O modelo padrao da UI e `GLM-5`.
- O modelo e configuravel no seletor de calibracao (`GLM-5`, `GLM-4.7`, `GLM-4.5 Flash`).
- Em execucao real, a aplicacao envia a requisicao para a API Z.AI com o modelo selecionado.
- Nos testes Playwright, a resposta da API e mockada para garantir estabilidade e reprodutibilidade.
