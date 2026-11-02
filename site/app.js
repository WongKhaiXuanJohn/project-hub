import { selectProjects, safeProjectURL } from './catalog.js';

const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.3"/><rect x="14" y="3" width="7" height="7" rx="1.3"/><rect x="3" y="14" width="7" height="7" rx="1.3"/><rect x="14" y="14" width="7" height="7" rx="1.3"/>',
  star: '<path d="m12 3 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3L12 17.4l-5.6 2.9 1.1-6.3L3 9.6l6.2-.9Z"/>',
  radio: '<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4m8.4 0a6 6 0 0 0 0-8.4M5 5a10 10 0 0 0 0 14m14 0a10 10 0 0 0 0-14"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',
  github: '<path d="M9 19c-4 1-4-2-6-2m12 4v-3.9a3.4 3.4 0 0 0-.9-2.7c3-.3 6.1-1.5 6.1-6.8a5.3 5.3 0 0 0-1.4-3.7 4.9 4.9 0 0 0-.1-3.6S17.6 0 15 1.7a13 13 0 0 0-6 0C6.4 0 5.3.3 5.3.3a4.9 4.9 0 0 0-.1 3.6 5.3 5.3 0 0 0-1.4 3.7c0 5.3 3.1 6.5 6.1 6.8A3.4 3.4 0 0 0 9 17v4" transform="translate(0 1)"/>',
  spark: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.7" cy="10.7" r="6.7"/><path d="m16 16 4.5 4.5"/>',
  list: '<path d="M8 5h13M8 12h13M8 19h13M3 5h.1M3 12h.1M3 19h.1"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.grid}</svg>`;
document.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });

function readPreference(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function savePreference(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
const savedFavorites = readPreference('khai-hub-favorites', []);
let favorites = Array.isArray(savedFavorites) ? savedFavorites.filter(item => typeof item === 'string') : [];
let layout = readPreference('khai-hub-layout', 'grid') === 'list' ? 'list' : 'grid';
let projects = [];
let category = 'All';
let activeView = 'all';
let toastTimer;
const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function showToast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2600);
}

function projectArt(project) {
  const visuals = {
    carve: '<span class="carve-ring"></span><span class="carve-ring second"></span><span class="preview-wordmark">carve<sup>®</sup></span><span class="preview-caption">THE EVERYDAY, SIMPLIFIED.</span>',
    ironpath: '<span class="ironpath-bars"><i></i><i></i><i></i><i></i></span><span class="ironpath-lockup"><svg viewBox="0 0 28 28"><path d="M6 8v12M3 11v6M22 8v12M25 11v6M6 14h16"/></svg><strong>Ironpath</strong></span><span class="preview-caption">BUILT ONE DAY AT A TIME.</span>',
    avalon: '<span class="avalon-orbit"></span><span class="avalon-lockup"><svg viewBox="0 0 45 45"><path d="m7 15 7 6 8.5-13L31 21l7-6-4 19H11L7 15Zm4 14h23M18 34v5m9-5v5m-12 0h15"/><path d="M22.5 1v4M2 10l3 2m35 0 3-2"/></svg><strong>AVALON</strong><small>LET THE STORY BEGIN.</small></span>',
  };
  const theme = Object.hasOwn(visuals, project.theme) ? project.theme : 'generic';
  return `<div class="project-art art-${theme}" aria-hidden="true">${visuals[theme] || `<strong>${escapeHTML(project.name.slice(0, 1))}</strong>`}</div>`;
}

