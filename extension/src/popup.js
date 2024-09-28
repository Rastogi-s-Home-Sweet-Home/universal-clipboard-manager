console.log('Popup script is running');

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const loggedInView = document.getElementById('loggedInView');
    const loginButton = document.getElementById('loginButton');
    const logoutButton = document.getElementById('logoutButton');
    const errorMessage = document.getElementById('errorMessage');
    const statusMessage = document.getElementById('statusMessage');
    const sendButton = document.getElementById('sendButton');
    const clipboardContent = document.getElementById('clipboardContent');

    function showError(message) {
        errorMessage.textContent = message + ' Please enable notifications in your browser settings and macOS System Preferences.';
        errorMessage.style.display = 'block';
        errorMessage.style.color = 'red'; // Ensure the text is red
        errorMessage.style.fontWeight = 'bold'; // Make it bold for emphasis
    }

    function hideError() {
        errorMessage.style.display = 'none';
    }

    function showStatus(message) {
        statusMessage.textContent = message;
        statusMessage.style.display = 'block';
    }

    function hideStatus() {
        statusMessage.style.display = 'none';
    }

    chrome.runtime.sendMessage({action: 'checkAuth'}, function(response) {
        if (chrome.runtime.lastError) {
            console.error('Error checking auth:', chrome.runtime.lastError);
            showError('Error checking authentication status');
            showLoginForm();
        } else if (response && response.isAuthenticated) {
            showLoggedInView();
        } else {
            showLoginForm();
        }
    });

    loginButton.addEventListener('click', function() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        chrome.runtime.sendMessage({action: 'login', email, password}, function(response) {
            if (chrome.runtime.lastError) {
                console.error('Error logging in:', chrome.runtime.lastError);
                showError('Login failed: ' + chrome.runtime.lastError.message);
            } else if (response && response.success) {
                hideError();
                showLoggedInView();
            } else {
                showError('Login failed: ' + (response.error || 'Unknown error'));
            }
        });
    });

    logoutButton.addEventListener('click', function() {
        chrome.runtime.sendMessage({action: 'logout'}, function(response) {
            if (chrome.runtime.lastError) {
                console.error('Error logging out:', chrome.runtime.lastError);
                showError('Logout failed: ' + chrome.runtime.lastError.message);
            } else if (response && response.success) {
                hideError();
                showLoginForm();
            } else {
                showError('Logout failed: ' + (response.error || 'Unknown error'));
            }
        });
    });

    sendButton.addEventListener('click', function() {
        const content = clipboardContent.value;
        chrome.runtime.sendMessage({action: 'sendClipboardContent', content: content}, function(response) {
            if (chrome.runtime.lastError) {
                console.error('Error sending content:', chrome.runtime.lastError);
                showError('Failed to send content: ' + chrome.runtime.lastError.message);
            } else if (response.success) {
                showStatus('Content sent successfully');
            } else {
                showError('Failed to send content: ' + (response.error || 'Unknown error'));
                if (response.error === 'User not authenticated') {
                    showLoginForm();
                }
            }
        });
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'notifyPermissionDenied') {
            showError('Notifications are turned off. Please enable them in your browser settings and macOS System Preferences to receive clipboard updates.');
        }
    });

    function showLoginForm() {
        loginForm.style.display = 'block';
        loggedInView.style.display = 'none';
    }

    function showLoggedInView() {
        loginForm.style.display = 'none';
        loggedInView.style.display = 'block';
    }

    // ... (existing code)
});