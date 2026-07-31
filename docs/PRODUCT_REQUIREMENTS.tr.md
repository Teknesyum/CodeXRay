# CodeXRay — Ürün Gereksinimleri ve Gerçek Kullanım Senaryoları

Belge sürümü: `PRODUCT-REQUIREMENTS-1`

Durum: `ÜRÜN TEST EDİCİSİ İNCELEMESİNE HAZIR TASLAK`

Kapsam: CodeXRay uygulamasının tamamı

Bu belge insan tarafından okunmak ve ürün davranışları tek tek onaylanmak için
hazırlanmıştır. Uygulama sırası, kaynak dosya isimleri, otomasyon dosyaları,
teknik görev dağılımı veya kodlama yöntemi içermez. Yalnızca kullanıcının
göreceği davranışları, olmazsa olmaz gereksinimleri ve gerçek kullanım kabul
senaryolarını tanımlar.

---

## 1. Belgenin kullanım şekli

Bu belge geliştirme başlamadan önce Ürün test edicisi tarafından okunmalıdır. Anlaşılmayan,
istenmeyen veya eksik görülen maddeler düzeltilmeden belge onaylanmış sayılmaz.

Bir özellik yalnızca ekranda görünmesi veya tek bir hazırlanmış örnekte çalışması
nedeniyle tamamlanmış kabul edilemez. Aşağıdaki üç koşul birlikte sağlanmalıdır:

1. Gereksinim açıkça anlaşılmış olmalıdır.
2. Gerçek bir kullanıcı senaryosunda gözle görülür biçimde çalışmalıdır.
3. Kullanıcının önceden sisteme öğretilmemiş farklı inputlarıyla da aynı doğru
   davranışı göstermelidir.

Her senaryo için inceleme sonucu şu üç değerden biri olmalıdır:

- `ONAYLANDI`: Beklenen davranışların tamamı gerçekleşti.
- `REDDEDİLDİ`: Bir veya daha fazla zorunlu davranış gerçekleşmedi.
- `KISMEN`: Temel davranış çalıştı fakat belirtilen eksikler giderilmelidir.

`KISMEN` sonucu tamamlanmış anlamına gelmez.

---

## 2. CodeXRay'in temel ürün sözü

CodeXRay; kullanıcıya algoritmaların yalnızca sonucunu değil, kodun nasıl
çalıştığını adım adım gösteren bir öğrenme ortamıdır.

Kullanıcı şu konularda uygulamaya güvenebilmelidir:

- Seçtiği algoritmanın kodu, inputu ve simülasyonu birbirine aittir.
- Ekranda vurgulanan kod satırı gerçekten o anda çalışan satırdır.
- Gösterilen değişkenler ve görsel öğeler seçili simülasyon adımına aittir.
- İleri veya geri gidildiğinde bütün çalışma alanı aynı zamana döner.
- Kendi inputunu yazdığında uygulama hazır bir örneği gizlice kullanmaz.
- AI bir şeyi yaptığını söylüyorsa çalışma alanında gerçekten yapılmıştır.
- AI'ın anlattığı node, edge, değişken ve adım gerçekten ekranda vardır.
- Yerel AI kullanılamasa bile hazır algoritmalar ve temel simülasyon çalışır.
- Hatalı input veya başarısız AI işlemi mevcut çalışan çalışmayı bozmaz.
- Kullanıcı verisi, sohbeti ve yerel model tercihleri izinsiz uzak bir servise
  gönderilmez.

---

## 3. Tüm uygulama için olmazsa olmaz kurallar

### 3.1 Doğruluk

- Uygulama bir algoritmayı destekleniyor olarak gösteriyorsa o algoritmanın
  çalışan ve kendine ait bir simülasyonu bulunmalıdır.
- Farklı algoritmanın simülasyonu isim değiştirilerek kullanılamaz.
- Simülasyon sonucu algoritmanın bilinen matematiksel sonucuyla uyumlu olmalıdır.
- Kod satırı, değişken, node, edge ve açıklama aynı adımı temsil etmelidir.
- Sonuç bulunamadığında uygulama başarı sonucu uydurmamalıdır.
- Hazır input, kullanıcı tarafından yazılmış veya AI tarafından özgün üretilmiş
  input gibi gösterilmemelidir.

### 3.2 Kullanıcı kontrolü

- Kullanıcı simülasyonu başlatabilmeli, durdurabilmeli, ileri ve geri
  götürebilmelidir.
- Kullanıcı istediği adıma gidebilmelidir.
- Kullanıcı graph, node, edge, başlangıç ve hedef bilgilerini düzenleyebilmelidir.
- Kullanıcı panelleri açabilmeli, kapatabilmeli ve masaüstünde boyutlandırabilmelidir.
- Kullanıcı AI işlemini iptal edebilmelidir.
- Kullanıcı başarılı bir büyük çalışma alanı değişikliğini geri alabilmelidir.

### 3.3 Dürüst geri bildirim

- Yükleniyor, bekliyor, çalışıyor, tamamlandı, iptal edildi ve hata durumları
  birbirinden açıkça ayrılmalıdır.
- İlerleme çubuğu iş bitmeden yüzde yüz göstermemelidir.
- Tarayıcı müziği engellediyse radyo oynuyor gibi gösterilmemelidir.
- Yerel model yalnızca GPU hazırlığı yapıyorsa yeniden indiriliyor izlenimi
  verilmemelidir.
- Fallback kullanıldıysa kullanıcıdan gizlenmemelidir.

### 3.4 Hata güvenliği

- Geçersiz input mevcut geçerli inputu sessizce ezmemelidir.
- Başarısız özel kod üretimi editörde yarım kod bırakmamalıdır.
- Kod değişip simülasyon üretilemediyse eski simülasyon yeni kodun sonucu gibi
  gösterilmemelidir.
- Node ismi değiştiğinde ona bağlı edge, başlangıç, hedef ve kök referansları
  boşa düşmemelidir.
- İptal edilen veya geç kalan AI cevabı yeni çalışma durumunu değiştirmemelidir.

### 3.5 Dil ve görünüm

- Kullanıcıya gösterilen bütün temel metinlerin Türkçe ve İngilizce karşılığı
  olmalıdır.
- Dil değiştiğinde mevcut simülasyon baştan çalıştırılmadan görünen açıklamalar
  yeni dile geçmelidir.
- Neon, dark ve light temaları bütün ana panellerde uygulanmalıdır.
- Renk tek başına durum anlatmak için yeterli kabul edilmemelidir.
- Dar ekranlarda uygulama yatay taşmamalı ve temel kontrollere erişim kaybolmamalıdır.

### 3.6 Gizlilik

- Uygulama uzaktaki bir AI sağlayıcısına bağlı olmamalıdır.
- API anahtarı istememelidir.
- Yerel AI sohbeti ve workspace bilgisi cihazda kalmalıdır.
- Model dosyalarının browser tarafından yönetildiği açıkça anlatılmalıdır.
- Uygulama tarayıcının erişemediği rastgele bir disk yolunu tekrar kullanabileceği
  sözünü vermemelidir.

---

## 4. Ana çalışma alanı gereksinimleri

CodeXRay çalışma alanı şu beş bölümü birlikte sunmalıdır:

1. Kaynak kod
2. Değişkenler ve iz
3. Simülasyon görünümü
4. Bilgiç Dede / yerel AI
5. Kontroller

Olmazsa olmaz davranışlar:

- Beş panelin tamamı küçültülebilir ve yeniden açılabilir olmalıdır.
- Masaüstünde panel sınırları pointer ve klavye ile değiştirilebilmelidir.
- Bir paneli boyutlandırmak ilgisiz üçüncü paneli ezmemelidir.
- Kontroller varsayılan olarak kompakt olmalı fakat temel butonlar görünmelidir.
- AI paneli varsayılan açılışta bütün sağ kolonu kaplamamalıdır.
- AI büyütüldükten sonra tekrar küçültülebilmelidir.
- Simülasyon, AI ve kontrol panellerinin minimize butonları görsel olarak tutarlı
  hizalanmalıdır.
