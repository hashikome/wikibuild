# Local profile

Create a `profile.json` anywhere convenient, using [the example](../examples/profile.json):

```json
{
  "name": "Alex Morgan",
  "email": "alex@example.com",
  "title": "Backend Engineer"
}
```

Open **Settings → Personal → Profile → Load profile** and select the file.
The app reads it locally and updates the current member's name, email and title,
plus the name/title preferences used by the greeting and profile form. It keeps
the existing user ID, current-user selection, role, team, assignments and other
workspace data. Extra JSON fields are ignored; they cannot change permissions or IDs.

All three fields must be strings. Name and email must be nonempty, email must have
an address-shaped value, and title may be empty. Surrounding whitespace is trimmed.
Limits are 120 characters for name, 254 for email, 160 for title and 64 KB for the
file. Invalid or unreadable files leave the current profile unchanged and show an
error on the profile screen. Cancelling the picker makes no changes.

The profile is remembered in this browser and origin's existing `gr8r.v2`
localStorage entry. Reloading uses those saved values; clearing the app's storage
restores the seed defaults. Separate browsers or localhost ports have separate
storage. If browser storage is blocked or full, the app's existing persistence
behavior keeps edits only in memory.

## Save edits to a file

Edit name, email or title, then choose **Save profile**. In browsers supporting
file access, loading retains access to the selected file for the current page
session. Saving writes the three portable fields back to that file. If no file is
connected, Save opens a dialog suggesting `profile.json`. The hint beneath Email
shows the connected filename or explains that Save will ask for a destination.
The browser may ask for write permission.

The saved JSON contains only `name`, `email` and `title`, formatted with two-space
indentation and a final newline. Extra imported fields are omitted on save. Avatar
color remains a browser preference and is not part of this file contract. Account
authentication and email delivery are not part of this feature.

Success is reported only after the write stream closes. The current member and
browser copy then receive the saved fields. Cancellation leaves the file and
current profile unchanged. Validation errors, denied permissions, missing files
and failed writes keep the pending form edits available for correction or retry.

Before overwriting a connected file, the app compares its current contents with
what it last loaded or saved. If an editor or agent changed it, saving stops with
an inline message. Copy any pending edits before loading the updated file and
reapplying them. This is a pre-write conflict check, not a filesystem lock against
simultaneous external writers.

Browsers without direct file access keep the existing file input for loading.
Save starts a download of a new `profile.json` copy and updates the browser copy;
it does not overwrite the original file or claim that the download finished.

**Reloading forgets file access.** The browser-saved profile values remain, but you
must load the file again to reconnect it, or choose a destination on the next Save.
Remembering access across reloads is intentionally deferred in
[the profile backlog](backlog/profile-save-to-file.md).

The implementation uses the browser's
[File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)
where available, with the existing input and download fallback elsewhere.

## Implementation and verification

- `src/core/profile.js` validates, serializes and writes the portable file contract.
- File handles and last-read contents live only in the action module's memory;
  they are not saved to localStorage or IndexedDB.
- `npm test` covers parsing, permissions, external edits, repeated saves, removed
  files, and failures during writing or closing the stream.
- Browser checks exercise load/edit/save against a real browser file handle with
  picker selection supplied by the test, then independently read its contents.
  Cancellation, permission denial, conflicts, failed writes, reload behavior and
  the download fallback are checked separately. Native OS picker and permission
  dialogs still need a manual check in the user's browser.
