#!/usr/bin/env python3
"""Private Special upload -> validated WebP/MP4 -> private review artifacts.
No public uploads, catalog publication or currency mutation is done by this worker.
Run --local ICON VIDEO OUTPUT to validate offline. Production --once uses env secrets.
"""
from pathlib import Path
from PIL import Image,ImageOps
import argparse,hashlib,json,math,os,re,subprocess,tempfile,urllib.request,urllib.error,time
PROJECT='https://rjdddbwotczhagdulwco.supabase.co'
UUID=r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
MEDIA_ENV={'PATH':os.environ.get('PATH','/usr/bin:/bin'),'LANG':'C'}
Image.MAX_IMAGE_PIXELS=16_000_000
import warnings
warnings.simplefilter("error",Image.DecompressionBombWarning)

def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def process(icon,video,out):
 icon,video,out=Path(icon),Path(video),Path(out);out.mkdir(parents=True,exist_ok=True)
 if not 0<icon.stat().st_size<=2*1024*1024 or not 0<video.stat().st_size<=50*1024*1024:raise ValueError('SPECIAL_INVALID_MEDIA_SIZE')
 with Image.open(icon) as im:
  if im.format not in ('JPEG','PNG','WEBP') or getattr(im,'n_frames',1)!=1:raise ValueError('SPECIAL_ICON_FORMAT')
  im=ImageOps.exif_transpose(im).convert('RGBA');im=ImageOps.contain(im,(512,512),Image.Resampling.LANCZOS);canvas=Image.new('RGBA',(512,512));canvas.alpha_composite(im,((512-im.width)//2,(512-im.height)//2));canvas.save(out/'icon.webp',quality=91,method=6)
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-protocol_whitelist','file,pipe','-show_format','-show_streams','-of','json',str(video)],timeout=20,env=MEDIA_ENV));streams=probe['streams'];v=next((s for s in streams if s['codec_type']=='video'),None)
 if not v:raise ValueError('SPECIAL_NO_VIDEO')
 duration=float(probe['format'].get('duration','nan'));w,h=int(v['width']),int(v['height'])
 if not math.isfinite(duration) or not 2<=duration<=8:raise ValueError('SPECIAL_VIDEO_DURATION_2_TO_8')
 if not (64<=w<=1920 and 64<=h<=1920) or w*h>1920*1920:raise ValueError('SPECIAL_VIDEO_RESOLUTION')
 if v.get('codec_name') not in ('h264','hevc','mpeg4','vp9','av1'):raise ValueError('SPECIAL_UNSUPPORTED_VIDEO')
 has_audio=any(s['codec_type']=='audio' for s in streams)
 cmd=['ffmpeg','-y','-v','error','-nostdin','-protocol_whitelist','file,pipe','-i',str(video),'-map','0:v:0','-map','0:a:0?','-map_metadata','-1','-map_chapters','-1','-vf',"scale=w='min(720,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30",'-c:v','libx264','-crf','20','-maxrate','2200k','-bufsize','4400k','-pix_fmt','yuv420p','-threads','2','-t','8','-c:a','aac','-b:a','128k','-ar','48000','-ac','2']
 if has_audio:cmd+=['-af','loudnorm=I=-20:TP=-2:LRA=9']
 cmd+=['-movflags','+faststart',str(out/'animation.mp4')];subprocess.run(cmd,check=True,timeout=150,env=MEDIA_ENV)
 normalized=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',str(out/'animation.mp4')],timeout=20,env=MEDIA_ENV));nv=next(s for s in normalized['streams'] if s['codec_type']=='video')
 manifest={'duration':float(normalized['format']['duration']),'width':nv['width'],'height':nv['height'],'has_audio':has_audio,'icon_sha256':sha(out/'icon.webp'),'video_sha256':sha(out/'animation.mp4'),'icon_bytes':(out/'icon.webp').stat().st_size,'video_bytes':(out/'animation.mp4').stat().st_size}
 if not 2<=manifest['duration']<=8 or manifest['video_bytes']>8*1024*1024:raise ValueError('SPECIAL_OUTPUT_LIMIT')
 (out/'manifest.json').write_text(json.dumps(manifest,indent=2));return manifest

class Api:
 def __init__(self):
  self.url=os.environ.get('SUPABASE_URL',PROJECT).rstrip('/');self.key=os.environ['SUPABASE_SERVICE_ROLE_KEY']
  if self.url!=PROJECT:raise ValueError('Unexpected production endpoint; test via --local')
 def request(self,path,method='GET',body=None,content='application/json',limit=52*1024*1024):
  req=urllib.request.Request(self.url+path,data=body,method=method,headers={'apikey':self.key,'Authorization':'Bearer '+self.key,'Content-Type':content})
  with urllib.request.urlopen(req,timeout=90) as response:
   data=response.read(limit+1)
   if len(data)>limit:raise ValueError('SPECIAL_DOWNLOAD_LIMIT')
   return data
 def rpc(self,name,args):return json.loads(self.request('/rest/v1/rpc/'+name,'POST',json.dumps(args).encode()) or 'null')
 def path(self,bucket,path):
  if not re.fullmatch(UUID+'/'+UUID+'/'+UUID+r'\.(png|jpg|webp|mp4|mov)',path):raise ValueError('SPECIAL_INVALID_SOURCE_PATH')
  return '/storage/v1/object/authenticated/'+bucket+'/'+path
 def upload(self,path,data,kind):return self.request('/storage/v1/object/special-processing/'+path,'POST',data,kind)

def once():
 api=Api();job=api.rpc('special_worker_claim',{})
 if not job:return False
 try:
  with tempfile.TemporaryDirectory(prefix='puffy-special-') as tmp:
   d=Path(tmp);i=d/'icon.input';v=d/'video.input';i.write_bytes(api.request(api.path('special-submissions',job['icon_input']),limit=2*1024*1024));v.write_bytes(api.request(api.path('special-submissions',job['video_input']),limit=50*1024*1024));manifest=process(i,v,d/'out');prefix=job['id']+'/'+job['token'];manifest['processed_prefix']=prefix
   for name,kind in [('icon.webp','image/webp'),('animation.mp4','video/mp4')]:api.upload(prefix+'/'+name,(d/'out'/name).read_bytes(),kind)
   api.rpc('special_worker_finish',{'p_id':job['id'],'p_token':job['token'],'p_manifest':manifest})
 except Exception as error:
  # No raw response, URLs, upload bytes or service keys enter logs or user messages.
  try:api.rpc('special_worker_finish',{'p_id':job['id'],'p_token':job['token'],'p_manifest':None,'p_error':'SPECIAL_MEDIA_PROCESSING_FAILED'})
  except Exception:pass
  print('Special job failed:',job['id'],type(error).__name__,flush=True)
 return True
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--local',nargs=3,metavar=('ICON','VIDEO','OUTPUT'));parser.add_argument('--once',action='store_true');args=parser.parse_args()
 if args.local:print(json.dumps(process(*args.local),indent=2))
 elif args.once:once()
 else:
  while True:
   try:found=once()
   except Exception as error:print('Special worker unavailable:',type(error).__name__,flush=True);found=False
   if not found:time.sleep(10)
