const {test}=require('node:test');
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const {Session}=require('../../yonetim/guvenli-oturum.js');
const URL_BASE='https://example.supabase.co';
function storage(){const m=new Map();return {get length(){return m.size;},key:i=>[...m.keys()][i],getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),m};}
function harness(){
  const store=storage(),locks=[],reauth=[],requests=[];let clock=1000000;
  let network=async()=>new Response('{}',{status:200});
  const s=new Session({url:URL_BASE,storage:store,crypto:webcrypto,now:()=>clock,
    fetch:async(input,init)=>{requests.push([input,init]);return network(input,init);},onLock:x=>locks.push(x),onReauth:x=>reauth.push(x)});
  const lease=()=>({ok:true,server_now:new Date(clock).toISOString(),expires_at:new Date(clock+8*3600000).toISOString(),idle_expires_at:new Date(clock+900000).toISOString()});
  const calls=[];
  const sb={rpc:async(name,args)=>{calls.push([name,args]);return {data:lease()};},auth:{stopAutoRefresh(){},signOut:async()=>({error:null})}};
  return {s,store,locks,reauth,requests,calls,sb,lease,network:f=>network=f,advance:n=>clock+=n};
}
test('JWT is insufficient: bound key is attached only to the intended API origin',async()=>{
  const h=harness();await h.s.open(h.sb);
  try{
    await h.s.fetch(URL_BASE+'/rest/v1/rpc/test',{headers:{apikey:'public',Authorization:'Bearer jwt'}});
    assert.match(h.requests[0][1].headers.get('x-puffy-panel-key'),/^[0-9a-f]{64}$/);
    assert.equal(h.requests[0][1].headers.get('Authorization'),'Bearer jwt');
    await h.s.fetch('https://unrelated.example/rest/v1/test',{headers:{}});
    assert.equal(h.requests[1][1].headers['x-puffy-panel-key'],undefined);
    await h.s.fetch(URL_BASE+'/auth/v1/user',{headers:{}});
    assert.equal(h.requests[2][1].headers['x-puffy-panel-key'],undefined);
  }finally{h.s.stop();}
});
test('locked state refuses data requests before they reach the network',async()=>{
  const h=harness();h.s.ensureKey();await assert.rejects(h.s.fetch(URL_BASE+'/rest/v1/rpc/yonetim_yetkilerim'),/LOCKED/);
  assert.equal(h.requests.length,0);
  await h.s.fetch(URL_BASE+'/rest/v1/rpc/yonetim_guvenli_giris_hakki');assert.equal(h.requests.length,1);
});
test('remote takeover immediately locks and invalidates in-flight UI responses',async()=>{
  const h=harness();await h.s.open(h.sb);
  const version=h.s.epoch;
  h.network(async()=>new Response(JSON.stringify({message:'PANEL_SESSION_REVOKED'}),{status:403}));
  await h.s.fetch(URL_BASE+'/rest/v1/rpc/yonetim_kullanicilar');
  assert.equal(h.s.active,false);assert.ok(h.s.epoch>version);assert.equal(h.store.getItem('puffy_panel_locked_v1'),'1');
  assert.equal(h.locks.length,1);
});
test('MFA step-up pauses data access and requests fresh TOTP without resending a financial operation',async()=>{
  const h=harness();await h.s.open(h.sb);
  h.network(async()=>new Response(JSON.stringify({message:'MFA_REAUTH_REQUIRED'}),{status:403}));
  await h.s.fetch(URL_BASE+'/rest/v1/rpc/platform_coin_islemi',{method:'POST'});
  assert.equal(h.s.active,false);assert.equal(h.reauth.length,1);assert.equal(h.requests.length,1);
  assert.match(h.s.key,/^[0-9a-f]{64}$/);assert.equal(h.locks.length,0);
});
test('network failure closes the panel instead of treating it as an authenticated state',async()=>{
  const h=harness();await h.s.open(h.sb);h.network(async()=>{throw Error('offline');});
  await assert.rejects(h.s.fetch(URL_BASE+'/rest/v1/rpc/yonetim_kullanicilar'),/offline/);
  assert.equal(h.s.active,false);assert.equal(h.locks[0],'PANEL_CONNECTION_LOST');
});
test('logout error clears sessionStorage tokens, TOTP secret and key; reload remains locked',async()=>{
  const h=harness();await h.s.open(h.sb);
  for(const k of ['sb-test-auth-token','sb-test-auth-token-code-verifier','puffy_mfa'])h.store.setItem(k,'secret');
  h.sb.rpc=async()=>{throw Error('offline');};h.sb.auth.signOut=async()=>({error:Error('offline')});
  const pending=h.s.end(h.sb);assert.equal(h.store.getItem('puffy_panel_locked_v1'),'1');
  const result=await pending;assert.deepEqual(result,{revoked:false,signedOut:false});
  assert.equal(h.store.getItem('sb-test-auth-token'),null);assert.equal(h.store.getItem('puffy_mfa'),null);assert.equal(h.s.key,'');
  // An SDK refresh that completes late may write a token, but the persisted lock
  // clears it BEFORE the next client is constructed and can restore a session.
  h.store.setItem('sb-test-auth-token','late-token');
  const next=new Session({url:URL_BASE,storage:h.store,fetch:fetch,crypto:webcrypto});
  assert.equal(next.wasLocked(),true);assert.equal(h.store.getItem('sb-test-auth-token'),null);
});
test('logout is idempotent and simultaneous failures do not send duplicate revocations',async()=>{
  const h=harness();await h.s.open(h.sb);let count=0;
  h.sb.rpc=async()=>{count++;return {data:{ok:true,revoked:true}};};
  const a=h.s.end(h.sb),b=h.s.end(h.sb);assert.equal(a,b);await a;assert.equal(count,1);
});
test('a new credential login waits for pending logout, so old cleanup cannot erase new credentials',async()=>{
  const h=harness();h.s.ensureKey();let resolve;
  h.sb.rpc=()=>new Promise(r=>resolve=r);const end=h.s.end(h.sb);
  assert.throws(()=>h.s.freshLogin(),/LOGOUT_IN_PROGRESS/);
  resolve({data:{ok:true,revoked:true}});await end;assert.doesNotThrow(()=>h.s.freshLogin());
});
test('fake DOM activity and background heartbeat cannot claim user activity',async()=>{
  const h=harness();await h.s.open(h.sb);
  try{h.s.touch({isTrusted:false});await h.s.check();assert.equal(h.calls.at(-1)[1].p_aktif,false);
    h.advance(16000);h.s.touch({isTrusted:true});await new Promise(r=>setImmediate(r));
    assert.equal(h.calls.at(-1)[1].p_aktif,true);
  }finally{h.s.stop();}
});
test('expired server deadline cannot be resurrected by a click or visibility return',async()=>{
  const h=harness();await h.s.open(h.sb);const count=h.calls.length;
  h.advance(900001);h.s.touch({isTrusted:true});await h.s.check();
  assert.equal(h.s.active,false);assert.equal(h.locks[0],'PANEL_SESSION_EXPIRED');assert.equal(h.calls.length,count);
});
test('server response arriving after logout never reopens the lease',async()=>{
  const h=harness();let resolve;
  h.sb.rpc=()=>new Promise(r=>resolve=r);const open=h.s.open(h.sb);h.s.stop();resolve({data:h.lease()});
  await assert.rejects(open,/STALE_SESSION/);assert.equal(h.s.active,false);
});
test('heartbeat response arriving after lock never changes the visible session',async()=>{
  const h=harness();await h.s.open(h.sb);let resolve;h.sb.rpc=()=>new Promise(r=>resolve=r);
  const pending=h.s.check();h.s.lock('PANEL_SESSION_REVOKED');resolve({data:h.lease()});await pending;
  assert.equal(h.s.active,false);assert.equal(h.s.timer,null);
});
test('a late MFA callback cannot reopen a persistently locked panel without a new credential login',async()=>{
  const h=harness();h.s.ensureKey();h.s.lock('PANEL_SESSION_REVOKED');const count=h.calls.length;
  await assert.rejects(h.s.open(h.sb),/PANEL_SESSION_LOCKED/);assert.equal(h.calls.length,count);
  h.s.freshLogin();await h.s.open(h.sb);h.s.stop();
});
test('storage failure rejects entry, rather than silently losing revocation state',async()=>{
  const blocked={getItem(){throw Error('blocked');}};
  const s=new Session({url:URL_BASE,storage:blocked,fetch:fetch,crypto:webcrypto});
  assert.equal(s.wasLocked(),true);await assert.rejects(s.open({}),/PANEL_STORAGE_REQUIRED/);
});
test('a fresh credential login rotates the browser key and deliberately clears the lock',async()=>{
  const h=harness();h.s.ensureKey();const old=h.s.key;h.store.setItem('puffy_panel_locked_v1','1');
  h.s.freshLogin();assert.equal(h.s.wasLocked(),false);h.s.ensureKey();assert.notEqual(h.s.key,old);
});
test('malformed lease response cannot produce an authenticated screen',async()=>{
  const h=harness();h.sb.rpc=async()=>({data:{ok:true,server_now:'bad',expires_at:'bad',idle_expires_at:'bad'}});
  await assert.rejects(h.s.open(h.sb),/INVALID_RESPONSE/);assert.equal(h.s.active,false);
});
test('hung revocation and hung signOut still finish with a persisted local lock',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const h=harness();h.s.ensureKey();h.store.setItem('sb-test-auth-token','token');
  h.sb.rpc=()=>new Promise(()=>{});h.sb.auth.signOut=()=>new Promise(()=>{});
  const end=h.s.end(h.sb);assert.equal(h.store.getItem('puffy_panel_locked_v1'),'1');
  t.mock.timers.tick(8001);await new Promise(r=>setImmediate(r));
  t.mock.timers.tick(5001);const result=await end;
  assert.deepEqual(result,{revoked:false,signedOut:false});assert.equal(h.store.getItem('sb-test-auth-token'),null);
});
test('in-flight Auth refresh is cancelled on lock; authentication never receives the binding secret',async()=>{
  const h=harness();h.s.ensureKey();let aborted=false;
  h.network((_,init)=>new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>{aborted=true;reject(Error('aborted'));})));
  const refresh=h.s.fetch(URL_BASE+'/auth/v1/token',{headers:{'content-type':'application/json'}});
  h.s.lock('PANEL_SESSION_REVOKED');await assert.rejects(refresh,/aborted/);
  assert.equal(aborted,true);assert.equal(h.requests[0][1].headers['x-puffy-panel-key'],undefined);
});

const fs=require('node:fs'),path=require('node:path'),cryptoModule=require('node:crypto');
test('session security module SRI matches the deployed source bytes',()=>{
 const dir=path.join(__dirname,'../../yonetim'),html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 const hash='sha384-'+cryptoModule.createHash('sha384').update(fs.readFileSync(path.join(dir,'guvenli-oturum.js'))).digest('base64');
 assert.match(html,new RegExp('guvenli-oturum\\.js[^>]+integrity="'+hash.replace(/[+]/g,'\\+')+'"'));
});
test('Google PKCE and new-browser MFA preparation stay in the panel entry flow',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../yonetim/index.html'),'utf8');
 assert.ok(html.includes("flowType:'pkce'"));assert.ok(html.includes('if(girisHakki.needs_mfa){zorla=true;'));
 assert.ok(html.includes('puffyPanelOturum.ensureKey();'));assert.ok(html.includes('puffyPanelOturum.wasLocked()'));
});
