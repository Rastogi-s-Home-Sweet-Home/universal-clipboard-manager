import React, { useState, useCallback } from 'react';
import { useClipboardSync } from '../hooks/useClipboardSync';
import ClipboardHistory from './ClipboardHistory';
// Update the import statement for Heroicons v2
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid';

function ClipboardSync() {
  const {
    clipboardContent,
    setClipboardContent,
    status,
    isAuthenticated,
    handleSend,
    handleCopy,
    handleLogout,
    handleLogin,
    handleSignUp,  // Add this new handler
    history, // Get history from the hook
    setHistory, // Get setHistory from the hook
  } = useClipboardSync(true);  // true indicates it's the extension version

  const [showHistory, setShowHistory] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);  // To toggle between login and sign-up

  const handleSignUpClick = () => {
    handleSignUp(email, password);
    // Don't clear the form or change state here
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 pt-4">
        <h2 className="text-2xl font-bold mb-4">{isSignUp ? 'Sign Up' : 'Login'}</h2>
        <input 
          type="email" 
          placeholder="Email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 mb-2 border rounded" 
        />
        <div className="relative mb-2">
          <input 
            type={showPassword ? "text" : "password"}
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 pr-10 border rounded" 
          />
          <button 
            type="button"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 focus:outline-none"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeSlashIcon className="h-5 w-5" />
            ) : (
              <EyeIcon className="h-5 w-5" />
            )}
          </button>
        </div>
        <button 
          onClick={() => isSignUp ? handleSignUpClick() : handleLogin(email, password)}
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 mb-2"
        >
          {isSignUp ? 'Sign Up' : 'Login'}
        </button>
        <button 
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full bg-gray-200 text-gray-800 p-2 rounded hover:bg-gray-300"
        >
          {isSignUp ? 'Already have an account? Login' : 'Need an account? Sign Up'}
        </button>
        <div className="text-sm text-gray-600 mt-2">{status}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-4">
      <textarea
        value={clipboardContent}
        onChange={(e) => setClipboardContent(e.target.value)}
        placeholder="Paste or type content here"
        className="w-full p-2 min-h-[150px] mb-4 border rounded"
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 mb-4">
        <button onClick={handleSend} className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600">Send</button>
        <button onClick={handleCopy} className="w-full bg-gray-500 text-white p-2 rounded hover:bg-gray-600">Copy</button>
        <button onClick={handleLogout} className="w-full bg-red-500 text-white p-2 rounded hover:bg-red-600">Logout</button>
      </div>
      <div className="text-sm text-gray-600 mb-4">{status}</div>
      <button 
        onClick={() => setShowHistory(!showHistory)} 
        className="w-full bg-blue-300 text-white p-2 rounded hover:bg-blue-400 mb-4"
      >
        {showHistory ? 'Hide History' : 'Show History'}
      </button>
      {showHistory && (
        <ClipboardHistory
          isOpen={true}
          onClose={() => setShowHistory(false)}
          onCopy={setClipboardContent}
          receivedReceipts={{}}
          maxEntries={10} // Increase this for debugging
          isExtension={true}
          history={history} // Pass history to ClipboardHistory
          setHistory={setHistory} // Pass setHistory to ClipboardHistory
        />
      )}
    </div>
  );
}

export default ClipboardSync;