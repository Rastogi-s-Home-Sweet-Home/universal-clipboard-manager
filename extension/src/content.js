document.addEventListener('copy', function(e) {
    const selectedText = window.getSelection().toString();
    if (selectedText) {
        chrome.runtime.sendMessage({action: 'sendClipboardContent', content: selectedText}, function(response) {
            if (chrome.runtime.lastError) {
                console.error('Error sending clipboard content:', chrome.runtime.lastError);
            } else if (!response.success) {
                console.error('Failed to send clipboard content:', response.error);
                if (response.error === 'User not authenticated') {
                    // Optionally, you could show a notification to the user here
                    console.log('User is not authenticated. Please log in to sync clipboard.');
                }
            }
        });
    }
});

// Function to get clipboard content and send it to the background script
const getClipboardContent = async () => {
    try {
        const clipboardText = await navigator.clipboard.readText();
        chrome.runtime.sendMessage({
            action: 'sendClipboardContent',
            content: clipboardText
        }, function(response) {
            if (chrome.runtime.lastError) {
                console.error('Error sending clipboard content:', chrome.runtime.lastError);
            } else if (!response.success) {
                console.error('Failed to send clipboard content:', response.error);
                if (response.error === 'User not authenticated') {
                    console.log('User is not authenticated. Please log in to sync clipboard.');
                }
            }
        });
    } catch (error) {
        console.error('Failed to read clipboard contents: ', error);
    }
};

// Call the function when needed, e.g., on a button click or a specific event
// getClipboardContent();

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {    
    // Add the copyToClipboard action handling
    if (request.action === 'copyToClipboard') {

        // Add a delay before copying to clipboard
        setTimeout(() => {
            // Attempt to copy using the clipboard API
            navigator.clipboard.writeText(request.content).then(function() {
                console.log('Content copied to clipboard');
                sendResponse({ success: true });
            }).catch(function(err) {
                console.error('Could not copy text using clipboard API: ', err);
                // Fallback method
                fallbackCopyTextToClipboard(request.content, sendResponse);
            });
        }, 2000); // Wait for 100 milliseconds

        return true; // Indicates that the response is sent asynchronously
    }
});

// Fallback method to copy text to clipboard
function fallbackCopyTextToClipboard(text, sendResponse) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        console.log('Content copied to clipboard using fallback method');
        sendResponse({ success: true });
    } catch (err) {
        console.error('Fallback copy failed:', err);
        sendResponse({ success: false, error: err.message });
    }
    document.body.removeChild(textArea);
}