import { delay, http, HttpResponse } from 'msw';
import {
  repoSearchResponse,
  userSearchResponse,
} from '../test/fixtures/github';
import { server } from '../test/server';
import {
  GithubSearchError,
  searchAll,
  searchRepositories,
  searchUsers,
} from './githubSearch';

const USERS_URL = 'https://api.github.com/search/users';
const REPOS_URL = 'https://api.github.com/search/repositories';

describe('searchUsers', () => {
  it('requests the users endpoint with a login-scoped query and per_page 50', async () => {
    const requests: Request[] = [];
    server.use(
      http.get(USERS_URL, ({ request }) => {
        requests.push(request);
        return HttpResponse.json(userSearchResponse);
      }),
    );

    await searchUsers('octocat');

    expect(requests).toHaveLength(1);
    const url = new URL(requests[0]?.url ?? '');
    expect(url.searchParams.get('q')).toBe('octocat in:login');
    expect(url.searchParams.get('per_page')).toBe('50');
    expect(requests[0]?.headers.get('accept')).toBe(
      'application/vnd.github+json',
    );
    expect(requests[0]?.headers.get('x-github-api-version')).toBe('2022-11-28');
  });

  it('maps 403 with an exhausted rate limit to a rate-limit error with reset time', async () => {
    server.use(
      http.get(
        USERS_URL,
        () =>
          new HttpResponse(null, {
            status: 403,
            headers: {
              'x-ratelimit-remaining': '0',
              'x-ratelimit-reset': '1784829855',
            },
          }),
      ),
    );

    const promise = searchUsers('octocat');

    await expect(promise).rejects.toBeInstanceOf(GithubSearchError);
    await expect(promise).rejects.toMatchObject({
      info: { kind: 'rate-limit', resetAt: new Date(1784829855000) },
    });
  });

  it('maps an exhausted rate limit without a reset header to a null reset time', async () => {
    server.use(
      http.get(
        USERS_URL,
        () =>
          new HttpResponse(null, {
            status: 429,
            headers: { 'x-ratelimit-remaining': '0' },
          }),
      ),
    );

    await expect(searchUsers('octocat')).rejects.toMatchObject({
      info: { kind: 'rate-limit', resetAt: null },
    });
  });

  it('maps 403 without an exhausted rate limit to an http error', async () => {
    server.use(
      http.get(
        USERS_URL,
        () =>
          new HttpResponse(null, {
            status: 403,
            headers: { 'x-ratelimit-remaining': '4999' },
          }),
      ),
    );

    await expect(searchUsers('octocat')).rejects.toMatchObject({
      info: { kind: 'http', status: 403 },
    });
  });

  it('maps other error statuses to an http error', async () => {
    server.use(
      http.get(USERS_URL, () => new HttpResponse(null, { status: 422 })),
    );

    await expect(searchUsers('octocat')).rejects.toMatchObject({
      info: { kind: 'http', status: 422 },
    });
  });

  it('maps a network failure to a network error', async () => {
    server.use(http.get(USERS_URL, () => HttpResponse.error()));

    const promise = searchUsers('octocat');

    await expect(promise).rejects.toBeInstanceOf(GithubSearchError);
    await expect(promise).rejects.toMatchObject({ info: { kind: 'network' } });
  });

  it('rethrows an abort untouched', async () => {
    server.use(
      http.get(USERS_URL, async () => {
        await delay('infinite');
        return HttpResponse.json(userSearchResponse);
      }),
    );
    const controller = new AbortController();

    const promise = searchUsers('octocat', controller.signal);
    controller.abort();

    await expect(promise).rejects.toHaveProperty('name', 'AbortError');
  });
});

describe('searchRepositories', () => {
  it('requests the repositories endpoint with a name-scoped query, encoding special characters', async () => {
    const requests: Request[] = [];
    server.use(
      http.get(REPOS_URL, ({ request }) => {
        requests.push(request);
        return HttpResponse.json(repoSearchResponse);
      }),
    );

    await searchRepositories('c++');

    const url = new URL(requests[0]?.url ?? '');
    expect(url.searchParams.get('q')).toBe('c++ in:name');
  });

  it('maps 429 with an exhausted rate limit to a rate-limit error', async () => {
    server.use(
      http.get(
        REPOS_URL,
        () =>
          new HttpResponse(null, {
            status: 429,
            headers: {
              'x-ratelimit-remaining': '0',
              'x-ratelimit-reset': '1784829856',
            },
          }),
      ),
    );

    await expect(searchRepositories('react')).rejects.toMatchObject({
      info: { kind: 'rate-limit', resetAt: new Date(1784829856000) },
    });
  });
});

describe('searchAll', () => {
  it('fetches both endpoints and maps payloads to search items', async () => {
    server.use(
      http.get(USERS_URL, () => HttpResponse.json(userSearchResponse)),
      http.get(REPOS_URL, () => HttpResponse.json(repoSearchResponse)),
    );

    const { users, repos } = await searchAll('foo');

    expect(users).toHaveLength(3);
    expect(repos).toHaveLength(3);
    expect(users[0]).toEqual({
      kind: 'user',
      id: 583231,
      name: 'octocat',
      url: 'https://github.com/octocat',
      avatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4',
    });
    expect(repos[1]).toEqual({
      kind: 'repo',
      id: 135786093,
      name: 'react',
      url: 'https://github.com/typescript-cheatsheets/react',
      avatarUrl: 'https://avatars.githubusercontent.com/u/50188264?v=4',
      ownerLogin: 'typescript-cheatsheets',
    });
  });

  it('rejects with the endpoint error when one of the pair fails', async () => {
    server.use(
      http.get(USERS_URL, () => HttpResponse.json(userSearchResponse)),
      http.get(REPOS_URL, () => new HttpResponse(null, { status: 500 })),
    );

    await expect(searchAll('foo')).rejects.toMatchObject({
      info: { kind: 'http', status: 500 },
    });
  });
});

describe('authentication', () => {
  it('sends no authorization header without a token', async () => {
    const requests: Request[] = [];
    server.use(
      http.get(USERS_URL, ({ request }) => {
        requests.push(request);
        return HttpResponse.json(userSearchResponse);
      }),
    );

    await searchUsers('octocat');

    expect(requests[0]?.headers.get('authorization')).toBeNull();
  });

  it('sends the bearer token when one is configured', async () => {
    vi.stubEnv('VITE_GITHUB_TOKEN', 'test-token');
    const requests: Request[] = [];
    server.use(
      http.get(USERS_URL, ({ request }) => {
        requests.push(request);
        return HttpResponse.json(userSearchResponse);
      }),
    );

    await searchUsers('octocat');

    expect(requests[0]?.headers.get('authorization')).toBe('Bearer test-token');
  });
});