- Ayarlar veya yukarı açılan menüler başka bir panel tarafından kesilmemelidir.
- Dar ekranda paneller güvenli biçimde alt alta gelmelidir.
- Kullanıcının panel tercihlerinin saklanması ve yeni sürümlerde güvenli biçimde
  varsayılana taşınması gerekir.

---

## 5. Algoritma kataloğu gereksinimleri

CodeXRay'de listelenen 60 algoritmanın tamamı için aşağıdakiler zorunludur:

- Algoritmanın benzersiz adı ve kimliği bulunmalıdır.
- Algoritmanın okunabilir kaynak kodu bulunmalıdır.
- Kabul ettiği input türü belli olmalıdır.
- En az bir çalışan hazır input bulunmalıdır.
- Kendine ait deterministik simülasyon üretmelidir.
- Simülasyon en az bir başlangıç ve bir anlamlı sonuç durumu göstermelidir.
- Kod satırı vurguları görünür kodun satırları içinde kalmalıdır.
- Algoritma Türkçe ve İngilizce arayüzde doğru adla gösterilmelidir.
- Desteklenmeyen bir özellik varsa neden çalışmadığı açıkça belirtilmelidir.
- Kullanıcı farklı algoritmaya geçtiğinde eski algoritmanın kodu, inputu,
  değişkeni veya analizi ekranda kalmamalıdır.

Algoritma ailelerinin tamamı ürün içinde gerçek kullanıcı tarafından
denenebilmelidir:

- Sıralama algoritmaları
- Arama algoritmaları
- Array işlemleri
- String ve pattern işlemleri
- Tree algoritmaları
- Graph traversal algoritmaları
- En kısa yol algoritmaları
- Minimum spanning tree algoritmaları
- Dynamic programming algoritmaları
- Bağlı liste veya birleşik veri yapısı algoritmaları

---

## 6. Input gereksinimleri

### 6.1 Array input

- JSON array ve uygulamanın açıkladığı virgülle ayrılmış sayı formatı çalışmalıdır.
- Negatif ve ondalık sayı desteği algoritmanın kurallarına göre açık olmalıdır.
- Boş eleman, NaN, Infinity ve sayı olmayan değerler reddedilmelidir.
- Çok büyük input tarayıcıyı kilitlemeden açık sınır hatası vermelidir.
- Kullanıcının yazdığı sayıların sırası sessizce değiştirilmemelidir.

### 6.2 String input

- Türkçe karakterler ve Unicode metin bozulmamalıdır.
- Text ve pattern alanları birbirinden ayrılmalıdır.
- Boş inputun geçerli olup olmadığı algoritmaya göre açıklanmalıdır.
- Kullanıcının yazdığı metin başka örnek metinle değiştirilmemelidir.

### 6.3 Tree input

- Level-order biçiminde import ve export yapılabilmelidir.
- Boş child bilgileri korunmalıdır.
- Kök node geçerli olmalıdır.
- Tree içinde cycle veya bir node'un birden fazla parentı varsa reddedilmelidir.
- Node düzenlemeleri tree ilişkilerini bozmamalıdır.

### 6.4 Graph input

- Node kimlikleri benzersiz olmalıdır.
- Her edge var olan iki node'a bağlanmalıdır.
- Directed ve undirected graph ayrımı korunmalıdır.
- Weighted graph ağırlıkları kaybolmamalıdır.
- Başlangıç ve hedef var olan node'lar olmalıdır.
- Duplicate edge kuralları hem formda hem sürükleyerek bağlantıda aynı olmalıdır.
- Dijkstra ve A* negatif ağırlıklı edge'i kabul etmemelidir.
- Hatalı graph mevcut geçerli graphı bozmamalıdır.

### 6.5 Hazır inputlar

- Farklı hazır input butonları gerçekten farklı veriler sunmalıdır.
- Aynı hazır input tekrar seçildiğinde aynı sonucu üretmelidir.
- Hazır input seçimi simülasyonu ilk adıma döndürmelidir.
- Hazır input bütün algoritmalara rastgele uygulanmamalı; algoritmanın veri türüne
  uygun olmalıdır.

---

## 7. Graph Builder gereksinimleri

- Kullanıcı node ekleyebilmelidir.
- Otomatik sayısal node kimliği, kullanılmayan en küçük pozitif sayıyı seçmelidir.
- Kullanıcı node ismini güvenle değiştirebilmelidir.
- Node ismi değişince tüm bağlı edge ve başlangıç/hedef/kök referansları birlikte
  güncellenmelidir.
- Var olan node kimliğine yeniden adlandırma reddedilmelidir.
- Kullanıcı form üzerinden edge ekleyebilmelidir.
- Kullanıcı node'dan node'a sürükleyerek edge oluşturabilmelidir.
- İki edge oluşturma yöntemi aynı doğrulama kurallarını kullanmalıdır.
- Kullanıcı node'u taşıdığında yalnızca konum değişmeli, bağlantılar kopmamalıdır.
- Kullanıcı node sildiğinde bağlı edge'lerin durumu açık ve güvenli biçimde
  yönetilmelidir.
- Directed graph okları doğru yönde görünmelidir.
- Weighted graph ağırlıkları düzenlenebilmelidir.
- Graph export edilip tekrar import edildiğinde aynı graph geri gelmelidir.
- Temel graph düzenleme görevleri yalnızca mouse kullanımına bağlı olmamalıdır.

---

## 8. Simülasyon ve timeline gereksinimleri

- Simulate butonu güncel kod ve güncel inputtan yeni simülasyon üretmelidir.
- Play butonu var olan simülasyonu oynatmalıdır.
- Play ve Simulate kullanıcının gözünde aynı işlem gibi davranmamalıdır.
- Pause sonrası seçili adım ilerlememelidir.
- Next ve Previous tam bir adım hareket etmelidir.
- İlk adımdan geri, son adımdan ileri gidilememelidir.
- Kullanıcı geçerli bir adım numarasına doğrudan gidebilmelidir.
- Geçersiz adım numarası uygulamayı bozmamalıdır.
- Oynatma hızı değiştirilebilmelidir.
- Hız değiştirmek iki ayrı timer başlatmamalı veya adım atlatmamalıdır.
- Son adıma gelindiğinde oynatma durmalıdır.
- Yeni algoritma veya input simüle edildiğinde index ilk adıma dönmelidir.
- Uzun simülasyonların trace koleksiyonu sessizce kesilmemelidir.
- Dil değişimi mevcut simülasyonu baştan çalıştırmamalıdır.
- Analiz güncel algoritma ve inputa ait olmalıdır.

---

## 9. Görselleştirme ve değişken gereksinimleri

### 9.1 Array görünümü

- Array değerleri doğru sırada gösterilmelidir.
- Aktif, karşılaştırılan, ziyaret edilen veya sonuçlanan hücreler doğru adımda
  vurgulanmalıdır.
- Pointer isimleri doğru index üzerinde görünmelidir.

### 9.2 Graph görünümü

- Node konumları input veya geçerli layout ile eşleşmelidir.
- Node label ve durumları doğru görünmelidir.
- Directed edge oku doğru yönde olmalıdır.
- Weight doğru edge üzerinde görünmelidir.
- Node ve edge durumları seçili timeline adımına ait olmalıdır.
- Geri gidildiğinde node ve edge vurguları da geri dönmelidir.

### 9.3 Variables görünümü

- Array ve object değerleri yapısını kaybetmeden gösterilmelidir.
- Değerler `[object Object]` gibi anlamsız metne dönüşmemelidir.
- Kullanıcı top-level değişkenleri pinleyebilmelidir.
- Pinlenen değişkenler listede önce görünmelidir.
- Watch strip current stepteki gerçek değeri göstermelidir.
- Değişken seçili stepte yoksa eski stepin değeri güncelmiş gibi gösterilmemelidir.
- Önceki adıma göre değişen değer anlaşılır biçimde işaretlenmelidir.

