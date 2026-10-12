# WikiBuild

A Hashikome experiment: read a local workspace directory through the project
interface of [Gr8r Studio](https://github.com/gr8rstudio/gr8r-studio).

For the first week or two, this is a **read-only display layer**. Use real plans,
backlogs, task records, and attachments. Learn which views help before adding
management features, one block at a time. See [PRODUCT.md](PRODUCT.md).

## Run locally

Requires Node.js 22 (see `.nvmrc`).

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`. Click
**Open workspace folder**, then choose the directory containing your `plans/`
and `backlog/` folders. For Hashikome, select the existing private `workspace/`
directory directly; do not copy it into this repository.

- In browsers with the native directory picker, WikiBuild asks for **read access**.
  Refresh rereads the directory. Automatic refresh checks every 15 seconds while
  the page is visible and you are not typing or selecting text.
- Other browsers use a directory-selection fallback. Some browsers call this an
  “upload” in their native dialog, but the application processes files locally;
  there is no upload endpoint. This is a snapshot: select the folder again to refresh.
- After a page reload, select the folder again. Contents and folder handles are
  not persisted by the app. Only the light/dark appearance preference is saved.
- **Try sample workspace** opens explicitly fictional content, separate from a
  connected folder. The original interactive upstream demo remains at `/?demo=1`.

The app never edits workspace files, commits content, or sends it to a server.
External document links open only when clicked. Images in Markdown are shown as
links rather than being fetched automatically. The inherited font stylesheet uses
Google Fonts; this request contains no workspace content. Markdown HTML is escaped.

## What appears in the UI

| Source                                   | Display                                                            |
| ---------------------------------------- | ------------------------------------------------------------------ |
| Root `README.md`                         | Workspace title                                                    |
| `plans/<name>/README.md`                 | Project overview                                                   |
| `plans/<name>/tasks/**/*.md`             | Task records, with list and read-only board views                  |
| `backlog/*.md`                           | Ideas; README and TEMPLATE are excluded as idea records            |
| `backlog/parked/*.md`                    | Parked ideas, omitted from the home project list                   |
| Backlog and plan index tables            | Status and next action when present; external product links        |
| Other Markdown                           | Searchable document library                                        |
| PDF, office files, images, ZIP, CSV, TXT | Original attachment downloads; CSV and TXT also have text previews |

Documents need no migration. Simple scalar frontmatter and opening `Status:`,
`Owner:`, `Assignee:`, `Due:`, `Priority:`, and `ID:` lines are recognized.
Frontmatter wins over opening metadata; document status wins over index status.
YAML lists, nested objects, and arbitrary frontmatter types are not interpreted.
Missing fields remain missing. Status prose is preserved; the task board groups
only recognized prefixes and puts everything else under **Unmapped**.

**Workspace map** shows project coverage, missing fields, unavailable local links,
and reading limits. The reader never follows local links outside the chosen folder.
Linked product repositories stay external; choosing a parent folder does not scan
multiple repositories as separate workspaces. Other folder layouts work as document
libraries but may not map to projects.

Hidden files/directories and dependency/build directories are skipped. Reading is
limited to 2,000 supported files, 2 MiB per text document, 32 MiB total text,
15,000 visited directory entries, and 16 nested directory levels. Limits and read
failures are reported. Attachments are loaded as bytes only when downloaded.
Their retention and backup remain the responsibility of the owning workspace.

## Experiment boundary

Available: project overview, task records, document reading, local links, original
attachments, search, refresh, dark/light appearance, and mapping coverage.

Not implemented: editing, collaboration, authentication, notifications, Git sync,
calendar/timeline mapping, office/PDF previews, or inferred completion percentages.
Task checklists remain within their documents; prose does not automatically become
an assigned or scheduled task. The upstream demo does not provide real versions of
these services.

Use the reader for a week or two. Note views you actually return to, information
you cannot find, and the next smallest useful capability. Keeping records as files
lets the interface evolve without moving your planning content into a new system.

## Development

```sh
npm test
npm run lint
npm run format:check
npm run build
npm run preview
```

- `src/workspace/model.js`: deterministic mapping and safe Markdown rendering.
- `src/workspace/directory.js`: read-only browser directory access and limits.
- `src/workspace/app.js`, `reader.css`: reader UI using upstream visual tokens.
- `src/entry.js`: reader entry; the original app is retained in `src/main.js`.
- `tests/workspace.test.js`: mapping, precedence, boundaries, rendering, and refresh.

The public app repository is [hashikome/wikibuild](https://github.com/hashikome/wikibuild).
`origin` is the Hashikome fork; `upstream` is Gr8r Studio. Work lands on `main`.
Private workspace records and browser verification artifacts are not part of the
application repository or production build. Do not add real workspace fixtures.

The [upstream README](docs/upstream.md) describes the original demo's architecture.
