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
