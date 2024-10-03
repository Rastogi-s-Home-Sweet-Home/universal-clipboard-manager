import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import AuthForm from './components/AuthForm';
import ClipboardSync from './components/ClipboardSync';
import { ToastProvider } from './components/ui/toast';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

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
      </div>
    </ToastProvider>
  );
}

export default App;
