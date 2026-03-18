# PERFORMANCE

## Escopo da analise
Analise tecnica simulada baseada nos fluxos da UI atual e no comportamento observado durante os testes automatizados com mock de API.

## Tempo medio de resposta (simulado)

1. Upload e parsing de `.txt` pequeno (ate 200 linhas)
- Media: 80ms a 180ms
- Experiencia: resposta imediata ao usuario

2. Chamada de analise IA (mock com atraso controlado)
- Media: 300ms a 500ms
- Experiencia: loading visivel e transicao fluida para dashboard

3. Renderizacao do dashboard completo
- Media: 60ms a 140ms apos retorno da API

## Comportamento com arquivos grandes

1. Ate 2.000 linhas
- Comportamento esperado: funcional, com pequena elevacao no tempo de parse.

2. Acima de 5.000 linhas
- Risco: aumento perceptivel de latencia na thread principal durante parse e filtros.

## Possiveis gargalos

1. Parsing no client-side
- Todo processamento ocorre no browser, o que pode impactar dispositivos de menor capacidade.

2. Filtros e computeds em alta frequencia
- Alteracoes rapidas em filtros podem disparar recomputacoes sucessivas.

3. Payload unico para IA
- Conversas extensas elevam tempo de rede e chance de timeout/rate limit.

## Acoes recomendadas (sem alterar escopo atual)

1. Medir p50/p95 de parse e resposta API em ambiente real.
2. Definir limites de tamanho de arquivo aceito para manter UX consistente.
3. Monitorar taxa de erros 429 e 500 para ajuste de retry/backoff operacional.

## Conclusao
A performance atual atende ao fluxo esperado para uso comum. O principal ponto de atencao para escala e o custo de processamento e envio de conversas longas.
