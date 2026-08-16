# CodeXRay — Tüm Uygulama Gereksinimleri ve Ayrıntılı Kabul Testleri

Belge sürümü: `CODEXRAY-MASTER-RQAT-1`

Durum: `UYGULANDI / COVERED`

Kapsam kanıtı: Bu belgedeki numaralı `REQ-*`, `APP-*` ve `GM-*` kimliklerinin
tamamı `scripts/requirements-coverage.test.ts` tarafından yürütülebilir test
ailelerine bağlanır. Kimliği kanıtsız bırakmak, kanıt dosyasını silmek, belgeyi
yeniden uygulanmamış duruma almak veya ürün onay listesini açmak test paketini
başarısız yapar. Güncel koşum özeti ve dış donanım/hizmet kapıları
`docs/TEST_COVERAGE_GAPS.md` içinde kayıtlıdır.

Ürün sahibi: Serkan

Kapsam: CodeXRay uygulamasının tamamı; 60 algoritmalık katalog, editör, input
doğrulama, Graph Builder, deterministik simülasyon, görselleştirme, timeline,
değişken izleme, yerel AI, God Mode, radyo, layout, tema, dil, storage/reset,
erişilebilirlik, performans, güvenlik, test altyapısı ve yayınlama süreci

Kaynak: Codex ve Gemini tarafından hazırlanan gereksinim/test listelerinin
birleştirilmiş, ölçülebilir ve otomasyona hazır sürümü

---

## 1. Belgenin amacı

Bu belge CodeXRay uygulamasının tamamı için ana ürün ve kalite sözleşmesidir.
God Mode GM-2 bu ürünün önemli bir alt sistemidir; ancak editör, algoritma
kataloğu, inputlar, graph düzenleme, timeline, görselleştirme, yerel model,
radyo, layout, dil, persistence ve deployment da aynı kabul kapılarına tabidir.
Bir özelliğin yalnızca ekranda görünmesi veya AI'ın başarı mesajı üretmesi
yeterli değildir. Özellik gerçek uygulama state'i ve ilgili deterministik
çıktılarla doğrulandığında tamamlanmış sayılır.

Belge üç soruyu cevaplar:

1. Kullanıcı CodeXRay uygulamasının her bölümünden ne yapabilmesini bekler?
2. Sistem bu beklentiyi hangi sınırlar ve veri sözleşmeleriyle karşılar?
3. Bir geliştirici özelliğin gerçekten çalıştığını hangi testlerle kanıtlar?
4. Alt sistemlerin birbirini bozmadığı hangi çapraz testlerle doğrulanır?

Bu belgedeki `ZORUNLU`, `OLMALIDIR`, `YAPMAMALIDIR` ve `P0` ifadeleri bağlayıcı
kabul kriterleridir. `P1` üretim kalitesi için gerekli, `P2` ise takip eden
iyileştirme dönemine bırakılabilecek kriterleri ifade eder.

---

## 2. Bütün CodeXRay ürün vizyonu

CodeXRay'de bir öğrenci ana ekrana geldiğinde iki temel yolculuktan birini
seçebilmelidir:

1. Var olan bir algoritmayı açar, inputu değiştirir, simülasyonu ileri/geri
   hareket ettirir ve bulunduğu gerçek adımı AI ile tartışır.
2. Tamamen yeni bir algoritma ister; CodeXRay kodu, inputu, görsel tasarımı,
   deterministik simülasyonu ve öğretim turunu birlikte üretir.

CodeXRay'in hedefi yalnızca animasyon oynatan bir algoritma sitesi veya tek
seferlik kod yazan bir sohbet botu değildir. Hedef; kullanıcının kod, veri,
görsel, mantık ve zaman eksenleri arasında hareket edebildiği, internet veya API
anahtarı gerektirmeden temel simülasyonları çalıştırabildiği ve isteğe bağlı
yerel AI ile derinleşebildiği bütünleşik bir öğrenme ortamıdır.

Başarı ölçütü:

> Kullanıcı; seçtiği algoritmanın kodu, inputu, timeline'ı, değişkenleri,
> görselleştirmesi, analizi ve AI açıklamasının aynı gerçek çalışma durumunu
> temsil ettiğinden emin olabilmelidir. Yerel AI kapalı veya kullanılamaz olsa
> bile hazır deterministik simülasyonlar eksiksiz çalışmalıdır.

---

## 3. Mevcut ürün temeli ve GM-1

CodeXRay'in mevcut çekirdek temeli:

- React 19, TypeScript 6 ve Vite 8 tabanlı SPA;
- Türkçe ve İngilizce arayüz;
- 60 algoritmalık deterministic/offline katalog;
- array, string, tree ve graph input türleri;
- hazır inputlar ve doğrulayıcı parserlar;
- manuel Graph Builder, node rename ve drag-to-connect;
- source-line tabanlı timeline playback;
- array, graph ve variables görselleştirme union'ı;
- kod, değişken/trace, simülasyon, AI ve kontrol panellerinden oluşan çalışma
  alanı;
- tema, layout, input ve tercih persistence'ı;
- isteğe bağlı WebGPU/WebLLM yerel asistan;
- YouTube IFrame API tabanlı CodeXRay Radio;
- statik portföy yayını için korumalı publish scripti.

God Mode GM-1 ile tamamlanan ek mimari:

GM-1 ile tamamlanan temel mimari:

- Türkçe ve İngilizce doğrudan komutlar için deterministik Router;
- tek WebLLM motoru üzerinde sırayla çalışan uzman ajan işleri;
- Manager, Scout, Architect, Code Author, Input Engineer, Critic, Trace Analyst
  ve Tutor rolleri;
- model çıktısını doğrudan çalıştırmak yerine doğrulanan `SimLangV1` programı;
- kod, input, trace, analiz ve görselleştirmeyi bir arada taşıyan özel paket;
- atomik uygulama, undo/redo ve rollback altyapısı;
- timeline play, pause, jump, next, previous ve tour komutları;
- görünür God Mode progress/tracker;
- panel, tema, layout ve radyo için sınırlandırılmış UI komutları;
- güncel workspace snapshot'ını AI bağlamına taşıma.

GM-1'in doğruladığı temel gerçek: CodeXRay tarayıcıda tek bir yerel modelle
mantıksal olarak birden fazla ajan çalıştırabilir. GM-2 üretken görsel tasarım,
timeline'a bağlı öğretim, özel graph yaşam döngüsü ve 1D/2D/interval-DP matrix
görselleştirmesiyle uygulanmış ve otomasyona bağlanmıştır.

---

## 4. God Mode'da giderilen eksikler ve doğrulanan çözümler

Bu bölüm tarihsel kök nedenleri korur. Aşağıdaki beş maddenin tamamı mevcut
uygulamada giderilmiş; God Mode unit/integration ve tarayıcı testleriyle
regression kapsamına alınmıştır.

### 4.1 Tutor öğretim oturumu state machine'i — ÇÖZÜLDÜ

Tutor gerçek trace checkpoint'lerinden beş lensli anlatım üretir. Kullanıcı
`devam`, önceki önemli adım, tekrar anlat, play/pause/jump/tour komutlarıyla aynı
öğretim oturumunu yönetir; eski snapshot yeni adımı geçersiz kılamaz.

### 4.2 Algoritmaya özgü semantik görsel sözleşme — ÇÖZÜLDÜ

`VisualizationContractV2` node biçimi, semantik rol, layout, iki frontier,
algoritmaya özgü edge animasyonu ve legend taşır. Genel `matrix` visual contract
ise aktif DP hücresini, iki bağımlılığı, taban durumunu, sonucu ve dolum yönünü
renk dışı erişilebilir rollerle gösterir.

### 4.3 Özgün ve kullanıcıya ait input üretimi — ÇÖZÜLDÜ

Input Engineer açık kullanıcı graphını/arrayini korur, eksik start/target için
transaction başlatmadan açıklama ister ve özgün isteklerde seed'li öğretim inputu
üretir. Özel interval-DP paketi input değiştiğinde kaynak ve matrix sözleşmesini
koruyarak deterministik trace'i yeniden derler.

### 4.4 Özel paket ile Graph Builder yaşam döngüsü — ÇÖZÜLDÜ

Görsel-only yerleşim değişikliği source/topology/trace'i korur. Node/edge ekleme,
rename ve silme structural transaction olarak sınıflanır; referanslar atomik
güncellenir, paket yeniden derlenir ve hata halinde tam rollback uygulanır.

### 4.5 Başlık, route ve çalışma niyeti ayrımı — ÇÖZÜLDÜ

Deterministik Router `BFS nedir?`, `BFS sayfasını aç`, `BFS kodunu yaz` ve
`mevcut graphım için BFS yaz` niyetlerini ayırır. Başlık yalnızca başarılı atomic
commit sırasında değişir; başarısız/cancelled run eski workspace kimliğini korur.

---

## 5. Kullanıcı personları

### P-01 — İlk kez öğrenen öğrenci

- Algoritmanın adını bilir fakat kodunu bilmeyebilir.
- Hazır sayfayı açmak, oynatmak ve kritik adımları sormak ister.
- Teknik agent veya schema ayrıntısı görmek istemez.

### P-02 — Deney yapan öğrenci

- Var olan algoritmanın inputunu değiştirir.
- Node/edge ekler, başlangıç ve hedefi değiştirir.
- Değişikliğin algoritmayı nasıl etkilediğini karşılaştırmak ister.

### P-03 — Özel algoritma isteyen kullanıcı

- Hazır kütüphanede bulunmayan bir algoritma ister.
- Kodu, inputu, görseli ve simülasyonu birlikte bekler.
- Hazır örneğin adı değiştirilerek sunulmasını kabul etmez.

### P-04 — İleri seviye inceleyici

- Timeline'da belirli adıma gider.
- Değişmez koşul, karmaşıklık ve doğruluk gerekçesi sorar.
- AI'ın gerçek snapshot üzerinden konuşmasını bekler.

### P-05 — Geri dönen kullanıcı

- Kayıtlı input, layout, tema ve yerel model tercihinin korunmasını bekler.
- Yarım kalmış ya da başarısız ajan işinin workspace'i bozmamasını ister.

---

## 6. Ana ürün kapsamı

### 6.1 CodeXRay ana kapsamındadır

- 60 algoritmanın seçimi, kodu ve deterministik simülatörü;
- array, string, tree ve graph input doğrulama/presetleri;
- source code görünümü ve aktif satır senkronizasyonu;
- Graph Builder ile node/edge/root/start/target düzenleme;
- timeline oynatma, durdurma, hız, ileri/geri ve analiz;
- array, graph, variables ve pinned watch görselleştirmeleri;
- beş panelin collapse/resize/mobile davranışı;
- Türkçe/İngilizce, neon/dark/light tema;
- isteğe bağlı yerel model lifecycle ve sohbet hafızası;
- CodeXRay Radio playlist, playback, loop, wave ve minimize davranışları;
- local/session storage, reset ve model-cache ayrımı;
- erişilebilirlik, performans, güvenlik ve deployment kapıları.

### 6.2 God Mode GM-2 kapsamındadır

- Hazır algoritma fast-path komutları;
- özel algoritma ve input üretimi;
- kullanıcının mevcut inputunu anlama ve koruma;
- algoritmaya özgü görsel semantik ve graph layout;
- node/edge düzenleme sonrası güvenli yeniden derleme;
- gerçek trace'e bağlı guided playback;
- beş lens anlatımı ve final sonuç raporu;
- görünür, iptal edilebilir ve denetlenebilir ajan kuyruğu;
- atomik transaction, rollback, undo ve redo;
- Türkçe/İngilizce komut eşdeğerliği;
- neon, dark ve light temalar;
- masaüstü, dar ekran ve klavye erişilebilirliği;
- yerel model hatalarında dürüst fallback davranışı.

### 6.3 Bütün uygulama için kapsam dışıdır

- dosya sisteminde serbest model komutu çalıştırma;
- API anahtarları veya uzak AI sağlayıcıları;
- model çıktısını `eval` veya `new Function` ile çalıştırma;
- sınırsız recursive agent spawn;
- aynı anda birden fazla WebLLM modelini VRAM'e yükleme;
- modelin doğrulanmamış CSS, HTML veya JavaScript çalıştırması;
- kullanıcıdan gizli ağ, credential veya işletim sistemi erişimi.

Bu sınırlar uygulama içindeki God Mode yetkisini azaltmaz. God Mode, doğrulanan
CodeXRay workspace komutları içinde özerktir.

---

## 7. God Mode GM-2 fonksiyonel gereksinimleri

### 7.1 Intent ve Router gereksinimleri

#### REQ-ROUTE-001 — Bilgi sorusu mutation oluşturmamalıdır

`BFS nedir?`, `DFS ile BFS arasındaki fark nedir?` gibi bilgi soruları açık bir
workspace fiili içermiyorsa kodu, inputu, başlığı, trace'i veya panel düzenini
değiştirmemelidir.

#### REQ-ROUTE-002 — Hazır sayfa komutu fast path kullanmalıdır

`BFS sayfasını aç`, `DFS kodunu göster`, `open the A* page` gibi kesin komutlar
LLM planner çağrısı beklemeden canonical preset ID'ye çözülmelidir.

#### REQ-ROUTE-003 — Özel üretim ile preset açma ayrılmalıdır

- `BFS sayfasını aç` → preset;
- `BFS kodu yaz` → istek bağlamına göre özel üretim;
- `benim graphım için BFS yaz` → mevcut inputu koruyan özel üretim;
- `iki yönlü BFS yaz` → özel algoritma paketi.

#### REQ-ROUTE-004 — Bileşik istek iki işi de tamamlamalıdır

`BFS sayfasını aç ve nasıl çalıştığını anlat` komutu önce workspace'i
değiştirmeli, sonra yeni snapshot üzerinden açıklama üretmelidir.

#### REQ-ROUTE-005 — Türkçe normalizasyon anlamı bozmamalıdır

Türkçe büyük/küçük harf, diakritik eksikliği, nazik ekler ve kelime sırası
varyantları desteklenmelidir. `A*` gibi özel algoritma tokenları korunmalıdır.

#### REQ-ROUTE-006 — Belirsiz üretim isteği gereksinim istemelidir

Input türü, hedef veya doğruluk ölçütü belli olmayan özel algoritma isteğinde
sistem rastgele paket uygulamamalıdır. Gereken en az bilgiyi kullanıcıdan
istemelidir.

#### REQ-ROUTE-007 — Başlık çalışma niyetini yansıtmalıdır

Özel üretim başlarken committed workspace değiştirilmeden geçici durum
`İki Yönlü BFS hazırlanıyor…` olarak gösterilebilir. Transaction başarıyla
uygulandığında canonical başlık `İki Yönlü BFS — Özel` olmalıdır.

### 7.2 Workspace tutarlılığı gereksinimleri

#### REQ-WS-001 — Tek çalışma kimliği

Editör başlığı, simülasyon başlığı, AI context chip, analiz, aktif paket ve
Result Analyst aynı canonical algoritma kimliğini kullanmalıdır.

#### REQ-WS-002 — Güncel state eski sohbetten üstündür

AI bağlamında mevcut kod, input, index, trace ve görsel state; eski sohbet
mesajlarındaki tüm çelişkili bilgilerden daha yüksek öncelikli olmalıdır.

#### REQ-WS-003 — Navigation sonrası context yeniden kurulmalıdır

Jump, next, previous, tour checkpoint veya input transaction sonrasında Tutor
çağrılmadan önce yeni workspace snapshot alınmalıdır.

#### REQ-WS-004 — Paket dışı edit işaretlenmelidir

Kullanıcı özel paket kaynak kodunu elle değiştirirse paket `out-of-sync`
olmalıdır. Eski trace yeni kod çalışıyormuş gibi gösterilmemelidir.

### 7.3 Ajan orkestrasyonu gereksinimleri

#### REQ-AGENT-001 — Tek motor, sıralı uzman işler

Uzman ajanlar aynı worker ve model motoru üzerinde sıralı çalışmalıdır. Her iş
yalnızca ihtiyaç duyduğu snapshot ve artifact dilimini almalıdır.

#### REQ-AGENT-002 — Bağımlılık grafiği açık olmalıdır

Her işin ID'si, rolü, bağımlılıkları, ağırlığı, durumu, deneme sayısı, başlangıç
ve bitiş zamanı görünür olmalıdır.

