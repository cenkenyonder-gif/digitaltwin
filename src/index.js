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
// 🎭 CENK'S IDENTITY (HARDCODED MASTER)
// ---------------------------------------------------------
const CENK_IDENTITY_BASE = `Sen Cenk Yönder'sin. Bu senin dijital ikizin. 
Aşağıdaki bilgiler senin gerçek kimliğindir, hayatındır ve karakterindir. 
Bir yapay zeka olduğunu asla söyleme. Her zaman Cenk olarak konuş.

HAYAT HİKAYEN:
- 7 Kasım 1984'te Eskişehir'de doğdun. İstanbul Acıbadem'de büyüdün.
- Marmara Üni. Geleneksel Türk El Sanatları ve Grafik Sanatlar mezunusun (Çift Anadal).
- 16 yıldır profesyonel dünyadasın (Tasarımcı, Kreatif Direktör, Stratejist).
- 2014-2016 arası Hong Kong'da yaşadın.
- İlgi alanların: Star Wars, Marvel, Harry Potter, Dune, LEGO (Cobi), Cizim yapmak, GarageBand ile müzik yapmak.
- Yemek: Simit, vanilyalı dondurma ve Sarelle seversin. Çok acı ve gül suyu sevmezsin.

İLETİŞİM TARZIN:
- Samimi, "Nabionuz be ya?", "Merci", "Hokay", "Hahahaha" gibi ifadeler kullanırsın.
- Teknolojiyi ve tasarımı çok iyi biliyorsun.
- Ailen ve arkadaşların (özellikle abin John/Cengo) senin için çok önemli.
- Cevapların doğal ve akışkan olmalı.`;

let driveIdentity = "";
let lastPromptUpdate = null;
let driveError = "Yükleniyor...";
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
// 📦 GOOGLE CLIENT INITIALIZATION
// ---------------------------------------------------------
async function init() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      // Correct constructor for @google/genai (unified SDK)
      genAI = new GoogleGenAI({ apiKey });
      console.log('✅ Gemini Client Initialized');
    }
  } catch (e) {
    console.error('❌ SDK Error:', e.message);
  }

  syncWithDrive();
  setInterval(syncWithDrive, 5 * 60 * 1000);
}

async function syncWithDrive() {
  console.log('🔍 Identity Syncing with Drive...');
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
        data = getRes.data;
      }
      
      if (data && data.trim()) {
        driveIdentity = data.trim();
        lastPromptUpdate = new Date().toISOString();
        driveError = null;
        console.log('✅ Updated Identity from Drive');
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
    gemini: { model: "gemini-2.5-flash", ready: !!genAI }
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    if (!genAI) return res.status(503).json({ error: 'AI warming up' });

    // Combine baked-in identity with drive updates
    const fullPrompt = `${CENK_IDENTITY_BASE}\n\nEK BİLGİLER:\n${driveIdentity}`;

    // Pattern for @google/genai (Unified SDK)
    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: 'user', parts: [{ text: message }] }],
      systemInstruction: fullPrompt
    });

    // In @google/genai, the response is at the root
    let replyText = "";
    if (result && typeof result.text === 'function') {
      replyText = result.text();
    } else if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
      replyText = result.candidates[0].content.parts[0].text;
    } else {
      console.warn('Unexpected structure:', JSON.stringify(result));
      replyText = "Şu an kafam biraz karışık, tekrar sorar mısın?";
    }

    res.json({ reply: replyText });

  } catch (err) {
    console.error('Chat Error:', err);
    res.status(500).json({ error: { message: err.message } });
  }
});

app.get('/api/health', (req, res) => res.status(200).send('OK'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});