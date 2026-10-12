// Keep the upstream interactive demo separate from the read-only workspace reader.
if (new URLSearchParams(location.search).get('demo') === '1') {
  import('./main.js');
} else {
  import('./workspace/app.js');
}
