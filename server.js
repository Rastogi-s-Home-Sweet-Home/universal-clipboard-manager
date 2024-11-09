require('dotenv').config();

const express = require('express');
const http = require('http');
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

// Add new endpoint for sending clipboard data
app.post('/api/clipboard', verifyToken, async (req, res) => {
  const { content, contentId } = req.body;
  const userId = req.user.sub;
  const deviceId = req.body.deviceId || `mobile-${Date.now()}`; // Add fallback for mobile

  console.log('Received clipboard request:', {
    userId,
    deviceId,
    contentId,
    contentPreview: content.substring(0, 50)
  });

  try {
    // Get all subscriptions for this user except the sending device
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('subscription, device_id')
      .eq('user_id', userId)
      .neq('device_id', deviceId);

    console.log(`Found ${subscriptions?.length || 0} subscriptions to notify`);

    if (subscriptions) {
      // Send push notifications to all subscribed devices
      for (const sub of subscriptions) {
        try {
          const payload = JSON.stringify({
            type: 'clipboard',
            content: content,
            contentId: contentId,
            deviceId: deviceId, // This will now have a value
            timestamp: Date.now()
          });
          
          console.log(`Sending notification to device: ${sub.device_id}`);
          await webpush.sendNotification(sub.subscription, payload);
        } catch (error) {
          console.error(`Error sending push notification to ${sub.device_id}:`, error);
          // If subscription is invalid, remove it
          if (error.statusCode === 410) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .match({ subscription: sub.subscription });
            console.log(`Removed invalid subscription for device ${sub.device_id}`);
          }
        }
      }
    }

    res.status(200).json({ 
      message: 'Clipboard content sent successfully',
      deviceId: deviceId, // Return the deviceId used
      recipientCount: subscriptions?.length || 0
    });
  } catch (error) {
    console.error('Error sending clipboard content:', error);
    res.status(500).json({ error: 'Failed to send clipboard content' });
  }
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
