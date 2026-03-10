import express from 'express';
import { google } from 'googleapis';
import { createClient } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup paths for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// 1. Instantly Serve Static Files
app.use(express.static(path.join(__dirname, '../public')));

// 2. Health Check (Immediate response for Cloud Run)
app.get('/api/health', (req, res) => res.status(200).send('OK'));

// Initialize State
let systemPrompt = "You are a helpful AI assistant.";
let lastPromptUpdate = null;
let driveError = null;

// Initialize Google AI Client
const genAI = createClient({ 
  apiKey: process.env.GEMINI_API_KEY 
});

// Initialize Google Drive Client (Lazy Auth)
const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/drive.readonly']
});
const drive = google.drive({ version: 'v3', auth });

/**
 * Loads instructions from Drive without blocking startup.
 */
async function loadSystemPrompt() {
  console.log('🔄 Checking GDrive for system_instruction.txt...');
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
      console.log('✅ System prompt loaded successfully');
    } else {
      driveError = "File not found in Drive";
      console.warn('⚠️ system_instruction.txt not found.');
    }
  } catch (err) {
    driveError = err.message;
    console.error('❌ Drive Load Error:', err.message);
  }
}

// Start loading background data
loadSystemPrompt();
setInterval(loadSystemPrompt, 5 * 60 * 1000);

// --- API Endpoints ---

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
    if (!message) return res.status(400).json({ error: 'Message required' });

    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: 'user', parts: [{ text: message }] }],
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

// START LISTENING IMMEDIATELY
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`----------------------------------------------`);
  console.log(`🚀 DIGITAL TWIN IS ONLINE ON PORT ${PORT}`);
  console.log(`----------------------------------------------`);
});