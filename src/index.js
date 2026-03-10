import express from 'express';
import { google } from 'googleapis';
import { createClient } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. FUNDAMENTAL SETUP
const PORT = process.env.PORT || 8080;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// 2. IMMEDIATE PORT BINDING (CRITICAL FOR CLOUD RUN)
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Node.js 24 Server running on port ${PORT}`);
});

// 3. HEALTH CHECK
app.get('/api/health', (req, res) => res.status(200).send('OK'));

// 4. LAZY AI & DRIVE INITIALIZATION
let systemPrompt = "You are a helpful AI assistant.";
let lastPromptUpdate = null;
let driveError = null;
let genAI = null;

async function initServices() {
  console.log('📦 Initializing Cloud Services...');
  
  // Initialize Gemini
  try {
    if (process.env.GEMINI_API_KEY) {
      genAI = createClient({ apiKey: process.env.GEMINI_API_KEY });
      console.log('✅ Gemini Client Ready');
    } else {
      console.error('❌ GEMINI_API_KEY is missing');
    }
  } catch (e) {
    console.error('❌ Gemini Init Error:', e.message);
  }

  // Initialize Drive Sync
  syncWithDrive();
  setInterval(syncWithDrive, 5 * 60 * 1000);
}

async function syncWithDrive() {
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
      console.log('✅ Instructions synced from Drive');
    } else {
      driveError = "File not found";
    }
  } catch (err) {
    driveError = err.message;
    console.error('❌ Drive Sync Error:', err.message);
  }
}

// Kick off initialization after the server has started
initServices();

// 5. API ROUTES
app.get('/api/status', (req, res) => {
  res.json({
    active: true,
    node_version: process.version,
    drive: { connected: !driveError, lastUpdate: lastPromptUpdate, error: driveError },
    gemini: { ready: !!genAI }
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    if (!genAI) return res.status(503).json({ error: 'AI Service currently starting up' });

    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: 'user', parts: [{ text: message }] }],
      systemInstruction: systemPrompt
    });

    res.json({ reply: result.response.text() });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: { message: err.message } });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});