#### REQ-AGENT-003 — Zorunlu özel üretim rolleri

Tam özel graph algoritması üretiminde en az şu işler bulunmalıdır:

1. Manager
2. Workspace Scout
3. Algorithm Architect
4. Code Author
5. Input Engineer
6. Visual Designer
7. Layout Engineer
8. Deterministic Compiler
9. Critic/Test
10. Trace Director
11. Apply Transaction
12. Tutor
13. Result Analyst

#### REQ-AGENT-004 — Sınırlı repair

Geçersiz Code Author veya Input Engineer artifact'i en fazla iki kontrollü
repair denemesinden geçmelidir. Sonsuz retry yapılamaz.

#### REQ-AGENT-005 — Tracker gerçek progress göstermelidir

Progress, tamamlanan iş ağırlıklarının toplam plana oranından hesaplanmalıdır.
Sahte süre animasyonu gerçek agent progress'i olarak gösterilmemelidir.

#### REQ-AGENT-006 — Completion öğretimi de kapsamalıdır

Kod ve paket uygulanmış olsa bile zorunlu Tutor ve Result Analyst işleri
bitmeden genel run `%100/completed` durumuna geçmemelidir.

#### REQ-AGENT-007 — Interrupt desteklenmelidir

Kullanıcının yeni navigation veya cancel komutu, artık geçersiz kalan Tutor
işini durdurmalı ve stale cevabın ekrana final cevap olarak basılmasını
engellemelidir.

### 7.4 Kod ve compiler gereksinimleri

#### REQ-CODE-001 — Kaynak ve trace aynı programdan üretilmelidir

Editördeki kaynak kod ve timeline trace'i aynı doğrulanmış `ProgramSpec`
artifact'inden türetilmelidir.

#### REQ-CODE-002 — Model çıktısı doğrudan çalıştırılmamalıdır

Model tarafından yazılan JavaScript veya metin `eval`, `new Function`, DOM
script injection ya da eşdeğer mekanizma ile çalıştırılmamalıdır.

#### REQ-CODE-003 — Bütçeler zorunludur

Instruction, trace step, memory, loop ve recursion limitleri uygulanmalıdır.
Limit aşımı kaynak satırı ve instruction bilgisi içeren yapılandırılmış hata
üretmelidir.

#### REQ-CODE-004 — İki yönlü BFS semantiği doğrulanmalıdır

Özel iki yönlü BFS en az şu yapıları içermelidir:

- başlangıç ve hedef frontier'ları;
- iki visited kümesi;
- iki parent map;
- frontier intersection kontrolü;
- geçerli shortest-path reconstruction;
- ulaşılmaz hedefte sonlanma.

#### REQ-CODE-005 — Görünür kaynak satırı 1 tabanlı olmalıdır

Her `SimulationStep.lineNumber` ya `null` ya da görünür kaynak kodundaki 1
tabanlı gerçek satır olmalıdır.

### 7.5 Input gereksinimleri

#### REQ-INPUT-001 — Kullanıcının inputu önceliklidir

Kullanıcı mevcut graph, tree, array veya string inputuna açıkça referans
veriyorsa Input Engineer bu inputu sessizce preset ile değiştirmemelidir.

#### REQ-INPUT-002 — Özgün input ölçülebilir olmalıdır

Kullanıcı `özgün`, belirli node sayısı, alternatif yol veya yoğunluk istediğinde
üretilen input bu kısıtları sağlamalıdır. Hazır preset ile aynı canonical graph
signature'ı ancak açık fallback durumunda kabul edilebilir.

#### REQ-INPUT-003 — Fallback görünür olmalıdır

Input ajanı başarısız olup hazır preset kullanılırsa tracker artifact özetinde
`deterministic fallback` bilgisi ve nedeni görünmelidir.

#### REQ-INPUT-004 — Graph bütünlüğü

- node ID'leri benzersiz olmalıdır;
- edge uçları var olan node'lara referans vermelidir;
- duplicate edge politikası uygulanmalıdır;
- start/target geçerli olmalıdır;
- yön ve ağırlık kuralları korunmalıdır;
- node rename referansları atomik güncellenmelidir.

#### REQ-INPUT-005 — Input değişikliği trace'i yenilemelidir

Topolojik veya algoritmik input değişikliği sonrası eski trace
kullanılmamalıdır. Derleme/test başarıyla bitmeden yeni input committed
workspace'e tek başına uygulanmamalıdır.

### 7.6 Görsel tasarım gereksinimleri

#### REQ-VIS-001 — Algoritmaya özgü semantik roller

Görsel tasarım; `start`, `target`, `frontier-start`, `frontier-target`,
`meeting`, `visited`, `active`, `path`, `rejected` gibi semantik rolleri
tanımlayabilmelidir.

#### REQ-VIS-002 — Görsel anlam yalnızca renge bağlı olmamalıdır

Kritik roller renk yanında shape, border, glow, icon, pattern veya label gibi en
az bir ikinci görsel ipucu kullanmalıdır.

#### REQ-VIS-003 — İki frontier ayrışmalıdır

İki yönlü aramada başlangıç ve hedef frontier'ları tüm temalarda açıkça ayırt
edilmelidir.

#### REQ-VIS-004 — Edge state trace ile birebir eşleşmelidir

Bir edge'in `queued`, `active`, `visited` veya `path` olması gerçek step olayı
ve graph referansı tarafından belirlenmelidir. Ghost highlight yasaktır.

#### REQ-VIS-005 — Özgün layout hazır koordinat kopyası olmamalıdır

Kullanıcı özgün düzen istediğinde graph layout signature'ı hazır inputun
signature'ından farklı olmalı; node çakışması ve viewport taşması olmamalıdır.

#### REQ-VIS-006 — Görsel-only transaction

Node taşıma, spacing, tema uyarlama veya shape değişikliği kodu, graph
topolojisini ve trace adım sayısını değiştirmeden uygulanabilmelidir.

#### REQ-VIS-007 — Structural transaction

Node/edge ekleme-silme, ID değiştirme, start/target veya weight değişikliği
inputu güncellemeli, paketi yeniden derlemeli ve yeni trace üretmelidir.

#### REQ-VIS-008 — Layout kalite sınırları

- node merkezleri minimum tanımlı mesafeyi korumalıdır;
- node'lar viewport içinde kalmalıdır;
- edge label'ları mümkün olduğunca node üzerine binmemelidir;
- aynı koordinatta iki node bulunmamalıdır;
- dar ekranda deterministik yeniden yerleşim yapılmalıdır.

#### REQ-VIS-009 — Tema uyumluluğu

Neon, dark ve light temada metin, node, edge ve durum kontrastı okunabilir
olmalıdır. State semantiği tema değişiminde kaybolmamalıdır.

### 7.7 Simülasyon ve timeline gereksinimleri

#### REQ-SIM-001 — Deterministik çalışma

Aynı program, input ve görsel sözleşme aynı sıralı trace'i üretmelidir.

#### REQ-SIM-002 — Forward/back tam geri dönüş

Timeline geri alındığında node, edge, değişken, source line ve açıklama seçilen
step'in snapshot'ına dönmelidir.

#### REQ-SIM-003 — Guided checkpoint

Guided mode yalnızca var olan, sınırlar içindeki doğrulanmış checkpoint
indexlerinde otomatik durmalıdır.

#### REQ-SIM-004 — Tartışma önce playback'i dondurmalıdır

`Bu adımı anlat`, `burayı tartışalım` veya eşdeğer komut Tutor snapshot'ı
alınmadan önce playback'i durdurmalıdır.

#### REQ-SIM-005 — Özel paket otomatik simülasyon niyetini uygulamalıdır

Kullanıcı `simüle et`, `çalıştır` veya `adım adım anlat` dediyse paket
uygulandıktan sonra uygun playback/teaching akışı başlamalıdır. Yalnızca kod
istenmişse otomatik oynatma zorunlu değildir.

### 7.8 Canlı öğretim gereksinimleri

#### REQ-TUTOR-001 — Beş lens zorunluluğu

Her kritik checkpoint anlatımı şu beş alanı gerçek snapshot'tan üretmelidir:

1. Code — aktif satır ve control flow;
2. Data — değişen değişken ve veri yapıları;
3. Visual — node/edge/array görsel farkları;
4. Reasoning — invariant ve karar gerekçesi;
5. Time — önceki durum ve beklenen sonraki hareket.

#### REQ-TUTOR-002 — Anlatım gerçek diff içermelidir

Tutor yalnızca mevcut değerleri sıralamamalı; önceki checkpoint veya step'e göre
neyin değiştiğini belirtmelidir.

#### REQ-TUTOR-003 — Hayali state yasaktır

Tutor snapshot'ta olmayan değişken, node, edge, source line veya step indexinden
kesin gerçekmiş gibi söz etmemelidir.

#### REQ-TUTOR-004 — Kullanıcı kontrollü devam

Guided mode'da açıklama bitmeden timeline ilerlememeli; `devam`, `geri`,
`tekrar anlat` komutları öğretim oturumunu yönetebilmelidir.

#### REQ-TUTOR-005 — Final sonuç anlatımı zorunludur

İstek simülasyon/anlatım içeriyorsa Result Analyst gerçek final trace üzerinden
sonuç, metrik, yol, başarısızlık ve karmaşıklığı açıklamalıdır.

### 7.9 UI kontrol gereksinimleri

#### REQ-UI-001 — Panel komutları simülasyonu bozmamalıdır

Focus, collapse, expand, maximize ve balanced layout komutları kod, input,
trace ve current indexi değiştirmemelidir.

#### REQ-UI-002 — Tracker müdahale kontrolleri

Tracker cancel, retry failed step, inspect artifact ve mümkünse rollback/undo
kontrolleri sunmalıdır.

#### REQ-UI-003 — Tracker tamamlanınca geri çekilmelidir

Başarılı işlem sonrasında tracker kısa bir success durumu gösterip kompakt
biçimde kapanabilir. Başarısız run kullanıcı incelemeden kaybolmamalıdır.

#### REQ-UI-004 — AI cevabı önceliklidir

Alt input ve kontrol yüzeyleri kompakt kalmalı; uzun Tutor/Result cevaplarının
okunabileceği alan korunmalıdır. Resize ve collapse erişilebilir olmalıdır.

#### REQ-UI-005 — Radyo bağımsızlığı

AI'ın radyo açma/oynatma/durdurma/döngü komutları simulation state'ini
değiştirmemelidir. Tarayıcının autoplay reddi başarı gibi raporlanmamalıdır.

### 7.10 Hata ve transaction gereksinimleri

#### REQ-TXN-001 — Atomik apply

Başlık, kod, input, trace, analiz, görsel sözleşme ve paket kimliği tek committed
transaction olarak uygulanmalıdır.

#### REQ-TXN-002 — Kısmi state yasaktır

Compiler veya Critic başarısızsa yeni kod ile eski trace ya da yeni input ile
eski kod birlikte görünmemelidir.

#### REQ-TXN-003 — Rollback doğrulanabilir olmalıdır

Rollback sonrası önceki workspace snapshot'ının canonical özeti transaction
öncesiyle eşleşmelidir.

#### REQ-TXN-004 — Cancel workspace'i kullanılabilir bırakmalıdır

Aktif run iptal edildiğinde input alanı, sohbet, timeline ve panel kontrolleri
kilitli kalmamalıdır.

#### REQ-TXN-005 — Dürüst hata raporu

Fallback, retry, timeout, validation fail ve rollback kullanıcıya doğru durumla
bildirilmelidir. Sistem tamamlamadığı bir işi tamamladığını söylememelidir.

---

## 8. GM-2 için yeni artifact sözleşmeleri

Bu bölüm uygulama tasarımını yönlendirir. Alan adları uygulanırken değişebilir;
semantik zorunluluklar korunmalıdır.

### 8.1 `VisualizationContractV2`

En az aşağıdaki bilgileri taşımalıdır:

- schema version;
- visual type;
- semantic node roles;
- semantic edge roles;
- role → design-token eşlemesi;
- start/target/meeting/path değişken eşlemeleri;
- frontier katmanları;
- active/traversed edge kaynakları;
- legend tanımı;
- responsive varyantlar;
- permitted theme tokenları;
- fallback nedeni ve provenance;
- Visual Designer üretim metadata'sı.

Model serbest CSS üretmemelidir. Tasarım kapalı enum/token ve sınırlandırılmış
sayısal değerlerden oluşmalıdır.

### 8.2 `GraphLayoutSpecV1`

- layout strategy: layered, radial, tree, dual-frontier, force-seeded;
- deterministic seed;
- viewport padding;
- minimum node gap;
- semantic groups/layers;
- pinned user positions;
- start-target axis;
- collision report;
- final bounded node coordinates;
- compact/mobile coordinates veya deterministik dönüşüm.

### 8.3 `TeachingPlanV1`

- package/run ID;
- ordered checkpoint list;
- checkpoint goal and priority;
- requested lenses;
- auto-pause flag;
- recommended speed;
- opening narrative;
- final result narrative requirement;
- optional user choices;
- completion criteria.

### 8.4 `StepNarrationV1`

- exact step index;
- exact source line;
- code statement summary;
- before/after variable diff;
- node diff;
- edge diff;
- reasoning/invariant;
- previous context;
- expected next alternatives;
- source artifact references;
- uncertainty field.

### 8.5 `ResultReportV1`

- success/failure/unreachable status;
- normalized result;
- path and path length where applicable;
- visited order/count;
- per-frontier metrics;
- meeting step/node;
- operation counts;
- complexity notes;
- trace-derived evidence references;
- test summary.

---

## 9. Ajan sorumlulukları

### Manager

- intent ve başarı ölçütünü çıkarır;
- görev DAG'ını kurar;
- zorunlu işleri atlamaz;
- cancel/retry kararlarını sınırlar;
- run tamamlanma koşulunu denetler.

### Workspace Scout

- güncel committed kod, input, trace ve UI state'i alır;
- kullanıcının inputa referans verip vermediğini işaretler;
- eski chat bilgisini workspace'in önüne geçirmez.

### Algorithm Architect

- algoritma sözleşmesi, invariant, veri yapıları ve termination üretir;
- görsel olarak anlamlı semantik olayları tanımlar;
- Input Engineer ve Visual Designer için gereksinim verir.

### Code Author

- yalnızca doğrulanabilir program artifact'i üretir;
- görünür source ile trace'in ayrışmasına yol açmaz;
- validation hatasında sınırlı repair yapar.

### Input Engineer

- kullanıcı inputunu koruma kararını açıkça verir;
- istenen node sayısı, alternatif yol ve edge kısıtlarını doğrular;
- fallback'i gizlemez.

### Visual Designer

- algoritmaya özgü semantik görsel dil üretir;
- hazır stil kullanıyorsa bunun fallback olduğunu işaretler;
- serbest CSS değil doğrulanmış tokenlar üretir.

### Layout Engineer

- node çakışması ve viewport taşmasını önler;
- kullanıcının pinlediği/taşıdığı koordinatları korur;
- aynı seed ile deterministik sonuç üretir.

### Deterministic Compiler

- LLM ajanı değildir;
- program, input, visualization ve layoutu doğrular;
- source, line-map, trace, checkpoints için temel veri ve test raporu üretir.

### Critic/Test Agent

- uygulama validator sonuçlarını esas alır;
- algoritma doğruluğu ve edge case'leri inceler;
- doğrulanmamış başarı iddiası veremez.

### Trace Director

- gerçek trace içinden öğretim checkpoint'leri seçer;
- anlamsız tekrarları azaltır;
- meeting, branch, invariant ve result gibi olaylara öncelik verir.

### Tutor

- mutation yetkisi taşımaz;
- seçili gerçek snapshot üzerinden beş lens anlatımı üretir;
- stale olursa sonucu discard edilir.

### Result Analyst

- yalnızca final trace ve test raporundan metrik çıkarır;
- final tabloyu yorumlar;
- unreachable veya failure durumunu dürüstçe açıklar.

---

## 10. God Mode Definition of Done — Bitmiş sayılma kuralları

Bir God Mode run'ı ancak aşağıdaki koşulların tamamı sağlanırsa `completed`
olabilir:

