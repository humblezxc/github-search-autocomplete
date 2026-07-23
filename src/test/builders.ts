import type {
  GithubRepoItem,
  GithubSearchResponse,
  GithubUserItem,
} from '../api/types';

export function usersResponse(
  logins: string[],
): GithubSearchResponse<GithubUserItem> {
  return {
    total_count: logins.length,
    incomplete_results: false,
    items: logins.map((login, index) => ({
      id: index + 1,
      login,
      html_url: `https://github.com/${login}`,
      avatar_url: '',
    })),
  };
}

export function reposResponse(
  names: string[],
): GithubSearchResponse<GithubRepoItem> {
  return {
    total_count: names.length,
    incomplete_results: false,
    items: names.map((name, index) => ({
      id: index + 1,
      name,
      html_url: `https://github.com/owner/${name}`,
      owner: { login: 'owner', avatar_url: '' },
    })),
  };
}
