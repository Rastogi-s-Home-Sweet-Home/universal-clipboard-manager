import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import ClipboardSync from './components/ClipboardSync';
import './index.css'; // Global styles
import './popup.css'; // Import popup styles

import { connectToDevTools } from 'react-devtools-core';

if (process.env.NODE_ENV === 'development') {
  connectToDevTools({
    host: process.env.REACT_APP_REACT_DEVTOOLS_HOST,
    port: parseInt(process.env.REACT_APP_REACT_DEVTOOLS_PORT),
  });
}

function Popup() {
  useEffect(() => {
    chrome.runtime.sendMessage({action: 'initializeExtension'}, function(response) {
      if (chrome.runtime.lastError) {
        console.error('Error initializing extension:', chrome.runtime.lastError);
      } else if (response && response.success) {
        console.log('Extension initialized successfully');
      }
    });
  }, []); // Empty dependency array means this effect runs once on mount

  return <ClipboardSync />;
}

ReactDOM.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
  document.getElementById('root')
);