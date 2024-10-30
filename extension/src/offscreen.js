// Listen for messages from the extension
chrome.runtime.onMessage.addListener(async (message) => {
    if (message.type === 'copy-to-clipboard') {
        try {
            await handleClipboardWrite(message.content);
            // Notify background script that copy was successful
            chrome.runtime.sendMessage({ type: 'copy-success' });
        } catch (error) {
            console.error('Failed to copy text:', error);
            chrome.runtime.sendMessage({ type: 'copy-error', error: error.message });
        }
    }
});

// We use a <textarea> element for two main reasons:
//  1. preserve the formatting of multiline text,
//  2. select the node's content using this element's `.select()` method.
const textEl = document.querySelector('#text');

// Use the offscreen document's `document` interface to write a new value to the
// system clipboard.
//
// At the time this demo was created (Jan 2023) the `navigator.clipboard` API
// requires that the window is focused, but offscreen documents cannot be
// focused. As such, we have to fall back to `document.execCommand()`.
async function handleClipboardWrite(data) {
    try {
        // Error if we received the wrong kind of data.
        if (typeof data !== 'string') {
            throw new TypeError(
                `Value provided must be a 'string', got '${typeof data}'.`
            );
        }

        // `document.execCommand('copy')` works against the user's selection in a web
        // page. As such, we must insert the string we want to copy to the web page
        // and to select that content in the page before calling `execCommand()`.
        textEl.value = data;
        textEl.select();
        document.execCommand('copy');
    } finally {
        // Job's done! Close the offscreen document.
        window.close();
    }
}