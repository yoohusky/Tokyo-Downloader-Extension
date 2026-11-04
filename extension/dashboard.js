const $=id=>document.getElementById(id), U=TokyoUtils;
let state={episodes:[],title:'',url:'',jobs:[],reader:null}, running=false, busy=false, pause=false;
const say=s=>{$('status').textContent=s;};
const save=()=>chrome.storage.local.set({state});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
// nap() can be woken early by browser download events, so a throttled background tab does not stall the queue.
let wake=null;const nap=ms=>new Promise(r=>{wake=r;setTimeout(r,ms);});
const samePage=(a,b)=>{try{const x=new URL(a),y=new URL(b);return x.hostname===y.hostname&&x.pathname.replace(/\/+$/,'').toLowerCase()===y.pathname.replace(/\/+$/,'').toLowerCase();}catch{return false;}};
// Next episode is read and started as soon as the previous download has begun, up to this many at once.
const maxActive=()=>Math.max(1,Math.min(5,parseInt($('concurrent').value,10)||3));
const skipFailed=()=>!!$('skip').checked;
const retryLimit=()=>Math.max(0,Math.min(5,parseInt($('retries').value,10)||0));
// Failed job: retry automatically if allowed, otherwise pause the queue unless "skip failed" is on.
function failJob(j,msg){
 j.error=msg;j.attempts=j.attempts||0;
 if(j.attempts<retryLimit()){j.attempts++;j.status='pending';delete j.downloadId;j.bytes=0;j.error=`${msg} (retry ${j.attempts}/${retryLimit()})`;return;}
 j.status='failed';
 if(running&&!skipFailed()){pause=true;say('Queue paused: '+msg+' Use Retry failed for a fresh link.');}
 else if(running)say(`Skipped ${j.type} ${j.number}: ${msg}`);
}
async function scan(url){
 url=U.siteURL(url);
 let tab;try{if(state.reader)tab=await chrome.tabs.get(state.reader);}catch{}
 if(tab && !/^https?:\/\/([^/]+\.)?tokyoinsider\.com(?:[/:]|$)/i.test(tab.url||''))tab=null;
 if(tab) await chrome.tabs.update(tab.id,{url});else{tab=await chrome.tabs.create({url,active:false});state.reader=tab.id;await save();}
 const deadline=Date.now()+60000,started=Date.now();
 // Accept redirects (e.g. episode/6 -> episode/06) as long as the page stays on tokyoinsider.com.
 while(Date.now()<deadline){await delay(500);tab=await chrome.tabs.get(state.reader);if(tab.status==='complete'&&(samePage(tab.url,url)||(Date.now()-started>2000&&/^https?:\/\/([^/]+\.)?tokyoinsider\.com(?:[/:]|$)/i.test(tab.url||''))))break;}
 if(tab.status!=='complete')throw Error('Page timed out. Open the reader tab, then retry.');
 U.siteURL(tab.url);
 await chrome.scripting.executeScript({target:{tabId:tab.id},files:['parser.js']});
 const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{try{return {data:globalThis.TokyoParser.scan()};}catch(e){return {error:e.message};}}});
 if(!result||!result.result)throw Error('Could not read the page (script did not run). Open the reader tab, check it loaded, then retry.');
 if(result.result.error)throw Error(result.result.error);return result.result.data;
}
// Removing an entry never deletes a completed file or browser download history.
async function removeJob(j){
 if(!state.jobs.includes(j)||j.removing||j.status==='starting')return;
 j.removing=true;render();
 try{
  if(j.status==='downloading'&&j.downloadId){
   try{await chrome.downloads.cancel(j.downloadId);}
   catch(error){
    const [download]=await chrome.downloads.search({id:j.downloadId});
    if(download?.state==='in_progress')throw error;
   }
  }
  state.jobs=state.jobs.filter(item=>item!==j);
  await save();say(`Removed ${j.type} ${j.number} from the queue.`);
 }catch(error){say('Could not remove episode: '+error.message);}
 finally{delete j.removing;render();}
}
async function clearWaiting(){
 const before=state.jobs.length;
 state.jobs=state.jobs.filter(j=>!['pending','failed'].includes(j.status)||j.removing);
 await save();say(`Removed ${before-state.jobs.length} waiting or failed episodes. Active downloads continue.`);render();
}
function render(){
 $('summary').textContent=state.episodes.length?`${state.title} — ${state.episodes.length} entries found.`:'Load an anime to get started.';
 $('counts').textContent=`${state.jobs.filter(j=>j.status==='complete').length} complete · ${state.jobs.filter(j=>j.status==='failed').length} failed · ${state.jobs.filter(j=>j.status==='pending').length} pending`;
 $('items').replaceChildren();
 for(const j of state.jobs){const row=document.createElement('div');row.className='item';const title=document.createElement('strong');title.textContent=`${j.title} · ${j.type} ${j.number}`;const info=document.createElement('p');info.textContent=`${j.status}${j.error?' — '+j.error:''}`;row.append(title,info);if(j.bytes){const p=document.createElement('progress');p.max=j.total||j.bytes;p.value=j.bytes;row.append(p);}if(j.filename){const name=document.createElement('small');name.textContent=j.filename;row.append(name);}if(j.downloadId&&j.status==='downloading'){const b=document.createElement('button');b.textContent='Cancel download';b.onclick=()=>chrome.downloads.cancel(j.downloadId);row.append(b);}if(j.downloadId&&j.status==='complete'){const b=document.createElement('button');b.textContent='Show file';b.onclick=()=>chrome.downloads.show(j.downloadId);row.append(b);}const remove=document.createElement('button');remove.textContent=j.status==='downloading'?'Cancel & remove':'Remove';remove.title='Remove queue entry; completed files stay on disk';remove.disabled=!!j.removing||j.status==='starting';remove.onclick=()=>removeJob(j);row.append(remove);$('items').append(row);}
 for(const id of ['load','queue','retry','clear'])$(id).disabled=running||busy;
 $('start').disabled=running||busy;
}
async function sync(){let changed=false;for(const j of state.jobs.filter(j=>j.status==='downloading'&&j.downloadId)){const [d]=await chrome.downloads.search({id:j.downloadId});if(!state.jobs.includes(j)||j.removing)continue;if(!d){j.status='complete';j.error='Not in browser history any more; check the file exists in Downloads.';}else{j.bytes=d.bytesReceived;j.total=d.totalBytes;if(d.state==='complete'){j.status='complete';j.error='';}else if(d.state==='interrupted'){failJob(j,d.error||'Browser interrupted the download');}}changed=true;}if(changed){await save();render();}}
async function start(){if(running||busy)return;running=true;pause=false;render();try{
 while(!pause){await sync();if(pause)break;const active=state.jobs.filter(j=>j.status==='downloading').length;if(active>=maxActive()){await nap(1000);continue;}const j=state.jobs.find(j=>j.status==='pending');if(!j){if(active){await nap(1000);continue;}break;}
 j.status='reading';await save();render();say(`Reading ${j.type} ${j.number}…`);
 try{const data=await scan(j.page_url);if(!state.jobs.includes(j))continue;if(pause){j.status='pending';await save();break;}if(!data.files.length)throw Error('No valid file links: '+data.diagnostic);const f=U.choose(data.files,j.rule);U.siteURL(f.url);
 const total=Math.max(0,...state.episodes.filter(e=>e.type===j.type).map(e=>Number(e.number)||0));
 const filename=U.filePath({title:j.title,type:j.type,number:j.number,name:f.name,size:f.size,uploader:f.uploader,date:f.date,urlPath:new URL(f.url).pathname},$('template').value,total);
 j.filename=filename;j.status='starting';j.error='';render();
 j.downloadId=await chrome.downloads.download({url:f.url,filename,conflictAction:'uniquify',saveAs:false});j.status='downloading';
 say(`Browser download started for ${j.type} ${j.number}.`);
 }catch(e){if(!state.jobs.includes(j))continue;failJob(j,e.message);}
 await save();render();
 }
 if(!pause)say('Queue finished. Check the downloaded file plays correctly.');
 }finally{running=false;render();}}
