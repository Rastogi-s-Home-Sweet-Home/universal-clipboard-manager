import React, { useState } from 'react';
import { useClipboardSync } from '../hooks/useClipboardSync';
import ClipboardHistory from './ClipboardHistory';
import AuthForm from './AuthForm';
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
    handleSignUp,
    history,
    setHistory,
  } = useClipboardSync(true);  // true indicates it's the extension version

  const [showHistory, setShowHistory] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 pt-4">
        <AuthForm
          onLogin={handleLogin}
          onSignUp={handleSignUp}
          status={status}
        />
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
          maxEntries={10}
          isExtension={true}
          history={history}
          setHistory={setHistory}
        />
      )}
    </div>
  );
}

export default ClipboardSync;