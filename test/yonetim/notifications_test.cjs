const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(process.env.NOTICE_SOURCE||path.join(__dirname,'../../yonetim/notifications.js'),'utf8');
function harness({deniedStorage=false,notificationThrows=false,sharedStorage}={}){
 const elements=new Map(),storage=sharedStorage||new Map(),listeners={};
 const el=s=>{if(!elements.has(s))elements.set(s,{innerHTML:'',textContent:'',value:0,checked:false,hidden:false,classList:{contains:()=>true,toggle(){}},setAttribute(){},insertAdjacentHTML(){},addEventListener(type,fn){this[type]=fn;},remove(){},after(){},focus(){},querySelector:q=>el(q)});return elements.get(s);};
 class Notification{static permission='granted';constructor(){if(notificationThrows)throw Error('blocked');}static requestPermission(){return Promise.resolve('granted');}}
 const document={querySelector:el,createElement:el,addEventListener(type,fn){(listeners[type]??=new Set()).add(fn);},removeEventListener(type,fn){listeners[type]?.delete(fn);}};
 const window={Notification,addEventListener(){},removeEventListener(){}};
 vm.runInNewContext(source,{window,document,Notification,Date,Set,localStorage:{get length(){return storage.size;},key:i=>[...storage.keys()][i],getItem:k=>{if(deniedStorage)throw Error();return storage.get(k)||null;},setItem:(k,v)=>{if(deniedStorage)throw Error();storage.set(k,v);}}});
 const api=window.PuffyNotifications,options={keys:['sikayet','para_cekme'],allowed:k=>k==='sikayet',label:k=>k,path:k=>'#'+k};
 const init=id=>api.init({user:{id},esc:String,date:String},options);
 const batch=(id='1',tur='sikayet')=>({cursor:id,rows:[{id,tur,created_at:new Date().toISOString()}]});
 return {api,init,batch,el,storage,options,window,dispatch:async(type,event)=>{for(const fn of listeners[type]||[])await fn(event);}};
}
test('Yenileme geçmişi ve cursoru korur, aynı olay tekrar eklenmez',()=>{const h=harness();h.init('a');h.api.accept(h.batch());h.api.stop();h.init('a');assert.equal(h.api.getCursor(),'1');assert.equal(h.el('#notice-unread').textContent,'1 okunmamış');h.api.accept(h.batch());assert.equal(h.el('#notice-unread').textContent,'1 okunmamış');});
test('Farklı yönetici geçmişi göremez; yetkisiz kategori alınmaz',()=>{const h=harness();h.init('a');h.api.accept(h.batch());h.init('b');assert.equal(h.api.getCursor(),null);assert.equal(h.el('#notice-unread').textContent,'0 okunmamış');h.api.accept(h.batch('2','para_cekme'));assert.equal(h.el('#notice-unread').textContent,'0 okunmamış');});
test('Masaüstü bildirimi başarısız olsa da cursor ilerler',()=>{const h=harness({notificationThrows:true});h.init('a');assert.doesNotThrow(()=>h.api.accept(h.batch()));assert.equal(h.api.getCursor(),'1');assert.match(h.el('#notice-desktop-error').textContent,/gösterilemedi/);});
test('Depolama engeli görünür olur ve oturum bildirimleri çalışır',()=>{const h=harness({deniedStorage:true});h.init('a');h.api.accept(h.batch());assert.equal(h.el('#notice-unread').textContent,'1 okunmamış');assert.match(h.el('#notice-storage').textContent,/kaydedilemiyor/);});
test('Bozuk geçmiş güvenli biçimde sıfırlanır',()=>{const h=harness();h.init('a');h.api.accept(h.batch());h.storage.set([...h.storage.keys()][0],'{broken');assert.doesNotThrow(()=>h.init('a'));assert.equal(h.api.getCursor(),null);});
test('Geçmiş 100 ile sınırlı, bekleyen sayaç okunmamış sayıyı değiştirmez',()=>{const h=harness();h.init('a');for(let i=1;i<=110;i++)h.api.accept(h.batch(String(i)));h.api.setPending(987);const saved=JSON.parse([...h.storage.values()][0]);assert.equal(saved.records.length,100);assert.equal(h.el('#approval-total').textContent,'99+');assert.equal(h.el('#notice-pending').textContent,'987 karar bekliyor →');});

