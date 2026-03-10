import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { GoogleGenAI } from '@google/genai';

// ---------------------------------------------------------
// 🏗️ BOOT CONFIG
// ---------------------------------------------------------
const PORT = process.env.PORT || 8080;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ---------------------------------------------------------
// 🚀 INSTANT LISTEN
// ---------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`✅ DIGITAL TWIN ONLINE ON PORT ${PORT}`);
  console.log(`Model: Gemini 2.5 Flash`);
  console.log(`===============================================`);
});

// Health check
app.get('/api/health', (req, res) => res.status(200).send('OK'));

// ---------------------------------------------------------
// 🛡️ STATE & INITIALIZATION
// ---------------------------------------------------------
let systemPrompt = "You are a helpful AI assistant.";
let lastPromptUpdate = null;
let driveError = "Initializing...";
let genAI = null;

async function init() {
  console.log('🔄 Initializing API Clients...');
  
  // 1. Initialize Gemini SDK (Targeting 2.5-Flash)
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      genAI = new GoogleGenAI({ apiKey });
      console.log('✨ Gemini SDK Client Ready');
    } else {
      console.error('⚠️ GEMINI_API_KEY is missing');
    }
  } catch (e) {
    console.error('❌ SDK Init Failed:', e.message);
  }

  // 2. Drive Sync Setup
  syncWithDrive();
  setInterval(syncWithDrive, 5 * 60 * 1000);
}

async function syncWithDrive() {
  console.log('🔍 Syncing instructions from GDrive...');
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
      
      systemPrompt = data.trim() || systemPrompt;
      lastPromptUpdate = new Date().toISOString();
      driveError = null;
      console.log('✅ Synchronization Successful');
    } else {
      driveError = "File 'system_instruction.txt' not found";
      console.warn('⚠️ GDrive file missing, using defaults');
    }
  } catch (err) {
    driveError = err.message;
    console.error('❌ Drive Error:', err.message);
  }
}

// Start background init
init().catch(err => console.error('🔥 Init Error:', err));

// ---------------------------------------------------------
// 🛤️ ROUTES
// ---------------------------------------------------------

app.get('/api/status', (req, res) => {
  res.json({
    online: true,
    drive: {
      connected: !driveError,
      lastUpdate: lastPromptUpdate,
      error: driveError
    },
    gemini: {
      model: "gemini-2.5-flash",
      ready: !!genAI
    }
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    if (!genAI) return res.status(503).json({ error: 'AI Client warming up' });

    // Re-implemented per user request: Gemini 2.5-Flash
    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
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