/* Attach only after content-game-upload and package validation are installed. */
(() => {
  const allowed=new Set('html js css json png jpg jpeg webp mp3 ogg wav mp4 woff2'.split(' '));
  window.PuffyGamePackagePicker={attach(form,context,initial,onChange,initialEngine=null){
    let value=initial||null,busy=false;
    const box=document.createElement('fieldset');
    box.innerHTML='<legend>Oynanabilir oyun paketi</legend><p>Coin işlemi yapmayan web oyunları. Yükleme yayına almaz.</p><label>Coin motoru<select data-engine><option value="">Coin işlemi yok</option><option value="ekspres-v2">Ekspres V2 — mevcut kasa ve kurallar</option></select></label><label>Oyun klasörü<input type="file" webkitdirectory multiple></label><label>Başlangıç sayfası<select data-entry></select></label><p role="status"></p><button type="button" data-clear>Paketi kaldır</button>';
    form.querySelector('.dc-layout > div').append(box);
    const input=box.querySelector('input'),entry=box.querySelector('[data-entry]'),status=box.querySelector('[role=status]');
    function display(){
      entry.replaceChildren();
      for(const file of value?.files||[]){
        if(!file.path.endsWith('.html'))continue;
        const option=new Option(file.path,file.path);entry.add(option);
      }
      if(value)entry.value=value.entry;
      status.textContent=value?`${value.files.length} dosya hazır. Taslağı kaydet, ardından yayınla.`:'Paket seçilmedi.';
    }
    display();
    const engine=box.querySelector('[data-engine]');engine.value=initialEngine||'';
    engine.onchange=onChange;
    entry.onchange=()=>{if(value)value={...value,entry:entry.value};onChange();};
    box.querySelector('[data-clear]').onclick=()=>{if(busy)return;value=null;if(form.elements.destination.value==='game_package')form.elements.destination.value='';display();onChange();};
    form.addEventListener('submit',event=>{
      if(busy){event.preventDefault();event.stopImmediatePropagation();status.textContent='Yüklemenin tamamlanmasını bekle.';}
      else if((value && (form.elements.kind.value!=='game'||form.elements.destination.value!=='game_package')) || (!value && form.elements.destination.value==='game_package')){event.preventDefault();event.stopImmediatePropagation();status.textContent='Oyun paketini ve Yeni web oyun paketi hedefini birlikte seç veya paketi kaldır.';}
    },true);
    input.onchange=async()=>{
      if(busy)return;
      const files=Array.from(input.files||[]);
      const rows=files.map(file=>({file,path:(file.webkitRelativePath||file.name).split('/').slice(file.webkitRelativePath?1:0).join('/')}));
      if(!rows.length)return;
      const total=files.reduce((n,f)=>n+f.size,0),paths=new Set(rows.map(r=>r.path));
      if(rows.length>64||total>32000000||paths.size!==rows.length||rows.some(({file,path})=>file.size<1||file.size>12000000||path.length>180||!/^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\.[a-z0-9]+$/.test(path)||!allowed.has(path.split('.').at(-1)))||!rows.some(r=>r.path.endsWith('.html'))){
        status.textContent='Paket uygun değil: en fazla 64 dosya, toplam 32 MB, dosya başına 12 MB ve bir HTML başlangıç sayfası gerekir.';input.value='';return;
      }
      busy=true;box.disabled=true;
      try{
        const uploaded=[];
        for(const row of rows){
          if(!form.isConnected)return;
          status.textContent=`Yükleniyor: ${uploaded.length+1}/${rows.length}`;
          const body=new FormData();body.set('path',row.path);body.set('file',row.file);
          const result=await context.sb.functions.invoke('content-game-upload',{body});
          if(result.error||result.data?.file?.path!==row.path||result.data.file.bytes!==row.file.size)throw Error('UPLOAD_FAILED');
          uploaded.push(result.data.file);
        }
        if(!form.isConnected)return;
        value={schema_version:1,entry:paths.has('index.html')?'index.html':rows.find(r=>r.path.endsWith('.html')).path,files:uploaded};
        form.elements.kind.value='game';form.elements.destination.value='game_package';
        display();onChange();
      }catch(_){status.textContent='Yükleme tamamlanamadı. Önceki paket korundu; tekrar deneyebilirsin.';}
      finally{busy=false;box.disabled=false;input.value='';}
    };
    return {get:()=>value,engine:()=>value ? engine.value||null : null};
  }};
})();
