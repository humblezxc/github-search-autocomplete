import { act, renderHook, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { DEBOUNCE_MS } from '../config';
import { reposResponse, usersResponse } from '../test/builders';
import { server } from '../test/server';
import { useDebouncedValue } from './useDebouncedValue';
import { useGithubSearch } from './useGithubSearch';

const USERS_URL = 'https://api.github.com/search/users';
const REPOS_URL = 'https://api.github.com/search/repositories';

describe('useGithubSearch', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays idle and sends no requests below three trimmed characters', async () => {
    let requestCount = 0;
    server.use(
      http.get(USERS_URL, () => {
        requestCount += 1;
        return HttpResponse.json(usersResponse([]));
      }),
      http.get(REPOS_URL, () => {
        requestCount += 1;
        return HttpResponse.json(reposResponse([]));
      }),
    );

    const { result, rerender } = renderHook(
      ({ query }) => useGithubSearch(query),
      { initialProps: { query: '' } },
    );

    expect(result.current).toEqual({ phase: 'idle' });

    rerender({ query: 'ab' });
    rerender({ query: '  ab ' });
    await act(async () => {});

    expect(result.current).toEqual({ phase: 'idle' });
    expect(requestCount).toBe(0);
  });

  it('searches the trimmed query and combines both sources', async () => {
    const queries: string[] = [];
    server.use(
      http.get(USERS_URL, ({ request }) => {
        queries.push(new URL(request.url).searchParams.get('q') ?? '');
        return HttpResponse.json(usersResponse(['brave']));
      }),
      http.get(REPOS_URL, ({ request }) => {
        queries.push(new URL(request.url).searchParams.get('q') ?? '');
        return HttpResponse.json(reposResponse(['awesome']));
      }),
    );

    const { result } = renderHook(() => useGithubSearch('  rea '));

    expect(result.current).toEqual({ phase: 'loading' });

    await waitFor(() => expect(result.current.phase).toBe('success'));

    expect(result.current).toMatchObject({
      items: [{ name: 'awesome' }, { name: 'brave' }],
    });
    expect([...queries].sort()).toEqual(['rea in:login', 'rea in:name']);
  });

  it('ignores a superseded slow response and keeps the successor result', async () => {
    let releaseFirst = () => {};
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    server.use(
      http.get(USERS_URL, async ({ request }) => {
        const q = new URL(request.url).searchParams.get('q');
        if (q === 'rea in:login') {
          await firstBlocked;
          return HttpResponse.json(usersResponse(['stale-user']));
        }
        return HttpResponse.json(usersResponse(['fresh-user']));
      }),
      http.get(REPOS_URL, () => HttpResponse.json(reposResponse([]))),
    );

    const { result, rerender } = renderHook(
      ({ query }) => useGithubSearch(query),
      { initialProps: { query: 'rea' } },
    );
    rerender({ query: 'reac' });

    await waitFor(() => expect(result.current.phase).toBe('success'));
    releaseFirst();
    await act(async () => {});

    expect(result.current).toMatchObject({ items: [{ name: 'fresh-user' }] });
    expect(fetchSpy.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it('aborts the in-flight request and resets to idle when the query drops below the threshold', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    server.use(
      http.get(USERS_URL, async () => {
        await delay('infinite');
        return HttpResponse.json(usersResponse(['never']));
      }),
      http.get(REPOS_URL, async () => {
        await delay('infinite');
        return HttpResponse.json(reposResponse([]));
      }),
    );

    const { result, rerender } = renderHook(
      ({ query }) => useGithubSearch(query),
      { initialProps: { query: 'react' } },
    );

    expect(result.current).toEqual({ phase: 'loading' });

    rerender({ query: 're' });

    expect(result.current).toEqual({ phase: 'idle' });
    await act(async () => {});
    expect(result.current).toEqual({ phase: 'idle' });
    expect(fetchSpy.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it('replaces previous results with loading while a new search runs', async () => {
    let blockRequests = false;
    server.use(
      http.get(USERS_URL, async () => {
        if (blockRequests) {
          await delay('infinite');
        }
        return HttpResponse.json(usersResponse(['octocat']));
      }),
      http.get(REPOS_URL, async () => {
        if (blockRequests) {
          await delay('infinite');
        }
        return HttpResponse.json(reposResponse([]));
      }),
    );

    const { result, rerender } = renderHook(
      ({ query }) => useGithubSearch(query),
      { initialProps: { query: 'octo' } },
    );

    await waitFor(() => expect(result.current.phase).toBe('success'));

    blockRequests = true;
    rerender({ query: 'octop' });

    expect(result.current).toEqual({ phase: 'loading' });
  });

  it('surfaces a typed error when the request pair fails', async () => {
    server.use(
      http.get(USERS_URL, () => new HttpResponse(null, { status: 500 })),
      http.get(REPOS_URL, () => HttpResponse.json(reposResponse([]))),
    );

    const { result } = renderHook(() => useGithubSearch('react'));

    await waitFor(() => expect(result.current.phase).toBe('error'));

    expect(result.current).toMatchObject({
      error: { kind: 'http', status: 500 },
    });
  });

  it('sends exactly one request pair after rapid typing followed by a pause', async () => {
    let userRequests = 0;
    let repoRequests = 0;
    server.use(
      http.get(USERS_URL, () => {
        userRequests += 1;
        return HttpResponse.json(usersResponse(['octocat']));
      }),
      http.get(REPOS_URL, () => {
        repoRequests += 1;
        return HttpResponse.json(reposResponse(['octoverse']));
      }),
    );

    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ query }) => useGithubSearch(useDebouncedValue(query, DEBOUNCE_MS)),
      { initialProps: { query: '' } },
    );

    rerender({ query: 'r' });
    rerender({ query: 're' });
    rerender({ query: 'rea' });
    rerender({ query: 'reac' });
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });
    vi.useRealTimers();

    await waitFor(() => expect(result.current.phase).toBe('success'));

    expect(userRequests).toBe(1);
    expect(repoRequests).toBe(1);
  });
});
