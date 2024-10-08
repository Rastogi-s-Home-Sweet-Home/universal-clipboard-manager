import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { getDeviceName } from '../utils/deviceUtils';

const WebSocketContext = createContext();

export const WebSocketProvider = ({ children }) => {
    const [wsStatus, setWsStatus] = useState('disconnected');
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const isConnectingRef = useRef(false);

    const sendAuthMessage = useCallback((token, deviceId) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const authMessage = JSON.stringify({
                type: 'auth',
                token: token,
                deviceId: deviceId,
                deviceName: getDeviceName(),
            });
            wsRef.current.send(authMessage);
        } else {
            console.error('WebSocket is not open. Unable to send auth message.');
        }
    }, []);

    const connect = useCallback(async () => {
        if (isConnectingRef.current) {
            console.log('Connection attempt already in progress');
            return;
        }

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            console.log('WebSocket already connected');
            return;
        }

        isConnectingRef.current = true;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.error('No active session');
                setWsStatus('disconnected');
                return null;
            }

            const deviceId = localStorage.getItem('deviceId');
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.hostname;
            const port = process.env.NODE_ENV === 'development' ? process.env.REACT_APP_WS_PORT : (window.location.port ?? '');

            const wsUrl = `${protocol}//${host}:${port}/ws`;
            console.log('Attempting to connect to WebSocket URL:', wsUrl);

            wsRef.current = new WebSocket(wsUrl);

            wsRef.current.onopen = () => {
                console.log('WebSocket connected successfully');
                sendAuthMessage(session.access_token, deviceId);
            };

            wsRef.current.onclose = (event) => {
                console.log('WebSocket disconnected', event.code, event.reason);
                setWsStatus('disconnected');
                isConnectingRef.current = false;
                // Attempt to reconnect after 5 seconds
                reconnectTimeoutRef.current = setTimeout(connect, 5000);
            };

            wsRef.current.onerror = (error) => {
                console.error('WebSocket error:', error);
                setWsStatus('error');
                isConnectingRef.current = false;
            };

            wsRef.current.onmessage = (event) => {
                console.log('Received:', event.data);
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'auth_success') {
                        console.log('Authentication successful');
                        setWsStatus('connected');
                        isConnectingRef.current = false;
                    } else if (data.type === 'auth_error') {
                        console.error('Authentication failed:', data.error);
                        wsRef.current.close();
                        setWsStatus('error');
                        isConnectingRef.current = false;
                    } else {
                        // Dispatch other messages to the window object
                        window.dispatchEvent(new MessageEvent('message', { data: event.data }));
                    }
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            };

            return wsRef.current;
        } catch (error) {
            console.error('Error connecting to WebSocket:', error);
            setWsStatus('error');
            isConnectingRef.current = false;
        }
    }, [sendAuthMessage]);

    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
        }
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        setWsStatus('disconnected');
        isConnectingRef.current = false;
    }, []);

    const sendMessage = useCallback((message) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(message);
        } else {
            console.error('WebSocket is not connected. Unable to send message.');
        }
    }, []);

    useEffect(() => {
        const initializeWebSocket = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                connect();
            }
        };

        initializeWebSocket();

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