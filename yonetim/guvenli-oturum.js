/* Puffy management session: server lease + browser-bound secret, no token logs. */
(function(root){
  'use strict';
  const KEY='puffy_panel_binding_v1', LOCK='puffy_panel_locked_v1';
  const IDLE=15*60*1000, TICK=30000, TIMEOUT=8000;
  const SESSION_ERRORS=/PANEL_SESSION_|NOT_AUTHENTICATED|MFA_REQUIRED|NOT_AUTHORIZED|ACCESS_VERIFICATION_REQUIRED/;
  const RPC='/rest/v1/rpc/yonetim_guvenli_oturum_';
  class Session {
    constructor({url,storage,fetch:request,crypto,onLock=()=>{},onReauth=()=>{},now=()=>Date.now()}){
      this.origin=new URL(url).origin;this.storage=storage;this.request=request;this.crypto=crypto;
      this.onLock=onLock;this.onReauth=onReauth;this.now=now;this.active=false;this.epoch=0;
      this.timer=null;this.key='';this.pending=false;this.activity=0;this.acknowledged=0;
      this.sb=null;this.inflight=new Set();this.ending=null;this.info=null;
      try{
        if(storage.getItem(LOCK)==='1')this.clearAuth();
        const k=storage.getItem(KEY);if(/^[0-9a-f]{64}$/.test(k||''))this.key=k;
      }catch{this.unavailable=true;}
      this.fetch=this.fetch.bind(this);
    }
    clearAuth(){
      const keys=[];for(let i=0;i<this.storage.length;i++)keys.push(this.storage.key(i));
      for(const k of keys)if(k?.startsWith('sb-')&&k.includes('-auth-token'))this.storage.removeItem(k);
      for(const k of [KEY,'puffy_mfa','puffy_giris_zamani','puffy_son_hareket'])this.storage.removeItem(k);
      this.key='';
    }
    wasLocked(){return this.unavailable||this.storage.getItem(LOCK)==='1';}
    freshLogin(){
      if(this.unavailable)throw new Error('PANEL_STORAGE_REQUIRED');
      if(this.ending&&!this.endingDone)throw new Error('PANEL_LOGOUT_IN_PROGRESS');
      this.stop();this.clearAuth();this.storage.removeItem(LOCK);this.ending=null;this.info=null;
    }
    ensureKey(){
      if(this.unavailable)throw new Error('PANEL_STORAGE_REQUIRED');
      if(!this.key){const b=new Uint8Array(32);this.crypto.getRandomValues(b);
        this.key=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');this.storage.setItem(KEY,this.key);}
      if(this.storage.getItem(KEY)!==this.key)throw new Error('PANEL_STORAGE_REQUIRED');
    }
    stop(){clearTimeout(this.timer);this.timer=null;this.active=false;this.epoch++;
      for(const c of this.inflight)c.abort();this.inflight.clear();}
    lock(reason){
      this.stop();try{this.storage.setItem(LOCK,'1');}catch{this.unavailable=true;}
      this.onLock(reason);
    }
    reauth(){this.stop();this.onReauth('MFA_REAUTH_REQUIRED');}
    async fetch(input,init){
      const u=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,this.origin);
      const protectedApi=u.origin===this.origin&&/^\/(rest|storage|functions)\/v1\//.test(u.pathname);
      if(!protectedApi){
        if(u.origin!==this.origin||!u.pathname.startsWith('/auth/v1/'))return this.request(input,init);
        const c=new AbortController(),source=init?.signal||(typeof input==='object'?input.signal:undefined);
        const abort=()=>c.abort();if(source?.aborted)c.abort();else source?.addEventListener('abort',abort,{once:true});
        const timer=setTimeout(()=>c.abort(),TIMEOUT);this.inflight.add(c);
        try{return await this.request(input,{...init,signal:c.signal});}
        finally{clearTimeout(timer);this.inflight.delete(c);source?.removeEventListener('abort',abort);}
      }
      const bootstrap=(u.pathname.startsWith(RPC)&&['ac','kontrol','kapat'].includes(u.pathname.slice(RPC.length)))
        ||u.pathname==='/rest/v1/rpc/yonetim_guvenli_giris_hakki';
      if(!this.active&&!bootstrap)throw new Error('PANEL_SESSION_LOCKED');
      const closing=u.pathname===RPC+'kapat';
      if(!this.key&&!u.pathname.endsWith('/yonetim_guvenli_giris_hakki'))throw new Error('PANEL_SESSION_BINDING_REQUIRED');
      const version=this.epoch;
      const headers=new Headers(init?.headers||(typeof input==='object'?input.headers:undefined));
      if(this.key)headers.set('x-puffy-panel-key',this.key);
      const c=new AbortController(),source=init?.signal||(typeof input==='object'?input.signal:undefined);
      const abort=()=>c.abort();if(source?.aborted)c.abort();else source?.addEventListener('abort',abort,{once:true});
      this.inflight.add(c);const timer=setTimeout(()=>c.abort(),TIMEOUT);
      try{
        const r=await this.request(input,{...init,headers,signal:c.signal});
        if(!bootstrap&&version!==this.epoch)throw new Error('STALE_SESSION');
        if(!r.ok&&!closing){
          let code='';try{const d=await r.clone().json();code=String(d.message||d.error||'');}catch{}
          if(code.includes('MFA_REAUTH_REQUIRED')){if(this.active)this.reauth();}
          else if(SESSION_ERRORS.test(code)){if(this.active)this.lock(code);}
          else if(r.status>=500&&this.active)this.lock('PANEL_CONNECTION_LOST');
        }
        return r;
      }catch(e){
        if(this.active&&!closing&&version===this.epoch)this.lock('PANEL_CONNECTION_LOST');
        throw e;
      }finally{clearTimeout(timer);source?.removeEventListener('abort',abort);this.inflight.delete(c);}
    }
    async call(name,args){
      let timer;
      try{
        const r=await Promise.race([this.sb.rpc(name,args),new Promise((_,reject)=>{
          timer=setTimeout(()=>reject(new Error('PANEL_CONNECTION_LOST')),TIMEOUT);})]);
        if(r.error)throw r.error;
        if(r.data?.ok!==true)throw new Error('PANEL_SESSION_REJECTED');return r.data;
      }finally{clearTimeout(timer);}
    }
    accept(info){
      const t=Date.parse(info.server_now),end=Date.parse(info.expires_at),idle=Date.parse(info.idle_expires_at);
      if(!Number.isFinite(t)||!Number.isFinite(end)||!Number.isFinite(idle)||end<=t||idle<=t)
        throw new Error('PANEL_SESSION_INVALID_RESPONSE');
      this.info=info;this.deadline=this.now()+Math.min(end-t,idle-t);
    }
    async open(sb){
      if(this.unavailable)throw new Error('PANEL_STORAGE_REQUIRED');
      if(this.wasLocked())throw new Error('PANEL_SESSION_LOCKED');
      this.sb=sb;this.ensureKey();const version=this.epoch;
      const info=await this.call('yonetim_guvenli_oturum_ac');
      if(version!==this.epoch)throw new Error('STALE_SESSION');
      this.accept(info);this.active=true;this.lastActivity=this.now();this.acknowledged=this.activity;
      this.schedule();return info;
    }
    schedule(){clearTimeout(this.timer);if(this.active)this.timer=setTimeout(()=>this.check().catch(()=>{}),TICK);}
    touch(e){
      if(!this.active||!e?.isTrusted)return;
      if(this.now()>=this.deadline||this.now()-this.lastActivity>=IDLE){this.lock('PANEL_SESSION_EXPIRED');return;}
      this.lastActivity=this.now();this.activity++;
      // Send activity without waiting up to 30s at the idle boundary.
      if(this.now()-(this.lastCheck||0)>=15000)this.check().catch(()=>{});
    }
    async check(){
      if(!this.active||this.pending)return;
      if(this.now()>=this.deadline||this.now()-this.lastActivity>=IDLE){this.lock('PANEL_SESSION_EXPIRED');return;}
      this.pending=true;this.lastCheck=this.now();const version=this.epoch,activity=this.activity;
      try{
        const info=await this.call('yonetim_guvenli_oturum_kontrol',{p_aktif:activity>this.acknowledged});
        if(version!==this.epoch||!this.active)return;
        this.accept(info);this.acknowledged=activity;
      }catch(e){if(version===this.epoch&&this.active)this.lock(String(e.message||'PANEL_CONNECTION_LOST'));}
      finally{this.pending=false;this.schedule();}
    }
    end(sb){
      if(this.ending)return this.ending;
      this.endingDone=false;
      this.stop();try{this.storage.setItem(LOCK,'1');}catch{this.unavailable=true;}
      this.ending=(async()=>{
        let revoked=false,signedOut=false;
        try{if(this.key&&sb){this.sb=sb;const r=await this.call('yonetim_guvenli_oturum_kapat');revoked=r.revoked===true;}}catch{}
        try{
          if(sb){sb.auth.stopAutoRefresh();let timer;
            try{const r=await Promise.race([sb.auth.signOut({scope:'local'}),new Promise((_,reject)=>{
              timer=setTimeout(()=>reject(new Error('LOGOUT_TIMEOUT')),5000);})]);signedOut=!r.error;}
            finally{clearTimeout(timer);}}
        }catch{}
        finally{try{this.clearAuth();}catch{this.unavailable=true;}this.info=null;this.endingDone=true;}
        return {revoked,signedOut};
      })();return this.ending;
    }
  }
  root.PuffyGuvenliOturum={Session};
  if(typeof module!=='undefined')module.exports={Session};
})(typeof window==='undefined'?globalThis:window);
