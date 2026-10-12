import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkspace, parseDocument, resolveLink, renderDocument, statusGroup } from '../src/workspace/model.js';
import { acceptedPath, readEntries, readDirectory, MAX_TEXT_BYTES } from '../src/workspace/directory.js';

const file = (path, text) => ({ path, text, size: text.length, modified: 0 });
const fixture = [
  file('README.md', '# Example workspace'),
  file('plans/launch/README.md', '# Launch\n\nA real plan.\n\n[Task](tasks/check.md)'),
  file('plans/launch/tasks/check.md', '---\nstatus: in-progress\nowner: "Alex"\nid: EX-1\n---\n# Check the release\n\n- [x] Prepare\n- [ ] Verify'),
  file(
    'backlog/README.md',
    '# Backlog\n\n## Candidates\n\n| Idea | Status | Next action |\n| --- | --- | --- |\n| [An idea](idea.md) | Idea | Discuss |\n| [Product](https://example.com/product.md) | Active | Read source |\n\n## Plans\n\n| Plan | Status |\n| --- | --- |\n| [Launch](../plans/launch/README.md) | Active |',
  ),
  file('backlog/idea.md', '# An idea\n\nAn idea with no metadata.'),
  file('backlog/parked/later.md', '# Later\n\nStatus: parked'),
  file('backlog/TEMPLATE.md', '# Template'),
  file('brand/README.md', '# Brand\n\n[Outside](../../../private.md)\n[Missing](missing.md)'),
];

test('maps plans, ideas, parked records, tasks and external products without duplicating index rows', () => {
  const w = buildWorkspace('folder', fixture);
  assert.equal(w.name, 'Example workspace');
  assert.equal(w.projects.length, 4);
  assert.equal(w.tasks.length, 1);
  const plan = w.projects.find(p => p.kind === 'Plan');
  assert.equal(plan.status, 'Active');
  assert.equal(plan.statusSource, 'backlog/README.md');
  assert.equal(plan.tasks[0].metadata.owner, 'Alex');
  assert.deepEqual(plan.tasks[0].checklist, { total: 2, done: 1 });
  assert.deepEqual(plan.missing, ['Owner', 'Due date']);
  assert.equal(w.projects.find(p => p.kind === 'Linked product').external, 'https://example.com/product.md');
  assert.equal(w.unavailable.length, 2);
  assert.equal(w.docs.length, fixture.length);
});

test('reads legacy status and owner from opening metadata, not later historical prose', () => {
  const doc = parseDocument(file('task.md', '# A task\n\n**Status:** active; acceptance pending.\\\nOwner: infra\n\n## History\nStatus: done'));
  assert.equal(doc.metadata.status, 'active; acceptance pending.');
  assert.equal(doc.metadata.owner, 'infra');
  assert.equal(statusGroup(doc.metadata.status), 'In progress');
  assert.equal(statusGroup('transfer verified; rollout remains separate'), 'Unmapped');
  assert.equal(statusGroup(''), 'Unmapped');
});

test('frontmatter status takes precedence over legacy metadata and index status', () => {
  const w = buildWorkspace('folder', [
    ...fixture.filter(f => f.path !== 'plans/launch/README.md'),
    file('plans/launch/README.md', '---\nstatus: blocked\n---\n# Launch\n\nStatus: active'),
  ]);
  const plan = w.projects.find(p => p.kind === 'Plan');
  assert.equal(plan.status, 'blocked');
  assert.equal(plan.statusSource, 'plans/launch/README.md');
});

test('folder-local navigation resolves relative files and refuses traversal and unsafe schemes', () => {
  assert.deepEqual(resolveLink('plans/launch/README.md', 'tasks/check.md#acceptance'), { path: 'plans/launch/tasks/check.md', anchor: 'acceptance' });
  assert.deepEqual(resolveLink('plans/launch/README.md', '../../README.md'), { path: 'README.md', anchor: '' });
  assert.equal(resolveLink('README.md', '../outside.md'), null);
  assert.equal(resolveLink('README.md', '%2e%2e/outside.md'), null);
  assert.equal(resolveLink('README.md', 'file:///etc/passwd'), null);
  assert.equal(resolveLink('README.md', 'javascript:alert(1)'), null);
  assert.equal(resolveLink('README.md', 'https://example.com').external, 'https://example.com');
});

test('renders tables and links without executing HTML or loading remote images', () => {
  const doc = parseDocument(
    file(
      'README.md',
      '# Intro\n\n<script>alert(1)</script>\n\n![Private image](https://example.com/tracker.png)\n\n[Local](plans/launch/README.md)\n\n[External](https://example.com)\n\n| Key | Value |\n| --- | --- |\n| A | B |',
    ),
  );
  const html = renderDocument(doc, fixture);
  assert.match(html, /<table>/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script|<img/);
  assert.match(html, /data-local-link="plans\/launch\/README.md"/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test('ordinary document folders remain readable when no projects can be mapped', () => {
  const w = buildWorkspace('notes', [file('notes.md', '# Notes\n\nRead this.')]);
  assert.equal(w.projects.length, 0);
  assert.equal(w.docs.length, 1);
  assert.equal(w.tasks.length, 0);
});

test('skips hidden paths, repository internals, code and dependency trees', () => {
  for (const path of ['.git/config', '.env', '.private/secret.md', 'node_modules/pkg/README.md', 'src/code.js', '../outside.md'])
    assert.equal(acceptedPath(path), false, path);
  for (const path of ['README.md', 'plans/launch/README.md', 'inbox/brief.pdf', 'outbox/report.docx']) assert.equal(acceptedPath(path), true, path);
});

test('retains attachments without reading their bytes; reports oversized or unavailable text', async () => {
  let binaryRead = false;
  const { files, warnings } = await readEntries([
    { path: 'README.md', getFile: async () => ({ size: 8, lastModified: 0, text: async () => '# Folder' }) },
    {
      path: 'inbox/brief.pdf',
      getFile: async () => ({
        size: 100,
        lastModified: 0,
        text: async () => {
          binaryRead = true;
        },
      }),
    },
    {
      path: 'large.md',
      getFile: async () => ({
        size: MAX_TEXT_BYTES + 1,
        text: async () => {
          throw Error('Should not read');
        },
      }),
    },
    {
      path: 'missing.md',
      getFile: async () => {
        throw Error('Missing');
      },
    },
  ]);
  assert.equal(files.length, 3);
  assert.equal(warnings.length, 2);
  assert.equal(binaryRead, false);
  assert.equal(files.find(f => f.path === 'README.md').text, '# Folder');
});

test('refresh reads current contents through the same directory handle', async () => {
  let content = '# First';
  const handle = {
    async *entries() {
      yield ['README.md', { kind: 'file', getFile: async () => ({ size: content.length, lastModified: 1, text: async () => content }) }];
    },
  };
  assert.equal((await readDirectory(handle)).files[0].text, '# First');
  content = '# Changed';
  assert.equal((await readDirectory(handle)).files[0].text, '# Changed');
});