---

## 10. Yerel AI temel gereksinimleri

- Yerel AI kullanımı isteğe bağlı olmalıdır.
- AI modeli yüklenmeden hazır algoritmaların bütün temel özellikleri çalışmalıdır.
- WebGPU desteklenmiyorsa anlaşılır mesaj gösterilmelidir.
- Model yükleme ana arayüzü kilitlememelidir.
- Model adı, yaklaşık VRAM ihtiyacı, context seçeneği ve durum bilgisi doğru
  gösterilmelidir.
- Model yüklenirken gerçek ilerleme görünmelidir.
- İlk yüzde değerlerinde kullanılan görsel ilerleme gerçek değerin gerisine
  düşmemeli ve model hazır olmadan tamamlanmış görünmemelidir.
- Kullanıcı yüklemeyi başlattığında yükleniyor bildirimi görmelidir.
- Model hazır olduğunda model yüklendi bildirimi görmelidir.
- Hata durumunda başarı bildirimi gösterilmemelidir.
- Cache'teki model sonraki ziyarette tekrar indirilmeden hazırlanabilmelidir.
- GPU hazırlığı ile model indirme birbirinden dürüstçe ayrılmalıdır.
- Kullanıcı tek bir cached modeli silebilmelidir.
- Bir modeli silmek diğer modeli veya workspace'i etkilememelidir.
- Stable context varsayılanı güvenli olmalıdır.
- Daha büyük context yalnızca destekleyen modelde seçilebilmelidir.
- AI'a gönderilen bağlam güncel kodu, inputu, adımı ve görsel durumu içermelidir.
- Eski sohbet güncel workspace bilgisinin önüne geçmemelidir.
- Küçük model tekrarları temizlenmelidir.
- Yarım cevap için devam isteği sınırsız döngüye dönüşmemelidir.
- Sohbet cihazda saklanabilmeli ve kullanıcı tarafından temizlenebilmelidir.
- Sohbeti temizlemek kodu, inputu ve model cache'ini silmemelidir.
- Her AI cevabının sağ üstünde çalışan bir kopyalama butonu bulunmalıdır.

### 10.1 AI cevabının içerik sınırları

- Kullanıcıya yalnızca sorduğu konu ve tamamlanan işlemin sonucu gösterilmelidir.
- System prompt, developer talimatı, ajan rol metni, model etiketi, context kurma
  talimatı ve benzeri iç yönergeler hiçbir koşulda kullanıcı cevabına
  sızmamalıdır.
- Modelin kendi kendine yaptığı düşünme, çatışma kontrolü, olasılık tartışması,
  planlama notu veya `Wait`, `Let's check`, `My task is` benzeri iç konuşmalar
  kullanıcıya gösterilmemelidir.
- `<think>`, `<analysis>`, `reasoning`, `prompt`, `snapshot metadata`, `system
  instructions` veya benzeri iç bölümler görünür cevaba dönüşmemelidir.
- AI, kendisine gönderilen workspace snapshotını olduğu gibi dökmemelidir.
- Güncel kod, input ve değişkenlerden yalnızca kullanıcı sorusunu cevaplamak için
  gereken kısmı kullanmalıdır.
- Kullanıcı yalnızca timeline komutu verdiyse gereksiz uzun algoritma dersi
  yazmamalıdır.
- `10. adıma kadar ilerlet` gibi bir istekte önce gerçek işlem uygulanmalı,
  ardından kısa ve doğru bir sonuç verilmelidir.
- İstenen adım trace sınırını aşıyorsa yapılan clamp veya ulaşılan son adım açıkça
  söylenmelidir.
- AI, emin olmadığı satır veya değişken hakkında iç tahminlerini gerçekmiş gibi
  göstermemelidir.
- Eski mesajla yeni snapshot arasında fark varsa kullanıcıya iç prompt tartışması
  göstermek yerine yalnızca yeni committed state esas alınmalıdır.
- AI cevabı başarısız veya anlamsız hale geldiyse iç reasoning dökmek yerine kısa
  hata ve tekrar deneme seçeneği sunmalıdır.

### 10.2 Markdown ve cevap kartı gereksinimleri

- AI Markdown cevabı başlık, paragraf, liste, inline code, code block, tablo ve
  bağlantıları güvenli ve okunabilir biçimde göstermelidir.
- Markdown işaretleri anlamsız ham karakter yığını olarak görünmemelidir.
- Uzun code block yalnızca kendi alanında yatay scroll kullanmalı; AI mesaj
  kartını, paneli veya bütün sayfayı genişletmemelidir.
- Uzun ve boşluksuz kelime, URL, JSON, kod veya model çıktısı panel sınırlarını
  aşmamalıdır.
- Cevap kartı AI panelinin mevcut genişliğine uyum sağlamalıdır.
- Panel küçültülüp büyütüldüğünde Markdown tekrar okunabilir kalmalıdır.
- Code block içindeki satırlar içerik kaybetmeden kaydırılabilmelidir.
- Normal paragraf ve liste metinleri gereksiz yatay scroll oluşturmamalıdır.
- Tablo panelden genişse yalnızca tablo kapsayıcısı kaydırılmalı; bütün mesaj
  balonu taşmamalıdır.
- Çok uzun cevap dikey olarak okunabilmeli ve input composerı ekran dışına
  kalıcı biçimde itmemelidir.
- Markdown içindeki HTML veya script çalıştırılmamalıdır.
- Kullanıcı tarafından yazılmış görünen fakat modelin ürettiği zararlı link veya
  event handler uygulama içinde çalıştırılmamalıdır.
- Copy butonu iç promptu veya gizlenen reasoning metnini değil, kullanıcıya
  sunulan temiz cevabı kopyalamalıdır.
- Cevap temizlendikten sonra tamamen boş kalıyorsa boş mesaj kartı yerine anlaşılır
  hata veya tekrar deneme bilgisi gösterilmelidir.

---

## 11. God Mode ürün gereksinimleri

God Mode yalnızca sohbet etmek değil, kullanıcının açık isteğine göre CodeXRay
çalışma alanında gerçek işlem yapmak için vardır.

### 11.1 Intent gereksinimleri

- `BFS nedir?` yalnızca açıklama yapmalıdır.
- `BFS sayfasını aç` hazır BFS sayfasını açmalıdır.
- `BFS kodu yaz` özel üretim isteği olarak değerlendirilebilmelidir.
- `Benim graphım için BFS yaz` kullanıcının graphını korumalıdır.
- `İki yönlü BFS yaz` özel algoritma oluşturmalıdır.
- `BFS sayfasını aç ve anlat` önce sayfayı açmalı, sonra yeni çalışma alanını
  anlatmalıdır.
- Türkçe, İngilizce, diakritiksiz ve nazik komut varyantları aynı doğru amaca
  ulaşmalıdır.
- Belirsiz bir istek çalışma alanını rastgele değiştirmeden gerekli bilgiyi
  kullanıcıdan istemelidir.

### 11.2 Özel algoritma gereksinimleri

- Kullanıcının istediği algoritmanın adı çalışma alanı başlığında görünmelidir.
- Özel kod gerçekten istenen algoritmayı içermelidir.
- Kod, input ve simülasyon aynı özel çalışmanın parçaları olmalıdır.
- Kod compile/test edilmeden çalışma alanına başarıyla uygulanmış sayılmamalıdır.
- Kullanıcı yalnızca kod istediyse simülasyon zorla oynatılmamalıdır.
- Kullanıcı simüle et veya anlat dediyse işlem kodu yazmakla bitmemelidir.
- Özel çalışma hazır algoritmalar gibi ileri, geri, pause, play ve analiz
  kontrollerini desteklemelidir.

### 11.3 Input Engineer gereksinimleri

