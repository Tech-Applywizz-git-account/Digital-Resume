import express from 'express';
import cors from 'cors';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// --- Supabase setup ---
// Use Vercel environment variables or fallback to local development
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Ensure we have the required environment variables
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey
);

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Your Microsoft 365 credentials
// Use Vercel environment variables or fallback to local development
export const MS365_CONFIG = {
  tenantId: process.env.VITE_TENANT_ID || process.env.TENANT_ID,
  clientId: process.env.VITE_CLIENT_ID || process.env.CLIENT_ID,
  clientSecret: process.env.VITE_CLIENT_SECRET || process.env.CLIENT_SECRET,
  senderEmail: process.env.VITE_SENDER_EMAIL || process.env.SENDER_EMAIL,
};

let accessToken = null;
let tokenExpiry = null;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from React build
app.use(express.static(path.join(__dirname, 'dist')));

async function getAccessToken() {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  try {
    console.log('🔄 Getting Microsoft Graph access token...');
    const tokenUrl = `https://login.microsoftonline.com/${MS365_CONFIG.tenantId}/oauth2/v2.0/token`;
    
    const params = new URLSearchParams();
    params.append('client_id', MS365_CONFIG.clientId);
    params.append('client_secret', MS365_CONFIG.clientSecret);
    params.append('scope', 'https://graph.microsoft.com/.default');
    params.append('grant_type', 'client_credentials');

    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    accessToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in * 1000);
    
    console.log('✅ Access token obtained successfully');
    return accessToken;
  } catch (error) {
    console.error('❌ Failed to get access token:', error.response?.data || error.message);
    throw new Error('Microsoft 365 authentication failed');
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'careercast Email Service',
    timestamp: new Date().toISOString()
  });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// For Vercel, we export the app as a handler
// For local development, we start the server
const PORT = process.env.PORT || 3000;

// Export for Vercel serverless functions
export default app;

// Start server for local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 careercast Server running on port ${PORT}`);
    console.log(`📧 Email service ready`);
    console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  });
}
