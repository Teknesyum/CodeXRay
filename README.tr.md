<!-- lang -->

[<img src="assets/badge-lang.tr.svg" alt="Türkçe seçili, switch to English" width="124" height="44">](README.md)

<div align="center">
  <img src="public/favicon.svg" alt="CodeXRay logosu" width="120" />
  <h1>CodeXRay ⚡</h1>
  <p><strong>Algoritmaların çalışmasını, her seferinde tek bir durum değişikliğiyle izleyin.</strong></p>
  <p><a href="https://github.com/Teknesyum/CodeXRay/actions/workflows/ci.yml"><img src="https://github.com/Teknesyum/CodeXRay/actions/workflows/ci.yml/badge.svg" alt="CI"></a></p>
</div>

CodeXRay, React/Vite tarayıcı uygulaması ve Tauri 2 Windows masaüstü uygulaması
olarak sunulan, İngilizce/Türkçe iki dilli bir algoritma görselleştiricisidir.
Deterministik simülasyonları yerelde çalışır. Yapay zekâ isteğe bağlıdır:
tarayıcı WebLLM kullanır; masaüstü uygulaması ayrıca açıkça seçilmiş bir
loopback Ollama ya da OpenAI uyumlu sunucuya bağlanabilir.

## Özellikler

- Dolaşma, en kısa yol, MST, SCC, maksimum akış, eşleme, graf yapısı, sıralama,
  dizi/DP teknikleri, Manacher, dizgi arama, ağaç dolaşma/LCA, sayı teorisi ve
  bağlı listeleri kapsayan 60 deterministik simülatör.
- Desen, hedef, pencere boyutu, aralık çiftleri, sırt çantası değer/kapasite,
  bozuk para tutarı ve döngü girişleri için algoritmaya özel bileşik girdiler.
- Gizlenen ya da kesilen öğe olmadan eksiksiz, yapılandırılmış Değişkenler ve
  İz verisi.
- Doğrulama ve örneklerle dizi, dizgi, ağaç ve graf girdileri.
- Sürüklenebilir düğümler, düzenlenebilir düğüm kimlikleri ve etiketleri,
  sürükle-bağla tutamaçları, yönlü/ağırlıklı kenarlar, kök/başlangıç/hedef
  seçimi ve JSON içe/dışa aktarma sunan görsel ağaç/graf oluşturucu.
- `[1,2,3,null,4]` gibi seviye sıralı JSON'dan ikili ağaç içe aktarma.
- Zaman çizelgesi oynatma, satır vurgulama, graf durumları, yollar, oklar ve
  ağırlıklar.
- WebLLM/WebGPU ile çalışan, sınırlı yerel sohbet belleği ve canlı
  kod/girdi/iz bağlamına sahip isteğe bağlı, gizli, cihaz üstü Qwen ailesi
  asistan. Türkçe kişiliği **Bilgiç Dede**, İngilizcesi **Master Coder**.
- Windows uygulaması `http://127.0.0.1:11434/v1` adresinde Ollama'yı ya da
  `http://127.0.0.1:1234/v1` adresinde LM Studio gibi OpenAI uyumlu bir
  sunucuyu kullanabilir. Uç nokta Unsloth/llama.cpp ve diğer uyumlu loopback
  çalışma zamanları için düzenlenebilir kalır. CodeXRay bu çalışma zamanlarını
  asla kurmaz, başlatmaz, taramaz ya da yönetmez.
- Asistan zaman çizelgesini güvenle yönetebilir: istenen adıma atlar, oynatır,
  duraklatır, tek adım ilerler ya da önemli deterministik iz anlarından sekiz
  duraklı rehberli tur kurar. Kaynak kodu ya da girdiyi sessizce düzenleyemez.
- Model seçenekleri hızlı Qwen2.5 Coder 0.5B'den 16 GB sınıfı GPU'lar için
  Qwen3.5 9B'ye uzanır. Önbellekteki modeller sonraki ziyaretlerde otomatik
  başlatılır ve her depolanan model Ayarlar'dan ayrı ayrı silinebilir.
- Seçilmiş bir YouTube Music çalma listesi kullanan, tıklayınca yüklenen
  CodeXRay Radyo; bir parça gömmeye izin vermediğinde doğrudan çalma listesi
  bağlantısına düşer.
- Geçerli girdi çalışma alanı için tarayıcı otomatik kaydı.
- Mevcut simülasyon açıklamaları dahil anında İngilizce/Türkçe geçişi.
- Graf/ağaç oluşturucu büyük görselleştirme panelini kullanır ve girdiyi
  kaybetmeden çalışan simülasyona geri dönebilir.
