import MarkdownIt from 'markdown-it';

export const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false });
export const escapeHtml = value =>
  String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const clean = value =>
  value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*`]/g, '')
    .replace(/\\$/, '')
    .trim();
const label = path =>
  path
    .split('/')
    .pop()
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]/g, ' ');

// Resolve only inside the directory the user selected. No adjacent repository reads.
export function resolveLink(from, href) {
  if (/^https?:\/\//i.test(href)) return { external: href };
  if (/^(?:[a-z][a-z\d+.-]*:|\/|\\)/i.test(href)) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(href);
  } catch {
    return null;
  }
  const [withoutHash, anchor = ''] = decoded.split('#');
  const path = withoutHash.split('?')[0];
  if (!path) return { path: from, anchor };
  const parts = from.split('/').slice(0, -1);
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) return null;
      parts.pop();
    } else if (part.includes('\\') || [...part].some(char => char.charCodeAt(0) < 32)) return null;
    else parts.push(part);
  }
  return { path: parts.join('/'), anchor };
}

export function parseDocument(file) {
  const text = file.text || '';
  // Deliberately supports scalar frontmatter only; never executes YAML tags or code.
  const front = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const metadata = {};
  if (front)
    for (const line of front[1].split(/\r?\n/)) {
      const match = line.match(/^([\w-]+):\s*(.*?)\s*$/);
      if (match) metadata[match[1].toLowerCase()] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  const body = front ? text.slice(front[0].length) : text;
  const tokens = markdown.parse(body, {});
  const titleIndex = tokens.findIndex(token => token.type === 'heading_open' && token.tag === 'h1');
  const title = metadata.title || (titleIndex >= 0 ? clean(tokens[titleIndex + 1].content) : label(file.path));
  // Legacy records already use Status: / Owner:. Read only their opening block.
  const opening = body
    .split(/\r?\n##\s/)[0]
    .split(/\r?\n/)
    .slice(0, 30)
    .join('\n');
  for (const name of ['status', 'owner', 'assignee', 'due', 'priority', 'id']) {
    if (!metadata[name]) {
      const match = opening.match(new RegExp(`^(?:\\*\\*)?${name}(?:\\*\\*)?:(?:\\*\\*)?\\s*(.+)$`, 'im'));
      if (match) metadata[name] = clean(match[1]);
    }
  }
  const paragraphIndex = tokens.findIndex(
    (token, index) => token.type === 'paragraph_open' && !/^(?:Status|Owner|Updated|Executed|Targets|Parent):/i.test(tokens[index + 1]?.content || ''),
  );
  const excerpt =
    paragraphIndex >= 0
      ? clean(tokens[paragraphIndex + 1].content)
          .replace(/\s+/g, ' ')
          .slice(0, 240)
      : '';
  const checks = [...body.matchAll(/^\s*[-*+] \[([ xX])\] /gm)];
  return { ...file, title, body, metadata, excerpt, checklist: { total: checks.length, done: checks.filter(match => match[1] !== ' ').length } };
}

// Table cells are parsed as Markdown so pipes in links/code don't break index mapping.
export function indexRows(doc) {
  const tokens = markdown.parse(doc.body, {});
  const rows = [];
  let headers = [],
    cells = [],
    heading = '',
    isHeader = false;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'heading_open') heading = tokens[i + 1].content;
    if (token.type === 'thead_open') isHeader = true;
    if (token.type === 'thead_close') isHeader = false;
    if (token.type === 'tr_open') cells = [];
    if (token.type === 'inline' && ['td_open', 'th_open'].includes(tokens[i - 1]?.type)) cells.push(token);
    if (token.type === 'tr_close') {
      if (isHeader) headers = cells.map(cell => clean(cell.content).toLowerCase());
      else {
        const link = cells[0]?.children?.find(child => child.type === 'link_open');
        if (link)
          rows.push({
            href: link.attrGet('href'),
            title: clean(cells[0].content),
            heading,
            fields: Object.fromEntries(cells.map((cell, index) => [headers[index], clean(cell.content)])),
          });
      }
    }
  }
  return rows;
}

export function buildWorkspace(name, files, warnings = []) {
  const docs = files.filter(file => /\.md$/i.test(file.path) && typeof file.text === 'string').map(parseDocument);
  const documents = new Map(docs.map(doc => [doc.path, doc]));
  const projects = [];
  for (const doc of docs) {
    const plan = /^plans\/([^/]+)\/README\.md$/i.exec(doc.path);
    const idea = /^backlog\/(?:parked\/)?[^/]+\.md$/i.test(doc.path) && !/\/(?:README|TEMPLATE)\.md$/i.test(doc.path);
    if (!plan && !idea) continue;
    const prefix = plan ? `plans/${plan[1]}/` : null;
    const ownedDocs = prefix ? docs.filter(candidate => candidate.path.startsWith(prefix)) : [doc];
    projects.push({
      id: doc.path,
      title: doc.title,
      kind: plan ? 'Plan' : doc.path.startsWith('backlog/parked/') ? 'Parked idea' : 'Idea',
      source: doc.path,
      doc,
      documents: ownedDocs,
      tasks: ownedDocs.filter(candidate => /\/tasks\/.+\.md$/i.test(candidate.path)),
      status: doc.metadata.status || '',
      statusSource: doc.metadata.status ? doc.path : null,
      next: '',
      external: null,
    });
  }
  for (const path of ['backlog/README.md', 'plans/README.md']) {
    const doc = documents.get(path);
    if (!doc) continue;
    for (const row of indexRows(doc)) {
      const resolved = resolveLink(path, row.href);
      if (!resolved) continue;
      const target = resolved.path?.replace(/\/$/, '') || '';
      let project = projects.find(
        project => project.source === target || project.source === `${target}/README.md` || (project.external === resolved.external && !!resolved.external),
      );
      if (!project && resolved.external && path === 'backlog/README.md' && !/parked|connected/i.test(row.heading)) {
        project = {
          id: resolved.external,
          title: row.title,
          kind: 'Linked product',
          source: path,
          doc: null,
          documents: [],
          tasks: [],
          status: '',
          statusSource: null,
          next: '',
          external: resolved.external,
        };
        projects.push(project);
      }
      if (!project) continue;
      if (!project.status && row.fields.status) {
        project.status = row.fields.status;
        project.statusSource = path;
      }
      project.next = row.fields['next action'] || row.fields['next work'] || project.next;
    }
  }
  for (const project of projects) {
    project.missing = [
      !project.status && 'Status',
      !project.doc?.metadata.owner && !project.doc?.metadata.assignee && 'Owner',
      !project.doc?.metadata.due && 'Due date',
    ].filter(Boolean);
  }
  projects.sort((a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
  const tasks = projects.flatMap(project => project.tasks.map(task => ({ ...task, projectId: project.id, projectTitle: project.title })));
  const attachments = files.filter(file => !/\.md$/i.test(file.path));
  const unavailable = [];
  for (const doc of docs) {
    for (const token of markdown.parse(doc.body, {}))
      for (const child of token.children || []) {
        if (!['link_open', 'image'].includes(child.type)) continue;
        const href = child.attrGet(child.type === 'image' ? 'src' : 'href');
        const resolved = resolveLink(doc.path, href);
        if (resolved?.external) continue;
        const found = resolved && (files.some(file => file.path === resolved.path) || documents.has(`${resolved.path.replace(/\/$/, '')}/README.md`));
        if (!found) unavailable.push({ from: doc.path, href, reason: resolved ? 'Not in selected files' : 'Outside folder or unsupported link' });
      }
  }
  return {
    name: documents.get('README.md')?.title || name,
    folder: name,
    files,
    docs,
    documents,
    projects,
    tasks,
    attachments,
    unavailable,
    warnings,
    loadedAt: new Date(),
  };
}

export function statusGroup(status = '') {
  if (/^(?:done|completed?|accepted|closed)(?:\b|$)/i.test(status)) return 'Done';
  if (/^(?:blocked|waiting)(?:\b|$)/i.test(status)) return 'Blocked';
  if (/^(?:active|in[- ]progress|ongoing)(?:\b|$)/i.test(status)) return 'In progress';
  if (/^(?:todo|to do|planned|ready)(?:\b|$)/i.test(status)) return 'To do';
  return 'Unmapped';
}

export function renderDocument(doc, files) {
  const md = new MarkdownIt({ html: false, linkify: false });
  const headings = new Map();
  md.renderer.rules.heading_open = (tokens, index, options, env, self) => {
    const text = tokens[index + 1].content
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s/g, '-');
    const count = headings.get(text) || 0;
    headings.set(text, count + 1);
    tokens[index].attrSet('id', `doc-${text}${count ? `-${count}` : ''}`);
    return self.renderToken(tokens, index, options);
  };
  md.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const href = token.attrGet('href');
    const resolved = resolveLink(doc.path, href);
    if (resolved?.external) {
      token.attrSet('target', '_blank');
      token.attrSet('rel', 'noopener noreferrer');
    } else {
      token.attrSet('href', '#');
      token.attrSet('data-local-link', href);
      const present =
        resolved && (files.some(file => file.path === resolved.path) || files.some(file => file.path === `${resolved.path.replace(/\/$/, '')}/README.md`));
      if (!present) token.attrSet('title', 'This link is outside the selected folder or is not available.');
    }
    return self.renderToken(tokens, index, options);
  };
  // No remote images or embedded HTML: simply opening a private record makes no network request.
  md.renderer.rules.image = (tokens, index) => {
    const token = tokens[index];
    return `<button class="wr-image-link" data-local-link="${escapeHtml(token.attrGet('src'))}">Image: ${escapeHtml(token.content || 'Open attachment')}</button>`;
  };
  return md.render(doc.body);
}
