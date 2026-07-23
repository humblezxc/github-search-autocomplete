export type GithubUserItem = {
  id: number;
  login: string;
  html_url: string;
  avatar_url: string;
};

export type GithubRepoOwner = {
  login: string;
  avatar_url: string;
};

export type GithubRepoItem = {
  id: number;
  name: string;
  html_url: string;
  owner: GithubRepoOwner | null;
};

export type GithubSearchResponse<TItem> = {
  total_count: number;
  incomplete_results: boolean;
  items: TItem[];
};

export type SearchItem = {
  kind: 'user' | 'repo';
  id: number;
  name: string;
  url: string;
  avatarUrl: string;
  ownerLogin?: string;
};

export type SearchError =
  | { kind: 'rate-limit'; resetAt: Date | null }
  | { kind: 'http'; status: number }
  | { kind: 'network' };
