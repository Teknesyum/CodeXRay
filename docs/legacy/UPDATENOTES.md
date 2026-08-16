# CodeXRay Update Notes (Changelog)

This document tracks all version history, improvements, bug fixes, and feature additions made to CodeXRay.

## Unreleased — God Mode 2

### Added

- Added `VisualizationContractV2` and `GraphLayoutSpecV1` with trace-backed semantic node and edge roles, dual-frontier styling, responsive deterministic layout, collision checks, custom legends, and result emphasis.
- Added Visual Designer, Layout Engineer, Trace Director, and Result Analyst jobs to the local God Mode queue.
- Added `TeachingPlanV1` and `StepNarrationV1`. Generated packages now contain grounded checkpoint narration across code, data, visual, reasoning, and time lenses, plus final metrics and correctness analysis.
- Added automatic guided playback for generated packages. Playback pauses at real high-priority checkpoints and the assistant narrates the committed snapshot.
- Added graph transaction classification. Position-only edits preserve trace semantics; structural edits recompile atomically and retain the last working package on failure.
- Added original teaching-input generation with explicit user, agent, and fallback provenance.

### Changed

- Rebuilt all three ready-made inputs for every algorithm around algorithm-specific teaching cases, including meaningful misses, duplicates, negative-only cases, DAGs, SCCs, flow networks, articulation structures, and weighted shortest-path graphs.
- God Mode routing now distinguishes opening a preset, authoring custom code, preserving the current graph, changing only layout, and asking a knowledge-only question.
- Custom workspace titles are canonical and update immediately when generation starts.

### Fixed

- Single-track radio repeat now reselects the last playing playlist index after YouTube reports `ENDED`, preventing the playlist from advancing while repeat is active.

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
