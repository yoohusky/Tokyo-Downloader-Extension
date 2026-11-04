(() => {
const DEFAULT_TEMPLATE = '{type} {number} - {name}';
const safe = s => String(s).replace(/[\x00-\x1f<>:"/\\|?*]/g,'_').replace(/\.{2,}/g,'_').replace(/[. ]+$/g,'').slice(0,100) || 'untitled';
const siteURL = value => {const u=new URL(value);if(!/^https?:$/.test(u.protocol)||!/(^|\.)tokyoinsider\.com$/.test(u.hostname)||u.username||u.password)throw Error('Use a TokyoInsider URL.');return u.href;};
// Ranges use the real episode numbers: "1-5", "1,3,7-10", or "all".
function select(episodes,type,spec){
 const s=String(spec||'').trim().toLowerCase();
 if(!s)throw Error('Enter episode numbers, for example 1-5 (or "all").');
 const ranges=(s==='all'||s==='*')?[[-Infinity,Infinity]]:s.split(',').map(p=>{const m=p.trim().match(/^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?$/);if(!m)throw Error('Invalid range: '+p);let a=Number(m[1]),b=Number(m[2]??m[1]);return [Math.min(a,b),Math.max(a,b)];});
 const seen=new Set();
 return episodes.filter(e=>{const n=Number(e.number),key=e.type+':'+n;if(e.type!==type||!Number.isFinite(n)||!ranges.some(([a,b])=>n>=a&&n<=b)||seen.has(key))return false;seen.add(key);return true;});
}
const size=f=>{const m=f.size.match(/([\d.,]+)\s*([KMGT]?)B/i);return m?Number(m[1].replaceAll(',',''))*1024**(' KMGT'.indexOf(m[2].toUpperCase())):0;};
function choose(files,rule){if(!files.length)throw Error('No valid file links found.');return [...files].sort((a,b)=>rule==='popular'?Number(b.downloads.replaceAll(',',''))-Number(a.downloads.replaceAll(',','')):rule==='smallest'?size(a)-size(b):size(b)-size(a))[0];}
// Zero-pad so files sort correctly: 6 -> 06 (or 006 for 100+ episodes).
const pad=(number,total)=>/^\d+$/.test(String(number))?String(number).padStart(Math.max(2,String(total||0).length),'0'):String(number);
// Build "Tokyo Downloader/<title>/<file name>" from a template. Fields: {title} {type} {number} {name} {size} {uploader} {date}
function filePath(info,template,total){
 const tpl=(template&&template.trim())||DEFAULT_TEMPLATE;
 let base=tpl.replace(/\{(title|type|number|name|size|uploader|date)\}/g,(m,k)=>k==='number'?pad(info.number,total):String(info[k]??''));
 const ext=/\.[a-z0-9]{2,5}$/i;
 if(!ext.test(base)){const fromName=String(info.name||'').match(ext),fromUrl=String(info.urlPath||'').match(ext);base+=(fromName||fromUrl||['.mkv'])[0];}
 return `Tokyo Downloader/${safe(info.title)}/${safe(base)}`;
}
const api={safe,siteURL,select,choose,pad,filePath,DEFAULT_TEMPLATE};globalThis.TokyoUtils=api;if(typeof module!=='undefined')module.exports=api;
})();
