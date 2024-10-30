require('dotenv').config();

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

const app = express();

// Use HTTP instead
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

// Configure web push with proper options
webpush.setVapidDetails(
  'mailto:divyamsuperb@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Add subscription endpoint
app.post('/subscribe', verifyToken, async (req, res) => {
  const { subscription, deviceId } = req.body;
  
  try {
    // Store subscription in Supabase
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ 
        user_id: req.user.sub,
        device_id: deviceId,
        subscription: subscription  // Contains the extension identifier
      }, { 
        onConflict: 'device_id' 
      });

    if (error) throw error;
    res.status(200).json({ message: 'Subscription saved' });
  } catch (error) {
    console.error('Error saving subscription:', error);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

wss.on('connection', (ws) => {
  let authenticated = false;
  let userId = null;
  let deviceId = null;

  ws.on('message', async (message) => {
    console.log('Received message:', message.toString());
    try {
      const data = JSON.parse(message);
      if (data.type === 'auth') {
        // Handle authentication
        try {
          const { data: { user }, error } = await supabase.auth.getUser(data.token);
          if (error) throw error;
          
          // Validate deviceId
          if (!data.deviceId || typeof data.deviceId !== 'string' || data.deviceId.length === 0) {
            throw new Error('Invalid deviceId');
          }
          
          userId = user.id;
          deviceId = data.deviceId;
          authenticated = true;
          console.log('User authenticated:', userId);
          console.log('Device ID:', deviceId); // Log the deviceId for debugging
          ws.send(JSON.stringify({ type: 'auth_success' }));

          // Update device status to online
          if (deviceId) {
            console.log('Updating device status for deviceId:', deviceId);
            const deviceName = data.deviceName || 'Unknown Device';
            try {
              const { error: upsertError } = await supabase
                .from('devices')
                .upsert({ 
                  id: deviceId, 
                  user_id: userId, 
                  is_online: true, 
                  last_active: new Date().toISOString(),
                  name: deviceName
                }, { 
                  onConflict: 'id',
                  returning: true // Add this to see what was inserted/updated
                });
              
              if (upsertError) {
                console.error('Error upserting device:', upsertError);
                throw upsertError;
              }
              console.log('Device status updated successfully for:', deviceId);
            } catch (dbError) {
              console.error('Database operation failed:', dbError);
              ws.send(JSON.stringify({ 
                type: 'error', 
                error: 'Failed to update device status' 
              }));
            }
          }

          
          if (!clients.has(userId)) {
            clients.set(userId, new Set());
          }
          clients.get(userId).add(ws);
          console.log('Client added for user:', userId);
        } catch (error) {
          console.error('Authentication error:', error);
          ws.send(JSON.stringify({ 
            type: 'auth_error', 
            error: error.message || 'Invalid token or deviceId' 
          }));
          ws.close();
        }
      } else if (authenticated) {
        // Handle other message types (clipboard, ping, etc.)
        // ... (existing message handling code)
        if (data.type === 'clipboard') {
          console.log('Broadcasting clipboard content to other devices');
          // const userClients = clients.get(userId);
          // userClients.forEach((client) => {
          //   if (client !== ws && client.readyState === WebSocket.OPEN) { // Ensure we don't send to the sender
          //     client.send(JSON.stringify({ type: 'clipboard', content: data.content, contentId: data.contentId, deviceId })); // Include deviceId
          //   }
          // });
          
          // Get all subscriptions for this user
          const { data: subscriptions } = await supabase
            .from('push_subscriptions')
            .select('subscription')
            .eq('user_id', userId)
            .neq('device_id', deviceId);  // Don't send to the device that created the content

          if (subscriptions) {
            for (const sub of subscriptions) {
              try {
                // Use web-push for all subscriptions
                const result = await webpush.sendNotification(
                  sub.subscription,
                  JSON.stringify({
                    type: 'clipboard',
                    content: data.content,
                    contentId: data.contentId,
                    deviceId: deviceId,
                    timestamp: Date.now()
                  })
                );
              } catch (error) {
                console.error('Error sending push notification:', error);
                // If subscription is invalid, remove it
                if (error.statusCode === 410) {
                  await supabase
                    .from('push_subscriptions')
                    .delete()
                    .match({ subscription: sub.subscription });
                }
              }
            }
          }
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
