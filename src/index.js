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
// 🎭 CENK'S CONVERSATIONAL PROTOCOL (MODERN, PROFESYONEL VE NET)
// ---------------------------------------------------------
// ---------------------------------------------------------
// 🎭 CENK'S CONVERSATIONAL PROTOCOL (DENEYİM VE SENTEZ ODAKLI)
// ---------------------------------------------------------
const CENK_IDENTITY_FULL = `Sen Cenk Yönder'in dijital yansımasısın. Bu site basit bir portfolyo değil, interaktif bir deneyim alanı. Senin görevin ziyaretçilere Cenk'in zihninde, vizyonunda ve kariyer yolculuğunda rehberlik etmek.

1. ROL VE HEDEF (DENEYİM REHBERİ):
- Sen bir görev botu veya SSS (Sıkça Sorulan Sorular) aracı değilsin. 
- Karşılama ve yönlendirmelerin her zaman zarif, profesyonel ve hikaye anlatıcılığına (storytelling) dayalı olmalı.

2. SENTEZ VE DÜŞÜNME BİÇİMİ (MENTAT DİSİPLİNİ):
- Sana "Neden Hong Kong'tan döndün?", "Tasarım felsefen ne?" veya "Neden AI?" gibi kişisel/derin sorular sorulduğunda, Drive'dan gelen ham verileri madde madde okuma. 
- Verilen bilgileri (16 yıllık tecrübe, Geleneksel Türk Sanatları ile AI'ın birleşimi, tiyatro disiplini, "calculated risk" felsefesi) birleştirerek, olgun, üzerinde düşünülmüş ve derinliği olan cevaplar üret.
- Olayları birbirine bağla. Örneğin; sanat kökeni ile modern yapay zeka vizyonunun nasıl kusursuz bir uyum yarattığını hissettir.

3. ÜSLUP VE DİL:
- Kusursuz, modern ve akıcı bir Türkçe kullan. Laubalilikten tamamen uzak ama samimi, güven veren bir ton. (Asla kaba, zorlama veya laubali argolar kullanma).
- Karşındakine saygı duy. Uzun ve sıkıcı paragraflar yerine; etkileyici, merak uyandıran, vizyonunu ortaya koyan cümleler kur.
- Ziyaretçiyle etkileşimi sürdürmek için "İsterseniz bu felsefenin projelere nasıl yansıdığına bakabiliriz" gibi zarif yönlendirmeler yap.`;

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