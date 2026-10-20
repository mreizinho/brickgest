const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8').replace(/writeAppHistory\("home", true\);\s*restoreSession\(\);\s*$/,'');
const c=vm.createContext({console,URL,setTimeout,clearTimeout,document:{baseURI:'https://example.com/',addEventListener(){},querySelector(){return {src:'https://example.com/sales.js?v=release'}},createElement(){return {remove(){}}}},window:{addEventListener(){}}});
vm.runInContext(source,c);
const run=s=>vm.runInContext(s,c);
(async()=>{
 run('let loads=0;document.head={append(script){loads++;Promise.resolve().then(()=>script.onerror())}}');
 await assert.rejects(run('ensureSalesModule()'),/carregar Vendas/);
 assert.equal(run('salesModuleLoad'),null);
 run('document.head.append=script=>{loads++;globalThis.salesMarkup=()=>"";globalThis.openSalesMenu=()=>{};script.onload()}');
 await run('ensureSalesModule()');
 assert.equal(run('loads'),2);
 await run('ensureSalesModule()');
 assert.equal(run('loads'),2,'A loaded sales module must not be executed twice');
 console.log('Sales module recovery tests passed');
})().catch(e=>{console.error(e);process.exitCode=1});