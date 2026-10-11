/* Finansal istek günlüğü. Şifre saklanmaz; belirsiz istek yeni kimlikle gönderilmez. */
(function(root){
 'use strict';
 const operations=new Set(['platform_coin_islemi','platform_vip_ver','platform_bayi_stok_islemi','yonetim_odeme_islemi']);
 const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 const clean=p=>Object.fromEntries(Object.entries(p).filter(([k])=>!['p_odeme_sifresi','p_request_id'].includes(k)));
 // #04 (2026-10-11): günlük sekme kapanınca kaybolmasın. sessionStorage verilirse
 // kalıcı localStorage kullanılır; o sekmede kalan eski kayıtlar bir kez taşınır.
 // Şifre ve istek kimliği dışı gizli alan saklanmaz (clean). Sunucu tarafı kurtarma:
 // yonetim_son_isteklerim (Ödeme takibi → Son finans isteklerim).
 function durable(storage,key){
  try{
   const local=root.localStorage,session=root.sessionStorage;
   if(!local||storage!==session)return storage;
   const old=session.getItem(key);
   if(old){const a=JSON.parse(old),b=JSON.parse(local.getItem(key)||'[]');if(Array.isArray(a)&&Array.isArray(b)){const ids=new Set(b.map(r=>r.id));local.setItem(key,JSON.stringify([...b,...a.filter(r=>!ids.has(r.id))]));}session.removeItem(key);}
   return local;
  }catch{return storage;}
 }
 class Journal {
  constructor(storage,user){this.key='puffy.finans.v1.'+user;this.storage=durable(storage,this.key);}
  list(){const data=JSON.parse(this.storage.getItem(this.key)||'[]');if(!Array.isArray(data))throw new Error('REQUEST_JOURNAL_INVALID');return data;}
  save(rows){this.storage.setItem(this.key,JSON.stringify(rows));}
  prepare(name,params){
   const rows=this.list(),safe=clean(params),target=safe.p_hedef||safe.p_bayi||safe.p_id||'',existing=rows.find(r=>r.name===name&&r.target===target);
   if(existing){if(canonical(existing.params)!==canonical(safe))throw new Error('PENDING_REQUEST_CONFLICT');return {...params,p_request_id:existing.id};}
   const id=params.p_request_id||root.crypto.randomUUID();
   rows.push({id,name,target,params:safe,created:new Date().toISOString()});this.save(rows);return {...params,p_request_id:id};
  }
  done(id){this.save(this.list().filter(r=>r.id!==id));}
 }
 root.PuffyFinans={Journal,operations,canonical};
 if(typeof module!=='undefined')module.exports=root.PuffyFinans;
})(typeof window==='undefined'?globalThis:window);
