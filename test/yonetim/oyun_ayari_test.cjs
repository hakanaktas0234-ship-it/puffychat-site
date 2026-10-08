const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const web=process.env.PUFFY_WEB_ROOT||path.resolve(__dirname,'../..');
const {patch}=require(path.join(web,'yonetim/oyun-ayari.js'));
const user='12345678-1234-1234-1234-123456789abc';
test('Y01: Anka değişikliği diğer oyunları ve test hesaplarını göndermez',()=>{
 const old={okey:true,garaj:true,mahzen:true,carsi:true,anka_hazinesi:false,test_kullanicilari:[user],future:{on:true}};
 const changes=patch(old,true,user);
 assert.deepEqual(changes,{anka_hazinesi:true});
 assert.deepEqual({...old,...changes},{...old,anka_hazinesi:true});
 assert.equal(old.anka_hazinesi,false);
});
test('yalnız test hesabı değişikliği; açık/kapalı bayrak gönderilmez',()=>{
 assert.deepEqual(patch({anka_hazinesi:true},true,user),{test_kullanicilari:[user]});
});
test('aynı kullanıcı kümesi ve aynı bayrak no-op',()=>{
 assert.deepEqual(patch({anka_hazinesi:true,test_kullanicilari:[user]},true,user.toUpperCase()+'\n'+user),{});
});
test('test listesi açıkça boşaltılabilir',()=>assert.deepEqual(patch({test_kullanicilari:[user]},false,''),{test_kullanicilari:[]}));
test('sahte UUID ve taşan kullanıcı listesi reddedilir',()=>{
 assert.throws(()=>patch({},true,'------------------------------------'),/UUID/);
 const list=Array.from({length:1001},(_,i)=>`12345678-1234-1234-1234-${String(i).padStart(12,'0')}`).join('\n');
 assert.throws(()=>patch({},true,list),/1000/);
});
