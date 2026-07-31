# CodeXRay Update Notes (Changelog)

This document tracks all version history, improvements, bug fixes, and feature additions made to CodeXRay.

## [v1.1.0] - 2026-07-31

### Eklendi (Added)
- **Kapsamlı AI Geliştirme Rehberi**: Yapay zekanın (Antigravity ve diğer modellerin) projeyi daha hızlı ve hatasız anlaması için `.agents/AGENTS.md` sistem dosyası oluşturuldu. İçerisinde mimari şemalar, geliştirme kuralları ve klasör yapıları bulunuyor.
- **Radyo Otoplay & Minimal UI**: Radyo paneli tamamen küçültülerek bir "minimal medya oynatıcısına" çevrildi. Video/kapak fotoğrafı gizlendi. Seçilen YouTube Müzik listesi (`OLAK5uy_kojiLJf49fStilkx_cFUhxqoDXzcSyfg0`) radyo açılır açılmaz otomatik çalmaya (autoplay) başladı. Ayriyeten, radyo ikonuna tıklandığında müzik kesilmeden arayüz minimize edilebilir hale getirildi.
- **Radyo Medya Kontrolleri**: Minimal oynatıcı arayüzüne (YouTube Iframe API entegrasyonu ile) "Oynat/Durdur", "Önceki/Sonraki Şarkı", "Döngü (Loop)" ve "Karışık Çal (Shuffle)" butonları eklendi. Tam donanımlı bir müzik kontrolcüsü haline getirildi.
- **Detaylı Kurulum Rehberi**: `README.md` güncellendi ve Windows, macOS ve Linux sistemler için net komutları içeren "Kolay Yükleme Talimatları" (Quick Start & Installation) eklendi.
- **Versiyon Takip Sistemi (Update Notes)**: `UPDATENOTES.md` (bu dosya) projeye dahil edildi. Uygulama içerisindeki Ayarlar menüsüne mevcut sürümü gösteren bir ibare (v1.1.0) yerleştirildi.

### Düzeltildi (Fixed)
- Ayarlar üzerinden AI Modeli indirme işlemlerinin "localhost" ile "canlı domain" arasında paylaşılamaması (Browser Same-Origin Policy) sorunu nedeniyle kullanıcılara yönelik detaylı açıklamalar ve rehberlik eklendi.

### Notlar (Notes)
- Serkan'ın (`srknzl`) GitHub reporsundan `feature/teknesyum-gelistirmeleri` isimli yepyeni bir geliştirme dalı açıldı. Majör yapay zeka entegrasyonu öncesi hazırlıklar tamamlandı.

---

## [v1.0.0] - İlk Sürüm (Serkan Fork)
- 60 farklı deterministik algoritma simülasyonu eklendi.
- WebLLM/WebGPU üzerinden donanım tabanlı çalışan, tamamen tarayıcıda koşan on-device (Qwen) yapay zeka asistanı entegre edildi.
- Değişkenleri anlık izleme (Watch Strip) ve gelişmiş hata ayıklama panelleri geliştirildi.
- Türkçe-İngilizce çift dil desteği ve karanlık (cyberpunk/neon) tema sağlandı.
