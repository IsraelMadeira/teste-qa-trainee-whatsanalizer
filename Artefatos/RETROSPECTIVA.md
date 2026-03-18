# RETROSPECTIVA

## O que foi bem
1. Cobertura dos fluxos criticos com testes reais e independentes.
2. Uso consistente de mocks para validar erros de API sem instabilidade externa.
3. Inclusao de teste data-driven para ampliar variacao de cenarios com baixo custo de manutencao.

## O que poderia melhorar
1. Adicionar identificadores `data-testid` na UI para seletores ainda mais estaveis.
2. Incluir cenarios de volume (arquivos maiores) com coleta de tempos.
3. Integrar execucao automatica da suite no pipeline CI.

## Decisoes tomadas
1. Manter testes focados em comportamento observavel, sem alterar logica da aplicacao.
2. Usar mocks no endpoint da Z.AI para validar 500, 429 e contrato invalido.
3. Centralizar massa de teste em `tests/data` para facilitar manutencao.

## Resultado final
A etapa de QA ficou completa, reproduzivel e orientada a risco, com foco em confiabilidade da entrega e rastreabilidade de cenarios.
