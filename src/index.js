const express = require('express');
const { google } = require('googleapis');
const app = express();
app.use(express.json());

// ---- Drive auth (compute service account) ----
const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/drive.readonly']
});
const drive = google.drive({ version: 'v3', auth });

let systemPrompt = '';

async function loadSystemPrompt() {
  const res = await drive.files.list({
    q: "name='system_instruction.txt' and trashed=false",
    fields: 'files(id, name)',
    spaces: 'drive'
  });
  if (!res.data.files.length) throw new Error('system_instruction.txt not found');
  const fileId = res.data.files[0].id;
  const file = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  let data = '';
  for await (const chunk of file.data) data += chunk;
  systemPrompt = data;
  console.log('✅ System prompt loaded from Drive');
}
loadSystemPrompt().catch(console.error);

// ---- Simple chat endpoint (replace with Vertex AI later) ----
app.post('/api/chat', (req, res) => {
  const userMsg = req.body.message || '';
  res.json({
    reply: `You said: ${userMsg}`,
    systemPromptSnippet: systemPrompt.slice(0, 120)
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Cloud Run listening on ${PORT}`));
