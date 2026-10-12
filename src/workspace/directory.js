const EXTENSIONS = /\.(md|txt|csv|pdf|docx?|xlsx?|pptx?|png|jpe?g|gif|webp|svg|zip)$/i;
const IGNORED = new Set(['node_modules', 'dist', 'build', 'vendor', '__pycache__']);
export const MAX_FILES = 2000;
export const MAX_TEXT_BYTES = 2 * 1024 * 1024;
export const MAX_TOTAL_TEXT_BYTES = 32 * 1024 * 1024;
export const acceptedPath = path => path.split('/').every(part => part && !part.startsWith('.') && !IGNORED.has(part)) && EXTENSIONS.test(path);

export async function readEntries(entries) {
  const files = [],
    warnings = [];
  let textBytes = 0;
  for await (const entry of entries) {
    if (!acceptedPath(entry.path)) continue;
    if (files.length >= MAX_FILES) {
      warnings.push(`Stopped at ${MAX_FILES} supported files. Select a smaller folder to see the rest.`);
      break;
    }
    try {
      const file = await entry.getFile();
      const record = { path: entry.path, size: file.size, modified: file.lastModified, getFile: entry.getFile };
      if (/\.(md|txt|csv)$/i.test(entry.path)) {
        if (file.size > MAX_TEXT_BYTES || textBytes + file.size > MAX_TOTAL_TEXT_BYTES)
          warnings.push(`Text preview skipped for ${entry.path}: reading limit reached.`);
        else {
          record.text = await file.text();
          textBytes += file.size;
        }
      }
      files.push(record);
    } catch {
      warnings.push(`Could not read ${entry.path}. It may have moved or its permission may have changed.`);
    }
  }
  return { files: files.sort((a, b) => a.path.localeCompare(b.path)), warnings };
}

export async function readDirectory(handle) {
  let visited = 0;
  async function* walk(directory, prefix = '', depth = 0) {
    if (depth > 16) throw new Error('This folder is too deeply nested. Choose a workspace subfolder.');
    for await (const [name, child] of directory.entries()) {
      if (++visited > 15000)
        throw new Error('This folder contains too many entries. Choose the workspace directory, rather than a parent containing code repositories.');
      if (name.startsWith('.') || IGNORED.has(name)) continue;
      const path = prefix + name;
      if (child.kind === 'directory') yield* walk(child, `${path}/`, depth + 1);
      else yield { path, getFile: () => child.getFile() };
    }
  }
  return readEntries(walk(handle));
}

export function readFileList(list) {
  return readEntries([...list].map(file => ({ path: file.webkitRelativePath.split('/').slice(1).join('/'), getFile: async () => file })));
}
