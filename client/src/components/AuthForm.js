import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Button } from './ui/button';
import { Input } from './ui/input';

function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleAuth = async (action) => {
    try {
      let result;
      if (action === 'login') {
        result = await supabase.auth.signInWithPassword({ email, password });
      } else if (action === 'register') {
        result = await supabase.auth.signUp({ email, password });
      }

      if (result.error) throw result.error;
    } catch (error) {
      console.error(`${action} error:`, error);
      alert(`An error occurred during ${action}. Please try again.`);
    }
  };

  return (
    <div className="space-y-4">
      <Input 
        type="email" 
        value={email} 
        onChange={(e) => setEmail(e.target.value)} 
        placeholder="Email" 
        className="w-full"
      />
      <Input 
        type="password" 
        value={password} 
        onChange={(e) => setPassword(e.target.value)} 
        placeholder="Password" 
        className="w-full"
      />
      <div className="flex space-x-2">
        <Button onClick={() => handleAuth('login')} className="flex-1">Login</Button>
        <Button onClick={() => handleAuth('register')} variant="outline" className="flex-1">Register</Button>
      </div>
    </div>
  );
}

export default AuthForm;