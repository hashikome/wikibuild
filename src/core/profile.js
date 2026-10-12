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
  if (file.size > PROFILE_MAX_BYTES) throw new Error('Profile files must be 64 KB or smaller.');
  let text;
  try {
    text = await file.text();
  } catch {
    throw new Error('Could not read this file. Select it again and try again.');
  }
  return parseProfile(text);
}
