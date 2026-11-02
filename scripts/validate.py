"""Validate deployable public files with the Python standard library."""
import json
from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'


def safe_url(value):
    if not isinstance(value, str) or not value or re.search(r'[\s\\]', value):
        return False
    parsed = urlsplit(value)
    if value.startswith('https://'):
        return bool(parsed.hostname) and not parsed.username and not parsed.password
    if not value.startswith('./'):
        return False
    decoded = unquote(value)
    return not re.search(r'[\s\\%]', decoded) and not any(part in ('.', '..') for part in re.split(r'[/?#]', decoded[2:]))


def validate_catalog(projects, site):
    if not isinstance(projects, list):
        raise ValueError('Catalog must be an array')
    seen = set()
    for project in projects:
        if not isinstance(project, dict):
            raise ValueError('Each project must be an object')
        for field in ('id', 'name', 'description', 'category', 'status', 'theme'):
            if not isinstance(project.get(field), str) or not project[field].strip():
                raise ValueError('Invalid project field: ' + field)
        if not re.fullmatch(r'[a-z][a-z0-9-]*', project['id']):
            raise ValueError('Invalid project id')
        if project['id'] in seen:
            raise ValueError('Duplicate project id: ' + project['id'])
        seen.add(project['id'])
        if project['status'] not in ('Live', 'Building', 'Archived'):
            raise ValueError('Invalid project status')
        if not isinstance(project.get('featured'), bool):
            raise ValueError('featured must be boolean')
        tags = project.get('tags')
        if not isinstance(tags, list) or any(not isinstance(tag, str) or not tag.strip() for tag in tags):
            raise ValueError('Invalid project tags')
        for field in ('url', 'source'):
            value = project.get(field)
            if field == 'source' and not value:
                continue
            if not safe_url(value):
                raise ValueError('Unsafe project ' + field)
            if value.startswith('./'):
                path = site / unquote(urlsplit(value).path[2:])
                if path.is_dir():
                    path = path / 'index.html'
                if not path.is_file():
                    raise ValueError('Missing internal project file: ' + str(path.relative_to(site)))
                if site.resolve() not in path.resolve().parents:
                    raise ValueError('Internal project escapes public directory')


def resolve_asset(reference, page, site):
    ref_path = unquote(urlsplit(reference).path)
    if ref_path.startswith('/project-hub/'):
        target = site / ref_path[len('/project-hub/'):]
    else:
        target = page.parent / ref_path
    resolved = target.resolve()
    if site.resolve() not in resolved.parents and resolved != site.resolve():
        raise ValueError('HTML reference points outside public directory: ' + reference)
    return resolved


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.refs = []
        self.fragments = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            if attrs['id'] in self.ids:
                raise ValueError('Duplicate HTML id: ' + attrs['id'])
            self.ids.add(attrs['id'])
        for name in ('src', 'href'):
            value = attrs.get(name, '')
            if value and not value.startswith(('https:', 'http:', 'data:', '#')):
                self.refs.append(value)
        if tag == 'a' and attrs.get('href', '').startswith('#'):
            self.fragments.append(attrs['href'][1:])


def validate_site():
    catalog = json.loads((SITE / 'projects.json').read_text())
    validate_catalog(catalog, SITE)
    for path in SITE.rglob('*'):
        if path.is_symlink():
            raise ValueError('Public site must not contain symlinks')
        if path.name in ('.git', '.env', 'node_modules', '.DS_Store') or path.suffix in ('.sqlite', '.db', '.pem', '.key', '.pyc'):
            raise ValueError('Unexpected public artifact: ' + path.name)
    for path in SITE.rglob('*.html'):
        parser = PageParser()
        parser.feed(path.read_text())
        for ref in parser.refs:
            target = resolve_asset(ref, path, SITE)
            if target.is_dir():
                target = target / 'index.html'
            if not target.is_file():
                raise ValueError('Missing HTML asset or link: ' + ref)
        for fragment in parser.fragments:
            if fragment and fragment not in ('all', 'favorites', 'live', 'about') and fragment not in parser.ids:
                raise ValueError('Broken page fragment: ' + fragment)
    print('Validated {} public projects and {} deployable files.'.format(len(catalog), sum(path.is_file() for path in SITE.rglob('*'))))


if __name__ == '__main__':
    validate_site()
