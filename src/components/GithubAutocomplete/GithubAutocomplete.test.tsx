import { render, screen } from '@testing-library/react';
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
