import { render, screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { DEBOUNCE_MS } from '../../config';
import { reposResponse, usersResponse } from '../../test/builders';
import { server } from '../../test/server';
import { GithubAutocomplete } from './GithubAutocomplete';

const USERS_URL = 'https://api.github.com/search/users';
const REPOS_URL = 'https://api.github.com/search/repositories';

function setup(): UserEvent {
  const user = userEvent.setup();
  render(<GithubAutocomplete />);
  return user;
}

function debounceElapsed(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, DEBOUNCE_MS + 100);
  });
}

describe('GithubAutocomplete states', () => {
  it('shows nothing and sends no requests below three characters', async () => {
    let requestCount = 0;
    server.use(
      http.get(USERS_URL, () => {
        requestCount += 1;
        return HttpResponse.json(usersResponse([]));
      }),
      http.get(REPOS_URL, () => {
        requestCount += 1;
        return HttpResponse.json(reposResponse([]));
      }),
    );
    const user = setup();

    await user.type(screen.getByRole('combobox'), 're');
    await debounceElapsed();

    expect(screen.getByRole('combobox')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(requestCount).toBe(0);
  });

  it('shows a loading indicator while the search is in flight', async () => {
    let release = () => {};
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(USERS_URL, async () => {
        await blocked;
        return HttpResponse.json(usersResponse(['octocat']));
      }),
      http.get(REPOS_URL, async () => {
        await blocked;
        return HttpResponse.json(reposResponse([]));
      }),
    );
    const user = setup();

    await user.type(screen.getByRole('combobox'), 'octo');

    expect(await screen.findByText(/searching github/i)).toBeInTheDocument();

    release();

    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(screen.queryByText(/searching github/i)).not.toBeInTheDocument();
  });

  it('renders the combined list alphabetically with owner context', async () => {
    server.use(
      http.get(USERS_URL, () =>
        HttpResponse.json(usersResponse(['delta', 'Brave'])),
      ),
      http.get(REPOS_URL, () =>
        HttpResponse.json(reposResponse(['cedar', 'awesome'])),
      ),
    );
    const user = setup();

    await user.type(screen.getByRole('combobox'), 'anything');

    const options = await screen.findAllByRole('option');

    expect(options.map((option) => option.getAttribute('aria-label'))).toEqual([
      'awesome by owner (repository)',
      'Brave (user)',
      'cedar by owner (repository)',
      'delta (user)',
    ]);
    expect(screen.getByRole('combobox')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('shows an empty message when nothing matches', async () => {
    server.use(
      http.get(USERS_URL, () => HttpResponse.json(usersResponse([]))),
      http.get(REPOS_URL, () => HttpResponse.json(reposResponse([]))),
    );
    const user = setup();

    await user.type(screen.getByRole('combobox'), 'zzzqqqxx');

    expect(
      await screen.findByText(/no users or repositories match/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('shows an error message when GitHub responds with an error', async () => {
    server.use(
      http.get(USERS_URL, () => new HttpResponse(null, { status: 500 })),
      http.get(REPOS_URL, () => HttpResponse.json(reposResponse([]))),
    );
    const user = setup();

    await user.type(screen.getByRole('combobox'), 'react');

    expect(
      await screen.findByText(/responded with an error/i),
    ).toBeInTheDocument();
  });

  it('shows a network message when the request cannot be sent', async () => {
    server.use(
      http.get(USERS_URL, () => HttpResponse.error()),
      http.get(REPOS_URL, () => HttpResponse.error()),
    );
    const user = setup();

    await user.type(screen.getByRole('combobox'), 'react');

    expect(
      await screen.findByText(/could not reach github/i),
    ).toBeInTheDocument();
  });
});

describe('GithubAutocomplete rate limiting', () => {
  it('shows the seconds until the rate limit resets', async () => {
    server.use(
      http.get(USERS_URL, () => {
        const reset = Math.floor((Date.now() + 42_000) / 1000);
        return new HttpResponse(null, {
          status: 429,
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(reset),
          },
        });
      }),
      http.get(REPOS_URL, () => HttpResponse.json(reposResponse([]))),
    );
    const user = setup();

    await user.type(screen.getByRole('combobox'), 'react');

    const message = await screen.findByText(/rate limit/i);
    const seconds = /about (\d+)s/i.exec(message.textContent ?? '')?.[1];
    expect(Number(seconds)).toBeGreaterThanOrEqual(30);
    expect(Number(seconds)).toBeLessThanOrEqual(42);
  });

  it('shows a fallback when the reset time is unknown', async () => {
    server.use(
      http.get(
        USERS_URL,
        () =>
          new HttpResponse(null, {
            status: 403,
            headers: { 'x-ratelimit-remaining': '0' },
          }),
      ),
      http.get(REPOS_URL, () => HttpResponse.json(reposResponse([]))),
    );
    const user = setup();

    await user.type(screen.getByRole('combobox'), 'react');

    const message = await screen.findByText(/rate limit/i);
    expect(message.textContent).toMatch(/try again shortly/i);
  });
});

function mockResults(users: string[], repos: string[]) {
  server.use(
    http.get(USERS_URL, () => HttpResponse.json(usersResponse(users))),
    http.get(REPOS_URL, () => HttpResponse.json(reposResponse(repos))),
  );
}

describe('GithubAutocomplete keyboard and selection', () => {
  it('moves the highlight with ArrowDown and clamps at the last option', async () => {
    mockResults(['bravo'], ['alpha']);
    const user = setup();
    const input = screen.getByRole('combobox');

    await user.type(input, 'test');
    await screen.findAllByRole('option');

    await user.keyboard('{ArrowDown}');
    let options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[0]!.id);

    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    options = screen.getAllByRole('option');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
    expect(input).toHaveAttribute('aria-activedescendant', options[1]!.id);
  });

  it('moves the highlight with ArrowUp and clamps at the first option', async () => {
    mockResults(['bravo'], ['alpha']);
    const user = setup();
    const input = screen.getByRole('combobox');

    await user.type(input, 'test');
    await screen.findAllByRole('option');

    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}{ArrowUp}');

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('opens the highlighted item in a new tab on Enter and closes the list', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    mockResults([], ['alpha']);
    const user = setup();
    const input = screen.getByRole('combobox');

    await user.type(input, 'test');
    await screen.findAllByRole('option');

    await user.keyboard('{ArrowDown}{Enter}');

    expect(openSpy).toHaveBeenCalledExactlyOnceWith(
      'https://github.com/owner/alpha',
      '_blank',
      'noopener,noreferrer',
    );
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('does nothing on Enter when no option is highlighted', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    mockResults(['bravo'], ['alpha']);
    const user = setup();
    const input = screen.getByRole('combobox');

    await user.type(input, 'test');
    await screen.findAllByRole('option');

    await user.keyboard('{Enter}');

    expect(openSpy).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes on Escape and reopens on ArrowDown', async () => {
    mockResults(['bravo'], ['alpha']);
    const user = setup();
    const input = screen.getByRole('combobox');

    await user.type(input, 'test');
    await screen.findAllByRole('option');

    await user.keyboard('{Escape}');

    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute('aria-activedescendant');

    await user.keyboard('{ArrowDown}');

    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('opens an option in a new tab on click without losing input focus', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    mockResults(['bravo'], []);
    const user = setup();
    const input = screen.getByRole('combobox');

    await user.type(input, 'test');
    const options = await screen.findAllByRole('option');

    await user.click(options[0]!);

    expect(openSpy).toHaveBeenCalledExactlyOnceWith(
      'https://github.com/bravo',
      '_blank',
      'noopener,noreferrer',
    );
    expect(input).toHaveFocus();
  });

  it('clears the highlight when the results change', async () => {
    server.use(
      http.get(USERS_URL, ({ request }) => {
        const q = new URL(request.url).searchParams.get('q') ?? '';
        return HttpResponse.json(
          usersResponse(q.startsWith('aaa ') ? ['first', 'second'] : []),
        );
      }),
      http.get(REPOS_URL, ({ request }) => {
        const q = new URL(request.url).searchParams.get('q') ?? '';
        return HttpResponse.json(
          reposResponse(q.startsWith('aaa ') ? [] : ['other']),
        );
      }),
    );
    const user = setup();
    const input = screen.getByRole('combobox');

    await user.type(input, 'aaa');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant');

    await user.type(input, 'b');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));

    expect(input).not.toHaveAttribute('aria-activedescendant');
  });
});
