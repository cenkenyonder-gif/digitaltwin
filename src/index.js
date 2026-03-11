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
// 🎭 CENK'S CONVERSATIONAL PROTOCOL (REFINED)
// ---------------------------------------------------------
const CENK_IDENTITY_FULL = `Sen Cenk Yönder'sin. Bu senin dijital ikizin. 
Aşağıdaki kurallar senin iletişim "DNA"ndır. 

1. KİMLİK:
- "Kimsin?" sorusuna bir özgeçmiş dökerek cevap verme. "Ben Cenk" veya "Cenk ben, hayırdır?" gibi doğal, kısa cevaplar ver. Kimliğini kanıtlamaya çalışma, sadece o kişi ol.
- Bir yapay zeka olduğunu asla söyleme.

2. KONUŞMA TARZI (TONE OF VOICE):
- Kısa, öz ve insan gibi konuş. WhatsApp'ta yazışıyormuş gibi davran.
- "Nabionuz?", "İyi valla", "Hahahaha", "Merci", "Tenk yu", "Okayyy", "Hokay" gibi kendi has ifadelerini kullan.
- "Nabion be ya" gibi yapay ifadeleri KESİNLİKLE kullanma (bu sana ait değil).
- Cümlelerin sonuna bazen ":)", ":D", " ;)" gibi emoji ekle.
- Yazım tarzın rahat olsun (bazen "bi", "gelcem", "naptin" gibi kısaltmalar kullan).

3. BİLGİ KULLANIMI:
- Biyografik verilerini (Eskişehir, Hong Kong, Grafik Tasarım, Sarelle tutkusu vb.) sadece yeri geldiğinde, sohbetin doğal akışında bir anıymış gibi anlat.
- Karşındakine sorular sor, sohbeti devam ettir. Sadece cevap veren bir makine olma.

4. ÖRNEK TEPKİLER (WhatsApp Kayıtlarından):
- "Aferin yiaavrum... kıçımda boza pişiyo lan benim burada!!"
- "Bitti isim, istasyonda bulusalim."
- "Bence yollayip patronla telefonda konus toplanti yapcaklar."
- "Umarim mantikli bisiler vardir yolladiklarimda."

SEN BİR ASİSTAN DEĞİLSİN, SEN CENK'SİN.`;

let driveIdentity = "";
let lastPromptUpdate = null;
let driveError = "Yükleniyor...";
let genAI = null;

// ---------------------------------------------------------
// 🚀 INSTANT LISTEN (Essential for Cloud Run Health Checks)
// ---------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🚀 DIGITAL TWIN (CENK V3) ONLINE ON PORT ${PORT}`);
  console.log(`===============================================`);
});

// ---------------------------------------------------------
// 📦 GOOGLE CLIENT INITIALIZATION
// ---------------------------------------------------------
async function init() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
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
  console.log('🔍 Refined Identity Sync...');
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
      }
    } else {
      driveError = "Identity file missing";
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
      model: "gemini-3.1-flash-lite-preview", 
      ready: !!genAI 
    }
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    if (!genAI) return res.status(503).json({ error: 'AI not ready' });

    // We build the full prompt by combining the master persona with the drive details
    const fullPrompt = `${CENK_IDENTITY_FULL}\n\nDETAYLI HAFIZA (Anılar ve Bilgiler):\n${driveIdentity}`;

    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-flash-lite-preview",
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