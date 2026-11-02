# Khai — Project Hub

A single public home for present and future projects. Built with HTML, CSS, and native JavaScript; no build step or production dependencies.

## Local preview

From this folder:

```sh
python3 -m http.server 8777 --directory site --bind 127.0.0.1
```

Open <http://127.0.0.1:8777/>. Use HTTP rather than opening `index.html` directly, because the site loads its catalog as JSON.

## Publish on GitHub Pages

1. Create a **public** repository named `project-hub` in `WongKhaiXuanJohn`.
2. Upload this folder's contents, including `.github/workflows/pages.yml`, to the `master` branch.
3. In repository **Settings → Pages → Build and deployment → Source**, choose **GitHub Actions**.
4. Open **Actions → Validate and deploy to GitHub Pages → Run workflow** if the initial push ran before Pages was enabled.

The intended URL is `https://wongkhaixuanjohn.github.io/project-hub/`. This is a target address, not confirmation of deployment. Subsequent pushes to `master` validate the catalog and deploy automatically. Only `site/` is published as website content; all committed source and documentation are visible in the public repository.

## Add another project

Add an entry to `site/projects.json`:

```json
{
  "id": "your-project",
  "name": "Your Project",
  "description": "A short description of what it does.",
  "category": "Tools",
  "status": "Live",
  "tags": ["Useful", "Simple"],
  "url": "./projects/your-project/",
  "source": "https://github.com/WongKhaiXuanJohn/your-project",
  "theme": "generic",
  "featured": false
}
```

For a project hosted elsewhere, use its HTTPS URL. To keep a static project within this website, add its files at `site/projects/your-project/index.html` and use relative assets. Categories are generated from the catalog, and project counts update automatically. IDs must be unique lowercase slugs. Valid status values are `Live`, `Building`, and `Archived`. Available artwork themes are `carve`, `ironpath`, `avalon`, and `generic`.

The initial spotlight is designed for Carve Workspace. If replacing that spotlight, update its headline and illustration in `site/index.html` as well as the catalog. To remove it, set all `featured` flags to `false`.

GitHub Pages serves static files. Python, Streamlit, databases, and private server APIs require separate hosting; link those applications from the hub. Never put passwords, API secrets, private records, or service credentials in this public repository.

## Features

- Search project names, descriptions, categories, and tags.
- Combine categories with all, favorites, or live views.
- Switch between grid and list layouts; sort by catalog order or name.
- Save favorites locally on this browser/device. No account or shared database.
- Open project details, live websites, and source repositories.
- Keyboard support, native dialogs, responsive layouts, and reduced-motion support.
- Optional Google Fonts typography with system-font fallbacks; project artwork is local SVG/CSS.

## Checks

Node.js 24 and Python 3.9+:

```sh
node --test
python3 -m unittest discover -s tests -p 'test_*.py'
python3 scripts/validate.py
node --check site/app.js
node --check site/catalog.js
```

The checks cover combined filtering, empty results, sorting without mutation, safe URLs, catalog schema, duplicate IDs, local project destinations, and HTML asset references. GitHub Actions runs these checks before deploying.

## Structure

```text
site/                      Public website; the only Pages artifact
  index.html               Main workspace
  styles.css               Responsive visual design
  app.js                   Rendering and interactions
  catalog.js               Project filtering and URL safety
  projects.json            Shared project catalog
  favicon.svg              Local brand mark
  404.html                 Missing-page screen
scripts/validate.py        Catalog and asset validation
tests/                     Behavioral and validation checks
.github/workflows/         GitHub Pages validation and deployment
```
