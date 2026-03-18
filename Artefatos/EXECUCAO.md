# EXECUCAO

## Pre-requisitos
1. Node.js 20+
2. Dependencias do projeto instaladas (`npm install`)
3. Browser do Playwright instalado (`npx playwright install chromium`)

## Estrutura de automacao
1. `playwright.config.ts`
2. `tests/whatsanalizer.spec.ts`
3. `tests/data/chat1.txt`
4. `tests/data/invalido.txt`
5. `tests/data/massa.csv`

## Comandos
1. Rodar todos os testes:
- `npm run test:e2e`

2. Rodar em headed:
- `npm run test:e2e:headed`

3. Rodar em UI mode:
- `npm run test:e2e:ui`

4. Forcar modo headed por variavel de ambiente:
- `HEADLESS=false npm run test:e2e`

## Evidencias esperadas
1. Console com todos os cenarios aprovados.
2. Relatorio HTML em `playwright-report`.
3. Evidencias de falha (quando ocorrer) em `test-results`.

## Suite implementada
1. TESTE 1 - fluxo feliz end-to-end
2. TESTE 2 - validacao de upload invalido
3. TESTE 3 - filtro por participante atualiza listas e badges
4. TESTE 4 - erro de API mockado (500 e 429)
5. TESTE 5 - contrato invalido nao renderiza dashboard
6. TESTE 6 - data-driven com CSV
