import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. FAST-PATH SETUP
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
let geminiReady = false;
let genAI = null;
let driveClient = null;

// 3. INSTANT LISTEN (Satisfies Cloud Run Health Checks immediately)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 INSTANT-BOOT: Server listening on port ${PORT}`);
  // Start heavy initialization in the background
  initializeCloudServices();
});

// 4. HEALTH CHECK
app.get('/api/health', (req, res) => res.status(200).send('OK'));

// 5. BACKGROUND INITIALIZATION (Dynamic Imports)
async function initializeCloudServices() {
  console.log('📦 Cold-start: Loading heavy libraries...');
  try {
    // Dynamically load heavy SDKs to prevent startup timeouts
    const { createClient } = await import('@google/genai');
    const { google } = await import('googleapis');

    console.log('✅ SDKs loaded. Configuring clients...');

    // Init Gemini
    if (process.env.GEMINI_API_KEY) {
      genAI = createClient({ apiKey: process.env.GEMINI_API_KEY });
      geminiReady = true;
      console.log('✨ Gemini Client Ready');
    }

    // Init Drive
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
    driveClient = google.drive({ version: 'v3', auth });
    
    // Initial sync
    syncWithDrive();
    setInterval(syncWithDrive, 5 * 60 * 1000);

  } catch (err) {
    console.error('💥 Background Init Failure:', err.message);
    driveError = "Initialization failed: " + err.message;
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
      systemPrompt = data.trim() || systemPrompt;
      lastPromptUpdate = new Date().toISOString();
      driveError = null;
      console.log('✅ Drive instructions refreshed');
    } else {
      driveError = "File not found in Drive";
    }
  } catch (err) {
    driveError = err.message;
    console.error('❌ Drive Sync Error:', err.message);
  }
}

// 6. API ROUTES
app.get('/api/status', (req, res) => {
  res.json({
    online: true,
    drive: { connected: !driveError, lastUpdate: lastPromptUpdate, error: driveError },
    gemini: { ready: geminiReady }
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    if (!genAI) return res.status(503).json({ error: 'AI Service still booting...' });

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