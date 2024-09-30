import React from 'react';
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

ReactDOM.render(
  <React.StrictMode>
    <ClipboardSync />
  </React.StrictMode>,
  document.getElementById('root')
);