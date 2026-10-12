# Profile file access after reload

Status: current-session saving implemented; retaining access after reload deferred.

## Available now

Load profile connects a file for the current session. Save profile writes name,
email and title to that file, or opens a save dialog if no file is connected.
It preserves the existing user ID and assignments. Failed or cancelled saves keep
pending edits; a pre-write content comparison stops an overwrite when an editor
or agent has changed the connected file. Browsers without direct access download
a clearly identified new copy instead.

See [the profile guide](../profile.md) for behavior and verification.

## Next decision

Decide how the browser should remember the selected file across reloads and regain
permission. Do not implement persistent handles as part of the current save slice.

Future acceptance should cover reopening the browser, a revoked permission,
a moved/deleted file and reconnecting a profile independently of workspace choice.
More advanced external-edit reconciliation can follow actual use; the current
behavior asks the user to copy pending edits before loading the changed file.
