document.addEventListener('copy', function(e) {
    const selectedText = window.getSelection().toString();
    if (selectedText) {
        chrome.runtime.sendMessage({action: 'sendClipboardContent', content: selectedText}, function(response) {
            if (chrome.runtime.lastError) {
                console.error('Error sending clipboard content:', chrome.runtime.lastError);
            } else if (!response.success) {
                console.error('Failed to send clipboard content:', response.error);
                if (response.error === 'User not authenticated') {
                    console.log('User is not authenticated. Please log in to sync clipboard.');
                }
            }
        });
    }
});

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'copyToClipboard') {
        
        // Add a delay before copying to clipboard
        setTimeout(() => {
            // Attempt to copy using the clipboard API
            navigator.clipboard.writeText(request.content).then(function() {
                console.log('Content copied to clipboard');
                
                // Show a toast notification after successful copy
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: chrome.runtime.getURL('icon128.png'), // Use your icon
                    title: 'Clipboard Sync',
                    message: 'Content copied to clipboard successfully!',
                    priority: 1
                });

                sendResponse({ success: true });
            }).catch(function(err) {
                console.error('Could not copy text using clipboard API: ', err);
                // Fallback method
                fallbackCopyTextToClipboard(request.content, sendResponse);
            });
        }, 3000); // Wait for 100 milliseconds

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