1. Intent doğru sınıflandırıldı.
2. İstenen preset veya özel çalışma kimliği çözüldü.
3. Kullanıcı inputu korundu ya da gereksinime uygun input üretildi.
4. Program schema ve semantic validation'dan geçti.
5. Gerçek deterministik trace üretildi.
6. Node ve edge referanslarının tamamı geçerli.
7. Görsel state trace ile eşleşti.
8. Paket testleri geçti.
9. Atomik transaction başarıyla committed oldu.
10. İstenen playback/navigation uygulandı.
11. Zorunlu checkpoint anlatımları hazırlandı.
12. İstek anlatım içeriyorsa final sonuç raporu üretildi.
13. Başlık, kod, input, trace ve AI bağlamı aynı package ID'ye ait.
14. Zorunlu agent işleri completed.
15. Sessiz fallback yok; kullanılan tüm fallbackler raporlandı.
16. Tracker `%100` değeri gerçek completion ile eşleşiyor.

Aşağıdakilerden biri varsa run tamamlanmış sayılamaz:

- yalnızca sohbet mesajı ile başarı iddia edilmesi;
- code/input/trace drift;
- hayali step veya değişken;
- eski snapshot anlatımı;
- eski preset inputunun özgün diye sunulması;
- node highlight var fakat ilgili edge state'i yok;
- Tutor/Result işi tamamlanmadan tracker'ın kapanması;
- rollback gerektiren hatadan sonra kısmi yeni state kalması.

---

## 11. God Mode test stratejisi

### 11.1 Unit testler

Şunları model veya browser olmadan doğrular:

- intent normalization ve routing;
- schema validatorlar;
- canonical graph signature;
- program budgetları;
- visual role mapping;
- graph layout collision/bounds;
- step diff üretimi;
- result metric hesapları;
- progress hesabı;
- transaction reducer ve rollback.

### 11.2 Integration testler

Mock agent çıktılarıyla şu zincirleri doğrular:

- Manager DAG ve dependency sırası;
- Code Author → Compiler → Critic repair;
- Input Engineer → Visual Designer → Layout Engineer;
- Apply → Trace Director → Tutor → Result Analyst;
- cancel, timeout, stale response ve rollback;
- özel input değişikliği sonrası recompile.

### 11.3 Component testleri

- tracker state ve kontrolleri;
- graph semantic class/token renderı;
- node drag ve structural edit ayrımı;
- teaching checkpoint kartı;
- title/context consistency;
- panel resize/collapse ve cevap alanı.

### 11.4 Playwright E2E testleri

Gerçek kullanıcı akışını görünür UI ve uygulama state'iyle doğrular. Yalnızca
metin eşleşmesine güvenmez; code, input, current index, visual node/edge class,
tracker state ve committed package ID birlikte kontrol edilir.

### 11.5 Yerel model test yaklaşımı

CI model ağırlığı indirmemelidir. Worker protokolü ve ajan çıktıları deterministic
fixture/mock ile test edilir. Gerçek WebLLM smoke testi yerel/manual test
matrisinde ayrıca yürütülür.

---

## 12. Standart test fixture'ları

### FIX-GRAPH-01 — Basit BFS graphı

- 6 node;
- connected;
- tek start;
- traversal orderı deterministik.

### FIX-GRAPH-02 — İki yönlü BFS graphı

- 10 node;
- start `S`, target `T`;
- en az iki alternatif yol;
- tek deterministik shortest path veya açık tie-break kuralı;
- meeting olayı üretir.

### FIX-GRAPH-03 — Ulaşılamayan hedef

- start ve target farklı componentlerde;
- path yok;
- frontier exhaustion beklenir.

### FIX-GRAPH-04 — Start hedefe eşit

- `startId === targetId`;
- tek node path beklenir.

### FIX-GRAPH-05 — Cycle graph

- birden fazla cycle;
- duplicate queue engeli test edilir.

### FIX-GRAPH-06 — Directed graph

- ters yönde geçilemeyen edge'ler;
- reverse-search davranışı açıkça tanımlı.

### FIX-GRAPH-07 — Geçersiz graph

- duplicate node;
- kayıp edge endpoint;
- geçersiz start/target;
- validator reddi beklenir.

### FIX-PROGRAM-01 — Sonsuz loop girişimi

- instruction budget aşımı beklenir;
- UI freeze olmamalıdır.

### FIX-PROGRAM-02 — Recursion overflow girişimi

- deterministic recursion error beklenir;
- worker ve chat kullanılabilir kalmalıdır.

---

## 13. Ayrıntılı P0 kabul testleri

Her P0 test zorunludur. `Given/When/Then` adımları ile birlikte tüm ek
assertionlar otomasyonda uygulanmalıdır.

### GM-E2E-001 — Hazır BFS sayfasını açma

Öncelik: `P0`

Katman: `Playwright E2E`

Gereksinimler: `REQ-ROUTE-002`, `REQ-WS-001`

**Given** uygulama başka bir algoritma veya Custom Code ile açıktır.

**When** kullanıcı `BFS sayfasını aç` yazar.

**Then**:

- canonical BFS preset LLM generation beklenmeden seçilir;
- başlık `Breadth-First Search (BFS)` olur;
- BFS kaynak kodu görünür;
- graph input yüklenir;
- trace boş değildir;
- current index ilk adımdadır;
- Architect ve Code Author işleri oluşturulmaz;
- kullanıcıya ancak transaction sonrası başarı bildirilir;
- görünür workspace değişiminin hedef süresi warm app için 500 ms'dir.

Test şu durumlarda fail olur:

- sadece sohbet cevabı oluşursa;
- yanlış preset açılırsa;
- başlık ile kod farklı algoritmayı gösterirse;
- `başarı` mesajı state değişiminden önce/farklı state için verilirse.

### GM-E2E-002 — Bilgi sorusu no-mutation

Öncelik: `P0`

**Given** workspace snapshot hash'i kaydedilmiştir.

**When** kullanıcı `BFS nedir?` sorar.

**Then**:

- sohbet cevabı oluşur;
- workspace snapshot hash'i değişmez;
- agent mutation queue açılmaz;
- playback state değişmez;
- title, code, input ve index aynı kalır.

### GM-E2E-003 — Bileşik aç ve anlat komutu

**When** kullanıcı `BFS sayfasını aç ve nasıl çalıştığını anlat` der.

**Then**:

- önce BFS transaction committed olur;
- ardından Tutor context'i yeniden kurulur;
- cevap BFS'nin yeni input ve ilk trace adımına referans verir;
- önceki algoritmadan değişken veya node sızmaz.

### GM-E2E-004 — Mevcut simülasyonu oynatma

**Given** BFS trace'i yüklüdür ve paused durumdadır.

**When** kullanıcı `Simülasyonu başlat` der.

**Then**:

- playback `playing` olur;
- index zamanla ilerler;
- aktif source line güncellenir;
- visual state ilgili step'e geçer;
- algoritma/input değişmez.

### GM-E2E-005 — İleri, geri ve anlat

**Given** trace en az 8 adımdır ve index `0`dır.

**When** sırasıyla `5 adım ileri git`, `2 adım geri gel`, `bu adımı anlat`
komutları verilir.

**Then**:

- final index `3` olur;
- playback Tutor çağrısından önce paused olur;
- Tutor step 3 source line ve visual state'ini kullanır;
- step 2 veya 4'e ait değişken kesin gerçek gibi anlatılmaz.

### GM-E2E-006 — Kritik checkpoint'e git

**When** kullanıcı `Kuyruğa yeni node eklenen önemli adıma git` der.

**Then**:

- checkpoint gerçek trace içinden seçilir;
- index sınırlar içindedir;
- ilgili queue diff'i gerçekten vardır;
- node state `queued`/`active` semantiğiyle uyumludur;
- Tutor checkpoint'in önemini beş lens içinde açıklar.

### GM-E2E-010 — Tam iki yönlü BFS üretim yolculuğu

Öncelik: `P0 / MASTER`

**Given** God Mode açıktır ve model ready durumdadır.

**When** kullanıcı şunu yazar:

`Bana iki yönlü BFS yaz. Özgün bir graph ve görsel tasarım oluştur. Simüle et ve adım adım anlat.`

**Then**:

- provisional başlık `İki Yönlü BFS hazırlanıyor…` görünür;
- zorunlu 13 iş doğru dependency sırasıyla tracker'da yer alır;
- program iki frontier, iki visited set ve iki parent map semantiğini içerir;
- özgün ve geçerli graph üretilir;
- Visual Designer semantic role artifact'i üretir;
- Layout Engineer bounds/collision kontrolünden geçer;
- compiler gerçek source ve trace üretir;
- Critic testleri geçmeden apply çalışmaz;
- transaction sonrası başlık `İki Yönlü BFS — Özel` olur;
- source, input, visual ve trace aynı package ID'ye aittir;
- meeting ve reconstructed path gerçek final state'te bulunur;
- istek `simüle et` içerdiği için teaching playback başlar;
- checkpoint'te durup Tutor anlatımı gösterilir;
- finalde Result Analyst sonucu açıklar;
- tracker bu son işlerden önce `%100` olmaz.

Fail koşulları:

- tek yönlü BFS'nin adı değiştirilmişse;
- hazır input özgün diye sunulmuşsa;
- node state değişip edge state değişmiyorsa;
- kod uygulanıp trace eski kalmışsa;
- Tutor genel tanım verip gerçek step'i anlatmıyorsa;
- tracker paket apply sonrasında erken kapanıyorsa.

### GM-E2E-011 — 10 node ve iki alternatif yol kısıtı

**When** kullanıcı `10 node'lu, iki alternatif start-target yolu olan özgün graph oluştur` der.

**Then**:

- normalized graph tam 10 node içerir;
- en az iki simple start-target path doğrulanır;
- ID'ler benzersizdir;
- duplicate edge yoktur;
- isolated node ancak kullanıcı istediyse vardır;
- graph signature hazır preset ile aynı değildir;
- start ve target geçerlidir;
- layout collision raporu temizdir.

### GM-E2E-012 — Mevcut kullanıcı graphını koruma

**Given** kullanıcı `FIX-GRAPH-02`den farklı elle oluşturulmuş bir graph çizmiştir.

**When** `Benim graphım üzerinde iki yönlü BFS yaz` der.

**Then**:

- transaction öncesi ve üretilen paket graph topoloji signature'ı aynıdır;
- node/edge sayıları sessizce değişmez;
- trace kullanıcının node ID'lerini taşır;
- start/target eksikse açık validation/clarification olur;
- hazır graph ile değiştirme yapılmaz.

### GM-E2E-013 — Belirsiz özel algoritma

**When** kullanıcı `Bana yeni ve hızlı bir arama algoritması yaz` der.

**Then**:

- Manager eksik input türü/hedef/doğruluk ölçütünü belirler;
- committed workspace değişmez;
- kullanıcıdan en fazla gerekli kısa sorular istenir;
- rastgele package success olarak uygulanmaz.

### GM-E2E-014 — Yalnızca kod isteme

**When** kullanıcı `İki yönlü BFS kodunu yaz ama henüz oynatma` der.

**Then**:

- geçerli package yine compile/test edilir;
- workspace'e uygulanır;
- playback paused kalır;
- Tutor kısa hazır bilgisi verebilir fakat guided tour başlamaz;
- kullanıcı daha sonra `oynat` ile aynı trace'i başlatabilir.

### GM-E2E-015 — Elle değiştirilen özel kodu yeniden derleme

**Given** aktif özel package'ın görünür kodu kullanıcı tarafından değiştirilmiş
ve `out-of-sync` olmuştur.

**When** kullanıcı `Bu değişikliği derle ve tekrar simüle et` der.

**Then**:

- eski trace yeni kodun trace'i gibi oynatılmaz;
- Code Author/Compiler yeni ProgramSpec oluşturur;
- testler geçerse yeni package transaction uygulanır;
- başarısızsa eski committed package ve kullanıcının edit taslağı kaybolmaz;
- hata açıkça raporlanır.

### GM-E2E-020 — Algoritmaya özgü semantik görsel

**Given** iki yönlü BFS package'ı uygulanmıştır.

**Then**:

- start ve target en az iki görsel özellik ile ayrılır;
- start-frontier ve target-frontier farklı semantic token kullanır;
- meeting node özel role taşır;
- final path node ve edge'leri path role taşır;
- legend bu rolleri açıklar;
- theme değişiminde semantic role aynı kalır.

### GM-E2E-021 — Edge highlight doğruluğu

**For each** trace step:

- visual edge ID graph içinde bulunmalıdır;
- active traversal event varsa doğru edge active olmalıdır;
- traversal tamamlandıysa edge visited olabilir;
- final path'teki her ardışık node çifti için path edge görünmelidir;
- trace olayı olmayan edge active/path olamaz;
- previous komutunda edge state seçilen önceki snapshot'a dönmelidir.

Kabul oranı: gerçek traversal → doğru edge state eşleşmesi `%100`.

### GM-E2E-022 — Görsel-only yeniden tasarım

**Given** özel package ve trace hazırdır.

**When** kullanıcı `Nodeları daha geniş yay ve iki frontier'ı farklı şekillerle göster` der.

**Then**:

- code hash değişmez;
- graph topology hash değişmez;
- trace semantic hash ve step count değişmez;
- layout/design revision değişir;
- minimum node gap artar;
- frontier rollerinin shape tokenları ayrışır;
- işlem visual-only transaction olarak loglanır.

### GM-E2E-023 — Node sürükleme

**When** kullanıcı bir node'u geçerli yeni konuma sürükler.

**Then**:

- pinned position kaydedilir;
- bağlı edge uçları node ile hareket eder;
- code ve trace yeniden derlenmez;
- timeline ileri/geri hareketinde node konumu korunur;
- refresh persistence ürün ayarına göre test edilir.

### GM-E2E-024 — Node ve edge ekleme

**When** kullanıcı `X node'unu ekle, B-X ve X-T edge'lerini oluştur` der.

**Then**:

- X benzersizdir;
- edge validation form ve AI komutunda aynı kuralları kullanır;
- structural transaction yeni input revision üretir;
- compiler yeni trace üretir;
- yeni package test edilmeden apply olmaz;
- compile fail olursa önceki graph/package geri yüklenir.

### GM-E2E-025 — Node rename atomikliği

**When** `B` node'u `Merkez` olarak değiştirilir.

**Then**:

- node ID/label politikası doğru uygulanır;
- tüm edge endpoint referansları güncellenir;
- start/target referansı B ise güncellenir;
- trace yeniden oluşturulur;
- committed yeni state'te stale `B` referansı kalmaz.

### GM-E2E-026 — Node silme ve bağımlı edge temizliği

**When** kullanıcı bağlı edge'leri bulunan bir node'u siler.

**Then**:

- silme politikası kullanıcıya bağlı edge etkisini gösterir;
- onaylanmış işlemde ilgili edge'ler atomik temizlenir;
- start/target siliniyorsa yeni geçerli değer gereklidir;
- geçersiz input committed olmaz;
- trace yalnızca başarılı recompile sonrası değişir.

### GM-E2E-030 — Beş lens içerik doğruluğu

**Given** gerçek bir frontier checkpoint'i seçilmiştir.

**Then** Tutor cevabı:

- exact source line veya line yoksa açık `source line yok` bilgisini;
- before/after variable diff'i;
- değişen node ve edge rollerini;
- invariant/karar gerekçesini;
- önceki ve beklenen sonraki olayı içerir.

Her iddia snapshot veya step diff ile eşleşmelidir.

### GM-E2E-031 — Öğretmen gibi guided tour

**When** kullanıcı `Beni öğretmen gibi önemli adımlarda gezdir` der.

**Then**:

- teaching session açılır;
- timeline recommended speed ile oynar;
- doğrulanmış checkpoint'te paused olur;
- Tutor anlatımı bitmeden sonraki checkpoint'e geçmez;
- `devam` sonraki checkpoint'i seçer;
- son checkpoint sonrası Result Analyst çalışır.

### GM-E2E-032 — Final tablo ve sonuç anlatımı

**Given** iki yönlü BFS tamamlanmıştır.

**Then** Result Report en az şunları gösterir:

- start ve target;
- reached/unreachable durumu;
- meeting node ve step;
- reconstructed path;
- path length;
- start frontier visited count;
- target frontier visited count;
- toplam benzersiz visited count;
- operation/step count;
- time ve space complexity açıklaması;
- final package test özeti.

