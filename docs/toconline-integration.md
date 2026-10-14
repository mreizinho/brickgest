# Integração TOConline — análise para retomar

Análise realizada em 14 de outubro de 2026. Ainda não implementada.

## Objetivo

Dar função ao botão Vendas do BrickGEST: preparar uma venda e criar no TOConline uma ordem de venda, via API ou exportação XML. O tipo exato de documento pretendido ainda precisa de confirmação.

## Conclusões verificadas

- A API permite criar documentos de venda com cliente, linhas, quantidades, preços de venda, IVA e referência externa.
- O endpoint atual `POST /api/v1/commercial_sales_documents` finaliza automaticamente o documento.
- A versão anterior, com `POST /api/commercial_sales_documents`, permite criar cabeçalho e linhas e finalizar numa operação separada.
- A documentação menciona orçamentos, pró-formas, guias e faturas, mas a análise não confirmou um tipo/código específico de “ordem de venda”. As tabelas exemplificam FT, FS e FR; não assumir que estes são adequados para uma encomenda.
- Foi confirmada importação XML de SAF-T para dados e documentos de outro sistema. Não foi confirmado um formato XML para criar novas ordens de venda.
- É necessária licença de Gestão Comercial ativa para pedidos de escrita.
- Um administrador configura o acesso em Empresa → Dados API, indicando o integrador. A autenticação usa OAuth com client_id e client_secret.
- O ficheiro OpenAPI/Swagger não foi obtido nesta análise. Confirmar tipos de documento e comportamento com a especificação e/ou suporte antes de implementar.

## Arquitetura proposta

O GitHub Pages serve o frontend. Usar uma camada de servidor para autenticação OAuth, armazenamento de credenciais e chamadas ao TOConline; avaliar o Apps Script já utilizado pelo projeto. Não colocar client_secret ou refresh tokens no JavaScript público nem no repositório.

Fluxo proposto:

1. Selecionar cliente, sets, quantidades e preços de venda; o preço de venda é separado do custo médio.
2. Rever a venda e enviar o documento ao TOConline.
3. Guardar identificador, referência e estado devolvidos. Usar uma referência externa estável e reconciliação para prevenir duplicados em tentativas repetidas; não assumir idempotência automática da API.
4. Definir o momento do movimento de saída físico: envio, finalização ou entrega. Preparar um documento não deve implicitamente produzir uma segunda saída.

## Decisões pendentes

- O documento é uma encomenda/orçamento para faturar depois, ou uma fatura em rascunho?
- Qual o tipo/código aceites pela API para esse documento e qual a série configurada?
- A empresa tem acesso API e licença necessários? Existe ambiente/empresa de testes disponível?
- Como identificar clientes e mapear os códigos de sets para os produtos TOConline?
- Como tratar preços com/sem IVA, descontos e portes?
- Em que momento abater stock físico no BrickGEST e como recuperar de falhas entre os dois sistemas?
- Caso se prefira XML, obter primeiro o esquema de importação oficialmente suportado para a operação.

## Fontes oficiais

- API: https://toconline.pt/api/
- Índice: https://api-docs.toconline.pt/llms.txt
- Documentos de venda atuais: https://api-docs.toconline.pt/apis/vendas/documentos-de-venda
- Documentos de venda anteriores: https://api-docs.toconline.pt/apis/versoes-anteriores/vendas/documentos-de-venda
- Configuração: https://api-docs.toconline.pt/setup-do-postman
- OAuth: https://api-docs.toconline.pt/autenticacao-detalhada
- Requisitos: https://api-docs.toconline.pt/caracteristicas-dos-pedidos
- Produtos: https://api-docs.toconline.pt/apis/empresa/produtos-e-servicos
- Séries: https://api-docs.toconline.pt/apis/apis-auxiliares/documentos-de-serie
- Importação SAF-T: https://manual.toconline.pt/support/solutions/articles/3000110942-importa%C3%A7%C3%A3o-de-ficheiro-saf-t-pt-de-fatura%C3%A7%C3%A3o

Rever a documentação na retoma, pois a API pode mudar.
