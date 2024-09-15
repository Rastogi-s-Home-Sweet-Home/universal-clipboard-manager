const express = require('express');
const cors = require('cors');
const session = require('express-session');

const app = express();

// CORS configuration
app.use(cors({
  origin: 'http://localhost:3006',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Enable pre-flight requests for all routes
app.options('*', cors());

// Session configuration
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // set to true if using https
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Parse JSON bodies
app.use(express.json());

// Your routes go here
// ...

const http = require('http');
const server = http.createServer(app);

// WebSocket setup (if you're using socket.io)
const io = require('socket.io')(server, {
  cors: {
    origin: 'http://localhost:3006',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }
});

// ... rest of your WebSocket setup

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});