- Kullanıcı kendi inputuna referans veriyorsa input korunmalıdır.
- Kullanıcı node sayısı veya graph yapısı belirttiyse aynen karşılanmalıdır.
- Özgün input istendiyse hazır preset birebir kopyalanmamalıdır.
- Hazır input yalnızca zorunlu fallback ise kullanılmalı ve açıkça belirtilmelidir.
- Üretilen input kodun gerçekten kabul ettiği türde olmalıdır.
- Input simüle edilebilir olmalı ve geçersiz referans taşımamalıdır.

### 11.4 Görsel tasarım gereksinimleri

- Özel algoritma yalnızca standart hazır node görünümüne mahkûm olmamalıdır.
- Görsel tasarım algoritmanın anlamlı rollerini göstermelidir.
- İki yönlü BFS'de başlangıç ve hedef frontierları farklı görünmelidir.
- Start, target, meeting ve final path açıkça ayrılmalıdır.
- Aktif ve geçilmiş edge'ler node vurgusuyla birlikte görünmelidir.
- Kullanıcı nodeları daha geniş yay veya farklı şekiller kullan dediğinde kod ve
  graph bağlantıları değişmeden yalnızca görünüm güncellenebilmelidir.
- Kullanıcı node veya edge eklediğinde özel çalışma yeniden simüle edilmelidir.
- Görsel üretim başarısızsa sistem hazır görsele geçtiğini gizlememelidir.

### 11.5 Ajan kuyruğu gereksinimleri

- Kullanıcı büyük görevin hangi aşamada olduğunu görebilmelidir.
- Bekleyen, çalışan, yeniden deneyen, tamamlanan, başarısız ve iptal edilen işler
  ayırt edilmelidir.
- İlerleme gerçek tamamlanan işlere göre hesaplanmalıdır.
- Kullanıcı işlemi iptal edebilmelidir.
- Bir uzman başarısız olduğunda hangi işin ve neden başarısız olduğu görünmelidir.
- Kod ve simülasyon hazır olsa bile istenen anlatım tamamlanmadan tüm görev
  tamamlanmış sayılmamalıdır.
- Başarılı görev kısa bir başarı durumundan sonra kompakt biçimde kapanabilir.
- Başarısız görev kullanıcı incelemeden kendiliğinden kaybolmamalıdır.

### 11.6 Rollback gereksinimleri

- Özel işlem bütün parçalarıyla birlikte uygulanmalıdır.
- Kod başarılı, input başarısızsa hiçbir parça yarım uygulanmamalıdır.
- Input başarılı, simülasyon başarısızsa yeni input tek başına bırakılmamalıdır.
- Başarısızlıkta önceki çalışan kod, input, başlık ve simülasyon geri gelmelidir.
- Kullanıcı başarılı büyük işlemi Undo ve Redo ile yönetebilmelidir.

---

## 12. Canlı öğretim gereksinimleri

God Mode anlatımı tek bir genel paragrafla bitmemelidir. Kullanıcı kodun içinde
ilerleyebilmelidir.

Her önemli durakta anlatım şu beş bakışı içermelidir:

1. **Kod:** Hangi satır veya blok çalışıyor?
2. **Veri:** Hangi değişken veya veri yapısı değişti?
3. **Görsel:** Hangi node, edge veya hücre değişti?
4. **Mantık:** Algoritma bu kararı neden aldı?
5. **Zaman:** Buraya nasıl gelindi ve sırada ne olabilir?

Ek zorunluluklar:

- AI simülasyonu anlatmadan önce doğru adımda durdurmalıdır.
- Anlatım yalnızca gerçek stepte bulunan verilerden söz etmelidir.
- Bir önceki adıma göre neyin değiştiğini söylemelidir.
- Kullanıcı `devam` dediğinde sonraki önemli adıma gitmelidir.
- Kullanıcı `geri` dediğinde önceki gerçek adıma dönmelidir.
- Kullanıcı `burayı tekrar anlat` dediğinde index değişmemelidir.
- Kullanıcı anlatımı kesip başka adıma giderse eski cevap yeni adımın cevabı gibi
  gösterilmemelidir.
- Simülasyon bittiğinde final sonuç ayrıca anlatılmalıdır.
- Final rapor yol, maliyet, ziyaret sırası, ziyaret sayısı veya algoritmaya uygun
  sonuç ölçülerini gerçek trace'ten çıkarmalıdır.
- Sonuç bulunamadıysa açıkça bulunamadı denmelidir.

---

## 13. CodeXRay Radio gereksinimleri

- Radyo açılış parçası `Up — CDK` olmalıdır.
- Hazır playlistte parça isimleri network cevabı beklenmeden görünmelidir.
- Hazır playlist seçimi hızlı olmalıdır.
- Özel playlist eklenirken dış servisin yükleme gecikmesi dürüstçe gösterilebilir.
- Tarayıcı sesli autoplayi engellediğinde buton gerçek playing durumuna geçmemelidir.
- İlk kullanıcı etkileşiminden sonra bekleyen play isteği tekrar denenebilmelidir.
- Play ve Pause butonu YouTube playerın doğruladığı state'i göstermelidir.
- Previous ve Next doğru parçaya gitmelidir.
- Shuffle durumu player ile senkron olmalıdır.
- Loop butonu aktifken aynı şarkı bitince baştan başlamalıdır.
- Single-track loop aktifken sonraki parçaya geçilmemelidir.
- Loop açıkken şarkının doğal bitişinde mevcut playlist indexi kesinlikle aynı
  kalmalı, oynatma süresi `0:00`a dönmeli ve aynı şarkı yeniden oynatılmalıdır.
- YouTube veya playlistin otomatik sonraki parçaya geçme davranışı single-track
  loop açıkken engellenmelidir.
- Volume ve mute kontrolleri gerçek player ile senkron olmalıdır.
- Wave animasyonu yalnızca gerçek playing durumunda hareket etmelidir.
- Wave görünümü neon/cyberpunk tasarım diliyle uyumlu olmalıdır.
- Otomatik minimize süresi ile neon geri sayım animasyonu aynı süreyi kullanmalıdır.
- Hover sırasında minimize sayacı durmalı, ayrılınca tanımlı biçimde yeniden
  başlamalıdır.
- `Hiç` seçeneği otomatik minimizeyi kapatmalıdır.
- YouTube API yüklenemezse external playlist bağlantısı erişilebilir kalmalıdır.
- Radyo durumu simülasyon kodunu, inputunu veya timeline indexini değiştirmemelidir.

---

## 14. Ayarlar, tema, dil ve reset gereksinimleri

### 14.1 Ayarlar

- AI, Interface ve Radio ayarları ayrı ve anlaşılır bölümlerde bulunmalıdır.
- Kullanıcı ayarları scroll veya clipping nedeniyle erişilemez olmamalıdır.
- Ayar kontrolleri gerçek uygulama state'iyle senkron olmalıdır.
- Model ve context açıklamaları kullanıcının anlayabileceği biçimde verilmelidir.

### 14.2 Tema

- Neon varsayılan görsel kimliği korumalıdır.
- Dark ve Light temada bütün paneller okunabilir olmalıdır.
- Graph state'lerinin anlamı tema değişiminde kaybolmamalıdır.
- Tema tercihi sayfa yenilemesinde korunmalıdır.
- Hareket azaltma tercihinde dekoratif animasyonlar azaltılmalıdır.
- Stil sistemi Vanilla CSS olarak kalmalıdır.

### 14.3 Dil

- Ana kullanıcı metinlerinin tamamı Türkçe ve İngilizce olmalıdır.
- Dil değişiminde başlık, buton, hata, ayar ve mevcut simülasyon açıklamaları
  güncellenmelidir.
- Algoritma, node ve package kimlikleri çeviri sırasında bozulmamalıdır.
- Türkçe karakterler mojibake olarak görünmemelidir.

### 14.4 Reset

