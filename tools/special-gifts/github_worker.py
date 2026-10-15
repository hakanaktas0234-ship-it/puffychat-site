#!/usr/bin/env python3
"""Scheduled FFmpeg worker. Authenticates with GitHub's ephemeral OIDC identity.
No Supabase service key is provided to GitHub or media subprocesses.
"""
import json,os,tempfile,time,urllib.parse,urllib.request
from pathlib import Path
from media_worker import process
PROJECT='https://rjdddbwotczhagdulwco.supabase.co'
GATEWAY=PROJECT+'/functions/v1/special-worker'

def request(url,method='GET',data=None,headers=None,limit=53*1024*1024):
 req=urllib.request.Request(url,data=data,method=method,headers=headers or {})
 with urllib.request.urlopen(req,timeout=90) as response:
  value=response.read(limit+1)
  if len(value)>limit:raise ValueError('RESPONSE_LIMIT')
  return value

def token():
 url=os.environ['ACTIONS_ID_TOKEN_REQUEST_URL'];parsed=urllib.parse.urlparse(url)
 if parsed.scheme!='https' or not parsed.hostname or not parsed.hostname.endswith('.actions.githubusercontent.com'):raise ValueError('OIDC_ENDPOINT')
 url+=('&' if '?' in url else '?')+'audience=puffy-special-worker'
 result=json.loads(request(url,headers={'Authorization':'Bearer '+os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']},limit=65536))
 return result['value']

def rpc(body):
 return json.loads(request(GATEWAY,'POST',json.dumps(body).encode(),{'Authorization':'Bearer '+token(),'Content-Type':'application/json'},65536))

def media_url(url):
 parsed=urllib.parse.urlparse(url)
 if parsed.scheme!='https' or parsed.netloc!='rjdddbwotczhagdulwco.supabase.co' or not parsed.path.startswith('/storage/v1/object/'):raise ValueError('MEDIA_ENDPOINT')
 return url

def once():
 job=rpc({'action':'claim'}).get('job')
 if not job:
  print('Special worker: queue empty or feature closed',flush=True);return False
 try:
  with tempfile.TemporaryDirectory(prefix='puffy-special-') as tmp:
   root=Path(tmp);icon=root/'icon.input';video=root/'video.input'
   icon.write_bytes(request(media_url(job['icon_url']),limit=2*1024*1024))
   video.write_bytes(request(media_url(job['video_url']),limit=50*1024*1024))
   manifest=process(icon,video,root/'out');manifest['processed_prefix']=job['id']+'/'+job['token']
   for key,name,mime in [('icon_upload','icon.webp','image/webp'),('video_upload','animation.mp4','video/mp4')]:
    request(media_url(job[key]),'PUT',(root/'out'/name).read_bytes(),{'Content-Type':mime,'x-upsert':'false'},65536)
   rpc({'action':'finish','id':job['id'],'token':job['token'],'manifest':manifest})
  print('Special worker: job processed',flush=True)
 except Exception:
  try:rpc({'action':'finish','id':job['id'],'token':job['token'],'error':True})
  except Exception:pass
  # Raw URLs, bearer tokens, file content and exception responses are never logged.
  raise RuntimeError('SPECIAL_MEDIA_PROCESSING_FAILED') from None
 return True

if __name__=='__main__':
 for _ in range(3):
  if not once():break
