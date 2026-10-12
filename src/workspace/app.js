import '../styles/index.css';
import './reader.css';
import { ic } from '../core/icons.js';
import { buildWorkspace, escapeHtml as esc, renderDocument, resolveLink, statusGroup } from './model.js';
import { readDirectory, readFileList } from './directory.js';
import { sampleFiles } from './sample.js';

const root = document.getElementById('app');
const state = {
  workspace: null,
  handle: null,
  route: 'home',
  project: null,
  document: null,
  tab: 'overview',
  query: '',
  busy: false,
  error: '',
  sample: false,
  mobile: false,
  auto: true,
};
let generation = 0;
let documentReturn = 'home';
const labels = {
  home: 'Home',
  projects: 'Projects',
  tasks: 'Tasks',
  documents: 'Documents',
  mapping: 'Workspace map',
  project: 'Project',
  document: 'Document',
};
const navIcons = { home: 'house', projects: 'folder-kanban', tasks: 'list-checks', documents: 'files', mapping: 'map' };
const attr = value => esc(value);
const btn = (action, text, icon, extra = '', cls = 'btn btn-secondary') =>
  `<button class="${cls}" data-action="${action}" ${extra}>${icon ? ic(icon, 14) : ''}${text}</button>`;
const count = (number, singular, plural = `${singular}s`) => `${number} ${number === 1 ? singular : plural}`;
const badge = text => `<span class="wr-badge">${esc(text)}</span>`;
const source = path => `<span class="wr-source" title="${attr(path)}">${esc(path)}</span>`;
const matches = (...values) =>
  values.some(value =>
    String(value || '')
      .toLowerCase()
      .includes(state.query.toLowerCase()),
  );
