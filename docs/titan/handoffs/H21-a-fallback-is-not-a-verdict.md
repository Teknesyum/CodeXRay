# H21 — a fallback is not a verdict

## Turn

- Route: `docs/titan/routes/R21-a-fallback-is-not-a-verdict.md`
- Base: `05e3307` (`route(R20): reconcile and close`)
- Head: `8b3b188` (`route(R21): close`) plus this handoff commit
- Status: `closed`
- Next holder: Claude (T0)
- Option taken: **A**

## Özet

Option A alındı. `callOptionalAgent` artık `{ source: 'model' | 'fallback'; text }` döndürüyor,
on altı çağrı yerinin hepsi güncellendi, ve her iş satırı `provenance` taşıyor: `runJob`
tamamlanan işi varsayılan olarak `deterministic` işaretliyor, benimsenen bir model cevabı onu
`model`'e yükseltiyor. İşaret `TitanModeProgress` satırında EN/TR görünüyor.

Kritik kapısı model cevabı için fail-closed oldu: kritik gerçekten cevap verdiyse ve
`safeJsonObject` onu çözemiyorsa çalışma atıyor, artık fallback'in `Deterministic tests
passed.` cümlesini kaydetmiyor. Kritiğin üstündeki iki deterministik kapı olduğu gibi duruyor.

Bu tur bir commit yolu açığı kapatmıyor; hangi yolların gerçekten etkilendiği kriter 9'da
düz yazılı.

## What changed

| Path:line-range | Intent | Change |
|---|---|---|
| `src/types/titan.ts:38` | `AgentAnswerProvenance = 'model' \| 'deterministic'` | added |
| `src/types/titan.ts:61` | `ManagerJobV1.provenance?: AgentAnswerProvenance` | added |
| `src/types/titan.ts:82` | `AgentRunEventV1.provenance?: AgentAnswerProvenance` | added |
| `src/services/titanEngine.ts:2` | imports `AgentAnswerProvenance` | edited |
| `src/services/titanEngine.ts:639-646` | `AgentAnswerSource`, `AgentAnswerV1`, `provenanceOf` | added |
| `src/services/titanEngine.ts:681-686` | `runJob` completion writes `provenance: target.provenance ?? 'deterministic'` | edited |
| `src/services/titanEngine.ts:771-791` | `callOptionalAgent` returns `AgentAnswerV1`; `adopt` records provenance and unwraps | edited |
| `src/services/titanEngine.ts:799-816` | `discuss-current-step` trace-analyst and tutor sites adopt | edited |
| `src/services/titanEngine.ts:1033-1050` | predict-winner architect: model contract only adopted when `source === 'model'` | edited |
| `src/services/titanEngine.ts:1053-1067` | predict-winner code-author records provenance | edited |
| `src/services/titanEngine.ts:1084-1099` | predict-winner visual-designer records provenance | edited |
| `src/services/titanEngine.ts:1135-1143` | predict-winner tutor adopts | edited |
| `src/services/titanEngine.ts:1215-1226` | array-template tutor adopts | edited |
| `src/services/titanEngine.ts:1318-1394` | custom/bidirectional architect carries `AgentAnswerV1` through both attempts; provenance is `model` only when a model answer parsed | edited |
| `src/services/titanEngine.ts:1382-1392` | bidirectional code-author records provenance | edited |
| `src/services/titanEngine.ts:1440-1443` | SimLang code-author (mandatory `callAgent`) records `provenance: 'model'` | edited |
| `src/services/titanEngine.ts:1460-1476` | input-engineer records provenance | edited |
| `src/services/titanEngine.ts:1491-1503` | visual-designer records provenance | edited |
| `src/services/titanEngine.ts:1516-1528` | layout-engineer records provenance | edited |
| `src/services/titanEngine.ts:1551-1576` | critic: fail-closed on an unparseable **model** answer; provenance recorded | edited |
| `src/services/titanEngine.ts:1579-1590` | trace-director records provenance | edited |
| `src/services/titanEngine.ts:1594-1605` | result-analyst records provenance | edited |
| `src/services/titanEngine.ts:1610-1625` | final tutor: `provenance: 'model'` only when the generated tour is actually used | edited |
| `src/components/TitanModeProgress.tsx:60-64,78-81` | `jobDetails` takes `locale` and appends the provenance marker to the tooltip | edited |
| `src/components/TitanModeProgress.tsx:258,265,278-283` | the marker is rendered on every agent row | edited |
| `src/components/AiAssistant.css:981-982` | `.agent-provenance` joins the existing `.agent-duration` rule; no new value | edited |
| `src/i18n/translations.ts:209-210,572-573` | `titanProvenance_model` / `titanProvenance_deterministic`, EN + TR | added |
| `src/services/titanEngine.test.ts:770-836` | probes A, B, C as permanent tests | added |
| `src/components/TitanProgress.test.tsx:31-46` | the rendered marker in both locales | added |

## Commits

| SHA | Subject |
|---|---|
| `8b3b1884bac19770f64c49ceb8f25fc6b0762663` | `route(R21): close` |
| (this file) | `handoff(H21): record` |

No `fix(R21)` was needed. Not pushed — push is T0's.

## Why Option A

T0's reading held under measurement. B and C share the same call-site edit, and the critic
guard cannot be made fail-closed without the discriminant: today's guard cannot distinguish
`{"passed":true,...}` **written by the engine as its own fallback** from the same object
returned by a model, so a fail-closed rule built on `parsed === null` alone would also throw
whenever no model ran at all — which is the normal deterministic-template case. The
discriminant is a precondition of C, not merely a shared cost.

The marker also rendered without inventing a token, which was the one measurement that would
have routed to C alone. `.agent-provenance` was added to the existing `.agent-duration`
declaration block rather than given its own values, so the diff introduces no color, no
size, and no spacing.

## What `callOptionalAgent` returns now

```ts
export type AgentAnswerSource = 'model' | 'fallback';

