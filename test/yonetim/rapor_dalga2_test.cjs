// Codex panel raporu dalga 2 (2026-10-11) sözleşme testleri.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const kok=path.join(__dirname,'../..'),oku=f=>fs.readFileSync(path.join(kok,f),'utf8');
test('#11 push bildirimi içeriksiz: metin service worker\'da sabit, kişi/para bilgisi yok',()=>{
 const sw=oku('yonetim/sw.js');assert.match(sw,/İncelemen gereken yeni başvuru var\./);assert.doesNotMatch(sw,/event\.data|e\.data\.(json|text)/);
 const p=oku('yonetim/push.js');assert.match(p,/userVisibleOnly:true/);assert.match(p,/yonetim_push_abone_ol/);
});
test('#23 sessiz dinleme yayın yapmaz, SDK aynı sunucudan, kayıt uyarısı görünür',()=>{
 const s=oku('yonetim/oda-dinle.js');assert.doesNotMatch(s,/startPublishingStream|createStream|getUserMedia/);
 assert.match(s,/vendor\/zego-web-3\.12\.240\.js/);assert.match(s,/yönetim kaydına yazılır/);
 assert.ok(fs.existsSync(path.join(kok,'yonetim/vendor/zego-web-3.12.240.js')),'Zego paketi eksik');
 const g=oku('gizlilik/index.html');assert.match(g,/odadakilere\s+görünmeden dinleyebilir/);
});
test('#22 destek formu doğru şemaya gider, bal küpü alanı ve sınır mesajı var',()=>{
 const f=oku('destek/form.js');assert.match(f,/'Content-Profile':'public'/);assert.match(f,/rpc\/destek_formu_gonder/);assert.match(f,/HOURLY_LIMIT/);assert.match(f,/sb_publishable_/);
 assert.match(oku('destek/index.html'),/name="web" tabindex="-1"/);
});
test('#24 yan hesap kararı seçimsiz gönderilmez',()=>{const s=oku('yonetim/yan-hesap.js');assert.match(s,/<option value="" selected disabled>Karar seç…<\/option>/);assert.match(s,/secim!=='true'&&secim!=='false'/);});
