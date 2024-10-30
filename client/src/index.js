import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { WebSocketProvider } from './context/WebSocketContext';

// Register service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js');
            console.log('Service worker registered:', registration);
        } catch (error) {
            console.error('Service worker registration failed:', error);
        }
    });
}


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode> {/* Wrap the application in StrictMode */}
        <WebSocketProvider>
            <App />
        </WebSocketProvider>
    </React.StrictMode>
);
