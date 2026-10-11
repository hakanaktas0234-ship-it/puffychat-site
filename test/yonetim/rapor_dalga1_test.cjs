// Codex panel raporu dalga 1 (2026-10-11) kabul testleri.
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dir=path.join(__dirname,'../../yonetim'),read=f=>fs.readFileSync(path.join(dir,f),'utf8');

test('#05 CSP satır içi betik özeti güncel, çerçeve kilidi ve satır içi olay işleyicisi yok',()=>{
 const html=read('index.html');const meta=html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);assert.ok(meta,'CSP meta yok');
 const blocks=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);assert.ok(blocks.length>=1);
 for(const b of blocks){const h="'sha256-"+crypto.createHash('sha256').update(b,'utf8').digest('base64')+"'";assert.ok(meta[1].includes(h),'özet eski: python3 scripts/yonetim_csp_guncelle.py çalıştır');}
 assert.match(meta[1],/object-src 'none'/);assert.match(meta[1],/base-uri 'none'/);assert.doesNotMatch(meta[1],/'unsafe-eval'/);
 assert.match(html,/id="cerceve-kilidi">html\{display:none\}/);assert.match(html,/window\.top===window\.self/);
 assert.doesNotMatch(html,/\son(error|click|load)="/);
 for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.js')))assert.doesNotMatch(read(f),/\son(click|error|load)="/,f+' satır içi işleyici içeriyor');
});

function notices(storage){
 const elements=new Map(),win={listeners:{}};
 const el=s=>{if(!elements.has(s))elements.set(s,{innerHTML:'',textContent:'',value:0,checked:false,hidden:false,classList:{contains:()=>true,toggle(){}},setAttribute(){},insertAdjacentHTML(){},addEventListener(t,f){this[t]=f;},remove(){},after(){},focus(){},querySelector:q=>el(q)});return elements.get(s);};
 const alerts=[];const document={querySelector:el,createElement:()=>{const e=el('#approval-alert');alerts.push(e);return e;},addEventListener(){},removeEventListener(){}};
 const window={Notification:class{static permission='denied'},addEventListener(t,f){win.listeners[t]=f;},removeEventListener(){}};
 const ls={get length(){return storage.size;},key:i=>[...storage.keys()][i],getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v))};
 vm.runInNewContext(read('notifications.js'),{window,document,Notification:window.Notification,Date,Set,Map,BigInt,localStorage:ls,setTimeout,Promise});
 const api=window.PuffyNotifications,calls=[];
 const ctx={user:{id:'a'},esc:String,date:String,rpc:async(n,a)=>{calls.push([n,a]);return n==='yonetim_basvuru_olaylari_getir'?{rows:[]}:{ok:true};}};
 return {api,el,win,calls,alerts,init:()=>api.init(ctx,{keys:['profil_foto','sikayet'],allowed:()=>true,label:k=>k,path:(k,r)=>'#onay/'+k+(r?.kayit?'?id='+r.kayit:'')})};
}
const row=(id,extra={})=>({id,tur:'profil_foto',created_at:new Date().toISOString(),kayit:'job-'+id,kaynak:'moderation_jobs',...extra});

