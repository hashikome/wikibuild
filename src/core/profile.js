// Portable profile fields only. Identity, permissions and assignments stay in the workspace.
export const PROFILE_MAX_BYTES = 64 * 1024;

export function parseProfile(text) {
  let profile;
  try {
    profile = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('This file is not valid JSON. Check profile.json and try again.');
  }
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new Error('Use a JSON object with name, email and title fields.');
  }
  const result = {};
  for (const [field, limit] of Object.entries({ name: 120, email: 254, title: 160 })) {
    if (typeof profile[field] !== 'string') throw new Error(`Profile ${field} must be text.`);
    result[field] = profile[field].trim();
    if (result[field].length > limit) throw new Error(`Profile ${field} must be ${limit} characters or fewer.`);
  }
  if (!result.name) throw new Error('Enter a name in profile.json.');
  if (!/^\S+@\S+\.\S+$/.test(result.email)) throw new Error('Enter a valid email address in profile.json.');
  return result;
}

export async function readProfile(file) {
  return (await readProfileDocument(file)).profile;
}

export async function readProfileDocument(file) {
  if (file.size > PROFILE_MAX_BYTES) throw new Error('Profile files must be 64 KB or smaller.');
  let text;
  try {
    text = await file.text();
  } catch {
    throw new Error('Could not read this file. Select it again and try again.');
  }
  return { profile: parseProfile(text), text };
}

export const PROFILE_FILE_TYPES = [{ description: 'Profile JSON', accept: { 'application/json': ['.json'] } }];

export function serializeProfile(profile) {
  return JSON.stringify(parseProfile(JSON.stringify(profile)), null, 2) + '\n';
}

// The caller holds the handle and last-read contents only for this page session.
export async function writeProfile(handle, profile, expectedText = null) {
  const text = serializeProfile(profile);
  if (handle.requestPermission && (await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
    throw new Error('File access was denied. Allow access and try Save profile again.');
  }
  if (expectedText !== null) {
    const file = await handle.getFile();
    if (file.size > PROFILE_MAX_BYTES || (await file.text()) !== expectedText) {
      throw new Error('This file changed outside the app. Copy your pending edits, then load the updated file before saving.');
    }
  }
  const writable = await handle.createWritable();
  try {
    await writable.write(text);
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => {});
    throw error;
  }
  return text;
}