Tüm sayısal değerler trace/programdan hesaplanır; LLM tahmini olamaz.

### GM-E2E-033 — Anlatımı kesme ve stale cevap engeli

**Given** Tutor checkpoint 12 için cevap üretmektedir.

**When** kullanıcı `Dur, 7. adıma dön` der.

**Then**:

- aktif Tutor işi cancel/stale olur;
- timeline index 7'ye gider;
- playback paused kalır;
- checkpoint 12 cevabı final mesaj olarak eklenmez;
- yeni Tutor çağrısı step 7 snapshot'ını kullanır.

### GM-E2E-034 — Aynı adımı tekrar anlat

**When** kullanıcı `Burayı başka bir örnekle tekrar anlat` der.

**Then**:

- current index değişmez;
- code/input/trace mutation olmaz;
- yeni anlatım aynı gerçek snapshot'a dayanır;
- örnek ile gerçek state açıkça ayrılır.

### GM-E2E-040 — Gerçek progress ve completion

**Given** özel üretim run'ı başlamıştır.

**Then**:

- waiting/running/retrying/completed/failed/cancelled durumları doğru görünür;
- yalnızca tamamlanan iş ağırlığı progress'e eklenir;
- aktif iş inspect edilebilir;
- `%100` Tutor ve Result Analyst tamamlanmadan görünmez;
- başarılı completion kısa süre gösterildikten sonra tracker kompakt kapanabilir.

### GM-E2E-041 — Code Author validation/repair

**Given** ilk Code Author çıktısı geçersizdir.

**Then**:

- validator somut hata üretir;
- tracker `retrying`, attempt 2 gösterir;
- repair prompt yalnızca ilgili hata ve bounded context alır;
- ikinci geçerli sonuç devam eder;
- iki deneme de başarısızsa run failed olur;
- kısmi kaynak committed olmaz.

### GM-E2E-042 — Visual Designer failure ve dürüst fallback

**Given** Visual Designer bilinmeyen token veya kayıp node referansı üretir.

**Then**:

- artifact validation fail olur;
- kod/input/trace bozulmaz;
- izin verilen deterministic visual fallback uygulanabilir;
- tracker ve final mesaj fallback nedenini gösterir;
- sistem özgün görsel başarı iddiası vermez.

### GM-E2E-043 — Kullanıcı cancel

**When** kullanıcı aktif run sırasında Cancel'a basar.

**Then**:

- aktif inference iptal isteği alır;
- bekleyen işler cancelled olur;
- running state sonsuza kadar kalmaz;
- uygulanmamış artifact'ler workspace'e geçmez;
- chat ve kontroller tekrar kullanılabilir olur;
- önceki committed workspace korunur.

### GM-E2E-044 — Compiler hatasında tam rollback

**Given** code ve input artifact'leri oluşturulmuş fakat compiler hata verir.

**Then**:

- yeni title/code/input tek başına committed kalmaz;
- önceki workspace snapshot hash'i geri gelir;
- transaction journal rollback/failure nedenini içerir;
- tracker failed olur;
- AI tamamlandı demez.

### GM-E2E-045 — Apply sonrası undo ve redo

**Given** özel package başarıyla uygulanmıştır.

**When** kullanıcı Undo yapar.

**Then** önceki title, code, input, trace, index ve package geri gelir.

**When** kullanıcı Redo yapar.

**Then** özel package aynı committed artifact ile yeniden gelir; model tekrar
çağrılmaz.

---

## 14. P1 algoritma ve input testleri

### GM-INT-050 — Start target'a eşit

- `FIX-GRAPH-04` kullanılır.
- path `[start]` olmalıdır.
- meeting start node'dur.
- gereksiz frontier expansion olmamalıdır.
- Result Analyst özel durumu açıklar.

### GM-INT-051 — Ulaşılamayan hedef

- `FIX-GRAPH-03` kullanılır.
- her frontier sonlu biçimde tükenir.
- path yoktur.
- sahte meeting node yoktur.
- status `unreachable` olur.
- Tutor finalde başarısızlığı başarı gibi sunmaz.

### GM-INT-052 — Cycle graph

- `FIX-GRAPH-05` kullanılır.
- aynı frontier visited node'u sınırsız tekrar kuyruğa almaz.
- instruction ve trace budget aşılmaz.
- sonuç deterministiktir.

### GM-INT-053 — Directed graph

- `FIX-GRAPH-06` kullanılır.
- olmayan ters edge geçilmez.
- target tarafı reverse adjacency kullanıyorsa program/visual bunu açıkça
  temsil eder.
- arrow marker state ile uyumludur.

### GM-INT-054 — Geçersiz graph reddi

- `FIX-GRAPH-07` varyantları ayrı ayrı denenir.
- validator spesifik hata verir.
- compiler çalışmaz.
- committed workspace değişmez.

### GM-INT-055 — Tie-break determinismi

- eşit uzunlukta iki shortest path bulunan graph kullanılır.
- neighbor ordering kuralı sabitlenir.
- tekrarlı çalışmalarda aynı meeting/path sonucu üretilir.

### GM-INT-056 — Büyük fakat sınır içi graph

- maksimum desteklenen node/edge sınırına yakın input kullanılır.
- UI responsive kalır.
- budget içinde trace oluşur.
- layout viewporta sığar veya kontrollü pan/zoom davranışı gösterir.

### GM-INT-057 — Sınır üstü graph

- açık limitten büyük input kullanılır.
- kullanıcıya limit ve çözüm önerisi verilir.
- browser freeze olmaz.
- package apply edilmez.

---

## 15. UI, tema, radyo ve erişilebilirlik testleri

### GM-E2E-060 — Başlık tutarlılığı

Özel ve preset akışlarında şu alanların canonical isim/package kimliği
karşılaştırılır:

- editor title;
- simulation title;
- AI context chip;
- analysis title;
- active package metadata;
- Result Analyst başlığı.

Stale isim bulunursa test fail olur.

### GM-E2E-061 — Panel komutları

`AI panelini büyüt`, `simülasyonu küçült`, `kod alanına odaklan`, `dengeli
düzene dön` komutları uygulanır.

Assert:

- hedef layout değişir;
- code/input/trace/index hash'i değişmez;
- tüm paneller tekrar açılabilir;
- desktop splitter pointer ve keyboard ile kullanılabilir.

### GM-E2E-062 — Tema değişimi

Neon → Dark → Light geçişinde:

- semantic role isimleri aynı kalır;
- start/target/frontier/meeting/path ayırt edilir;
- simulation reset olmaz;
- text ve controls okunabilir kalır.

### GM-E2E-063 — Radyo kontrol izolasyonu

`Radyoyu aç`, `oynat`, `bu şarkıyı döngüye al`, `durdur` komutları denenir.

Assert:

- simulation workspace hash'i değişmez;
- gerçek YouTube player state UI ile uyumludur;
- autoplay engellenirse pending/user gesture durumu gösterilir;
- single-track repeat aktifken ended olayı sonraki indexe geçmez.

### GM-E2E-064 — Tracker küçültme/geri açma

- tracker run sırasında minimize edilir;
- run devam eder;
- geri açıldığında aynı run/job state'i görünür;
- hiçbir agent duplicate başlamaz.

### GM-E2E-065 — Uzun AI cevabı ve resize

- uzun Five-Lens + Result cevabı oluşturulur;
- AI body scroll edilebilir ve copy button erişilebilir kalır;
- input composer kompakt kalır;
- panel minimum/maksimum sınırlarında kaybolmaz.

### GM-E2E-070 — Türkçe/İngilizce intent parity

Aşağıdaki çiftler aynı canonical intenti vermelidir:

- `BFS sayfasını aç` / `Open the BFS page`;
- `iki yönlü BFS yaz` / `Create a bidirectional BFS`;
- `beşinci adıma git` / `Go to step five`;
- `bu adımı anlat` / `Explain this step`.

### GM-E2E-071 — Runtime dil geçişi

- mevcut simulation steps yeniden çalıştırılmadan locale değiştirilir;
- user-facing title/labels/explanations yeni dilde görünür;
- structured trace değerleri bozulmaz.

### GM-E2E-072 — Klavye erişimi

- Tab ile tracker controls, AI composer, panel buttons ve timeline controls
  erişilebilir;
- Enter/Space buttonları çalıştırır;
- splitter arrow key ile resize olur;
- focus indicator görünürdür;
- accessible name'ler locale ile uyumludur.

### GM-E2E-073 — Dar ekran/mobile

- desktop splitterlar devre dışı olur;
- paneller güvenli stack olur;
- horizontal page overflow oluşmaz;
- graph viewport içinde yeniden yerleşir;
- tracker ve AI composer ana cevabı tamamen kapatmaz.

### GM-E2E-074 — Reduced motion

- `prefers-reduced-motion` etkinleştirilir;
- dekoratif pulse/wave/layout animasyonları durur veya azalır;
- state değişiklikleri semantik olarak görünmeye devam eder.

---

## 16. Güvenilirlik ve güvenlik testleri

### GM-SEC-001 — Sonsuz loop budget

`FIX-PROGRAM-01` çalıştırılır.

Beklenen:

- deterministic budget error;
- worker/UI responsive;
- package apply edilmez;
- hata instruction/source bilgisi taşır.

### GM-SEC-002 — Recursion depth

`FIX-PROGRAM-02` çalıştırılır.

Beklenen:

- recursion limit error;
- call stack browserı çökertmez;
- sonraki chat isteği kullanılabilir.

### GM-SEC-003 — Bilinmeyen statement/operator

- schema/semantic validator reddeder;
- runtime'a ulaşmaz;
- repair sınırı uygulanır.

### GM-SEC-004 — Script injection metni

Model artifact alanlarına script/HTML/event handler benzeri metin yerleştirilir.

Beklenen:

- text olarak escape/render edilir veya schema tarafından reddedilir;
- DOM script çalışmaz;
- dış ağ isteği oluşmaz.

### GM-SEC-005 — Serbest CSS reddi

Visual Designer doğrulanmamış CSS URL/function/token üretir.

Beklenen:

- yalnızca whitelist design tokenları kabul edilir;
- arbitrary CSS uygulanmaz;
- fallback görünürdür.

### GM-SEC-006 — Cancelled agent late response

- agent iptal edilir;
- mock worker geç sonuç gönderir;
- run ID/generation kontrolü sonucu discard eder;
- workspace değişmez.

---

## 17. Performans ve kaynak testleri

Performans eşikleri geliştirme makinesine ve modele bağlı olarak raporlanmalıdır.
Mutlak LLM inference süresinden çok UI responsiveness ve fast-path davranışı
bağlayıcıdır.

### GM-PERF-001 — Preset fast path

- warm application;
- preset resolution ve görünür state değişimi hedefi `<= 500 ms`;
- LLM çağrısı sayısı `0`.

### GM-PERF-002 — UI responsiveness

- agent inference sırasında panel, scroll ve cancel interactionı çalışır;
- ana thread uzun görev gözlemi belirlenen bütçeyi aşmaz;
- progress eventleri UI'ı aşırı render etmez.

### GM-PERF-003 — Bounded prompt

- her agent promptu seçilen context window sınırındadır;
- tam trace gereksiz yere tüm agentlara gönderilmez;
- current/checkpoint slice açık etiketlidir.

### GM-PERF-004 — Deterministic trace budget

- maximum instruction/step sınırı test edilir;
- limitte başarı, limit üstünde yapılandırılmış failure beklenir.

### GM-PERF-005 — Layout determinismi

- aynı graph, seed ve viewport aynı koordinatları üretir;
- farklı viewport bounded deterministic dönüşüm üretir.

### GM-PERF-006 — Tracker event hacmi

- yüksek sayıda progress event coalesce/throttle edilir;
- final event kaybolmaz;
- job sırası korunur.

---

## 18. Persistency ve reset testleri

### GM-PERSIST-001 — Workspace autosave

- kullanıcı inputu ve top-level pins kaydedilir;
- refresh sonrası geri gelir;
- aktif özel package persistence kararı açıkça test edilir.

### GM-PERSIST-002 — Layout migration

- eski layout sürümü yeni defaultlara güvenli migrate olur;
- panel collapse state'i contracta göre korunur/resetlenir;
- görünmeyen panel oluşmaz.

### GM-PERSIST-003 — Interface-only reset

- layout resetlenir;
- model cache, input workspace ve sohbet ürün sözleşmesine göre korunur;
- tüm origin storage temizlenmez.

### GM-PERSIST-004 — General site reset

- yalnızca `codexray.*` uygulama state'i kaldırılır;
- WebLLM OPFS/Cache model ağırlıkları genel reset tarafından silinmez;
- unrelated origin data etkilenmez.

### GM-PERSIST-005 — Conversation clear

- sohbet temizlenir;
- committed code/input/trace değişmez;
- yeni AI context güncel workspace'ten başlar.

---

## 19. Gereksinim → test izlenebilirlik matrisi

| Gereksinim grubu | Zorunlu testler |
|---|---|
| Router ve intent | GM-E2E-001–006, GM-E2E-013–014, GM-E2E-070 |
| Workspace tutarlılığı | GM-E2E-003, 005, 010, 015, 033, 060 |
| Ajan orkestrasyonu | GM-E2E-010, 040–043, GM-PERF-002, 006 |
| Kod/compiler | GM-E2E-010, 015, 041, 044, GM-SEC-001–003 |
| Input koruma/özgünlük | GM-E2E-011–012, 024–026, GM-INT-050–057 |
| Görsel tasarım | GM-E2E-020–026, 062, 073–074, GM-SEC-005 |
| Timeline | GM-E2E-004–006, 021, 031, 033–034 |
| Tutor ve Result | GM-E2E-003, 006, 010, 030–034 |
| Transaction | GM-E2E-015, 024–026, 043–045 |
| UI ve erişilebilirlik | GM-E2E-061–074 |
| Güvenlik | GM-SEC-001–006 |
| Persistence/reset | GM-PERSIST-001–005 |

Bir gereksinim kodlandığında tabloda karşılık gelen en az bir unit/integration
ve gerekiyorsa E2E testi bulunmadan PR tamamlanmış sayılmaz.

---

## 20. Önerilen otomasyon dosyaları

### Unit ve integration

- `src/services/godModeRouting.gm2.test.ts`
- `src/services/visualizationContractV2.test.ts`
- `src/services/graphLayoutEngine.test.ts`
- `src/services/teachingPlan.test.ts`
- `src/services/stepNarration.test.ts`
- `src/services/resultAnalyst.test.ts`
- `src/services/godModeOrchestrator.gm2.test.ts`
- `src/services/customSimulationCompiler.gm2.test.ts`
- `src/services/customPackageMutation.test.ts`
- `src/context/TimelineContext.visualTransaction.test.tsx`
- `src/components/GodModeProgress.gm2.test.tsx`
- `src/components/DynamicVisualizer.semantic.test.tsx`

### Playwright

- `e2e/god-mode-existing-algorithm.spec.ts`
- `e2e/god-mode-custom-algorithm.spec.ts`
- `e2e/god-mode-original-input-layout.spec.ts`
- `e2e/god-mode-graph-editing.spec.ts`
- `e2e/god-mode-guided-teaching.spec.ts`
- `e2e/god-mode-agent-failures.spec.ts`
- `e2e/god-mode-ui-control.spec.ts`
- `e2e/god-mode-localization-a11y.spec.ts`
- `e2e/god-mode-persistence.spec.ts`

---

## 21. CI ve release kalite kapısı

GM-2 sürümü ancak aşağıdaki kapıların tamamı geçerse bitmiş sayılır:

1. `npm run lint` kaynak kodda error vermiyor.
2. `npm run test` başarılı.
3. `npm run test:coverage` tanımlanan kritik modül eşiklerini karşılıyor.
4. `npm run build` başarılı.
5. `npm run test:e2e` Chromium senaryolarında başarılı.
6. Tüm P0 testler geçiyor.
7. Bilinen P0 skip/fixme/todo bulunmuyor.
8. Her bug fix için regression testi bulunuyor.
9. Mock agent senaryoları deterministic ve tekrar çalıştırılabilir.
10. Testler yalnızca AI mesaj metnine değil gerçek state/artifact'a bakıyor.
11. Code/input/trace drift testi geçiyor.
12. Stale Tutor response testi geçiyor.
13. Node ve edge semantic doğruluk testi geçiyor.
14. Cancel/rollback sonrası UI kullanılabilirlik testi geçiyor.
15. Serkan'ın master kullanıcı yolculuğu manual smoke testte de onaylanıyor.

