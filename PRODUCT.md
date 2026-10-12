# WikiBuild — Product Requirements Document

Status: approved product direction; native implementation pending.
Updated: 13 October 2026.

This document defines WikiBuild's product requirements, scope and acceptance
criteria. Implementation designs specify how these requirements are delivered.
The [README](README.md) documents the currently runnable application.

## 1. Product definition

WikiBuild is a local project management application for individuals working with
coding agents. It provides a desktop interface and a command-line interface for
managing the same work through a shared application core.

A workspace is a local collection of projects, tasks and document references.
Opening, editing and saving a workspace must work offline, without a hosted
account, email verification, a database server or an agent subscription.

The product name is **WikiBuild**. The repository and executable use `wikibuild`.

## 2. Problem

Project work spans repositories, planning documents, task lists and agent sessions.
Files provide accessible context, but they do not provide a consistent interface
for prioritizing work, tracking progress or coordinating concurrent changes.
Browser-only task storage adds a second problem: work depends on a particular
browser's state and is difficult to share reliably with local tools.

WikiBuild provides durable local records, a usable project management interface
and controlled agent access. The desktop and CLI operate on one authoritative
workspace without maintaining separate copies of task state.

## 3. Target users and goals

The primary user is an individual developer or maker managing multiple projects
and repositories. Coding agents are supporting clients that read and update work
through the CLI. An agent is optional; all core workflows must remain usable
without one.

The product must enable users to:

- Open a workspace and resume saved work.
- Capture projects and tasks, organize them and track progress.
- Delegate updates to agents through predictable commands.
- Review external changes without losing unsaved edits.
- Locate, export and recover their work independently of browser storage.

Initial platform support targets the Linux desktop and terminal.

## 4. Scope

### Core product scope

- Local workspace creation, selection and reopening.
- One personal identity across separate workspaces.
- Project and task management through desktop and CLI interfaces.
- Durable storage, revision checks and relevant change history.
- References to ordinary documents and local repositories.
- Portable data export and verified backup/restore before primary-data adoption.

### Out of scope for the initial product

Multi-user collaboration, invitations, permission roles, billing, subscriptions,
cloud synchronization, remote hosting, mobile clients, autonomous agent
orchestration, real-time document coediting, plugins and MCP integration.

Existing prototype screens do not expand this scope. Additional views and task
features must support a demonstrated workflow before being added to a milestone.

## 5. Functional requirements

### FR-1. Workspace lifecycle

The application must create a workspace at a selected location and reopen an
existing workspace with its identity and records intact. A new workspace must
start without sample people or work; demonstration data requires explicit selection.

Switching workspaces must load separate records and restore workspace-specific
view state while retaining the personal profile and application preferences.
Workspace identity must not depend on its display name.

Opening a directory must not automatically import, overwrite or reorganize its
contents. Missing or inaccessible workspaces must produce an actionable error.

### FR-2. Personal profile and preferences

A personal profile must contain a stable identity and a display name. Email and
title are optional. The greeting must read the profile's display name. Profile
changes must preserve identity and task references without requiring authentication.

Profile import and export must remain available. Existing JSON profiles containing
`name`, `email` and `title` must remain importable. Importing display fields must
not replace system-managed identity or existing relationships.

Appearance, density and recent-workspace settings must be stored separately from
profile and workspace records. Name and title must not have competing authoritative
copies in preferences.

### FR-3. Projects and tasks

The application must support creating, reading and updating projects and tasks.
A task must have a stable ID, project reference, title, status and revision.
Renaming or reordering a record must not change its identity or break references.

Desktop views must display the same records returned by the CLI. A successful
save must indicate that the change has been committed to durable storage.
Unsupported prototype actions must not report successful delivery or persistence.

### FR-4. Command-line access

The `wikibuild` CLI must operate independently of the desktop application's
lifecycle. Workspace selection must be explicit or unambiguously resolved; it
must not silently follow the desktop's most recently opened workspace.

Commands must support machine-readable results and documented exit codes.
Validation failures, missing records, stale revisions and storage failures must
be distinguishable. Failed commands must not report success or discard previously
committed data. Exact command syntax belongs in the CLI contract.

### FR-5. Concurrent editing

Desktop and CLI mutations must use the same validation and persistence operations.
Updates to existing records must check the revision on which the edit is based.
If that revision is stale, the operation must reject the update without overwriting
the newer state.

The desktop must preserve the pending edit and offer a way to inspect the latest
record before retrying. The CLI must return enough conflict information for a
caller to reread and deliberately resubmit. Automatic conflict merging is not
required for the initial release.

Committed CLI changes must become visible in the desktop through a documented
refresh mechanism. Refresh must preserve unsaved edits or expose a conflict;
it must not silently replace them.

### FR-6. Documents and existing repositories

Documents and attachments remain ordinary files. Workspace records may reference
existing briefs, plans and repository documents without copying their authority
into the database. Task updates must not implicitly rewrite linked documents,
and external document edits must not implicitly change task status.

