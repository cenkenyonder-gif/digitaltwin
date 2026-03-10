const express = require('express');
const { google } = require('googleapis');
const { GoogleGenAI } = require('@google/genai');
const path = require('path');

const app = express();
app.use(express.json());

// Serve static files from the 'public' directory (Cloud-Native Frontend)
app.use(express.static(path.join(__dirname, '../public')));

// Use API Key for Gemini (from Cloud Run Env Vars)
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

// Use Application Default Credentials (ADC) for Google Drive
// On Cloud Run, this uses the Service Account assigned to the service
const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/drive.readonly']
});
const drive = google.drive({ version: 'v3', auth });

let systemPrompt = "You are a helpful AI assistant.";
let lastPromptUpdate = null;
let driveError = null;

/**
 * Loads the system instruction from Google Drive.
 * This allows "All files on Cloud/GDrive" control.
 */
async function loadSystemPrompt() {
  try {
    const res = await drive.files.list({
      q: "name='system_instruction.txt' and trashed=false",
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (res.data.files && res.data.files.length > 0) {
      const fileId = res.data.files[0].id;
      // Fetching media content directly
      const file = await drive.files.get({ fileId, alt: 'media' });
      
      // Handle both stream and direct data (depends on environment)
      let data = '';
      if (typeof file.data === 'string') {
        data = file.data;
      } else {
        // Fallback for stream
        for await (const chunk of file.data) data += chunk;
      }
      
      systemPrompt = data.trim();
      lastPromptUpdate = new Date().toISOString();
      driveError = null;
      console.log('✅ System prompt updated from GDrive');
    } else {
      driveError = "File 'system_instruction.txt' not found in Drive";
      console.warn('⚠️ system_instruction.txt not found. Using default.');
    }
  } catch (err) {
    driveError = err.message;
    console.error('❌ Drive Auth Error:', err.message);
  }
}

// Initial load on startup
loadSystemPrompt();

// Refresh the prompt every 5 minutes automatically
setInterval(loadSystemPrompt, 5 * 60 * 1000);

// --- API Endpoints ---

// Health check for Cloud Run
app.get('/api/health', (req, res) => res.send('OK'));

// Status check to debug Drive/Gemini in the cloud
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    drive: {
      connected: !driveError,
      error: driveError,
      lastUpdate: lastPromptUpdate
    },
    gemini: {
      model: "gemini-2.0-flash", // Using stable for reliability
      configured: !!process.env.GEMINI_API_KEY
    },
    prompt_preview: systemPrompt.substring(0, 100) + '...'
  });
});

// Manual refresh trigger
app.post('/api/refresh', async (req, res) => {
  await loadSystemPrompt();
  res.json({ success: true, updated: lastPromptUpdate });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    // In 2026, 2.0-flash is the highly stable choice, but we can use 2.5-flash if preferred.
    // I'll use the precise model name format.
    const modelName = "gemini-2.0-flash"; 
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt
    });

    const result = await model.generateContent(message);
    const response = await result.response;
    res.json({ reply: response.text() });

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

// Catch-all to serve index.html for any other route (SPA style)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Digital Twin Cloud-Service running on port ${PORT}`);
});