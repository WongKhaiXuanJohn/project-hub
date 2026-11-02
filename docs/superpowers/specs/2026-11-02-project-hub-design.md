# Project Hub

Build a public central home for Khai's present and future projects, in its own `project-hub` folder under Vibe Coding. The user specifies a public GitHub repository and GitHub deployment.

## Approach

Use static HTML, CSS, and native JavaScript, published with GitHub Pages. A full framework adds installation and maintenance without helping this directory. A server database is unnecessary for the public project catalog. These are implementation choices; no platform migration of existing projects is implied.

## Experience

A restrained cream, forest-green, and orange workspace. Desktop sidebar, mobile navigation, a large introductory heading, featured project, searchable and filterable project cards, favorites stored on the visitor's device, and grid/list layouts. Project details open in an accessible dialog. A guide explains how new projects join the hub.

Seed only three confirmed public repositories: Avalon, Ironpath, and Carve Workspace. Do not copy private projects, personal fitness records, credentials, local absolute paths, or other workspace content into the public site.

## Structure

`site/` contains deployable assets only. `site/projects.json` is the shared catalog. Static projects can be added at `site/projects/<slug>/` and linked using relative URLs. Independently hosted applications remain links. GitHub Pages cannot execute Python or other server code; such applications need their own hosting.

## Behavior and checks

Search combines with category, favorites, and live status filters. Zero results provide reset. Project counts derive from catalog entries. Browser storage failures leave the public directory working. Validate catalog URLs and schema before deployment; reject scripts, absolute device paths, duplicate IDs, and broken internal links. Validate HTML references and JavaScript syntax, test filtering/URL handling, and inspect the served page where browser access is available.

## Publication

Publish only the `site/` folder through GitHub Pages. Create a public repository if account capabilities allow; report any account-access blocker truthfully. GitHub is the requested deployment platform, so do not register a separate Sites deployment.
