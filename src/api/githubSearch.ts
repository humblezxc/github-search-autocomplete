import { FETCH_PER_SOURCE } from '../config';
import type {
  GithubRepoItem,
  GithubSearchResponse,
  GithubUserItem,
  SearchError,
  SearchItem,
} from './types';

const API_BASE = 'https://api.github.com';

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const token = import.meta.env.VITE_GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export class GithubSearchError extends Error {
  readonly info: SearchError;

  constructor(info: SearchError) {
    super(`GitHub search failed: ${info.kind}`);
    this.name = 'GithubSearchError';
    this.info = info;
  }
}

function buildUrl(path: string, q: string): string {
  const params = new URLSearchParams({
    q,
    per_page: String(FETCH_PER_SOURCE),
  });
  return `${API_BASE}${path}?${params.toString()}`;
}

function toSearchError(response: Response): SearchError {
  const remaining = response.headers.get('x-ratelimit-remaining');
  const isRateLimited =
    (response.status === 403 || response.status === 429) && remaining === '0';
  if (isRateLimited) {
    const reset = response.headers.get('x-ratelimit-reset');
    const resetEpoch = reset ? Number(reset) : Number.NaN;
    return {
      kind: 'rate-limit',
      resetAt: Number.isFinite(resetEpoch) ? new Date(resetEpoch * 1000) : null,
    };
  }
  return { kind: 'http', status: response.status };
}

async function fetchSearch<TItem>(
  path: string,
  q: string,
  signal?: AbortSignal,
): Promise<TItem[]> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, q), {
      headers: buildHeaders(),
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    throw new GithubSearchError({ kind: 'network' });
  }
  if (!response.ok) {
    throw new GithubSearchError(toSearchError(response));
  }
  const data = (await response.json()) as GithubSearchResponse<TItem>;
  return data.items;
}

function mapUser(item: GithubUserItem): SearchItem {
  return {
    kind: 'user',
    id: item.id,
    name: item.login,
    url: item.html_url,
    avatarUrl: item.avatar_url,
  };
}

function mapRepo(item: GithubRepoItem): SearchItem {
  return {
    kind: 'repo',
    id: item.id,
    name: item.name,
    url: item.html_url,
    avatarUrl: item.owner?.avatar_url ?? '',
    ownerLogin: item.owner?.login,
  };
}

export async function searchUsers(
  query: string,
  signal?: AbortSignal,
): Promise<SearchItem[]> {
  const items = await fetchSearch<GithubUserItem>(
    '/search/users',
    `${query} in:login`,
    signal,
  );
  return items.map(mapUser);
}

export async function searchRepositories(
  query: string,
  signal?: AbortSignal,
): Promise<SearchItem[]> {
  const items = await fetchSearch<GithubRepoItem>(
    '/search/repositories',
    `${query} in:name`,
    signal,
  );
  return items.map(mapRepo);
}

export async function searchAll(
  query: string,
  signal?: AbortSignal,
): Promise<{ users: SearchItem[]; repos: SearchItem[] }> {
  const [users, repos] = await Promise.all([
    searchUsers(query, signal),
    searchRepositories(query, signal),
  ]);
  return { users, repos };
}
