import express from 'express';
import { google } from 'googleapis';
import { createClient } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------
// 🔥 ERROR TRAPPING (CRITICAL FOR CLOUD RUN)
// ---------------------------------------------------------
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION:', err);
  // We don't exit immediately to let Cloud Run see the log
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED REJECTION:', reason);
});

// ---------------------------------------------------------
// 🏗️ SERVER SETUP
// ---------------------------------------------------------
const PORT = process.env.PORT || 8080;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ---------------------------------------------------------
// 🚀 INSTANT LISTEN (Satisfies Health Check)
// ---------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`✅ Server is BOOTED and LISTENING on port ${PORT}`);
  console.log(`Node Version: ${process.version}`);
  console.log(`Env: ${process.env.NODE_ENV}`);
  console.log(`===============================================`);
});

// Health check endpoint
app.get('/api/health', (req, res) => res.status(200).send('OK'));

// ---------------------------------------------------------
// 📦 SERVICE INITIALIZATION (In order, with safe guards)
// ---------------------------------------------------------
let systemPrompt = "You are a helpful AI assistant.";
let lastPromptUpdate = null;
let driveError = null;
let genAI = null;

async function init() {
  console.log('🔄 Initializing API Clients...');
  
  // 1. Gemini Client
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      genAI = createClient({ apiKey });
      console.log('✨ Gemini Client Ready');
    } else {
      console.error('⚠️ GEMINI_API_KEY is missing in environment');
    }
  } catch (e) {
    console.error('❌ Gemini Init Error:', e.message);
  }

  // 2. Initial Drive Sync
  await syncWithDrive();
  
  // 3. Setup Recurring Sync
  setInterval(syncWithDrive, 5 * 60 * 1000);
}

async function syncWithDrive() {
  console.log('🔍 Checking Google Drive for instructions...');
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
    const drive = google.drive({ version: 'v3', auth });

    const res = await drive.files.list({
      q: "name='system_instruction.txt' and trashed=false",
      fields: 'files(id, name, mimeType)',
      spaces: 'drive'
    });

    if (res.data.files && res.data.files.length > 0) {
      const file = res.data.files[0];
      let data = '';
      if (file.mimeType === 'application/vnd.google-apps.document') {
        const exportRes = await drive.files.export({ fileId: file.id, mimeType: 'text/plain' });
        data = exportRes.data;
      } else {
        const getRes = await drive.files.get({ fileId: file.id, alt: 'media' });
        data = typeof getRes.data === 'string' ? getRes.data : '';
      }
      
      if (data.trim()) {
        systemPrompt = data.trim();
        lastPromptUpdate = new Date().toISOString();
        driveError = null;
        console.log('✅ Instructions synced (Length: ' + systemPrompt.length + ')');
      }
    } else {
      driveError = "system_instruction.txt not found";
      console.warn('⚠️ File not found in Drive, using default prompt.');
    }
  } catch (err) {
    driveError = err.message;
    console.error('❌ Drive Error:', err.message);
  }
}

// Start async init (doesn't block the listen command)
init().catch(err => console.error('🔥 CRITICAL INIT FAILURE:', err));

// ---------------------------------------------------------
// 🛤️ ROUTES
// ---------------------------------------------------------

app.get('/api/status', (req, res) => {
  res.json({
    active: true,
    drive: { connected: !driveError, lastUpdate: lastPromptUpdate, error: driveError },
    gemini: { ready: !!genAI }
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    if (!genAI) return res.status(503).json({ error: 'AI Client warming up' });

    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: 'user', parts: [{ text: message }] }],
      systemInstruction: systemPrompt
    });

    res.json({ reply: result.response.text() });
  } catch (err) {
    console.error('Chat API Error:', err);
    res.status(500).json({ error: { message: err.message, status: err.status } });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});