function renderProject(project) {
  const url = safeProjectURL(project.url);
  const starred = favorites.includes(project.id);
  const card = document.createElement('article');
  card.className = 'project-card';
  card.innerHTML = `${projectArt(project)}
    <button class="favorite-button" aria-label="${starred ? 'Remove' : 'Add'} ${escapeHTML(project.name)} ${starred ? 'from' : 'to'} favorites" aria-pressed="${starred}">${icon('star')}</button>
    <div class="card-content"><span class="card-category">${escapeHTML(project.category)}</span><div class="card-title-row"><h3 class="card-title">${url ? `<a href="${escapeHTML(url)}"${url.startsWith('https://') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHTML(project.name)}</a>` : escapeHTML(project.name)}</h3></div><p class="card-description">${escapeHTML(project.description)}</p><div class="card-tags">${project.tags.map(tag => `<span class="card-tag">${escapeHTML(tag)}</span>`).join('')}</div><div class="card-footer"><span class="card-status"><span class="status-dot"></span>${escapeHTML(project.status)}</span><button class="details-button" aria-label="Details about ${escapeHTML(project.name)}">View project <span>↗</span></button></div></div>`;
  card.querySelector('.favorite-button').addEventListener('click', () => {
    const focusId = project.id;
    favorites = favorites.includes(project.id) ? favorites.filter(id => id !== project.id) : [...favorites, project.id];
    const persisted = savePreference('khai-hub-favorites', favorites);
    render();
    const focusTarget = $('#project-grid').querySelector(`[data-project-id="${CSS.escape(focusId)}"] .favorite-button`)
      || $('#project-grid').querySelector('.favorite-button')
      || $('#reset-filters');
    focusTarget.focus();
    showToast(persisted ? `${project.name} ${favorites.includes(project.id) ? 'saved to' : 'removed from'} favorites` : 'Favorite updated for this visit. Browser storage is unavailable.');
  });
  card.dataset.projectId = project.id;
  card.querySelector('.details-button').addEventListener('click', () => showProject(project));
  return card;
}

function showProject(project) {
  const url = safeProjectURL(project.url);
  const source = safeProjectURL(project.source);
  $('#dialog-body').innerHTML = `${projectArt(project)}<h2 id="dialog-title">${escapeHTML(project.name)}</h2><p>${escapeHTML(project.description)}</p><div class="card-tags">${project.tags.map(tag => `<span class="card-tag">${escapeHTML(tag)}</span>`).join('')}</div><div class="dialog-links">${url ? `<a class="button button-dark" href="${escapeHTML(url)}"${url.startsWith('https://') ? ' target="_blank" rel="noopener noreferrer"' : ''}>Open project <span>↗</span></a>` : ''}${source ? `<a class="button button-light" href="${escapeHTML(source)}" target="_blank" rel="noopener noreferrer">${icon('github')}Source code <span>↗</span></a>` : ''}</div>`;
  $('#project-dialog').showModal();
}

function renderCategories() {
  const categories = ['All', ...new Set(projects.map(project => project.category))];
  $('#category-filters').replaceChildren(...categories.map(name => {
    const button = document.createElement('button');
    button.className = `category-filter${name === category ? ' active' : ''}`;
    button.setAttribute('aria-pressed', String(name === category));
    button.textContent = name === 'All' ? 'All projects' : name;
    button.addEventListener('click', () => {
      category = name;
      render();
      [...$('#category-filters').children].find(item => item.textContent === (name === 'All' ? 'All projects' : name))?.focus();
    });
    return button;
  }));
}

