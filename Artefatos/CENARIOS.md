# CENARIOS DE TESTE

## Objetivo
Validar a prontidao funcional e a resiliencia da aplicacao WhatsAnalizer com foco em fluxos de negocio, erros de integracao e contrato de dados.

## Funcionais

1. Fluxo feliz end-to-end
- Entrada: token valido + upload `.txt` valido + clique em "Enviar para Analise".
- Validacoes: loading visivel, dashboard renderizado, KPIs preenchidos, resumo exibido.
- Automacao: `TESTE 1 - fluxo feliz end-to-end`.

2. Filtro por participante
- Entrada: resultado de IA com listas preenchidas + selecao de participante.
- Validacoes: listas filtradas por substring (case-insensitive) e badges atualizados.
- Automacao: `TESTE 3 - filtro por participante atualiza listas e badges`.

3. Data-driven com CSV
- Entrada: matriz de cenarios em `tests/data/massa.csv`.
- Validacoes: execucao de multiplas combinacoes token/arquivo/resultado no mesmo teste.
- Automacao: `TESTE 6 - data-driven com CSV`.

## Negativos

1. Upload invalido
- Entrada: arquivo `.csv` e arquivo `.txt` sem formato de conversa.
- Validacoes: bloqueio de extensao invalida e erro para conteudo nao parseavel.
- Automacao: `TESTE 2 - validacao de upload invalido`.

2. Erro de API (500, 429 e falha de conexao)
- Entrada: mock de respostas HTTP 500, HTTP 429 e abort de conexao.
- Validacoes: mensagens corretas exibidas e ausencia de quebra visual da UI.
- Automacao: `TESTE 4 - erro de API mockado (500, 429 e falha de conexao)`.

3. Contrato invalido
- Entrada: payload JSON incompleto (sem campos obrigatorios).
- Validacoes: erro de contrato exibido e dashboard nao renderizado.
- Automacao: `TESTE 5 - contrato invalido nao renderiza dashboard`.

## Edge Cases

1. Token curto (invalido)
- Coberto no data-driven (`token=invalido`).

2. Arquivo `.txt` com conteudo nao reconhecido
- Coberto no data-driven (`arquivo=invalido.txt`).

3. Delay de resposta da IA
- Coberto no fluxo feliz com atraso controlado no mock para validar estado de loading.

4. Token obrigatorio com feedback visual
- Entrada: upload valido sem token informado.
- Validacoes: botao desabilitado, mensagem de obrigatoriedade e estado visual invalido no campo.
- Automacao: `TESTE 7 - token obrigatorio com erro visual`.

## Criterio de saida
- Suite Playwright executa com sucesso.
- Todos os cenarios criticos possuem validacao automatizada.
- Execucao de referencia: 9/9 cenarios aprovados.
- Evidencias disponiveis via `playwright-report`.