### Sıfır tolerans alanları

- sessiz fallback;
- sahte/hayali step anlatımı;
- eski snapshot ile konuşma;
- hazır inputu özgün diye sunma;
- geçersiz edge highlight;
- yarım transaction;
- tamamlanmamış run için `%100` veya başarı mesajı;
- kullanıcı inputunu habersiz ezme.

---

## 22. Serkan için zorunlu manual master senaryo

Bu senaryo release adayı üzerinde baştan sona manuel çalıştırılmalıdır:

1. Uygulamayı temiz state ile aç.
2. `BFS nedir?` sor; workspace'in değişmediğini doğrula.
3. `BFS sayfasını aç` de; sayfanın anında değiştiğini doğrula.
4. `5 adım ileri git, 2 adım geri gel ve burayı anlat` de.
5. Cevaptaki satır, queue, node ve edge'i ekrandan karşılaştır.
6. Graph Builder'da özel bir graph oluştur.
7. `Benim graphım için iki yönlü BFS yaz; özgün tasarla, simüle et ve öğretmen
   gibi anlat` de.
8. Tracker'da tüm uzman işlerini izle.
9. Kullanıcı graphının korunup korunmadığını kontrol et.
10. İki frontier, meeting node ve path edge tasarımını kontrol et.
11. Guided checkpoint'te açıklamayı gerçek state ile karşılaştır.
12. Anlatım sırasında `Dur, önceki kritik adıma dön` de.
13. Stale cevabın basılmadığını doğrula.
14. `Nodeları daha geniş yay` de; kod ve trace'in değişmediğini doğrula.
15. Yeni node ve edge ekle; paketin yeniden derlendiğini doğrula.
16. Final Result tablosundaki path, visited count ve meeting değerlerini trace
    ile karşılaştır.
17. Undo ve Redo yap.
18. Tema ve panel düzenini AI komutuyla değiştir; simulation state'in
    korunmasını doğrula.
19. Yeni bir run başlatıp Cancel yap; workspace'in sağlam kaldığını doğrula.
20. Tüm P0 gözlemleri geçmeden sürümü onaylama.

---

## 23. Uygulama sırası

### Faz 1 — Sözleşmeler ve doğrulayıcılar

- `VisualizationContractV2`;
- `GraphLayoutSpecV1`;
- `TeachingPlanV1`;
- `StepNarrationV1`;
- `ResultReportV1`;
- runtime schema ve invalid fixture testleri.

### Faz 2 — Visual Designer ve Layout Engineer

- yeni ajan işleri;
- deterministic layout engine;
- semantic renderer;
- theme tokenları;
- collision/bounds kalite kapısı.

### Faz 3 — Input koruma ve özel graph lifecycle

- user input provenance;
- canonical graph signature;
- visual-only vs structural transaction;
- recompile/rollback;
- Graph Builder entegrasyonu.

### Faz 4 — Canlı öğretim state machine

- Trace Director;
- checkpoint playback;
- StepNarration diff;
- interrupt/stale discard;
- Tutor ve Result Analyst completion kapısı.

### Faz 5 — Router, title ve UI bütünlüğü

- preset/custom/question ayrımı;
- provisional/committed title;
- package identity;
- tracker ve panel UX.

### Faz 6 — Tam test matrisi ve hardening

- P0 otomasyon;
- edge case ve security testleri;
- performance/a11y/persistence;
- manual master scenario;
- regression düzeltmeleri.

---

## 24. God Mode alt sistemi kabul ifadesi

GM-2 ancak şu ifade gerçek ve testlerle kanıtlanmışsa kabul edilir:

> CodeXRay God Mode kullanıcının hazır veya özel algoritma isteğini doğru
> anlar; kullanıcının inputuna sadık kalarak doğrulanmış kod, özgün görsel ve
> deterministik simülasyon üretir; gerçek timeline üzerinde ilerleyip geri
> dönebilir; kritik adımları beş lens ile anlatır; final sonucu trace'ten
> hesaplar; node ve edge düzenlemelerini güvenle yeniden derler; bütün ajan
> sürecini görünür ve iptal edilebilir tutar; hata halinde hiçbir kısmi state
> bırakmadan geri döner.

Bu ifade kanıtlanmadan `God Mode tamamlandı` denilemez.

---

## 25. Bütün uygulama için Definition of Done

Bir CodeXRay özelliği aşağıdaki genel kurallar sağlanmadan tamamlanmış sayılmaz:

1. Özelliğin Türkçe ve İngilizce kullanıcı çıktıları vardır.
2. Neon, dark ve light temada kullanılabilirliği doğrulanmıştır.
3. Masaüstü ve dar ekran davranışı tanımlıdır.
4. Klavye ve erişilebilir ad testleri bulunur.
5. State değişikliği ilgili tek authoritative store üzerinden yapılır.
6. Başarısız işlem kısmi veya çelişkili state bırakmaz.
7. Persist edilmesi gereken state ile geçici state ayrılmıştır.
8. Mevcut çalışma alanı ve kullanıcı değişiklikleri sessizce ezilmez.
9. Özelliğin unit veya integration testi bulunur.
10. Gerçek kullanıcı akışı içeriyorsa Playwright senaryosu bulunur.
11. Regression düzeltmesi, hatayı önce fail eden testle birlikte gelir.
12. Build ve lint başarılıdır.
13. Özellik başka bir paneli, input türünü veya AI/radyo state'ini bozmaz.
14. Yükleme, boş, başarı, hata ve disabled durumları tanımlıdır.
15. Kullanıcıya gösterilen başarı mesajı gerçek committed state ile eşleşir.

### 25.1 Uygulama genelinde sıfır tolerans alanları

- destekleniyor görünen fakat simülatörü olmayan algoritma;
- yanlış source line highlight;
- trace collection truncation;
- structured değerin önceden stringify edilerek kaybedilmesi;
- node rename sonrası dangling edge/root/start/target;
- negatif ağırlığı kabul eden Dijkstra veya A*;
- eski step'ten kalmış pinned variable değeri;
- görünmeyen veya geri açılamayan panel;
- kullanıcı etkileşimi olmadan ses başladı iddiası;
- model cache silinmediği halde silindi mesajı veya tersi;
- reset işleminin unrelated origin verisini ya da WebLLM model cache'ini silmesi;
- deployment scriptinin hedef repo dışında dosya değiştirmesi;
- test edilmemiş yeni algoritmanın registry'de supported yapılması.

---

## 26. Algoritma kataloğu ve registry gereksinimleri

### REQ-CATALOG-001 — Tek authoritative registry

Algoritma adı, canonical ID, kaynak kodu, input türü, destek durumu ve blocked
nedeni tek registry sözleşmesinden yönetilmelidir. UI, AI Router ve testler aynı
canonical ID'leri kullanmalıdır.

### REQ-CATALOG-002 — Supported kayıt gerçek simülatör gerektirir

Bir algoritma ancak ayrı ve deterministik simulator dispatch'i varsa
`isSupported: true` olabilir. Benzer algoritmanın simulatorü isim değiştirerek
kullanılamaz.

### REQ-CATALOG-003 — Blocked kayıt neden taşımalıdır

Desteklenmeyen bir kayıt seçilebiliyorsa açık, lokalize blocked reason
göstermelidir. Boş trace ile başarısızlığı gizlememelidir.

### REQ-CATALOG-004 — Kod ve simulator line-map uyumu

Simulatorün ürettiği her non-null `lineNumber`, registry'deki görünür kodun
gerçek 1 tabanlı satır aralığında olmalıdır.

### REQ-CATALOG-005 — Deterministik hazır input

Her supported algoritmanın input türüne uygun en az bir deterministic preset
inputu olmalıdır. Aynı preset seviyesi aynı normalized inputu üretmelidir.

### REQ-CATALOG-006 — Kategori kapsaması

Array, string, graph, tree ve compound/dynamic-programming aileleri katalog,
input ve simulator test matrisinde temsil edilmelidir.

### REQ-CATALOG-007 — Algoritma adı lokalizasyonu

Canonical algoritma kimliği dil değişiminde değişmemeli; display name mevcut
locale göre güncellenmelidir.

### REQ-CATALOG-008 — Analiz doğruluğu

Analiz/complexity çıktısı seçili algoritma ve güncel inputa ait olmalı; önceki
algoritmadan kalan analiz temizlenmeli veya yeniden üretilmelidir.

### APP-CAT-001 — Tüm supported katalog smoke matrisi

Katman: `Vitest / data-driven`

Her supported registry kaydı için:

1. canonical ID benzersizdir;
2. name boş değildir;
3. code boş değildir;
4. input kind geçerli union üyesidir;
5. deterministic preset parse edilir;
6. simulator en az bir step üretir;
7. ilk ve son step structured `VisualData` taşır;
8. tüm non-null line numberlar kaynak satır sınırındadır;
9. tekrarlı çalıştırma aynı trace canonical hash'ini üretir;
10. runtime exception oluşmaz.

Tek bir algoritmanın başarısızlığı tüm matris testini fail eder ve algoritma
kimliği hata mesajında görünür.

### APP-CAT-002 — Canonical ID benzersizliği

- Büyük/küçük harf normalize edilmiş ID'ler karşılaştırılır.
- Alias ile canonical ID çakışması test edilir.
- Aynı display name'e sahip iki farklı kayıt kabul edilmez.

### APP-CAT-003 — Supported/simulator parity

- Registry supported ID kümesi ile simulator dispatch ID kümesi karşılaştırılır.
- Supported olup dispatch olmayan kayıt fail olur.
- Dispatch olup registry'de erişilemeyen kayıt orphan olarak fail olur.

### APP-CAT-004 — Blocked algoritma deneyimi

**Given** blocked bir kayıt seçilir.

**Then**:

- Simulate button yanlış başarı vermez;
- açık EN/TR blocked reason görünür;
- mevcut geçerli trace sessizce farklı algoritmayla değiştirilmez;
- AI context bu algoritmanın simüle edildiğini iddia etmez.

### APP-CAT-005 — Katalog seçim transactionı

**Given** bir algoritma ve trace aktiftir.

**When** farklı supported preset seçilir.

**Then** title, code, input kind/value, steps, current index ve analysis aynı
yeni algoritma transactionına geçer; eski pinned variable stale değer
göstermez.

### APP-CAT-006 — Dil değişiminde katalog

- Locale EN → TR → EN değiştirilir.
- Canonical selection aynı kalır.
- Display name ve validation/runtime açıklamaları güncellenir.
- Simulation yeniden çalıştırılmadan mevcut stepler yeni dilde gösterilir.

### APP-CAT-007 — Algoritma aileleri örnek doğruluk testleri

En az aşağıdaki ailelerin bilinen oracle sonuçları ayrı golden testlerle
doğrulanmalıdır:

- sorting: sorted output ve permutation preservation;
- searching: found/not-found index;
- graph traversal: deterministic visited order;
- shortest path: geçerli path ve maliyet;
- minimum spanning tree: edge count ve toplam weight;
- string matching: match indices;
- dynamic programming: optimal value/table sonucu;
- tree traversal: traversal order;
- linked/compound structures: final structured state.

### APP-CAT-008 — Yeni algoritma ekleme kapısı

Fixture olarak eksik simulatorlü yeni registry kaydı eklenir. Testlerin fail
ettiği doğrulanır. Simulator, input preset, localization ve tests tamamlanmadan
supported yapılamamalıdır.

---

## 27. Input parser ve preset gereksinimleri

### REQ-PARSER-001 — Tüm untrusted input tek doğrulama katmanından geçmelidir

UI formu, AI transactionı, import ve preset aynı parser/validator kurallarını
kullanmalıdır.

### REQ-PARSER-002 — Structured değerler korunmalıdır

Array, object, graph ve tree değerleri `TraceValue`/typed input olarak
korunmalı; erken aşamada preformatted JSON stringine dönüştürülmemelidir.

### REQ-PARSER-003 — Array input

- JSON array ve belgelenmiş comma-separated format desteklenmelidir;
- boş eleman, NaN, Infinity ve geçersiz token reddedilmelidir;
- algoritma sınırları açık hata vermelidir.

### REQ-PARSER-004 — String input

- boş string politikası algoritmaya göre uygulanmalıdır;
- Unicode metin bozulmamalıdır;
- pattern/text parametreleri birbirine karıştırılmamalıdır.

### REQ-PARSER-005 — Tree input

- level-order import/export desteklenmelidir;
- null child semantiği korunmalıdır;
- root referansı geçerli olmalıdır;
- cycle içeren tree belgesi reddedilmelidir.

### REQ-PARSER-006 — Graph input

- `GraphDocumentV1` schema doğrulanmalıdır;
- node/edge/root/start/target referansları kontrol edilmelidir;
- directed/weighted özellikler korunmalıdır;
- algoritmaya özel weight kuralları uygulanmalıdır.

### REQ-PARSER-007 — Dijkstra ve A* negatif weight reddi

Dijkstra ve A* herhangi bir negatif edge weight içeren graphı çalıştırmamalıdır.
A* heuristic admissibility sözleşmesi korunmalıdır.

### REQ-PRESET-001 — Preset determinismi

Input kind, seviye ve algoritma adı aynıysa preset sonucu aynı olmalıdır.

### REQ-PRESET-002 — Preset çeşitliliği

`i1`, `i2`, `i3` gibi seviyeler mevcutsa gerçekten farklı, geçerli ve anlamlı
inputlar üretmelidir.

### APP-IN-001 — Array parser geçerli formatlar

Geçerli örnekler:

- `[3, 1, 2]`;
- `3, 1, 2`;
- negatif ve ondalık sayılar destekleniyorsa ilgili örnekler.

Assert: normalized array beklenen sırayı ve numeric değerleri taşır.

### APP-IN-002 — Array parser geçersiz formatlar

Her biri ayrı test edilir:

- boş token: `1,,2`;
- `NaN`, `Infinity`;
- object/string karışımı;
- eksik bracket;
- maksimum eleman sınırı üstü;
- whitespace-only.

Assert: yapılandırılmış, lokalize hata; partial input apply yok.

### APP-IN-003 — Unicode string bütünlüğü

Türkçe karakter, emoji ve combining Unicode içeren string parse/simulate edilir.
Karakter dizisi istemsiz mojibake veya byte bölünmesi yaşamamalıdır.

### APP-IN-004 — Pattern parametre ayrımı

String matching algoritmasında text ve pattern alanları değiştirilir.
Simulator doğru alanları kullanmalı, eski parameter state'i taşımamalıdır.

### APP-IN-005 — Tree level-order round trip

Graph/tree document → level-order export → import sonucu canonical tree
signature aynı olmalıdır. Null child pozisyonları korunmalıdır.

### APP-IN-006 — Tree cycle reddi

Cycle veya birden fazla parent içeren tree belgesi import edilir. Validator
spesifik node/edge hatası vermeli; eski geçerli tree korunmalıdır.

### APP-IN-007 — GraphDocumentV1 schema matrisi

Şunlar ayrı fixture olarak test edilir:

- geçerli directed weighted graph;
- geçerli undirected unweighted graph;
- duplicate node ID;
- missing endpoint;
- duplicate edge;
- invalid start/target/root;
- numeric/string ID politikası;
- viewport dışı koordinat normalizationı.

### APP-IN-008 — Negatif edge algoritma politikası

Aynı negatif edge graphı:

- Dijkstra → reject;
- A* → reject;
- Bellman-Ford → destek sözleşmesine göre accept;
- unweighted traversal → weight ignore/validation politikası açık.

### APP-IN-009 — Preset i1/i2/i3

Her input kind ve desteklenen algoritma ailesi için:

- üç preset parse edilir;
- canonical hash'leri beklenen çeşitlilikte farklıdır;
- her biri simulator tarafından çalıştırılır;
- seçim current indexi sıfırlar.

### APP-IN-010 — Hatalı input sonrası düzeltme

**Given** parser hatası görünür.

**When** kullanıcı inputu geçerli hale getirip Simulate yapar.

