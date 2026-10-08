/* Saf form sözleşmesi: yalnız değişen, izinli alanlar. */
(function(root){
 'use strict';
 function patch(previous, enabled, rawUsers){
  const users=[...new Set(rawUsers.split(/\s+/).filter(Boolean).map(x=>x.toLowerCase()))];
  if(users.length>1000||users.some(x=>! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(x)))throw new Error('Test hesapları geçerli UUID olmalı (en çok 1000).');
  const out={};
  if(Boolean(previous.anka_hazinesi)!==enabled)out.anka_hazinesi=enabled;
  const before=[...new Set((previous.test_kullanicilari||[]).map(x=>String(x).toLowerCase()))].sort();
  if(JSON.stringify(before)!==JSON.stringify([...users].sort()))out.test_kullanicilari=users;
  return out;
 }
 root.PuffyOyunAyari={patch};
 if(typeof module!=='undefined')module.exports={patch};
})(typeof window==='undefined'?globalThis:window);
