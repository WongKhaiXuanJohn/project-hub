// Replay checkpoints use NYMEX trading dates. Source reports may be retrospective.
(() => {
  'use strict';
  const frames = [
    {
      day: 17, weekday: 'Friday', may: 18.27, june: 25.03,
      title: 'May barrels are already cheaper.',
      story: 'The May futures contract settles $6.76 per barrel below June. This gap is the price of moving delivery from one contract month to the next.',
      source: 'U.S. Energy Information Administration', linkText: 'View the front-month settlement record',
      url: 'https://www.eia.gov/dnav/pet/hist/RCLC1D.htm'
    },
    {
      day: 20, weekday: 'Monday', may: -37.63, june: 20.43,
      title: 'One delivery month falls below zero.',
      story: 'The May settlement falls $55.90 in one session. June still closes above $20. The two prices represent different obligations to take delivery at Cushing, Oklahoma.',
      source: 'Commodity Futures Trading Commission', linkText: 'Read the CFTC’s review of the trading session',
      url: 'https://www.cftc.gov/PressRoom/PressReleases/8315-20'
    },
    {
      day: 21, weekday: 'Tuesday', may: 10.01, june: 11.57,
      title: 'May expires back above zero.',
      story: 'May settles at $10.01 on its final trading day. June falls $8.86 to $11.57. Following each contract through expiry reveals how differently they moved.',
      source: 'Commodity Futures Trading Commission', linkText: 'Read the CFTC staff report (PDF)',
      url: 'https://www.cftc.gov/media/5296/InterimStaffReportNYMEX_WTICrudeOil/download'
    },
    {
      day: 27, weekday: 'Monday',
      title: 'What the storage figures missed.',
      story: 'EIA explains that some physically empty storage may already have been booked. A trader facing delivery could struggle to find space even when reported tank capacity remained. The agency also points to thin trading as expiry approached.',
      source: 'U.S. Energy Information Administration', linkText: 'Read the EIA analysis published 27 April',
      url: 'https://www.eia.gov/todayinenergy/detail.php?id=43495'
    }
  ];
  const price = value => (value < 0 ? '−$' : '$') + Math.abs(value).toFixed(2);
  // Position trading dates on a calendar axis, including the weekend between 17 and 20 April.
  function dateX(frame, width) {
    return 42 + (frame.day - frames[0].day) / (frames[2].day - frames[0].day) * (width - 72);
  }
  const y = value => 18 + (30 - value) * 2.55;
  function chart(step, width) {
    const shown = frames.slice(0, Math.min(step + 1, 3));
    const grid = [20, 0, -20, -40].map(v => '<path class="mr-r-grid' + (v === 0 ? ' zero' : '') + '" d="M34 ' + y(v) + ' H' + (width - 10) + '"/><text x="26" y="' + (y(v) + 4) + '" text-anchor="end">' + (v < 0 ? '−' + -v : v) + '</text>').join('');
    const labels = shown.map((frame, index) => {
      // Consecutive sessions need more space than the weekend gap on narrow phones.
      const anchor = width < 320 && index === 1 ? 'end' : 'middle';
      return '<text x="' + dateX(frame, width) + '" y="221" text-anchor="' + anchor + '">' + frame.day + ' Apr</text>';
    }).join('');
    const curves = ['june', 'may'].map(contract => {
      const points = shown.map(f => dateX(f, width) + ',' + y(f[contract])).join(' ');
      const dots = shown.map(f => '<circle cx="' + dateX(f, width) + '" cy="' + y(f[contract]) + '" r="4"><title>' + f.day + ' Apr · ' + contract + ': ' + price(f[contract]) + '</title></circle>').join('');
      return '<g class="mr-r-' + contract + '"><polyline points="' + points + '"/>' + dots + '</g>';
    }).join('');
    const cursor = '<g class="mr-r-cursor" aria-hidden="true"><line y1="15" y2="202"/><circle class="mr-r-june" r="6"/><circle class="mr-r-may" r="6"/></g>';
    return '<svg viewBox="0 0 ' + width + ' 235" aria-hidden="true">' + grid + labels + curves + cursor + '</svg>';
  }
  let cleanup;
  window.mountReplay = function mountReplay(el) {
    if (cleanup) cleanup();
    const saved = new URL(location.href).searchParams.get('step');
    let step = /^[1-4]$/.test(saved || '') ? Number(saved) - 1 : 0;
    let timer = null;
    el.innerHTML = '<article class="mr-replay"><header class="mr-r-head"><span class="mr-r-meta">Case file / April 2020</span><h2>When oil went negative</h2><p>Follow the May and June WTI contracts through three settlements and a later investigation.</p></header><div class="mr-r-columns"><section class="mr-r-plot"><div class="mr-r-plot-title"><h3>WTI settlements</h3><small>USD / barrel</small></div><div class="mr-r-legend"><span>May 2020</span><span>June 2020</span></div><div data-graph role="slider" tabindex="0" aria-label="Inspect WTI settlements" aria-valuemin="1" aria-describedby="mr-replay-help"></div><div class="mr-r-readout"><strong data-asof></strong><span id="mr-replay-help">Hover, tap or use the arrow keys</span></div><div class="mr-r-metrics" data-values></div><div class="mr-r-sources"><span>EIA settlement history</span><a href="https://www.eia.gov/dnav/pet/hist/RCLC1D.htm" target="_blank" rel="noopener noreferrer">May contract</a><a href="https://www.eia.gov/dnav/pet/hist/RCLC2D.htm" target="_blank" rel="noopener noreferrer">June contract</a></div></section><section class="mr-r-story" aria-live="polite"><span class="mr-r-meta" data-date></span><h3 data-headline></h3><p data-story></p><div class="mr-r-evidence"><span data-source></span><a data-link target="_blank" rel="noopener noreferrer"></a></div></section></div><div class="mr-r-controls"><button type="button" data-play></button><div class="mr-r-scrub"><input type="range" min="1" max="4" step="1" aria-label="Replay checkpoint"><div class="mr-r-days"></div></div><button type="button" data-share>Copy replay link</button></div><div class="mr-r-copy" role="status"></div></article>';
    const $ = s => el.querySelector(s);
    const range = $('input[type=range]');
    const dayButtons = frames.map((frame, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = frame.day + ' Apr';
      b.addEventListener('click', () => seek(i));
      $('.mr-r-days').append(b);
      return b;
    });
    const play = $('[data-play]');
    const plot = $('[data-graph]');
    let inspected = 0;
    let plotWidth;
    function inspect(index) {
      inspected = Math.max(0, Math.min(index, step, 2));
      const close = frames[inspected];
      const x = dateX(close, plotWidth);
      const cursor = plot.querySelector('.mr-r-cursor');
      const guide = cursor.querySelector('line');
      guide.setAttribute('x1', x);
      guide.setAttribute('x2', x);
      for (const contract of ['may', 'june']) {
        const dot = cursor.querySelector('.mr-r-' + contract);
        dot.setAttribute('cx', x);
        dot.setAttribute('cy', y(close[contract]));
      }
      const date = close.day + ' April 2020';
      plot.setAttribute('aria-valuenow', inspected + 1);
      plot.setAttribute('aria-valuetext', date + ', May ' + price(close.may) + ', June ' + price(close.june) + ' per barrel');
      $('[data-asof]').textContent = date + ' · settlement';
      $('[data-values]').innerHTML = [
        ['May WTI', close.may], ['June WTI', close.june], ['May less June', close.may - close.june]
      ].map(([name, val]) => '<div><span>' + name + '</span><strong>' + price(val) + '</strong></div>').join('');
    }
    function inspectPointer(event) {
      if (event.isPrimary === false) return;
      const bounds = plot.querySelector('svg').getBoundingClientRect();
      if (!bounds.width) return;
      const x = (event.clientX - bounds.left) * plotWidth / bounds.width;
      let nearest = 0;
      for (let i = 1; i <= Math.min(step, 2); i++) {
        if (Math.abs(x - dateX(frames[i], plotWidth)) < Math.abs(x - dateX(frames[nearest], plotWidth))) nearest = i;
      }
      if (nearest !== inspected) inspect(nearest);
    }
    function pauseInspection() {
      if (!timer) return;
      stop();
      play.textContent = 'Play replay';
      play.setAttribute('aria-pressed', 'false');
    }
    plot.onpointermove = inspectPointer;
    plot.onpointerdown = event => { pauseInspection(); inspectPointer(event); };
    plot.onpointerleave = event => { if (event.pointerType === 'mouse') inspect(Math.min(step, 2)); };
    plot.onkeydown = event => {
      const last = Math.min(step, 2);
      const keys = {ArrowLeft: inspected - 1, ArrowDown: inspected - 1, ArrowRight: inspected + 1, ArrowUp: inspected + 1, Home: 0, End: last};
      if (!Object.hasOwn(keys, event.key)) return;
      event.preventDefault();
      pauseInspection();
      inspect(keys[event.key]);
    };
    function drawGraph() {
      plotWidth = Math.max(1, Math.round(plot.getBoundingClientRect().width || 525));
      plot.innerHTML = chart(step, plotWidth);
    }
    function render() {
      const f = frames[step];
      $('[data-date]').textContent = f.weekday + ' / ' + f.day + ' April 2020';
      $('[data-headline]').textContent = f.title;
      $('[data-story]').textContent = f.story;
      $('[data-source]').textContent = f.source;
      $('[data-link]').textContent = f.linkText;
      $('[data-link]').href = f.url;
      drawGraph();
      plot.setAttribute('aria-valuemax', Math.min(step, 2) + 1);
      inspect(Math.min(step, 2));
      range.value = String(step + 1);
      range.setAttribute('aria-valuetext', f.day + ' April 2020');
      dayButtons.forEach((b, i) => b.setAttribute('aria-current', i === step ? 'step' : 'false'));
      play.textContent = timer ? 'Pause' : step === 3 ? 'Play again' : 'Play replay';
      play.setAttribute('aria-pressed', String(Boolean(timer)));
      $('.mr-r-copy').replaceChildren();
    }
    function stop() {
      if (timer !== null) clearInterval(timer);
      timer = null;
    }
    function seek(i) {
      stop();
      step = i;
      render();
    }
    play.onclick = () => {
      if (timer) stop();
      else {
        if (step === 3) step = 0;
        timer = setInterval(() => {
          if (!el.isConnected || el.getClientRects().length === 0 || document.hidden) { stop(); render(); return; }
          step++;
          if (step === 3) stop();
          render();
        }, 6500);
      }
      render();
    };
    range.oninput = () => seek(Number(range.value) - 1);
    $('[data-share]').onclick = async () => {
      stop(); render();
      const url = new URL(location.href);
      url.searchParams.set('step', String(step + 1));
      try {
        await navigator.clipboard.writeText(url.href);
        $('.mr-r-copy').textContent = 'Link copied for ' + frames[step].day + ' April.';
      } catch {
        const input = document.createElement('input');
        input.type = 'text'; input.readOnly = true; input.value = url.href;
        input.setAttribute('aria-label','Shareable replay link');
        $('.mr-r-copy').append(input); input.focus(); input.select();
      }
    };
    render();
    const resize = new ResizeObserver(entries => {
      const width = Math.round(entries[0].contentRect.width);
      if (!width || width === plotWidth) return;
      drawGraph();
      inspect(inspected);
    });
    resize.observe(plot);
    cleanup = () => { stop(); resize.disconnect(); };
    return cleanup;
  };
})();
