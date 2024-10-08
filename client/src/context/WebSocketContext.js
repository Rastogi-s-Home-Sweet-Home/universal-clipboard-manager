import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { getDeviceName, getOrCreateDeviceId } from '../utils/deviceUtils';

const WebSocketContext = createContext();

const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds
const MAX_RETRIES = 5;

export const WebSocketProvider = ({ children }) => {
  const [wsStatus, setWsStatus] = useState('disconnected');
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isConnectingRef = useRef(false);
  const retryCountRef = useRef(0);
  const authRetryCountRef = useRef(0);

  const resetRetryParams = useCallback(() => {
    retryCountRef.current = 0;
    authRetryCountRef.current = 0;
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    setWsStatus('disconnected');
    isConnectingRef.current = false;
    resetRetryParams();
  }, [resetRetryParams]);

  const refreshToken = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      console.log('Token refreshed successfully');
      return data.session;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  }, []);

  const sendAuthMessage = useCallback(async () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        let { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          console.log('No active session, attempting to refresh token');
          session = await refreshToken();
          if (!session) {
            throw new Error('Unable to refresh token');
          }
        }

        const authMessage = JSON.stringify({
          type: 'auth',
          token: session.access_token,
          deviceId: getOrCreateDeviceId(),
          deviceName: getDeviceName(),
        });
        wsRef.current.send(authMessage);
      } catch (error) {
        console.error('Error in sendAuthMessage:', error);
        setWsStatus('authentication_failed');
        retryAuth();
      }
    } else {
      console.error('WebSocket is not open. Unable to send auth message.');
      setWsStatus('authentication_failed');
      retryAuth();
    }
  }, [refreshToken]);

  const retryAuth = useCallback(async () => {
    if (authRetryCountRef.current >= MAX_RETRIES) {
      console.error('Max auth retry attempts reached. Disconnecting.');
      disconnect();
      return;
    }

    const delay = Math.min(INITIAL_RETRY_DELAY * (2 ** authRetryCountRef.current), MAX_RETRY_DELAY);
    console.log(`Retrying authentication in ${delay}ms...`);

    await new Promise(resolve => setTimeout(resolve, delay));
    authRetryCountRef.current++;

    try {
      const session = await refreshToken();
      if (session) {
        sendAuthMessage();
      } else {
        throw new Error('Failed to refresh token');
      }
    } catch (error) {
      console.error('Error during authentication retry:', error);
      retryAuth();
    }
  }, [sendAuthMessage, disconnect, refreshToken]);

  const connect = useCallback(() => {
    if (isConnectingRef.current) {
      console.log('Connection attempt already in progress');
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    isConnectingRef.current = true;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = process.env.NODE_ENV === 'development' ? process.env.REACT_APP_WS_PORT : (window.location.port ?? '');

    const wsUrl = `${protocol}//${host}:${port}/ws`;
    console.log('Attempting to connect to WebSocket URL:', wsUrl);

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
      setWsStatus('connected');
      isConnectingRef.current = false;
      resetRetryParams();
      sendAuthMessage();
    };

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'auth_success') {
        console.log('Authentication successful');
        setWsStatus('authenticated');
        resetRetryParams();
      } else if (data.type === 'auth_error') {
        console.error('Authentication failed:', data.error);
        setWsStatus('authentication_failed');
        retryAuth();
      }
      // Handle other message types...
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsStatus('error');
    };

    wsRef.current.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setWsStatus('disconnected');
      isConnectingRef.current = false;
      retryConnection();
    };
  }, [resetRetryParams, sendAuthMessage, retryAuth]);

  const retryConnection = useCallback(() => {
    if (retryCountRef.current >= MAX_RETRIES) {
      console.error('Max retry attempts reached. Stopping reconnection attempts.');
      return;
    }

    const delay = Math.min(INITIAL_RETRY_DELAY * (2 ** retryCountRef.current), MAX_RETRY_DELAY);
    console.log(`Retrying connection in ${delay}ms...`);

    reconnectTimeoutRef.current = setTimeout(() => {
      retryCountRef.current++;
      connect();
    }, delay);
  }, [connect]);

  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(message);
    } else {
      console.error('WebSocket is not connected. Unable to send message.');
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  const value = {
    wsStatus,
    connect,
    disconnect,
    sendMessage
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  return useContext(WebSocketContext);
};