# H16 — `deferApply` is honoured once

## Turn

- Route: R16
- Base SHA: `1197541`
- End SHA: `aa947c1470ac6b64c9ad23a9893c3b7d6b121328`
- Status: `closed locally; T0 remote and reconciliation pending`
- Next holder: Claude (T0)

## Özet

Option A seçildi. Dört yaratım kolunun tamamı artık `deferApply` bayrağına uyar; deterministik
dizi şablonları beş fazlı boru hattına taşındı. Motor bu yolda yalnız paketi üretir, mevcut
critic kanıtı `verify` fazında denetlenir ve boru hattı paketi tam bir kez uygular. 813 birim
testi, 7 masaüstü testi ve yerel 71+2 E2E ilk denemede temiz geçti.

## Decision and paths

`applyPackageUnlessDeferred` şu dört motor uygulama noktasının ortak kapısı oldu:

| engine path | eager apply | deferred apply |
|---|---:|---:|
| interval-DP creation | 1 | 0 |
| deterministic array-template creation | 1 | 0 |
| DP-template creation | 1 | 0 |
| custom/model-authored creation | 1 | 0 |

Yalnız `create-algorithm` intent'inin `jump-game-dp`, `jump-game-greedy`,
`lis-quadratic-dp` ve `lis-binary-search` deterministik dizi şablonları yeni giriş noktasına
bağlandı. Diğer üç yaratım yolu bayrağa uyuyor fakat bu turda pipeline'a bağlanmadı.

## Exactly once and forgotten apply

`titanEngine.test.ts` dört kolun her birini hem eager hem deferred çalıştırıp `applyPackage`
sayısını sırasıyla 1 ve 0 olarak ölçüyor. `titanPipeline.test.ts` ise dizi motoruna
`deferApply: true` verildiğini, motor callback'inin produce sırasında çağrılmadığını ve aynı
paketin pipeline run id'siyle tam bir kez uygulandığını kanıtlıyor.

`TitanPipelineTasks.apply` tip seviyesinde zorunlu kalıyor. Buna rağmen tipi `any` ile aşan
bir caller için ek test, başarılı produce ve verify sonrasında eksik `apply` çağrısının
sessiz başarıya değil `/apply/` içeren bir exception'a dönüştüğünü kanıtlıyor. Böylece
deferred-fakat-uygulanmamış başarı durumu normal TypeScript'te ifade edilemiyor, zorla
kurulursa yüksek sesle düşüyor.

## Verification semantics

Bu tur yaratım artifact'i için yeni bağımsız içerik doğrulayıcı icat etmedi. Dizi şablonunun
mevcut motor critic kanıtı yeniden denetleniyor: sonuç başarılı olmalı, paket testleri geçmiş
olmalı, trace boş olmamalı ve son adım bir `result` değişkeni taşımalı. Bu bir shape + existing
critic-evidence check'tir; model-authored paketler için yeterli olduğu iddia edilmiyor.

`adapt-input` kodu byte-for-byte değişmedi. R15'in şu testleri hâlâ geçiyor:

- `rejects a well-formed artifact whose carried trace disagrees with independent recomputation`
- `keeps the committed workspace untouched when verification rejects the produced artifact`
- başarılı adapt-input pipeline testi `deferApply: true` ve verify-before-apply sırasını koruyor

## User-visible preservation and progress

`e2e/usage-scenarios.spec.ts` içindeki “changes Jump Game from quadratic DP to linear greedy”
ve “changes LIS from quadratic DP to n-log-n binary search” senaryoları geçti. Bunlar yeni
giriş noktasından sonra aynı görünür paket, kaynak ve trace sonucunun uygulandığını doğruluyor.

Kullanıcı yine aynı beş sırayı görür: `route → produce → semantics → verify → apply`.
Önceden `startTitanModeRun` motorun iç işlerini aynı sentetik beş çubuğa katlıyordu; şimdi
dizi şablonlarında motor event/plan yayını bastırılıp aynı beş çubuğu pipeline doğrudan
yayımlıyor. Sıra, etiket ve ağırlık değişmedi; apply artık gerçekten son fazda gerçekleşiyor.

## Deferred successors

`discuss-current-step` bu turda değişmedi. Serbest model metninden deterministik, trace ile
karşılaştırılabilir iddia çıkarmak hâlâ `R17-grounded-current-step-verification` işidir.

`model-authored` giriş noktası pipeline'a bağlanmadı. Ortak motor uygulayıcısı bayrağa uyduğu
için mekanizma artık hazırdır; fakat `R18-model-authored-pipeline-verification` dış apply'dan
önce şema doğrulamayı, deterministik derlemeyi, örnek çalıştırmayı, görsel sözleşme kontrolünü
ve critic kapılarını üretilen artifact üzerinde bağımsız tekrar etmeli ve başarısızlıkta
rollback kanıtlamalıdır.

## Measurement delta

```text
BASE_DEFER_APPLY_COUNT=5
HEAD_DEFER_APPLY_COUNT=11
BASE_APPLY_PACKAGE_CALL_COUNT=8
HEAD_APPLY_PACKAGE_CALL_COUNT=6
NEW_MATH_RANDOM_LINES=0
```

