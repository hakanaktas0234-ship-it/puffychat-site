/* Finansal istek günlüğü. Şifre saklanmaz; belirsiz istek yeni kimlikle gönderilmez. */
(function(root){
 'use strict';
 const operations=new Set(['platform_coin_islemi','platform_vip_ver','platform_bayi_stok_islemi']);
 const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 const clean=p=>Object.fromEntries(Object.entries(p).filter(([k])=>!['p_odeme_sifresi','p_request_id'].includes(k)));
 class Journal {
  constructor(storage,user){this.storage=storage;this.key='puffy.finans.v1.'+user;}
  list(){const data=JSON.parse(this.storage.getItem(this.key)||'[]');if(!Array.isArray(data))throw new Error('REQUEST_JOURNAL_INVALID');return data;}
  save(rows){this.storage.setItem(this.key,JSON.stringify(rows));}
  prepare(name,params){
   const rows=this.list(),safe=clean(params),target=safe.p_hedef||safe.p_bayi||'',existing=rows.find(r=>r.name===name&&r.target===target);
   if(existing){if(canonical(existing.params)!==canonical(safe))throw new Error('PENDING_REQUEST_CONFLICT');return {...params,p_request_id:existing.id};}
   const id=params.p_request_id||root.crypto.randomUUID();
   rows.push({id,name,target,params:safe,created:new Date().toISOString()});this.save(rows);return {...params,p_request_id:id};
  }
  done(id){this.save(this.list().filter(r=>r.id!==id));}
 }
 root.PuffyFinans={Journal,operations,canonical};
 if(typeof module!=='undefined')module.exports=root.PuffyFinans;
})(typeof window==='undefined'?globalThis:window);
