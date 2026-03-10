import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { GoogleGenAI } from '@google/genai';

// ---------------------------------------------------------
// 🏗️ INITIAL SETUP
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
  console.log(`===============================================`);
});

app.get('/api/health', (req, res) => res.status(200).send('OK'));

// ---------------------------------------------------------
// 🛡️ STATE & GOOGLE SERVICES
// ---------------------------------------------------------
let systemPrompt = "You are a helpful AI assistant.";
let lastPromptUpdate = null;
let driveError = "Initializing...";
let genAI = null;

async function init() {
  // 1. Initialize Gemini SDK (Pattern for v1.44+)
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      genAI = new GoogleGenAI({ apiKey });
      console.log('✨ Gemini SDK Ready');
    }
  } catch (e) {
    console.error('❌ SDK Init Failed:', e.message);
  }

  // 2. Initial Drive Sync
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
      console.log('✅ Synchronized with Google Drive');
    } else {
      driveError = "File not found";
      console.warn('⚠️ File missing, using defaults');
    }
  } catch (err) {
    driveError = err.message;
    console.error('❌ Drive Sync Error:', err.message);
  }
}

// Background startup
init().catch(console.error);

// ---------------------------------------------------------
// 🛤️ ROUTES & CHAT
// ---------------------------------------------------------

app.get('/api/status', (req, res) => {
  res.json({
    online: true,
    // Unified with frontend expectation
    drive: {
      connected: !driveError,
      lastUpdate: lastPromptUpdate,
      error: driveError
    }
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    if (!genAI) return res.status(503).json({ error: 'AI Client warming up' });

    // Official @google/genai v1.44 Pattern:
    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: message }] }],
      systemInstruction: systemPrompt
    });

    res.json({ reply: result.response.text() });

  } catch (err) {
    console.error('Chat Error:', err);
    res.status(500).json({ error: { message: err.message } });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});