**Then** hata temizlenir, yeni trace oluşur ve önceki hata AI context'te aktif
hata gibi kalmaz.

### APP-IN-011 — Input autosave

- kullanıcı inputu değiştirir;
- debounce/persistence tamamlanır;
- sayfa reload edilir;
- aynı typed input geri gelir;
- invalid yarım editin persistence politikası açıkça test edilir.

### APP-IN-012 — Çok büyük input reddi

Limit üstü array/string/graph inputları parser seviyesinde bounded hata verir.
Browser veya simulator uzun süre kilitlenmez.

---

## 28. Graph Builder gereksinimleri ve testleri

### REQ-GRAPH-001 — Node ekleme

Otomatik numeric ID, kullanılan pozitif ID'ler arasındaki en küçük boşluğu
yeniden kullanmalıdır.

### REQ-GRAPH-002 — Node rename atomikliği

Node ID değişikliği edge endpointleri ile root/start/target referanslarını aynı
transaction içinde güncellemelidir.

### REQ-GRAPH-003 — Drag-to-connect parity

Sürükleyerek oluşturulan edge ile form üzerinden oluşturulan edge aynı duplicate,
direction ve weight validatorını kullanmalıdır.

### REQ-GRAPH-004 — Node drag semantiği

Node taşımak yalnızca koordinatı değiştirmeli; node ID, edge veya simulation
semantiğini değiştirmemelidir.

### REQ-GRAPH-005 — Directed ve weighted düzenleme

UI graph mode'una göre yön oku ve weight inputu göstermeli; document export
özellikleri kaybetmemelidir.

### REQ-GRAPH-006 — Import/export round trip

GraphDocumentV1 export edilen belge yeniden import edildiğinde canonical graph
aynı olmalıdır.

### REQ-GRAPH-007 — Hata güvenliği

Geçersiz graph edit işlemi mevcut geçerli documenti kısmi şekilde bozmamalıdır.

### APP-GRAPH-001 — En küçük numeric ID boşluğu

Node ID'leri `1, 2, 4` iken otomatik node eklenir. Yeni ID `3` olmalıdır. `3`
silinip tekrar eklendiğinde yeniden `3` kullanılmalıdır.

### APP-GRAPH-002 — Rename tam referans güncellemesi

Node `2` hem edge endpointi hem start hem root referansıdır. `2 → merkez`
rename sonrası eski `2` hiçbir structural referansta kalmamalıdır.

### APP-GRAPH-003 — Rename collision

Var olan ID'ye rename denenir. İşlem reddedilir; document canonical hash'i
değişmez; kullanıcıya açık hata verilir.

### APP-GRAPH-004 — Drag edge duplicate kontrolü

- A→B form ile eklenir;
- aynı A→B drag ile tekrar eklenmeye çalışılır;
- duplicate engellenir;
- undirected modda B→A da aynı duplicate politikasıyla ele alınır.

### APP-GRAPH-005 — Weighted drag edge

Weighted modda drag sonrası weight alma akışı tamamlanmadan geçersiz edge
committed olmamalıdır. Negative/non-number politikası algoritmaya göre
doğrulanmalıdır.

### APP-GRAPH-006 — Node drag ve edge geometrisi

Node viewport içinde sürüklenir. Bağlı line endpointleri yeni koordinata
güncellenir; diğer node koordinatları değişmez; graph topology hash'i sabit
kalır.

### APP-GRAPH-007 — Node silme

Bağlı edge'leri olan node silinir. İlgili edge'ler temizlenir. Node start,
target veya root ise document geçersiz committed bırakılmaz.

### APP-GRAPH-008 — Start ve target seçimi

- sadece var olan node seçilebilir;
- rename sonrası selection korunur;
- delete sonrası yeni seçim gereksinimi görünür;
- simulation geçerli seçim olmadan başlamaz.

### APP-GRAPH-009 — Graph round trip

Node label, ID, coordinates, directed, weighted, edges, root/start/target ile
export/import yapılır. Canonical document eşit olmalıdır.

### APP-GRAPH-010 — Tree import/export

Level-order tree import edilir, builderda düzenlenir, export edilir ve yeniden
import edilir. Root ve child ilişkileri korunur.

### APP-GRAPH-011 — Keyboard/form kullanılabilirliği

Node ve edge ekleme, rename, weight değiştirme ve silme işlemlerinin temel
akışı yalnızca pointer gerektirmemelidir.

### APP-GRAPH-012 — Undo/invalid edit izolasyonu

Geçersiz edge veya rename denemesi ardından sonraki geçerli edit çalışmalıdır;
editor kilitli state'te kalmamalıdır.

---

## 29. Kod editörü, simulator ve timeline gereksinimleri

### REQ-EDITOR-001 — Kaynak kod okunabilirliği

Kod satır numaraları, aktif satır ve edit alanı birbiriyle hizalı olmalıdır.
Aktif satır panel scrollu içinde görünür hale getirilebilmelidir.

### REQ-EDITOR-002 — Preset ve custom ayrımı

Preset kodu seçildiğinde canonical algoritma görünmeli; kullanıcı manuel kod
girdiğinde `Custom Code`/out-of-sync state'i doğru yönetilmelidir.

### REQ-TIMELINE-001 — Playback state machine

Play, pause, next, previous, jump, speed ve end-of-trace durumları tutarlı bir
state machine üzerinden çalışmalıdır.

### REQ-TIMELINE-002 — Index sınırları

Current index hiçbir zaman `0..steps.length-1` aralığı dışına çıkmamalıdır.
Boş trace özel durumu ayrıca ele alınmalıdır.

### REQ-TIMELINE-003 — Dil değişimi rerun gerektirmemelidir

Mevcut stepler structured kalmalı; kullanıcı dili değiştiğinde açıklama yeniden
simülasyon çalıştırmadan lokalize edilmelidir.

### REQ-TIMELINE-004 — Trace truncation yasaktır

Simulator tarafından üretilen step koleksiyonu UI kolaylığı için sessizce
kesilmemelidir. Görsel sanallaştırma yapılabilir; state koleksiyonu tam kalır.

### REQ-TIMELINE-005 — Analyze güncel state kullanmalıdır

Analiz seçili algoritma, kod ve normalized inputtan üretilmelidir. Stale analiz
algoritma/input değişiminde temizlenmelidir.

### APP-EDIT-001 — Satır highlight sınırı

Tüm algoritma smoke trace'lerindeki non-null lineNumber ile editor satır sayısı
karşılaştırılır. Bir off-by-one veya taşma fail olur.

### APP-EDIT-002 — Aktif satıra scroll

Uzun kaynak kodunda uzak bir step seçilir. Aktif satır görünür viewporta gelir;
manuel kullanıcı scrollu için ürün davranışı test edilir.

### APP-EDIT-003 — Custom edit out-of-sync

Aktif özel/preset kod değiştirilir. Trace'in eski kodu temsil ettiği açıkça
işaretlenir; Simulate/compile yolu kullanıcıyı yeni trace'e geçirir.

### APP-SIM-001 — Play to end

- trace başlangıcında play;
- index monoton ilerler;
- son indexte playback otomatik durur;
- interval cleanup edilir;
- tekrar play ürün sözleşmesine göre son adımda no-op veya baştan başlat olur.

### APP-SIM-002 — Pause

Play sırasında pause yapılır. En az iki interval süresi beklenir; index sabit
kalır.

### APP-SIM-003 — Next/previous sınırları

- index 0'da previous → 0;
- son indexte next → son;
- normal indexte tam ±1;
- boş trace'te exception yok.

### APP-SIM-004 — Jump clamp/validation

Negatif, NaN, çok büyük ve geçerli jump değerleri denenir. State daima sınırlar
içinde kalır; AI ve UI yolu aynı politikayı kullanır.

### APP-SIM-005 — Speed değişimi

Playback sırasında hız değiştirilir. Yeni interval uygulanır, duplicate timer
oluşmaz ve step sırası atlanmaz.

### APP-SIM-006 — Yeni simulation reset

Current index ortadayken input/algoritma değişip simulate edilir. Yeni trace
index 0 ve paused state ile başlar; eski interval çalışmaz.

### APP-SIM-007 — Locale switch no rerun

Simulator çağrı sayısı spy ile izlenir. Locale değişiminde çağrı sayısı artmaz;
explanation display yeni dile geçer.

### APP-SIM-008 — Tam trace korunumu

Uzun fakat limit içi trace oluşturulur. Context özetlenebilse bile Timeline
state'teki step count eksiksiz kalır.

### APP-SIM-009 — Analyze stale temizliği

Algoritma A için analiz oluşturulur, algoritma B seçilir. A analizi B altında
görünmez. B analizi B code/input snapshotını kullanır.

### APP-SIM-010 — Runtime error görünürlüğü

Simulator yapılandırılmış hata üretir. UI error state gösterir; eski trace'in
yeni simülasyon sonucu olduğu izlenimi verilmez.

---

## 30. Görselleştirme ve Variables & Trace gereksinimleri

### REQ-COREVIS-001 — Kapalı visual union

Core visual data `array | graph | variables` union'ına uymalı; renderer unknown
type'ı sessizce yanlış görünüm olarak göstermemelidir.

### REQ-COREVIS-002 — Graph state sözlüğü

Node/edge state'leri uygun yerde `idle`, `queued`, `active`, `visited`, `path`
değerlerinden oluşmalıdır.

### REQ-VAR-001 — Structured trace değerleri

Değişken değerleri primitive, array veya object yapısını korumalıdır.

### REQ-VAR-002 — Pin sırası

Top-level pinned değişkenler Variables & Trace listesinde önce görünmelidir.

### REQ-VAR-003 — Watch strip canlı eşleşme

Pinned değişken görselleştirme watch stripinde current step değerini
göstermelidir. Seçili stepte anahtar yoksa stale eski değer gösterilmemelidir.

### REQ-VAR-004 — Değişim göstergesi

Previous ve current step karşılaştırmasında değişen pinned değer görsel olarak
işaretlenebilmelidir.

### APP-VIS-001 — Array renderer

Array values, active indices, sorted/visited states ve pointer etiketleri
fixture'a göre doğru DOM/token ile render edilir.

### APP-VIS-002 — Graph renderer

Node coordinates, labels, directed markers, weights ve state classları fixture
ile doğrulanır. Missing endpoint edge güvenli şekilde raporlanır/atlanır;
validator katmanı ayrıca fail eder.

### APP-VIS-003 — Variables renderer

Nested array/object değerleri kayıpsız ve okunabilir gösterilir; `[object Object]`
gibi veri kaybı oluşmaz.

### APP-VIS-004 — State geçişi

Aynı node/edge queued → active → visited → path adımlarından geçirilir. Her
indexte yalnızca ilgili snapshot classı görünür.

### APP-VIS-005 — Pinned first

Birden fazla variable ve pin fixture'ında pinned top-level anahtarlar stabil
sırayla listenin başına gelir.

### APP-VIS-006 — Stale pin engeli

Step N'de bulunan pinned anahtar Step N+1'de yoktur. Watch strip eski değeri
normal güncel değer gibi göstermemeli; unavailable state göstermelidir.

### APP-VIS-007 — Pin değişim animasyonu

Değer previous stepe göre değiştiğinde changed tokenı görünür; index geri
alındığında karşılaştırma yönü doğru güncellenir.

### APP-VIS-008 — Empty visual state

Step yokken veya input builder açıkken doğru empty/builder görünümü çıkar;
önceki simulation görseli stale kalmaz.

### APP-VIS-009 — Large structured trace

Büyük nested structured variable render edilir. State içeriği truncate olmaz;
UI gerekirse scroll/collapse ile yönetir.

### APP-VIS-010 — Theme visual parity

Aynı fixture üç temada render edilir. Semantic classes ve content değişmez;
sadece design tokenları değişir.

---

## 31. Uygulama shell, panel layout ve Control Bar gereksinimleri

### REQ-LAYOUT-001 — Beş panel collapse

Code, Variables, Visualizer, Assistant ve Controls panellerinin tamamı
collapse/expand edilebilir olmalıdır.

### REQ-LAYOUT-002 — Desktop splitter

Sol/sağ, code/variables, visualizer/assistant ve assistant/controls sınırları
pointer ve keyboard ile yeniden boyutlandırılabilmelidir.

### REQ-LAYOUT-003 — Pair resize matematiği

Üst sağ splitter Visualizer/Assistant çiftini; alt splitter Assistant/Controls
çiftini değiştirirken üçüncü panelin yüksekliğini korumalıdır.

### REQ-LAYOUT-004 — Minimumlar ve viewport clamp

Paneller belirlenen minimumun altına düşmemeli; viewport değişiminde toplam
boyut taşmamalıdır.

### REQ-LAYOUT-005 — Controls kompakt default

Controls varsayılan olarak kompakt olmalı fakat içerdiği zorunlu playback ve
simulate kontrolleri erişilebilir kalmalıdır.

### REQ-LAYOUT-006 — Upward menu clipping yok

Controls üzerinden yukarı açılan menüler Assistant veya parent overflow
tarafından kesilmemelidir.

### REQ-LAYOUT-007 — Mobile stack

Mobil/dar genişlikte splitterlar disabled olmalı ve paneller güvenli sırayla
stack edilmelidir.

### REQ-CONTROL-001 — Simulate ve playback ayrımı

Simulate yeni trace üretir; play mevcut trace'i oynatır. Kullanıcıya bu iki
eylem karışmış görünmemelidir.

### REQ-CONTROL-002 — Settings bütünlüğü

AI, UI ve Radio sekmelerindeki ayarlar scroll/clipping olmadan erişilebilir ve
persist edilen gerçek state ile senkron olmalıdır.

### APP-LAYOUT-001 — Her panel collapse/expand

Beş panel sırayla kapatılıp açılır. Header control erişilebilir kalır; sibling
panel kaybolmaz; state persistence ürün sözleşmesine göre test edilir.

### APP-LAYOUT-002 — Sol/sağ keyboard resize

Separator focus edilir; ArrowLeft/Right uygulanır. Width beklenen step kadar
değişir ve min/max clamp edilir.

### APP-LAYOUT-003 — Visualizer/Assistant pair

Toplam pair yüksekliği resize öncesi/sonrası aynıdır; Controls height değişmez;
iki panel minimumun altına düşmez.

### APP-LAYOUT-004 — Assistant/Controls pair

Assistant ve Controls toplamı korunur; Visualizer height değişmez; Controls
minimumu korunur.

### APP-LAYOUT-005 — Viewport resize migration

720, 900 ve 1080 px yükseklikler arasında resize yapılır. Panel toplamı viewport
bütçesine uyar; fixed-height panel flex-shrink ile ezilmez.

### APP-LAYOUT-006 — Varsayılan dengeli düzen

Temiz storage ile açılışta AI alanı sağ kolonun tamamını kaplamaz; Visualizer ve
Controls kullanılabilir minimumun üzerindedir; defaultlar testte exact veya
oran toleransıyla doğrulanır.

### APP-LAYOUT-007 — AI maximize/minimize

AI maximize edilir ve geri küçültülür. Controls sözleşmedeki minimumda kalır;
önceki dengeli layout güvenle geri gelir; resize tekrar kullanılabilir olur.

### APP-LAYOUT-008 — Upward settings menu

Controls settings/example menüsü dar assistant yüksekliğinde açılır. Menü
assistant arkasında/clipped kalmaz ve viewport içinde erişilebilir olur.

### APP-LAYOUT-009 — Mobile breakpoint

Dar viewportta separatorlar etkileşimsiz/hidden olur; panel sırası ve scroll
doğrudur; yatay overflow yoktur.

### APP-CONTROL-001 — Simulate button

Geçerli code/inputta yeni trace; geçersiz inputta localized error üretir.
Geçersiz durumda eski trace yeniymiş gibi resetlenmez.

### APP-CONTROL-002 — Playback control seti

Previous, play/pause, next, speed ve timeline göstergesi current state ile
senkrondur. Disabled koşulları boş/baş/son trace için doğrulanır.

### APP-CONTROL-003 — Settings tabları

AI, Interface ve Radio sekmelerinde tüm kontroller keyboard ile erişilir;
sekme değişiminde unsaved temporary input politikası test edilir.

---

## 32. Yerel AI temel sistemi gereksinimleri ve testleri

