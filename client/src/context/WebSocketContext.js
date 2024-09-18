import React, { createContext, useContext, useRef, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const WebSocketContext = createContext();

export const WebSocketProvider = ({ children }) => {
    const wsRef = useRef(null);

    const connectWebSocket = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            console.error('No active session');
            return null;
        }
        const deviceId = localStorage.getItem('deviceId');
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        const port = process.env.NODE_ENV === 'development' ? process.env.REACT_APP_WS_PORT : (window.location.port ?? '');

        const wsUrl = `${protocol}//${host}:${port}/ws?token=${session.access_token}&deviceId=${deviceId}`;
        console.log('Attempting to connect to WebSocket URL:', wsUrl);
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
            console.log('WebSocket connected successfully');
        };

        wsRef.current.onclose = (event) => {
            console.log('WebSocket disconnected', event.code, event.reason);
        };

        wsRef.current.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        return wsRef.current;
    };

    useEffect(() => {
        connectWebSocket();

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

    return (
        <WebSocketContext.Provider value={wsRef}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => {
    return useContext(WebSocketContext);
};