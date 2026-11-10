const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c=vm.createContext({console,document:{addEventListener(){}},window:{addEventListener(){}}});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8').replace(/writeAppHistory\("home", true\);\s*restoreSession\(\);\s*$/,''),c);
const run=s=>vm.runInContext(s,c);
run(`state.consultation={...emptyConsultationState(),loaded:true,items:[['10',100],['2',200],['30',null],['4',0],['12',100]].map(([code,value])=>({code,value,name:code,theme:'',origins:[],observations:[],locations:[{storage:'Loja',stock:1}],stock:1}))};`);
for(const [order,expected] of [['set-asc','2,4,10,12,30'],['set-desc','30,12,10,4,2'],['value-asc','4,10,12,2,30'],['value-desc','2,10,12,4,30']]){
run(`state.consultation.sort=${JSON.stringify(order)}`);
assert.equal(run(`consultationResults().map(x=>x.code).join(',')`),expected,order);
}
assert.equal(run(`state.consultation.items.map(x=>x.code).join(',')`),'10,2,30,4,12','sorting must not reorder source data');
run(`state.consultation.appliedFilters.set='1'`);
assert.equal(run(`consultationResults().map(x=>x.code).join(',')`),'10,12','sort keeps applied filters');
assert.equal(run(`consultationResults(state.consultation.items,emptyConsultationFilters()).map(x=>x.code).join(',')`),'2,4,10,12,30','transfer selection retains number order');
console.log('Consultation sort: numeric set order, both PVR directions, zero, missing values, ties, filtering and source preservation passed.');
