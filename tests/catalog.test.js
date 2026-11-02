import test from 'node:test';
import assert from 'node:assert/strict';
import { selectProjects, safeProjectURL } from '../site/catalog.js';

const projects = [
  { id: 'carve', name: 'Carve Workspace', description: 'Tools for the studio', category: 'Tools', status: 'Live', tags: ['Productivity'] },
  { id: 'avalon', name: 'Avalon', description: 'A virtual game narrator', category: 'Games', status: 'Live', tags: ['Audio'] },
  { id: 'draft', name: 'A new idea', description: 'Experiment', category: 'Tools', status: 'Building', tags: [] },
];

test('combines trimmed case-insensitive search, category and favorite selection', () => {
  assert.deepEqual(selectProjects(projects, { query: '  PRODUCTIVITY ', category: 'Tools', view: 'favorites', favorites: ['carve'] }).map(p => p.id), ['carve']);
  assert.deepEqual(selectProjects(projects, { query: 'studio', category: 'Games' }), []);
});

test('live selection excludes building projects and blank search returns all', () => {
  assert.deepEqual(selectProjects(projects, { view: 'live' }).map(p => p.id), ['carve', 'avalon']);
  assert.equal(selectProjects(projects, { query: ' ' }).length, 3);
});

test('favorites accepts an empty list and unknown categories have no results', () => {
  assert.deepEqual(selectProjects(projects, { view: 'favorites', favorites: [] }), []);
  assert.deepEqual(selectProjects(projects, { category: 'Unknown' }), []);
});

test('alphabetical sorting does not mutate the catalog', () => {
  const before = JSON.stringify(projects);
  assert.deepEqual(selectProjects(projects, { sort: 'name' }).map(p => p.id), ['draft', 'avalon', 'carve']);
  assert.equal(JSON.stringify(projects), before);
});

test('allows HTTPS and portable same-site project paths', () => {
  assert.equal(safeProjectURL('https://example.com/app/'), 'https://example.com/app/');
  assert.equal(safeProjectURL('./projects/my-app/'), './projects/my-app/');
});

test('rejects executable schemes, device URLs and paths that escape the deployed site', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'file:///Users/me', '//evil.com', '/Users/me', '../private/', './projects/../private', 'https://user:pass@example.com', 'http://example.com', './projects/%2e%2e/private', './x\\evil', 'https://example.com\n', '']) {
    assert.equal(safeProjectURL(url), null, url);
  }
  assert.equal(safeProjectURL(null), null);
});
