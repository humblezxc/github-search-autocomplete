import { useId, useState } from 'react';
import { DEBOUNCE_MS } from '../../config';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useGithubSearch } from '../../hooks/useGithubSearch';
import styles from './GithubAutocomplete.module.css';
import { SearchResultsList } from './SearchResultsList';
import { StatusMessage } from './StatusMessage';

type Props = {
  placeholder?: string;
  className?: string;
};

export function GithubAutocomplete({
  placeholder = 'Search GitHub users and repositories (3+ characters)',
  className,
}: Props) {
  const [inputValue, setInputValue] = useState('');
  const debouncedQuery = useDebouncedValue(inputValue, DEBOUNCE_MS);
  const state = useGithubSearch(debouncedQuery);
  const listboxId = useId();

  const query = debouncedQuery.trim();
  const isOpen = state.phase !== 'idle';
  const items = state.phase === 'success' ? state.items : [];

  return (
    <div className={className ? `${styles.root} ${className}` : styles.root}>
      <input
        className={styles.input}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
      />
      <div className={styles.popup} hidden={!isOpen}>
        <StatusMessage state={state} query={query} />
        {items.length > 0 ? (
          <SearchResultsList items={items} listboxId={listboxId} />
        ) : null}
      </div>
    </div>
  );
}
