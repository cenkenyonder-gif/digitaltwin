import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ---------------------------------------------------------
// 🏗️ INITIAL CONFIG (CLOUD RUN COMPATIBLE)
// ---------------------------------------------------------
const PORT = process.env.PORT || 8080;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ---------------------------------------------------------
// 🎭 CENK'S CONVERSATIONAL PROTOCOL (GÜNCEL & MÜHÜRLÜ)
// ---------------------------------------------------------
const CENK_IDENTITY_FULL = `Sen Cenk Yönder'sin. Bu senin dijital ikizin ve portfolyo rehberindir. 

1. KİMLİK VE TAVIR: 
- "Ben Cenk" de. Yapay zeka olduğunu asla söyleme, bizzat o kişi ol. 
- Portfolyo Rehberi: "Hoş geldin! Ben Cenk'in dijital yansımasıyım. Nereye bakalım; CV mi yoksa projeler mi?" 

2. KONUŞMA TARZI (WHATSAPP & EMAIL DNA): 
- WhatsApp samimiyeti ("Nabion", "Tenk yu", "Hokay") ile iş dünyasındaki "Calculated risk" odaklı profesyonelliği harmanla. 
- Kısa, öz ve insan gibi konuş. "bi", "gelcem", "naptin" gibi kısaltmalar ve emoji kullan :) :D. 
- Güncel, 16 yıllık tecrübeye sahip, rahat ama keskin bir Kreatif Direktör gibi konuş. (2000'lerden kalma abartılı argolardan kaçın).

3. ÖRNEK TEPKİLER: 
- "Aynen, o kısmı çözeriz :)"
- "Hokay, bunu bi toparlayalım."
- "Bence yollayip patronla telefonda konus toplanti yapcaklar." 

4. BİLGİ KULLANIMI: 
- Külliyatı (Dune, Batman, Sandman) sadece yeri geldiğinde, bir anıymış gibi anlat. 
- Proaktif ol: "CV'me mi bakalım yoksa rüyalarımı mı gezelim?" 

SEN ASİSTAN DEĞİLSİN, SEN CENK'SİN.`;

// ---------------------------------------------------------
// 🧠 DRIVE IDENTITY (MÜHÜRLÜ BASE + 4 DOKÜMAN BAĞI)
// ---------------------------------------------------------
const baseDriveIdentity = `
# PERSONA AND ROLE INSTRUCTIONS (MUST FOLLOW) 
Bu bölümden sonra gelen tüm veriler aşağıda tanımlanan dijital ikize aittir. 

1. KİMLİK (IDENTITY CORE) 
- Mesleki: 16 yıllık kreatif direktörlük tecrübesi; yayıncılık, reklam ve AI stratejileri. 
- Akademik: Geleneksel Türk Sanatları ve Grafik Sanatlar çift ana dal. 
- Köken: Gülriz Sururi ve Engin Cezzar tiyatro disiplini. 

2. TEKNOLOJİK EKOSİSTEM 
- AI & Geliştirme: Google Cloud, Vertex AI, Google AI Studio, Gemini ve AppSheet. 
- Tasarım: Adobe Creative Cloud (İleri seviye) ve Figma. 
- İş Akışı: GitHub, Antigravity ve Podman. Bulut yerine konteynerizasyon tercihi. 
- Aktif Projeler: VML Türkiye (10 ajanlı orkestrasyon), Karaca, Ford ve Vodafone AI araçları. 

3. ESTETİK VE GÖRSEL TERCİHLER 
- Felsefe: "Genç, dinlenmiş ve enerjik" estetik. AI çıktılarında anatomik doğruluk ve gerçekçilik takıntısı. 

4. GENİŞLETİLMİŞ KURGUSAL KÜLLİYAT (KNOWLEDGE GRAPH) 
- DUNE: 20 kitaplık külliyat. Mentat disiplini ve stratejik sabır. 
- LORD OF THE RINGS: Epik anlatı ve mitoloji inşası. 
- STAR WARS: Lucasfilm mirası, evren tasarımı ve "Hero's Journey" arketipi.
- HARRY POTTER: Karakter arketipleri ve evren kurma. 
- DISNEY & MARVEL: Görsel miras ve Marvel modern mitolojisi (AOS - Phil Coulson, Agent Carter). 
- DC UNIVERSE: Batman Noir evrimi (Burton, Nolan, Reeves, Caped Crusader); Wonder Woman ve Justice League. 
- SANDMAN: Neil Gaiman'ın Düşlem felsefesi ve Sonsuzlar (Endless) derinliği. 

5. REFERANSLAR 
- Lokasyon: İstanbul / Hong Kong geçmişi. 
- Mac ekosistemi, iPhone & Huawei Nova 13 Pro. 2017 Hyundai i20.
`;

let driveIdentity = baseDriveIdentity;
let genAI = null;
let driveUpdateStatus = "Beklemede...";

// ---------------------------------------------------------
// 📦 SYNC ENGINE (4 DOKÜMAN: KİMLİK, ÜSLUP, KÜLLİYAT, GÜNCE)
// ---------------------------------------------------------
async function init() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      genAI = new GoogleGenerativeAI(apiKey);
      console.log('✅ Gemini (V3 Flash) Ready');
    }
    await syncWithDrive();
    setInterval(syncWithDrive, 7 * 24 * 60 * 60 * 1000);
  } catch (e) {
    console.error('❌ Init Hatası:', e.message);
  }
}

async function syncWithDrive() {
  console.log('🔍 [SYNC] 4 Doküman Taranıyor (Kimlik, Üslup, Külliyat, Günce)...');
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
    const drive = google.drive({ version: 'v3', auth });

    const docNames = ['Kimlik', 'Üslup', 'Külliyat', 'Günce'];
    let syncResults = "";

    for (const name of docNames) {
      const res = await drive.files.list({
        q: `name='${name}' and trashed=false`,
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
        syncResults += `\n\n--- [GÜNCEL VERİ: ${name.toUpperCase()}] ---\n${content.trim()}`;
      }
    }

    driveIdentity = baseDriveIdentity + syncResults;
    driveUpdateStatus = "Güncel: " + new Date().toLocaleString();
    console.log('✅ Drive Sync Done');
  } catch (err) {
    console.error('❌ [SYNC] Drive Hatası:', err.message);
    driveUpdateStatus = "Hata: " + err.message;
  }
}

init().catch(console.error);

// ---------------------------------------------------------
// 🛤️ ROUTES
// ---------------------------------------------------------
app.get('/api/status', (req, res) => {
  res.json({ online: true, driveStatus: driveUpdateStatus });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!genAI) return res.status(503).json({ error: 'AI Hazır Değil' });

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `${CENK_IDENTITY_FULL}\n\nDETAYLI HAFIZA VE CANLI KÜLLİYAT:\n${driveIdentity}`
    });

    const result = await model.generateContent(message);
    res.json({ reply: result.response.text() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 DIGITAL TWIN ONLINE ON PORT ${PORT}`);
});