- Arayüz sıfırlama yalnızca layout ve arayüz tercihlerini sıfırlamalıdır.
- Genel uygulama sıfırlama yalnızca CodeXRay'e ait uygulama verilerini silmelidir.
- Başka uygulamaya veya origin kullanımına ait keyler silinmemelidir.
- Genel sıfırlama WebLLM model dosyalarını silmemelidir.
- Model silme ayrı ve açık bir kullanıcı işlemi olmalıdır.
- Bozuk veya eski storage verisi uygulamanın açılmasını engellememelidir.

---

## 15. Erişilebilirlik ve responsive gereksinimleri

- Icon-only butonların anlaşılır erişilebilir adları olmalıdır.
- Klavye focus göstergesi görünür olmalıdır.
- Simulate, playback, ayarlar, AI soru gönderme ve temel graph düzenleme klavye
  ile yapılabilmelidir.
- Slider ve panel ayırıcıları klavye ile değiştirilebilmelidir.
- Dialog açıldığında focus dialoga geçmeli, kapanınca tetikleyiciye dönmelidir.
- Renk körlüğü durumunda kritik state'ler yalnızca renkle ayrılmamalıdır.
- Dar ekranda yatay sayfa taşması oluşmamalıdır.
- Mobil görünümde gizlenen splitterlar kullanılmaz halde olmalıdır.
- AI input alanı ve tracker uzun cevapların tamamını kapatmamalıdır.
- Reduced-motion tercihinde işlevsel bilgi kaybolmamalıdır.

---

## 16. Gerçek kullanım senaryoları

Bu senaryolar hazırlanmış tek bir örneği tekrar etmek için değildir. İncelemeyi
yapan kişi inputları kendisi seçmeli ve mümkün olduğunda uygulamanın daha önce
görmediği değerleri kullanmalıdır.

### Senaryo 1 — AI kullanmadan ilk algoritmayı öğrenme

**Kullanıcı amacı:** Bir sıralama algoritmasını açıp nasıl çalıştığını kendi
sayılarıyla görmek.

**Kullanıcı davranışı:**

1. Uygulamayı temiz durumda açar.
2. AI modeli yüklemez.
3. Katalogdan rastgele bir sıralama algoritması seçer.
4. Kendisi 8–20 sayı arasında rastgele bir array yazar.
5. Simulate yapar.
6. Play, Pause, Next ve Previous kullanır.
7. En az bir değişkeni pinler.

**Onay koşulları:**

- Simülasyon AI olmadan çalışır.
- Final array gerçekten sıralıdır.
- Final değerler ilk inputun aynı elemanlarından oluşur.
- Kod satırı, array vurgusu ve değişkenler aynı adımdadır.
- Geri gidince array ve değişkenler de geri döner.
- Pinlenen değer current stepe göre güncellenir.

**Red koşulları:**

- Hazır array kullanılır ve kullanıcının sayıları yok sayılır.
- Sonuç doğru fakat adımlar başka algoritmayı temsil eder.
- Geri tuşu yalnızca indexi değiştirip görseli değiştirmez.

### Senaryo 2 — Rastgele arama inputu

**Kullanıcı amacı:** Aranan değer bulunan ve bulunmayan durumları karşılaştırmak.

**Kullanıcı davranışı:**

1. Rastgele bir search algoritması seçer.
2. Kendi arrayini ve hedef değerini girer.
3. Bir kez bulunan hedefle, bir kez bulunmayan hedefle çalıştırır.

**Onay koşulları:**

- Bulunan hedef doğru index/node ile gösterilir.
- Bulunmayan hedef için sahte sonuç üretilmez.
- İki çalıştırma arasında eski sonuç veya highlight kalmaz.

### Senaryo 3 — Unicode string denemesi

**Kullanıcı amacı:** Türkçe karakter içeren gerçek bir metinde string algoritması
çalıştırmak.

**Kullanıcı davranışı:**

- İçinde `İ, ı, ş, ğ, ü, ö, ç` ve mümkünse emoji bulunan bir text girer.
- Pattern değerini kendisi belirler.
- Bir eşleşen ve bir eşleşmeyen deneme yapar.

**Onay koşulları:**

- Metin bozulmaz.
- Match indexleri görünen metinle uyumludur.
- Pattern ve text birbirine karışmaz.
- Eski arama sonucu ikinci denemeye taşınmaz.

### Senaryo 4 — Tree import, düzenleme ve traversal

**Kullanıcı amacı:** Kendi tree yapısını içeri alıp düzenlemek ve dolaşmak.

**Kullanıcı davranışı:**

1. Daha önce uygulamada hazır bulunmayan level-order tree yazar.
2. Tree'yi import eder.
3. Bir node ismini değiştirir.
4. Bir child ekler veya siler.
5. Rastgele bir traversal algoritması seçer.
6. Export edip yeniden import eder.

**Onay koşulları:**

- Kök ve child ilişkileri korunur.
- Traversal sırası tree ile uyumludur.
- Rename bağlı referansları bozmaz.
- Export/import sonrasında aynı tree geri gelir.
- Geçersiz cycle denenirse açıkça reddedilir.

### Senaryo 5 — Kullanıcının çizdiği weighted graph

**Kullanıcı amacı:** Kendi graphında en kısa yolu görmek.

**Kullanıcı davranışı:**

1. 6–12 node arasında kendi graphını oluşturur.
2. Edge ve ağırlıkları kendisi belirler.
3. Start ve target seçer.
4. Dijkstra veya A* çalıştırır.
5. Daha sonra bir edge ağırlığını negatif yapmayı dener.

**Onay koşulları:**

- İlk graph kullanıcının çizdiği haliyle simüle edilir.
- Path gerçek edge'lerden oluşur.
- Toplam maliyet edge ağırlıklarıyla eşleşir.
- İncelenen edge'ler timeline boyunca vurgulanır.
- Negatif edge Dijkstra/A* için reddedilir.
- Geçersiz deneme önceki geçerli graphı bozmaz.

### Senaryo 6 — Graph Builder günlük düzenleme

**Kullanıcı amacı:** Node ve edge'leri rahatça değiştirmek.

**Kullanıcı davranışı:**

1. Otomatik node ekler.
2. Ortadaki sayısal ID'li node'u siler.
3. Yeni node ekler.
4. Node ismini değiştirir.
5. Formla ve sürükleyerek edge ekler.
6. Aynı edge'i iki kez eklemeyi dener.
7. Node'u sürükler.

**Onay koşulları:**

- Yeni numeric ID en küçük boşluğu kullanır.
- Rename tüm referansları günceller.
- Duplicate edge iki yöntemde de engellenir.
- Node taşıma bağlantıları koparmaz.
- Geçersiz edit sonrasında editor kullanılabilir kalır.

### Senaryo 7 — Rastgele algoritma katalog turu

**Kullanıcı amacı:** Uygulamadaki hazır algoritmaların yalnızca birkaçının değil,
kataloğun tamamının gerçekten çalıştığını kontrol etmek.

**Kullanıcı davranışı:**

- Her oturumda katalogdan rastgele algoritmalar seçer.
- Array, string, tree ve graph ailelerinden en az birer seçim yapar.
- Hazır input yerine kendi inputunu kullanır.
- Bir algoritmayı oynatırken başka algoritmaya geçer.

**Onay koşulları:**

- Her seçimde başlık, kod, input türü ve simülasyon birlikte değişir.
- Eski algoritmanın analizi veya görseli kalmaz.
- Desteklenmeyen kayıt varsa neden açıkça görünür.
- Rastgele seçimler crash veya boş başarı sonucu üretmez.

### Senaryo 8 — Panel düzenini kişiselleştirme

**Kullanıcı amacı:** Kendi çalışma biçimine göre alanları ayarlamak.

**Kullanıcı davranışı:**

- Sol kolonu genişletir.
- Code/Variables sınırını değiştirir.
- Visualizer/AI sınırını değiştirir.
- AI/Controls sınırını değiştirir.
- Panelleri kapatıp açar.
- AI'ı büyütüp tekrar küçültür.
- Sayfayı yeniler.

**Onay koşulları:**

