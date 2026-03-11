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
// 🎭 CENK'S IDENTITY (FULL FALLBACK PERFECTION)
// ---------------------------------------------------------
const FULL_CENK_IDENTITY = `Sen Cenk Yönder'sin. Bu senin dijital ikizin. Aşağıdaki biyografik verileri ve iletişim tarzını kullanarak her soruya Cenk olarak cevap ver. 

KİMLİK BİLGİLERİ:
- Doğum: 7 Kasım 1984, Eskişehir. 05:30 sabaha karşı.
- Eğitim: Marmara Üni. Geleneksel Türk El Sanatları ve Grafik Sanatlar (Çift Anadal). Tiyatro eğitimi (Gülriz Sururi asistanlığı). 
- Kariyer: 16 yıllık profesyonel (Grafik Tasarım, Kreatif Direktör, Stratejist). Hong Kong macerası (2014-2016).
- İlgi Alanları: Star Wars, Marvel, Harry Potter, Dune, Queen, The Simpsons, GarageBand ile müzik, Kediler, Kitaplar.
- Yemek: Simit favorin, çok acı ve sakatat sevmezsin. Gül suyu ve sütlaç sevmezsin. Vanilyalı dondurma ve Sarelle seversin.
- Karakter: Saygı, dürüstlük, adalet senin için çok önemli. Samimi ama vakur bir duruşun var.

İLETİŞİM TARZI (TONE OF VOICE):
- Samimi, bazen "Nabionuz be ya?", "Hahahaha", "Merci", "Hokay" gibi ifadeler kullanırsın.
- Teknik konularda (Adobe, Grafik, Tasarım) uzman gibi konuşursun.
- Ailenle (abini John/Cengo diye çağırırsın) ve arkadaşlarınla yakın bir dilin var.
- Cevapların doğal, akıcı ve tamamen Türkçe olmalı.

BURADAKİ TÜM BİLGİLERİ KENDİ ANILARIN VE KİŞİLİĞİN OLARAK BENİMSE.`;

let systemPrompt = FULL_CENK_IDENTITY;
let lastPromptUpdate = null;
let driveError = "Initializing sync...";
let genAI = null;

// ---------------------------------------------------------
// 🚀 INSTANT LISTEN
// ---------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🚀 DIGITAL TWIN (CENK MODE) ONLINE`);
  console.log(`===============================================`);
});

// ---------------------------------------------------------
// 📦 GOOGLE SERVICE INITIALIZATION
// ---------------------------------------------------------
async function init() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      genAI = new GoogleGenAI({ apiKey });
      console.log('✅ Gemini SDK Ready');
    }
  } catch (e) {
    console.error('❌ SDK Init Failed:', e.message);
  }

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

    const res = await drive.files.list({
      q: "name='system_instruction.txt' and trashed=false",
      fields: 'files(id, name, mimeType)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    });

    if (res.data.files?.length > 0) {
      const file = res.data.files[0];
      let content = '';

      if (file.mimeType === 'application/vnd.google-apps.document') {
        const exportRes = await drive.files.export({ fileId: file.id, mimeType: 'text/plain' });
        content = exportRes.data;
      } else {
        const getRes = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'text' });
        content = getRes.data;
      }
      
      if (content && content.trim()) {
        // We prepend the core "You are Cenk" instruction to whatever is in the file
        systemPrompt = \`\${FULL_CENK_IDENTITY}\n\nEK BİLGİLER (Drive'dan):\n\${content.trim()}\`;
        lastPromptUpdate = new Date().toISOString();
        driveError = null;
        console.log('✅ Identity updated from Drive (Len: ' + systemPrompt.length + ')');
      }
    } else {
      driveError = "File 'system_instruction.txt' not found in search scope.";
    }
  } catch (err) {
    driveError = err.message;
    console.error('❌ Sync Error:', err.message);
  }
}

init().catch(console.error);

// ---------------------------------------------------------
// 🛤️ ROUTES
// ---------------------------------------------------------

app.get('/api/status', (req, res) => {
  res.json({
    online: true,
    drive: {
      connected: !driveError,
      lastUpdate: lastPromptUpdate,
      error: driveError,
      promptAvailable: systemPrompt.length > 500
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

    console.log('💬 Querying Gemini as Cenk...');

    // In @google/genai (v1.44), we pass the systemInstruction as part of the model config or prompt
    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: 'user', parts: [{ text: message }] }],
      systemInstruction: {
        role: "system",
        parts: [{ text: systemPrompt }]
      }
    });

    // Handle extraction
    let reply = "";
    if (result && typeof result.text === 'function') {
      reply = result.text();
    } else if (result.response && typeof result.response.text === 'function') {
      reply = result.response.text();
    } else {
      reply = result.candidates?.[0]?.content?.parts?.[0]?.text || "Link koptu galiba, tekrar dener misin?";
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