const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const U=require('./utils.js');
test('ranges use numbers, handle gaps and deduplicate 06/6',()=>{const es=['1','3','06','6','7'].map(number=>({type:'episode',number}));assert.deepEqual(U.select(es,'episode','3-6').map(e=>e.number),['3','06']);assert.throws(()=>U.select(es,'episode',''));assert.equal(U.select(es,'episode','all').length,4);});
test('host restriction rejects lookalikes, credentials and scripts',()=>{for(const s of ['https://eviltokyoinsider.com/a','https://tokyoinsider.com.evil.test/a','javascript:alert(1)','https://user:pass@tokyoinsider.com/a'])assert.throws(()=>U.siteURL(s));assert.equal(U.siteURL('http://media.tokyoinsider.com:8383/a'),'http://media.tokyoinsider.com:8383/a');});
test('file ranking compares units and comma-separated counts',()=>{const a={size:'900 MB',downloads:'2,000'},b={size:'1.1 GB',downloads:'900'};assert.equal(U.choose([a,b],'biggest'),b);assert.equal(U.choose([a,b],'smallest'),a);assert.equal(U.choose([a,b],'popular'),a);});
test('filenames cannot traverse directories',()=>{assert(!U.safe('../../bad/name').includes('/'));assert(!U.safe('../../bad/name').includes('..'));});
const r13=t=>t.replace(/[a-zA-Z]/g,c=>String.fromCharCode((c.charCodeAt(0)-(c<='Z'?65:97)+13)%26+(c<='Z'?65:97)));
function parse(key,includeKey=true){const url='http://media.tokyoinsider.com:8383/test/video.mkv?token=test',bin=Array.from(url,(c,i)=>String.fromCharCode(c.charCodeAt(0)^key.charCodeAt(i%key.length))).join(''),encoded=r13(Buffer.from(bin,'binary').toString('base64')).split('').reverse().join('');
const parent={textContent:'Size: 120 MB Downloads: 123 Uploader: Test',parentElement:null};const sp={parentElement:parent,getAttribute:n=>n==='data-a'?encoded.slice(0,10):encoded.slice(10),cloneNode:()=>({textContent:'video.mkv',querySelectorAll:()=>[]})};
const script={textContent:`// data-a\nvar K = r13("${r13(key).split('').reverse().join('')}".split('').reverse().join(''));`};
const doc={title:'Download Test episode 1 @ Tokyo Insider',documentElement:{outerHTML:'<html>Size:</html>'},body:{innerText:'',querySelectorAll:()=>[]},querySelector:()=>null,querySelectorAll:q=>q==='script:not([src])'?(includeKey?[script]:[]):q.startsWith('span.dlk')?[sp]:[]};
const ctx={document:doc,location:new URL('https://www.tokyoinsider.com/anime/T/Test/episode/1'),URL,DOMParser:class{parseFromString(){return doc;}},atob:x=>Buffer.from(x,'base64').toString('binary')};vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/parser.js','utf8'),ctx);return ctx.TokyoParser.scan();}
test('decoder uses each page key and refuses missing key',()=>{for(const key of ['first-key','another-page-key']){const r=parse(key);assert.equal(r.files.length,1);assert.match(r.files[0].url,/video\.mkv\?token=test$/);}const r=parse('unknown',false);assert.equal(r.files.length,0);assert.match(r.diagnostic,/refusing to guess/);});
test('queue hands downloads to browser and pauses on interruption',async()=>{
 const els={};const elem=()=>({value:'',textContent:'',disabled:false,append(){},replaceChildren(){}});const document={getElementById:id=>els[id]??=(elem()),createElement:elem};
 let saved,downloadRequests=[];const state={title:'Test',episodes:[],url:'https://www.tokyoinsider.com/anime/T/Test',reader:null,jobs:[1,2].map(n=>({number:String(n),type:'episode',title:'Test',page_url:`https://www.tokyoinsider.com/anime/T/Test/episode/${n}`,status:'pending',rule:'biggest'}))};
 let tab;const chrome={storage:{local:{get:async()=>({state}),set:async x=>{saved=x;}}},tabs:{create:async p=>(tab={id:9,url:p.url,status:'complete'}),get:async()=>tab,update:async(id,p)=>(tab={...tab,...p})},scripting:{executeScript:async p=>p.files?[]:[{result:{data:{files:[{url:'https://media.tokyoinsider.com/file.mkv',name:'file.mkv',size:'1 MB',downloads:'1'}]}}}]},downloads:{download:async opts=>{downloadRequests.push(opts);return 77;},search:async()=>[{state:'interrupted',error:'SERVER_FORBIDDEN',bytesReceived:0,totalBytes:0}]}};
 const context={document,chrome,TokyoUtils:U,URL,Date,setTimeout:f=>setImmediate(f),setInterval:()=>0};vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/dashboard.js','utf8'),context);await new Promise(r=>setImmediate(r));await els.start.onclick();
 assert.equal(downloadRequests.length,1);assert.equal(downloadRequests[0].url,'https://media.tokyoinsider.com/file.mkv');assert.equal(saved.state.jobs[0].status,'failed');assert.equal(saved.state.jobs[1].status,'pending');assert.match(els.status.textContent,/SERVER_FORBIDDEN/);
});
async function removalHarness(jobs,overrides={}){
 const els={};const elem=()=>({value:'',textContent:'',disabled:false,append(){},replaceChildren(){}});
 const state={title:'Test',episodes:[],url:'',reader:null,jobs};const cancelled=[];
 const chrome={storage:{local:{get:async()=>({state}),set:async()=>{}}},downloads:{search:async()=>[{state:'in_progress'}],cancel:async id=>cancelled.push(id),...overrides},tabs:{},scripting:{}};
 const ctx={document:{getElementById:id=>els[id]??=elem(),createElement:elem},chrome,TokyoUtils:U,URL,Date,setTimeout:f=>setImmediate(f),setInterval:()=>0};vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/dashboard.js','utf8'),ctx);await new Promise(r=>setImmediate(r));return {ctx,state,cancelled,els};
}
test('removal persists pending and completed entry removal without deleting files',async()=>{
 const h=await removalHarness([{status:'pending',number:'1'},{status:'complete',downloadId:2,number:'2'}]);
 await vm.runInContext('removeJob(state.jobs[0])',h.ctx);await vm.runInContext('removeJob(state.jobs[0])',h.ctx);assert.equal(h.state.jobs.length,0);assert.deepEqual(h.cancelled,[]);
});
test('active removal cancels browser download before dropping entry',async()=>{
 const h=await removalHarness([{status:'downloading',downloadId:9,number:'1'}]);await vm.runInContext('removeJob(state.jobs[0])',h.ctx);assert.deepEqual(h.cancelled,[9]);assert.equal(h.state.jobs.length,0);
});
test('failed cancellation retains active entry',async()=>{
 const h=await removalHarness([{status:'downloading',downloadId:9,number:'1'}],{cancel:async()=>{throw Error('cancel unavailable');}});await vm.runInContext('removeJob(state.jobs[0])',h.ctx);assert.equal(h.state.jobs.length,1);assert.match(h.els.status.textContent,/Could not remove/);
});
test('clear waiting preserves reading, starting, active and completed jobs',async()=>{
 const h=await removalHarness(['pending','failed','reading','starting','downloading','complete'].map(status=>({status}))); // initialize first, then simulate live processing
 h.state.jobs[2].status='reading';h.state.jobs[3].status='starting';await h.els.clearWaiting.onclick();assert.deepEqual(Array.from(h.state.jobs,j=>j.status),['reading','starting','downloading','complete']);
});
test('removing an episode being read prevents its download',async()=>{
 const h=await removalHarness([{status:'pending',number:'1',type:'episode',page_url:'https://www.tokyoinsider.com/anime/T/Test/episode/1'}]);
 vm.runInContext("scan=async()=>{await removeJob(state.jobs[0]);return {files:[]};}",h.ctx);
 await h.els.start.onclick();assert.equal(h.state.jobs.length,0);assert.deepEqual(h.cancelled,[]);
});

test('file paths are zero-padded and follow the template',()=>{
 const i={title:'Show',type:'episode',number:'6',name:'a.mkv',urlPath:'/x/a.mkv'};
 assert.equal(U.filePath(i,'',12),'Tokyo Downloader/Show/episode 06 - a.mkv');
 assert.equal(U.filePath({...i,name:'a'},'{title} - {number}',120),'Tokyo Downloader/Show/Show - 006.mkv');
});
