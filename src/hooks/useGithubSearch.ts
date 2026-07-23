import { useEffect, useState } from 'react';
import { GithubSearchError, searchAll } from '../api/githubSearch';
import type { SearchError, SearchItem } from '../api/types';
import { MIN_QUERY_LENGTH } from '../config';
import { combineResults } from '../lib/combineResults';

export type SearchState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'success'; items: SearchItem[] }
  | { phase: 'error'; error: SearchError };

export function useGithubSearch(query: string): SearchState {
  const [state, setState] = useState<SearchState>({ phase: 'idle' });

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setState({ phase: 'idle' });
      return;
    }

    const controller = new AbortController();
    setState({ phase: 'loading' });

    searchAll(trimmed, controller.signal)
      .then(({ users, repos }) => {
        if (controller.signal.aborted) {
          return;
        }
        setState({ phase: 'success', items: combineResults(users, repos) });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setState({
          phase: 'error',
          error:
            error instanceof GithubSearchError
              ? error.info
              : { kind: 'network' },
        });
      });

    return () => {
      controller.abort();
    };
  }, [query]);

  return state;
}
