# Project Hub Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Create a public, extensible GitHub Pages home for Khai's projects.

**Architecture:** Buildless public assets in `site/`, catalog in `site/projects.json`, pure selection and URL helpers in `site/catalog.js`. GitHub Actions validates and uploads only `site/`.

**Tech Stack:** HTML, CSS, native JavaScript, Node built-in tests, Python standard-library validation.

**Spec:** `docs/superpowers/specs/2026-11-02-project-hub-design.md`

## Global Constraints

- Public GitHub repository and GitHub Pages deployment.
- No private workspace data or runtime secrets.
- Relative asset paths support GitHub project subpaths.
- No package installation or production dependencies.

## Review Focus

- URLs using executable schemes must be rejected.
- Search, categories, and favorites must combine correctly.
- No-result filters must be recoverable.
- Stored preferences may be unavailable or malformed.
- Only deployable assets, never repository metadata, are uploaded.

## Task 1: Catalog and selection

**Files:** `site/projects.json`, `site/catalog.js`, `tests/catalog.test.js`, `package.json`.

**Interfaces:** `selectProjects(projects, {query, category, view, favorites, sort})` returns a filtered array without mutation; `safeProjectURL(value)` returns a safe URL or null.

- [ ] Write tests for combined selection, empty results, sorting, safe subpath URLs, unsafe schemes, and input immutability.
- [ ] Run tests and observe missing feature failures.
- [ ] Implement helpers and add the three public project entries.
- [ ] Run the full Node test suite.

## Task 2: Responsive site

**Files:** `site/index.html`, `site/styles.css`, `site/app.js`, `site/favicon.svg`, `site/404.html`.

**Interfaces:** Load the catalog; render cards with safe URLs. Navigation selects all, favorites, or live projects. Search/category/sort compose. Details use a native dialog. Favorites and layout preferences use guarded browser storage.

- [ ] Implement the complete workspace and mobile layout.
- [ ] Implement navigation, filters, favorites, list mode, detail and add-project guide dialogs.
- [ ] Validate syntax, serve HTTP, inspect and exercise available browser UI.

## Task 3: GitHub publication

**Files:** `.github/workflows/pages.yml`, `scripts/validate.py`, `.gitignore`, `README.md`.

- [ ] Add catalog and asset validator and test it on valid and deliberately invalid catalog inputs.
- [ ] Add the GitHub Pages workflow with validation before artifact upload.
- [ ] Document catalog additions and colocated projects.
- [ ] Verify the full site and public file inventory.
- [ ] Create the public repository and deploy if GitHub administration access is available; otherwise provide the verified folder and exact remaining step.
