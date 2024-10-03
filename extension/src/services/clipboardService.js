import { checkAndRefreshSession } from './supabaseService';
import { getSupabase } from './supabaseService';
import { getWebSocket } from './webSocketService';
import { saveToHistory } from '../utils/dbUtils';

export async function sendClipboardContent(content) {
  try {
    if (await checkAndRefreshSession()) {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('User not authenticated');
        return { success: false, error: 'User not authenticated' };
      }
      const ws = getWebSocket();
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket not in OPEN state');
      }
      const clipboardData = { type: 'clipboard', content };
      ws.send(JSON.stringify(clipboardData));
      
      // Save to history
      const newItem = {
        content: content.trim(),
        type: 'sent',
        timestamp: Date.now(),
      };
      await saveToHistory(newItem);
      
      return { success: true };
    } else {
      throw new Error('User not authenticated');
    }
  } catch (error) {
    console.error('Error sending clipboard content:', error);
    return { success: false, error: error.message };
  }
}