import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

const Popup = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    chrome.runtime.sendMessage({action: 'checkAuth'}, function(response) {
      if (chrome.runtime.lastError) {
        console.error('Error checking auth:', chrome.runtime.lastError);
        setError('Error checking authentication status');
      } else if (response && response.isAuthenticated) {
        setIsAuthenticated(true);
      }
    });
  }, []);

  const handleLogin = () => {
    chrome.runtime.sendMessage({action: 'login', email, password}, function(response) {
      if (chrome.runtime.lastError) {
        console.error('Error logging in:', chrome.runtime.lastError);
        setError('Login failed: ' + chrome.runtime.lastError.message);
      } else if (response && response.success) {
        setIsAuthenticated(true);
        setError('');
      } else {
        setError('Login failed: ' + (response.error || 'Unknown error'));
      }
    });
  };

  const handleLogout = () => {
    chrome.runtime.sendMessage({action: 'logout'}, function(response) {
      if (chrome.runtime.lastError) {
        console.error('Error logging out:', chrome.runtime.lastError);
        setError('Logout failed: ' + chrome.runtime.lastError.message);
      } else if (response && response.success) {
        setIsAuthenticated(false);
        setError('');
      } else {
        setError('Logout failed');
      }
    });
  };

  return (
    <div>
      {error && <div style={{color: 'red'}}>{error}</div>}
      {isAuthenticated ? (
        <div>
          <p>You are logged in</p>
          <button onClick={handleLogout}>Logout</button>
        </div>
      ) : (
        <div>
          <input 
            type="email" 
            placeholder="Email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
          />
          <button onClick={handleLogin}>Login</button>
        </div>
      )}
    </div>
  );
};

ReactDOM.render(<Popup />, document.getElementById('root'));