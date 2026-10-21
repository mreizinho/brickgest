const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = vm.createContext({console,crypto:require('node:crypto'),localStorage:{getItem(){return null},setItem(){}},sessionStorage:{getItem(){return null},setItem(){}},document:{addEventListener(){}},window:{addEventListener(){}}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').replace(/writeAppHistory\("home", true\);\s*restoreSession\(\);\s*$/,''),context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../sales.js'),'utf8'),context);
const run = code=>vm.runInContext(code,context);
run(`state.loggedIn=true;state.accessToken='token';state.userEmail='user@example.com';
function stock(code,storage,qty,group,cost){const r=[];r[0]=code;r[7]=storage;r[8]=qty;r[15]=group;r[group==='Sem factura'?14:13]=cost;return r;}
const stockRows=[stock('100','A',2,'Sem factura',5),stock('100','B',3,'Com factura',8),stock('200','A',2,'Com factura',12)];
salesState.items=[{code:'100',name:'First',ean:'00100',locations:[{storage:'A',stock:2},{storage:'B',stock:3}],allocations:{A:2,B:1},price:'10.10'},{code:'200',name:'Second',ean:'00200',locations:[{storage:'A',stock:2}],allocations:{A:1},price:'20.20'}];
salesState.customer={name:'Client',address:'Street',email:'c@example.com',phone:'0012345',tax:'001234567'};salesState.type='Factura';salesState.seller='Seller';
const result=buildSaleRows(stockRows,'sale-1','16/10/2026 12:00:00');`);
assert.equal(run('result.sale[8]'),50.5);
assert.equal(run('result.lines.length'),2);
assert.equal(run('result.movements.length'),3);
assert.equal(run('result.movements.reduce((a,r)=>a+r[11],0)'),-4);
assert.equal(run('result.movements.every(r=>r[20]==="sale-1" && result.lines.some(l=>l[0]===r[21]&&l[2]===r[3]))'),true);
assert.equal(run('new Set(result.movements.map(r=>r[0])).size'),3);
assert.equal(run('result.movements[0][18]'),'Sem factura');
assert.equal(run('result.sale[9]'),'Pendente');
assert.equal(run('saleCells(["=HYPERLINK(1)","001234567",1]).values[0].userEnteredValue.stringValue'),'=HYPERLINK(1)');
assert.equal(run('saleCells(["001234567"]).values[0].userEnteredValue.stringValue'),'001234567');
assert.throws(()=>run(`buildSaleRows([stock('100','A',1,'Sem factura',5)],'id','date')`),/stock/);
for (const price of ['',-1,'abc','1.001']) assert.throws(()=>run(`validateSaleItems([{code:'X',price:${JSON.stringify(price)},allocations:{A:1}}])`));
for (const qty of [0,-1,1.5,'abc']) assert.throws(()=>run(`validateSaleItems([{code:'X',price:'1',allocations:{A:${JSON.stringify(qty)}}}])`));
run(`salesState.rows=[['a','15/10/2026 01:00:00','Factura','','','','','','10','Pendente'],['b','16/10/2026 23:59:59','Recibo','','','','','','20','Não aplicável'],['c','17/10/2026 00:00:00','Factura','','','','','','30','Integrada']];salesState.from='16/10/2026'.split('/').reverse().join('-');salesState.to='2026-10-16';`);
assert.equal(run('filteredSales().length'),1);
assert.equal(run('filteredSales()[0][0]'),'b');
run(`salesState.from='';salesState.to='';salesState.filter='Factura';salesState.integration='Pendente';`);
assert.equal(run('filteredSales().length'),1);
assert.ok(run('salesMarkup().includes("NOVA VENDA")'));
assert.equal(run('salesTitle()'),'VENDAS');
(async()=>{
  run(`let batches=[];prepareSalesSheets=async()=>['Movimentos','Vendas','VendasLinhas'].map((title,sheetId)=>({properties:{title,sheetId}}));saleValues=async()=>[];loadMovementStockRows=async()=>stockRows;salesRequest=async(path,body)=>{batches.push(body);return {};};salesState.id='';salesState.phase='customer';`);
  await run('saveSale()');
  assert.equal(run('batches.length'),1);
  assert.equal(run('batches[0].requests.length'),3);
  assert.equal(run('batches[0].requests[0].appendCells.rows.length'),3);
  assert.equal(run('batches[0].requests[0].appendCells.rows[0].values[3].userEnteredValue.numberValue'),100);
  assert.equal(run('salesState.phase'),'saved');
  assert.equal(run('salesState.uncertain'),false);
  run(`saleValues=async range=>range.startsWith('Vendas!')?[salesState.saved]:salesState.lines;`);
  await run('saveSale()');
  assert.equal(run('batches.length'),1,'Retry must not append an existing sale');
  run(`saleValues=async()=>[];salesRequest=async()=>{throw new Error('Network lost')};`);
  await assert.rejects(run('saveSale()'),/Network lost/);
  assert.equal(run('salesState.uncertain'),true,'Ambiguous response must keep submission locked');
  console.log('Sales tests passed');
})().catch(e=>{console.error(e);process.exitCode=1});
// Movement references must match the numeric type used by the existing inventory QUERY.
assert.equal(run('saleMovementCells(["id","date","001234567","10255"]).values[3].userEnteredValue.numberValue'),10255);
assert.equal(run('saleMovementCells(["id","date","001234567","10255"]).values[2].userEnteredValue.stringValue'),'001234567');
for(const reference of ['CUSTOM-001234567','10255-1','00123','=1+1','9007199254740992']) {
  assert.equal(run(`saleMovementCells(['id','date','ean',${JSON.stringify(reference)}]).values[3].userEnteredValue.stringValue`),reference);
}
assert.equal(run('formatMoneyValue(1800)').replace(/\s/g,' '),'1.800,00 €');
assert.equal(run('formatMoneyValue(1234567.89)').replace(/\s/g,' '),'1.234.567,89 €');

run(`const invoicePreview=salePrintMarkup(['sale','21/10/2026','Factura','<Cliente>','Rua 1\\nPorto','','','123456789',1800,'Pendente','','','Old seller'],[['line','sale','10255','Assembly Square','',1,1800,1800]]);`);
assert.ok(run('invoicePreview.includes("CARLOS JORGE DA SILVA ISIDORO")'));
assert.ok(run('invoicePreview.includes("PT214989640")'));
assert.ok(run('invoicePreview.includes("&lt;Cliente&gt;")'));
assert.ok(run('invoicePreview.includes("Rua 1<br>Porto")'));
assert.ok(!run('invoicePreview.includes("Old seller")'));
assert.ok(!run('invoicePreview.includes("ATCUD:")'));
assert.ok(!run('invoicePreview.includes("23%")'));