- Komşu panel resize edilirken ilgisiz panel bozulmaz.
- Minimum boyutlar korunur.
- Bütün paneller tekrar açılabilir.
- Yenileme sonrası tanımlı tercihler geri gelir.
- Varsayılan düzen AI tarafından tamamen işgal edilmez.

### Senaryo 9 — Dil ve tema değişimi

**Kullanıcı amacı:** Çalışan simülasyonu bozmadan görünümü değiştirmek.

**Kullanıcı davranışı:**

- Simülasyonun ortasında Türkçe/İngilizce değiştirir.
- Neon, dark ve light temaları sırayla dener.

**Onay koşulları:**

- Current index değişmez.
- Simülasyon yeniden üretilmez.
- Açıklamalar yeni dile geçer.
- Node/edge semantiği üç temada korunur.
- Okunamayan veya eski dilde kalan ana kontrol bulunmaz.

### Senaryo 10 — İlk yerel model yüklemesi

**Kullanıcı amacı:** Modelin gerçekten ne yaptığını anlayarak yüklemek.

**Kullanıcı davranışı:**

1. Bir model ve desteklenen context seçer.
2. Model yüklemeyi başlatır.
3. Progress ve bildirimleri izler.
4. Yükleme sırasında temel uygulamayı kullanmaya devam eder.
5. Ready olduktan sonra soru sorar.

**Onay koşulları:**

- Yükleniyor bildirimi görünür.
- Progress geriye gitmez ve erken yüzde yüz olmaz.
- Ana uygulama kilitlenmez.
- Ready sonrası model yüklendi bildirimi görünür.
- Hata varsa başarı bildirimi çıkmaz.
- Soru güncel workspace'e göre cevaplanır.

### Senaryo 11 — Cache'teki modelle geri dönüş

**Kullanıcı amacı:** Daha önce indirdiği modeli tekrar kullanmak.

**Kullanıcı davranışı:**

- Modeli başarıyla yükler.
- Sayfayı kapatıp yeniden açar.
- Auto-load açık ve kapalı durumları ayrı dener.

**Onay koşulları:**

- Auto-load açıkken cached model hazırlanır.
- Ağırlıklar yeniden indiriliyor diye yanlış mesaj verilmez.
- GPU initialization gerekiyorsa ayrı gösterilir.
- Auto-load kapalıyken kullanıcı istemeden model başlatılmaz.

### Senaryo 12 — Normal AI sorusu

**Kullanıcı amacı:** Mevcut algoritmayı değiştirmeden soru sormak.

**Kullanıcı davranışı:**

- `Bu algoritmanın karmaşıklığı nedir?` diye sorar.
- `Bu adımda queue neden değişti?` diye sorar.
- Bir cevabı kopyalar.
- Sohbeti temizler.

**Onay koşulları:**

- Bilgi sorusu workspace'i değiştirmez.
- İkinci soru current stepteki gerçek queue'yu kullanır.
- Copy doğru mesajı kopyalar.
- Sohbet temizlenince code/input/trace kalır.

### Senaryo 13 — Hazır sayfayı AI ile açma

**Kullanıcı amacı:** Menü aramak yerine doğal dille sayfaya gitmek.

**Kullanıcı davranışı:**

- `DFS sayfasını aç` der.
- Ardından `şimdi oynat` der.
- Daha sonra `bu algoritma nedir?` diye sorar.

**Onay koşulları:**

- DFS sayfası gereksiz uzun ajan kuyruğu beklemeden açılır.
- Başlık, kod, input ve trace DFS olur.
- Oynat komutu timeline'ı başlatır.
- Soru DFS workspace'i üzerinden cevaplanır.

### Senaryo 14 — Komut ile sorunun ayrılması

**Kullanıcı davranışı:**

- Önce `BFS nedir?` sorar.
- Sonra `BFS sayfasını aç` der.
- Sonra `BFS sayfasını aç ve anlat` der.

**Onay koşulları:**

- İlk istek workspace'i değiştirmez.
- İkinci istek workspace'i değiştirir.
- Üçüncü istek önce doğru sayfayı açar, sonra yeni state'i anlatır.

### Senaryo 15 — Tam özel iki yönlü BFS

**Kullanıcı amacı:** Hazır kütüphanede bulunmayan özel bir çalışmayı baştan sona
oluşturmak.

**Kullanıcı isteği:**

> Bana iki yönlü BFS yaz. 10 node'lu ve iki alternatif yolu olan özgün bir graph
> oluştur. İki frontierı farklı tasarla. Simüle et ve öğretmen gibi anlat.

**Onay koşulları:**

- Başlık iki yönlü BFS olarak değişir.
- Kod gerçekten iki frontier ve iki arama yönü içerir.
- Graph tam 10 node içerir.
- En az iki alternatif yol bulunur.
- Hazır graph birebir kopyalanmaz; fallback ise açıkça söylenir.
- Start ve target geçerlidir.
- İki frontier farklı görünür.
- Node vurgularıyla birlikte edge'ler de vurgulanır.
- Meeting node hesaplanır.
- Final path gerçek graph edge'lerinden oluşur.
- Simülasyon başlar ve önemli yerde durup anlatır.
- Final sonuç ayrıca açıklanır.
- Anlatım tamamlanmadan görev tamamlandı sayılmaz.

### Senaryo 16 — Kullanıcının graphıyla özel algoritma

**Kullanıcı amacı:** AI'ın hazır graphını değil kendi çizdiği graphı kullanmak.

**Kullanıcı davranışı:**

1. Kendi graphını oluşturur.
2. `Benim graphım üzerinde iki yönlü BFS yaz` der.

**Onay koşulları:**

- Mevcut node ve edge'ler korunur.
- AI graphı hazır örnekle değiştirmez.
- Trace kullanıcının node ID'lerinden söz eder.
- Eksik start/target varsa sessizce yanlış seçim yapmak yerine açıkça çözer.

### Senaryo 17 — Belirsiz özel algoritma isteği

**Kullanıcı isteği:**

> Bana yeni ve hızlı bir arama algoritması yaz.

**Onay koşulları:**

- Sistem veri türü, hedef ve başarı ölçütü eksikliğini fark eder.
- Gereken bilgiyi kullanıcıdan ister.
- Rastgele kodu workspace'e uygulayıp başarı iddia etmez.
- Mevcut çalışma alanı değişmez.

### Senaryo 18 — Özel görseli değiştirme

**Kullanıcı isteği:**

> Nodeları daha geniş yay. Başlangıç ve hedef tarafını farklı şekillerle göster.

**Onay koşulları:**

- Kod değişmez.
- Graph bağlantıları değişmez.
- Trace adım sayısı değişmez.
- Node konumları ve görsel roller değişir.
- İki taraf renk dışında başka bir görsel özellik ile de ayrılır.

### Senaryo 19 — Özel grapha node ekleme

**Kullanıcı isteği:**

> X node'unu ekle, B ile X ve X ile hedef arasında bağlantı kur ve tekrar çalıştır.

**Onay koşulları:**

- X benzersiz eklenir.
- Edge referansları geçerlidir.
- Özel çalışma yeniden simüle edilir.
- Yeni trace X'i kullanabilir.
- Başarısız derlemede eski çalışan çalışma geri gelir.

### Senaryo 20 — Öğretmen gibi gezdirme

**Kullanıcı amacı:** Kodun içinde kritik noktalarda durarak öğrenmek.

**Kullanıcı davranışı:**

- `Önemli adımlarda durup öğretmen gibi anlat` der.
- Bir durakta `burayı tekrar anlat` der.
- Sonra `devam` der.
- Daha sonra `önceki önemli adıma dön` der.

**Onay koşulları:**

- Yalnızca gerçek checkpointlerde durulur.
- Her anlatım kod, veri, görsel, mantık ve zaman bakışlarını içerir.
- Tekrar anlat komutu indexi değiştirmez.
- Devam doğru sonraki checkpoint'e gider.
- Geri komutu bütün görsel ve değişken state'ini geri alır.

