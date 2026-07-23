import { useId, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { SearchItem } from '../../api/types';
import { DEBOUNCE_MS } from '../../config';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useGithubSearch } from '../../hooks/useGithubSearch';
import styles from './GithubAutocomplete.module.css';
import { SearchResultsList } from './SearchResultsList';
import { StatusMessage } from './StatusMessage';

const NO_ITEMS: SearchItem[] = [];

type Props = {
  placeholder?: string;
  className?: string;
};

export function GithubAutocomplete({
  placeholder = 'Search GitHub users and repositories (3+ characters)',
  className,
}: Props) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const debouncedQuery = useDebouncedValue(inputValue, DEBOUNCE_MS);
  const state = useGithubSearch(debouncedQuery);
  const listboxId = useId();

  const items = state.phase === 'success' ? state.items : NO_ITEMS;
  const [prevItems, setPrevItems] = useState(items);
  if (prevItems !== items) {
    setPrevItems(items);
    setActiveIndex(null);
  }

  const query = debouncedQuery.trim();
  const open = isOpen && state.phase !== 'idle';
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  const openItem = (item: SearchItem) => {
    window.open(item.url, '_blank', 'noopener,noreferrer');
    setIsOpen(false);
    setActiveIndex(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      if (items.length > 0) {
        setActiveIndex((index) =>
          index === null ? 0 : Math.min(index + 1, items.length - 1),
        );
      }
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (open && activeIndex !== null) {
        setActiveIndex(Math.max(activeIndex - 1, 0));
      }
      return;
    }
    if (event.key === 'Enter') {
      if (open && activeIndex !== null) {
        const item = items[activeIndex];
        if (item) {
          event.preventDefault();
          openItem(item);
        }
      }
      return;
    }
    if (event.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(null);
    }
  };

  return (
    <div className={className ? `${styles.root} ${className}` : styles.root}>
      <input
        className={styles.input}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && activeIndex !== null ? optionId(activeIndex) : undefined
        }
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={inputValue}
        onChange={(event) => {
          setInputValue(event.target.value);
          setIsOpen(true);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setIsOpen(false);
          setActiveIndex(null);
        }}
      />
      <div className={styles.popup} hidden={!open}>
        <StatusMessage state={state} query={query} />
        {items.length > 0 ? (
          <SearchResultsList
            items={items}
            listboxId={listboxId}
            activeIndex={activeIndex}
            optionId={optionId}
            onSelect={openItem}
          />
        ) : null}
      </div>
    </div>
  );
}
