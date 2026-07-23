import type { SearchItem } from '../api/types';
import { DISPLAY_LIMIT, SOURCE_FLOOR } from '../config';

export function allocateSlots(
  userCount: number,
  repoCount: number,
): { users: number; repos: number } {
  return {
    users: Math.min(
      userCount,
      Math.max(SOURCE_FLOOR, DISPLAY_LIMIT - repoCount),
    ),
    repos: Math.min(
      repoCount,
      Math.max(SOURCE_FLOOR, DISPLAY_LIMIT - userCount),
    ),
  };
}

export function compareSearchItems(a: SearchItem, b: SearchItem): number {
  const byName = a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
  if (byName !== 0) {
    return byName;
  }
  if (a.kind !== b.kind) {
    return a.kind < b.kind ? -1 : 1;
  }
  return a.id - b.id;
}

export function combineResults(
  users: SearchItem[],
  repos: SearchItem[],
): SearchItem[] {
  const take = allocateSlots(users.length, repos.length);
  return [...users.slice(0, take.users), ...repos.slice(0, take.repos)].sort(
    compareSearchItems,
  );
}
