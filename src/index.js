const express = require('express');
const { google } = require('googleapis');
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(express.json());

// Initialize the Google Gen AI SDK for Vertex AI
// This uses Application Default Credentials dynamically on Cloud Run
const ai = new GoogleGenAI({
  vertexai: {
    project: 'gen-lang-client-0993371584',
    location: 'europe-west4'
  }
});

// ---- Drive auth (compute service account) ----
const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/drive.readonly']
});
const drive = google.drive({ version: 'v3', auth });

let systemPrompt = '';

async function loadSystemPrompt() {
  try {
    const res = await drive.files.list({
      q: "name='system_instruction.txt' and trashed=false",
      fields: 'files(id, name)',
      spaces: 'drive'
    });
    if (!res.data.files.length) {
      console.log('system_instruction.txt not found in Drive. Will use default prompt.');
      return;
    }
    const fileId = res.data.files[0].id;
    const file = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
    let data = '';
    for await (const chunk of file.data) data += chunk;
    systemPrompt = data;
    console.log('✅ System prompt loaded from Drive');
  } catch (err) {
    console.error('Error loading system prompt from Drive:', err);
  }
}
loadSystemPrompt();

// ---- Vertex AI chat endpoint ----
app.post('/api/chat', async (req, res) => {
  try {
    const userMsg = req.body.message || '';
    if (!userMsg) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash',
      contents: userMsg,
      config: {
        systemInstruction: systemPrompt || "You are a helpful AI assistant."
      }
    });

    res.json({
      reply: response.text
    });
  } catch (err) {
    console.error('Vertex AI Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Cloud Run listening on ${PORT}`));
