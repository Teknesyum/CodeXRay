# Catalog Content Integration Audit

Last updated: 2026-08-02

## Scope and result

CodeXRay contains 22,027 unique catalog records:

| Source | Records | Canonical URL coverage | Detail strategy |
| --- | ---: | ---: | --- |
| LeetCode | 3,236 | 100% | Structured first-party reader segments |
| CSES | 388 | 100% | Cleaned generic HTML, section-derived fields |
| Codeforces | 10,544 | 100% | Cleaned generic HTML, section-derived fields |
| AtCoder | 7,859 | 100% | Canonical links available; upstream currently returns HTTP 403 to the reader |

All 22,027 `source:id` keys are unique and every record has a title, slug,
category, tag array, and a deterministic HTTPS source URL. This is enforced by
`catalogProblemDetails.catalog.test.ts` against the complete source catalog.

Problem statements are not copied into the JavaScript bundle or bulk-scraped
into the repository. Selecting a record loads only that problem through the
first-party `/api/codexray/read-url` gateway. The cleaned artifact is schema
validated, bounded, and cached in memory by `source:id`.

The catalog drawer is an internal development surface. Production builds omit
its trigger and its lazy JavaScript/CSS chunks; it is available only in a Vite
development build on a loopback hostname. This is visibility isolation, not a
replacement for authenticated per-user authorization.

## Integrated detail fields

The detail panel can display these source-grounded fields:

- problem statement;
- callable signature when the source exposes one;
- input format;
- output format;
- examples with input, output, and explanation;
- constraints;
- notes;
- canonical source link;
- catalog platform, ID, difficulty, categories, and tags;
- exact-simulation verification status.

Generic CSES and Codeforces pages are sectionized deterministically. Navigation,
contest metadata, and known footer content are excluded from the problem
statement. Constraints embedded in input-format parentheses are retained when
the source has no standalone constraints section. Missing example values are
never invented.

## God Mode binding

- Green-check records use the registered exact `source:id` simulation package.
- The registry currently contains 32 exact LeetCode contracts. LeetCode 55 and
  300 additionally expose verified on-demand optimization paths (DP to greedy,
  and quadratic DP to O(n log n) binary search respectively).
- Other records submit their canonical source URL to the validated web-problem
  pipeline.
- Reader, schema, compiler, sample, visual, or critic failure leaves the
  workspace unchanged; the UI must not claim a simulation succeeded.

## Live source checks

The localhost gateway was exercised against representative official pages:

- LeetCode 1 returned statement, three examples, constraints, and Java
  signature.
- CSES 1068 returned statement, input/output formats, and constraints. The
  upstream cleaned page did not expose every `<pre>` sample value, so CodeXRay
  leaves missing values blank rather than inferring them.
- Codeforces 1A returned statement, input/output formats, and a constraint
  derived from the input section. The source did not expose the sample output
  value in the cleaned artifact.
- AtCoder ABC086 A returned HTTP 403 from the upstream site. The catalog still
  exposes the correct official URL and a retryable detail UI, but full AtCoder
  statement integration is blocked until the first-party reader gains a lawful,
  stable AtCoder ingestion path.

## Acceptance evidence

- Complete 22,027-record canonical-address audit.
- Unit coverage for source URL generation, detail cache, empty-content
  rejection, generic section extraction, Codeforces chrome removal, source
  failure UI, platform switching, filtering, selection, and God Mode dispatch.
- Math fidelity coverage includes literal, braced, Codeforces triple-dollar,
  and escaped-inline forms of `10^4`, plus flattened `10 9` recovery.
- Interactive browser verification for LeetCode, CSES, Codeforces, and AtCoder
  failure behavior.

This document distinguishes catalog addressability from content availability.
It must not be changed to claim 100% statement availability while AtCoder or
another upstream source is blocked.