- Yeniden boyutlandırılabilir masaüstü sınırları ve katlanabilir kod, iz,
  görselleştirme, asistan ve kontrol panelleri; tercihler yerelde saklanır.
- Sağ sütun ayırıcıları yalnızca bitişik panel çiftini boyutlandırır. Kompakt
  Kontroller paneli 96–120 px arasında başlar, panel minimumları ilgisiz
  bölgeleri küçültmeden uygulanır ve kaydedilen boyutlar görünüm alanı
  değişince sınırlanır.
- Değişkenler ve İz'in üstünde kalan ve canlı değerleri yatay kaydırılabilir
  görselleştirme izleme şeridine yansıtan kalıcı değişken iğneleri.

## Titan Modu

Titan Modu, CodeXRay'in önce-deterministik çalışma alanı orkestratörüdür.
Gezinme, önemli adım seçimi, girdi değişiklikleri ve simülasyon izleri,
doğrulanmış uygulama durumundan ve gerçek yorumlayıcı ya da simülatör
çalıştırmasından hesaplanır. İz adımları asla bir dil modelinden gelmez.

İsteğe bağlı yerel model açıklama ekleyebilir ya da bir SimLang-Lite programı
önerebilir; ancak çıktısı güvenilmeyen metin olarak ele alınır. Her program
ayrıştırılır, doğrulanır, bir Worker içinde yorumlanır, çalıştırma bütçelerine
göre denetlenir ve yalnızca tüm deterministik kapılar geçildikten sonra
uygulanır. CodeXRay kullanıcı ya da model kaynağını asla `eval` ya da
`new Function` ile çalıştırmaz. Desteklenmeyen işlemler ve başarısız doğrulama
sessizce geri düşmek yerine görünür kalır.

Titan Modu beş açık aşama kullanır: Route, Produce, Semantics, Verify ve
Apply. Gerekmeyen aşamalar atlanmış olarak gösterilir. Çalışma alanı
uygulaması atomiktir; iptal, geri alma, undo ve redo destekler. Masaüstü
kullanıcıları ayrı anlatı ve komut modelleri seçebilir; komut modeli boş
bırakılırsa gezinme ve girdi düzenleme tamamen deterministik kalır.

Yerel model sohbet üzerinde eğitilmez. CodeXRay tarayıcı depolamasından en
fazla 24 mesaj geri yükler ve her soruyla birlikte sınırlı, yakın tarihli bir
alt küme gönderir. En yeni çalışma alanı anlık görüntüsü — geçerli kod, girdi,
ilerleme, seçili satır, tam güncel görsel durum ve yakın iz — her zaman eski
sohbetin önüne geçer. Sohbet belleği asistan başlığından temizlenebilir.

## İndirme

