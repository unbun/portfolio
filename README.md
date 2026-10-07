# Unnas Hussain — Portfolio

Personal site with three pages:

- **Home**: hero, About and Currently blurbs, Toolbox, Patents/Awards/Recognition, contact, and resume download.
- **Experience**: timeline. All cards show on load; a TurtleBot drives a random right-angle path as you scroll, docks at each entry, and feeds a `/career/status` HUD. The goal marker glows when it arrives.
- **Projects**: info-graphic cards (line-art figure per project) that fade in and out with scroll, a summary strip with a top-technologies chart (hover for details, click to filter), and category filters.

No dependencies and no build step. It's plain HTML, CSS and JS, served by a small Node server.

## Run locally

Requires Node 18+.

```bash
cd portfolio
npm start          # http://localhost:3000
npm run dev        # same, but restarts the server when server.js changes
PORT=8080 npm start
```

Files in `public/` are read fresh on every request, so after editing content just refresh the browser.

## Editing content

| What | Where |
| --- | --- |
| Home: name, subtitle, About, Currently, Toolbox, recognition, contact links | `public/index.html` |
| Experience timeline | `public/data/experience.json` |
| Projects cards | `public/data/projects.json` |
| Resume and papers (served as downloads at `/resources/...`) | `resources/` |
| Colors, fonts, spacing | tokens at the top of `public/css/styles.css` |

Each timeline entry supports these fields (all optional except `title`):

```json
{
  "period": "2023 — Present",
  "title": "Role or project name",
  "org": "Company / team / course",
  "location": "Boston, MA",
  "summary": "One or two sentences.",
  "bullets": ["Highlight one", "Highlight two"],
  "tags": ["ROS 2", "Python"],
  "links": [{ "label": "GitHub", "url": "https://github.com/..." }]
}
```

Projects also take `"kind"` (which figure to draw: `platform`, `arm`, `vision`, `mobile`, `swerve`, `profile`, `medical`, `signal`, `hex`, `rink`, `fs`, `ml`, `ros`, `teaching`) and `"categories"` (a list, used for the filter buttons; the first two show on the card). A link with `"download": true` downloads instead of opening a new tab.

Wrap any unknown text in square brackets, like `"[Role title]"`, and it renders as a muted, underlined placeholder so gaps are easy to find. Add `"draft": true` to hide an entry from the site without deleting it. Experience entries alternate left and right in file order.

## Layout

```
server.js            zero-dependency static server with clean URLs (/, /experience, /projects) and /resources downloads
resources/           resume and papers
public/
  index.html         home
  experience.html    timeline page (loads data/experience.json)
  projects.html      card grid (loads data/projects.json)
  404.html
  css/styles.css
  js/main.js         shared header behavior
  js/hero.js         home hero: interactive "lidar" dot grid and typed prompt
  js/timeline.js     experience timeline, path planning, TurtleBot and HUD
  js/projects.js     project cards, figures, summary chart and filters
  data/*.json        content
```

Respects `prefers-reduced-motion` (everything is shown, nothing animates) and `prefers-color-scheme` (automatic dark mode).
