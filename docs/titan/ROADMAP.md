# Titan Yol Haritası

## Özet

R33 kapandı; 33 rotanın hepsinin handoff'u var, sıra T0'da. Bu dosya sıradaki rotaların
sırasını, gerekçesini ve fiyatını tutar; kod yazma yetkisi taşımaz, o yetki yalnız açık rotadadır.
Sırayı T0 yazar, insan değiştirir; bir rota açılınca buradaki satırı değil `routes/R<nn>` dosyası kazanır.

## Durum (2026-09-09, `07fabbc`)

| Ölçü | Değer |
|---|---|
| Birim test | 923 / 123 dosya |
| e2e | 89 + 2 `@performance` |
| Başlangıç JS | 358.9 / 376.0 KiB — **17.1 KiB pay** |
| `runtimeReplacements` | 750 satır, `src/i18n/runtimeReplacements.ts`, lazy parça (66.21 kB) |
| DoD | 8 kapalı, 4 açık (1, 3, 11, 12), 1 ertelenmiş (13) |

Ölçüm komutları: `npm run build` çıktısındaki `Initial JavaScript` satırı;
`grep -c "^  \[/" src/i18n/runtimeReplacements.ts`.

## Sıra

Her rota önce ölçer, sonra değiştirir, sonra aynı ölçüyü tekrar alır. Bütçe hiçbir rotada
yükseltilmez. Fiyat = beklenen dosya sayısı + kapanış commit sayısı; Sole'un tur süresi değil.

| # | Rota | Neden şimdi | Fiyat |
|---|---|---|---|
| ~~R33~~ | **Kapandı** (`7efe377` + `07fabbc`). Çeviri tablosu başlangıç paketinden çıkar; `Insertion Sort` adı tekilleşir | Pay 2.2 KiB. Bir sonraki i18n süpürmesi duvara çarpar ve `AGENTS.md` bütçeyi yükseltmeyi yasaklar. Tablo yalnız çalışma zamanı metni içindir; `en` kullanıcısı için tamamen ölü yük. H32 insan maddesi 3 aynı dosyada. | ~8 dosya, 1 commit |
| R34 | `AiAssistant.tsx:857` — `persistTitanModePlan` reddedilmiş-plan korumasından önce çalışıyor | `:1462`'deki silme ve `:1455`'teki temizleme haritası erişilemez; iptal edilen plan depoya yazılıyor. Kullanıcıya görünür: yenilemede hayalet plan. | ~3 dosya, 1 commit |
| R35 | Ölü ağırlık: `eventWeight`, `traceQuery.ts`, `inputRequestAdapter.test.ts:31` adı, `titanEntry.ts` markasız motor çağrısı | Ölçüldü: üretim kodunda `event:` atayan sıfır yer (`grep -rn "event: {" src/services` yalnız testler); `traceQuery` yalnız `traceIntelligence.test.ts`'ten import ediliyor. Silme kuralı gereği grep rotaya yapıştırılır, "sıfır üretim çağıranı" ile "sıfır çağıran" ayrı yazılır. | ~6 dosya, 1 commit |
| R36 | Üç yavaş e2e: `accessibility-axe:37` 9.9 s, `ai-actions:112` 12.5 s, `radio-controller:3` 8.1 s | Suite medyanının 3–4 katı; 2 işçiyle 2.4 dk'nın belirleyicisi. Önce ölçüm: her spec'te zamanın nereye gittiği. Bekleme kısaltmak yasak; sebep bulunur. | ~3 dosya, 1 commit |
| R37 | DoD 11 — SimLang-Lite 60 program korpusu | Testte tur-atma var, korpus yok. 60 kayıtlı simülatörün her biri için bir program; gidiş-dönüş bire bir. | ~4 dosya (korpus tek dosya), 1 commit |
| R38 | DoD 1 — `class`, `async/await`, üreteç, TypeScript girdisi | En büyük ürün maddesi. 5+ dosya kuralı: önce `docs/plan.md`; muhtemelen üçe bölünür (TS soyma / class / async). | 3 rota, her biri ~6 dosya |
| R39 | DoD 12 — Windows 11 temiz kurulum | `desktop-release.yml` NSIS paketliyor, kurulum adımı ve duman testi yok. CI'da `windows-latest` üstünde kur-çalıştır-kaldır. | ~2 dosya, 1 commit; CI çıktısı T0 kapatır |

## İnsan gerektirenler

- **DoD 3** — canlı yerel model (LM Studio, `muse-glimmer-30b@q4_k_xl`) ile gezinme ve girdi
  düzenleme. Makinede modelin yüklü olması gerekir; ajan model indiremez.
- **DoD 13** — GBNF gramer kısıtlı çözümleme. Tetikleyici: GBNF ilan eden erişilebilir bir
  llama.cpp/LM Studio ucu. `DOD.md` "Deferred items" bölümü ne istendiğini yazar.

## Değişmeyen kurallar

- Başlangıç JS bütçesi yükseltilmez; R33 onu 425 → **376 KiB**'ye indirdi ve kilit budur.
  Sonraki süpürmenin payı 17.1 KiB; tükenirse cevap bütçeyi yükseltmek değil, yine taşımaktır.
- `AGENTS.md`'deki ders: bağlanmış olmak işini yaptığı anlamına gelmez; mevcut tablo girdisi de
  Türkçe çıktı anlamına gelmez. Kapatan tek ölçü kalıntıdır.
- Rota sırasını yalnız bu dosya ve insan değiştirir; bir handoff'un `## Blockers` bölümü sırayı
  değiştiremez, yalnız T0'a soru sorar.