function render() {
  const selected = selectProjects(projects, { query: $('#project-search').value, category, view: activeView, favorites, sort: $('#sort-order').value });
  $('#project-grid').replaceChildren(...selected.map(renderProject));
  $('#project-grid').classList.toggle('list-layout', layout === 'list');
  $('#all-count').textContent = projects.length;
  $('#favorite-count').textContent = projects.filter(project => favorites.includes(project.id)).length;
  $('#stat-projects').textContent = String(projects.length).padStart(2, '0');
  $('#stat-categories').textContent = String(new Set(projects.map(project => project.category)).size).padStart(2, '0');
  $('#heading-count').textContent = selected.length;
  $('#results-label').textContent = `${selected.length} ${selected.length === 1 ? 'project' : 'projects'} to explore`;
  $('#empty-state').hidden = selected.length !== 0;
  const emptyFavorites = activeView === 'favorites' && !projects.some(project => favorites.includes(project.id));
  $('#empty-title').textContent = emptyFavorites ? 'Keep your good finds close.' : 'A little too specific?';
  $('#empty-copy').textContent = emptyFavorites ? 'Tap the star on any project to save it here, on this device.' : 'Try another search or give the filters a fresh start.';
  $('#projects-title').firstChild.textContent = `${activeView === 'favorites' ? 'Your favorites' : activeView === 'live' ? 'Live projects' : 'All projects'} `;
  $('#view-description').textContent = activeView === 'favorites' ? 'Your own little shortlist. Saved on this device.' : activeView === 'live' ? 'Out in the world. Ready to explore.' : 'Different ideas. Same curiosity.';
  $('#breadcrumb-current').textContent = activeView === 'favorites' ? 'Favorites' : activeView === 'live' ? 'Live projects' : 'Overview';
  $('#featured-section').hidden = activeView !== 'all' || !projects.some(project => project.featured && safeProjectURL(project.url));
  document.querySelectorAll('[data-view]').forEach(link => {
    link.classList.toggle('active', link.dataset.view === activeView);
    if (link.dataset.view === activeView) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  $('#grid-view').classList.toggle('selected', layout === 'grid');
  $('#list-view').classList.toggle('selected', layout === 'list');
  $('#grid-view').setAttribute('aria-pressed', String(layout === 'grid'));
  $('#list-view').setAttribute('aria-pressed', String(layout === 'list'));
  renderCategories();
}

function route() {
  const routeName = location.hash.slice(1);
  if (routeName === 'about') {
    if (!$('#about-dialog').open) $('#about-dialog').showModal();
    return;
  }
  if (['all', 'favorites', 'live', ''].includes(routeName)) {
    activeView = routeName || 'all';
    category = 'All';
    $('#project-search').value = '';
    render();
  }
}

async function loadProjects() {
  $('#load-error').hidden = true;
  $('#results-label').textContent = 'Loading the collection…';
  try {
    const response = await fetch('./projects.json');
    if (!response.ok) throw new Error('Could not load project catalog');
    const catalog = await response.json();
    if (!Array.isArray(catalog) || catalog.some(project => !project || typeof project.id !== 'string' || typeof project.name !== 'string' || typeof project.description !== 'string' || typeof project.category !== 'string' || !Array.isArray(project.tags))) throw new Error('Invalid project catalog');
    projects = catalog;
    const featured = projects.find(project => project.featured && safeProjectURL(project.url));
    if (featured) {
      $('#featured-link').href = safeProjectURL(featured.url);
      if (featured.url.startsWith('https://')) { $('#featured-link').target = '_blank'; $('#featured-link').rel = 'noopener noreferrer'; }
      $('#featured-link').setAttribute('aria-label', `Explore ${featured.name}`);
      $('.featured-cta').firstChild.textContent = `Explore ${featured.name} `;
    }
    route();
    render();
  } catch {
    $('#load-error').hidden = false;
    $('#results-label').textContent = 'Collection unavailable';
    $('#empty-state').hidden = true;
  }
}

$('#project-search').addEventListener('input', render);
$('#sort-order').addEventListener('change', render);
$('#grid-view').addEventListener('click', () => { layout = 'grid'; savePreference('khai-hub-layout', layout); render(); });
$('#list-view').addEventListener('click', () => { layout = 'list'; savePreference('khai-hub-layout', layout); render(); });
$('#reset-filters').addEventListener('click', () => {
  category = 'All'; activeView = 'all'; $('#project-search').value = ''; $('#sort-order').value = 'featured';
  if (location.hash !== '#all') location.hash = 'all'; else render();
});
$('#retry-load').addEventListener('click', loadProjects);
const showGuide = () => $('#guide-dialog').showModal();
$('#add-project').addEventListener('click', showGuide);
$('#next-project').addEventListener('click', showGuide);
$('#about-link').addEventListener('click', event => { event.preventDefault(); $('#about-dialog').showModal(); });
document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
}));
document.addEventListener('keydown', event => {
  if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !document.querySelector('dialog[open]') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !document.activeElement.isContentEditable) {
    event.preventDefault(); $('#project-search').focus();
  }
});
window.addEventListener('hashchange', route);
$('#current-year').textContent = new Date().getFullYear();
await loadProjects();
