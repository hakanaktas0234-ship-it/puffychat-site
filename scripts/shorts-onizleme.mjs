import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {render,UUID} from './shorts-template.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const endpoint='https://rjdddbwotczhagdulwco.supabase.co/rest/v1/rpc/short_paylasim_onizleme';
const key=process.env.SUPABASE_PUBLISHABLE_KEY||'sb_publishable_TMb-Ldq66Pi3ehxPSYB8JA_aQ-zEeHd';
const items=[];let after=null;
// Fetch the entire snapshot before touching pages: failed/partial requests must
// not accidentally erase valid pages. Only generated UUID directories are owned.
for(let page=0;page<1000;page++){
 const r=await fetch(endpoint,{method:'POST',headers:{apikey:key,'Content-Type':'application/json','Content-Profile':'public','Accept-Profile':'public'},body:JSON.stringify({p_sonra:after}),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error(`PREVIEW_API_${r.status}`);const rows=await r.json();
 if(!Array.isArray(rows)||rows.some(x=>!UUID.test(x.id)))throw Error('INVALID_PREVIEW_DATA');
 if(rows.length===0)break;
 if(after&&rows[0].id<=after)throw Error('INVALID_CURSOR');
 items.push(...rows);after=rows.at(-1).id;
 if(rows.length<100)break;
 if(page===999)throw Error('PAGE_LIMIT');
}
const ids=new Set(items.map(x=>x.id));
for(const prefix of ['shorts','s']){
 const dir=path.join(root,prefix);await fs.mkdir(dir,{recursive:true});
 for(const item of items){const folder=path.join(dir,item.id);await fs.mkdir(folder,{recursive:true});await fs.writeFile(path.join(folder,'index.html'),render(item));}
 for(const entry of await fs.readdir(dir,{withFileTypes:true})){
  if(entry.isDirectory()&&UUID.test(entry.name)&&!ids.has(entry.name))await fs.rm(path.join(dir,entry.name),{recursive:true,force:true});
 }
}
await fs.writeFile(path.join(root,'shorts/index.html'),render());
console.log(`Shorts share previews: ${items.length}`);
