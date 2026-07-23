# GitHub search autocomplete

A reusable, self-contained autocomplete over the GitHub REST search API: one
input, one combined list of matching **users and repositories**, ordered
alphabetically. React 19 + TypeScript (strict), and no runtime dependencies
beyond React itself — no autocomplete, data-fetching, or utility libraries.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173 and type at least three characters.

| Script                 | What it does                                    |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | Vite dev server                                 |
| `npm test`             | one-shot suite (Vitest + Testing Library + MSW) |
| `npm run test:watch`   | tests in watch mode                             |
| `npm run lint`         | oxlint                                          |
| `npm run format:check` | Prettier check (CI enforces it)                 |
| `npm run build`        | type-check and production build                 |

## Optional: GitHub token

Unauthenticated GitHub **search** allows 10 requests per minute per IP, and
every settled keystroke costs two (users + repositories) — roughly 5 searches
a minute before the component starts reporting the rate limit with its reset
time. To raise the quota to 30/minute locally, copy `.env.example` to
`.env.local` and set:

```
VITE_GITHUB_TOKEN=github_pat_...
```

A fine-grained token with no scopes is enough. **Security note:** any token
compiled into a browser bundle is public by definition. This is a local-demo
convenience only — a real application must keep the credential behind a
backend proxy. `.env.local` is gitignored.

## Behavior and assumptions

The task statement leaves several points open; this is how the implementation
reads them, and why.

- **Threshold** — no request until the input holds ≥ 3 characters after
  trimming; dropping below closes the list and aborts in-flight work.
- **Debounce** — 300 ms after the last keystroke; superseded requests are
  aborted. With a 10/minute budget, cancelled keystrokes are real savings.
- **"Limited to 50 per request"** — read as both possible meanings at once:
  each HTTP request asks for `per_page=50`, and the displayed list never
  exceeds 50. Display slots are filled by per-source relevance rank with a
  25-slot floor per source; only surplus share moves (7 users + many repos →
  7 + 43). Membership is decided by relevance, the alphabet only decides
  position, and the list always fills to `min(50, users + repos)`.
- **Ordering keys** — repository `name` and user `login`, compared with
  `localeCompare('en', { sensitivity: 'base' })` (case- and
  accent-insensitive, deterministic across machines), ties broken by
  name → kind → id. The sort key is also the visible primary label, so the
  ordering can be verified by eye. The search API does not return profile
  display names without one extra request per user, so `login` is the
  profile name available within budget.
- **Field scoping** — queries are scoped `in:login` / `in:name`, so every row
  visibly matches on the field that is displayed and sorted. Trade-off below.
- **Combined means atomic** — if either endpoint fails, the search shows an
  error. Showing only users while repositories failed would misleadingly
  suggest "no such repository exists".
- **Loading replaces results** — while a new search runs, the old list gives
  way to the loading indicator; stale-while-revalidate is the documented
  at-scale upgrade, not something to hand-roll here.
- **Keyboard** — ArrowDown/ArrowUp move the highlight and clamp at the ends
  (no wrap); Enter opens the highlighted item in a new tab with
  `noopener,noreferrer`; Enter with no highlight does nothing; Escape closes;
  clicking an option behaves like Enter. DOM focus never leaves the input
  (`aria-activedescendant` combobox pattern), and state changes are announced
  through a polite live region.

## Trade-offs and known limitations

- **Alphabetical ordering over a relevance-capped set is inherently
  approximate.** For a query with 800 matching repositories, fetching all of
  them is impossible within the rate budget (16 pages against 10 requests a
  minute); every feasible strategy alphabetizes some relevance-capped subset.
  This implementation keeps the cut by relevance and uses the alphabet for
  position only.
- **Scoping costs recall.** `in:login`/`in:name` drops users matched only via
  display name and repositories matched only via description. An autocomplete
  is a name-finder; discovery belongs to a full search page. Removing the
  qualifier suffix in `src/api/githubSearch.ts` restores GitHub's broader
  default matching.
- **GitHub search is token-based, not a prefix engine.** Short fragments can
  under-match what a purpose-built typeahead service would return, and
  `incomplete_results` may drop matches under server-side time limits (the
  field is deliberately ignored).
- **No caching or request dedup** — the same query typed twice fetches twice.
  At product scale the answer is TanStack Query, not a hand-rolled cache.
- **Dropdown positioning** is `position: absolute` inside the component —
  fine on a normal page, clipped inside `overflow: hidden` ancestors, where
  the answer would be a portal.
- **MSW fixtures can drift** from the live API; they were captured from real
  responses, and a scheduled out-of-band contract test would guard the shape
  at scale.

## Architecture

```
src/
  config.ts                        constants fixed by the task (3 chars, 300 ms, 50/25)
  api/                             framework-free client: scoped queries, typed errors
  lib/combineResults.ts            pure slot allocation + merge + sort
  hooks/useDebouncedValue.ts       generic value debouncer
  hooks/useGithubSearch.ts         state machine + AbortController lifecycle
  components/GithubAutocomplete/   combobox view (UI state only)
```

Data state is a discriminated union (`idle | loading | success | error`), so
contradictory flag combinations are unrepresentable. Every query change
aborts the previous request pair, and both promise settlement paths check
`signal.aborted` — a stale response can never overwrite a newer one, even if
it settles successfully after the abort. UI state (open/highlight) lives in
the component, separate from data state, so closing the popup never refetches
and fresh data never reopens a dismissed popup.

## Testing

Mocking sits at the network boundary (MSW): URL construction, query encoding,
headers, and status handling are all asserted as observable behavior, and
`onUnhandledRequest: 'error'` makes it impossible for the suite to touch the
real API. The rule is one test per behavior that could plausibly regress:
allocation invariants, collation, the debounce boundary, the
out-of-order-response race, abort on supersede, every error mapping including
both rate-limit statuses, combobox keyboard semantics, and the exact
`window.open` arguments. Deliberately untested: end-to-end against the live
API (flaky by construction under a shared 10/minute limit), visual
appearance, and `scrollIntoView` (jsdom implements no layout; verified
manually).

## Component API

```tsx
import { GithubAutocomplete } from './components/GithubAutocomplete/GithubAutocomplete';

<GithubAutocomplete />
<GithubAutocomplete placeholder="Find a repo or user" className="my-width-cap" />
```

Self-contained: no provider, no global state, and instance-safe ids — two
instances on one page do not collide. The numbers fixed by the task (3
characters, 300 ms, 50 items) are constants in `src/config.ts` rather than
props: configurability nobody asked for is scope creep, and they would become
options only if this were extracted into a library.
