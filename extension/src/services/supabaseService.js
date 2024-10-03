import { createClient } from '@supabase/supabase-js';
import { epochToMs } from '../utils';

let supabase;
let currentSession = null;

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;

export async function initSupabase() {
  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    });
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await supabase.auth.setSession(session);
    currentSession = session;
  }
  return supabase;
}

export async function checkAndRefreshSession() {
  try {
    if (!currentSession) {
      const { data: { session } } = await supabase.auth.getSession();
      currentSession = session;
    }
    if (currentSession) {
      const expiresAt = new Date(epochToMs(currentSession.expires_at));
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60000);

      if (expiresAt < fiveMinutesFromNow) {
        console.log('Session expiring soon, refreshing...');
        const { data, error } = await supabase.auth.refreshSession();
        if (error) throw error;
        currentSession = data.session;
        chrome.storage.local.set({ supabaseSession: currentSession });
        console.log('Session refreshed successfully');
      }
      return true;
    }
    console.log('No current session found');
    return false;
  } catch (error) {
    console.error('Error refreshing session:', error);
    return false;
  }
}

export function getSupabase() {
  return supabase;
}

export function getCurrentSession() {
  return currentSession;
}

export function setCurrentSession(session) {
  currentSession = session;
}