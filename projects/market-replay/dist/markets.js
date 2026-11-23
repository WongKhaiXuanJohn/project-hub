/* Market board and benchmark histories. All source-provided text is rendered as text. */
(() => {
  'use strict';
  const number = new Intl.NumberFormat('en', {maximumFractionDigits: 3});
  const quoteNumber = new Intl.NumberFormat('en', {maximumFractionDigits: 10});
  const signed = new Intl.NumberFormat('en', {maximumFractionDigits: 2, signDisplay: 'exceptZero'});
  const month = new Intl.DateTimeFormat('en-GB', {month: 'short', year: 'numeric', timeZone: 'UTC'});
  const day = new Intl.DateTimeFormat('en-GB', {day:'numeric', month:'short', year:'numeric', timeZone:'UTC'});
  const names = {nwe:'Northwest Europe LNG',southlng:'Southern Europe LNG',eulng:'EU-wide LNG'};
  const ns = 'http://www.w3.org/2000/svg';
  function el(tag, className, label) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (label != null) e.textContent = label;
    return e;
  }
  function button(label, handler, cls) {
    const b = el('button', cls, label);
    b.type = 'button';
    b.addEventListener('click', handler);
    return b;
  }
  function link(label, url) {
    const e = el('a', 'mk-link', label);
    try {
      const parsed = new URL(url);
      if (['http:', 'https:'].includes(parsed.protocol)) {
        e.href = parsed.href;
        e.target = '_blank';
        e.rel = 'noopener noreferrer';
      }
    } catch { /* Missing URL yields an unlinked source label. */ }
    return e;
  }
  function labelDate(value, item) {
    const iso = value.length === 7 ? value + '-01' : value;
    const d = new Date(iso);
    if (Number.isNaN(d.valueOf())) return value;
    if (/quarter/i.test(item.cadence)) return 'Q'+(Math.floor(d.getUTCMonth()/3)+1)+' '+d.getUTCFullYear();
    return (/month/i.test(item.cadence) ? month : day).format(d);
  }
  function points(item) {
    const dates = new Map();
    for (const p of item.history || []) {
      if (Number.isFinite(p.value) && typeof p.date === 'string' && Number.isFinite(Date.parse(p.date))) dates.set(p.date,p);
    }
    return [...dates.values()].sort((a,b) => a.date.localeCompare(b.date));
  }
  function delta(history) {
    if (history.length < 2) return null;
    const prior = history[history.length - 2].value;
    return prior === 0 ? null : (history[history.length - 1].value - prior) / Math.abs(prior) * 100;
  }
  function svgel(name, attrs) {
    const e = document.createElementNS(ns, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k,v);
    return e;
  }
  function lineChart(history) {
    const svg = svgel('svg',{viewBox:'0 0 100 28',preserveAspectRatio:'none'});
    svg.setAttribute('class','mk-mini');
    svg.setAttribute('aria-hidden','true');
    const w = 100, h = 28, pad = 4;
    const times = history.map(p => Date.parse(p.date));
    const min = Math.min(...history.map(p=>p.value)), max = Math.max(...history.map(p=>p.value));
    const [t0,t1] = [times[0],times[times.length-1]];
    const coords = history.map((p,i)=>[
      t1 > t0 ? pad+(w-2*pad)*(times[i]-t0)/(t1-t0) : w/2,
      max > min ? h-pad-(h-2*pad)*(p.value-min)/(max-min) : h/2
    ]);
    if (!coords.length) return svg;
    if (coords.length>1) {
      const pts = coords.map(pt=>pt.map(v=>v.toFixed(2)).join(',')).join(' ');
      svg.append(svgel('polyline',{points:pts,stroke:'currentColor',fill:'none','stroke-width':1.5,'vector-effect':'non-scaling-stroke'}));
    }
    const end = coords[coords.length-1];
    svg.append(svgel('circle',{cx:end[0],cy:end[1],r:1.8,fill:'currentColor'}));
    return svg;
  }
  let chartSequence = 0;
  function priceChart(history, item) {
    const chart = el('section', 'mk-inspect');
    const heading = el('div', 'mk-inspect-heading');
    heading.append(el('h3', null, 'Price history'), el('span', 'mk-inspect-unit', item.unit));
    chart.append(heading);
    if (history.length < 2) {
      const point = history[0];
      const message = point
        ? 'One published observation · ' + labelDate(point.date,item) + ' · ' + quoteNumber.format(point.value) + ' ' + item.unit
        : 'No published observations.';
      chart.append(el('p', 'mk-inspect-single', message));
      return chart;
    }

    const times = history.map(p => Date.parse(p.date));
    const first = times[0], duration = times.at(-1) - first;
    const values = history.map(p => p.value);
    const low = Math.min(...values), high = Math.max(...values);
    const coords = history.map((p,i) => ({
      x: duration ? 100 * (times[i] - first) / duration : 50,
      y: high === low ? 50 : 92 - 84 * (p.value - low) / (high - low)
    }));
    const body = el('div', 'mk-inspect-body');
    const surface = el('div', 'mk-inspect-surface');
    const axis = el('div', 'mk-inspect-yaxis');
    axis.setAttribute('aria-hidden', 'true');
    const levels = high === low ? [[50,low]] : [[8,high],[50,(high+low)/2],[92,low]];
    for (const [y,value] of levels) {
      const rule = el('span', 'mk-inspect-rule');
      const tick = el('span', 'mk-inspect-ytick', number.format(value));
      rule.style.top = tick.style.top = y + '%';
      surface.append(rule);
      axis.append(tick);
    }
    const svg = svgel('svg', {viewBox:'0 0 100 100', preserveAspectRatio:'none', 'aria-hidden':'true', focusable:'false'});
    const curve = coords.map(p => p.x.toFixed(4) + ',' + p.y.toFixed(4)).join(' ');
    const gradientId = 'mk-fill-' + (++chartSequence);
    const defs = svgel('defs', {});
    const fill = svgel('linearGradient', {id:gradientId, x1:0, y1:0, x2:0, y2:1});
    fill.append(svgel('stop', {offset:0, 'stop-color':'currentColor','stop-opacity':'.15'}),
                svgel('stop', {offset:1, 'stop-color':'currentColor','stop-opacity':'0'}));
    defs.append(fill);
    svg.append(defs,
      svgel('polygon', {points:curve + ' 100,100 0,100', fill:'url(#' + gradientId + ')'}),
      svgel('polyline', {points:curve, fill:'none', stroke:'currentColor', 'stroke-linecap':'round',
        'stroke-linejoin':'round', 'stroke-width':2.15, 'vector-effect':'non-scaling-stroke'}));
    const lastDot = el('span', 'mk-inspect-endpoint');
    lastDot.style.top = coords.at(-1).y + '%';
    const cursor = el('div', 'mk-inspect-cursor');
    cursor.hidden = true;
    cursor.setAttribute('aria-hidden', 'true');
    cursor.append(el('span', 'mk-inspect-vline'), el('span', 'mk-inspect-hline'), el('span', 'mk-inspect-dot'));
    const tip = el('div', 'mk-inspect-tip');
    const tipDate = el('span'), tipValue = el('strong');
    tip.append(tipDate,tipValue);
    cursor.append(tip);
    surface.append(svg,lastDot,cursor);
    body.append(surface,axis);

    const dates = el('div', 'mk-inspect-dates');
    dates.setAttribute('aria-hidden', 'true');
    dates.append(el('span', null, labelDate(history[0].date,item)),el('span', null, labelDate(history.at(-1).date,item)));
    const hint = el('p', 'mk-inspect-hint');
    hint.id = 'mk-hint-' + chartSequence;
    hint.append(el('span', 'mk-inspect-mouse', 'Hover or use the arrow keys to explore.'),
                el('span', 'mk-inspect-touch', 'Touch and slide to explore.'));
    surface.tabIndex = 0;
    surface.setAttribute('role','slider');
    surface.setAttribute('aria-label', (item.name || 'Benchmark') + ' historical observations');
    surface.setAttribute('aria-describedby',hint.id);
    surface.setAttribute('aria-valuemin','1');
    surface.setAttribute('aria-valuemax', String(history.length));
    chart.append(body,dates,hint);

    let selected = history.length - 1;
    function read(index) {
      selected = index;
      const p = history[index];
      tipDate.textContent = labelDate(p.date,item);
      tipValue.textContent = quoteNumber.format(p.value) + ' ' + item.unit;
      surface.setAttribute('aria-valuenow',String(index + 1));
      surface.setAttribute('aria-valuetext',tipDate.textContent + ', ' + tipValue.textContent);
    }
    function show(index) {
      read(index);
      cursor.hidden = false;
      lastDot.hidden = true;
      const {x,y} = coords[index];
      cursor.style.setProperty('--cursor-x',x + '%');
      cursor.style.setProperty('--cursor-y',y + '%');
      const w = surface.clientWidth, h = surface.clientHeight, gap = 12;
      const xPx = x*w/100, yPx = y*h/100;
      const left = xPx + gap + tip.offsetWidth <= w ? xPx + gap : xPx - gap - tip.offsetWidth;
      const top = yPx >= tip.offsetHeight + gap ? yPx - gap - tip.offsetHeight : yPx + gap;
      tip.style.left = Math.max(0, Math.min(w - tip.offsetWidth, left)) + 'px';
      tip.style.top = Math.max(0, Math.min(h - tip.offsetHeight, top)) + 'px';
    }
    function hide() {
      cursor.hidden = true;
      lastDot.hidden = false;
    }
    function pointAt(event) {
      const rect = surface.getBoundingClientRect();
      if (!rect.width) return;
      const time = first + Math.max(0,Math.min(1,(event.clientX - rect.left) / rect.width)) * duration;
      let start = 0, end = times.length - 1;
      while (start < end) {
        const middle = (start + end) >> 1;
        if (times[middle] < time) start = middle + 1;
        else end = middle;
      }
      const i = start > 0 && time - times[start-1] < times[start] - time ? start - 1 : start;
      show(i);
    }
    read(selected);
    surface.addEventListener('pointerdown', event => {
      if (!event.isPrimary) return;
      if (event.pointerType !== 'mouse') surface.setPointerCapture(event.pointerId);
      pointAt(event);
    });
    surface.addEventListener('pointermove', event => { if (event.isPrimary) pointAt(event); });
    surface.addEventListener('pointerleave', event => {
      if (event.pointerType === 'mouse' && !surface.matches(':focus-visible')) hide();
    });
    surface.addEventListener('pointercancel', hide);
    surface.addEventListener('focus', () => show(selected));
    surface.addEventListener('blur', hide);
    surface.addEventListener('keydown', event => {
      let next;
      switch (event.key) {
        case 'Home': next = 0; break;
        case 'End': next = history.length - 1; break;
        case 'ArrowRight': case 'ArrowUp': next = selected + 1; break;
        case 'ArrowLeft': case 'ArrowDown': next = selected - 1; break;
        default: return;
      }
      event.preventDefault();
      show(Math.max(0, Math.min(history.length - 1, next)));
    });
    return chart;
  }
  const crudeReferences = [
    {
      id: 'wti', name: 'WTI', region: 'Cushing, Oklahoma',
      spot: 'https://www.eia.gov/dnav/pet/hist/RWTCD.htm',
      exchange: 'CME', futures: 'https://www.cmegroup.com/markets/energy/crude-oil/light-sweet-crude.settlements.html'
    },
    {
      id: 'brent', name: 'Brent', region: 'North Sea',
      spot: 'https://www.eia.gov/dnav/pet/hist/RBRTED.htm',
      exchange: 'ICE', futures: 'https://www.ice.com/products/219/Brent-Crude-Futures/data'
    }
  ];

  function referenceLinks(ref) {
    const links = el('div', 'oil-ref-links');
    const spot = link('EIA · Daily spot ↗', ref.spot);
    const future = link(ref.exchange + ' · Futures ↗', ref.futures);
    spot.setAttribute('aria-label', ref.name + ' daily spot prices at the U.S. Energy Information Administration (opens in a new tab)');
    future.setAttribute('aria-label', ref.name + ' futures at ' + ref.exchange + ' (opens in a new tab)');
    links.append(spot, future);
    return links;
  }

  function mountSettlements(container) {
    const panel = el('section', 'oil-panel');
    panel.setAttribute('aria-label', 'Daily crude oil references');
    panel.append(el('div', 'board-kicker', 'Crude oil'), el('h2', '', 'Daily oil prices'));
    for (const ref of crudeReferences) {
      const row = el('div', 'oil-ref');
      const name = el('div', 'oil-ref-name');
      name.append(el('strong', '', ref.name), el('span', '', ref.region));
      row.append(name, referenceLinks(ref));
      panel.append(row);
    }
    window.addCrudeViewer?.(panel);
    container.replaceChildren(panel);
  }

  function addSettlement(section, id) {
    const ref = crudeReferences.find(entry => entry.id === id);
    if (!ref) return;
    const area = el('section', 'mk-quote');
    area.append(el('h3', '', ref.name + ' daily spot and futures prices'), referenceLinks(ref));
    section.append(area);
  }

  function openInstrument(id, prices) {
    const item = prices.find(p=>p.id===id);
    if (!item) return;
    document.querySelector('dialog.mk-modal')?.close();
    const history=points(item), latest=history.at(-1), change=delta(history);
    const dialog=el('dialog','mk-modal');
    dialog.setAttribute('aria-labelledby','mk-instrument-title');
    const inner=el('div','mk-dialog-inner'), top=el('div','mk-top');
    top.append(el('span','mk-tag',item.group || 'Energy'),button('Close',()=>dialog.close(),'mk-btn mk-close'));
    const title=el('h2',null,item.name || names[id] || id);
    title.id='mk-instrument-title';
    inner.append(top,title);
    if (latest) {
      const value=el('div','mk-value',quoteNumber.format(latest.value));
      value.append(el('span','mk-unit',item.unit));
      inner.append(value,el('p','mk-meta',[item.cadence,labelDate(latest.date,item),item.source].filter(Boolean).join(' · ')));
      if (change!==null) {
        const prior=history.at(-2);
        inner.append(el('p','mk-muted',signed.format(change)+'% since '+labelDate(prior.date,item)+' ('+quoteNumber.format(prior.value)+' '+item.unit+').'));
      }
    } else {
      inner.append(el('p','mk-muted','No verified observations are available yet.'));
    }
    if (item.note) inner.append(el('p','mk-note',item.note));
    if (history.length) {
      inner.append(priceChart(history,item));
      const detail=el('details','mk-history');
      detail.append(el('summary',null,history.length === 1 ? 'View the observation' : 'View all '+history.length+' observations'));
      const wrap=el('div','mk-history-scroll'), t=el('table'), header=t.createTHead().insertRow();
      for(const val of ['Observation',item.unit || 'Price']) header.append(el('th',null,val));
      const body=t.createTBody();
      for(const p of history.slice().reverse()) {
        const r=body.insertRow(); r.append(el('td',null,labelDate(p.date,item)),el('td',null,quoteNumber.format(p.value)));
      }
      wrap.append(t); detail.append(wrap); inner.append(detail);
    }
    inner.append(link('Source · '+item.source,latest?.sourceUrl || item.url));
    if (id==='wti'||id==='brent') addSettlement(inner,id);
    dialog.append(inner); document.body.append(dialog);
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});
    dialog.addEventListener('click', e=>{if (e.target===dialog) dialog.close();});
    dialog.showModal();
  }
  const frequencyOrder = ['Daily', 'Weekly', 'Monthly', 'All'];
  const publisherNames = {
    'World Bank Pink Sheet': 'World Bank',
    'Malaysia Ministry of Finance': 'Malaysia MOF'
  };

  function frequency(cadence) {
    if (/^(daily|weekday|business day|working day)/i.test(cadence)) return 'Daily';
    if (/^week/i.test(cadence)) return 'Weekly';
    if (/^month/i.test(cadence)) return 'Monthly';
    return cadence || 'Unspecified';
  }

  function publisherLink(item, latest) {
    const publisher = link(publisherNames[item.source] || item.source, latest?.sourceUrl || item.url);
    publisher.setAttribute('aria-label', 'Open ' + item.name + ' observation from ' + item.source + ' (new tab)');
    return publisher;
  }

  function priceRows(prices) {
    return prices.map(item => {
      const history = points(item);
      return {item, history, latest: history.at(-1), prior: history.at(-2), change: delta(history), frequency: frequency(item.cadence)};
    }).sort((a, b) => (b.latest?.date || '').localeCompare(a.latest?.date || '') || a.item.name.localeCompare(b.item.name));
  }

  function marketRow(row, prices) {
    const {item, history, latest, prior, change} = row;
    const tr = el('tr');
    tr.dataset.marketId = item.id;
    const name = el('td', 'b-name');
    const market = button(item.name || names[item.id] || item.id, () => openInstrument(item.id, prices), 'mk-open');
    const credit = publisherLink(item, latest);
    name.append(market, credit);
    const value = el('td', 'b-price');
    value.append(el('strong', '', latest ? quoteNumber.format(latest.value) : '—'), el('small', '', item.unit));
    const direction = change > 0 ? 'mk-up' : change < 0 ? 'mk-down' : '';
    const move = el('td', 'b-change');
    move.append(el('span', direction, change === null ? '—' : signed.format(change) + '%'));
    if (prior && change !== null) move.append(el('small', '', 'vs ' + labelDate(prior.date, item)));
    const spark = el('td', 'b-trend');
    if (history.length > 1) {
      const recent = history.slice(-20);
      spark.append(lineChart(recent));
      spark.title = 'Last ' + recent.length + ' observations · ' + labelDate(recent[0].date, item) + ' to ' + labelDate(latest.date, item);
    } else {
      spark.textContent = '—';
    }
    const stamp = el('td', 'b-time');
    stamp.append(el('span', '', latest ? labelDate(latest.date, item) : 'Unavailable'));
    const age = latest ? (Date.now() - Date.parse(latest.date)) / 86400000 : 0;
    const archiveThreshold = {Daily: 14, Weekly: 28, Monthly: 100}[row.frequency];
    const cadence = item.cadence === 'Weekday' ? 'Working days' : item.cadence;
    stamp.append(el('small', '', cadence + (age > archiveThreshold ? ' · archived' : '')));
    tr.append(name, value, move, spark, stamp);
    tr.addEventListener('click', event => {
      if (!event.target.closest('a, button')) market.click();
    });
    return tr;
  }

  function showMarkets(container, initialPrices) {
    let prices = initialPrices;
    let rows = priceRows(prices);
    let activeFrequency = 'Daily';
    let focusId;
    let chartKey;
    let choiceKey;
    let chartUpdatePending = false;
    const board = el('section', 'mk-board board-v2');
    const lead = el('div', 'board-lead');
    const focus = el('section', 'board-focus');
    const summary = el('div', 'focus-summary');
    const title = el('div', 'focus-head');
    const picker = el('select', 'focus-select');
    picker.id = 'focus-market-choice';
    const titleLabel = el('label', 'board-kicker', 'Daily market in focus');
    titleLabel.htmlFor = picker.id;
    const meta = el('div', 'focus-citation');
    const quote = el('div', 'focus-quote');
    const plot = el('div');
    picker.addEventListener('change', () => { focusId = picker.value; drawFocus(); });
    title.append(titleLabel, picker, meta);
    summary.append(title, quote);
    focus.append(summary, plot);
    const side = el('aside', 'board-oil');
    mountSettlements(side);
    lead.append(focus, side);
    const toolbar = el('section', 'board-tools');
    const tabs = el('div', 'board-tabs');
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', 'Publication frequency');
    const controls = el('div', 'board-controls');
    const search = el('input', 'mk-search');
    search.type = 'search';
    search.placeholder = 'Search benchmarks';
    search.setAttribute('aria-label', 'Search benchmarks, groups or publishers');
    const group = el('select', 'mk-select');
    group.setAttribute('aria-label', 'Market group');
    controls.append(search, group);
    toolbar.append(tabs, controls);
    const scroller = el('div', 'board-table-wrap');
    const table = el('table', 'mk-table board-table');
    const caption = el('caption', 'visually-hidden', 'Energy benchmark prices and changes since the prior published observation');
    table.append(caption);
    const header = table.createTHead().insertRow();
    for (const title of ['Benchmark / publisher', 'Price', 'Change', 'Recent history', 'Observation']) {
      const th = el('th', '', title);
      th.scope = 'col';
      header.append(th);
    }
    const tbody = table.createTBody();
    const footer = el('div', 'board-footer');
    const count = el('span');
    count.setAttribute('aria-live', 'polite');
    footer.append(count);
    scroller.append(table);
    const empty = el('div', 'board-empty');
    board.append(lead, toolbar, scroller, empty, footer);
    container.replaceChildren(board);

    function drawFocus(onRefresh = false) {
      const eligible = rows.filter(row => row.frequency === 'Daily' && row.history.length);
      if (!eligible.length) {
        focus.hidden = true;
        return;
      }
      focus.hidden = false;
      const latestAvailable = Date.parse(eligible[0].latest.date);
      const recentEU = eligible.find(row => row.item.id === 'eulng' && latestAvailable - Date.parse(row.latest.date) <= 7 * 86400000);
      const selected = eligible.find(row => row.item.id === focusId) || recentEU || eligible[0];
      const {item, history, latest, prior, change} = selected;
      focusId = item.id;
      const choices = eligible.map(row => row.item).sort((a,b) => a.name.localeCompare(b.name));
      const nextChoiceKey = JSON.stringify(choices.map(({id,name}) => [id,name]));
      if (choiceKey !== nextChoiceKey) {
        picker.replaceChildren(...choices.map(choice => new Option(choice.name,choice.id)));
        choiceKey = nextChoiceKey;
      }
      if (picker.value !== focusId) picker.value = focusId;
      const key = JSON.stringify(item);
      if (key === chartKey) return;
      const oldSurface = focus.querySelector('.mk-inspect-surface');
      const isHovering = surface => window.matchMedia('(hover: hover)').matches && surface.matches(':hover');
      if (onRefresh && oldSurface && (document.activeElement === oldSurface || isHovering(oldSurface))) {
        chartUpdatePending = true;
        return;
      }
      chartUpdatePending = false;
      const focusCredit = focus.contains(document.activeElement) && document.activeElement.tagName === 'A';
      chartKey = key;
      meta.replaceChildren(publisherLink(item, latest), el('span', '', labelDate(latest.date, item)));
      quote.replaceChildren(el('strong', '', quoteNumber.format(latest.value)), el('span', 'focus-unit', item.unit));
      if (change !== null) {
        const move = el('span', 'focus-change ' + (change < 0 ? 'falling' : change > 0 ? 'rising' : ''), signed.format(change) + '%');
        move.append(el('small', '', ' vs ' + labelDate(prior.date, item)));
        quote.append(move);
      }
      plot.replaceChildren(priceChart(history, item));
      const surface = focus.querySelector('.mk-inspect-surface');
      if (surface) {
        surface.addEventListener('pointerleave', () => {
          if (chartUpdatePending && document.activeElement !== surface) drawFocus();
        });
        surface.addEventListener('blur', () => {
          if (chartUpdatePending && !isHovering(surface)) drawFocus();
        });
      }
      if (focusCredit) meta.querySelector('a').focus({preventScroll:true});
    }

    function updateGroups() {
      const selected = group.value;
      const groups = [...new Set(rows.map(row => row.item.group).filter(Boolean))].sort();
      group.replaceChildren(new Option('All market groups', ''), ...groups.map(value => new Option(value, value)));
      if (groups.includes(selected)) group.value = selected;
    }

    const buttons = new Map();
    for (const name of frequencyOrder) {
      const tab = button('', () => {
        activeFrequency = name;
        render();
      }, 'board-tab');
      buttons.set(name, tab);
      tabs.append(tab);
    }

    function render() {
      const active = document.activeElement;
      const priorRowId = active?.closest('tr')?.dataset.marketId;
      const query = search.value.trim().toLowerCase();
      const matching = rows.filter(({item}) =>
        (!group.value || item.group === group.value) &&
        [item.name, item.id, item.group, item.source, item.unit].join(' ').toLowerCase().includes(query)
      );
      for (const [name, tab] of buttons) {
        const total = name === 'All' ? matching.length : matching.filter(row => row.frequency === name).length;
        tab.replaceChildren(document.createTextNode(name), el('small', '', String(total)));
        tab.setAttribute('aria-pressed', String(name === activeFrequency));
      }
      const filtered = activeFrequency === 'All' ? matching : matching.filter(row => row.frequency === activeFrequency);
      tbody.replaceChildren(...filtered.map(row => marketRow(row, prices)));
      if (priorRowId) {
        const row = [...tbody.rows].find(row => row.dataset.marketId === priorRowId);
        row?.querySelector(active.tagName === 'A' ? 'a' : 'button')?.focus({preventScroll:true});
      }
      empty.replaceChildren();
      empty.hidden = filtered.length > 0;
      if (!filtered.length) {
        empty.append(el('p', '', 'No matching benchmarks in this view.'));
        if (matching.length) empty.append(button('Show matches at all frequencies', () => { activeFrequency = 'All'; render(); buttons.get('All').focus(); }, 'mk-btn'));
      }
      count.textContent = filtered.length + (filtered.length === 1 ? ' benchmark' : ' benchmarks') + ' · Latest observations first';
    }

    search.addEventListener('input', render);
    group.addEventListener('change', render);
    container.refreshMarkets = updated => {
      prices = updated;
      rows = priceRows(prices);
      updateGroups();
      drawFocus(true);
      render();
    };
    updateGroups();
    drawFocus();
    render();
  }
  window.updateMarkets = (container, prices) => container.refreshMarkets ? container.refreshMarkets(prices) : showMarkets(container, prices);
  window.mountSettlements=mountSettlements;
  window.showMarkets=showMarkets;
  window.openInstrument=openInstrument;
})();
