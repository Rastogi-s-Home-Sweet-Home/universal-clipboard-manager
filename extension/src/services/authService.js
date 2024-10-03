import { getSupabase, setCurrentSession } from './supabaseService';
import { initWebSocket, sendAuthMessage } from './webSocketService';
import { epochToMs } from '../utils';

export async function login(email, password) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });
    if (error) throw error;
    console.log('Login successful, user:', data.user);
    setCurrentSession(data.session);
    console.log('Session expires at:', new Date(epochToMs(data.session.expires_at)).toISOString());
    chrome.storage.local.set({ supabaseSession: data.session });
    await sendAuthMessage();
    initWebSocket();
    return { success: true, user: data.user };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error.message };
  }
}

export async function logout() {
  try {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    chrome.storage.local.remove('supabaseSession');
    setCurrentSession(null);
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, error: error.message };
  }
}

export async function signup(email, password) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });
    if (error) throw error;
    
    if (data.user) {
      if (data.session) {
        console.log('Existing user logged in:', data.user);
        setCurrentSession(data.session);
        console.log('Session expires at:', new Date(epochToMs(data.session.expires_at)).toISOString());
        chrome.storage.local.set({ supabaseSession: data.session });
        await sendAuthMessage();
        initWebSocket();
        return { success: true, user: data.user, message: 'Logged in successfully', isNewUser: false };
      } else {
        console.log('Sign-up successful, user:', data.user);
        return { success: true, user: data.user, message: 'Sign-up successful! Please check your email for confirmation.', isNewUser: true };
      }
    } else {
      return { success: false, error: 'An unexpected error occurred' };
    }
  } catch (error) {
    console.error('Sign-up error:', error);
    return { success: false, error: error.message };
  }
}

export async function checkAuthStatus() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return { isAuthenticated: !!data.session };
  } catch (error) {
    console.error('Error checking auth status:', error);
    return { isAuthenticated: false, error: error.message };
  }
}