Bu bölüm God Mode'dan bağımsız WebLLM model yaşam döngüsünü ve normal sohbeti
kapsar.

### REQ-AI-001 — AI isteğe bağlıdır

Model yüklenmemiş, WebGPU desteklenmiyor veya AI hata durumunda olsa bile hazır
algoritma simülasyonları çalışmalıdır.

### REQ-AI-002 — Worker izolasyonu

Model lifecycle ve inference worker tabanlı olmalı; uzun inference ana UI threadi
kilitlememelidir.

### REQ-AI-003 — Tek model registry

Model ID, label, VRAM, context window ve response budget bilgisi UI, service,
worker ve testlerde `localAiModels` registry'sinden gelmelidir.

### REQ-AI-004 — Cache ve persistent storage

Model ağırlıkları OPFS tercihli, Cache API fallback ile browser-managed storage
içinde kalmalıdır. Uygulama arbitrary filesystem path yeniden kullanılabilir
izlenimi vermemelidir.

### REQ-AI-005 — Cached model auto initialize

Kullanıcının ayarı açıksa cached seçili model sonraki ziyarette weights tekrar
download edilmeden initialize edilmelidir. GPU initialization yine gerekebilir.

### REQ-AI-006 — Model silme

Kullanıcı tek bir cached modeli silebilmelidir. Diğer modeller ve uygulama
state'i etkilenmemelidir.

### REQ-AI-007 — Loading feedback

Load barı gerçek progress'i göstermeli; gerçek progress henüz düşükken tanımlı
pseudo progress UX'i kullanılabilir fakat gerçek değeri hiçbir zaman geriye
çekmemelidir. Background track görünür olmalıdır.

### REQ-AI-008 — Load result notification

Kullanıcı load barına bastığında yarı saydam loading bildirimi, başarıyla
bitince model loaded bildirimi görünmelidir. Hata başarı olarak gösterilmemelidir.

### REQ-AI-009 — Context bütçesi

Stable default 4096 token windowdır. Model profili destekliyorsa test edilmiş
8192 override açıkça seçilebilir. Prompt ve output budget seçili profile göre
ölçeklenmelidir.

### REQ-AI-010 — Güncel bounded context

Normal Tutor soruları current input, code, execution progress, current visual
state veya deterministic summary ve recent conversation içermelidir.

### REQ-AI-011 — Response cleanup

Think blokları, küçük-model repetition loopları ve bounded continuation ürün
sözleşmesine göre temizlenmelidir. İçerik sessizce anlamsız hale getirilmemelidir.

### REQ-AI-012 — Sohbet hafızası

Recent conversation local tutulmalı; clear conversation yalnızca sohbeti
temizlemeli, workspace'i bozmamalıdır.

### REQ-AI-013 — Copy response

Her AI cevabının sağ üstünde erişilebilir copy button olmalı; doğru mesaj
metnini kopyalamalı ve geçici success state göstermelidir.

### APP-AI-001 — AI olmadan core app

WebGPU unavailable mock edilir. Preset seçme, input parse, simulate, timeline ve
visualizer çalışmaya devam eder. AI paneli açık unsupported mesajı gösterir.

### APP-AI-002 — Model registry parity

UI select optionları, service kabul edilen ID'ler ve worker profilleri registry
kümesiyle karşılaştırılır. Hard-coded orphan model label fail olur.

### APP-AI-003 — İlk load lifecycle

Mock progress ile idle → loading → ready akışı test edilir. Button disabled
state, progress metni/barı ve başarı bildirimi gerçek status ile eşleşir.

### APP-AI-004 — Pseudo/real progress birleşimi

- ilk 0–20 arası pseudo değer artar;
- real progress pseudo üstündeyse real görünür;
- real düşükse görünen progress gerilemez;
- ready olmadan `%100/model loaded` gösterilmez;
- error pseudo timerı temizler.

### APP-AI-005 — Cached auto initialize

Cache listesinde seçili model ve auto-load açık fixture verilir. Yalnızca bir
initialize isteği oluşur; aynı render/effect duplicate load başlatmaz.

### APP-AI-006 — Auto-load kapalı

Cached model vardır fakat ayar kapalıdır. Model listede görünür; initialize
kullanıcı eylemi olmadan başlamaz.

### APP-AI-007 — Tek model silme

İki cached model fixture'ında biri silinir. Cache listesi ve seçili status doğru
güncellenir; diğer cache entry ve workspace korunur.

### APP-AI-008 — Storage açıklaması

UI OPFS/browser cache'i doğru açıklar; arbitrary disk path vaadi veya API key
alanı bulunmaz.

### APP-AI-009 — 4K prompt budget

Uzun code/trace/history fixture'ı 4096 profile ile hazırlanır. Prompt bounded
kalır; current state korunur; eski history deterministically budanır.

### APP-AI-010 — 8K profile override

Yalnızca destekleyen modelde 8192 option görünür/kabul edilir. Diğer model için
invalid context seçiminde clamp veya açık validation uygulanır.

### APP-AI-011 — Complexity soru optimizasyonu

`Karmaşıklığı nedir?` sorusunda unrelated tam trace payload gönderilmez; code,
input summary ve gerekli context korunur.

### APP-AI-012 — Repetition cleanup

Tekrarlayan cümle/paragraph fixture'ları cleanup'tan geçirilir. Kod blokları ve
anlamlı tekrarlar yanlışlıkla kırpılmaz.

### APP-AI-013 — Bounded continuation

Length-limited cevap için en fazla bir continuation çağrısı yapılır. Sonsuz
continuation loop oluşmaz; parçalar doğru sırada birleştirilir.

### APP-AI-014 — Conversation clear

Chat history doluyken clear yapılır. Mesajlar/storage temizlenir; current code,
input, trace ve model cache değişmez.

### APP-AI-015 — Copy response

Birden fazla AI mesajında her copy button yalnızca kendi temizlenmiş mesajını
kopyalar; success icon/state doğru message indexte görünür.

### APP-AI-016 — Worker error recovery

Inference error mock edilir. UI error gösterir; input composer tekrar
kullanılabilir olur; sonraki retry yeni request ID ile çalışır.

---

## 33. CodeXRay Radio gereksinimleri ve testleri

### REQ-RADIO-001 — External player lifecycle

Autoplay kapalıyken YouTube iframe kullanıcı radyoyu açana kadar mount
edilmemelidir. Autoplay açık durumda tarayıcı politikasına uygun playback talebi
yapılabilir; sesli autoplay garanti edilmiş gibi gösterilmemelidir.

### REQ-RADIO-002 — Açılış parçası ve metadata

İlk açılış parçası `Up — CDK` olmalı; hazır playlist metadata'sı network cevabı
beklenmeden gömülü listeden isimleri gösterebilmelidir.

### REQ-RADIO-003 — Hazır playlist hızlı yükleme

Hazır playlist seçiminde gömülü ID/title/thumb metadata anında uygulanmalı;
YouTube player sync geldiğinde doğrulanıp güncellenmelidir.

### REQ-RADIO-004 — Custom playlist

Kullanıcı yeni playlist ID/URL verdiğinde external playerın yükleme gecikmesi
beklenebilir; hata/fallback linki görünür kalmalıdır.

### REQ-RADIO-005 — Gerçek playback state

Play/pause buttonu istenen değil YouTube player tarafından doğrulanmış state'i
göstermelidir.

### REQ-RADIO-006 — Single-track repeat

Loop button aktifken mevcut şarkı ended olduğunda aynı şarkı baştan başlamalı,
sonraki playlist indexine geçmemelidir.

### REQ-RADIO-007 — Shuffle ve navigation

Shuffle, previous ve next gerçek player komutlarıyla senkron olmalı; current
track metadata'sı player index/video ID ile eşleşmelidir.

### REQ-RADIO-008 — Wave semantiği

Wave animasyonu yalnızca gerçek playing state'te hareketli/visible olmalı;
paused durumda state yanıltmamalıdır. Reduced motion tercihine uymalıdır.

### REQ-RADIO-009 — Otomatik minimize

Seçilen minimize süresi gerçek kapanma timerı ile countdown ring animasyonunda
aynı olmalıdır. `Hiç` seçeneği timerı devre dışı bırakmalıdır. Hover timerı
ürün sözleşmesine göre durdurup yeniden başlatmalıdır.

### REQ-RADIO-010 — Volume/mute

Volume slider, output, player volume ve mute icon state'i senkron olmalıdır.

### REQ-RADIO-011 — Fallback erişimi

YouTube API yüklenemezse playlisti YouTube Music'te açan güvenli external link
erişilebilir kalmalıdır.

### APP-RADIO-001 — Autoplay kapalı lazy mount

Temiz state ve autoplay false ile açılır. Iframe/API script player mount edilmez.
Launcher tıklanınca radio paneli ve player lifecycle başlar.

### APP-RADIO-002 — Autoplay açık ama browser engeli

Mock player play requesti kabul etmez/playing event göndermez. Panel açık,
button Play durumunda kalır; ilk pointer/keyboard gesture ile bounded retry
yapılır; yanlış Pause durumu gösterilmez.

### APP-RADIO-003 — Açılış metadata

Network/player metadata gecikmeli mock edilir. İlk görünümde `Up — CDK` ve
embedded playlist parça adları `Şarkı 1` placeholderı yerine görünür.

### APP-RADIO-004 — Hazır playlist anlık seçim

Hazır playlist buttonuna basılır. Embedded track listesi player sync beklemeden
render edilir; player loadPlaylist bir kez çağrılır; sync sonrası current index
korunur/güncellenir.

### APP-RADIO-005 — Custom playlist yükleme

Geçerli custom URL list ID'ye normalize edilir. Embedded metadata yoksa loading
state dürüst görünür; player playlisti döndürünce isim/thumb güncellenir.

### APP-RADIO-006 — Play/pause doğrulanmış state

Play button tıklanır fakat player event gecikir. UI event.data=1 gelene kadar
playing/Pause iddiasına geçmez. Pause event.data=2 ile doğrulanır.

### APP-RADIO-007 — Single-track loop ended

Loop açıkken ended event gönderilir. `seekTo(0)`/aynı track play çağrısı oluşur;
`nextVideo` veya farklı `playVideoAt` indexi çağrılmaz.

### APP-RADIO-008 — Loop kapalı normal ilerleme

Loop kapatılır ve ended event gönderilir. Playerın playlist ilerleme davranışı
engellenmez; current index state yeni player indexiyle sync olur.

### APP-RADIO-009 — Shuffle

Shuffle toggle gerçek player `setShuffle` ile çağrılır. UI active state ve
internal ref aynı değerdedir; playlist reload sonrası tercih korunur.

### APP-RADIO-010 — Wave playing/paused

Player state -1/2/1 sırasıyla gönderilir. Wave/album animation yalnızca 1'de
playing classı taşır. Reduced motionda animation pause edilir.

### APP-RADIO-011 — Minimize süre/ring eşitliği

Fake timer ile 1, 4 ve 15 saniye değerleri test edilir. Ring animationDuration
seçilen değerdir; panel tam aynı inactivity süresinde minimize olur; gizli ek
1 saniye yoktur.

### APP-RADIO-012 — Hiç minimize etme

Değer 16/`Hiç` iken uzun fake timer ilerletilir. Ring gösterilmez ve panel açık
kalır.

### APP-RADIO-013 — Hover timer davranışı

Countdown sırasında hover edilir. Pending timer temizlenir ve ring gizlenir.
Mouse leave sonrası full seçili süreyle yeni tek timer başlar.

### APP-RADIO-014 — Volume ve mute

Slider 25→60 yapılır, mute/unmute tıklanır. Player calls, icon, output ve state
eşleşir; player ready değilken kontrol güvenli disabled/pending olur.

### APP-RADIO-015 — API failure fallback

Script load error mock edilir. Uygulama crash olmaz; radio state anlaşılır;
external playlist linki doğru `rel` ve target ile kullanılabilir.

---

## 34. Tema, lokalizasyon ve metin bütünlüğü

### REQ-I18N-001 — Her kullanıcı metni iki dillidir

Yeni button, label, error, notification, agent state ve runtime explanation EN/TR
karşılık taşımalıdır. Production component içinde yeni hard-coded tek dil metin
eklenmemelidir.

### REQ-I18N-002 — Runtime açıklama dönüşümü

Mevcut deterministic simulation steps dil değişiminde yeniden çalıştırılmadan
uygun display metnine çevrilmelidir.

### REQ-I18N-003 — Canonical data çevrilmez

Algorithm ID, node ID, structured variable keys ve package ID locale değişiminde
bozulmamalıdır.

### REQ-THEME-001 — Üç tema

Neon, dark ve light temaları tüm ana panel, dialog, control, graph state ve radio
yüzeylerinde uygulanmalıdır.

### REQ-THEME-002 — Tasarım dili

Vanilla CSS kullanılmalıdır. Cam yüzey, gradient, gölge ve mikro animasyonlar
okunabilirliği azaltmadan tema diline uymalıdır. Tailwind veya başka framework
eklenmemelidir.

### APP-I18N-001 — Translation key parity

EN ve TR key kümeleri karşılaştırılır. Eksik/fazla zorunlu key fail olur.

### APP-I18N-002 — UI switch coverage

Ana shell, controls settings, graph editor, AI states, radio controls, errors ve
notifications locale değişiminde test edilir. Eski dilde kalan label fail olur.

### APP-I18N-003 — Existing steps locale switch

Current step/index ve steps object identity/simulator call sayısı izlenir.
Locale switch displayi değiştirir; trace yeniden üretilmez.

### APP-I18N-004 — Turkish casing/diacritics

İ/ı/Ş/ş/Ğ/ğ ve diacriticsiz komut varyantları router ve arama alanında doğru
normalize edilir; display metni mojibake içermez.

### APP-THEME-001 — Theme persistence

Tema seçilir, reload edilir ve korunur. Reset türüne göre defaulta dönüş
politikası test edilir.

### APP-THEME-002 — Ana yüzey snapshot matrisi

Her tema için code, variables, visualizer, assistant, controls, settings ve radio
render edilir. CSS token/class varlığı ve kritik kontrast manual/otomatik araçla
kontrol edilir.

### APP-THEME-003 — Graph semantik parity

Queued/active/visited/path state'leri üç temada da hem görsel token hem accessible
label ile ayrışır.

### APP-THEME-004 — Reduced motion

Tema mikro animasyonları ve neon pulse/wave reduced-motion altında durur veya
azalır; bilgi kaybı oluşmaz.

### APP-THEME-005 — Vanilla CSS kapısı

Dependency ve source scan Tailwind/başka utility framework import/config kullanımını
reddeder. Yeni stiller mevcut CSS mimarisinde kalır.

---

## 35. Storage, reset ve geri dönüş gereksinimleri

### REQ-STORE-001 — Namespace izolasyonu

CodeXRay local/session storage anahtarları `codexray.*` namespace'inde olmalıdır.

### REQ-STORE-002 — Interface-only reset

Yalnızca layout v1/v2 ve ilgili interface state'ini kaldırmalıdır. Input,
conversation ve model cache sözleşme dışında silinmemelidir.

### REQ-STORE-003 — General reset

Yalnızca CodeXRay uygulama local/session state'ini kaldırmalı; tüm origin storage
ve unrelated keyleri temizlememelidir.

### REQ-STORE-004 — WebLLM cache korunumu

Genel site reseti OPFS/Cache model ağırlıklarını silmemelidir. Model silme ayrı,
açık kullanıcı eylemidir.

### REQ-STORE-005 — Bozuk storage recovery

Geçersiz JSON veya eski version state uygulamanın açılmasını engellememeli;
güvenli default/migration uygulanmalıdır.

### APP-STORE-001 — Namespace inventory

Testte kullanılan tüm storage anahtarları çıkarılır; izin verilen legacy/migration
istisnası dışında `codexray.` prefixsiz uygulama anahtarı fail olur.

### APP-STORE-002 — Interface-only reset matrisi

Önce layout, input, chat, theme, radio ve AI tercihleri doldurulur. Interface
reset sonrası yalnızca tanımlı UI keys gider; input/chat/model-cache etkilenmez.

### APP-STORE-003 — General reset unrelated key

`unrelated.example=value` ve CodeXRay keys eklenir. Reset sonrası unrelated key
kalır; tanımlı CodeXRay app keys temizlenir.

### APP-STORE-004 — Model cache reset izolasyonu

