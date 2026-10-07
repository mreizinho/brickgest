const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const listeners={};
const context=vm.createContext({console,document:{addEventListener(type,fn){(listeners[type] ||= []).push(fn)}},window:{addEventListener(){}}});
const source=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8').replace(/writeAppHistory\("home", true\);\s*restoreSession\(\);\s*$/, '');
vm.runInContext(source,context);
const markup=vm.runInContext('consultationFilterMarkup()',context);
assert.ok(markup.includes('<form class="consultation-filter-grid" data-consultation-form>'));
assert.ok(markup.includes('type="submit" class="primary" data-action="consultation-apply"'));
assert.ok(markup.includes('enterkeyhint="search"'));
let clicks=0,prevented=0;
const target={matches:()=>true,querySelector:()=>({click(){clicks++}})};
listeners.submit.at(-1)({target,preventDefault(){prevented++}});
assert.equal(clicks,1);assert.equal(prevented,1);
listeners.submit.at(-1)({target:{matches:()=>false},preventDefault(){prevented++}});
assert.equal(clicks,1);assert.equal(prevented,1);
console.log('Consultation submit tests passed: native form submission forwards to Consultar, search keyboard hint, unrelated forms ignored.');

assert.ok(vm.runInContext(`consultationClearButton('set','Set','10255').includes('data-clear-filter="set"')`,context));
assert.ok(!vm.runInContext(`consultationClearButton('set','Set','10255').includes(' hidden')`,context));
assert.ok(vm.runInContext(`consultationClearButton('set','Set','').includes(' hidden')`,context));
assert.ok(!vm.runInContext(`consultationClearButton('valueMin','PVR',0).includes(' hidden')`,context));

assert.ok(markup.indexOf('data-consultation-filter="theme"') < markup.indexOf('data-consultation-filter="storage"'));
assert.ok(markup.indexOf('data-consultation-filter="storage"') < markup.indexOf('data-consultation-filter="origin"'));