### Senaryo 21 — Anlatımı kesme

**Kullanıcı davranışı:**

- AI bir adımı anlatırken `dur, 7. adıma dön` der.

**Onay koşulları:**

- Eski anlatım geçersiz kabul edilir.
- Timeline 7. adıma gider ve durur.
- Yeni anlatım yalnızca 7. adımı kullanır.
- Eski cevabın geç kalan kısmı yeni cevap olarak görünmez.

### Senaryo 22 — Final tabloyu doğrulama

**Kullanıcı amacı:** Simülasyonun sonunda ne olduğunu anlamak.

**Onay koşulları:**

- Sonuç durumu açıkça belirtilir.
- Path, maliyet veya algoritmaya uygun final değer gösterilir.
- Ziyaret edilen öğe sayıları gerçek trace ile eşleşir.
- Meeting veya kritik final olayı gerçek step numarasıyla ilişkilidir.
- Ulaşılamayan hedef başarı gibi gösterilmez.

### Senaryo 23 — Ajan kuyruğunu izleme ve iptal

**Kullanıcı davranışı:**

- Büyük özel algoritma isteği başlatır.
- Kuyruktaki işleri izler.
- İşlem ortasında Cancel yapar.

**Onay koşulları:**

- Hangi işin çalıştığı görünür.
- Progress sahte biçimde tamamlanmaz.
- Aktif ve bekleyen işler iptal edilir.
- Yarım kod veya input uygulanmaz.
- Önceki workspace kullanılabilir kalır.
- Sohbet ve kontroller kilitli kalmaz.

### Senaryo 24 — Ajan hatası ve rollback

**Kullanıcı amacı:** Sistem hata verdiğinde çalışmasını kaybetmemek.

**Kabul davranışı:**

- Geçersiz kod sınırlı sayıda düzeltilebilir.
- Düzelmezse görev başarısız olarak görünür.
- Compiler hatasında başlık, kod, input ve trace birlikte eski state'e döner.
- Hatanın hangi aşamada olduğu anlaşılır.
- AI tamamlandı demez.

### Senaryo 25 — Radio autoplay gerçeği

**Kullanıcı davranışı:**

- Açılışta radyoyu otomatik başlat ayarını açar.
- Sayfayı yeni ziyaret olarak açar.

**Onay koşulları:**

- Radyo paneli hazırlanır.
- Tarayıcı playi engellerse Pause gösterilmez.
- İlk kullanıcı etkileşiminde play tekrar denenir.
- Oynatma başlamadan wave hareketli playing state'e geçmez.

### Senaryo 26 — Radio loop ve minimize

**Kullanıcı davranışı:**

- Bir şarkıyı oynatır.
- Loop butonunu açar.
- Şarkının bitişini bekler veya bitiş durumunu oluşturur.
- Otomatik minimize süresini farklı değerlere getirir.

**Onay koşulları:**

- Aynı şarkı baştan başlar, sonraki şarkıya geçmez.
- Şarkı bittiği anda playlistte seçili parça indexi değişmez.
- Oynatma konumu `0:00`a döner ve aynı parçada playback yeniden başlar.
- Şarkının başlık ve kapak bilgisi farklı parçaya dönüşmez.
- Loop kapatılınca normal playlist ilerleyebilir.
- Countdown ring ve panel kapanışı aynı süreyi kullanır.
- `Hiç` seçildiğinde panel otomatik kapanmaz.

**Red koşulları:**

- Loop aktifken şarkı bitince playlist indexi bir sonraki parçaya geçerse.
- Aynı şarkı yerine playlistteki başka bir şarkı başlarsa.
- UI loop aktif gösterdiği halde player normal playlist akışına devam ederse.

### Senaryo 27 — Hata fırtınası

**Kullanıcı davranışı:**

- Hatalı input girer.
- Model inference hatası yaşar.
- Radio API yükleme hatası yaşar.
- God Mode işlemini iptal eder.
- Sayfayı bozuk eski layout state'iyle açar.

**Onay koşulları:**

- Uygulama tamamen crash olmaz.
- Her hata kendi bölümünde görünür.
- Bir bölümün hatası diğer temel bölümleri çalışamaz hale getirmez.
- Kullanıcı reset yapmak zorunda kalmadan devam edebilir.

### Senaryo 28 — Dar ekran gerçek kullanım

**Kullanıcı davranışı:**

- Dar ekran veya mobil boyutta algoritma seçer.
- Input girer ve simüle eder.
- Timeline kullanır.
- AI'a soru sorar.
- Ayarları ve radyoyu açar.

**Onay koşulları:**

- Yatay sayfa taşması yoktur.
- Temel butonlar erişilebilirdir.
- Panel ayırıcıları mobile uygun biçimde devre dışıdır.
- AI composer ve tracker cevabı tamamen kapatmaz.
- Dialog veya menu viewport dışında kalmaz.

### Senaryo 29 — Reset sınırı

**Kullanıcı amacı:** Uygulamayı sıfırlarken modelini veya başka veriyi kaybetmemek.

**Kullanıcı davranışı:**

- Layout, input, chat, tema, radio ve AI tercihlerini değiştirir.
- Arayüz sıfırlama yapar.
- Daha sonra genel uygulama sıfırlama yapar.

**Onay koşulları:**

- Arayüz reset yalnızca arayüz kapsamını etkiler.
- Genel reset yalnızca CodeXRay uygulama verisini temizler.
- Cached model dosyaları genel resetle silinmez.
- Başka origin keyleri korunur.
- Uygulama güvenli varsayılanlarla tekrar açılır.

### Senaryo 30 — Yayına hazır bütün ürün turu

Ürün test edicisi release öncesinde aşağıdaki işlemleri tek browser profilinde tamamlar:

1. AI olmadan bir array algoritması çalıştırır.
2. Kendi inputuyla bir string algoritması çalıştırır.
3. Tree import edip traversal yapar.
4. Graph Builder ile graph çizip shortest path çalıştırır.
5. Timeline ileri/geri ve pin kullanır.
6. Türkçe/İngilizce ve üç temayı dener.
7. Yerel modeli yükler ve normal soru sorar.
8. Hazır algoritmayı doğal dille açar.
9. Özel iki yönlü BFS üretip canlı anlatımı tamamlar.
10. Özel grapha node ekleyip yeniden simüle eder.
11. Ajan işlemini iptal edip rollback davranışını görür.
12. Radyoda play, loop ve minimizeyi dener.
13. Panelleri resize/collapse eder.
14. Dar ekranı kontrol eder.
15. Reset sınırlarını kontrol eder.

Bu turun herhangi bir zorunlu adımı çalışmıyorsa ürünün ilgili bölümü onaylanmaz.

### Senaryo 31 — Timeline komutunda iç prompt sızıntısı olmaması

**Kullanıcı amacı:** DFS simülasyonunu belirli bir noktaya götürmek.

**Kullanıcı davranışı:**

1. `DFS aç` der.
2. Simülasyon oluştuktan sonra `DFS'i 10. adıma kadar ilerlet` der.

**Onay koşulları:**

- Workspace gerçekten istenen adıma veya trace daha kısaysa ulaşılabilen son
  adıma gider.
- Playback doğru state'te durur veya istenen davranışa göre devam eder.
- AI kısa biçimde hangi adıma ulaşıldığını söyler.
- İstenmişse yalnızca ulaşılan gerçek adımı açıklar.
- Cevapta system prompt, instruction context, snapshot dump veya iç görev metni
  görünmez.
- Cevapta `Wait`, `Let's check`, `My task`, `Conflict Check` gibi modelin kendi
  kendine konuştuğu bölümler görünmez.
- Model, satır numarasından emin değilse uzun tahmin yürütmek yerine gerçek
  snapshot verisini kullanır veya belirsizliği kısa biçimde belirtir.

**Red koşulları:**