test('#07 iki sekme: okundu bilgisi geri dönmez, cursor geriye gitmez',async()=>{
 const shared=new Map(),A=notices(shared),B=notices(shared);A.init();B.init();
 A.api.accept({cursor:'1',rows:[row('1')]});B.api.accept({cursor:'1',rows:[row('1')]});
 await A.el('#approval-events').click({target:{closest:q=>q==='[data-notice]'?{dataset:{notice:'read-all'}}:null}});
 B.api.accept({cursor:'1',rows:[]});// B'nin eski kopyası okunmamış sanıyordu
 const saved=JSON.parse([...shared.entries()].find(([k])=>k.startsWith('puffy_notifications_v1:'))[1]);
 assert.equal(saved.records.find(r=>r.id==='1').read,true);
 A.api.accept({cursor:'5',rows:[row('5')]});B.api.accept({cursor:'2',rows:[]});
 assert.equal(JSON.parse([...shared.entries()].find(([k])=>k.startsWith('puffy_notifications_v1:'))[1]).cursor,'5');
});
test('#09 okundu sunucuya yazılır; sunucuda okunmuş olay okundu gelir',async()=>{
 const h=notices(new Map());h.init();h.api.accept({cursor:'3',rows:[row('2',{okundu:true}),row('3')]});
 assert.equal(h.el('#notice-unread').textContent,'1 okunmamış');
 await h.el('#approval-events').click({target:{closest:q=>q==='[data-notice]'?{dataset:{notice:'read-all'}}:null}});
 await new Promise(r=>setTimeout(r,5));
 assert.equal(JSON.stringify(h.calls.find(c=>c[0]==='yonetim_bildirim_okundu_isaretle')[1]),'{"p_ids":[3]}');
});
test('#10 bildirim bağlantısı başvurunun kendisini açar',()=>{
 const h=notices(new Map());h.init();h.api.accept({cursor:'7',rows:[row('7')]});assert.match(h.el('#notice-list').innerHTML,/#onay\/profil_foto\?id=job-7/);
});
test('#12 birikmiş olaylar tek özet uyarısıyla gelir',()=>{
 const h=notices(new Map());h.init();const before=h.alerts.length;
 for(let i=1;i<=3;i++)h.api.accept({cursor:String(i*100),more:i<3,rows:Array.from({length:100},(_,j)=>row(String((i-1)*100+j+1)))});
 assert.equal(h.alerts.length-before,1);
});
test('#13 karar formu seçimsiz açılır, seçim yoksa gönderilmez; #14 görsel/kanıt kapısı',()=>{
 const s=read('approvals.js');
 assert.match(s,/<select name="approve" required><option value="" selected disabled>Karar seç…<\/option>/);
 assert.match(s,/if\(choice!=='true'&&choice!=='false'\)/);
 assert.match(s,/if\(approve\)\{const why=mediaBlock\(dlg\)/);assert.match(s,/dlg\.dataset\.proofError='true'/);
});
test('#16 muhasebe: her sorgunun kendi sırası var',()=>{assert.match(read('ayarlar.js'),/n!==seq\|\|m!==istek\)return;/);});
test('#04 finans günlüğü sekme kapansa da kalır; eski sekme kaydı taşınır',()=>{
 const mk=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),m};};
 const session=mk(),local=mk(),g={crypto:{randomUUID:()=>'00000000-0000-4000-8000-000000000001'},sessionStorage:session,localStorage:local};g.globalThis=g;
 session.setItem('puffy.finans.v1.u',JSON.stringify([{id:'eski',name:'platform_coin_islemi',target:'x',params:{}}]));
 vm.runInNewContext(read('finans-istek.js'),g);
 const j=new g.PuffyFinans.Journal(session,'u');j.prepare('platform_vip_ver',{p_hedef:'y',p_tier:3,p_odeme_sifresi:'gizli'});
 const kayit=JSON.parse(local.getItem('puffy.finans.v1.u'));assert.equal(kayit.length,2);assert.equal(session.getItem('puffy.finans.v1.u'),null);
 assert.equal(JSON.stringify(kayit).includes('gizli'),false);
});
test('#17 okunur kart gizli alanları göstermez',()=>{
 const g={};g.globalThis=g;vm.runInNewContext(read('okunur.js'),g);
 const out=g.PuffyOkunur.html({esc:String,date:()=>'TARIH'},{durum:'bekliyor',iban:'TR00',access_token:'x',son_tarih:'2026-10-11T10:00:00Z',gecmis:[{karar:true}]});
 assert.match(out,/Durum/);assert.match(out,/TARIH/);assert.match(out,/Evet/);assert.doesNotMatch(out,/TR00|access/);
});
test('#21 rpc hatası olay numarasıyla kaydedilir; argümanlar gönderilmez',async()=>{
 const g={crypto:require('node:crypto').webcrypto,location:{hash:'#onay/profil_foto?id=1'},addEventListener(){},setTimeout,clearTimeout,Promise};g.globalThis=g;
 vm.runInNewContext(read('hata-izleme.js'),g);
 const sent=[];const sb={rpc(fn,args){sent.push([fn,args]);const res=fn==='bozuk'?{error:{message:'NOT_AUTHORIZED'}}:{data:1};return {then:(a,b)=>Promise.resolve(res).then(a,b)};}};
 g.PuffyHata.init({sb,caps:{}});const r=await sb.rpc('bozuk',{p_iban:'TR123'});assert.equal(r.error.message,'NOT_AUTHORIZED');
 const log=sent.find(s=>s[0]==='yonetim_hata_kaydet');assert.ok(log);assert.match(log[1].p_olay_no,/^[A-Z0-9]{8}$/);assert.equal(log[1].p_kod,'NOT_AUTHORIZED');assert.equal(log[1].p_sayfa,'onay/profil_foto');
 assert.equal(JSON.stringify(log[1]).includes('TR123'),false);
});