Mock OPFS/Cache model entry oluşturulur. General reset sonrası entry kalır;
explicit Delete Model sonrası yalnızca seçilen entry gider.

### APP-STORE-005 — Bozuk layout JSON

Malformed JSON ve eski version fixture'larıyla app mount edilir. Crash olmaz;
paneller görünür defaultlarda açılır ve yeni valid state persist edilir.

### APP-STORE-006 — Bozuk input recovery

Persisted input schema geçersizdir. App güvenli default inputla açılır, localized
uyarı politikası uygulanır ve unrelated state korunur.

### APP-STORE-007 — Recovery tag/major update notu

Major update öncesi repo recovery point/tag manual release checklistte
doğrulanır. Bu runtime testi değil release governance testidir.

---

## 36. Uygulama geneli erişilebilirlik, performans ve güvenlik

### REQ-A11Y-001 — Accessible names

Icon-only button, slider, separator, dialog, graph legend ve notification uygun
accessible name/role taşımalıdır.

### REQ-A11Y-002 — Focus yönetimi

Dialog açıldığında focus anlamlı alana geçmeli; kapandığında tetikleyiciye
dönmelidir. Focus görünür olmalıdır.

### REQ-A11Y-003 — Keyboard temel görevler

Algoritma seçimi, input düzenleme, simulate, playback, settings ve AI soru
gönderme klavye ile yapılabilmelidir.

### REQ-PERF-CORE-001 — İlk uygulama kullanılabilirliği

AI modeli yüklenmeden core app etkileşime hazır olmalıdır. WebLLM worker bundle
ana kullanıcı akışını gereksiz yere bloklamamalıdır.

### REQ-PERF-CORE-002 — Büyük state renderı

Limit içi büyük trace/graph UI threadini kabul edilemez süre kilitlememelidir.

### REQ-SEC-CORE-001 — Untrusted input escape

Code, input, labels, AI response ve playlist metadata DOM'a script olarak
çalıştırılmamalıdır.

### REQ-SEC-CORE-002 — External link güvenliği

Yeni sekmede açılan external linkler `rel="noreferrer"`/uygun güvenli ilişki
taşımalıdır.

### REQ-SEC-CORE-003 — Secret yok

Repo veya client bundle API key, credential ya da remote AI provider secretı
içermemelidir.

### APP-A11Y-001 — Axe/manual ana ekran matrisi

Temiz app, settings dialog, Graph Builder, active simulation, AI loading ve radio
açık durumları erişilebilirlik taramasından geçirilir; kritik ihlal kabul edilmez.

### APP-A11Y-002 — Icon button adları

Collapse, maximize, copy, delete, radio controls ve graph actions accessible name
taşır; duplicate belirsiz adlar context ile ayrılır.

### APP-A11Y-003 — Slider/separator keyboard

Speed, volume, radio minimize süresi ve panel separatorları keyboard ile
değiştirilebilir; aria min/max/now günceldir.

### APP-A11Y-004 — Dialog focus

Settings aç/kapa ile focus trap/return davranışı test edilir; Escape politikası
uygulanır; background kontrol yanlışlıkla tetiklenmez.

### APP-PERF-001 — AI'sız startup

Network/worker model isteği geciktirilir. Core UI açılır, preset simulate
yapılabilir ve input düzenlenebilir.

### APP-PERF-002 — Büyük graph interaction

Sınır içi maksimum graphta node drag, playback ve panel resize ölçülür. Long-task
bütçeleri raporlanır; freeze/crash kabul edilmez.

### APP-PERF-003 — Bundle regression

Ana bundle ve worker bundle boyutu CI artifactında raporlanır. Belirlenen threshold
üstü artış açıklama/review gerektirir.

### APP-SEC-001 — XSS fixture matrisi

Node label, custom code, string input, AI response ve track title alanlarına XSS
payload girilir. DOM execution/network side effect olmamalıdır.

### APP-SEC-002 — No eval/new Function

Production source scan ve runtime policy testi model-authored pathte `eval`,
`new Function` veya script injection bulunmadığını doğrular.

### APP-SEC-003 — Secret scan

Build öncesi repo/client env scan bilinen secret patternlerini kontrol eder;
fixture dışı credential fail olur.

---

## 37. Deployment ve yayınlama gereksinimleri

### REQ-DEPLOY-001 — Temiz kaynak repo

Publish yalnızca temiz, committed source state'ten çalışmalıdır.

### REQ-DEPLOY-002 — Hedef repo güvenliği

Hedef repo clean, synchronized `main` olmalıdır. Uncommitted veya diverged hedef
publish öncesi reddedilmelidir.

### REQ-DEPLOY-003 — Scope sınırı

Publisher yalnızca `blog/public/codexray/**` kapsamını stage/değiştirmelidir.
Hedefte unrelated dosyalara dokunmamalıdır.

### REQ-DEPLOY-004 — Çift build doğrulaması

Kaynak CodeXRay buildi ve hedef portfolio buildi doğrulanmadan publish başarı
sayılmamalıdır.

### REQ-DEPLOY-005 — Dry run

Dry-run gerçek mutation yapmadan planlanan dosya değişikliklerini ve blockerları
raporlamalıdır.

### APP-DEPLOY-001 — Dirty source reject

Fixture source repo dirty yapılır. Publisher mutation yapmadan fail etmelidir.

### APP-DEPLOY-002 — Dirty target reject

Hedef repo unrelated uncommitted değişiklik içerir. Publish bu değişikliği
koruyup fail eder; reset/checkout yapmaz.

### APP-DEPLOY-003 — Unsynchronized target reject

Target main remote ahead/behind fixture'ı oluşturulur. Publisher açık reason ile
durur.

### APP-DEPLOY-004 — Dry-run no mutation

Dry-run öncesi/sonrası target tree hash ve git status karşılaştırılır; değişiklik
olmamalıdır.

### APP-DEPLOY-005 — Allowed path only

Publish manifestindeki tüm target pathler `blog/public/codexray/` altında
olmalıdır. Path traversal veya unrelated path fail olur.

### APP-DEPLOY-006 — Build failure rollback/stop

Source veya target build hata fixture'ında publish success olmaz ve unrelated
target state değişmez.

### APP-DEPLOY-007 — Successful staged scope

Başarılı fixture'da yalnızca izin verilen codexray static artifactleri staged
olur; commit/push/deploy dış koordinasyon contractına göre yapılır.

---

## 38. Tüm uygulama çapraz E2E kullanıcı yolculukları

### APP-E2E-001 — AI olmadan ilk öğrenme yolculuğu

1. Temiz browser state ile aç.
2. Türkçe locale ve neon tema seç.
3. Bubble Sort presetini seç.
4. `i2` inputunu yükle.
5. Simulate yap.
6. Play, pause, next ve previous kullan.
7. Bir variable pinle.
8. Locale'i İngilizceye geçir.

Kabul:

- AI modeli hiç yüklenmeden bütün görev tamamlanır;
- code, active line, array visual ve variable values aynı step'e aittir;
- pin watch canlıdır;
- locale switch rerun yapmaz;
- layout kullanılabilir kalır.

### APP-E2E-002 — Graph oluştur ve Dijkstra çalıştır

1. Dijkstra seç.
2. Graph Builder ile weighted directed/undirected sözleşmeye uygun graph oluştur.
3. Start ve target seç.
4. Edge weightleri gir.
5. Simulate ve play yap.
6. Path edge'lerini doğrula.
7. Negatif edge ekleyip tekrar dene.

Kabul:

- pozitif graph doğru path/cost üretir;
- edge highlight trace ile eşleşir;
- negatif graph açıkça reddedilir;
- önceki geçerli workspace kısmi bozulmaz.

### APP-E2E-003 — Tree import ve traversal

1. Tree traversal algoritması seç.
2. Level-order tree import et.
3. Builderda node rename ve child edit yap.
4. Export/import round trip yap.
5. Simulate ve traversal orderı kontrol et.

Kabul: root ve edge referansları, code/trace/visual ve export document tutarlıdır.

### APP-E2E-004 — Yerel model lifecycle ve normal soru

1. Cached olmayan modeli seç.
2. Load bildirimi ve progress'i izle.
3. Ready sonrası current algoritma hakkında soru sor.
4. Cevabı kopyala.
5. Sohbeti temizle.
6. Sayfayı reload edip cached auto initialize davranışını izle.

Kabul:

- progress gerilemez/sahte tamamlanmaz;
- cevap güncel workspace'e aittir;
- copy doğru metindir;
- clear workspace'i silmez;
- reload weights download etmeden cache'i kullanır, GPU init durumunu dürüst gösterir.

### APP-E2E-005 — Radio ve simulation birlikte

1. Simülasyonu oynat.
2. Radyoyu aç ve play iste.
3. Volume ve loop ayarla.
4. Radio panelinin otomatik minimize olmasını bekle.
5. Simulation timeline'ı kullanmaya devam et.

Kabul:

- radio state simulation index/trace'i değiştirmez;
- player gerçek state'i UI'a yansır;
- loop aynı tracki tekrarlar;
- ring ve timer eşittir;
- wave yalnızca gerçek playing durumundadır.

### APP-E2E-006 — Layout, tema ve persistence

1. Beş paneli farklı boyutlandır.
2. İki paneli collapse et.
3. Dark tema seç.
4. Inputu değiştir ve pin ekle.
5. Reload yap.
6. Interface-only reset uygula.

Kabul:

- reload sonrası tanımlı layout/input/pin/theme state'i geri gelir;
- interface reset layoutu defaulta alır;
- input/pin/model cache sözleşmeye göre korunur;
- panel minimumları ve splitterlar kullanılabilir kalır.

### APP-E2E-007 — Full God Mode + core integration

GM master senaryosu çalıştırılır; ardından:

- özel package graphı manuel builderda düzenlenir;
- timeline core controls ile ileri/geri alınır;
- variable pinlenir;
- locale/theme değiştirilir;
- AI panel resize edilir;
- radio komutu uygulanır;
- undo/redo yapılır.

Kabul: God Mode tarafından oluşturulan artifactler core CodeXRay kontrolleriyle
birinci sınıf çalışma alanı gibi çalışır; özel ve hazır algoritma arasında temel
özellik farkı oluşmaz.

### APP-E2E-008 — Hata fırtınası dayanıklılığı

Sırayla invalid input, model error, radio API error, cancelled God Mode run ve
bozuk persisted layout fixture'ı uygulanır.

Kabul:

- app crash olmaz;
- her hata doğru alt sisteme izole edilir;
- core simulation veya chat geri kullanılabilir olur;
- reset gerektiren kilitli global state oluşmaz.

### APP-E2E-009 — Mobile temel yolculuk

Dar viewportta preset seçme, input girme, simulate, timeline, AI soru, settings
ve radio launcher görevleri tamamlanır. Horizontal overflow, ulaşılamayan control
ve modal clipping olmamalıdır.

### APP-E2E-010 — Tam reset sınırı

App state, unrelated origin key ve cached model fixture'ı hazırlanır. General
reset uygulanır. CodeXRay app preferences/workspace temizlenir; unrelated key ve
model weights korunur; uygulama güvenli defaultla çalışır.

---

## 39. Tüm uygulama gereksinim → test matrisi

| Alt sistem | Gereksinimler | Zorunlu test aileleri |
|---|---|---|
| Algoritma kataloğu | REQ-CATALOG-* | APP-CAT-001–008, APP-E2E-001–003 |
| Input/parser/preset | REQ-PARSER-*, REQ-PRESET-* | APP-IN-001–012, APP-E2E-001–003 |
| Graph Builder | REQ-GRAPH-* | APP-GRAPH-001–012, APP-E2E-002–003 |
| Editör | REQ-EDITOR-* | APP-EDIT-001–003, APP-SIM-006 |
| Timeline/simulator | REQ-TIMELINE-* | APP-SIM-001–010, APP-E2E-001–003 |
| Visualizer/Variables | REQ-COREVIS-*, REQ-VAR-* | APP-VIS-001–010 |
| Layout/Controls | REQ-LAYOUT-*, REQ-CONTROL-* | APP-LAYOUT-001–009, APP-CONTROL-001–003 |
| Yerel AI | REQ-AI-* | APP-AI-001–016, APP-E2E-004 |
| God Mode | REQ-ROUTE-*–REQ-TXN-* | GM-* testlerinin tamamı, APP-E2E-007 |
| Radio | REQ-RADIO-* | APP-RADIO-001–015, APP-E2E-005 |
| Dil/Tema | REQ-I18N-*, REQ-THEME-* | APP-I18N-001–004, APP-THEME-001–005 |
| Storage/Reset | REQ-STORE-* | APP-STORE-001–007, APP-E2E-006, 010 |
| A11y/Perf/Security | REQ-A11Y-*, REQ-PERF-CORE-*, REQ-SEC-CORE-* | APP-A11Y-*, APP-PERF-*, APP-SEC-* |
| Deployment | REQ-DEPLOY-* | APP-DEPLOY-001–007 |

### 39.1 PR test zorunluluğu

Her production değişikliği:

- etkilediği requirement ID'lerini PR açıklamasında belirtmelidir;
- karşılık gelen testleri çalıştırmalıdır;
- yeni davranış için test eklemeli veya neden gerekmediğini açıklamalıdır;
- P0 test skip/fixme ekliyorsa release blocker olarak işaretlenmelidir;
- unrelated baseline failure arkasına saklanmamalıdır.

---

## 40. Tüm uygulama CI ve release kalite kapısı

### 40.1 Her değişiklikte

```bash
npm run lint
npm run test
npm run build
```

İlgili component/service testleri ayrıca hedefli çalıştırılmalıdır.

### 40.2 Release candidate'da

```bash
npm ci
npm run lint
npm run test
npm run test:coverage
npm run build
npm run test:e2e
```

Ek zorunluluklar:

1. Tüm APP P0 yolculukları geçer.
2. Tüm GM P0 senaryoları geçer.
3. 60 supported algoritma matrisi eksiksiz geçer.
4. Parser/GraphDocument negatif fixture'ları geçer.
5. Node/edge state doğruluk testleri geçer.
6. Model indirmeyen deterministic AI mock testleri geçer.
7. Radio mock IFrame state testleri geçer.
8. Storage/reset izolasyon testleri geçer.
9. Mobile ve keyboard E2E geçer.
10. Publish script dry-run testleri geçer.
11. `dist`, `coverage`, `test-results`, `node_modules` commit edilmez.
12. Known P0 failure, skip veya flaky retry gizlenmez.

### 40.3 Manual release checklist

- Temiz browser profilinde core app smoke;
- EN/TR ve üç tema;
- en az bir array, string, tree ve graph algoritması;
- Graph Builder import/edit/export;
- timeline ileri/geri ve pin;
- local model first-load ve cached-load;
- normal AI soru ve copy/clear;
- tam God Mode master senaryo;
- Radio autoplay engeli, loop ve minimize;
- mobile layout;
- interface/general reset sınırı;
- publish dry-run;
- recovery tag/commit doğrulaması.

---

## 41. Tüm CodeXRay ürün kabul ifadesi

CodeXRay ancak aşağıdaki ifade otomatik testler ve manual master senaryolarla
kanıtlandığında release-ready sayılır:

> CodeXRay; 60 algoritmalık kataloğunu doğru kod, input ve deterministik trace
> ile çalıştırır; array, string, tree ve graph inputlarını güvenle doğrular;
> Graph Builder değişikliklerini referans kaybı olmadan uygular; timeline,
> görselleştirme ve değişkenleri aynı stepte tutar; tüm panelleri erişilebilir ve
> responsive biçimde yönetir; Türkçe/İngilizce ve üç temada tutarlı davranır;
> yerel AI kapalıyken çekirdek uygulamayı eksiksiz çalıştırır, açıkken güncel
> workspace'i doğru açıklar; God Mode ile doğrulanmış özel kod, input, görsel ve
> öğretim akışı üretir; radyoyu simulation state'inden bağımsız yönetir;
> storage/reset ve deployment sınırlarına uyar; hata halinde kullanıcı verisini
> sessizce ezmez ve hiçbir alt sistemde sahte başarı bildirmez.

Bu ana sözleşmenin ilgili P0 testleri geçmeden uygulamanın o bölümü `tamamlandı`
olarak işaretlenemez.