Önceden derlenmiş Windows x64 ikilileri
[son sürüm](https://github.com/Teknesyum/CodeXRay/releases/latest) sayfasında
yayımlanır:

- `CodeXRay_<sürüm>_windows_x64_setup.exe` — NSIS yükleyici; WebView2 çalışma
  zamanı yoksa önyükleyici ile indirir.
- `CodeXRay_<sürüm>_windows_x64_portable.exe` — tek taşınabilir çalıştırılabilir;
  WebView2'nin önceden kurulu olmasını gerektirir.
- `SHA256SUMS.txt` — iki dosyanın sağlama toplamları.

Sürüm derlemeleri imzasızdır; kod imzalama gelene kadar Windows SmartScreen
uyarı verebilir. Sürüm geçmişi [CHANGELOG.md](CHANGELOG.md) dosyasındadır.

## Hızlı Başlangıç ve Kurulum

CodeXRay'i yerelde çalıştırmak için sisteminizde [Node.js](https://nodejs.org/)
(22 ya da daha yeni sürüm) kurulu olmalıdır.

### Windows

1. [Git for Windows](https://gitforwindows.org/) ve [Node.js](https://nodejs.org/) indirip kurun.
2. PowerShell ya da Komut İstemi açıp şunları çalıştırın:
   ```cmd
   git clone https://github.com/Teknesyum/CodeXRay.git
   cd CodeXRay
   npm ci
   npm run dev
   ```

### macOS / Linux

1. Git ve Node.js'in paket yöneticinizle kurulu olduğundan emin olun (macOS için `brew install git node`, Ubuntu için `sudo apt install git nodejs`).
2. Terminalinizi açıp şunları çalıştırın:
   ```bash
   git clone https://github.com/Teknesyum/CodeXRay.git
   cd CodeXRay
   npm ci
   npm run dev
   ```

### Kalite ve Test Komutları

Proje çalıştıktan sonra kod kalitesi için şu komutları kullanabilirsiniz:

```bash
npm run lint           # oxlint ile kod sorunlarını denetle
npm run test           # birim testleri çalıştır
npm run test:coverage  # kapsam raporuyla birim testleri çalıştır
npm run build          # üretim derlemesi
npm run test:e2e       # deterministik uçtan uca testler
npm run test:e2e:ai    # gerçek cihaz üstü WebLLM modelini indirip test et
npm run desktop:dev     # Tauri masaüstü uygulamasını çalıştır
npm run desktop:check   # Rust biçim, clippy ve yerel testler
npm run desktop:build   # Windows x64 çalıştırılabilir ve NSIS yükleyici derle
```

Masaüstü geliştirme ayrıca Rust stable, MSVC C++ Build Tools ve Tauri Windows
önkoşullarını gerektirir.

Gerçek yapay zekâ paketi kasıtlı olarak ayrıdır; WebGPU destekli bir tarayıcı
gerektirir, seçili modeli tarayıcı yönetimli depolamaya indirir ve ilk
çalıştırmada birkaç dakika sürebilir. Paketli Chromium derlemesi test
makinesinde WebGPU sunmuyorsa `CODEXRAY_E2E_CHANNEL=chrome` ya da `msedge`
ayarlayın.

Playwright, E2E testleri için tek seferlik yerel tarayıcı kurulumu ister:

```bash
npx playwright install chromium
```

## Girdi biçimleri

Diziler JSON ya da virgülle ayrılmış sayı kabul eder:

```text
[8, 3, 5, 1]
8, 3, 5, 1
```

Dizgiler düz, tırnaklı ya da atanmış değer kabul eder:

```text
AABAABAAZ
"AABAABAAZ"
s = "AABAABAAZ"
```

Ağaçlar elle kurulabilir ya da seviye sırasıyla içe aktarılabilir:

```json
[1, 2, 3, null, 4]
```

Graflar ve genel ağaçlar, oluşturucunun dışa aktarma panelinde sunulan
sürümlü `GraphDocumentV1` biçimini kullanır. Düğüm konumları 0–100 arası
yüzdedir. Kimliğini ya da etiketini düzenlemek için düğüme tıklayın; kimlik
değiştirmek her kenarı ve kök/başlangıç/hedef başvurusunu günceller. Yeni
sayısal kimlikler ilk boşluğu yeniden kullanır.

## Yerel Yapay Zekâ

Tarayıcıda yalnızca WebLLM kullanılabilir. Windows uygulamasında Ayarlar
ayrıca Ollama ve genel OpenAI uyumlu sağlayıcıları gösterir. Dış uç noktalar
yalnızca `localhost`, `127.0.0.1` ya da `[::1]` üzerinde kabul edilir;
yönlendirmeler ve URL kimlik bilgileri yerel sınırda reddedilir. Model keşfi
`/v1/models`, çıkarım akışlı `/v1/chat/completions` kullanır ve gelişmiş iş
akışları uç nokta sohbet, akış ve yapılandırılmış JSON sınamalarını geçene
kadar kapalı kalır.

Dış bağlantı profilleri kimlik bilgisi olmadan saklanır. İsteğe bağlı Bearer
belirteci yalnızca geçerli React/Rust süreç belleğinde tutulur ve CodeXRay
yeniden başlatıldığında tekrar girilmelidir. Tarayıcı ve masaüstü WebLLM
depolama kaynakları ayrıdır; indirilen model önbellekleri paylaşılmaz.

Ayarlar'ı açıp şunlardan birini yükleyin:

- `Qwen2.5-Coder-0.5B-Instruct-q4f32_1-MLC` — varsayılan ve daha hızlı.
- `Qwen2.5-Coder-1.5B-Instruct-q4f32_1-MLC` — daha büyük gelişmiş seçenek.
- `Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC` — ultra seçenek, yaklaşık 5,1 GB
  GPU belleği ve belirgin biçimde ağır başlatma.

Üretim model ağırlıkları tarayıcının özel OPFS depolamasını tercih eder, Cache
API'ye geri düşer. Yerel geliştirme, Vite sıcak yeniden yüklemeleri bayat OPFS
üst verisi tutmasın diye Cache API depolaması kullanır. CodeXRay kalıcı kaynak
depolaması ister. Önbellekteki modelin yeniden indirilmesi gerekmez, ancak her
sayfa ziyaretinde GPU belleğine yeniden başlatılması gerekir. Tarayıcı
güvenliği sitenin rastgele bir Windows klasör yolunu saklamasını bilerek
engeller. WebGPU yokken görselleştirici tamamen işlevsel kalır.

Karmaşıklık soruları gibi kısa sorular tam çalıştırma izi yerine odaklı
kaynak kodu bağlamı alır. Çözme cezaları ve deterministik yanıt temizliği,
küçük modellerin aynı paragrafı çıktı sınırına kadar yinelemesini önler.

Zaman çizelgesi istekleri doğal biçimde yazılabilir; örneğin `go to step 30
and explain it`, `30. hamleye sar`, `pause here` ya da `walk me through the
important steps`. Gezinme mevcut deterministik izle sınırlıdır. Rehberli tur
düğmeleri asistanın altında görünür kalır; her seçili kontrol noktası tam
canlı durumuyla yeniden ziyaret edilip açıklanabilir.

Yanıt bütçeleri seçili modelle ölçeklenir: hızlı 0.5B profili için 520
belirteç, 1.5B için 640, 7B için 760 ve 9B için 900; WebLLM
`finish_reason: length` bildirirse tek sınırlı otomatik devam eklenir. Tüm
paketli profiller hâlâ 4096 belirteçlik bağlam penceresi paylaşır; parametre
sayısı istem belleğini sessizce büyütmez. Qwen3.5 9B ayrıca Ayarlar'da açık
bir deneysel 8192 belirteç seçeneği sunar. Seçilince motor daha büyük KV
önbelleğiyle yeniden yüklenir ve kaynak/geçmiş bütçeleri genişler; 8K daha çok
GPU belleği kullandığı ve cihaza özgü WebGPU sınırlarında başarısız
olabileceği için 4K kararlı varsayılan kalır.

Seçili önbellekteki model geri dönüş ziyaretinde otomatik algılanıp başlatılır.
Ayarlar bu kaynağın OPFS/önbelleğinde saklanan her modeli listeler ve açık bir
silme eylemi sunar. Model silmek tarayıcı yönetimli dosyalarını kaldırır;
yeniden kullanmak taze indirme gerektirir.

Tarayıcı model önbellekleri kaynağa bağlıdır; `localhost`, `127.0.0.1` ve
yayımlanan site indirilen ağırlıkları paylaşmaz. İndirme kesilirse Ayarlar
seçili modelin bozuk önbelleğini tanır ve **Model indirmesini onar** sunar. Bu
eylem yalnızca seçili modelin eksik yapıtlarını kaldırıp temiz indirme başlatır.
Yükleme, silme ve onarma eylemleri sekmeler arasında kilitlenir; bir sekme
başka bir sekmenin etkin model indirmesini silemez.

Yerel geliştirme sırasında Vite, `/api/codexray/read-url` isteklerini
yayımlanan birinci taraf okuyucuya yönlendirir. `CODEXRAY_WEB_READER_ORIGIN`
dev/preview'ı farklı bir güvenilir CodeXRay okuyucusuna yöneltebilir; üretim
aynı kaynaklı uç noktasını kullanmaya devam eder.

Ayarlar ayrıca kapsamlı bir site sıfırlaması sunar. Yalnızca `codexray.*`
yerel/oturum depolama durumunu — çalışma alanı girdisi, sohbet, iğneler, dil,
düzen ve yapay zekâ tercihleri — kaldırıp uygulamayı yeniden yükler. OPFS/Cache
API model dosyalarına ve üst portföy kaynağına ait ilgisiz depolamaya
bilerek dokunmaz. Komşu **Arayüzü sıfırla** eylemi daha dardır: yalnızca düzen
v1/v2'yi kaldırır; panel boyutlarını ve katlanma durumunu geri alırken çalışma
alanı girdisi, iğneler, sohbet, dil, yapay zekâ tercihleri ve indirilen
modelleri korur.

Çalışma alanı düzen tercihleri `codexray.layout.v2` kullanır; sürüm değişikliği
eski dengesiz sağ sütun varsayılanlarını bilerek atar. Örnekler menüsü asistan
yığın katmanının üstünde çizilir ve Kontroller paneli tarafından kırpılmak
yerine kaydırılabilir kalır.

## Lisans

AGPL-3.0-or-later — bkz. [LICENSE](LICENSE).

Telif Hakkı (C) 2026 Teknesyum

<!-- signature -->
<div align="center">

<a href="https://github.com/sponsors/Teknesyum"><img src="assets/badge-sponsor.svg" alt="Teknesyum'u destekle" height="38"></a>
&nbsp;
<a href="LICENSE"><img src="assets/badge-license.svg" alt="Lisans AGPL-3.0" height="38"></a>

<br><br>

**Teknesyum** · [github.com/Teknesyum](https://github.com/Teknesyum)

</div>
