const authContainer = document.getElementById('auth-container');
const clipboardContainer = document.getElementById('clipboard-container');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('login-button');
const registerButton = document.getElementById('register-button');
const logoutButton = document.getElementById('logout-button');
const clipboardContent = document.getElementById('clipboard-content');
const sendButton = document.getElementById('send-button');
const copyButton = document.getElementById('copy-button');
const status = document.getElementById('status');

let ws;
let token = localStorage.getItem('authToken');

function showAuth() {
  authContainer.style.display = 'block';
  clipboardContainer.style.display = 'none';
}

function showClipboard() {
  authContainer.style.display = 'none';
  clipboardContainer.style.display = 'block';
  connectWebSocket();
}

function connectWebSocket() {
  ws = new WebSocket(`ws://${window.location.host}?token=${token}`);

  ws.onopen = () => {
    status.textContent = 'Connected';
  };

  ws.onclose = () => {
    status.textContent = 'Disconnected';
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'clipboard') {
      clipboardContent.value = data.content;
      status.textContent = 'Received new content';
    }
  };
}

async function login() {
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailInput.value, password: passwordInput.value }),
    });
    const data = await response.json();
    if (response.ok && data.user && data.token) {
      token = data.token;
      localStorage.setItem('authToken', token);
      showClipboard();
    } else {
      alert(data.error || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    alert('An error occurred during login. Please try again.');
  }
}

async function register() {
  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailInput.value, password: passwordInput.value }),
    });
    const data = await response.json();
    if (response.ok && data.user && data.token) {
      token = data.token;
      localStorage.setItem('authToken', token);
      showClipboard();
    } else {
      alert(data.error || 'Registration failed');
    }
  } catch (error) {
    console.error('Registration error:', error);
    alert('An error occurred during registration. Please try again.');
  }
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  token = null;
  localStorage.removeItem('authToken');
  if (ws) {
    ws.close();
  }
  showAuth();
}

function copyToClipboard() {
  clipboardContent.select();
  clipboardContent.setSelectionRange(0, 99999); // For mobile devices

  navigator.clipboard.writeText(clipboardContent.value).then(() => {
    status.textContent = 'Copied to clipboard';
  }).catch((err) => {
    console.error('Failed to copy to clipboard:', err);
    status.textContent = 'Failed to copy to clipboard. Please copy manually.';
  });
}

loginButton.addEventListener('click', login);
registerButton.addEventListener('click', register);
logoutButton.addEventListener('click', logout);
copyButton.addEventListener('click', copyToClipboard);

sendButton.addEventListener('click', () => {
  const content = clipboardContent.value;
  ws.send(JSON.stringify({ type: 'clipboard', content }));
  status.textContent = 'Sent to other devices';
});

clipboardContent.addEventListener('input', () => {
  const content = clipboardContent.value;
  ws.send(JSON.stringify({ type: 'clipboard', content }));
  status.textContent = 'Sent to other devices';
});

// Check if user is already logged in
if (token) {
  showClipboard();
} else {
  showAuth();
}