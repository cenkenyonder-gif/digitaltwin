import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
// 🎭 CENK'S IDENTITY (HARDCODED FULL PERSONA)
// ---------------------------------------------------------
const CENK_IDENTITY_FULL = `Sen Cenk Yönder'sin. Bu senin dijital ikizin. 
Aşağıdaki tüm veriler ve iletişim tarzı senin gerçek kimliğindir. 
Bir yapay zeka olduğunu asla söyleme. Her zaman Cenk olarak konuş.

BİYO-VERİLER:
- 7 Kasım 1984, Eskişehir doğumlu. Marmara Üni. Geleneksel Türk El Sanatları ve Grafik Sanatlar (Çift Anadal).
- 16 yıllık profesyonel (Tasarımcı, Kreatif Direktör, Stratejist). Hong Kong (2014-2016).
- İlgi: Disney, Pixar, Marvel, Harry Potter, Dune, LEGO, GarageBand ile müzik, Kediler.
- Yemek: Simit, vanilyalı dondurma, Sarelle. Gül suyu ve sütlaç sevmez.

STİL:
- Samimi, "Nabionuz be ya?", "Merci", "Hokay", "Hahahaha".
- Aileye (John/Cengo) düşkün. 
- Teknik uzmanlık (Tasarım/Grafik).

HER CEVABINDA CENK YÖNDER OLARAK DAVRAN.`;

let driveIdentity = "";
let lastPromptUpdate = null;
let driveError = "Yükleniyor...";
let genAI = null;

// ---------------------------------------------------------
// 🚀 INSTANT LISTEN (Essential for Cloud Run Health Checks)
// ---------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🚀 DIGITAL TWIN (CENK MODE) ONLINE ON PORT ${PORT}`);
  console.log(`===============================================`);
});

// ---------------------------------------------------------
// 📦 GOOGLE CLIENT INITIALIZATION
// ---------------------------------------------------------
async function init() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      // Using stable SDK
      genAI = new GoogleGenerativeAI(apiKey);
      console.log('✅ Gemini (Stable SDK) Ready');
    }
  } catch (e) {
    console.error('❌ SDK Error:', e.message);
  }

  syncWithDrive();
  setInterval(syncWithDrive, 5 * 60 * 1000);
}

async function syncWithDrive() {
  console.log('🔍 Syncing identity from Drive...');
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
    const drive = google.drive({ version: 'v3', auth });

    const res = await drive.files.list({
      q: "name='system_instruction.txt' and trashed=false",
      fields: 'files(id, name, mimeType)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    });

    if (res.data.files?.length > 0) {
      const file = res.data.files[0];
      let data = '';
      if (file.mimeType === 'application/vnd.google-apps.document') {
        const exportRes = await drive.files.export({ fileId: file.id, mimeType: 'text/plain' });
        data = exportRes.data;
      } else {
        const getRes = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'text' });
        data = typeof getRes.data === 'string' ? getRes.data : '';
      }
      
      if (data && data.trim()) {
        driveIdentity = data.trim();
        lastPromptUpdate = new Date().toISOString();
        driveError = null;
        console.log('✅ Drive Identity Updated');
      }
    } else {
      driveError = "File 'system_instruction.txt' not found";
    }
  } catch (err) {
    driveError = err.message;
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
    gemini: { 
      model: "gemini-3.1-flash-lite-preview", // UPDATED: Official ID for Gemini 3.1 Flash Lite
      ready: !!genAI 
    }
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    if (!genAI) return res.status(503).json({ error: 'AI not ready' });

    console.log('💬 Chatting as Cenk Yönder via Gemini 3.1 Flash Lite Preview...');

    const fullPrompt = `${CENK_IDENTITY_FULL}\n\nEK BİLGİLER (Drive):\n${driveIdentity}`;

    // Stable SDK Pattern: getGenerativeModel
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-flash-lite-preview", // UPDATED: Official ID for Gemini 3.1 Flash Lite
      systemInstruction: fullPrompt
    });

    const result = await model.generateContent(message);
    const response = await result.response;
    const replyText = response.text();

    res.json({ reply: replyText });

  } catch (err) {
    console.error('Chat API Error:', err);
    res.status(500).json({ error: { message: err.message } });
  }
});

app.get('/api/health', (req, res) => res.status(200).send('OK'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});