const currentProject = () => state.workspace?.projects.find(project => project.id === state.project);
const date = timestamp => (timestamp ? new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Sample');
const empty = (title, text) => `<div class="wr-empty">${ic('file-search', 24)}<h2>${esc(title)}</h2><p>${esc(text)}</p></div>`;
const docButton = (path, title = 'Read source', cls = 'btn btn-secondary btn-sm') => btn('document', esc(title), 'file-text', `data-path="${attr(path)}"`, cls);

try {
  const theme = localStorage.getItem('wikibuild.theme');
  if (['light', 'dark'].includes(theme)) document.documentElement.dataset.theme = theme;
} catch {
  /* Preferences are optional. */
}

function sidebar() {
  const workspace = state.workspace;
  return `<aside class="side wr-side" aria-label="Workspace navigation"><div class="side-top"><button class="ws" data-action="navigate" data-route="home"><span class="ws-logo wr-logo">W</span><span class="ws-name">WikiBuild</span>${badge('Experiment')}</button></div>
    <div class="side-scroll"><nav>${Object.entries(navIcons)
      .map(
        ([route, icon]) =>
          `<button class="sitem ${state.route === route ? 'on' : ''}" data-action="navigate" data-route="${route}" ${state.route === route ? 'aria-current="page"' : ''}>${ic(icon, 16)}<span>${labels[route]}</span></button>`,
      )
      .join('')}</nav>
    ${
      workspace
        ? `<div class="sgroup"><div class="sgroup-h">Projects</div>${
            workspace.projects
              .filter(project => project.kind !== 'Parked idea')
              .map(
                project =>
                  `<button class="sitem ${state.route === 'project' && state.project === project.id ? 'on' : ''}" data-action="project" data-id="${attr(project.id)}" title="${attr(project.title)}"><span class="pico wr-project-icon">${ic(project.external ? 'link' : project.kind === 'Plan' ? 'folder-kanban' : 'lightbulb', 13)}</span><span class="trunc">${esc(project.title)}</span></button>`,
              )
              .join('') || '<p class="wr-side-note">No projects mapped yet.</p>'
          }</div>`
        : ''
    }</div>
    <div class="side-bot">${workspace ? `<div class="wr-connected">${ic('folder-open', 15)}<div><b>${esc(workspace.folder)}</b><span>${state.sample ? 'Fictional sample' : 'Read-only · on this device'}</span></div></div>` : ''}${btn('open', workspace ? 'Change folder' : 'Open workspace folder', 'folder-open', state.busy ? 'disabled' : '', 'sitem')}${btn('theme', 'Switch appearance', 'sun-moon', '', 'sitem')}</div></aside>`;
}

function header() {
  return `<header class="topbar wr-topbar">${btn('mobile', '<span class="sr">Toggle navigation</span>', 'menu', 'aria-label="Toggle navigation"', 'ibtn wr-menu')}<div class="crumbs"><span class="cur">${labels[state.route]}</span></div><span class="sp"></span>
    ${state.workspace ? `<form class="wr-search" id="wr-search-form" role="search">${ic('search', 14)}<input id="wr-search" name="q" type="search" aria-label="Search documents" placeholder="Search documents…" value="${attr(state.query)}"></form>${btn('refresh', '<span class="wr-refresh-label">Refresh</span>', 'refresh-cw', state.busy || state.sample ? 'disabled' : '')}` : ''}<span class="wr-readonly">${ic('eye', 13)}Read only</span></header>`;
}

function welcome() {
  return `<div class="page wr-welcome"><div class="wr-welcome-mark">${ic('folder-open', 32)}</div><h1>Your workspace, ready to read.</h1><p class="wr-lead">Point WikiBuild at your workspace directory.<br>Explore the plans, ideas, and documents you already have.</p>
    <div class="wr-welcome-actions">${btn('open', state.busy ? 'Reading folder…' : 'Open workspace folder', 'folder-open', state.busy ? 'disabled' : '', 'btn btn-primary btn-lg')}${btn('sample', 'Try sample workspace', 'arrow-right', state.busy ? 'disabled' : '', 'btn btn-secondary btn-lg')}</div>
    <p class="wr-local-note">Files are read on this device. Nothing is uploaded or edited.</p><section class="panel wr-welcome-details"><h2>A small experiment in reading your work</h2><dl><div><dt>Projects</dt><dd>Plans and backlog records become projects with links to their sources.</dd></div><div><dt>Documents</dt><dd>Read Markdown, follow local links, and download original attachments.</dd></div><div><dt>Workspace map</dt><dd>See what was found, what could be mapped, and what is still missing.</dd></div></dl></section><p class="wr-local-note">Choose the folder containing <code>plans/</code> and <code>backlog/</code>.<br>Other folders work as document libraries. Reopen the folder after reloading the app.</p></div>`;
}

function projectTable(projects) {
  if (!projects.length)
    return empty(
      'No projects found',
      'Plans under plans/<name>/README.md and backlog Markdown files appear here. All readable files remain available in Documents.',
    );
  return `<div class="wr-table-wrap"><table class="wr-table"><thead><tr><th>Project</th><th>Status from source</th><th>Tasks</th><th>Type</th></tr></thead><tbody>${projects.map(project => `<tr><td><button class="wr-title-link" data-action="project" data-id="${attr(project.id)}">${ic(project.external ? 'link' : 'folder-kanban', 16)}${esc(project.title)}</button>${source(project.source)}</td><td><span class="wr-status" title="${attr(project.status || 'Not recorded')}">${esc(project.status || 'Not recorded')}</span></td><td class="num">${project.external ? '—' : project.tasks.length}</td><td>${badge(project.kind)}</td></tr>`).join('')}</tbody></table></div>`;
}

function taskRows(tasks) {
  if (!tasks.length)
    return empty('No task records found', 'Task documents under a plan’s tasks/ directory appear here. Checklists stay inside their owning documents.');
  return `<div class="wr-task-list">${tasks.map(task => `<button class="wr-task-row" data-action="document" data-path="${attr(task.path)}">${ic(statusGroup(task.metadata.status) === 'Done' ? 'circle-check' : 'circle', 16)}<span class="wr-task-main"><b>${esc(task.title)}</b><span>${esc(task.projectTitle || task.path)}</span></span><span class="wr-task-status" title="${attr(task.metadata.status || 'No status recorded')}">${esc(task.metadata.status || 'No status recorded')}</span></button>`).join('')}</div>`;
}

function home() {
  const w = state.workspace;
  const recent = [...w.docs].sort((a, b) => b.modified - a.modified).slice(0, 6);
  return `<div class="page"><div class="ph"><div><h1>${esc(w.name)}</h1><p>Your workspace files, brought into view.</p></div><div class="acts">${btn('navigate', 'Workspace map', 'map', 'data-route="mapping"')}</div></div>
    <div class="stats wr-stats">${[
      ['projects', w.projects.filter(p => p.kind !== 'Parked idea').length, 'Projects & ideas', 'folder-kanban'],
      ['tasks', w.tasks.length, 'Task records', 'list-checks'],
      ['documents', w.docs.length, 'Markdown documents', 'file-text'],
      ['documents', w.attachments.length, 'Other files', 'paperclip'],
    ]
      .map(
        ([route, number, title, icon]) =>
          `<button class="stat" data-action="navigate" data-route="${route}"><span class="k">${ic(icon, 14)}${title}</span><span class="v">${number}</span></button>`,
      )
      .join('')}</div>
    <div class="wr-home-grid"><div class="stack"><section class="panel"><div class="panel-h"><h2>Projects</h2><span class="sp"></span>${btn('navigate', 'View all', 'arrow-up-right', 'data-route="projects"', 'btn btn-ghost btn-sm')}</div>${projectTable(w.projects.filter(project => project.kind !== 'Parked idea'))}</section><section class="panel"><div class="panel-h"><h2>Task records</h2></div>${taskRows(w.tasks.slice(0, 6))}</section></div>
    <div class="stack"><section class="panel"><div class="panel-h"><h2>Recently edited documents</h2></div><div class="wr-recent">${recent.map(doc => `<button data-action="document" data-path="${attr(doc.path)}"><span>${esc(doc.title)}</span><small>${date(doc.modified)}</small></button>`).join('') || '<p>No readable Markdown found.</p>'}</div></section><section class="panel wr-note"><h2>What the files don’t tell us yet</h2><p>${count(w.projects.filter(project => project.kind !== 'Parked idea' && project.missing.length).length, 'project')} missing one or more of status, owner, or due date.</p><p>Task records and checklists are shown as written. Project completion percentages are not inferred.</p>${btn('navigate', 'Explore the mapping', 'arrow-right', 'data-route="mapping"', 'btn btn-ghost')}</section></div></div></div>`;
}

function documentList(files) {
  if (!files.length) return empty('No matching documents', 'Try another search or open a different workspace folder.');
  return `<div class="panel wr-file-list">${files
    .map(file => {
      const doc = state.workspace.documents.get(file.path);
      return `<button class="wr-file-row" data-action="document" data-path="${attr(file.path)}">${ic(doc ? 'file-text' : 'paperclip', 17)}<span class="grow"><b>${esc(doc?.title || file.path.split('/').pop())}</b>${source(file.path)}</span><span class="faint num">${Math.max(1, Math.ceil(file.size / 1024))} KB</span>${ic('chevron-right', 14)}</button>`;
    })
    .join('')}</div>`;
}

function projectView() {
  const project = currentProject();
  if (!project) return empty('Project is no longer present', 'Refresh the workspace or choose another project.');
  const tabs = ['overview', 'tasks', 'documents', 'attachments'];
  let content;
  if (state.tab === 'overview')
    content = project.doc
      ? `<div class="wr-project-overview"><article class="wr-prose">${renderDocument(project.doc, state.workspace.files)}</article><aside class="panel wr-note wr-project-facts"><h2>From the workspace</h2><dl><dt>Type</dt><dd>${esc(project.kind)}</dd><dt>Status</dt><dd>${esc(project.status || 'Not recorded')}${project.statusSource ? source(project.statusSource) : ''}</dd><dt>Owner</dt><dd>${esc(project.doc.metadata.owner || project.doc.metadata.assignee || 'Not recorded')}</dd><dt>Due date</dt><dd>${esc(project.doc.metadata.due || 'Not recorded')}</dd></dl><p>${count(project.tasks.length, 'task record')} · ${count(project.documents.length, 'document')}</p></aside></div>`
      : `<section class="panel wr-note"><h2>This product lives in another repository</h2><p>It is linked from your workspace’s index. Its task records and product document are outside the selected folder.</p><p><b>Status in index:</b> ${esc(project.status || 'Not recorded')}</p><p>${esc(project.next)}</p><a class="btn btn-primary" href="${attr(project.external)}" target="_blank" rel="noopener noreferrer">${ic('external-link', 14)}Open owning record</a> ${docButton(project.source, 'Read workspace index')}</section>`;
  if (state.tab === 'tasks')
    content = `<div class="wr-view-tools">${btn('task-view', 'List', 'list', 'data-view="list"', `btn ${state.taskView !== 'board' ? 'btn-primary' : 'btn-secondary'} btn-sm`)}${btn('task-view', 'Board', 'columns-3', 'data-view="board"', `btn ${state.taskView === 'board' ? 'btn-primary' : 'btn-secondary'} btn-sm`)}</div>${state.taskView === 'board' ? taskBoard(project.tasks) : `<div class="panel">${taskRows(project.tasks)}</div>`}`;
  if (state.tab === 'documents') content = documentList(project.documents);
  if (state.tab === 'attachments') {
    const prefix = project.source.slice(0, project.source.lastIndexOf('/') + 1);
    content = documentList(state.workspace.attachments.filter(file => file.path.startsWith(prefix)));
  }
  return `<div class="page wide"><div class="ph"><div><h1>${esc(project.title)}</h1><p>${esc(project.kind)} · ${esc(project.source)}</p></div><div class="acts">${docButton(project.source)}</div></div><nav class="wr-tabs" aria-label="Project views">${tabs.map(tab => `<button data-action="tab" data-tab="${tab}" ${state.tab === tab ? 'aria-current="page" class="on"' : ''}>${tab[0].toUpperCase() + tab.slice(1)}</button>`).join('')}</nav>${content}</div>`;
}

function taskBoard(tasks) {
  if (!tasks.length) return taskRows(tasks);
  return `<p class="wr-explanation">Grouped only by explicit status prefixes. Unrecognized or missing statuses stay Unmapped.</p><div class="wr-board">${[
    'To do',
    'In progress',
    'Blocked',
    'Done',
    'Unmapped',
  ]
    .map(group => {
      const items = tasks.filter(task => statusGroup(task.metadata.status) === group);
      return `<section><h2>${group}<span>${items.length}</span></h2>${items.map(task => `<button class="panel wr-task-card" data-action="document" data-path="${attr(task.path)}"><b>${esc(task.title)}</b><p>${esc(task.metadata.status || 'No status recorded')}</p>${source(task.path)}</button>`).join('') || '<p class="faint">No records</p>'}</section>`;
    })
    .join('')}</div>`;
}

function mapping() {
  const w = state.workspace;
  return `<div class="page"><div class="ph"><div><h1>Workspace map</h1><p>What can be read today, and what the experiment doesn’t map yet.</p></div></div>
    <section class="panel wr-note"><h2>Reading rules</h2><dl class="wr-rules"><div><dt>Plans</dt><dd><code>plans/&lt;name&gt;/README.md</code> with task records under <code>tasks/</code>.</dd></div><div><dt>Ideas & products</dt><dd>Backlog documents and product links in the backlog index. Parked ideas stay separate.</dd></div><div><dt>Metadata</dt><dd>Simple scalar frontmatter or opening <code>Status:</code>, <code>Owner:</code>, and <code>Due:</code> lines. Index status is used when a document has none.</dd></div><div><dt>Other content</dt><dd>Other Markdown appears in Documents. Attachments are available as original downloads. Repository links open externally.</dd></div></dl></section>
    <section class="panel wr-map-section"><div class="panel-h"><h2>Project coverage</h2></div><div class="wr-table-wrap"><table class="wr-table"><thead><tr><th>Project</th><th>Mapped from</th><th>Not recorded as fields</th></tr></thead><tbody>${w.projects.map(project => `<tr><td><button class="wr-title-link" data-action="project" data-id="${attr(project.id)}">${esc(project.title)}</button></td><td>${source(project.source)}</td><td>${esc(project.missing.join(', ') || 'All basic fields present')}${project.external ? '<br><span class="faint">Product contents are external</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="3">No project records mapped. Documents remain readable.</td></tr>'}</tbody></table></div></section>
    <section class="panel wr-map-section"><div class="panel-h"><h2>Unavailable local links</h2>${badge(w.unavailable.length)}</div><p class="wr-explanation">These may be intentional references to sibling repositories, ignored evidence, or files outside this selection.</p>${
      w.unavailable.length
        ? `<div class="wr-table-wrap"><table class="wr-table"><thead><tr><th>Source document</th><th>Link</th><th>Reason</th></tr></thead><tbody>${w.unavailable
            .slice(0, 100)
            .map(
              link => `<tr><td>${docButton(link.from, link.from, 'wr-text-link')}</td><td><code>${esc(link.href)}</code></td><td>${esc(link.reason)}</td></tr>`,
            )
            .join('')}</tbody></table></div>${w.unavailable.length > 100 ? '<p class="wr-explanation">Showing the first 100 links.</p>' : ''}`
        : '<p class="wr-explanation">All parsed local links resolve within the selected files.</p>'
    }</section>
    <section class="panel wr-note wr-map-section"><h2>Deliberately outside this experiment</h2><p>Editing, assignments, notifications, comments, collaboration, Git synchronization, and calculated project progress. Calendar and timeline views need explicit dates.</p><p>No changes to your document structure are required to use the reader. During the trial, note which views you return to and which missing fields would actually help.</p></section>
    ${w.warnings.length ? `<section class="panel wr-note wr-map-section"><h2>Reading notes</h2><ul>${w.warnings.map(warning => `<li>${esc(warning)}</li>`).join('')}</ul></section>` : ''}</div>`;
}

function documentView() {
  const file = state.workspace.files.find(file => file.path === state.document);
  if (!file) return empty('Document is no longer present', 'It may have moved since the folder was last read.');
  const doc = state.workspace.documents.get(file.path);
  return `<div class="page wr-document-page"><div class="ph"><div>${btn('back', 'Back', 'arrow-left', '', 'btn btn-ghost btn-sm')}<h1>${esc(doc?.title || file.path.split('/').pop())}</h1><p class="wr-path">${esc(file.path)}</p></div><div class="acts">${btn('download', 'Download original', 'download', `data-path="${attr(file.path)}"`)}</div></div>${doc ? `<article class="wr-prose">${renderDocument(doc, state.workspace.files)}</article>` : typeof file.text === 'string' ? `<pre class="wr-text-preview">${esc(file.text)}</pre>` : empty('Original attachment', 'Download the original to open it in your usual application. This reader does not convert office documents or PDFs.')}</div>`;
}

function body() {
  if (!state.workspace) return welcome();
  if (state.route === 'home') return home();
  if (state.route === 'project') return projectView();
  if (state.route === 'document') return documentView();
  if (state.route === 'mapping') return mapping();
  if (state.route === 'projects')
    return `<div class="page wide"><div class="ph"><div><h1>Projects</h1><p>Plans, ideas, and linked products. Parked ideas are listed last.</p></div></div><div class="panel">${projectTable([...state.workspace.projects.filter(project => project.kind !== 'Parked idea'), ...state.workspace.projects.filter(project => project.kind === 'Parked idea')])}</div></div>`;
  if (state.route === 'tasks')
    return `<div class="page"><div class="ph"><div><h1>Task records</h1><p>Implementation documents from your plans’ task directories.</p></div></div><div class="panel">${taskRows(state.workspace.tasks)}</div></div>`;
  return `<div class="page"><div class="ph"><div><h1>Documents</h1><p>${state.query ? `Results for “${esc(state.query)}”` : 'Markdown and attachments from the selected directory.'}</p></div></div>${documentList(state.workspace.files.filter(file => matches(file.path, file.text, state.workspace.documents.get(file.path)?.title)))}</div>`;
}

function render() {
  const content = document.querySelector('.content');
  const scroll = content?.scrollTop || 0;
  const active = document.activeElement;
  const focusId = active?.id;
  const searchDraft = document.getElementById('wr-search')?.value;
  const selection = active?.id === 'wr-search' ? [active.selectionStart, active.selectionEnd] : null;
  const w = state.workspace;
  root.innerHTML = `<a class="skip" href="#wr-content">Skip to content</a><div class="shell wr-shell ${state.mobile ? 'wr-mobile-open' : ''}">${sidebar()}<div class="main">${header()}${w ? `<div class="wr-connection-bar"><span>${state.sample ? '<b>Sample workspace</b> · Fictional data' : `${ic('folder-open', 13)}<b>${esc(w.folder)}</b> · Read only`} · ${state.busy ? 'Reading…' : `Read at ${w.loadedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}</span>${state.handle ? `<label><input type="checkbox" id="wr-auto" ${state.auto ? 'checked' : ''}> Refresh every 15s</label>` : '<span>Reopen folder to refresh after a page reload</span>'}</div>` : ''}${state.error ? `<div class="wr-alert" role="alert">${esc(state.error)}${btn('dismiss', 'Dismiss', 'x', '', 'btn btn-ghost btn-sm')}</div>` : ''}${w?.warnings.length ? `<button class="wr-warning" data-action="navigate" data-route="mapping">${count(w.warnings.length, 'reading note')} — review the workspace map</button>` : ''}<main class="content" id="wr-content" tabindex="-1" aria-busy="${state.busy}">${body()}</main></div></div><input type="file" id="wr-folder-input" webkitdirectory multiple hidden><div id="wr-live" class="sr" role="status"></div>`;
  document.querySelector('.content').scrollTop = scroll;
  if (state.mobile)
    document
      .querySelector('.wr-shell')
      .insertAdjacentHTML('beforeend', '<button class="wr-nav-scrim" data-action="mobile" aria-label="Close navigation"></button>');
  if (searchDraft != null && focusId === 'wr-search') document.getElementById('wr-search').value = searchDraft;
  if (focusId) {
    const replacement = document.getElementById(focusId);
    replacement?.focus({ preventScroll: true });
    if (selection && replacement) replacement.setSelectionRange(...selection);
  }
  document.title = `${w ? w.name : 'Open workspace'} · WikiBuild`;
}

function navigate(route) {
  state.route = route;
  state.mobile = false;
  state.error = '';
  render();
  document.querySelector('.content').scrollTop = 0;
  document.querySelector('.content').focus({ preventScroll: true });
}

async function loadFolder(handle, fileList = null) {
  if (state.busy) return;
  const token = ++generation;
  state.busy = true;
  state.error = '';
  render();
  try {
    const result = handle ? await readDirectory(handle) : await readFileList(fileList);
    if (token !== generation) return;
    const folder = handle?.name || fileList[0]?.webkitRelativePath.split('/')[0] || 'Workspace';
    const next = buildWorkspace(folder, result.files, result.warnings);
    const same = handle && handle === state.handle;
    state.workspace = next;
    state.handle = handle;
    state.sample = false;
    if (!same) {
      state.route = 'home';
      state.query = '';
      state.document = null;
      state.project = null;
      state.tab = 'overview';
    }
  } catch (error) {
    state.error = `Could not read the folder. ${error.message || 'Try selecting it again.'}`;
  } finally {
    if (token === generation) {
      state.busy = false;
      render();
    }
  }
}

async function openFolder() {
  if (state.busy) return;
  if (!window.showDirectoryPicker) {
    document.getElementById('wr-folder-input').click();
    return;
  }
  try {
    const handle = await window.showDirectoryPicker({ id: 'wikibuild-workspace', mode: 'read' });
    await loadFolder(handle);
  } catch (error) {
    if (error.name === 'AbortError') return;
    state.error = 'The folder picker is unavailable here. Use “Choose folder another way” to read a folder snapshot.';
    render();
    document.querySelector('.wr-alert').insertAdjacentHTML('beforeend', btn('fallback', 'Choose folder another way', 'folder-open'));
  }
}

function openDocument(path) {
  if (state.route !== 'document') documentReturn = state.route;
  state.document = path;
  navigate('document');
}

async function download(path) {
  const record = state.workspace.files.find(file => file.path === path);
  if (!record) return;
  const file = await record.getFile();
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = path.split('/').pop();
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function followLocal(href) {
  const from = state.route === 'project' ? currentProject()?.source : state.document;
  const resolved = resolveLink(from || '', href);
  if (resolved?.external) {
    window.open(resolved.external, '_blank', 'noopener,noreferrer');
    return;
  }
  let file = resolved && state.workspace.files.find(file => file.path === resolved.path);
  if (!file && resolved) file = state.workspace.files.find(file => file.path === `${resolved.path.replace(/\/$/, '')}/README.md`);
  if (!file) {
    state.error = 'That document is outside the selected folder or is not present. Open its owning repository separately.';
    render();
    return;
  }
  openDocument(file.path);
  if (resolved.anchor) document.getElementById(`doc-${resolved.anchor}`)?.scrollIntoView();
}

root.addEventListener('click', async event => {
  const localLink = event.target.closest('[data-local-link]');
  if (localLink) {
    event.preventDefault();
    followLocal(localLink.dataset.localLink);
    return;
  }
  const element = event.target.closest('[data-action]');
  if (!element) return;
  const { action, route, id, path, tab, view } = element.dataset;
  try {
    if (action === 'open') await openFolder();
    if (action === 'fallback') document.getElementById('wr-folder-input').click();
    if (action === 'refresh') {
      if (state.handle) await loadFolder(state.handle);
      else await openFolder();
    }
    if (action === 'navigate') navigate(route);
    if (action === 'project') {
      state.project = id;
      state.tab = 'overview';
      navigate('project');
    }
    if (action === 'document') openDocument(path);
    if (action === 'back') navigate(documentReturn);
    if (action === 'tab') {
      state.tab = tab;
      render();
    }
    if (action === 'task-view') {
      state.taskView = view;
      render();
    }
    if (action === 'download') await download(path);
    if (action === 'mobile') {
      state.mobile = !state.mobile;
      render();
      document.querySelector(state.mobile ? '.wr-side nav button' : '.wr-menu')?.focus();
    }
    if (action === 'dismiss') {
      state.error = '';
      render();
    }
    if (action === 'sample') {
      generation++;
      state.workspace = buildWorkspace('Sample workspace', sampleFiles);
      state.handle = null;
      state.sample = true;
      state.query = '';
      navigate('home');
    }
    if (action === 'theme') {
      const dark = document.documentElement.dataset.theme
        ? document.documentElement.dataset.theme === 'dark'
        : matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.dataset.theme = dark ? 'light' : 'dark';
      try {
        localStorage.setItem('wikibuild.theme', dark ? 'light' : 'dark');
      } catch {
        /* Optional preference. */
      }
    }
  } catch (error) {
    state.error = `Could not complete that action. ${error.message}`;
    render();
  }
});
root.addEventListener('change', event => {
  if (event.target.id === 'wr-folder-input' && event.target.files.length) loadFolder(null, [...event.target.files]);
  if (event.target.id === 'wr-auto') state.auto = event.target.checked;
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && state.mobile) {
    state.mobile = false;
    render();
    document.querySelector('.wr-menu')?.focus();
  }
});
root.addEventListener('submit', event => {
  if (event.target.id !== 'wr-search-form') return;
  event.preventDefault();
  state.query = new FormData(event.target).get('q').trim();
  navigate('documents');
});
setInterval(() => {
  // Avoid replacing selected prose or interrupting keyboard use during a background read.
  if (
    state.handle &&
    state.auto &&
    !state.busy &&
    !document.hidden &&
    !window.getSelection()?.toString() &&
    !document.activeElement?.matches('input, textarea, select')
  )
    loadFolder(state.handle);
}, 15000);
render();
