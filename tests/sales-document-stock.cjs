const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({console,crypto:require('node:crypto'),document:{addEventListener(){}},window:{addEventListener(){}}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').replace(/writeAppHistory\("home", true\);\s*restoreSession\(\);\s*$/,''),context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../sales.js'),'utf8'),context);
const run=s=>vm.runInContext(s,context);
run(`function stock(code,storage,quantity,group,cost){const row=[];row[0]=code;row[7]=storage;row[8]=quantity;row[15]=group;row[group==='Com factura'?13:14]=cost;return row;}const rows=[stock('100','A',2,'Com factura',20),stock('100','A',3,'Sem factura',10),stock('100','B',1,'Sem factura',10)];salesState.customer={name:'Client'};salesState.items=[{code:'100',name:'Set',price:'50',allocations:{A:1}}];`);
for(const [type,group,costColumn,cost] of [['Factura','Com factura',16,20],['Recibo','Sem factura',17,10]]){
run(`salesState.type=${JSON.stringify(type)};var result=buildSaleRows(rows,'sale','date');`);
assert.equal(run('result.movements.length'),1);
assert.equal(run('result.movements[0][18]'),group);
assert.equal(run(`result.movements[0][${costColumn}]`),cost);
assert.equal(run(`result.movements[0][${costColumn===16?17:16}]`),'');
assert.equal(run(`inventoryCosts([...rows,...result.movements.map(r=>r.slice(3,19))],${JSON.stringify(group)}).get('100').quantity`),type==='Factura'?1:3);
assert.equal(run(`inventoryCosts([...rows,...result.movements.map(r=>r.slice(3,19))],${JSON.stringify(type==='Factura'?'Sem factura':'Com factura')}).get('100').quantity`),type==='Factura'?4:2);
}
run(`salesState.type='Factura';salesState.items[0].allocations={A:3}`);
assert.throws(()=>run(`buildSaleRows(rows,'sale','date')`),/Com factura/,'No fallback to receipt stock');
run(`salesState.type='Recibo';salesState.items[0].allocations={A:4}`);
assert.equal(run(`buildSaleRows(rows,'sale','date').movements[0][11]`),-4,'Physical locations are independent of fiscal groups');
run(`salesState.type='Factura';salesState.items[0].allocations={B:1}`);
assert.equal(run(`buildSaleRows(rows,'sale','date').movements[0][18]`),'Com factura','Invoice can use physical stock in B even though its incoming row was without invoice');
assert.equal(run(`buildSaleRows(rows,'sale','date').movements[0][10]`),'B');
run(`salesState.items[0].allocations={B:2}`);
assert.throws(()=>run(`buildSaleRows(rows,'sale','date')`),/stock/i,'Physical location capacity is still enforced');
run(`salesState.type='Recibo';salesState.items=[{code:'100',name:'Set',price:'50',allocations:{A:3}},{code:'100',name:'Set',price:'60',allocations:{A:2}}]`);
assert.throws(()=>run(`buildSaleRows(rows,'sale','date')`),/Sem factura/,'Repeated sale lines share the same available balance');
assert.equal(run(`rows[1][8]`),3,'Planning does not mutate source stock');
console.log('Sales document stock tests passed: fiscal groups, costs, remaining balances, no fallback, locations, repeated lines and source preservation.');
