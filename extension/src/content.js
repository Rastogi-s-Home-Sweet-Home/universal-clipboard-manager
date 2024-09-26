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
    if (request.action === 'showNotificationAndCopy') {
        // Show a notification (you might want to use the Notifications API for this)
        alert('New clipboard content received: ' + request.content);

        // Copy the content to clipboard
        navigator.clipboard.writeText(request.content).then(function() {
            console.log('Content copied to clipboard');
            sendResponse({success: true});
        }).catch(function(err) {
            console.error('Could not copy text: ', err);
            sendResponse({success: false, error: err.message});
        });

        return true; // Indicates that the response is sent asynchronously
    }
});