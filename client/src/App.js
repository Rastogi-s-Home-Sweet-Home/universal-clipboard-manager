import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import AuthForm from './components/AuthForm';
import ClipboardSync from './components/ClipboardSync';

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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground p-4">
        <h1 className="text-2xl md:text-3xl font-bold text-center">Clipboard Sync</h1>
      </header>
      <main className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {isAuthenticated ? <ClipboardSync /> : <AuthForm />}
        </div>
      </main>
      <footer className="bg-secondary text-secondary-foreground p-4 text-center">
        <p>&copy; 2024 Clipboard Sync. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