function action(id,fn){$(id).onclick=async()=>{try{await fn();}catch(e){say(e.message);}finally{render();}};}
action('load',async()=>{busy=true;render();try{const url=U.siteURL($('url').value.trim());say('Reading episode list…');const data=await scan(url);if(!data.episodes.length)throw Error('No episodes found. Open the reader tab to check the page.');state.episodes=data.episodes;state.title=data.title;state.url=url;await save();say('Episodes loaded. Choose one episode for the first test.');}finally{busy=false;}});
action('reader',async()=>{if(state.reader)await chrome.tabs.update(state.reader,{active:true});});
action('queue',async()=>{const selected=U.select(state.episodes,$('type').value,$('range').value);if(!selected.length)throw Error('No episodes match that range and type.');let added=0;for(const e of selected){const key=state.url+'|'+e.type+'|'+Number(e.number);if(state.jobs.some(j=>j.key===key))continue;state.jobs.push({...e,key,title:state.title,status:'pending',rule:$('rule').value});added++;}await save();say(`Added ${added} episodes. Existing queue entries were skipped.`);});
action('start',start);
for(const id of ['template','skip','retries','concurrent'])$(id).onchange=()=>{state.opts={template:$('template').value,skip:!!$('skip').checked,retries:$('retries').value,concurrent:$('concurrent').value};save();};
chrome.downloads.onChanged?.addListener(()=>{if(wake)wake();sync().catch(()=>{});});
action('pause',async()=>{pause=true;say('Queue paused. Any active browser download continues.');});
action('retry',async()=>{for(const j of state.jobs)if(j.status==='failed'){j.status='pending';j.attempts=0;delete j.downloadId;j.error='';j.bytes=0;}await save();say('Failed items queued for fresh links. Press Start.');});
action('clearWaiting',clearWaiting);
action('clear',async()=>{state.jobs=state.jobs.filter(j=>j.status!=='complete');await save();});
(async()=>{const stored=await chrome.storage.local.get('state');if(stored.state)state=stored.state;for(const j of state.jobs){delete j.removing;if(j.status==='reading'||j.status==='starting'){j.status='pending';}} $('url').value=state.url;if(state.opts){$('template').value=state.opts.template||'';$('skip').checked=!!state.opts.skip;$('retries').value=state.opts.retries||'';$('concurrent').value=state.opts.concurrent||'';}await sync();await save();render();setInterval(()=>{if(!running)sync().catch(e=>say(e.message));},2000);})();