test('Okundu durumu yenilemede korunur',async()=>{const h=harness();h.init('a');h.api.accept(h.batch());await h.el('#approval-events').click({target:{closest:q=>q==='[data-notice]'?{dataset:{notice:'read-all'}}:null}});assert.equal(h.el('#notice-unread').textContent,'0 okunmamış');h.init('a');assert.equal(h.el('#notice-unread').textContent,'0 okunmamış');});
test('Ses kullanıcı etkileşiminde resume edilir ve iki ton çalar',async()=>{const h=harness();let resumes=0,tones=0;h.window.AudioContext=class{state='suspended';currentTime=0;resume(){resumes++;this.state='running';return Promise.resolve();}close(){return Promise.resolve();}createOscillator(){return {frequency:{},connect(){},start(){tones++;},stop(){},disconnect(){}};}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}};h.init('a');await h.el('#approval-events').click({target:{closest:q=>q==='[data-notice]'?{dataset:{notice:'test'}}:null}});assert.equal(resumes,1);assert.equal(tones,2);assert.match(h.el('#notice-audio-state').textContent,/Deneme sesi/);});

test('Zil rozeti bekleyen kararları gösterir, okundu işaretleme sayıyı düşürmez',async()=>{const h=harness();h.init('a');h.api.setPending(4);assert.equal(h.el('#approval-total').textContent,'4');await h.el('#approval-events').click({target:{closest:q=>q==='[data-notice]'?{dataset:{notice:'read-all'}}:null}});assert.equal(h.el('#approval-total').textContent,'4');h.api.setPending(0);assert.equal(h.el('#approval-total').textContent,'0');});

function audioProbe(h){
 const probe={resumes:0,tones:0};
 h.window.AudioContext=class{state='suspended';currentTime=0;resume(){probe.resumes++;this.state='running';return Promise.resolve();}close(){return Promise.resolve();}createOscillator(){return {frequency:{},connect(){},start(){probe.tones++;},stop(){},disconnect(){}};}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}};
 return probe;
}
test('Yenileme sonrası ilk gerçek etkileşim sesi hazırlar; yeni profil fotoğrafı iki ton çalar',async()=>{
 const h=harness(),a=audioProbe(h);h.init('a');await h.el('#notice-sound').onchange({target:{checked:true}});h.init('a');
 assert.equal(h.el('#notice-audio-ready').textContent,'Sesi etkinleştir');
 const tones=a.tones;await h.dispatch('pointerdown',{isTrusted:false,target:{closest:()=>true}});assert.equal(a.resumes,1);
 await h.dispatch('pointerdown',{isTrusted:true,target:{closest:()=>true}});assert.equal(a.resumes,2);assert.equal(a.tones,tones);assert.equal(h.el('#notice-audio-ready').textContent,'Ses hazır');
 h.options.allowed=()=>true;h.api.accept(h.batch('8','profil_foto'));assert.equal(a.tones,tones+2);assert.match(h.el('#notice-list').innerHTML,/#profil_foto/);
});
test('Ses tercihi yeni yetki listesi eklendiğinde korunur; başka hesaba taşınmaz',async()=>{
 const h=harness();audioProbe(h);h.init('a');await h.el('#notice-sound').onchange({target:{checked:true}});
 h.options.keys.push('profil_foto');h.options.allowed=()=>true;h.init('a');assert.equal(h.el('#notice-sound').checked,true);h.init('b');assert.equal(h.el('#notice-sound').checked,false);
});
test('Önceki sürümün farklı kapsamındaki ses tercihi aktarılır',()=>{
 const h=harness();h.storage.set('puffy_notifications_v1:a:eski',{toString:()=>JSON.stringify({sound:true,volume:.8})});h.init('a');assert.equal(h.el('#notice-sound').checked,true);assert.equal(h.el('#notice-volume').value,80);
});
test('İlk açılış geçmişi görünür ama eski kayıtlar ses ve masaüstü uyarısı üretmez',async()=>{
 const h=harness({notificationThrows:true}),a=audioProbe(h);h.init('a');await h.el('#notice-sound').onchange({target:{checked:true}});h.init('a');await h.dispatch('keydown',{isTrusted:true,key:'a'});
 const tones=a.tones;h.api.accept({...h.batch('8'),bootstrap:true});assert.equal(h.el('#notice-unread').textContent,'1 okunmamış');assert.equal(a.tones,tones);assert.equal(h.el('#notice-desktop-error').textContent,'');
 h.api.accept(h.batch('9'));assert.equal(a.tones,tones+2);
});
test('Eski yanıt cursoru geriye çekemez ve arşivden düşen olay yeniden bildirilmez',()=>{
 const h=harness();h.init('a');for(let i=1;i<=110;i++)h.api.accept(h.batch(String(i)));h.api.accept(h.batch('1'));assert.equal(h.api.getCursor(),'110');assert.equal(h.el('#notice-unread').textContent,'100 okunmamış');
});
