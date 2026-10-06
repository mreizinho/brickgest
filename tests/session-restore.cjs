const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const storage = new Map();
const context = vm.createContext({
  console,
  document: { addEventListener() {} },
  window: { addEventListener() {} },
  sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
});
const source = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8')
  .replace(/writeAppHistory\("home", true\);\s*restoreSession\(\);\s*$/, '');
vm.runInContext(source, context);
const run = code => vm.runInContext(code, context);
run(`render=()=>{};scheduleGoogleTokenRefresh=()=>{};
  function seedToken(seconds=3600) {
    sessionStorage.setItem(TOKEN_KEY,'valid-token');
    sessionStorage.setItem(TOKEN_SCOPE_KEY,GOOGLE_OAUTH_SCOPE);
    sessionStorage.setItem(TOKEN_EXPIRES_KEY,String(Date.now()+seconds*1000));
  }`);
(async () => {
  for (const error of ['Failed to fetch', 'SHEETS_ERROR_503', 'USERINFO_ERROR', 'NO_ACCESS', 'MOVEMENTS_SHEET_NOT_FOUND']) {
    run(`seedToken();loadCatalog=async()=>{throw new Error(${JSON.stringify(error)})}`);
    await run('restoreSession()');
    assert.equal(run('sessionStorage.getItem(TOKEN_KEY)'), 'valid-token');
    assert.equal(run('state.checkingCredentials'), false);
    assert.match(run('state.loginError'), /autorização foi mantida/);
  }
  run(`loadCatalog=async token=>{if(token!=='valid-token')throw new Error('Unexpected token');state.loggedIn=true;state.userEmail='test@example.com'};`);
  await run('restoreSession()');
  assert.equal(run('state.accessToken'), 'valid-token');
  assert.equal(run('state.loggedIn'), true);
  run(`state.mode='lote';state.batch={...emptyBatchState(),movementType:'transferencia',phase:'select'};
    let transferReloads=0;loadTransferSelection=async()=>{transferReloads++;transferSelection.error='';transferSelection.authRequired=false};
    transferSelection.error='Login required';transferSelection.authRequired=true;`);
  await run('restoreSession()');
  assert.equal(run('transferReloads'), 1);
  assert.equal(run('transferSelection.error'), '');
  run(`transferSelection.error='Expired';transferSelection.authRequired=true;state.accessToken='expired-token'`);
  assert.ok(run(`transferSelectionMarkup().includes('data-action="login"')`));
  run(`transferSelection.authRequired=false`);
  assert.ok(run(`transferSelectionMarkup().includes('data-action="transfer-reload"')`));
  run(`state.mode=null`);
  // A valid token near expiry should still survive a reload.
  run('seedToken(20)');
  await run('restoreSession()');
  assert.equal(run('sessionStorage.getItem(TOKEN_KEY)'), 'valid-token');
  run(`loadCatalog=async()=>{throw new Error('AUTH_EXPIRED')}`);
  await run('restoreSession()');
  assert.equal(run('sessionStorage.getItem(TOKEN_KEY)'), null);
  assert.equal(run('state.loggedIn'), false);
  run('seedToken(-1)');
  await run('restoreSession()');
  assert.equal(run('sessionStorage.getItem(TOKEN_KEY)'), null);
  run(`seedToken();let retried=false;restoreSession=async()=>{retried=true};requestGoogleAccessToken=()=>{throw new Error('Should not request OAuth')}`);
  run('loginWithGoogle()');
  assert.equal(run('retried'), true);
  console.log('Session restore tests passed: valid reload, transient failures, retry without OAuth, expiry and HTTP 401.');
})().catch(error => { console.error(error); process.exitCode=1; });