Migrating existing task records into WikiBuild requires explicit selection and a
clear transfer of ownership. An import must not leave two independently maintained
masters. The application must not automatically commit workspace data, personal
profiles, linked files or exports to Git.

### FR-7. History and portability

A mutation and its relevant change-history entry must commit in one transaction.
History must identify the operation and available actor/source information.
Local actor labels are attribution, not authenticated identities or tamper-proof
security evidence.

Exports must be explicit, versioned snapshots. Backup and restore must preserve a
consistent workspace and be verified before WikiBuild becomes the sole home of
valuable work. Exports must not become a second automatically synchronized master.

## 6. Data architecture

| Data                                                                      | Authority                                                                             |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Personal profile                                                          | Portable local profile, independent of workspace selection                            |
| Application preferences                                                   | Local application settings                                                            |
| Workspace identity, projects, tasks, relationships, revisions and history | Local SQLite database                                                                 |
| Documents and attachments                                                 | Ordinary files in their designated locations                                          |
| Unsaved edits and transient UI state                                      | Application memory or recoverable draft storage, visibly distinct from committed data |
| View caches and exports                                                   | Derived representations; never competing authoritative records                        |

IDs must remain stable across display-name changes. References must be scoped to
the correct workspace. Agents must modify structured records through supported
operations rather than direct database edits.

Schemas and portable formats must be versioned. Invalid imports and failed
migrations must preserve existing committed work. Unsupported versions must fail
with an explanation rather than being silently downgraded or overwritten.

## 7. Technical constraints

- **Rust:** shared application core and CLI.
- **SQLite:** durable local structured storage.
- **Tauri:** desktop integration with the Rust core.
- **JavaScript, HTML and CSS:** retain the existing frontend and connect its
  interactions incrementally to core operations.

The Rust core owns domain rules, revision checks, transactions and structured
errors. CLI and Tauri commands are adapters to that core. Desktop actions must
call core operations directly rather than invoking a shell command.

Independent processes must coordinate through database transactions and revision
checks. Database contention must have bounded handling and a clear failure result.
Retries must not silently apply an outdated edit to a newer revision.

Normal operation must require no remote service or public network listener. File
operations must respect operating-system permissions and deliberate workspace/file
selection. Credentials and password-manager integrations are outside task storage.

The initial implementation must use small, comprehensible modules. A background
service or subscription mechanism is required only if a selected workflow needs it.

## 8. First milestone: durable task management

Deliver one complete workflow through the Rust core, SQLite, CLI and Tauri desktop:

1. Create and reopen a disposable workspace.
2. Create a project and task through the CLI and read their structured results.
3. Open the same workspace in the desktop and display the task in one existing view.
4. Edit the task through either interface and observe the committed result in the other.
5. Detect overlapping edits without silently overwriting committed or pending work.
6. Close both interfaces and reopen the workspace with the saved records intact.

### Acceptance criteria

- The workflow succeeds without internet access, account registration or an agent.
- The CLI works with the desktop closed.
- Both interfaces enforce equivalent validation and persist to the same workspace.
- A second workspace retains independent records and view state.
- Renaming a task preserves its ID and references.
- Stale revisions are rejected across independent desktop and CLI processes.
- Invalid input and failed saves leave committed data intact and return clear errors.
- Refresh exposes CLI changes without discarding an unsaved desktop edit.
- Clearing browser storage does not remove committed workspace records.
- Reopening both interfaces reproduces the last committed state.

This milestone establishes the application foundation. Production-data migration,
complete project-management coverage and cross-platform distribution are separate
release gates. Export and restore acceptance are required before primary-data adoption.

## 9. Success criteria

WikiBuild succeeds when daily project work can be managed through the desktop and
updated by agents through the CLI without editing seed code, reconciling duplicate
task lists or depending on browser storage for durability.

Release evidence must demonstrate workspace isolation, persistence, equivalent
validation, conflict handling and the complete desktop/CLI workflow. Implementation,
local verification, source publication and user acceptance must be recorded separately.

## 10. Design decisions required before implementation

Implementation designs must specify:

- Workspace layout, discovery rules and personal-profile storage.
- CLI syntax, result/error schemas and exit codes.
- Task statuses and deletion/recovery behavior.
- Desktop refresh and draft-preservation behavior.
- SQLite migrations, contention handling and backup/restore mechanics.
- Document references, attachment ownership and Git exclusions.

These decisions must satisfy this PRD without expanding initial scope.

## 11. Implementation baseline

The current application is a Vite/plain-JavaScript prototype with browser-local
workspace data and profile JSON load/save, including external-change detection.
Authentication, workspace separation and attachment uploads remain simulated.

The Rust core, Tauri shell, SQLite workspace and CLI are not implemented. The first
milestone must preserve existing frontend interactions and profile-file compatibility
while replacing persistence for the selected workflow.
