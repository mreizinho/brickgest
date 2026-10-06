# BrickGEST

Site: https://mreizinho.github.io/brickgest/

Repositório: https://github.com/mreizinho/brickgest

Projeto independente criado a partir da base visual e técnica de `C0937-inv`.

## Relação com o projeto original

- O código foi copiado para servir de ponto de partida.
- Este projeto tem o seu próprio repositório e histórico Git.
- Alterações futuras em `C0937-inv` não entram automaticamente no BrickGEST.
- O projeto original deve ser usado como referência ao adaptar componentes.

## Segurança da integração Google

Os identificadores de OAuth, Google Sheet e Apps Script foram deliberadamente removidos da cópia. Configure recursos próprios do BrickGEST nas constantes existentes no início de `app.js`; não reutilize os identificadores do inventário 0937.

## Artigos Custom

Quando um EAN válido de 8 ou 13 dígitos não existe no catálogo, o teclado e a câmara oferecem a criação de um artigo Custom. O nome é obrigatório; ano, tema, subtema e número de peças são opcionais. O código é gerado como `CUSTOM-<EAN>`.

Os artigos são guardados na folha `CustomArticles`, criada automaticamente no primeiro registo por uma conta com acesso de Editor. A folha contém EAN, código, nome, ano, tema, subtema, peças, data de criação e email do utilizador. A app consulta esta folha juntamente com `BricksetDB` e não a altera ao atualizar o catálogo Brickset.

Guardar o artigo retoma o formulário do movimento ou adiciona-o ao lote/inventário; o movimento é confirmado pelo fluxo habitual. Criar o artigo não cria stock: uma saída ou transferência exige uma entrada anterior.

## Valor e stock inicial

As entradas individuais e em lote exigem um Valor unitário de aquisição e a escolha `Com factura` ou `Sem factura`, incluindo os artigos Custom. Zero é válido; uma célula vazia significa custo por apurar. As saídas e transferências também exigem a escolha do grupo e só podem usar o stock desse grupo. Num lote, a escolha aplica-se a todos os artigos; use lotes separados para grupos diferentes. O PVR continua separado do custo.

Na folha Movimentos, Q é `Valor`, R é `Valor sem fact.` e S é `Factura`. Para carregar stock inicial diretamente no Sheets, registe uma entrada por artigo/localização/grupo com quantidade positiva em L, `Com factura` ou `Sem factura` em S e custo unitário apenas em Q ou R, respetivamente. Preencha também os restantes campos habituais. Não escreva stock diretamente no resultado calculado de Inventário.

Inventário H (`Valor`) e I (`Valor sem fact.`) calculam separadamente o custo médio móvel: `(stock anterior do grupo × custo anterior + entrada × custo unitário) / novo stock do grupo`. J e K mostram as quantidades por grupo. Só as entradas recalculam a média. As saídas mantêm o custo até o stock do grupo chegar a zero; depois o custo é limpo e uma nova entrada começa um novo custo. As transferências mantêm o grupo e não alteram a média.

Compatibilidade: os movimentos antigos sem classificação continuam no grupo `Com factura`, preservando os valores existentes em Q. Se S estiver vazio e R preenchido (incluindo zero), o movimento é tratado como `Sem factura`. Para reclassificar um movimento antigo, preencha S e coloque o custo na coluna correspondente; reveja também as saídas e transferências desse artigo para manter os saldos corretos. Custos históricos vazios apresentam `Custo por apurar` enquanto houver stock.

As folhas de contagem física guardam ambos os custos calculados em Q e R, com `Contagem` em S; uma contagem não constitui uma aquisição. As fórmulas de recuperação de Inventário H:K estão em `scripts/inventory-formulas.cjs` (execute com Node e cole as duas linhas em H1).

## Servidor local

O campo opcional `Doc. Fornecedor` aparece depois de Origem nas entradas e fica guardado como texto em Movimentos T, mantendo letras, números e zeros iniciais. Em lote, aplica-se a todas as linhas do lote. A coluna é criada automaticamente ao guardar um movimento.

```powershell
python -m http.server 3000
```

Depois aceda a `http://localhost:3000/`.
Nas saídas, os destinos são Colecção, Peças, Vault e Venda. Não há escolha de factura: em cada localização escolhida, retira primeiro stock sem factura e depois com factura. Quando ambos são usados, grava linhas separadas em Movimentos para preservar os saldos e custos de cada grupo.
