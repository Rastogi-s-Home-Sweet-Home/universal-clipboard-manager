import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Button } from './ui/button';
import { Input } from './ui/input';

function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState(''); // State for messages

  const handleAuth = async (action) => {
    try {
      let result;
      if (action === 'login') {
        result = await supabase.auth.signInWithPassword({ email, password });
      } else if (action === 'register') {
        result = await supabase.auth.signUp({ email, password });
      }

      if (result.error) {
        // Handle specific error codes
        if (result.error.status === 429) {
          setMessage('Too many requests. Please try again later.');
        } else {
          setMessage(`Error: ${result.error.message}`);
        }
      } else {
        // Successful sign-up
        setMessage('Sign-up successful! Please check your email for confirmation.');
      }
    } catch (error) {
      console.error(`${action} error:`, error);
      setMessage(`An error occurred during ${action}. Please try again.`);
    }
  };

  return (
    <div className="max-w-sm mx-auto space-y-4 pt-8 md:pt-8">
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
      {message && <p className="text-center text-red-500">{message}</p>} {/* Display message */}
    </div>
  );
}

export default AuthForm;