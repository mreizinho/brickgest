const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const listeners = {};
let toast = '', duration = 0;
const app = { querySelector: () => null, insertAdjacentHTML: (_, html) => { toast = html; } };
const context = vm.createContext({
  console,
  document: { addEventListener(type, fn) { (listeners[type] ||= []).push(fn); }, querySelector: selector => selector === '#app' ? app : null },
  window: { addEventListener() {}, clearTimeout() {}, setTimeout(_, delay) { duration = delay; return 1; } },
});
const source = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8')
  .replace(/writeAppHistory\("home", true\);\s*restoreSession\(\);\s*$/, '');
vm.runInContext(source, context);
(async () => {
  let completeImport, completeReload;
  context.importPromise = new Promise(resolve => { completeImport = resolve; });
  context.reloadPromise = new Promise(resolve => { completeReload = resolve; });
  vm.runInContext('render = () => {}; writeAppHistory = () => {}; runBricksetImport = () => importPromise; loadCatalog = () => reloadPromise; state.loggedIn = true; state.accessToken = "test";', context);
  const pending = listeners.click.at(-1)({ target: { closest: selector => selector === '[data-action]' ? { dataset: { action: 'run-brickset-update' } } : null } });
  vm.runInContext('state.mode = "consulta";', context);
  completeImport();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(toast, /terminou com sucesso/);
  assert.equal(vm.runInContext('state.catalogUpdating', context), false);
  assert.equal(vm.runInContext('state.mode', context), 'consulta');
  assert.equal(duration, 10000);
  completeReload();
  await pending;
  console.log('Brickset toast tests passed: completion appears on another screen before catalog reload completes.');
})().catch(error => { console.error(error); process.exitCode = 1; });
