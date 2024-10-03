import React, { useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid';

function AuthForm({ onLogin, onSignUp, status }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSignUp) {
      onSignUp(email, password);
    } else {
      onLogin(email, password);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="container mx-auto px-4 pt-4">
      <h2 className="text-2xl font-bold mb-4">{isSignUp ? 'Sign Up' : 'Login'}</h2>
      <input 
        type="email" 
        placeholder="Email" 
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full p-2 mb-2 border rounded" 
        required
      />
      <div className="relative mb-2">
        <input 
          type={showPassword ? "text" : "password"}
          placeholder="Password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 pr-10 border rounded" 
          required
        />
        <button 
          type="button"
          className="absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 focus:outline-none"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? (
            <EyeSlashIcon className="h-5 w-5" />
          ) : (
            <EyeIcon className="h-5 w-5" />
          )}
        </button>
      </div>
      <button 
        type="submit"
        className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 mb-2"
      >
        {isSignUp ? 'Sign Up' : 'Login'}
      </button>
      <button 
        type="button"
        onClick={() => setIsSignUp(!isSignUp)}
        className="w-full bg-gray-200 text-gray-800 p-2 rounded hover:bg-gray-300"
      >
        {isSignUp ? 'Already have an account? Login' : 'Need an account? Sign Up'}
      </button>
      <div className="text-sm text-gray-600 mt-2">{status}</div>
    </form>
  );
}

export default AuthForm;