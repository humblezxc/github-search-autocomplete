import { useEffect, useRef } from 'react';
import type { SearchItem } from '../../api/types';
import styles from './GithubAutocomplete.module.css';
import { RepoIcon, UserIcon } from './icons';

function optionLabel(item: SearchItem): string {
  if (item.kind === 'user') {
    return `${item.name} (user)`;
  }
  return item.ownerLogin
    ? `${item.name} by ${item.ownerLogin} (repository)`
    : `${item.name} (repository)`;
}

type Props = {
  items: SearchItem[];
  listboxId: string;
  activeIndex: number | null;
  optionId: (index: number) => string;
  onSelect: (item: SearchItem) => void;
};

export function SearchResultsList({
  items,
  listboxId,
  activeIndex,
  optionId,
  onSelect,
}: Props) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }
    listRef.current?.children[activeIndex]?.scrollIntoView({
      block: 'nearest',
    });
  }, [activeIndex]);

  return (
    <ul
      ref={listRef}
      className={styles.list}
      role="listbox"
      id={listboxId}
      aria-label="Users and repositories"
      onMouseDown={(event) => {
        event.preventDefault();
      }}
    >
      {items.map((item, index) => (
        <li
          key={`${item.kind}-${item.id}`}
          id={optionId(index)}
          className={styles.option}
          role="option"
          aria-selected={index === activeIndex}
          aria-label={optionLabel(item)}
          onClick={() => {
            onSelect(item);
          }}
        >
          <span className={styles.kindIcon}>
            {item.kind === 'user' ? <UserIcon /> : <RepoIcon />}
          </span>
          {item.avatarUrl ? (
            <img className={styles.avatar} src={item.avatarUrl} alt="" />
          ) : (
            <span className={styles.avatar} />
          )}
          <span className={styles.name}>{item.name}</span>
          {item.ownerLogin ? (
            <span className={styles.owner}>{item.ownerLogin}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
