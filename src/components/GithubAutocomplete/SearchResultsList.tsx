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
};

export function SearchResultsList({ items, listboxId }: Props) {
  return (
    <ul
      className={styles.list}
      role="listbox"
      id={listboxId}
      aria-label="Users and repositories"
    >
      {items.map((item) => (
        <li
          key={`${item.kind}-${item.id}`}
          className={styles.option}
          role="option"
          aria-selected={false}
          aria-label={optionLabel(item)}
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
