import express from 'express';
import { google } from 'googleapis';
import { createClient } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

// Use the modern "Gen AI" SDK
const genAI = createClient({ 
  apiKey: process.env.GEMINI_API_KEY 
});

// Use Application Default Credentials (ADC) for Google Drive
const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/drive.readonly']
});
const drive = google.drive({ version: 'v3', auth });

let systemPrompt = "You are a helpful AI assistant.";
let lastPromptUpdate = null;
let driveError = null;

/**
 * Loads the system instruction from Google Drive.
 */
async function loadSystemPrompt() {
  try {
    const res = await drive.files.list({
      q: "name='system_instruction.txt' and trashed=false",
      fields: 'files(id, name, mimeType)',
      spaces: 'drive'
    });

    if (res.data.files && res.data.files.length > 0) {
      const file = res.data.files[0];
      const fileId = file.id;
      const mimeType = file.mimeType;
      
      let data = '';
      
      if (mimeType === 'application/vnd.google-apps.document') {
        const exportRes = await drive.files.export({
          fileId: fileId,
          mimeType: 'text/plain'
        });
        data = exportRes.data;
      } else {
        const getRes = await drive.files.get({ fileId, alt: 'media' });
        if (typeof getRes.data === 'string') {
          data = getRes.data;
        } else {
          // Stream handling
          for await (const chunk of getRes.data) data += chunk;
        }
      }
      
      systemPrompt = data.trim();
      lastPromptUpdate = new Date().toISOString();
      driveError = null;
      console.log('✅ System prompt loaded from GDrive');
    } else {
      driveError = "File 'system_instruction.txt' not found in Drive";
      console.warn('⚠️ system_instruction.txt not found. Using default.');
    }
  } catch (err) {
    driveError = err.message;
    console.error('❌ Drive Error:', err.message);
  }
}

// Initial load on startup (don't await so we can start listening immediately)
loadSystemPrompt().catch(err => console.error('Startup Drive Error:', err));

// Refresh the prompt every 5 minutes
setInterval(loadSystemPrompt, 5 * 60 * 1000);

// --- API Endpoints ---

app.get('/api/health', (req, res) => res.send('OK'));

app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    drive: {
      connected: !driveError,
      error: driveError,
      lastUpdate: lastPromptUpdate
    },
    gemini: {
      model: "gemini-2.0-flash",
      configured: !!process.env.GEMINI_API_KEY
    },
    prompt_preview: systemPrompt.substring(0, 100) + '...'
  });
});

app.post('/api/refresh', async (req, res) => {
  await loadSystemPrompt();
  res.json({ success: true, updated: lastPromptUpdate });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    // Modern @google/genai SDK pattern
    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: 'user', parts: [{ text: message }] }],
      systemInstruction: systemPrompt
    });

    res.json({ reply: result.response.text() });

  } catch (err) {
    console.error('Gemini Error:', err);
    res.status(500).json({ 
      error: {
        message: err.message,
        details: err.statusText || 'Internal Error'
      }
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = parseInt(process.env.PORT) || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Digital Twin Cloud-Service (ESM) listening on port ${PORT}`);
});