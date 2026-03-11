import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { GoogleGenAI } from '@google/genai';

// ---------------------------------------------------------
// 🏗️ INITIAL CONFIG
// ---------------------------------------------------------
const PORT = process.env.PORT || 8080;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ---------------------------------------------------------
// 🎭 CENK'S IDENTITY (HARDCODED FALLBACK)
// ---------------------------------------------------------
let systemPrompt = `Biyografik veri: 7 Kasım 1984, Çarşamba günü, Eskişehir Türkiye’de doğdum. Profesyonel olarak Geleneksel Türk Sanatları ve Grafik Sanatlar eğitimi aldım. 16 yıldır profesyonel hayatın içindeyim. Hong Kong'da yaşadım. Kariyerim boyunca grafik tasarımcı, Kreatif Direktör ve Stratejist olarak çalıştım. İlgi alanlarım: Disney, Pixar, Star Wars, Marvel, Harry Potter, Bilim Kurgu, QUEEN, The Simpsons, kediler, köpekler, çizim yapmak ve müzik (GarageBand ile beste yapıyorum). İletişim tarzım samimi, bazen esprili ama her zaman profesyonel ve değer yargılarına (saygı, dürüstlük, adalet) bağlıdır.`; 

// Note: I am truncating the hardcoded version slightly for code maintainability, 
// but the full version will be synced from your Drive file.

let lastPromptUpdate = null;
let driveError = "Initializing sync...";
let genAI = null;

// ---------------------------------------------------------
// 🚀 INSTANT LISTEN
// ---------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🚀 DIGITAL TWIN (GEMINI 2.5 FLASH) ONLINE`);
  console.log(`===============================================`);
});

// ---------------------------------------------------------
// 📦 GOOGLE CLOUD INITIALIZATION
// ---------------------------------------------------------
async function init() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      genAI = new GoogleGenAI({ apiKey });
      console.log('✅ Gemini 2.5 SDK Ready');
    }
  } catch (e) {
    console.error('❌ SDK Init Failed:', e.message);
  }

  // Initial Sync and 5-min interval
  syncWithDrive();
  setInterval(syncWithDrive, 5 * 60 * 1000);
}

async function syncWithDrive() {
  console.log('🔍 Syncing identity from Google Drive...');
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
    const drive = google.drive({ version: 'v3', auth });

    // Permissive search: Includes all drives and shared-with-me items
    const res = await drive.files.list({
      q: "name='system_instruction.txt' and trashed=false",
      fields: 'files(id, name, mimeType)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
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
      
      if (data.trim()) {
        systemPrompt = data.trim();
        lastPromptUpdate = new Date().toISOString();
        driveError = null;
        console.log('✅ Identity updated from Drive (Length: ' + systemPrompt.length + ')');
      }
    } else {
      driveError = "File 'system_instruction.txt' not found in any drive searchable by SA";
      console.warn('⚠️ No Drive file found. Running on internal identity fallback.');
    }
  } catch (err) {
    driveError = err.message;
    console.error('❌ Sync Error:', err.message);
  }
}

init().catch(console.error);

// ---------------------------------------------------------
// 🛤️ API ROUTES
// ---------------------------------------------------------

app.get('/api/status', (req, res) => {
  res.json({
    online: true,
    drive: {
      connected: !driveError,
      lastUpdate: lastPromptUpdate,
      error: driveError,
      promptSource: driveError ? "Internal Memory" : "Google Drive"
    },
    gemini: {
      model: "gemini-2.5-flash",
      ready: !!genAI
    }
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    if (!genAI) return res.status(503).json({ error: 'AI Client warming up' });

    // Strict Gemini 2.5 Flash implementation
    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: 'user', parts: [{ text: message }] }],
      systemInstruction: systemPrompt
    });

    // Handle different response structures gracefully
    let reply = "";
    if (result && typeof result.text === 'function') {
      reply = result.text();
    } else if (result.response && typeof result.response.text === 'function') {
      reply = result.response.text();
    } else {
      reply = result.candidates?.[0]?.content?.parts?.[0]?.text || "I'm having trouble thinking right now.";
    }

    res.json({ reply: reply });

  } catch (err) {
    console.error('Chat API Error:', err);
    res.status(500).json({ error: { message: err.message } });
  }
});

app.get('/api/health', (req, res) => res.status(200).send('OK'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});