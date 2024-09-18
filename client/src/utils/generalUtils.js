export function fallbackCopyTextToClipboard(text, setStatus) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand('copy');
    setStatus('Copied to clipboard');
  } catch (err) {
    console.error('Fallback copy failed:', err);
    setStatus('Copy failed. Please copy manually.');
  }
  document.body.removeChild(textArea);
}