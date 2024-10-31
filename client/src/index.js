import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ToastProvider, useToast } from './components/ui/toast';
import { registerServiceWorker } from './utils/serviceWorkerUtils';

const ServiceWorkerUpdater = () => {
    const toast = useToast();

    React.useEffect(() => {
        window.addEventListener('load', () => registerServiceWorker(toast));
    }, [toast]);

    return null;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <ToastProvider>
            <ServiceWorkerUpdater />
            <App />
        </ToastProvider>
    </React.StrictMode>
);
