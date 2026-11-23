/* The publisher renders both the observations and the interactive graph. */
(() => {
  'use strict';
  const origin = 'https://fred.stlouisfed.org';
  const widget = origin + '/fred-glance-widget.php?series_ids=DCOILWTICO,DCOILBRENTEU&transformations=lin,lin';
  const comparison = origin + '/graph/?id=DCOILWTICO,DCOILBRENTEU';

  function element(tag, className, label) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (label) node.textContent = label;
    return node;
  }

  function openViewer(launcher) {
    if (document.querySelector('.crude-dialog[open]')) return;
    const dialog = element('dialog', 'crude-dialog');
    dialog.setAttribute('aria-labelledby', 'crude-dialog-title');
    const body = element('div', 'crude-dialog-body');
    const header = element('div', 'crude-dialog-head');
    const heading = element('h2', '', 'WTI and Brent spot prices');
    heading.id = 'crude-dialog-title';
    const close = element('button', 'mk-btn crude-close', 'Close');
    close.type = 'button';
    close.autofocus = true;
    close.addEventListener('click', () => dialog.close());
    header.append(heading, close);

    const credit = element('p', 'crude-credit', 'U.S. Energy Information Administration via FRED · USD per barrel');
    const switcher = element('div', 'crude-switch');
    switcher.setAttribute('role', 'group');
    switcher.setAttribute('aria-label', 'Spot price view');
    const display = element('div', 'crude-display');
    const foot = element('div', 'crude-dialog-foot');
    foot.append(element('span', '', 'FRED can release several daily observations together. The publisher display requires an internet connection.'));
    const link = element('a', 'mk-link', 'Open comparison on FRED');
    link.href = comparison;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    foot.append(link);

    let selected = 'latest';
    let frame;
    let resizeTimer;
    function sizeGraph() {
      if (selected !== 'history' || !dialog.open || !frame) return;
      const width = Math.max(1, Math.floor(display.clientWidth));
      const height = Math.max(290, Math.min(420, Math.round(width * 0.60)));
      const url = new URL('/graph/graph-landing.php', origin);
      url.search = new URLSearchParams({g: 'oVhr', width: String(width), height: String(height)});
      if (frame.src === url.href) return;
      frame.height = String(height + 80);
      frame.src = url.href;
    }
    const buttons = new Map();
    function show(view) {
      selected = view;
      for (const [key, button] of buttons) button.setAttribute('aria-pressed', String(key === view));
      frame = element('iframe', view === 'latest' ? 'crude-frame crude-quotes' : 'crude-frame');
      frame.title = view === 'latest'
        ? 'Latest daily WTI and Brent observations from FRED'
        : 'Interactive FRED graph of daily WTI and Brent spot prices';
      display.replaceChildren(frame);
      if (view === 'latest') frame.src = widget;
      else sizeGraph();
    }
    for (const [key, label] of [['latest', 'Latest prices'], ['history', 'Price history']]) {
      const tab = element('button', '', label);
      tab.type = 'button';
      tab.addEventListener('click', () => { if (selected !== key) show(key); });
      buttons.set(key, tab);
      switcher.append(tab);
    }

    body.append(header, credit, switcher, display, foot);
    dialog.append(body);
    document.body.append(dialog);
    dialog.showModal();
    show('latest');
    const resize = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(sizeGraph, 180);
    });
    resize.observe(display);
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => {
      clearTimeout(resizeTimer);
      resize.disconnect();
      dialog.remove();
      if (launcher.isConnected) launcher.focus({preventScroll:true});
    }, {once:true});
  }

  window.addCrudeViewer = container => {
    if (container.querySelector('.crude-launch')) return;
    const launch = element('button', 'crude-launch', 'Compare daily spot prices');
    launch.type = 'button';
    launch.setAttribute('aria-haspopup', 'dialog');
    launch.addEventListener('click', () => openViewer(launch));
    container.append(launch);
  };
})();
