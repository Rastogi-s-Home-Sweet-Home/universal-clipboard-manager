import { createClient } from '@supabase/supabase-js';

class SupabaseService {
  constructor() {
    this._client = null;
  }

  async getClient() {
    if (!this._client) {
      this._client = createClient(
        process.env.REACT_APP_SUPABASE_URL,
        process.env.REACT_APP_SUPABASE_KEY,
        {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false
          }
        }
      );
    }
    return this._client;
  }

  async getSession() {
    const client = await this.getClient();
    return await client.auth.getSession();
  }

  async getUser() {
    const client = await this.getClient();
    return await client.auth.getUser();
  }

  async refreshSession() {
    const client = await this.getClient();
    const { data, error } = await client.auth.refreshSession();
    if (error) throw error;
    if (data?.session) {
      chrome.storage.local.set({ supabaseSession: data.session });
    }
    return { data, error }; // Return in the same format as other Supabase methods
  }

  async setSession(session) {
    const client = await this.getClient();
    if (session) {
      await client.auth.setSession(session);
    }
    return client;
  }

  async login(email, password) {
    const client = await this.getClient();
    return await client.auth.signInWithPassword({
      email,
      password,
    });
  }

  async signup(email, password) {
    const client = await this.getClient();
    return await client.auth.signUp({
      email,
      password,
    });
  }
}

// Create a singleton instance
const supabaseService = new SupabaseService();

export default supabaseService;
