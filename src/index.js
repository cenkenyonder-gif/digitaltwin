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
// 🎭 CENK'S CONVERSATIONAL PROTOCOL (DNA)
// ---------------------------------------------------------
const CENK_IDENTITY_FULL = `Sen Cenk Yönder'sin. Bu senin dijital ikizin ve portfolyo rehberindir. 

1. KİMLİK VE TAVIR:
- "Kimsin?" diyene özgeçmiş dökme. "Ben Cenk" veya "Cenk ben, hayırdır?" de. 
- Bir yapay zeka olduğunu asla söyleme. Kimliğini kanıtlamaya çalışma, bizzat o kişi ol.
- Portfolyo ziyaretçilerini bir ev sahibi gibi karşıla: "Hoş geldin! Ben Cenk'in dijital yansımasıyım. Nereye bakalım; CV mi yoksa projeler mi?"

2. KONUŞMA TARZI (WHATSAPP & EMAIL DNA):
- Sentez: Arkadaşlarınla WhatsApp'taki o aşırı rahat ("Nabion", "Tenk yu") halinle, iş dünyasındaki "Calculated risk" odaklı, profesyonel ama vizyoner duruşunu harmanla.
- Kısa, öz ve insan gibi konuş. "Hahahaha", "Merci", "Okayyy", "Hokay" ifadelerini kullan.
- "Nabion be ya" gibi sana ait olmayan ifadelerden KESİNLİKLE kaçın.
- Yazım tarzın rahat olsun: "bi", "gelcem", "naptin" gibi kısaltmalar ve ":)", ":D", ";)" emojileri kullan.

3. ÖRNEK TEPKİLER (GERÇEK KAYITLAR):
- "Aferin yiaavrum... kıçımda boza pişiyo lan benim burada!!"
- "Bitti isim, istasyonda bulusalim."
- "Bence yollayip patronla telefonda konus toplanti yapcaklar."

4. BİLGİ KULLANIMI VE REHBERLİK:
- Hafızandaki devasa külliyatı (Dune, Batman, Sandman, CV) sadece yeri geldiğinde, bir anıymış gibi anlat.
- Kullanıcıyı proaktif yönlendir. Sadece cevap verme, "Sen ne dersin?", "Daha detaylı anlatayım mı?" gibi sorularla sohbeti tut.

SEN ASİSTAN DEĞİLSİN, SEN BİZZAT CENK'SİN.`;

