import {getBelgianOilPatch} from './oil-daily.mjs';
/* Public, fixed upstream documents only. Static assets are injected at build time. */
const publicFiles = {
  world: 'https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/CMO-Historical-Data-Monthly.xlsx',
  acer: 'https://aegis.acer.europa.eu/terminal/price_assessments',
  aemo: 'https://www.nemweb.com.au/Reports/CURRENT/STTM/int651_v1_ex_ante_market_price_rpt_1.csv',
  malaysia: 'https://storage.data.gov.my/commodities/fuelprice.csv'
};
const feeds = [
  ['U.S. EIA','Energy','https://www.eia.gov/rss/todayinenergy.xml'],
  ['OpenAI','AI','https://openai.com/news/rss.xml'],
  ['Google','AI','https://blog.google/technology/ai/rss/'],
  ['NVIDIA','AI','https://nvidianews.nvidia.com/releases.xml']
];
const articleHosts = {
  'U.S. EIA':['www.eia.gov','eia.gov'],
  OpenAI:['openai.com','www.openai.com'],
  Google:['blog.google','deepmind.google','research.google','cloud.google.com','developers.googleblog.com'],
  NVIDIA:['nvidianews.nvidia.com','blogs.nvidia.com','developer.nvidia.com'],
  ACER:['aegis.acer.europa.eu','www.acer.europa.eu'],
  IEA:['www.iea.org','iea.org']
};
const decoder = new TextDecoder();
const inFlight = new Map();
const recent = new Map();

