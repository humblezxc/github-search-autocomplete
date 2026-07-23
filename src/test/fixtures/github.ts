import type {
  GithubRepoItem,
  GithubSearchResponse,
  GithubUserItem,
} from '../../api/types';

export const userSearchResponse: GithubSearchResponse<GithubUserItem> = {
  total_count: 416,
  incomplete_results: false,
  items: [
    {
      id: 583231,
      login: 'octocat',
      html_url: 'https://github.com/octocat',
      avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
    },
    {
      id: 62080362,
      login: 'octocatblain',
      html_url: 'https://github.com/octocatblain',
      avatar_url: 'https://avatars.githubusercontent.com/u/62080362?v=4',
    },
    {
      id: 68127537,
      login: 'octocato',
      html_url: 'https://github.com/octocato',
      avatar_url: 'https://avatars.githubusercontent.com/u/68127537?v=4',
    },
  ],
};

export const repoSearchResponse: GithubSearchResponse<GithubRepoItem> = {
  total_count: 4989747,
  incomplete_results: false,
  items: [
    {
      id: 10270250,
      name: 'react',
      html_url: 'https://github.com/react/react',
      owner: {
        login: 'react',
        avatar_url: 'https://avatars.githubusercontent.com/u/102812?v=4',
      },
    },
    {
      id: 135786093,
      name: 'react',
      html_url: 'https://github.com/typescript-cheatsheets/react',
      owner: {
        login: 'typescript-cheatsheets',
        avatar_url: 'https://avatars.githubusercontent.com/u/50188264?v=4',
      },
    },
    {
      id: 75396575,
      name: 'react',
      html_url: 'https://github.com/duxianwei520/react',
      owner: {
        login: 'duxianwei520',
        avatar_url: 'https://avatars.githubusercontent.com/u/3249653?v=4',
      },
    },
  ],
};
