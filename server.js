require('dotenv').config();

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);

const CORS_ORIGIN = process.env.NODE_ENV === 'production' 
  ? 'https://your-production-domain.com' 
  : ['http://localhost:3006', 'http://192.168.1.132:3006'];

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3006', 'http://192.168.1.132:3006'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Enable pre-flight requests for all routes
app.options('*', cors());

// Serve static files from the 'build' directory
app.use(express.static(path.join(__dirname, 'build')));

// Parse JSON bodies
app.use(express.json());

// Supabase JWT verification middleware
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
    const decoded = jwt.verify(token, SUPABASE_JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Protected route example
app.get('/api/protected', verifyToken, (req, res) => {
  res.json({ message: 'This is a protected route', user: req.user });
});

// Handle any requests that don't match the ones above
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const wss = new WebSocket.Server({ server });

const clients = new Map();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

wss.on('connection', async (ws, request) => {
  console.log('New WebSocket connection attempt');
  const url = new URL(request.url, `http://${request.headers.host}`);
  const token = url.searchParams.get('token');
  const deviceId = url.searchParams.get('deviceId');
  
  console.log('Received token:', token ? token.substring(0, 10) + '...' : 'No token');
  console.log('Received deviceId:', deviceId);
  
  try {
    const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
    console.log('JWT Secret (first 10 chars):', SUPABASE_JWT_SECRET.substring(0, 10));
    const decoded = jwt.verify(token, SUPABASE_JWT_SECRET);
    console.log('Decoded token:', decoded);
    const userId = decoded.sub;

    console.log('User authenticated:', userId);

    // Update device status to online
    if (deviceId) {
      const { data, error } = await supabase
        .from('devices')
        .update({ is_online: true, last_active: new Date().toISOString() })
        .eq('id', deviceId);
      
      if (error) {
        console.error('Error updating device status:', error);
      } else {
        console.log('Device status updated:', deviceId);
      }
    }

    if (!clients.has(userId)) {
      clients.set(userId, new Set());
    }
    clients.get(userId).add(ws);
    console.log('Client added for user:', userId);

    ws.on('message', (message) => {
      console.log('Received message from client:', message.toString());
      try {
        const data = JSON.parse(message);
        console.log('Parsed message:', data);
        if (data.type === 'clipboard') {
          console.log('Broadcasting clipboard content to other devices');
          const userClients = clients.get(userId);
          userClients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'clipboard', content: data.content }));
            }
          });
        } else if (data.type === 'ping') {
          console.log('Received ping, sending pong');
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });

    ws.on('close', async () => {
      console.log('WebSocket connection closed for user:', userId);
      // Update device status to offline
      if (deviceId) {
        await supabase
          .from('devices')
          .update({ is_online: false, last_active: new Date().toISOString() })
          .eq('id', deviceId);
      }

      const userClients = clients.get(userId);
      userClients.delete(ws);
      if (userClients.size === 0) {
        clients.delete(userId);
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    ws.close();
  }
});

// Device management routes
app.delete('/api/devices/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase
    .from('devices')
    .delete()
    .eq('id', id)
    .eq('user_id', req.user.sub);

  if (error) {
    res.status(400).json({ error: error.message });
  } else {
    res.json({ message: 'Device deleted successfully' });
  }
});

app.put('/api/devices/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const { error } = await supabase
    .from('devices')
    .update({ name })
    .eq('id', id)
    .eq('user_id', req.user.sub);

  if (error) {
    res.status(400).json({ error: error.message });
  } else {
    res.json({ message: 'Device updated successfully' });
  }
});

app.post('/api/devices/:id/logout', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase
    .from('devices')
    .update({ is_online: false })
    .eq('id', id)
    .eq('user_id', req.user.sub);

  if (error) {
    res.status(400).json({ error: error.message });
  } else {
    res.json({ message: 'Device logged out successfully' });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});