# CodeXRay: Çoklu Çözüm (Multi-Path) ve Optimizasyon Kullanım Senaryoları

Bu belge, CodeXRay yerel yapay zeka (God Mode) asistanının, aynı algoritma problemini birden fazla yaklaşımla (farklı zaman/uzay karmaşıklığı veya tamamen farklı algoritmik paradigmalarla) nasıl dinamik olarak (On-Demand) simüle edeceğinin referansını içerir.

Statik olarak on binlerce sorunun tüm çözüm yollarını veritabanına yazmak imkansız olduğundan, sistem **Kısıtlama ve İstek Odaklı (Constraint-Driven)** çalışır. Kullanıcı bir optimizasyon talep ettiğinde, YZ orkestratörü önceki şablonu (ProblemSpec & Contract) alır ve sadece talep edilen eksende güncelleyerek anında yeni bir animasyon/C++ simülasyonu türetir.

---

## 1. Bellek (Space) Optimizasyonu Senaryosu

En yaygın kullanım senaryosu Dinamik Programlama (DP) tablolarının optimize edilmesidir.

### **Örnek Soru:** LCS (Longest Common Subsequence) / 2D DP
* **İlk İstek:** "LCS sorusunu yaz ve simüle et."
* **YZ'nin İlk Hamlesi (Default):**
  - YZ kataloğa bakar ve LCS'i bulur.
  - Klasik `2d-dp` şablonunu kullanır.
  - `O(m * n)` zaman ve `O(m * n)` bellek karmaşıklığıyla (büyük bir 2B matris çizerek) animasyonu oluşturur.
* **Kullanıcının Yeni İsteği:** *"Bu sorunun 2D DP versiyonunun uzay karmaşıklığını (space complexity) O(min(m,n)) yapacak şekilde optimize edilmiş halini simüle et."*
* **YZ'nin Dinamik (On-Demand) Tepkisi:**
  - YZ problemi hafızasından silmez. Sözleşmeyi (Contract) günceller.
  - Tablo gösterimini 2D'den 1D (sadece 2 satır tutan `prev` ve `curr` dizileri) formatına çeker.
  - Kodlama (Code Author) ajanı, nested for döngülerinin içindeki matris erişimini `dp[i][j]` yerine `dp[j]` mantığına uyarlar.
  - Ekranda artık dev bir matris değil, sürekli güncellenen tek boyutlu (1D) bir dizi animasyonu gösterilir.

---

## 2. Paradigma (Approach) Değiştirme Senaryosu

Aynı sorunun hem DP hem de Greedy (veya başka bir mantık) ile çözülebildiği durumlar.

### **Örnek Soru:** Jump Game veya Coin Change
* **İlk İstek:** "Jump Game sorusunu dinamik programlama ile çöz."
* **YZ'nin İlk Hamlesi:**
  - Problemi `1d-dp` olarak modeller.
  - Son elemandan veya baştan başlayarak `O(N^2)` sürede her zıplama ihtimalini DP tablosuna yazar ve simüle eder.
* **Kullanıcının Yeni İsteği:** *"Şimdi aynı sorunun Greedy (Açgözlü) yaklaşımıyla çözümünü simüle et."*
* **YZ'nin Dinamik (On-Demand) Tepkisi:**
  - YZ, problemi `dp` tipinden çıkartıp `greedy` veya `array` (two-pointers benzeri tek geçiş) şablonuna çevirir.
  - Karmaşıklık Sözleşmesi `O(N)` Zaman ve `O(1)` Bellek olarak revize edilir.
  - C++ kodunda YZ bir DP tablosu kullanmak yerine sadece `maxReach` değişkenini tutarak ilerler.
  - Animasyonda YZ artık kutuları teker teker doldurmaz; bir işaretçi (pointer) ile `maxReach` çizgisini sağa doğru çeker.

---

## 3. Zaman (Time) Optimizasyonu Senaryosu

Arama ve sıralama tabanlı problemlerde sıkça karşılaşılan optimizasyonlardır.

### **Örnek Soru:** Longest Increasing Subsequence (LIS)
* **İlk İstek:** "LIS sorusunu anlat."
* **YZ'nin İlk Hamlesi:**
  - Klasik `1d-dp` yaklaşımını uygular.
  - `O(N^2)` zamanda çalışan, iç içe 2 döngülü (i ve j) temel algoritmayı simüle eder.
* **Kullanıcının Yeni İsteği:** *"Bunu O(N log N) zamanında çalışacak Binary Search (İkili Arama) optimizasyonu ile çöz."*
* **YZ'nin Dinamik (On-Demand) Tepkisi:**
  - Ajan, sözleşmedeki kısıtlamayı güncelleyerek Binary Search mantığını devreye sokar.
  - `dp` dizisi yerine, simülasyona sıralı bir `tails` veya `active_lists` dizisi yerleştirilir.
  - Animasyonda artık iç içe geçişler (lineer tarama) yerine, YZ'nin ortadan bölerek (Binary Search) değer değiştirdiği zeki adımlar gösterilir.

---

## 4. Sistem Arka Planı (God Mode Nasıl Çalışır?)

CodeXRay, bu senaryoları uygularken **22.027 soruluk `algorithmCatalog.json` veritabanını kullanır.** Bu veritabanı, sorunun adını ve temel etiketlerini (örn: `dp`, `greedy`) sağlar.

Ancak "Greedy kodu nasıl yazılır" veya "O(N) belleğe nasıl düşülür" kısımları **veritabanında statik olarak saklanmaz**. Bunun yerine:
1. **Intent Router:** Kullanıcının mesajından hedef karmaşıklığı (`O(N)` bellek veya `O(N log N)` zaman) veya yöntemi (`Greedy`) ayrıştırır.
2. **Algorithm Architect (YZ):** Seçilen sorunun ana hatlarını bilir. Router'dan gelen yeni kurallara (constraints) bakarak *ProblemSpecV2* ve *DpFamilyContractV2* (veya ilgili şablonu) sıfırdan yeniden dizayn eder.
3. **Verification Gates:** YZ'nin yeni önerdiği "Optimize çözüm", sistemin kurallarıyla test edilir. Eğer YZ `O(N)` bellek sözü verip yine matris ayırdıysa kapıda (Gate) reddedilir ve düzeltilmesi istenir.
4. **Code Author:** Sıkı kurallara bağlanmış sözleşmeyi okuyup, tamamen yeni ve optimize edilmiş C++ kodunu ve simülasyon adımlarını üretir.

Bu **"On-Demand (Anında Talep Üzerine)"** mimari, CodeXRay'in dünyadaki her soru için sınırsız çözüm yolunu, veritabanını şişirmeden, sadece o an gerektiğinde (Just-in-Time) üretmesini sağlar.
