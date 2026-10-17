import test from 'node:test';import assert from 'node:assert/strict';
import {render,coverUrl} from '../scripts/shorts-template.mjs';
const id='ee9dba11-1421-46b8-88c9-38e7ad7757d8';
test('real cover and canonical video ID are present in server-readable social metadata',()=>{
 const cover='https://rjdddbwotczhagdulwco.supabase.co/storage/v1/object/public/short_thumbnails/a.jpg';
 const html=render({id,nickname:'KAAN',caption:'Bir an',cover});
 assert.match(html,/<meta property="og:title" content="KAAN · Puffy Shorts">/);
 assert.ok(html.includes(`<meta property="og:image" content="${cover}">`));
 assert.ok(html.includes(`https://puffychat.com/shorts/${id}`));
 assert.match(html,/Puffy’de izle/);
});
test('captions and names cannot inject scripts or metadata',()=>{
 const html=render({id,nickname:'"><script>alert(1)</script>',caption:'<img src=x onerror=alert(1)>',cover:'javascript:alert(1)'});
 assert.ok(!html.includes('<script>alert'));assert.ok(!html.includes('<img src=x'));
 assert.ok(!html.includes('property="og:image"'));assert.match(html,/&lt;script&gt;/);
});
test('invalid ID and untrusted or video cover URL are rejected',()=>{
 assert.throws(()=>render({id:'../../yonetim'}));
 for(const url of ['http://evil.test/a.jpg','https://evil.test/a.jpg','javascript:alert(1)','https://rjdddbwotczhagdulwco.supabase.co/x.mp4'])assert.equal(coverUrl(url),null);
});