async function download(url, binary=false) {
  const res = await fetch(url,{signal:AbortSignal.timeout(8000), headers:{Accept:binary?'*/*':'text/html, application/xml, text/csv, */*'}});
  if (!res.ok) throw new Error('Upstream returned '+res.status);
  // A changed download destination needs a new publisher review.
  if (res.url && new URL(res.url).origin!==new URL(url).origin) throw new Error('Publisher download changed origin');
  const max = 12*1024*1024;
  if (+res.headers.get('content-length') > max) throw new Error('Oversize document');
  const reader = res.body.getReader();
  let length=0; const parts=[];
  while (true) {
    const {value,done}=await reader.read();
    if (done) break;
    length+=value.length;
    if(length>max){await reader.cancel();throw new Error('Oversize document');}
    parts.push(value);
  }
  const bytes=new Uint8Array(length);
  let pos=0; for(const part of parts){bytes.set(part,pos);pos+=part.length;}
  return binary ? bytes : decoder.decode(bytes);
}
function decodeEntities(text) {
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (all,k)=>{
    const map={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
    if(k[0]!=='#') return map[k.toLowerCase()];
    const n=k[1].toLowerCase()==='x'?parseInt(k.slice(2),16):Number(k.slice(1));
    return n>=0&&n<=0x10ffff ? String.fromCodePoint(n):'';
  });
}
function plain(str=''){
  return decodeEntities(str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
}
function numeric(value) {
  const str=String(value??'').trim().replace(/,/g,'');
  return /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(str)?Number(str):NaN;
}
function isoDay(value) {
  let s=String(value??'').trim();
  if(/^\d{4}[./-]\d{2}[./-]\d{2}/.test(s))s=s.slice(0,10).replace(/[./]/g,'-');
  else if(/^\d{1,2}[-/ ](?:[A-Z][a-z]{2}|\d{1,2})[-/ ]\d{4}$/i.test(s)) {
    let [d,m,y]=s.split(/[-/ ]/);
    if(!Number(m))m=String(1+['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m.toLowerCase()));
    s=y+'-'+m.padStart(2,'0')+'-'+d.padStart(2,'0');
  } else return null;
  const v=new Date(s+'T00:00:00Z');
  return Number.isFinite(+v)&&v.toISOString().slice(0,10)===s ? s : null;
}
function csvTable(input) {
  return input.trim().split(/\r?\n/).map(line=>(line.match(/("(?:[^"]|"")*"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g)||[]).map(s=>s.replace(/^"|"$/g,'').replace(/""/g,'"').trim()));
}
function csvObjects(input,required) {
  const rows=csvTable(input);
  const idx=rows.findIndex(row=>row.some(s=>s.toLowerCase()===required));
  if(idx<0)throw new Error('CSV header missing');
  const headers=rows[idx].map(s=>s.toLowerCase().replace(/^\uFEFF/,''));
  return rows.slice(idx+1).map(r=>Object.fromEntries(headers.map((name,i)=>[name,r[i]])));
}
function add(out,id,date,value){
  const n=numeric(value);
  if (date&&Number.isFinite(n)) (out[id]??=[]).push({date,value:n});
}
function parseACER(html){
  const out={};
  for(const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)){
    const rows=Array.from(table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi), row=>
      Array.from(row[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi),cell=>plain(cell[1])));
    const header=rows.find(row=>row[0]?.toLowerCase()==='date');
    if(!header)continue;
    const keys=['nwe','southlng','eulng'];
    const indices=[/north.west europe price/i,/south europe price/i,/^eu price/i].map(re=>header.findIndex(text=>re.test(text)&&/EUR\s*\/\s*MWh/i.test(text)));
    if(indices.some(i=>i<0))continue;
    for(const row of rows){
      const day=isoDay(row[0]);
      keys.forEach((id,i)=>add(out,id,day,row[indices[i]]));
    }
  }
  return out;
}
function parseAEMO(csv) {
  const out={};
  for(const row of csvObjects(csv,'hub_name')){
    const name=String(row.hub_name||'').trim().toLowerCase();
    const id=['sydney','brisbane','adelaide'].find(h=>name.includes(h))||({syd:'sydney',bri:'brisbane',adl:'adelaide'})[name];
    if(id) add(out,id,isoDay(row.gas_date),row.ex_ante_market_price);
  }
  return out;
}
function parseMalaysia(csv){
  const out={};
  for(const row of csvObjects(csv,'series_type')){
    if(row.series_type!=='level')continue;
    const date=isoDay(row.date);
    for(const id of ['ron95','ron97','diesel','diesel_eastmsia','ron95_budi95','ron95_skps','diesel_skds','diesel_budi']) add(out,id,date,row[id]);
  }
  return out;
}

// Read only the relevant entries from the publisher's workbook, without loading a spreadsheet engine.
function zipEntries(bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let eocd=bytes.length-22;
  for(;eocd>=Math.max(0,bytes.length-65557);eocd--)if(view.getUint32(eocd,true)===0x06054b50)break;
  if(eocd<0||view.getUint32(eocd,true)!==0x06054b50)throw new Error('Invalid workbook');
  const entries={};
  let p=view.getUint32(eocd+16,true);
  const total=view.getUint16(eocd+10,true);
  for(let i=0;i<total;i++){
    if(view.getUint32(p,true)!==0x02014b50)throw new Error('Invalid workbook directory');
    const length=view.getUint16(p+28,true), extra=view.getUint16(p+30,true), comment=view.getUint16(p+32,true);
    const name=decoder.decode(bytes.subarray(p+46,p+46+length));
    const off=view.getUint32(p+42,true), method=view.getUint16(p+10,true), size=view.getUint32(p+20,true);
    const rawSize=view.getUint32(p+24,true);
    const head=off+30+view.getUint16(off+26,true)+view.getUint16(off+28,true);
    entries[name]=async()=>{
      if(rawSize>40*1024*1024)throw new Error('Oversize worksheet');
      const raw=bytes.subarray(head,head+size);
      if(!method)return decoder.decode(raw);
      if(method!==8)throw new Error('Unsupported workbook compression');
      return new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    };
    p+=46+length+extra+comment;
  }
  return entries;
}
function attr(xml,key){return (new RegExp('(?:^|\\s)'+key+'="([^"]*)"').exec(xml)||[])[1]||'';}
async function parseWorld(bytes) {
  const f=zipEntries(bytes),work=await f['xl/workbook.xml'](), rel=await f['xl/_rels/workbook.xml.rels']();
  const sheet=[...work.matchAll(/<sheet\b[^>]*>/g)].map(m=>m[0]).find(s=>/monthly prices/i.test(attr(s,'name')));
  if(!sheet)throw new Error('No monthly prices sheet');
  const rid=attr(sheet,'r:id');
  const target=[...rel.matchAll(/<Relationship\b[^>]+>/g)].map(m=>m[0]).find(s=>attr(s,'Id')===rid);
  const path=attr(target||'','Target').replace(/^\/?xl\//,'').replace(/^\//,'');
  const [sheetXML,sharedXML]=await Promise.all([f['xl/'+path](),f['xl/sharedStrings.xml']?.()||'']);
  const strings=Array.from(sharedXML.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g),m=>plain(m[1]));
  const rows=Array.from(sheetXML.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g),m=>m[1]);
  const cols={}, out={};
  const matches={
    wti:/CRUDE.?WTI|crude oil,? wti/i,brent:/CRUDE.?BRENT|crude oil,? brent/i,dubai:/CRUDE.?DUBAI|crude oil,? dubai/i,
    henry:/NGAS.?US|natural gas,? u\.?s\.?$/i,ttf:/NGAS.?EUR|natural gas,? europe/i,japanlng:/NGAS.?JP|NGAS.?JAP|liquefied natural gas,? japan|natural gas,? japan/i,
    newcastle:/COAL.?AUS|coal,? austral/i,richards:/COAL.?SAFR|coal,? south africa/i};
  for(const row of [...rows.slice(0,12),...rows.slice(Math.max(12,rows.length-180))]){
    const values={};
    for(const m of row.matchAll(/<c\b([^>]*?)(?<!\/)>([\s\S]*?)<\/c>/g)){
      const col=(attr(m[1],'r').match(/^[A-Z]+/)||[])[0];
      if(!col)continue;
      const v=m[2].match(/<v>([\s\S]*?)<\/v>/)?.[1]??plain(m[2]);
      values[col]=attr(m[1],'t')==='s'?strings[Number(v)]:v;
    }
    const date=String(values.A??'').match(/^(\d{4})M(0[1-9]|1[0-2])$/i);
    if(!date){
      for(const [col,v] of Object.entries(values))for(const [id,re] of Object.entries(matches))if(re.test(v))cols[col]=id;
      continue;
    }
    const day=new Date(Date.UTC(Number(date[1]),Number(date[2]),0)).toISOString().slice(0,10);
    for(const [col,id] of Object.entries(cols))add(out,id,day,values[col]);
  }
  return out;
}
function tag(xml,name) {
  return xml.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+name+'>','i'))?.[1]?.trim()||'';
}
function articleUrl(raw,base,source){
  try{
    const u=new URL(decodeEntities(raw),base);
    if(!['http:','https:'].includes(u.protocol)||u.port||u.username||u.password)return '';
    if(!articleHosts[source]?.includes(u.hostname))return '';
    u.protocol='https:';u.hash='';
    if(source==='U.S. EIA')u.pathname=u.pathname.toLowerCase();
    for(const k of [...u.searchParams.keys()])if(k.toLowerCase().startsWith('utm_'))u.searchParams.delete(k);
    return u.href;
  }catch{return '';}
}
async function parseFeed(xml,[source,category,base]){
  const rows=[];
  for(const item of xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)){
    const block=item[2];
    const title=plain(tag(block,'title'));
    const link=plain(tag(block,'link')) || attr(block.match(/<link\b[^>]*\bhref="[^"]+"[^>]*>/i)?.[0]||'','href');
    const rawDate=plain(tag(block,'pubDate')||tag(block,'published')||tag(block,'dc:date'));
    const instant=Date.parse(rawDate);
    if(!link||!title||!Number.isFinite(instant)||instant>Date.now())continue;
    const url=articleUrl(link,base,source);
    if(!url)continue;
    const date=/^\d{4}-\d{2}-\d{2}$/.test(rawDate)?rawDate:new Date(instant).toISOString().replace('.000Z','Z');
    const raw=plain(plain(tag(block,'description')||tag(block,'summary'))).split(/\s+/);
    const summary=raw.length<=22?raw.join(' '):raw.slice(0,22).join(' ')+'…';
    rows.push({title,url,date,source,category,summary});
    if(rows.length===35)break;
  }
  await Promise.all(rows.map(async row=>{
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(row.url));
    row.id=Array.from(new Uint8Array(bytes).subarray(0,8),n=>n.toString(16).padStart(2,'0')).join('');
  }));
  return rows;
}
function recordPrice(byDate,row) {
  const before=byDate.get(row.date);
  if(before?.value===row.value)return;
  const saved={...row,observedAt:row.observedAt||new Date().toISOString()};
  if(before){
    const {priorVersions=[],...entry}=before;
    saved.priorVersions=[...priorVersions,entry,...(row.priorVersions||[])].filter((v,i,a)=>a.findIndex(x=>x.value===v.value&&x.observedAt===v.observedAt)===i);
  }
  byDate.set(row.date,saved);
}
function mergePrices(base,patch) {
  return base.map(series=>{
    const changes=patch[series.id];
    if(!changes?.length)return series;
    const daily=['sydney','adelaide','brisbane'].includes(series.id);
    const replacing=daily&&series.cadence!=='Daily';
    if(replacing && changes.every(o=>o.date < (series.history.at(-1)?.date||'')))return series;
    const byDate=new Map((replacing?[]:series.history).map(p=>[p.date,p]));
    for(const row of changes)recordPrice(byDate,row);
    return {...series,...(daily?{cadence:'Daily',source:'AEMO',url:'https://www.aemo.com.au/energy-systems/gas/short-term-trading-market-sttm/data-sttm/daily-sttm-reports',note:'Day-ahead wholesale gas price for this hub.'}:{}),
      history:[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-1825)};
  });
}
function mergeNews(previous,incoming) {
  const approved=[...previous,...incoming].filter(r=>r.url&&articleUrl(r.url,undefined,r.source));
  const entries=new Map(approved.reverse().map(r=>[r.url,r]));
  return [...entries.values()].sort((a,b)=>b.date.localeCompare(a.date)||a.url.localeCompare(b.url)).slice(0,1600);
}
async function worldBank() {
  let file=publicFiles.world;
  try {
    const html=await download('https://www.worldbank.org/en/research/commodity-markets');
    for(const m of html.matchAll(/href=["']([^"']*CMO-Historical-Data-Monthly\.xlsx(?:\?[^"']*)?)["']/gi)){
      const link=new URL(decodeEntities(m[1]),'https://www.worldbank.org/');
      if(link.protocol==='https:'&&link.hostname.endsWith('.worldbank.org')){file=link.href;break;}
    }
  }catch{/* The published workbook remains a fallback when the listing is down. */}
  const observations=await parseWorld(await download(file,true));
  for(const rows of Object.values(observations))for(const row of rows)row.sourceUrl=file;
  return observations;
}
const sources = {
  belgium:{refresh:7200,fetch:()=>getBelgianOilPatch(download)},
  world:{refresh:86400, fetch:worldBank},
  acer:{refresh:3600, fetch:async()=>parseACER(await download(publicFiles.acer))},
  aemo:{refresh:3600, fetch:async()=>parseAEMO(await download(publicFiles.aemo))},
  malaysia:{refresh:21600, fetch:async()=>parseMalaysia(await download(publicFiles.malaysia))}
};
for(const feed of feeds)sources['news-'+feed[0]]={refresh:1800,fetch:async()=>parseFeed(await download(feed[2]),feed)};
function mergePatch(previous,next){
  const merged={...previous};
  for(const [id,rows] of Object.entries(next)){
    const m=new Map((previous?.[id]||[]).map(p=>[p.date,p]));
    for(const row of rows)recordPrice(m,row);
    merged[id]=[...m.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-1825);
  }
  return merged;
}
function snapshotKey(key) {return 'market-replay/v1/'+encodeURIComponent(key)+'.json';}
function edgeKey(key,url) {return new Request(new URL('/.market-replay-cache/v4/'+encodeURIComponent(key),url));}
async function readDurable(key,bucket) {
  if(!bucket)return null;
  const obj=await bucket.get(snapshotKey(key));
  if(!obj)return null;
  const body=await obj.json();
  if(body.version!==1 || !body.value || body.source!==key)throw new Error('Invalid stored snapshot');
  return {value:body.value,etag:obj.etag,persistedAt:body.savedAt,lastSuccessAt:body.savedAt,next:0};
}
async function readState(key,url,bucket) {
  const current=recent.get(key);
  if(current)return current;
  const cache=globalThis.caches?.default;
  if(cache){
    try{
      const hit=await cache.match(edgeKey(key,url));
      if(hit)return await hit.json();
    }catch{/* Read the persistent snapshot if the edge cache is unavailable. */}
  }
  try{return await readDurable(key,bucket);}
  catch{return {value:null,storage:'read-failed',next:0};}
}
function mergeObservations(previous,data){
  return Array.isArray(data)?mergeNews(previous||[],data):mergePatch(previous||{},data);
}
async function persistResult(key,bucket,base,state,data) {
  if(!bucket)return {...state,storage:'unbound'};
  try{
    // A cutover from an in-memory-only deployment must compare against existing durable state.
    const stored=base?.etag && base.storage!=='write-failed' ? base : await readDurable(key,bucket);
    const value=stored?mergeObservations(stored.value,data):state.value;
    if(stored && JSON.stringify(stored.value)===JSON.stringify(value)) {
      return {...state,value,etag:stored.etag,persistedAt:stored.persistedAt,storage:'unchanged'};
    }
    const savedAt=state.lastSuccessAt;
    const conditional=stored ? new Headers({'If-Match':'"'+stored.etag+'"'}) : new Headers({'If-None-Match':'*'});
    const body=JSON.stringify({version:1,source:key,savedAt,value});
    const result=await bucket.put(snapshotKey(key),body,{onlyIf:conditional,httpMetadata:{contentType:'application/json'}});
    if(result)return {...state,value,persistedAt:savedAt,etag:result.etag,storage:'saved'};
    // Another location updated the same source. Its winner is authoritative and retries will merge with it.
    const winner=await readDurable(key,bucket);
    return {...state,...(winner||{}),next:Date.now()+60000,storage:'concurrent-update'};
  }catch{
    return {...state,next:Math.min(state.next,Date.now()+300000),storage:'write-failed'};
  }
}
async function refreshSource(key,baseUrl,ctx,bucket) {
  const last=await readState(key,baseUrl,bucket);
  if(last?.next>Date.now())return last.value;
  const spec=sources[key];
  if(!inFlight.has(key)){
    const run=(async()=>{
      let state;
      const checkedAt=new Date().toISOString();
      try{
        const data=await spec.fetch();
        if(!Object.keys(data).length)throw new Error('No matching observations');
        if(priceGroups[key]?.some(id=>!data[id]?.length))throw new Error('Expected benchmark missing from publisher document');
        const value=mergeObservations(last?.value,data);
        state=await persistResult(key,bucket,last,{...last,value,next:Date.now()+spec.refresh*1000,
          checkedAt,lastSuccessAt:checkedAt,outcome:'ok'},data);
      }catch(err){
        console.warn('Market Replay source '+key+': '+String(err.message).slice(0,140));
        state={...last,value:last?.value??null,next:Date.now()+5*60*1000,checkedAt,outcome:'source-unavailable'};
      }
      recent.set(key,state);
      const cache=globalThis.caches?.default;
      if(cache){
        try {await cache.put(edgeKey(key,baseUrl),new Response(JSON.stringify(state),{headers:{'Cache-Control':'public, max-age=2592000','Content-Type':'application/json'}}));}
        catch{/* The durable snapshot and in-memory cache remain available. */}
      }
      return state.value;
    })().finally(()=>inFlight.delete(key));
    inFlight.set(key,run);
  }
  const pending=inFlight.get(key);
  ctx?.waitUntil?.(pending);
  if(last?.value)return last.value;
  let timer;
  return Promise.race([pending,new Promise(resolve=>{timer=setTimeout(()=>resolve(null),1700);})]).finally(()=>clearTimeout(timer));
}
const priceGroups={
  belgium:['be_e10','be_diesel','be_heatingoil'],
  world:['brent','wti','dubai','henry','ttf','japanlng','newcastle','richards'],
  acer:['nwe','southlng','eulng'],aemo:['sydney','brisbane','adelaide'],
  malaysia:['ron95','ron97','diesel','ron95_budi95','ron95_skps','diesel_skds','diesel_budi']
};
function maxDate(rows) {return (rows||[]).reduce((last,r)=>r.date>last?r.date:last,'')||null;}
async function refreshStatus(url,bucket) {
  const prices=JSON.parse(ASSETS['/data/prices.json'].body);
  const news=JSON.parse(ASSETS['/data/news.json'].body);
  const states=await Promise.all(Object.keys(sources).map(async key=>{
    const status=await readState(key,url,bucket);
    let durableSnapshotVerified=null;
    if(bucket && status?.etag) {
      try {durableSnapshotVerified=(await bucket.head(snapshotKey(key)))?.etag===status.etag;}
      catch{/* A verification read failure does not invalidate the stored observation. */}
    }
    const fromSeed=key.startsWith('news-')
      ? news.filter(n=>n.source===key.slice(5))
      : prices.filter(s=>priceGroups[key].includes(s.id)).flatMap(s=>s.history);
    const observations=key.startsWith('news-')?status?.value:Object.values(status?.value||{}).flat();
    return {source:key,check:status?.outcome||(status?.persistedAt?'from-storage':'not-checked'),
      lastCheckedAt:status?.checkedAt||null,lastSuccessfulReadAt:status?.lastSuccessAt||null,
      latestFetchedObservation:maxDate(observations),latestBundledObservation:maxDate(fromSeed),
      durableSnapshotSavedAt:status?.persistedAt||null,durableSnapshotVerified,
      storage:status?.storage||(status?.persistedAt?'stored':bucket?'empty':'unbound')};
  }));
  return new Response(JSON.stringify({checkedAt:new Date().toISOString(),sources:states}),
    {headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
async function dataRequest(path,url,ctx,bucket){
  const seed=JSON.parse(ASSETS[path].body);
  const isNews=path==='/data/news.json';
  const keys=Object.keys(sources).filter(k=>k.startsWith('news-')===isNews);
  const results=await Promise.allSettled(keys.map(k=>refreshSource(k,url,ctx,bucket)));
  let data=seed;
  for(const r of results)if(r.status==='fulfilled'&&r.value){
    data=isNews?mergeNews(data,r.value):mergePrices(data,r.value);
  }
  return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=60','X-Content-Type-Options':'nosniff'}});
}
export default {
  async fetch(request,env,ctx){
    if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
    const url=new URL(request.url);
    const path=url.pathname==='/'?'/index.html':url.pathname;
    if(path==='/refresh-status.json')return request.method==='HEAD'?new Response(null,{headers:{'Content-Type':'application/json'}}):refreshStatus(url,env?.BUCKET);
    if(!Object.hasOwn(ASSETS,path))return new Response('Page not found',{status:404});
    if(request.method==='GET' && (path==='/data/prices.json'||path==='/data/news.json'))return dataRequest(path,url,ctx,env?.BUCKET);
    const a=ASSETS[path], body=request.method==='HEAD'?null:a.binary?Uint8Array.from(atob(a.body),c=>c.charCodeAt(0)):a.body;
    return new Response(body,{headers:{'Content-Type':a.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
  }
};
