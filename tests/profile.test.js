import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseProfile, readProfile, PROFILE_MAX_BYTES } from '../src/core/profile.js';

const profile = { name: 'Paul John', email: 'hello@namestarlit.com', title: 'Backend Engineer' };

test('reads the three portable fields, trims text and accepts a UTF-8 BOM', () => {
  assert.deepEqual(parseProfile('\uFEFF' + JSON.stringify({ name: ' Paul John ', email: ' hello@namestarlit.com ', title: ' Backend Engineer ' })), profile);
  assert.equal(parseProfile(JSON.stringify({ ...profile, title: '' })).title, '');
});

test('ignores identity, permission and unrelated fields instead of importing them', () => {
  const text = JSON.stringify({ ...profile, id: 'replacement', role: 'Owner', team: 'other', tasks: [] });
  assert.deepEqual(parseProfile(text.slice(0, -1) + ',"__proto__":{"polluted":true}}'), profile);
  assert.equal({}.polluted, undefined);
});

test('rejects malformed JSON, non-objects and missing or non-text fields', () => {
  for (const text of ['', '{', 'null', '[]', '42', '"name"', '{}']) assert.throws(() => parseProfile(text));
  for (const field of ['name', 'email', 'title']) {
    for (const value of [null, 5, {}, []]) assert.throws(() => parseProfile(JSON.stringify({ ...profile, [field]: value })));
  }
});

test('rejects blank names, invalid emails and oversized fields', () => {
  assert.throws(() => parseProfile(JSON.stringify({ ...profile, name: '  ' })), /name/);
  for (const email of ['', 'hello', 'hello @example.com']) assert.throws(() => parseProfile(JSON.stringify({ ...profile, email })), /email/);
  for (const [field, limit] of Object.entries({ name: 120, email: 254, title: 160 })) {
    assert.throws(() => parseProfile(JSON.stringify({ ...profile, [field]: 'x'.repeat(limit + 1) })), /characters/);
  }
});

test('reads a selected file and rejects oversized files before reading', async () => {
  assert.deepEqual(await readProfile({ size: 200, text: async () => JSON.stringify(profile) }), profile);
  await assert.rejects(readProfile({ size: PROFILE_MAX_BYTES + 1, text: () => assert.fail('Must not read oversized files') }), /64 KB/);
});

test('reports unreadable files without exposing lower-level errors', async () => {
  await assert.rejects(
    readProfile({
      size: 200,
      text: async () => {
        throw new Error('private filesystem details');
      },
    }),
    /Could not read this file/,
  );
});

test('writes only portable fields, commits on close and can save again', async () => {
  const { writeProfile, serializeProfile } = await import('../src/core/profile.js');
  let contents = JSON.stringify(profile);
  let closed = false;
  const handle = {
    requestPermission: async () => 'granted',
    getFile: async () => ({ size: contents.length, text: async () => contents }),
    createWritable: async () => {
      let pending;
      return {
        write: async text => {
          pending = text;
          assert.equal(closed, false);
        },
        close: async () => {
          contents = pending;
          closed = true;
        },
      };
    },
  };
  const updated = { ...profile, name: 'Paul Updated', email: 'updated@example.com', title: 'Engineer' };
  const saved = await writeProfile(handle, { ...updated, id: 'm6', role: 'Owner' }, contents);
  assert.equal(closed, true);
  assert.equal(contents, serializeProfile(updated));
  assert.deepEqual(JSON.parse(contents), updated);
  closed = false;
  await writeProfile(handle, profile, saved);
  assert.deepEqual(JSON.parse(contents), profile);
});

test('denied permission and external edits never open a writable stream', async () => {
  const { writeProfile } = await import('../src/core/profile.js');
  const handle = {
    requestPermission: async () => 'denied',
    createWritable: async () => assert.fail('Must not open a write stream'),
    getFile: async () => ({ size: 10, text: async () => 'agent edits' }),
  };
  await assert.rejects(writeProfile(handle, profile, 'original'), /access was denied/);
  handle.requestPermission = async () => 'granted';
  await assert.rejects(writeProfile(handle, profile, 'original'), /changed outside/);
  await assert.rejects(writeProfile(handle, { ...profile, email: '' }), /email/);
});

test('write and close failures reject and abort instead of claiming success', async () => {
  const { writeProfile } = await import('../src/core/profile.js');
  for (const failAt of ['write', 'close']) {
    let aborted = false;
    const handle = {
      createWritable: async () => ({
        write: async () => {
          if (failAt === 'write') throw new Error('Disk full');
        },
        close: async () => {
          if (failAt === 'close') throw new Error('Disk full');
        },
        abort: async () => {
          aborted = true;
        },
      }),
    };
    await assert.rejects(writeProfile(handle, profile), /Disk full/);
    assert.equal(aborted, true);
  }
});

test('removed files fail before writing', async () => {
  const { writeProfile } = await import('../src/core/profile.js');
  await assert.rejects(
    writeProfile(
      {
        getFile: async () => {
          throw new DOMException('Gone', 'NotFoundError');
        },
        createWritable: async () => assert.fail('Must not create a stream'),
      },
      profile,
      'original',
    ),
    { name: 'NotFoundError' },
  );
});
