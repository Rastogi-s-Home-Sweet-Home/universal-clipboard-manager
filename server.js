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
  ? 'https://clipboard.javascriptbit.com' 
  : ['http://localhost:3006', 'http://192.168.1.132:3006'];

// CORS configuration
app.use(cors({
  origin: CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'client/build')));

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
  res.sendFile(path.join(__dirname, 'client/build/index.html'));
});

const wss = new WebSocket.Server({ server });

const clients = new Map();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // Use the service role key instead of the anon key
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

wss.on('connection', async (ws, request) => {
  console.log('New WebSocket connection attempt');

  let authenticated = false;
  let userId = null;
  let deviceId = null;

  const heartbeat = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 30000); // Send a ping every 30 seconds

  ws.on('message', async (message) => {
    console.log('Received message:', message.toString());
    try {
      const data = JSON.parse(message);
      if (data.type === 'auth') {
        // Handle authentication
        try {
          const decoded = jwt.verify(data.token, process.env.SUPABASE_JWT_SECRET);
          userId = decoded.sub;
          deviceId = data.deviceId;
          authenticated = true;
          console.log('User authenticated:', userId);
          ws.send(JSON.stringify({ type: 'auth_success' }));

          // Update device status to online
          if (deviceId) {
            console.log('Updating device status:', deviceId);
            const { error } = await supabase
              .from('devices')
              .upsert({ 
                id: deviceId, 
                user_id: userId, 
                is_online: true, 
                last_active: new Date().toISOString(),
                name: 'Chrome Extension' // Add a default name for the extension
              }, { onConflict: 'id' });
            
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
        } catch (error) {
          console.error('Authentication error:', error);
          ws.send(JSON.stringify({ type: 'auth_error', error: 'Invalid token' }));
          ws.close();
        }
      } else if (authenticated) {
        // Handle other message types (clipboard, ping, etc.)
        // ... (existing message handling code)
        if (data.type === 'clipboard') {
          console.log('Broadcasting clipboard content to other devices');
          const userClients = clients.get(userId);
          userClients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) { // Ensure we don't send to the sender
              client.send(JSON.stringify({ type: 'clipboard', content: data.content, contentId: data.contentId, deviceId })); // Include deviceId
            }
          });
        } else if (data.type === 'ping') {
          console.log('Received ping, sending pong');
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } else {
        
        console.error('Received message before authentication');
        ws.send(JSON.stringify({ type: 'auth_error', error: 'Not authenticated' }));
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });

  ws.on('close', async () => {
    clearInterval(heartbeat);
    if (authenticated && userId) {
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
    }
  });

  ws.on('pong', () => {
    // Reset the connection timeout on pong reception
    console.log('Received pong from client');
  });
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