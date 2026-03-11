import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { GoogleGenAI } from '@google/genai';

// ---------------------------------------------------------
// 🏗️ BOOT CONFIG
// ---------------------------------------------------------
const PORT = process.env.PORT || 8080;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ---------------------------------------------------------
// 🎭 CENK'S CORE PERSONA (Baking it in to ensure it's NEVER generic)
// ---------------------------------------------------------
const CENK_PERSONA_HEADER = `Sen Cenk Yönder'sin. Bu Senin Dijital İkizin.
Aşağıda verilen tüm biyografik veriler ve iletişim tarzı senin gerçek kimliğindir.
Cevaplarını her zaman samimi, doğal ve bu verilere dayanarak ver. 

BİYOGRAFİ VE İLETİŞİM TARZI:
7 Kasım 1984, Eskişehir doğumluyum. Marmara Üni. Geleneksel El Sanatları ve Grafik Sanatlar mezunuyum.
16 yıldır profesyonel hayatın içindeyim (Tasarımcı, Kreatif Direktör, Stratejist).
Hong Kong'da 2 yıl yaşadım. Disney, Star Wars, Marvel tutkunuyum. Kedilerim var.
Sarelle ve simit favorimdir. Çok acı ve gül suyu sevmem.
İletişim dilim samimidir: "Nabionuz be ya?", "Merci", "Hokay" gibi ifadeler kullanabilirim.

HİÇBİR ZAMAN BİR YAPAY ZEKA ASİSTANI OLDUĞUNU SÖYLEME, SEN CENK'SİN.`;

let systemPrompt = CENK_PERSONA_HEADER;
let lastPromptUpdate = null;
let driveError = "Yükleniyor...";
let genAI = null;

// ---------------------------------------------------------
// 🚀 INSTANT LISTEN
// ---------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🚀 DIGITAL TWIN ONLINE ON PORT ${PORT}`);
  console.log(`===============================================`);
});

// ---------------------------------------------------------
// 📦 GOOGLE SERVICES
// ---------------------------------------------------------
async function init() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      genAI = new GoogleGenAI(apiKey);
      console.log('✅ Gemini SDK v1.44 Initialized');
    }
  } catch (e) {
    console.error('❌ Gemini Init Error:', e.message);
  }

  // Drive sync
  syncWithDrive();
  setInterval(syncWithDrive, 5 * 60 * 1000);
}

async function syncWithDrive() {
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
    const drive = google.drive({ version: 'v3', auth });

    // Exhaustive search: Include shared with me and all drives
    const res = await drive.files.list({
      q: "name='system_instruction.txt' and trashed=false",
      fields: 'files(id, name, mimeType)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    });

    if (res.data.files && res.data.files.length > 0) {
      const file = res.data.files[0];
      let content = '';
      if (file.mimeType === 'application/vnd.google-apps.document') {
        const exportRes = await drive.files.export({ fileId: file.id, mimeType: 'text/plain' });
        content = exportRes.data;
      } else {
        const getRes = await drive.files.get({ fileId: file.id, alt: 'media' });
        content = typeof getRes.data === 'string' ? getRes.data : '';
      }
      
      if (content.trim()) {
        // Merge the core persona with the Drive content
        systemPrompt = `${CENK_PERSONA_HEADER}\n\nEK DETAYLAR:\n${content.trim()}`;
        lastPromptUpdate = new Date().toISOString();
        driveError = null;
        console.log('✅ Instructions synced from Drive');
      }
    } else {
      driveError = "File 'system_instruction.txt' not found";
    }
  } catch (err) {
    driveError = err.message;
    console.error('❌ GDrive Error:', err.message);
  }
}

init().catch(console.error);

// ---------------------------------------------------------
// 🛤️ ROUTES
// ---------------------------------------------------------

app.get('/api/status', (req, res) => {
  res.json({
    online: true,
    drive: { connected: !driveError, lastUpdate: lastPromptUpdate, error: driveError },
    gemini: { model: "gemini-2.5-flash", ready: !!genAI }
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message empty' });
    if (!genAI) return res.status(503).json({ error: 'System booting' });

    // RESTORED TO HIGH-LEVEL SDK Pattern (safest for systemInstruction)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt
    });

    const result = await model.generateContent(message);
    const response = await result.response;
    
    res.json({ reply: response.text() });

  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: { message: err.message } });
  }
});

app.get('/api/health', (req, res) => res.status(200).send('OK'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});