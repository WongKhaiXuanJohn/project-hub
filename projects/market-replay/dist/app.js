'use strict';
const main = document.querySelector('#main');
const state = {prices:[],news:[],cleanup:[], previous:null, ready:false, catchup:false, replayMode:'week', edition:null};
const dateFmt=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const kl='Asia/Kuala_Lumpur';
const saved=document.querySelector('#saved-edition');
const edition=saved?JSON.parse(saved.textContent):null;
const nowDay=()=>(edition?'Saved edition · ':'')+new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:kl}).format(edition?Date.parse(edition.asOf):Date.now());
const dateLabel=d=>dateFmt.format(new Date(d.length===10?d+'T00:00:00Z':d));
const escapeText=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'||u.protocol==='http:'?escapeText(u.href):'#';}catch{return '#';}}
function setClock(){document.querySelector('#clock').textContent='KUL  '+new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:kl}).format(Date.now())+' MYT';}setClock();setInterval(setClock,15000);
try{state.previous=JSON.parse(localStorage.getItem('market-replay-visit-v1'));}catch{}
function latest(p){return p.history[p.history.length-1];}
function pct(p){const a=p.history.at(-1)?.value,b=p.history.at(-2)?.value;return Number.isFinite(a)&&b?(a-b)/Math.abs(b)*100:null;}
const percent=n=>n==null?'—':(n>0?'+':'')+n.toFixed(1)+'%';
function persistVisit(){try{localStorage.setItem('market-replay-visit-v1',JSON.stringify({at:new Date().toISOString(),quotes:Object.fromEntries(state.prices.filter(p=>p.history.length).map(p=>[p.id,[latest(p).date,latest(p).value,p.cadence]])),stories:state.news.map(n=>n.url)}));}catch{}}
function pageHead(title,aside=''){return '<div class="pagehead"><h1>'+title+'</h1>'+aside+'</div>';}
function section(title,dest,label){return '<div class="sectionhead"><h2>'+title+'</h2>'+(dest?'<a class="text-link" href="#'+dest+'">'+label+'</a>':'')+'</div>';}
function card(n){return '<a class="wirecard" rel="noopener" target="_blank" href="'+safeUrl(n.url)+'"><div class="meta"><span class="'+(n.category==='AI'?'tag-a':'tag-e')+'">'+escapeText(n.category==='AI'?'AI':'ENERGY')+'</span>　/　'+escapeText(dateLabel(n.date))+'</div><h3>'+escapeText(n.title)+'</h3><p>'+escapeText(n.summary)+'</p><span class="meta source">'+escapeText(n.source)+' ↗</span></a>';}
function quoteTile(p){
 const h=p.history.slice(-24);
 const values=h.map(r=>r.value), low=Math.min(...values), high=Math.max(...values);
 const start=Date.parse(h[0].date), span=Date.parse(h.at(-1).date)-start;
 const pts=h.map(({date,value})=>[(span?(Date.parse(date)-start)/span*250:125).toFixed(1),(high===low?16:27-(value-low)/(high-low)*22).toFixed(1)].join(',')).join(' ');
 const d=latest(p).date, monthly=/monthly/i.test(p.cadence), weekly=/weekly/i.test(p.cadence);
 const date=monthly?new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(d)):dateLabel(d);
 const change=pct(p), direction=change===null||change===0?'':change>0?'rise':'fall';
 const previousPeriod=monthly?'previous month':weekly?'previous release':'previous observation';
 return '<button type="button" class="quote-card" data-open-market="'+escapeText(p.id)+'"><span class="quote-name">'+escapeText(p.name)+'<span class="ticker">'+escapeText(p.cadence)+'</span></span><span class="quote-num">'+new Intl.NumberFormat('en-GB',{minimumFractionDigits:2,maximumFractionDigits:3}).format(latest(p).value)+'<small>'+escapeText(p.unit)+'</small></span><svg class="mini-line" viewBox="0 0 250 32" preserveAspectRatio="none" aria-hidden="true"><path d="M0 31 H250" stroke="#353637" stroke-dasharray="2 4"/><polyline points="'+pts+'" fill="none" stroke="'+(change<0?'#ef9b81':'#79c5a7')+'" stroke-width="1.7" vector-effect="non-scaling-stroke"/></svg><span class="quote-change '+direction+'">'+(change===null?'First observation':percent(change)+' vs '+previousPeriod)+'</span><span class="q-foot">'+escapeText(p.source)+' · '+escapeText(date)+'</span></button>';
}
function catchup(){
 const prev=state.previous;
 const stories=prev?state.news.filter(n=>!(prev.stories||[]).includes(n.url)&&n.date.slice(0,10)>=String(prev.at).slice(0,10)):state.news.slice(0,4);
 const updates=prev?state.prices.filter(p=>p.history.length&&JSON.stringify(prev.quotes?.[p.id])!==JSON.stringify([latest(p).date,latest(p).value,p.cadence])):[];
 const list=stories.slice(0,8).map(n=>'<li><a href="'+safeUrl(n.url)+'" target="_blank" rel="noopener">'+escapeText(n.title)+'</a></li>').join('');
 const data=updates.map(p=>'<li><button class="quiet-btn" data-open-market="'+escapeText(p.id)+'">'+escapeText(p.name)+' · '+latest(p).value+' '+escapeText(p.unit)+' · '+dateLabel(latest(p).date)+'</button></li>').join('');
 return '<section class="catchup"><h2>'+(prev?'Since '+dateLabel(prev.at):'Your first briefing')+'</h2>'+(data||list?'<ul>'+data+list+'</ul>':'<p class="subtext">No new observations or stories since your last visit.</p>')+'</section>';
}
function overview(){
 const eu=state.prices.find(p=>p.id==='eulng'&&p.history.length>1),change=eu?pct(eu):null;
 const epoch=eu?dateLabel(latest(eu).date):'20 Apr 2020';
 const leadTitle=eu?'European LNG '+(change>0?'rises':change<0?'falls':'holds at')+' <em>'+(change===0?'€'+latest(eu).value.toFixed(2):Math.abs(change).toFixed(1)+'%')+'</em>':'The day oil went <em>negative.</em>';
 const recentAI=state.news.find(n=>n.category==='AI'),recentEnergy=state.news.find(n=>n.category==='Energy'),rest=state.news.find(n=>n!==recentEnergy&&n!==recentAI);
 const tiles=['eulng','brent','wti','ron95'].map(id=>state.prices.find(p=>p.id===id&&p.history.length)).filter(Boolean);
 main.innerHTML=pageHead('Market overview','<span class="page-date">'+nowDay()+'</span>')+'<div class="lead-grid"><section class="lead-card"><canvas class="atlas" aria-hidden="true"></canvas><div class="lead-content"><span class="eyebrow"><i></i>Market in focus</span><h2>'+leadTitle+'</h2><p>'+(eu?'The latest EU-wide assessment is €'+latest(eu).value.toFixed(2)+' per MWh. Compare the move with other European LNG markets.':'Rewind the May WTI contract through expiry week.')+'</p><div class="lead-bottom"><button class="accent-btn" '+(eu?'data-open-market="eulng"':'data-view="replay"')+'>Explore '+(eu?'the move':'the replay')+'</button></div><div class="lede-source">'+(eu?'ACER':'Historical replay')+' · '+epoch+'</div></div></section><aside class="brief-card" id="quote-panel"></aside></div>'+section('Benchmark monitor','markets','All markets')+'<div class="tile-grid">'+tiles.map(quoteTile).join('')+'</div><div class="sectionhead"><h2>Intelligence wire</h2><button class="pill-btn" data-catch aria-expanded="'+state.catchup+'">Since I last checked</button></div>'+(state.catchup?catchup():'')+'<div class="wire-grid">'+[recentEnergy,recentAI,rest].filter(Boolean).map(card).join('')+'</div>'+section('Market replay','replay','Open replay')+'<a href="?step=2#replay" class="archive-card"><span class="archive-symbol" aria-hidden="true">◀◀</span><span><span class="meta">20 APRIL 2020　/　WTI</span><strong>How could oil cost minus $37.63?</strong></span><span class="archive-play" aria-hidden="true">▶</span></a>';
 const clean=window.mountAtlas?.(main.querySelector('canvas'));if(clean)state.cleanup.push(clean);
 const box=document.querySelector('#quote-panel');
 window.mountSettlements(box,state.prices);
 const b=state.prices.find(p=>p.id==='brent'),w=state.prices.find(p=>p.id==='wti');
 if(b?.history.length&&w?.history.length&&b.cadence==='Monthly'&&w.cadence==='Monthly'&&b.unit===w.unit&&latest(b).date===latest(w).date){const spread=latest(b).value-latest(w).value;const panel=document.createElement('div');panel.className='spread';panel.innerHTML='<div><span class="meta">BRENT − WTI</span><strong>'+ (spread>=0?'+':'−')+'$'+Math.abs(spread).toFixed(2)+'<small> / bbl</small></strong></div><span>Monthly average<br>'+new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(latest(b).date))+'</span>';box.append(panel);}

}
function aiDesk(){
 const releases=state.news.filter(article=>article.category==='AI');
 main.innerHTML=pageHead('AI desk','<span class="page-date">'+nowDay()+'</span>')+
   '<p class="subtext">Model releases, research and computing infrastructure from original publishers.</p><div class="release-list"></div>';
 const list=main.querySelector('.release-list');
 if(!releases.length){list.textContent='No releases available yet.';return;}
 const more=document.createElement('button');
 more.type='button';more.className='pill-btn more-releases';more.textContent='Show more releases';
 let shown=0;
 function appendReleases(focusFirst){
   const start=shown;
   const next=releases.slice(start,start+12);
   const markup=next.map(article=>'<article class="release-row"><div class="release-byline"><span>'+escapeText(article.source)+'</span><time datetime="'+escapeText(article.date)+'">'+escapeText(dateLabel(article.date))+'</time></div><div class="release-body"><h2><a href="'+safeUrl(article.url)+'" rel="noopener" target="_blank">'+escapeText(article.title)+'</a></h2>'+(article.summary?'<p>'+escapeText(article.summary)+'</p>':'')+'</div></article>').join('');
   list.insertAdjacentHTML('beforeend',markup);
   shown+=next.length;
   if(shown>=releases.length)more.remove();
   if(focusFirst&&next.length)list.children[start].querySelector('a').focus();
 }
 main.append(more);more.addEventListener('click',()=>appendReleases(true));appendReleases(false);
}
function sources(){
 const groups=Map.groupBy ? Map.groupBy(state.prices,p=>p.source) : state.prices.reduce((m,p)=>m.set(p.source,[...(m.get(p.source)||[]),p]),new Map());
 const sourceDescriptions={
  'World Bank Pink Sheet':'Monthly commodity prices for oil, natural gas, coal and Japan’s LNG imports. Each chart point represents one reference month.',
  'FPS Economy / Statbel':'Belgium’s maximum consumer prices for petrol, diesel and bulk heating oil, including VAT. Daily history from Statbel (CC BY 4.0), with effective rates from FPS Economy.',
  'ACER':'European Union Agency for the Cooperation of Energy Regulators. The agency assesses physical LNG prices for northwest Europe, southern Europe and the EU on working days.',
  'AEMO':'The Australian Energy Market Operator publishes day-ahead wholesale gas prices for Sydney, Brisbane and Adelaide.',
  'Malaysia Ministry of Finance':'Weekly retail prices reflect the effective date and subsidy scheme published by Malaysia’s Ministry of Finance.'
 };
 const cards=Array.from(groups,([name,series])=>{
   const p=series[0];
   return '<article class="source-card"><div class="meta">'+escapeText(p.cadence)+' · '+series.length+' series</div><h3>'+escapeText(name)+'</h3><p>'+escapeText(sourceDescriptions[name]||p.note||p.group)+'</p><a target="_blank" rel="noopener" href="'+safeUrl(p.url)+'">Open publisher</a></article>';
 }).join('');
 main.innerHTML=pageHead('Sources &amp; methodology')+'<p class="subtext">Observation dates identify when a price applied. Percentage moves compare two consecutive observations from the same series. A saved quote retains its original date when a publisher is unavailable.</p><div class="source-grid">'+cards+'<article class="source-card"><div class="meta">Daily observations</div><h3>Crude spot and futures</h3><p>The U.S. Energy Information Administration publishes daily spot observations for WTI and Brent. FRED hosts the comparison chart. ICE and CME publish futures prices by delivery month.</p><a target="_blank" rel="noopener" href="https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm">Open EIA spot prices</a></article><article class="source-card"><div class="meta">Editorial sources</div><h3>AI and energy releases</h3><p>Each story names its publisher and links to the original announcement or report. Company-reported results are attributed to the company.</p></article><article class="source-card"><div class="meta">Geography</div><h3>Market atlas</h3><p>Natural Earth provides the coastlines. The arcs illustrate geographic connections.</p><a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Open Natural Earth</a></article></div>';
 if(!edition){const status=document.createElement('div');status.className='source-health';main.append(status);fetch('/refresh-status.json').then(r=>r.json()).then(report=>{
 const names={world:'World Bank',acer:'ACER',aemo:'AEMO',malaysia:'Malaysia MOF',belgium:'Belgium · FPS Economy'};
 const statusNames={'source-unavailable':'Publisher unavailable',failed:'Publisher unavailable',ok:'Checked',success:'Checked','not-checked':'Awaiting first check','from-storage':'Saved observations'};
 const checks=report.sources.map(row=>{
   const date=row.latestFetchedObservation||row.latestBundledObservation;
   const checked=row.check==='ok'||row.check==='success';
   return '<li class="check-row"><strong>'+escapeText(names[row.source]||row.source.replace(/^news-/,'')+' news')+'</strong><span class="check-label" data-checked="'+checked+'">'+escapeText(statusNames[row.check]||row.check)+'</span><span class="check-date">Latest observation · '+(date?escapeText(dateLabel(date)):'Unavailable')+'</span></li>';
 }).join('');
 status.innerHTML=section('Source checks')+'<ul class="check-list">'+checks+'</ul>';
 }).catch(()=>{status.textContent='Source check status is unavailable.';});}

}
function recentReplay(slot){
 const cutoff=(edition?Date.parse(edition.asOf):Date.now())-7*86400000;
 const news=state.news.filter(n=>new Date(n.date).valueOf()>=cutoff).sort((a,b)=>a.date.localeCompare(b.date));
 const days=[...new Set(news.map(n=>n.date.slice(0,10)))];
 if(!days.length){slot.innerHTML='<p class="subtext">No verified releases in the past seven days. The historical replay is available above.</p>';return;}
 let i=days.indexOf(new URLSearchParams(location.search).get('day'));if(i<0)i=days.length-1;
 let timer;
 function show(){const day=days[i];slot.innerHTML='<div class="week-controls"><button id="week-play" class="accent-btn">'+(timer?'Pause':'Play week')+'</button><input id="week-slider" type="range" min="0" max="'+(days.length-1)+'" value="'+i+'" aria-label="Replay date"><strong>'+dateLabel(day)+'</strong></div><div class="wire-grid">'+news.filter(n=>n.date.startsWith(day)).map(card).join('')+'</div>';
 const slider=slot.querySelector('input');slider.setAttribute('aria-valuetext',dateLabel(day));slider.oninput=e=>{clearInterval(timer);timer=null;i=+e.target.value;show();slot.querySelector('input').focus();};slot.querySelector('button').onclick=()=>{if(timer){clearInterval(timer);timer=null;}else{if(i===days.length-1)i=0;timer=setInterval(()=>{i++;if(i>=days.length-1){i=days.length-1;clearInterval(timer);timer=null;}show();},6500);}show();};}
 show();state.cleanup.push(()=>clearInterval(timer));
}
function replay(){
 if(new URLSearchParams(location.search).has('step'))state.replayMode='oil';
 main.innerHTML=pageHead('Market replay')+'<div class="filters replay-tabs"><button class="pill-btn" data-mode="week" aria-pressed="'+(state.replayMode==='week')+'">This week</button><button class="pill-btn" data-mode="oil" aria-pressed="'+(state.replayMode==='oil')+'">The negative-oil replay</button></div><div id="episode"></div>';
 const slot=document.querySelector('#episode');
 if(state.replayMode==='oil'){const clean=window.mountReplay(slot);if(clean)state.cleanup.push(clean);}else recentReplay(slot);
}
function route(){
 if(!state.ready)return;
 state.cleanup.splice(0).forEach(fn=>fn());
 const raw=location.hash.slice(1)||(new URLSearchParams(location.search).has('step')?'replay':'overview');
 const page=['overview','markets','ai','replay','sources'].includes(raw)?raw:'overview';
 document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 document.title=({overview:'Market overview',markets:'Energy board',ai:'AI desk',replay:'Market replay',sources:'Sources'}[page])+' · Market Replay';
 if(page==='overview')overview();if(page==='ai')aiDesk();if(page==='sources')sources();if(page==='replay')replay();if(page==='markets'){main.innerHTML=pageHead('Energy board','<a class="market-source-link" href="#sources">Sources &amp; methodology</a>')+'<div id="market-table"></div>';window.showMarkets(document.querySelector('#market-table'),state.prices);}
}
document.querySelector('.skip').addEventListener('click',event=>{
 event.preventDefault();main.focus();main.scrollIntoView({block:'start'});
});
main.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.openMarket)window.openInstrument(b.dataset.openMarket,state.prices);if(b.dataset.view)location.hash=b.dataset.view;if(b.hasAttribute('data-catch')){state.catchup=!state.catchup;route();main.querySelector('[data-catch]')?.focus({preventScroll:true});}if(b.dataset.mode){state.replayMode=b.dataset.mode;const u=new URL(location.href);u.searchParams.delete('step');history.replaceState(null,'',u);route();main.querySelector('[data-mode][aria-pressed="true"]')?.focus({preventScroll:true});}});
function refreshBoard(){
 const slot=document.querySelector('#market-table');
 if(!slot)return;
 const dialog=document.querySelector('dialog[open]');
 if(dialog){if(!dialog.dataset.refreshBoard){dialog.dataset.refreshBoard='pending';dialog.addEventListener('close',refreshBoard,{once:true});}return;}
 window.updateMarkets?.(slot,state.prices);
}
window.addEventListener('hashchange',()=>{route();window.scrollTo(0,0);});
async function loadData(){
 try{
 const [prices,news]=edition?[edition.prices,edition.news]:await Promise.all(['prices','news'].map(async name=>{const r=await fetch('/data/'+name+'.json',{cache:'no-cache'});if(!r.ok)throw Error('Unavailable');return r.json();}));
 const changed=JSON.stringify([prices,news])!==state.edition;
 state.prices=prices;state.news=news.filter(n=>Number.isFinite(Date.parse(n.date))).sort((a,b)=>b.date.localeCompare(a.date));state.edition=JSON.stringify([prices,news]);
 if(!state.ready){state.ready=true;route();persistVisit();}
 else if(changed&&location.hash==='#markets'){refreshBoard();}
 else if(changed&&(!location.hash||location.hash==='#overview')&&!document.querySelector('dialog[open]')){route();persistVisit();}
 }catch{if(!state.ready){main.innerHTML='<p class="error">The briefing could not be loaded.</p><button class="pill-btn" id="retry">Try again</button>';document.querySelector('#retry').onclick=loadData;}}
}
loadData();if(!edition)setInterval(()=>{if(!document.hidden)loadData();},300000);
