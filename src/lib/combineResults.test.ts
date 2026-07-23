import type { SearchItem } from '../api/types';
import { DISPLAY_LIMIT, SOURCE_FLOOR } from '../config';
import {
  allocateSlots,
  combineResults,
  compareSearchItems,
} from './combineResults';

function user(name: string, id = 1): SearchItem {
  return {
    kind: 'user',
    id,
    name,
    url: `https://github.com/${name}`,
    avatarUrl: '',
  };
}

function repo(name: string, id = 1): SearchItem {
  return {
    kind: 'repo',
    id,
    name,
    url: `https://github.com/owner/${name}`,
    avatarUrl: '',
    ownerLogin: 'owner',
  };
}

function users(count: number, prefix = 'user'): SearchItem[] {
  return Array.from({ length: count }, (_, i) => user(`${prefix}${i}`, i));
}

function repos(count: number, prefix = 'repo'): SearchItem[] {
  return Array.from({ length: count }, (_, i) => repo(`${prefix}${i}`, i));
}

describe('allocateSlots', () => {
  it('splits evenly when both sources are rich', () => {
    expect(allocateSlots(50, 50)).toEqual({ users: 25, repos: 25 });
  });

  it('redistributes surplus slots to the richer source', () => {
    expect(allocateSlots(7, 50)).toEqual({ users: 7, repos: 43 });
    expect(allocateSlots(50, 7)).toEqual({ users: 43, repos: 7 });
  });

  it('gives the whole budget to the only non-empty source', () => {
    expect(allocateSlots(0, 50)).toEqual({ users: 0, repos: 50 });
    expect(allocateSlots(50, 0)).toEqual({ users: 50, repos: 0 });
  });

  it('takes everything when both sources are scarce', () => {
    expect(allocateSlots(3, 4)).toEqual({ users: 3, repos: 4 });
  });

  it('never exceeds availability, the floor guarantee, or the display limit', () => {
    const counts = [0, 1, 7, 24, 25, 26, 43, 50, 60];
    for (const u of counts) {
      for (const r of counts) {
        const take = allocateSlots(u, r);
        expect(take.users).toBeLessThanOrEqual(u);
        expect(take.repos).toBeLessThanOrEqual(r);
        expect(take.users + take.repos).toBe(Math.min(DISPLAY_LIMIT, u + r));
        expect(take.users).toBeGreaterThanOrEqual(Math.min(u, SOURCE_FLOOR));
        expect(take.repos).toBeGreaterThanOrEqual(Math.min(r, SOURCE_FLOOR));
      }
    }
  });
});

describe('compareSearchItems', () => {
  it('orders names case-insensitively', () => {
    expect(compareSearchItems(user('apple'), repo('Zebra'))).toBeLessThan(0);
    expect(compareSearchItems(repo('Zebra'), user('apple'))).toBeGreaterThan(0);
  });

  it('treats accented names as equal to their base letters', () => {
    expect(compareSearchItems(repo('café', 1), user('cafe', 1))).toBeLessThan(
      0,
    );
  });

  it('breaks name ties by kind, then id', () => {
    expect(compareSearchItems(repo('same', 2), user('same', 1))).toBeLessThan(
      0,
    );
    expect(compareSearchItems(user('same', 1), user('same', 2))).toBeLessThan(
      0,
    );
  });
});

describe('combineResults', () => {
  it('interleaves both kinds alphabetically', () => {
    const result = combineResults(
      [user('mango'), user('Apricot')],
      [repo('banana'), repo('cherry')],
    );

    expect(result.map((item) => item.name)).toEqual([
      'Apricot',
      'banana',
      'cherry',
      'mango',
    ]);
  });

  it('cuts each source by relevance rank, not by alphabet', () => {
    const lateAlphabetUsers = users(30, 'zz-user-');
    const earlyAlphabetRepos = repos(40, 'aa-repo-');

    const result = combineResults(lateAlphabetUsers, earlyAlphabetRepos);

    const keptUsers = result.filter((item) => item.kind === 'user');
    expect(keptUsers).toHaveLength(25);
    expect(keptUsers.map((item) => item.id).sort((a, b) => a - b)).toEqual(
      lateAlphabetUsers.slice(0, 25).map((item) => item.id),
    );
  });

  it('caps the combined list at the display limit', () => {
    expect(combineResults(users(50), repos(50))).toHaveLength(DISPLAY_LIMIT);
  });

  it('returns everything sorted when under the limit', () => {
    const result = combineResults(users(2, 'b'), repos(2, 'a'));

    expect(result).toHaveLength(4);
    expect(result.map((item) => item.name)).toEqual(['a0', 'a1', 'b0', 'b1']);
  });
});
