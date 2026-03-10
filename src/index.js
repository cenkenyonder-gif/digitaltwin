import express from 'express';
import { google } from 'googleapis';
import { createClient } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. CONSTANTS & PATHS
const PORT = process.env.PORT || 8080;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 2. IMMEDIATE MIDDLEWARE & LISTEN
// We start listening BEFORE we do any heavy AI/Drive initialization
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is live on port ${PORT}`);
});

// 3. HEALTH CHECK (Instant response)
app.get('/api/health', (req, res) => res.status(200).send('OK'));

// 4. INITIALIZE STATE & SERVICES
let systemPrompt = "You are a helpful AI assistant.";
let lastPromptUpdate = null;
let driveError = null;

// Wrap initialization in a try/catch to prevent startup crashes
let genAI;
try {
  genAI = createClient({ apiKey: process.env.GEMINI_API_KEY });
  console.log('✅ Gemini client initialized');
} catch (e) {
  console.error('❌ Failed to initialize Gemini API:', e.message);
}

const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/drive.readonly']
});
const drive = google.drive({ version: 'v3', auth });

/**
 * Loads instructions from Drive without blocking.
 */
async function loadSystemPrompt() {
  console.log('🔄 Syncing with Google Drive...');
  try {
    const res = await drive.files.list({
      q: "name='system_instruction.txt' and trashed=false",
      fields: 'files(id, name, mimeType)',
      spaces: 'drive'
    });

    if (res.data.files && res.data.files.length > 0) {
      const file = res.data.files[0];
      let data = '';
      
      if (file.mimeType === 'application/vnd.google-apps.document') {
        const exportRes = await drive.files.export({
          fileId: file.id,
          mimeType: 'text/plain'
        });
        data = exportRes.data;
      } else {
        const getRes = await drive.files.get({ fileId: file.id, alt: 'media' });
        data = typeof getRes.data === 'string' ? getRes.data : '';
      }
      
      systemPrompt = data.trim() || systemPrompt;
      lastPromptUpdate = new Date().toISOString();
      driveError = null;
      console.log('✅ System instructions synced');
    } else {
      driveError = "system_instruction.txt not found";
    }
  } catch (err) {
    driveError = err.message;
    console.error('❌ Drive Error:', err.message);
  }
}

// Background Task
loadSystemPrompt();
setInterval(loadSystemPrompt, 5 * 60 * 1000);

// 5. API ROUTES
app.get('/api/status', (req, res) => {
  res.json({
    online: true,
    drive: { connected: !driveError, lastUpdate: lastPromptUpdate, error: driveError },
    gemini: { configured: !!process.env.GEMINI_API_KEY }
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Empty message' });
    if (!genAI) return res.status(500).json({ error: 'AI Client not ready' });

    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: 'user', parts: [{ text: message }] }],
      systemInstruction: systemPrompt
    });

    res.json({ reply: result.response.text() });
  } catch (err) {
    console.error('Chat API Error:', err);
    res.status(500).json({ error: { message: err.message } });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});