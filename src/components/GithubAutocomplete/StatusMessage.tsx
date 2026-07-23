import type { SearchError } from '../../api/types';
import type { SearchState } from '../../hooks/useGithubSearch';
import styles from './GithubAutocomplete.module.css';

function errorText(error: SearchError): string {
  switch (error.kind) {
    case 'rate-limit': {
      if (error.resetAt === null) {
        return 'GitHub search rate limit reached. Try again shortly.';
      }
      const seconds = Math.max(
        0,
        Math.ceil((error.resetAt.getTime() - Date.now()) / 1000),
      );
      return `GitHub search rate limit reached. Try again in about ${seconds}s.`;
    }
    case 'http':
      return `GitHub responded with an error (status ${error.status}). Try again.`;
    case 'network':
      return 'Could not reach GitHub. Check your connection and try again.';
  }
}

function statusText(state: SearchState, query: string): string | null {
  switch (state.phase) {
    case 'idle':
      return null;
    case 'loading':
      return 'Searching GitHub…';
    case 'success':
      return state.items.length === 0
        ? `No users or repositories match “${query}”.`
        : null;
    case 'error':
      return errorText(state.error);
  }
}

export function StatusMessage({
  state,
  query,
}: {
  state: SearchState;
  query: string;
}) {
  const message = statusText(state, query);
  const announcement =
    message ??
    (state.phase === 'success'
      ? `${state.items.length} ${state.items.length === 1 ? 'result' : 'results'} found`
      : '');
  const className =
    message === null
      ? styles.visuallyHidden
      : state.phase === 'error'
        ? styles.statusError
        : styles.status;

  return (
    <div role="status" className={className}>
      {announcement}
    </div>
  );
}
