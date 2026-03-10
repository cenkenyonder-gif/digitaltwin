import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@google/genai';
import { google } from 'googleapis';

// 1. SETUP & PATHS
const PORT = process.env.PORT || 8080;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// 2. STATE
let systemPrompt = "You are a helpful AI assistant.";
let lastPromptUpdate = null;
let driveError = "Initializing...";
let driveClient = null;

// 3. INITIALIZE GEMINI CLIENT (Instant)
const genAI = createClient({ 
  apiKey: process.env.GEMINI_API_KEY 
});

// 4. INSTANT LISTEN
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ DIGITAL TWIN ONLINE: Listening on port ${PORT}`);
  initializeDrive();
});

// 5. DRIVE SYNC LOGIC
async function initializeDrive() {
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
    driveClient = google.drive({ version: 'v3', auth });
    
    // Initial sync
    await syncWithDrive();
    
    // Refresh every 5 mins
    setInterval(syncWithDrive, 5 * 60 * 1000);
  } catch (err) {
    console.error('💥 Drive Init Failure:', err.message);
    driveError = err.message;
  }
}

async function syncWithDrive() {
  if (!driveClient) return;
  try {
    const res = await driveClient.files.list({
      q: "name='system_instruction.txt' and trashed=false",
      fields: 'files(id, name, mimeType)',
      spaces: 'drive'
    });

    if (res.data.files?.length > 0) {
      const file = res.data.files[0];
      let data = '';
      if (file.mimeType === 'application/vnd.google-apps.document') {
        const exportRes = await driveClient.files.export({ fileId: file.id, mimeType: 'text/plain' });
        data = exportRes.data;
      } else {
        const getRes = await driveClient.files.get({ fileId: file.id, alt: 'media' });
        data = typeof getRes.data === 'string' ? getRes.data : '';
      }
      
      if (data.trim()) {
        systemPrompt = data.trim();
        lastPromptUpdate = new Date().toISOString();
        driveError = null;
        console.log('✅ Instructions synced from GDrive');
      }
    } else {
      driveError = "system_instruction.txt not found";
    }
  } catch (err) {
    driveError = err.message;
    console.error('❌ Drive Sync Error:', err.message);
  }
}

// 6. API ENDPOINTS
app.get('/api/health', (req, res) => res.status(200).send('OK'));

app.get('/api/status', (req, res) => {
  res.json({
    online: true,
    drive: { connected: !driveError, lastUpdate: lastPromptUpdate, error: driveError },
    gemini: { ready: !!genAI }
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    // Using the stable 2.0-flash model
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