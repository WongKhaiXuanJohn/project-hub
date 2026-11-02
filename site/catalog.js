export function selectProjects(projects, { query = '', category = 'All', view = 'all', favorites = [], sort = 'featured' } = {}) {
  const term = query.trim().toLocaleLowerCase();
  const selected = projects.filter(project =>
    (category === 'All' || project.category === category) &&
    (view !== 'favorites' || favorites.includes(project.id)) &&
    (view !== 'live' || project.status === 'Live') &&
    (!term || [project.name, project.description, project.category, ...project.tags].join(' ').toLocaleLowerCase().includes(term))
  );
  if (sort === 'name') selected.sort((a, b) => a.name.localeCompare(b.name));
  return selected;
}

export function safeProjectURL(value) {
  if (typeof value !== 'string' || !value || /[\s\\]/.test(value)) return null;
  if (value.startsWith('https://')) {
    try {
      const url = new URL(value);
      return url.hostname && !url.username && !url.password ? value : null;
    } catch { return null; }
  }
  if (!value.startsWith('./')) return null;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.slice(2).split(/[/?#]/).some(part => part === '..' || part === '.') || /[\s\\%]/.test(decoded)) return null;
    return value;
  } catch { return null; }
}
