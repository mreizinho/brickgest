const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const styles={setProperty(k,v){this[k]=v},removeProperty(k){delete this[k]}};
const c=vm.createContext({console,document:{documentElement:{style:styles},addEventListener(){}},window:{innerWidth:390,visualViewport:{height:844,scale:1,addEventListener(){}},addEventListener(){}}});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8').replace(/writeAppHistory\("home", true\);\s*restoreSession\(\);\s*$/,''),c);
assert.equal(styles['--app-visible-height'],'844px');
vm.runInContext('window.visualViewport.height=440;updateMobileViewportHeight()',c);assert.equal(styles['--app-visible-height'],'440px');
vm.runInContext('window.visualViewport.height=844;updateMobileViewportHeight()',c);assert.equal(styles['--app-visible-height'],'844px');
vm.runInContext('window.innerWidth=1280;updateMobileViewportHeight()',c);assert.equal(styles['--app-visible-height'],undefined);
console.log('Mobile keyboard viewport tests passed: opening, closing and desktop fallback');