export interface AgentAnswerV1 {
  source: AgentAnswerSource;
  text: string;
}

const provenanceOf = (answer: AgentAnswerV1): AgentAnswerProvenance =>
  (answer.source === 'model' ? 'model' : 'deterministic');
```

```ts
  ): Promise<AgentAnswerV1> => {
    if (!useAdvisoryModel) return { source: 'fallback', text: fallback };
    try {
      const text = await callAgent(role, instructions, context, responseSchema, maxTokens);
      return { source: 'model', text };
    } catch {
      ensureActive();
      return { source: 'fallback', text: fallback };
    }
  };
  const adopt = (jobId: string, answer: AgentAnswerV1): string => {
    setJob(jobId, { provenance: provenanceOf(answer) });
    return answer.text;
  };
```

Provenance is a property of the whole plan, not only of the advisory sites, because `runJob`
supplies the floor:

```ts
      setJob(id, {
        status: 'completed',
        finishedAt: Date.now(),
        provenance: target.provenance ?? 'deterministic',
      });
```

So a job that never consulted a model — twelve of the thirteen rows on probe A's path — is
labelled `deterministic` without any site having to remember to say so, and only an explicit
`model` written during the job survives. Three sites deliberately do **not** call
`provenanceOf` blindly, because a model answer that was received and then discarded is not a
model-authored row: the predict-winner architect (`:1041`) labels `model` only when the parsed
contract is adopted, the custom architect (`:1375`) only when `parsed && answer.source ===
'model'`, and the final tutor (`:1620`) only when the generated tour passes its 140-character
floor and is actually returned.

## The critic guard, before and after

Before (`titanEngine.ts:1511-1520` at `05e3307`):

```ts
        const parsed = safeJsonObject(response);
        if (parsed?.passed === false) {
```

After (`titanEngine.ts:1559-1566` at `8b3b188`):

```ts
        const parsed = safeJsonObject(answer.text);
        if (answer.source === 'model' && !parsed) {
          throw new Error(options.locale === 'tr'
            ? 'Kritik ajanı çözümlenemeyen bir cevap döndürdü; paket onaylanmadı.'
            : 'Critic returned an unreadable answer; the package was not approved.');
        }
        if (parsed?.passed === false) {
```

The `answer.source === 'model'` conjunct is load-bearing in both directions. Without it a
run with no model would throw on its own fallback string, because the fallback is parsed by
the same `safeJsonObject`; with it, a run in which the critic genuinely answered and produced
prose can no longer be recorded as a pass.

## Gate output

### `git log -1 --format=%H`

```
8b3b1884bac19770f64c49ceb8f25fc6b0762663
```

### `git config user.email`

```
iyott131@gmail.com
```

### `git diff --name-only "05e3307..HEAD"`

```
docs/titan/routes/R21-a-fallback-is-not-a-verdict.md
src/components/AiAssistant.css
src/components/TitanModeProgress.tsx
src/components/TitanProgress.test.tsx
src/i18n/translations.ts
src/services/titanEngine.test.ts
src/services/titanEngine.ts
src/types/titan.ts
```

### `git diff --stat "05e3307..HEAD"`

```
 .../routes/R21-a-fallback-is-not-a-verdict.md      | 229 +++++++++++++++++++++
 src/components/AiAssistant.css                     |   3 +-
 src/components/TitanModeProgress.tsx               |  15 +-
 src/components/TitanProgress.test.tsx              |  16 ++
 src/i18n/translations.ts                           |   4 +
 src/services/titanEngine.test.ts                   |  67 ++++++
 src/services/titanEngine.ts                        | 173 +++++++++++-----
 src/types/titan.ts                                 |   4 +
 8 files changed, 451 insertions(+), 60 deletions(-)
```

### `Select-String -Pattern 'callOptionalAgent'` — base `05e3307`

```
src\services\titanEngine.ts:756:  const callOptionalAgent = async (
src\services\titanEngine.ts:780:          callOptionalAgent(
src\services\titanEngine.ts:789:          callOptionalAgent(
src\services\titanEngine.ts:1013:          const response = await callOptionalAgent(
src\services\titanEngine.ts:1034:          const summary = await callOptionalAgent(
src\services\titanEngine.ts:1061:          const summary = await callOptionalAgent(
src\services\titanEngine.ts:1108:          callOptionalAgent(
src\services\titanEngine.ts:1188:        const tutorAnswer = await runJob('tutor-prepare-five-lens-live-tour', () => callOptionalAgent(
src\services\titanEngine.ts:1290:          ? await callOptionalAgent(
src\services\titanEngine.ts:1351:          const response = await callOptionalAgent(
src\services\titanEngine.ts:1425:        const response = await callOptionalAgent(
src\services\titanEngine.ts:1453:        const response = await callOptionalAgent(
src\services\titanEngine.ts:1475:        const response = await callOptionalAgent(
src\services\titanEngine.ts:1507:        const response = await callOptionalAgent(
src\services\titanEngine.ts:1529:        const response = await callOptionalAgent(
src\services\titanEngine.ts:1541:        const response = await callOptionalAgent(
src\services\titanEngine.ts:1554:        const generated = await callOptionalAgent(
```

### `Select-String -Pattern 'callOptionalAgent'` — head `8b3b188`

```
src\services\titanEngine.ts:771:  const callOptionalAgent = async (
src\services\titanEngine.ts:800:          adopt('trace-analyst-analyze-discussion-checkpoint', await callOptionalAgent(
src\services\titanEngine.ts:809:          adopt('tutor-explain-through-five-lenses', await callOptionalAgent(
src\services\titanEngine.ts:1033:          const answer = await callOptionalAgent(
src\services\titanEngine.ts:1054:          const answer = await callOptionalAgent(
src\services\titanEngine.ts:1085:          const answer = await callOptionalAgent(
src\services\titanEngine.ts:1136:          adopt('tutor-prepare-five-lens-live-tour', await callOptionalAgent(
src\services\titanEngine.ts:1218:          await callOptionalAgent(
src\services\titanEngine.ts:1321:          ? await callOptionalAgent(
src\services\titanEngine.ts:1383:          const answer = await callOptionalAgent(
src\services\titanEngine.ts:1461:        const answer = await callOptionalAgent(
src\services\titanEngine.ts:1492:        const answer = await callOptionalAgent(
src\services\titanEngine.ts:1517:        const answer = await callOptionalAgent(
src\services\titanEngine.ts:1552:        const answer = await callOptionalAgent(
src\services\titanEngine.ts:1580:        const answer = await callOptionalAgent(
src\services\titanEngine.ts:1595:        const answer = await callOptionalAgent(
src\services\titanEngine.ts:1611:        const answer = await callOptionalAgent(
```

**Delta.** 17 matches before, 17 after — one definition and sixteen call sites, unchanged in
count. Every site that previously bound the result to `response`, `summary`, `generated`, or
returned it straight out of `runJob` now binds an `AgentAnswerV1` named `answer` or passes it
through `adopt(...)`. No site discards the discriminant: the compiler enforces it, because the
return type is no longer assignable to `string` — `npx tsc -b` exits 0 only after all sixteen
were converted. `:1218` (array-template tutor) and `:1321` (custom architect) are the two
sites where the value flows into a wrapper rather than a local: `adopt(...)` and
`let answer: AgentAnswerV1 = ... ? await callOptionalAgent(...) : { source: 'model', text: await callAgent(...) }`.

### `Select-String -Pattern 'parsed\?\.passed'` — base `05e3307`

```
src\services\titanEngine.ts:1516:        if (parsed?.passed === false) {
```

### `Select-String -Pattern 'parsed\?\.passed'` — head `8b3b188`

```
src\services\titanEngine.ts:1566:        if (parsed?.passed === false) {
```

**Delta.** One match before, one after; the surviving guard is unchanged. The change is the
new clause **above** it, which the grep pattern deliberately does not match because it tests
`answer.source`, not `parsed`. See `## The critic guard, before and after` for both bodies.

### `Get-Content src\services\titanEngine.ts | Select-Object -Skip 1500 -First 40` — head

```
          summary: answer.text.slice(0, 260),
          provenance: provenanceOf(answer),
        });
        return visualization;
      });
      await runJob('layout-engineer-resolve-responsive-graph-layout', async () => {
        if (!input.value.graph) return input;
        const layout = createGraphLayoutSpec(input.value.graph, design.title);
        const graph = applyGraphLayout(input.value.graph, layout);
        const quality = inspectGraphLayout(graph, Math.min(5, layout.minimumNodeDistance / 2));
        if (!quality.valid) throw new Error('Layout Engineer could not produce a collision-free graph.');
        input = {
          ...input,
          value: { ...input.value, text: '', graph },
        };
        visualization = createVisualizationContractV2(design, input.value, layout);
        const answer = await callOptionalAgent(
          'layout-engineer',
          'Review the deterministic layout quality report and briefly state why the strategy fits this graph.',
          JSON.stringify({ strategy: layout.strategy, quality, graph }),
          `${layout.strategy} layout passed overlap, bounds, and edge-endpoint checks.`,
          undefined,
          220,
        );
        setJob('layout-engineer-resolve-responsive-graph-layout', {
          summary: answer.text.slice(0, 260),
          provenance: provenanceOf(answer),
        });
        return input;
      });
      // The visual designer job always initializes this value before the layout job.
      const committedVisualization = visualization!;
      const packageValue = await runJob('compiler-compile-source-and-trace', () =>
        compileCustomSimulationPackage({
          id: `${program.id}-${runId}`,
          title: design.title,
          locale: options.locale,
          program,
          input,
          visualization: committedVisualization,
```

**This window no longer contains the two gates.** The route's seventh command was written
against `05e3307`, where the gates sat at `1505-1506`; the turn added 45 lines above them, so
they now sit at `1549-1550` and the fixed `-Skip 1500 -First 40` window (lines 1501-1540)
misses them. The command was run verbatim anyway and its output is above. The gates are shown
by the equivalent window below, `Select-Object -Skip 1544 -First 32`, and by the grep after it.

```
      await runJob('critic-test-visual-and-trace-alignment', async () => {
        if (!packageValue.tests.passed) throw new Error('Deterministic package tests failed.');
        if (!packageValue.teachingPlan.checkpoints.length) throw new Error('Teaching plan has no grounded checkpoints.');
        const answer = await callOptionalAgent(
          'critic',
          'Review the validated package test report, semantic roles, and real teaching checkpoints. Report only concrete mismatches.',
          JSON.stringify({ design, tests: packageValue.tests, visualization: packageValue.visualization, checkpoints: packageValue.checkpoints, finalStep: packageValue.steps.at(-1) }),
          JSON.stringify({ passed: true, issues: [], summary: 'Deterministic package tests passed.' }),
          critiqueSchema,
          320,
        );
        const parsed = safeJsonObject(answer.text);
        if (answer.source === 'model' && !parsed) {
          throw new Error(options.locale === 'tr'
            ? 'Kritik ajanı çözümlenemeyen bir cevap döndürdü; paket onaylanmadı.'
            : 'Critic returned an unreadable answer; the package was not approved.');
        }
        if (parsed?.passed === false) {
```

```
> Select-String -Path src\services\titanEngine.ts -Pattern 'Deterministic package tests failed|Teaching plan has no grounded checkpoints'

src\services\titanEngine.ts:1549:        if (!packageValue.tests.passed) throw new Error('Deterministic package tests failed.');
src\services\titanEngine.ts:1550:        if (!packageValue.teachingPlan.checkpoints.length) throw new Error('Teaching plan has no grounded checkpoints.');
```

Both throws are byte-identical to `05e3307`, both are still the first two statements of the
critic job body, and both still run before `callOptionalAgent('critic', ...)` at `:1552`.

### `Select-String -Pattern 'Math\.random'` — head

```
src\components\AiAssistant.tsx:1173:      ? (['lcs', 'edit', 'knapsack'] as const)[Math.floor(Math.random() * 3)]
src\components\AiAssistant.tsx:1176:      ? Math.floor(Date.now() + Math.random() * 1_000_000)
src\services\trace\interpreter.ts:163:    math.random = native('Math.random', () => this.nextRandom());
src\services\trace\jsTracer.test.ts:114:    const source = `function solve() { return [Math.random(), Math.random()]; }
`;
src\services\algorithmCatalog.ts:90:  return filtered[Math.floor(Math.random() * filtered.length)];
src\services\titanEngine.ts:105:  `gm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
src\services\titanEntry.ts:67:  const runId = `gm-catalog-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
src\services\webProblemOrchestrator.ts:196:    runId: `web-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
```

### `Select-String -Pattern 'new Function|eval\('` — head

```
src\services\trace\jsTracer.test.ts:136:    ['eval("1 + 1")', 'Dynamic code execution'],
src\services\trace\jsTracer.test.ts:137:    ['new Function("return 1")', 'Function constructor'],
src\services\trace\traceIntelligence.test.ts:51:    expect(() => queryTrace(trace, 'eval(i)')).toThrow('Unsupported trace query');
```

**No new match in either.** 8 and 3 matches, the same counts and the same files as
`05e3307`; `titanEngine.ts:105` moved from `:104` only because of the import line this turn
added. Proven independently of counting:

```
> git diff "05e3307..HEAD" -U0 -- src | Select-String -Pattern '^\+' | Select-String -Pattern 'Math\.random|new Function|eval\(' | Measure-Object | Select-Object -ExpandProperty Count

0
```

No added line in the whole turn contains any of the three patterns.

### `npm run lint` — exit 0

```
> codexray@2.3.4 lint
> oxlint

```

### `npm run test` — exit 0

```
> codexray@2.3.4 test
> vitest run


 RUN  v4.1.10 C:/Users/Administrator/Desktop/Projeler/CodeXray


 Test Files  119 passed (119)
      Tests  850 passed (850)
   Start at  21:55:59
   Duration  21.07s (transform 9.16s, setup 25.53s, import 22.11s, tests 44.67s, environment 174.91s)
```

Test count **before** the turn, measured by stashing the seven source files and re-running:

```
 Test Files  119 passed (119)
      Tests  846 passed (846)
   Start at  21:46:05
   Duration  21.32s (transform 9.52s, setup 33.46s, import 17.38s, tests 44.16s, environment 183.02s)
```

846 → 850. **+4 tests:** three in `titanEngine.test.ts` (probes A, B, C) and one in
`TitanProgress.test.tsx` (the rendered marker in both locales). File count unchanged; no new
suite file was created.

### `npm run build` — exit 0

```
dist/assets/index-DRKq6RiW.js                        427.17 kB │ gzip: 131.73 kB

✓ built in 475ms
Initial JavaScript: 417.2 / 420.0 KiB
Lazy JavaScript: 33 chunks, each <= 100.0 KiB
Tracer worker: 141.0 / 150.0 KiB
Local AI worker: 5930.8 / 6500.0 KiB
Styles: 91.3 / 100.0 KiB
```

### `npm run desktop:check` — not run

`src-tauri/**` did not change; `git diff --name-only "05e3307..HEAD"` above lists no path
under it. `AGENTS.md` requires the gate only when that tree changed.

### `npm run test:e2e` with external server — exit 0, both phases

```
Running 74 tests using 8 workers

  74 passed (1.0m)
```

```
Running 2 tests using 1 worker

  2 passed (34.4s)
```

The per-test `ok` lines are the runner's default reporter output and are not reproduced here;
the run summaries above are the verbatim result lines. Baseline for comparison, measured by
stashing the seven source files at `05e3307`: `74 passed (1.1m)` and `2 passed (34.8s)`.

Cleanup: only this run's listener was stopped — `Get-NetTCPConnection -LocalPort 4173 -State
Listen` returned `OwningProcess 43096`, that PID and the `npm.cmd` handle `9184` this run
created were stopped, and `Test-NetConnection 127.0.0.1 -Port 4173` then returned `False`.
No process was killed by name and no port was swept.

**Two earlier full-suite runs failed and are reported here rather than discarded.** See
`## Deviations`.

## Acceptance

Criteria copied verbatim from the route; evidence follows each.

> 1. `callOptionalAgent` returns a value from which the caller can distinguish a model answer
>    from a fallback. Every call site is updated; none discards the discriminant silently.

**Met.** `titanEngine.ts:771-791` returns `AgentAnswerV1`. The grep delta above shows 16 call
sites before and after, all converted. "None discards the discriminant silently" is enforced
by the compiler, not by review: the return is no longer assignable to `string`, so the
`tsc -b` step of `npm run build` (exit 0, pasted above) fails on any site still treating it
as one.

> 2. A deterministic-template run with no `agentRunner` marks every advisory job as
>    deterministic, and the marker reaches `job.provenance` (or the chosen equivalent) on the
>    published plan. A unit test asserts it for `jump-game-dp`.

**Met.** `src/services/titanEngine.test.ts` — `marks every advisory job deterministic when no
agent runs (probe A)` runs `create-algorithm: jump-game-dp` with no `agentRunner` and asserts
`published.jobs.map((job) => job.provenance)` is all `'deterministic'`. Production:
`titanEngine.ts:681-686` (`runJob`'s completion floor) and `titanEngine.ts:1136`.

> 3. A model-authored run whose `critic` call rejects records the critic job as
>    fallback-sourced. A unit test reproduces probe B and asserts the marker.

**Met.** `src/services/titanEngine.test.ts` — `records a rejected critic call as a
fallback-sourced job (probe B)`: `model-authored`, `critic` promise rejects with
`model exploded`, run succeeds, critic job `completed`, `provenance === 'deterministic'`,
summary `Deterministic package tests passed.` Production: `titanEngine.ts:1574`.

> 4. (Option A or C) A model-authored run whose `critic` returns unparseable text does **not**
>    succeed. A unit test reproduces probe C and asserts the run fails with a message naming
>    the critic. If Option B is taken, this criterion is instead met by stating in
>    `## Deviations` that C remains open and why.

**Met** under Option A. `src/services/titanEngine.test.ts` — `fails the run when a model
critic answers unintelligibly (probe C)` returns the route's exact string
`The package looks WRONG, the trace disagrees with the visual.` and asserts
`rejects.toThrow(/Critic returned an unreadable answer/)` plus the critic job `failed`.
The message names the critic in both locales. Production: `titanEngine.ts:1560-1564`.

> 5. The marker is rendered in `TitanModeProgress` in EN and TR, using an existing class or
>    token. A component test asserts both locales.

**Met.** `src/components/TitanProgress.test.tsx` — `marks each agent row with the provenance
of its answer in both locales` asserts the EN and TR strings on two jobs with opposite
provenance. Production: `TitanModeProgress.tsx:278-283`. Class `agent-provenance` was added to
the existing `.agent-duration` declaration block (`AiAssistant.css:981-982`); no color, size,
or spacing value was introduced. `TitanProgress.tsx` is a re-export alias of
`TitanModeProgress`, so the test exercises the shipped component.

> 6. The two deterministic gates at `titanEngine.ts:1505-1506` are unchanged and still run
>    before the critic. Show the lines.

**Met.** Shown verbatim above; now at `titanEngine.ts:1549-1550`, byte-identical, still the
first two statements of the critic job body and still above `callOptionalAgent('critic', ...)`
at `:1552`. The route's fixed `-Skip 1500` window no longer reaches them — recorded in
`## Deviations`, not worked around.

> 7. `npm run lint`, `npm run test`, `npm run build` pass. `npm run desktop:check` if
>    `src-tauri/**` changed.

**Met.** All three exit 0, output pasted above (`850 passed`, `built in 475ms`).
`desktop:check` not required — `src-tauri/**` is absent from `git diff --name-only`.

> 8. e2e passes. No new e2e spec is required by this route; if one is added, justify it.

**Met.** `74 passed (1.0m)` + `2 passed (34.4s)`, pasted above. No e2e spec was added. Two
earlier full runs failed on load-dependent timeouts and are reported in `## Deviations`
rather than discarded.

> 9. (T0) The handoff states, in its own words, that this route does not close a commit-path
>    hole and says which paths the critic change actually affects.

**Met.** `## What this turn does not close`, below.

> 10. No frozen or T0-owned path is written. `git diff --name-only 05e3307..HEAD` proves it.

**Met.** Eight paths: the route file (written by T0 as `route(R21): open`, inside the range
only because it starts at that commit's parent) and seven under `src/**`. The filter in
`## Untouched` returns nothing.

> 11. Every commit is DCO-signed as `Mustafa Özel <iyott131@gmail.com>`; confirm
>     `git config user.email` before the first commit.

**Met.** `git config user.email` returned `iyott131@gmail.com` before the first commit
(pasted above); both commits carry `Signed-off-by: Mustafa Özel <iyott131@gmail.com>`.

## What this turn does not close` below.
10. **Met.** `git diff --name-only "05e3307..HEAD"` lists eight paths: the route file (T0's,
    written by T0 before this turn, present only because the range starts at its parent) and
    seven files under `src/**`, all Sole-owned. No `.claude/**`, no `.agents/AGENTS.md`, no
    `docs/tasks/**`, no `docs/legacy/**`, no `CodeXray-readme-neon.svg`, no
    `docs/TITAN_MODE_YOL_HARITASI.md`, no `AGENTS.md`, and no
    `src/services/titan/titanPipeline.ts`. See `## Untouched`.
11. **Met.** `git config user.email` returned `iyott131@gmail.com` before the first commit
    (pasted above), and both commits carry
    `Signed-off-by: Mustafa Özel <iyott131@gmail.com>`.

## What this turn does not close

**This route does not close a commit-path hole, and nothing here should be read as one.**
R18's `verifyModelAuthoredArtifact` recompiles a model-authored package from the artifact's
own program outside the engine and rejects a mismatch; that gate was the reason the
`model-authored` commit path was safe before this turn, and it is unchanged by it. A critic
that failed open never let a malformed artifact through the pipeline, and a critic that now
fails closed does not make the pipeline safer. What changed is the **record**: the run log no
longer presents an engine literal as an agent's sentence, and a critic's refusal is no longer
filed as a pass.

**Which paths the critic change actually affects.** The new throw lives in the single
`critic-test-visual-and-trace-alignment` job of the general creation branch — the branch
reached when the template is neither `predict-winner-interval-dp`, nor one of the four array
templates, nor one of the seven DP templates. Concretely that is:

- `bidirectional-bfs`, `lcs-space-optimized-1d-dp`'s siblings excluded, and every other
  `create-algorithm` template that falls through to the general branch — **not** pipelined,
  so this is now the only external-looking refusal they have;
- `model-authored` — pipelined since R18, so the throw is redundant there for safety and
  material only for the record;
- the bound web-solve default, which since R20 is `model-authored`.

The other three families have their own critic jobs (`titanEngine.ts:1085` region for
interval-DP, `:1160` region for array templates, `:1250` region for DP templates); those are
purely deterministic assertions with no model call at all, and this turn did not touch their
logic. `adapt-input` and `discuss-current-step` have no critic job.

**The behaviour change, stated with the retry count around it.** There is **no retry** around
the critic. The general branch retries the architect once on truncation
(`titanEngine.ts:1341-1359`) and the SimLang code-author once on invalid output
(`titanEngine.ts:1400-1451`); the critic job's `maxAttempts` is not consulted by `runJob`,
which throws on the first failure and marks the job `failed`. So a weak local model that
answers the critic prompt in prose turns a previously-silent success into a visible failed
run with a retry button, on the first occurrence. That is the intended direction — the
alternative is filing that model's confusion as approval — but it is a real user-visible
regression risk for `bidirectional-bfs` and its siblings on weak models, and T0 should decide
whether a bounded critic retry belongs in a later route.

## Diff scope

```
 .../routes/R21-a-fallback-is-not-a-verdict.md      | 229 +++++++++++++++++++++
 src/components/AiAssistant.css                     |   3 +-
 src/components/TitanModeProgress.tsx               |  15 +-
 src/components/TitanProgress.test.tsx              |  16 ++
 src/i18n/translations.ts                           |   4 +
 src/services/titanEngine.test.ts                   |  67 ++++++
 src/services/titanEngine.ts                        | 173 +++++++++++-----
 src/types/titan.ts                                 |   4 +
 8 files changed, 451 insertions(+), 60 deletions(-)
```

Compared against `## Expected Files`: all six forecast files were written. One file outside
the forecast — `src/components/AiAssistant.css` — see `## Deviations`.

## Deviations

1. **`src/components/AiAssistant.css` was written and is not in `## Expected Files`.**
   Required by criterion 5. The forecast named `TitanModeProgress.tsx` for "rendering it" but
   the row's styling lives in `AiAssistant.css`, where `.agent-role`, `.agent-summary`,
   `.agent-duration`, and `.agent-context-usage` are defined. The whole change is adding
   `.agent-provenance` as a second selector on the existing `.agent-duration` rule:

   ```css
   .agent-duration,
   .agent-provenance {
     flex: 0 0 auto;
     color: var(--neon-lime);
     font-size: 0.5rem;
     font-variant-numeric: tabular-nums;
     white-space: nowrap;
   }
   ```

   No declaration was added or changed, so the invariant against inventing colors and
   measurements holds by construction: the marker renders with values that already existed.
   Rendering the marker under the literal class name `agent-duration` would have avoided the
   file entirely and was rejected — a span named for a duration carrying provenance text is
   worse than a one-line selector addition.

2. **The route's seventh verification command no longer shows what criterion 6 asks for.**
   `Select-Object -Skip 1500 -First 40` was written against `05e3307` where the gates sat at
   `1505-1506`. The turn inserted 45 lines above them, so the fixed window now covers
   `1501-1540` and the gates are at `1549-1550`. The command was run verbatim and its output
   is pasted; the gates are additionally shown by `-Skip 1544 -First 32` and by a
   `Select-String` on both throw messages. The route was not edited.

3. **Two full-suite e2e runs failed before the green one, and both failures were timeouts
   under parallel load, not assertion failures.** Run 1: `titan-mode.spec.ts:22` "shows the
   five-stage pipeline and a grounded current-step answer" timed out at 15s waiting for
   `getByText('Apply', { exact: true })`; 73 passed. Run 2: `ai-actions.spec.ts:112` "builds
   and applies bidirectional BFS through the visible Titan Mode queue" timed out; 73 passed.
   Each spec then passed in isolation — 3.6s and 10.3s respectively, well inside the 15s
   timeout — and the third full run passed all 74 with no code change between run 2 and run
   3. The base was also measured: `05e3307` with the same command gives `74 passed (1.1m)` +
   `2 passed (34.8s)`, so the suite is green on both sides and the two failures were
   environmental. **This is worth T0's attention rather than being closed as flake:** the
   turn does add work to the render path — `adopt` publishes a plan update at four sites and
   the final tutor at one, each triggering an extra React render of the progress list — and
   while the surviving evidence is a full green run, a suite that intermittently misses a
   15s budget under 8 workers has less headroom than it did. The stray earlier dev server
   from the first attempt was also competing for the machine during runs 1 and 2.

4. **`AgentRunEventV1.provenance` was added but has no dedicated writer.** The field exists
   because the route's `## Expected Files` named it and because `setJob` emits
   `options.onEvent?.({ ...target })` — spreading the job, so the event now carries
   provenance automatically. No call site constructs an `AgentRunEventV1` by hand, so there
   is nothing further to wire, and no test asserts the field on an event because no
   production consumer reads it. Stated rather than left implied.

5. **Three advisory sites deliberately do not use `provenanceOf` unconditionally.** The
   predict-winner architect, the custom architect, and the final tutor label a row `model`
   only when the model's content was actually adopted; a model answer that arrived and was
   then discarded leaves the row `deterministic`, because the sentence the user reads on
   that row is the engine's. This is stricter than the route's wording ("marks the row") and
   is the honest reading of what provenance claims.

## Discovered

- **`.agent-summary` is `display: none` in the agent row** (`AiAssistant.css:964-966`,
  overriding the ellipsis rule at `:958-962`). The route's measurement says the
  row "renders `job.summary` as the row's text and its tooltip"; in the shipped CSS the
  summary span is present in the DOM with a `title` attribute but hidden, so the sentence
  reaches the user through the hover/focus tooltip (`jobDetails`) and the accessible name,
  not as visible row text. This does not weaken the route's finding — a tooltip attributing
  an engine literal to "Code Author" is the same misattribution — but it does mean the
  visible marker added this turn is the **only** always-visible provenance signal, which is
  why it was also appended to `jobDetails` so the tooltip carries it too.
- **`useAdvisoryModel` is true for `discuss-current-step` and `model-authored` even with no
  `agentRunner`**, because it falls back to `runLocalAgent`. So probe A's "no agent ran"
  condition is specific to the deterministic template branches; on `discuss-current-step`
  with no model loaded the call reaches `runLocalAgent`, throws, and is caught — which now
  correctly records `deterministic` rather than looking like an answer.
- **The engine's own `runId` uses `Math.random`** (`titanEngine.ts:105`), pre-existing and
  untouched. It is an identifier, not simulation or trace state, but it is the one
  `Math.random` inside `titanEngine.ts` and a future route asserting determinism over this
  file should expect it.

## Untouched

```
> git diff --name-only "05e3307..HEAD" | Select-String -Pattern '^\.claude/|^\.agents/|^docs/tasks/|^docs/legacy/|^CodeXray-readme-neon\.svg$|^docs/TITAN_MODE_YOL_HARITASI\.md$|^AGENTS\.md$|^CLAUDE\.md$|^docs/titan/PROTOCOL\.md$|titanPipeline\.ts$'

(no output)
```

Nothing in the turn's range matches any frozen path, any T0-owned path, or the route's
out-of-scope `src/services/titan/titanPipeline.ts`. The only `docs/titan/routes/**` entry in
the range is R21 itself, committed by T0 as `route(R21): open` before the turn began; this
turn did not modify it.

## Blockers

None.

## For the human

1. A bounded retry around the critic is now a live product question: on a weak local model,
   an unparseable critic answer fails the run outright for `bidirectional-bfs` and its
   sibling non-pipelined templates, where previously it passed silently. The turn chose the
   fail-closed direction the route specified; whether one retry should soften it is T0's
   call, recorded in `## What this turn does not close`.
2. Nothing was pushed. The remote is T0's.
