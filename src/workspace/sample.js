// Deliberately fictional. Never mixed with a selected directory.
export const sampleFiles = [
  {
    path: 'README.md',
    text: '# Sample workspace\n\nFictional content for trying WikiBuild. Open your own folder to see your work.\n\n[Current plans](plans/README.md) · [Backlog](backlog/README.md)',
  },
  {
    path: 'plans/README.md',
    text: '# Current plans\n\n| Plan | Status | Next work |\n| --- | --- | --- |\n| [Example launch](example-launch/README.md) | Active | Review the first reading workflow |',
  },
  {
    path: 'plans/example-launch/README.md',
    text: '# Example launch\n\nStatus: active\nOwner: Sample owner\n\nA fictional project to explore the reading workflow.\n\n## Outcome\nUnderstand which project views are useful before adding management features.\n\n## Tasks\n[Review the reader](tasks/review-reader.md)\n\n## Reference\n[Sample notes](../../attachments/notes.txt)',
  },
  {
    path: 'plans/example-launch/tasks/review-reader.md',
    text: '---\nid: SAMPLE-01\nstatus: in-progress\nowner: Sample owner\n---\n# Review the reader\n\nRead a project, its task records, and the supporting documents.\n\n## Acceptance\n- [x] Open the project\n- [ ] Read its documents\n- [ ] Note what is missing\n\n[Back to project](../README.md)',
  },
  {
    path: 'backlog/README.md',
    text: '# Backlog\n\n| Idea | Status | Next action |\n| --- | --- | --- |\n| [Example idea](example-idea.md) | Idea | Discuss when useful |',
  },
  {
    path: 'backlog/example-idea.md',
    text: '# Example idea\n\nA fictional idea intentionally missing an owner and due date. The mapping view shows those gaps.',
  },
  { path: 'attachments/notes.txt', text: 'Sample attachment. This is not a real Hashikome project record.' },
].map(file => ({
  ...file,
  size: new Blob([file.text]).size,
  modified: 0,
  getFile: async () => new File([file.text], file.path.split('/').pop(), { type: 'text/plain' }),
}));
