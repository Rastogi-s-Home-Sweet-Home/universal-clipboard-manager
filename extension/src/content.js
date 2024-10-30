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

// Function to create and show a toast notification
function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 10000;
        transition: opacity 0.3s ease-in-out;
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, duration);
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'copyToClipboard') {
        // Add a delay before copying to clipboard
        setTimeout(() => {
            // Attempt to copy using the clipboard API
            navigator.clipboard.writeText(request.content).then(function() {
                console.log('Content copied to clipboard');
                
                // Show a toast notification after successful copy
                showToast('Copied to clipboard');

                sendResponse({ success: true });
            }).catch(function(err) {
                console.error('Could not copy text using clipboard API: ', err);
                // Fallback method
                fallbackCopyTextToClipboard(request.content, sendResponse);
            });
        }, 1000); // Wait for 100 milliseconds

        return true; // Indicates that the response is sent asynchronously
    } else if (request.action === 'showToast') {
        showToast(request.message);
        sendResponse({ success: true });
        return true;
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
        showToast('Copied to clipboard');
        sendResponse({ success: true });
    } catch (err) {
        console.error('Fallback copy failed:', err);
        sendResponse({ success: false, error: err.message });
    }
    document.body.removeChild(textArea);
}