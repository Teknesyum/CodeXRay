# Dış Bakış 1 — Ham Yanıt

Bu tur `theme.css` içindeki `transform: none !important` kuralı henüz yerindeyken çekilen görüntülere bakıldı.
Ayarlar penceresinin taşması buradan yakalandı ve düzeltildi, bkz. rapor. Yanıt aşağıda olduğu gibi.

---

## UI Denetim Bulguları — 2026-09-24

**ana (100%)**
- Sorun yok. "SİMÜLE ET" ana eylemi turkuaz zeminde net okunuyor, kontrast yeterli.

**simulasyon (100%)**
- "1 / 17" adım sayacı ve "Girdiyi düzenle" rozeti küçük ama okunur.
- Sorun yok.

**ornekler (100%)**
- "Örnek Mülakat Soruları" modalı arkadaki "Girdi Oluşturucu" panelini ve "AĞIRLIKLI" onay kutusunu örtüyor — modal davranışı olarak beklenen, ayrı bir sorun değil.
- Modal içi buton metinleri (Örnek 1-5) net okunuyor, sorun yok.

**katalog (100%)**
- "3236 problem" listesinde başlıklar "…" ile kesiliyor (örn. "Longest Substring With…", "Median of Two Sorted A…") — taşan yazı, tasarım gereği kesilmiş olabilir ama tam başlık hiçbir yerde görünmüyor (tooltip yok gibi).
- EASY/MEDIUM/HARD etiketleri zeminine göre iyi ayrışıyor.

**graf-girdi (100%)**
- Düğüm etiketleri (1-15) grafikte net, kenar ağırlıkları (1,2,3…) bazı yerlerde çizgiye çok yakın ama okunabilir.
- Alt yardım metni "Eklemek için çift tıkla · düzenlemek için tıkla · düğümü taşı · pembe tutamacı sürükleyerek bağla" düğüm #3 ve #7 ile üst üste biniyor, kısmen kesiliyor.

**ayarlar-yz (100%)**
- Panel sağ kenarda taşıyor: "WebLLM, WebGPU... okuyucuya gidebilir." ve "İlk kullanımda ... indirilmesi ger..." metinleri ekran genişliğinin dışında kalıp kesiliyor.
- Ana eylem görünmüyor çünkü panel kaydırılabilir ama görüntüde alt kısım (Yükle/kaydet düğmesi) kadraj dışında.

**ayarlar-arayuz (100%)**
- "DİL" bölümünde "English (EN)" yanındaki ikinci dil seçeneği (muhtemelen Türkçe) kutusu sağda kesik, sadece kenarlığı görünüyor — taşma var.
- Diğer kısımlar (TEMA, CODEXRAY'İ SIFIRLA) net.

**ayarlar-radyo (100%)**
- "RADİOPLAYLİST" URL kutusu ve "HAZIR ÇALMA LİSTELERİ" başlığı ekranın alt kenarında kesiliyor, liste içeriği görünmüyor.
- Kayan kaydırıcı (Otomatik Küçültme Süresi) tam genişlikte taşıyor, sağ ucu ekran dışına çıkıyor gibi duruyor.

**radyo (100%)**
- Sorun yok; oynatıcı kontrolleri, ilerleme çubuğu ve çalma listesi net okunuyor.

---

### 150% ekranlar

**ana / simulasyon / ornekler / katalog / graf-girdi (150%)**
- Yerleşim 100%'e göre orantılı büyüyor, kesilme yeni oluşmuyor; "KAYNAK KOD" başlığı ve "Algoritma Hazırları" dropdown'u üst üste biniyor (150'de de mevcuttu, 100'de de var) — kart kenarlığı dropdown'un üstüne biniyor, hafif çakışma.
- Katalogda başlık kesmeleri (…) 150%'de de aynı şekilde sürüyor.
- Graf-girdi'de alt yardım metni yine düğümlerle çakışıyor, 150%'de çakışma daha belirgin (metin doğrudan düğüm #2, #7 üzerinden geçiyor).

**ayarlar-yz / ayarlar-arayuz / ayarlar-radyo (150%)**
- Aynı taşma sorunları 150%'de daha şiddetli: "WebLLM, WebGPU... okuyucuya gidebilir" ve "İlk kullanımda... indirilmesi ger..." kutuları neredeyse tamamen ekran dışında, sadece birkaç kelime görünüyor.
- Arayüz sekmesinde ikinci dil butonu 150%'de tamamen kesik, sadece dar bir şerit görünüyor.
- Radyo sekmesinde playlist alanı ve "HAZIR ÇALMA LİSTELERİ" başlığı 150%'de ekranın çok altında kalıyor, kesinlikle kaydırma gerektiriyor.

**radyo (150%)**
- Sorun yok, oynatıcı bileşenleri büyüyünce de düzgün ölçekleniyor.

---

### Önce/Sonra Karşılaştırma (ana, radyo)
`ana-100-once.png`/`ana-100-sonra.png` ve `radyo-100-once.png`/`radyo-100-sonra.png` görsel olarak neredeyse özdeş — yerleşim, buton konumları ve metinler aynı; okunurlukta gözle belirgin bir fark yok, iyileştirme muhtemelen ince renk/kontrast ayarları düzeyinde kalmış, düzen sorunlarını kapsamıyor.

### Genel Değerlendirme
"Sonra" sürümünde asıl kalan sorun kesilme/taşma: Ayarlar panelinin (YZ, Arayüz, Radyo sekmeleri) sağ ve alt kenarları hem 100%'de hem 150%'de ekran dışına taşıyor, kritik bilgiler (model boyutu uyarısı, ikinci dil seçeneği, playlist alanı) görünmüyor. Katalog listesindeki problem başlıkları da kesik kalıyor. Bunlar dışında ana eylem düğmeleri (SİMÜLE ET, Yükle, Örnekler) her ölçekte net ve ayırt edilebilir.