- Kullanıcıya modelin iç talimatları gösterilirse.
- Model workspace yerine kendi önceki tahminiyle tartışırsa.
- Timeline değişmeden işlem yapılmış gibi cevap verilirse.
- Basit navigation komutu yüzlerce kelimelik reasoning mesajına dönüşürse.

### Senaryo 32 — Uzun Markdown cevabının paneli bozmaması

**Kullanıcı amacı:** İçinde kod, tablo ve listeler bulunan uzun bir açıklamayı
okumak.

**Kullanıcı davranışı:**

- AI'dan mevcut algoritmayı kod örneği ve karşılaştırma tablosuyla açıklamasını
  ister.
- AI panelini minimuma yakın genişliğe küçültür.
- Sonra paneli büyütür.

**Onay koşulları:**

- Mesaj balonu panel genişliğini aşmaz.
- Bütün sayfada yatay scroll oluşmaz.
- Code block kendi içinde yatay kaydırılabilir.
- Normal açıklama metni panel genişliğine göre satır kırar.
- Tablo genişse yalnızca tablo bölümü kaydırılır.
- Copy butonu görünür ve erişilebilir kalır.
- Input alanı kullanılabilir kalır.
- Panel büyütülüp küçültüldüğünde içerik kaybolmaz.

### Senaryo 33 — Model reasoning üretse bile temiz kullanıcı cevabı

**Kullanıcı amacı:** Modelin iç düşünme biçimini değil, net cevabı görmek.

**Kullanıcı davranışı:**

- Reasoning üretmeye yatkın yerel bir modelle birkaç farklı soru sorar.
- Mevcut step açıklaması, complexity sorusu ve God Mode komutunu ayrı ayrı dener.

**Onay koşulları:**

- `<think>` veya benzeri bloklar görünmez.
- İç prompt ya da role instruction görünmez.
- Kullanıcıya verilen cevap soru ile doğrudan ilgilidir.
- Gerçek action sonucu varsa önce state uygulanır ve cevap yeni state'i anlatır.
- Temizleme sonrasında cevap anlamlı ve tamamlanmış kalır.
- Gizlenen içerik copy işlemine dahil edilmez.

### Senaryo 34 — Zararlı veya bozuk Markdown dayanıklılığı

**Kullanıcı amacı:** Hatalı model çıktısının arayüzü bozmamasını görmek.

**Deneme içeriği:**

- kapanmamış code fence;
- çok uzun tek satır kod;
- çok uzun URL;
- geniş Markdown tablosu;
- nested liste;
- HTML/script benzeri metin;
- beklenmedik prompt/reasoning etiketi.

**Onay koşulları:**

- Uygulama crash olmaz.
- Cevap kartı panel dışına taşmaz.
- Zararlı HTML veya script çalışmaz.
- Mümkün olan Markdown güvenli biçimde gösterilir.
- Bozuk bölüm diğer mesajların layoutunu bozmaz.
- Sonraki kullanıcı mesajı normal biçimde gönderilebilir.
- İç prompt/reasoning etiketi görünür kullanıcı metnine sızmaz.

---

## 17. Rastgele ve bilinmeyen input ile kabul kuralları

Hazır fixture'lar regression için yararlıdır; ancak insan kabulü yalnızca hazır
örneklere bağlı olmamalıdır.

İncelemeyi yapan kişi aşağıdaki yöntemi kullanmalıdır:

### 17.1 Array

- Uygulamaya önceden yazılmamış en az üç array oluştur.
- Uzunluk, negatif değer, tekrar eden değer ve sıralı/ters sıralı durumları
  değiştir.
- Beklenen final sonucu uygulamadan bağımsız olarak hesapla.
- Uygulamanın sonucu ve ara adımları inputa göre değişiyor mu kontrol et.

### 17.2 String

- Kişisel veya rastgele bir metin kullan.
- Eşleşen ve eşleşmeyen pattern dene.
- Unicode/Türkçe karakter ekle.
- Hazır örnek açıklamasının yeni metinde tekrar edilmediğini kontrol et.

### 17.3 Tree

- Farklı derinlik ve eksik child düzenlerinde tree oluştur.
- Traversal sonucunu bağımsız elle veya başka güvenilir yöntemle karşılaştır.
- Aynı hazır tree şeklinin tekrar kullanılmadığını kontrol et.

### 17.4 Graph

- Node isimlerini alışılmadık ama geçerli değerlerden seç.
- Edge yapısını ve ağırlıkları incelemeyi yapan kişi belirlesin.
- Connected, disconnected, cycle, directed ve weighted durumlarını değiştir.
- Start/target ve beklenen path'i uygulamaya önceden söylemeden sonucu karşılaştır.

### 17.5 Özel AI isteği

- Aynı algoritmayı farklı input şartlarıyla en az üç kez iste.
- Kodun ve inputun isteğe gerçekten uyduğunu kontrol et.
- Her istekte aynı hazır graphın dönüp dönmediğini kontrol et.
- Görsel tasarım talebini değiştir ve yalnızca renk adının değişmediğini doğrula.
- AI'ın istenmeyen bir işlemi sırf yapabildiği için eklemediğini kontrol et.

### 17.6 Tekrarlanabilirlik

- Rastgele testte hata bulunursa kullanılan input aynen kaydedilmelidir.
- Aynı input yeniden verildiğinde hata tekrar gözlenebilmelidir.
- Düzeltmeden sonra aynı input regression kontrolü olarak tekrar kullanılmalıdır.

---

## 18. Ürün test edicisi onay listesi

Belge onayı davranışlar görülmeden ürün onayı anlamına gelmez. Aşağıdaki alanlar
ayrı ayrı incelenmelidir:

- [ ] Ana çalışma alanı ve panel davranışları
- [ ] 60 algoritmalık katalog bütünlüğü
- [ ] Array inputları
- [ ] String inputları
- [ ] Tree import, export ve simülasyon
- [ ] Graph input ve Graph Builder
- [ ] Timeline play/pause/ileri/geri/hız
- [ ] Kod satırı ve görsel senkronizasyonu
- [ ] Variables, trace ve pin sistemi
- [ ] Türkçe/İngilizce
- [ ] Neon/dark/light tema
- [ ] Dar ekran ve klavye kullanımı
- [ ] Yerel model ilk yükleme
- [ ] Cached model geri dönüşü ve model silme
- [ ] Normal AI sohbeti, copy ve clear
- [ ] AI iç prompt/reasoning sızıntısı olmaması
- [ ] Markdown ve code block taşma güvenliği
- [ ] Uzun AI cevabında panel ve composer kullanılabilirliği
- [ ] Hazır algoritmayı doğal dille açma
- [ ] God Mode özel algoritma üretimi
- [ ] Kullanıcı inputunu koruma
- [ ] Özgün node/edge tasarımı
- [ ] Özel graph düzenleme ve yeniden simülasyon
- [ ] Beş boyutlu canlı öğretim
- [ ] Final sonuç/tablo anlatımı
- [ ] Ajan tracker, iptal ve hata görünürlüğü
- [ ] Rollback, Undo ve Redo
- [ ] CodeXRay Radio autoplay gerçeği
- [ ] Radio loop, playlist, wave ve minimize
- [ ] Storage ve reset sınırları
- [ ] Hata fırtınası dayanıklılığı
- [ ] Rastgele/bilinmeyen input turu
- [ ] Yayına hazır bütün ürün turu

### Nihai onay cümlesi

Ürün test edicisi yalnızca bütün zorunlu alanları gördükten sonra aşağıdaki ifadeyi
onaylamalıdır:

> CodeXRay'in yalnızca hazırlanmış örneklerde değil, benim seçtiğim gerçek ve
> önceden bilinmeyen inputlarda da doğru çalıştığını; kod, input, simülasyon,
> görsel ve AI anlatımının birbiriyle tutarlı olduğunu; hatalarda çalışmamı
> kaybetmediğimi ve uygulamanın temel bölümlerini insan olarak kullanıp
> doğruladığımı kabul ediyorum.

Bu cümle onaylanmadan ürünün tamamı bitmiş sayılmaz.
