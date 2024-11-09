import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import AuthForm from './components/AuthForm';
import ClipboardSync from './components/ClipboardSync';
import { ToastProvider } from './components/ui/toast';
import InstallPWA from './components/InstallPWA';

// Get VAPID key from environment variable
const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;

const generateDeviceId = () => {
  let deviceId = localStorage.getItem('deviceId');
  
  if (!deviceId) {
    deviceId = `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('deviceId', deviceId);
  }
  
  return deviceId;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [deviceId] = useState(() => generateDeviceId());
  const [session, setSession] = useState(null);

  useEffect(() => {
    // Get initial session
    const session = supabase.auth.getSession();
    setSession(session);

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
      setSession(session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const registerServiceWorker = async () => {
      if (!('serviceWorker' in navigator) || !isAuthenticated || !session) {
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('SW registered with deviceId:', deviceId);
        
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.REACT_APP_VAPID_PUBLIC_KEY
        });

        // Get the access token from the session
        const { access_token } = session;
        
        if (!access_token) {
          throw new Error('No access token available');
        }

        const response = await fetch('/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`
          },
          body: JSON.stringify({
            subscription,
            deviceId
          })
        });

        if (!response.ok) {
          throw new Error('Failed to register subscription');
        }

        console.log('Push subscription successful');
      } catch (error) {
        console.error('SW registration failed:', error);
      }
    };

    registerServiceWorker();
  }, [deviceId, isAuthenticated, session]);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background flex flex-col">
        {!isAuthenticated && (
          <div className="text-center mt-12 mb-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-primary">
              Universal Clipboard Manager
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto">
              Sync your clipboard across all your devices securely and effortlessly.
            </p>
          </div>
        )}
        <main className="flex-grow flex justify-center p-4">
          <div className="w-full max-w-md">
            {isAuthenticated ? <ClipboardSync /> : <AuthForm onAuthStateChange={setIsAuthenticated} />}
          </div>
        </main>
        <footer className="bg-secondary text-secondary-foreground p-4 text-center">
          <p>&copy; 2024 Clipboard Sync. All rights reserved.</p>
        </footer>
        <InstallPWA />
      </div>
    </ToastProvider>
  );
}

export default App;
