import React from 'react';
import ReactDOM from 'react-dom/client'; // Import from 'react-dom/client'
import './index.css';
import App from './App';
import { WebSocketProvider } from './context/WebSocketContext';

// Create a root for the application
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render the application using the new API
root.render(
    <React.StrictMode> {/* Wrap the application in StrictMode */}
        <WebSocketProvider>
            <App />
        </WebSocketProvider>
    </React.StrictMode>
);