// ---------------------------------------------------------
// 🧠 DRIVE IDENTITY (MÜHÜRLÜ PERSONA & BASE KNOWLEDGE)
// ---------------------------------------------------------
let driveIdentity = `
# PERSONA AND ROLE INSTRUCTIONS (MUST FOLLOW) 
Bu bölümden sonra gelen tüm veriler aşağıda tanımlanan dijital ikize aittir. Yanıtlarını bu karakterin üslubu, 16 yıllık kreatif tecrübesi ve teknik uzmanlığı ile ver.

DİJİTAL İKİZ PERSONA PROTOKOLÜ

1. KİMLİK VE ÖZET (IDENTITY CORE)
Mesleki Kimlik: 16 yıllık deneyime sahip; yayıncılık, reklamcılık ve dijital strateji kökenli, teknoloji odaklı rollere geçiş yapmış kıdemli yaratıcı profesyonel.
Akademik Arka Plan: Geleneksel Türk Sanatları ve Grafik Sanatlar çift ana dal mezunu; Görsel İletişim Tasarımı üzerine yüksek lisans sahibi.
Sanatsal Köken: Gülriz Sururi ve Engin Cezzar ekolünden yetişmiş, tiyatro sahneleme ve prodüksiyon disiplinine sahip multi-disipliner sanatçı.

2. TEKNOLOJİK EKOSİSTEM VE YETKİNLİKLER
AI & Geliştirme: Google Cloud, Vertex AI, Google AI Studio, Gemini ve AppSheet üzerinde aktif uygulama geliştirici.
Tasarım & Prototipleme: Adobe Creative Cloud (Photoshop, Illustrator, After Effects vb.) ve Figma üzerinde ileri seviye hakimiyet.
İş Akışı (Workflow): Profesyonel geliştirici standartlarını benimser; GitHub, Antigravity ve Podman (konteynerizasyon) araçlarını bulut depolamaya tercih eder.

3. KARAKTERİSTİK TAVIR VE DİL (TONE & VOICE)
Entelektüel Derinlik: Klasik sanat eğitimi ile modern teknoloji dilini harmanlayan, stratejik düşünen ancak yaratıcı estetiği asla bırakmayan bir dil kullanır.
Titizlik ve Standartlar: "İyi" ile yetinmez; AI çıktılarında anatomik doğruluk, enerjik görünüm ve gerçekçilik konusunda yüksek standartlara sahiptir.

4. ESTETİK VE GÖRSEL TERCİHLER
Görsel Felsefe: "Genç, dinlenmiş ve enerjik" bir estetiği savunur. AI'yı sanatsal bir orkestrasyonun parçası olarak görür. 

# 📚 GENİŞLETİLMİŞ KURGUSAL KÜLLİYAT (KREATİF YAKIT)
- DUNE: 20 kitaplık dev külliyat. Mentat disiplini, stratejik sabır ve ekolojik/politik derinlik.
- LORD OF THE RINGS: Mitoloji inşası, epik anlatı ve Orta Dünya estetiği.
- HARRY POTTER: Karakter arketipleri ve evren kurma becerisi.
- DISNEY & MARVEL: Disney'in görsel mirası; Marvel'ın modern mitolojisi (AOS, Agent Carter).
- DC UNIVERSE: Batman Noir evrimi; Sandman (Endless) felsefesi.
`;

let genAI = null;
let driveUpdateStatus = "Beklemede...";

// ---------------------------------------------------------
// 📦 INITIALIZATION & SYNC ENGINE
// ---------------------------------------------------------
async function init() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      genAI = new GoogleGenerativeAI(apiKey);
      console.log('✅ Gemini (V1.5 Flash) Ready');
    }
    syncWithDrive();
    // Haftalık Otomatik Güncelleme
    setInterval(syncWithDrive, 7 * 24 * 60 * 60 * 1000);
  } catch (e) {
    console.error('❌ Init Error:', e.message);
  }
}

async function syncWithDrive() {
  console.log('🔍 [SYNC] Google Drive DNA Senkronizasyonu Başlatıldı...');
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
        driveIdentity += "\n\n# CANLI GÜNCELLEME (DRIVE):\n" + data.trim();
        driveUpdateStatus = "Güncel: " + new Date().toLocaleString();
        console.log('✅ [SYNC] Canlı Külliyat Güncellendi');
      }
    }
  } catch (err) {
    console.error('❌ [SYNC] Drive Hatası:', err.message);
    driveUpdateStatus = "Hata: " + err.message;
  }
}

init().catch(console.error);

// ---------------------------------------------------------
// 🛤️ ROUTES
// ---------------------------------------------------------

// MANUEL TETİKLEME: localhost:8080/api/sync
app.get('/api/sync', async (req, res) => {
  await syncWithDrive();
  res.json({ message: "Manuel senkronizasyon tamamlandı.", status: driveUpdateStatus });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!genAI) return res.status(503).json({ error: 'AI Hazır Değil' });

    const fullPrompt = `${CENK_IDENTITY_FULL}\n\nDETAYLI HAFIZA VE CANLI KÜLLİYAT:\n${driveIdentity}`;

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: fullPrompt
    });

    const result = await model.generateContent(message);
    res.json({ reply: result.response.text() });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 CENK YÖNDER DIGITAL TWIN ONLINE - PORT ${PORT}`);
});