// Recovery formulas for Inventário H:K. Paste the printed two rows into H1.
const group = 'IF((Movimentos!S$2:S="Sem factura")+((Movimentos!S$2:S<>"Com factura")*(Movimentos!R$2:R<>"")),"Sem factura","Com factura")';
function average(invoice, column) {
  const match = `TO_TEXT(Movimentos!D$2:D)=TO_TEXT(article),${group}="${invoice}",Movimentos!I$2:I<>"Transferência",Movimentos!L$2:L<>0`;
  return `=MAP(A2:A,LAMBDA(article,IF(article="","",IFERROR(LET(qty,FILTER(Movimentos!L$2:L,${match}),prices,FILTER(IF(Movimentos!${column}$2:${column}="","",Movimentos!${column}$2:${column}),${match}),balance,SCAN(0,qty,LAMBDA(total,amount,total+amount)),average,SCAN(0,SEQUENCE(ROWS(qty)),LAMBDA(cost,idx,LET(amount,INDEX(qty,idx),prior,INDEX(balance,idx)-amount,price,INDEX(prices,idx),IF(amount>0,IF(AND(ISNUMBER(price),price>=0),IF(prior<=0,price,IF(ISNUMBER(cost),(prior*cost+amount*price)/(prior+amount),"Custo por apurar")),"Custo por apurar"),IF(INDEX(balance,idx)<=0,0,cost))))),INDEX(average,ROWS(average))),IF(IFERROR(SUM(FILTER(Movimentos!L$2:L,TO_TEXT(Movimentos!D$2:D)=TO_TEXT(article),${group}="${invoice}")),0)=0,0,"Custo por apurar")))))`;
}
function quantity(invoice) {
  return `=MAP(A2:A,LAMBDA(article,IF(article="","",IFERROR(SUM(FILTER(Movimentos!L$2:L,TO_TEXT(Movimentos!D$2:D)=TO_TEXT(article),${group}="${invoice}")),0))))`;
}
const formulas = [average('Com factura','Q'), average('Sem factura','R'), quantity('Com factura'), quantity('Sem factura')];
if (require.main === module) console.log('Valor\tValor sem fact.\tQty com factura\tQty sem factura\n'+formulas.join('\t'));
module.exports = {formulas};
