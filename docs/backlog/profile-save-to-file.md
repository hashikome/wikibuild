# Save profile changes to a file

Status: backlog — not implemented.

The first slice loads name, email and title from a local `profile.json` and retains
them in browser storage. The next requested behavior is to edit the profile in the
existing screen and have **Save profile** save those changes back to a file.

## Expected behavior

- Preserve the existing profile UI and stable user identity.
- Let the user update name, email and title and save the same portable JSON shape.
- Provide a clear file destination and accurate confirmation of an actual successful
  file write. Do not report a browser-only update as saved to disk.
- Account for permission denial, cancellation, unreadable/removed files and failed
  writes. Preserve pending edits when saving fails.
- Detect changes made by an agent or editor since loading; avoid silently overwriting
  those changes. Agree the smallest useful reconciliation behavior.
- Decide how to retain access to the selected file and provide a portable fallback
  where direct writes are unavailable. A browser download is a new copy and must be
  described as such.
- Keep the file independent of workspace selection: the same person can open several
  workspaces. Profile updates must not replace IDs or assignments.

## Acceptance

Edit profile fields, save, and independently read the selected file to confirm its
contents. Reload/import it and verify the same displayed profile. Cover denied
permissions, a failed write, an external edit and the supported fallback path.

Storage mechanism and conflict UI remain decisions for this slice. The current
importer does not retain a writable file handle or promise automatic synchronization.
