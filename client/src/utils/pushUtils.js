import { urlBase64ToUint8Array } from './generalUtils';
import { supabase } from '../supabaseClient';

export async function registerPushNotification() {
  try {
    // Wait for service worker to be ready
    const registration = await navigator.serviceWorker.ready;
    console.log('Service worker is ready:', registration);

    // Check if we already have a subscription
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      console.log('Already subscribed to push notifications');
      return;
    }
    
    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.REACT_APP_VAPID_PUBLIC_KEY)
    });

    console.log('Push subscription created:', subscription);

    // Send subscription to server
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const deviceId = localStorage.getItem('deviceId');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          subscription,
          deviceId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save subscription to server: ${errorText}`);
      }

      console.log('Push subscription saved to server');
    }
  } catch (error) {
    console.error('Error registering push notification:', error);
  }
} 