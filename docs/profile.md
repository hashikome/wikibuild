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

Loading does not modify the file or retain filesystem access. To apply later file
edits, select the file again, including when its name is unchanged. The existing
**Save profile** button saves form edits to the browser only. Email is displayed
read-only in the form and can be updated by loading a revised file. Actual account
authentication or email delivery is not part of this local profile import.

[Saving changes back to the file](backlog/profile-save-to-file.md) is backlog work.

## Implementation and verification

- `src/core/profile.js` reads and validates portable fields without depending on UI state.
- The existing profile settings add a file picker; the action updates the current
  member and preferences together through the existing mutation/save/render path.
- `npm test` covers the file contract, malformed inputs, field limits, extra identity
  fields, UTF-8 BOM handling and file-read failures.
- Browser checks cover importing, reloading, invalid input preserving the profile,
  selecting an updated file with the same name, and preserving user/task references.
