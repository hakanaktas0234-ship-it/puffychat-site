const {test}=require('node:test');const assert=require('node:assert/strict');const {Journal}=require('../../yonetim/finans-istek.js');
function storage(){const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};}
const args={p_hedef:'user',p_miktar:100,p_request_id:'request-1',p_odeme_sifresi:'secret'};
test('Y18: commit sonrası yanıt kaybı ve yenileme aynı kimlikle tek bakiye hareketi üretir',()=>{
 const disk=storage(),applied=new Map();let balance=0;
 const server=p=>{if(!applied.has(p.p_request_id)){balance+=p.p_miktar;applied.set(p.p_request_id,{ok:true});}return applied.get(p.p_request_id);};
 const initial=new Journal(disk,'owner');const p=initial.prepare('platform_coin_islemi',args);server(p); // yanıt düşürüldü
 const restored=new Journal(disk,'owner');const retry=restored.prepare('platform_coin_islemi',{...args,p_request_id:'new-dialog'});
 assert.equal(retry.p_request_id,'request-1');assert.deepEqual(server(retry),{ok:true});assert.equal(balance,100);
 assert.equal(JSON.stringify(restored.list()).includes('secret'),false);restored.done(retry.p_request_id);assert.deepEqual(restored.list(),[]);
});
test('Y17: belirsiz işlemde tutar veya sebep değişimi engellenir',()=>{
 const j=new Journal(storage(),'owner');j.prepare('platform_coin_islemi',args);
 assert.throws(()=>j.prepare('platform_coin_islemi',{...args,p_miktar:101}),/CONFLICT/);
 assert.throws(()=>j.prepare('platform_coin_islemi',{...args,p_neden:'başka'}),/CONFLICT/);
});
test('farklı oturum kullanıcısı eski günlüğü görmez',()=>{const disk=storage();new Journal(disk,'a').prepare('platform_coin_islemi',args);assert.deepEqual(new Journal(disk,'b').list(),[]);});
test('kalıcı kayıt başarısızsa işlem hazırlanmaz',()=>{const j=new Journal({getItem:()=>null,setItem:()=>{throw Error('quota');}},'a');assert.throws(()=>j.prepare('platform_coin_islemi',args),/quota/);});