Doğrudan çağrı sayısının iki azalması bir yol kaybı değildir: dört yaratım çağrısı ortak
`applyPackageUnlessDeferred` çağrısında birleşti, yeni dizi pipeline apply çağrısı eklendi.
`titanEntry.ts` bu motor/pipeline rotasının dışında kalır ve değişmedi.

## Gate output

```text
lint: exit code 0 — > oxlint
test: exit code 0 — Test Files 119 passed (119) | Tests 813 passed (813)
test count: before 807; after 813
build: exit code 0 — Initial JavaScript: 416.8 / 420.0 KiB
desktop:check: exit code 0 — test result: ok. 7 passed; 0 failed
local e2e: exit code 0 — 71 passed (1.2m) | 2 passed (36.2s), zero flaky
```

Local performance evidence:

```text
TIMELINE_MEASUREMENTS {"playwright":{"min":795.9753000000001,"median":873.4840999999988,"max":970.3060000000005},"inPage":{"min":165.09999999962747,"median":166.5,"max":167},"handler":{"min":0.40000000037252903,"median":0.7499999990686774,"max":1.0000000018626451},"deliberateDelayMs":0}
PERFORMANCE_BUDGET_MEASUREMENTS {"startupMs":1344.7393,"catalogMs":289.91959999999995,"simulationMs":76.62340000000017,"dpMs":2965.313699999999}
```

## Verification output

```text
aa947c1470ac6b64c9ad23a9893c3b7d6b121328
 .../routes/R16-defer-apply-is-honoured-once.md     | 218 +++++++++++++++++++++
 src/components/AiAssistant.tsx                     |  15 +-
 src/i18n/translations.ts                           |   2 +
 src/services/titan/titanPipeline.test.ts           |  53 +++++
 src/services/titan/titanPipeline.ts                |  93 +++++++++
 src/services/titanEngine.test.ts                   |  27 +++
 src/services/titanEngine.ts                        |  16 +-
 7 files changed, 418 insertions(+), 6 deletions(-)

src\services\titan\titanPipeline.test.ts:183: expect(options.deferApply).toBe(true);
src\services\titan\titanPipeline.test.ts:218: expect(options.deferApply).toBe(true);
src\services\titan\titanPipeline.test.ts:259: expect(options.deferApply).toBe(true);
src\services\titan\titanPipeline.ts:269: deferApply: true,
src\services\titan\titanPipeline.ts:342: deferApply: true,
src\services\titanEngine.test.ts:60: for (const deferApply of [false, true]) {
src\services\titanEngine.test.ts:72: deferApply,
src\services\titanEngine.test.ts:77: expect(applyPackage).toHaveBeenCalledTimes(deferApply ? 0 : 1);
src\services\titanEngine.ts:94: deferApply?: boolean;
src\services\titanEngine.ts:110: ): Promise<void> | void | string => options.deferApply
src\services\titanEngine.ts:973: if (options.deferApply) return 'Application deferred to the five-phase pipeline.';

src\services\titan\titanPipeline.ts:281: : options.applyPackage(result.package, runId);
src\services\titan\titanPipeline.ts:361: return options.applyPackage(result.package, runId);
src\services\titanEngine.test.ts:165: applyPackage(...args);
src\services\titanEngine.ts:112: : options.applyPackage(packageValue, runId);
src\services\titanEngine.ts:977: : options.applyPackage(updatedPackage, runId)
src\services\titanEntry.ts:146: await runJob('manager-atomic-apply', () => options.applyPackage(packageValue, runId));
```

The `Math.random` scan contains only base matches; R16 adds none.

## Acceptance

1. **Met** — Option A, four honoring paths, and the wired deterministic array intent are named.
2. **Met** — all four branches measure eager 1 / deferred 0; pipeline measures final apply 1.
3. **Met** — engine deferred zero and pipeline apply one are asserted in the same pipeline test.
4. **Met** — `apply` is type-required and omission forced through `any` fails loudly.
5. **Met** — adapt-input implementation is untouched and R15 tests pass.
6. **Met** — Jump Game and LIS user-visible E2E scenarios pass with the same package/trace result.
7. **Met** — model-authored is unwired; R18 requirements are recorded.
8. **Met** — discuss-current-step remains deferred to R17.
9. **Met** — lint, 813 tests, build, and desktop checks are clean.
10. **Met locally / T0 remote pending** — 71+2 E2E clean, zero flaky.
11. **Met locally** — signed close and handoff commits; T0 reconciliation remains.

## Commits

- `aa947c1470ac6b64c9ad23a9893c3b7d6b121328 route(R16): close`
- `handoff(H16): record` — this commit

Both were signed after `git config user.email` returned `iyott131@gmail.com`.

## Diff scope

All six implementation/test files are forecast by the route. The handoff is the only second
commit path. No frozen or T0-owned path was modified by Sole.

## Deviations

none

## Discovered

- The first external-server launch wrapper was rejected before execution by the Codex command
  policy. The documented `Start-Process npm.cmd` invocation was then run separately; only its
  recorded wrapper PID `6504` and listener PID `26604` were stopped after the clean suite.

## Untouched

- All AGENTS/CLAUDE/protocol/route files after the T0-authored R16 route.
- `adapt-input` implementation and R15 verifier.
- `discuss-current-step` verification.
- Model-authored production entry point and its existing engine gates.

## Blockers

none locally. T0 owns remote browser verification and `## T0 reconciliation`.
