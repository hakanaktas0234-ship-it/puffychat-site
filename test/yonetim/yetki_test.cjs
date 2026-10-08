const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../yonetim/phase3.js'),'utf8'),sandbox);const api=sandbox.window.PuffyPhase3;
for(const role of ['owner','admin','super_admin','official','normal'])test('Y03 düğme matrisi: '+role,()=>{
 const allowed=role==='owner';const ctx={profile:{id:'target'},user:{id:'actor'},caps:{owner:allowed,super:role==='super_admin',admin:role==='admin',actions:{account_manage:allowed}}};
 assert.equal(api.buttons(ctx).includes('data-action="role"'),allowed);
 assert.equal(Object.keys(api.tabs(ctx)).includes('operations'),allowed);
});
