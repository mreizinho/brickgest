const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const listeners={};const context=vm.createContext({console,crypto:require('node:crypto'),document:{addEventListener(type,fn){(listeners[type]||=[]).push(fn)},querySelector(){return null}},window:{addEventListener(){}}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').replace(/writeAppHistory\("home", true\);\s*restoreSession\(\);\s*$/,''),context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../sales.js'),'utf8'),context);
const run=s=>vm.runInContext(s,context);
run(`state.mode='vendas';state.loggedIn=true;state.userEmail='test';salesState.owner='test';salesState.showMenu=false;salesState.phase='scan';render=()=>{};persistSaleDraft=()=>{};function row(storage,qty){const r=[];r[0]='10300';r[7]=storage;r[8]=qty;r[15]='Com factura';return r;}let rows=[row('TestLoc',3)];loadMovementStockRows=async()=>rows;findSet=()=>({code:'10300',name:'Back to the Future'});`);
(async()=>{
await run(`addSaleCode('10300')`);run(`salesState.pending.item.price='120';confirmSalePrice()`);
await run(`addSaleCode('10300')`);assert.equal(run(`salesState.pending.item.locations[0].stock`),2,'Reserve only one of three physical units');run(`salesState.pending.item.price='120';confirmSalePrice()`);
await run(`addSaleCode('10300')`);run(`salesState.pending.item.price='120';confirmSalePrice()`);await run(`addSaleCode('10300')`);
assert.equal(run(`salesState.pending`),null);assert.match(run(`salesState.error`),/3.*3/);assert.equal(run(`salesState.busy`),false);
const click=listeners.click.find(fn=>fn.toString().includes('button.dataset.saleAction'));
await click({target:{closest(){return {dataset:{saleAction:'review'}}}}});assert.equal(run(`salesState.phase`),'review');assert.equal(run(`salesState.error`),'','Review is immediately usable after an exhausted-stock warning');
await click({target:{closest(){return {dataset:{saleAction:'scan'}}}}});
run(`rows.push(row('Loja',20))`);await run(`addSaleCode('10300')`);
assert.equal(run(`salesState.pending.item.allocations.Loja`),1,'New stock can be read without leaving Sales');assert.equal(run(`salesState.error`),'');assert.equal(run(`salesState.items[0].locations.find(l=>l.storage==='Loja').stock`),20,'Existing rows receive refreshed locations');
run(`salesState.pending=null;salesState.error='previous warning'`);await click({target:{closest(){return {dataset:{saleAction:'review'}}}}});assert.equal(run(`salesState.error`),'');
console.log('Sales availability recovery passed: three consecutive units, genuine exhaustion, review after warning, external stock refresh and retry without leaving Sales.');
})().catch(e=>{console.error(e);process.exitCode=1});
