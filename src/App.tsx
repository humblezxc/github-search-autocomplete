import { GithubAutocomplete } from './components/GithubAutocomplete/GithubAutocomplete';

function App() {
  return (
    <main className="demo">
      <h1>GitHub search autocomplete</h1>
      <p className="demo-hint">
        Type at least three characters to search GitHub users and repositories
        as one combined, alphabetically ordered list. Browse with the arrow keys
        and press Enter to open a match in a new tab.
      </p>
      <GithubAutocomplete />
    </main>
  );
}

export default App;
