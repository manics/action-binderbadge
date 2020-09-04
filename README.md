# BinderHub badge GitHub Action
[![build-test](https://github.com/manics/action-binderbadge/workflows/build-test/badge.svg)](https://github.com/manics/action-binderbadge/actions)

Automatically comment on GitHub pull requests with a link to launch the PR on https://mybinder.org or some other [Binderhub](https://github.com/jupyterhub/binderhub).

If the action has already commented on a PR and further changes are made the comment will be updated to avoid excessive notifications of new comments.


## Required input parameters

- `githubToken`: The GitHub token, required so this action can comment on pull requests.


## Optional input parameters

- `binderUrl`: Optionally specify an alternative BinderHub instead of mybinder.org.
The URL `<binderUrl>/badge_logo.svg` must exist, and will be used as the badge for linking.


## Example

```yaml
name: binder-badge
on:
  pull_request_target:

jobs:
  badge:
    runs-on: ubuntu-latest
    steps:
      - uses: manics/action-binderbadge@main
        with:
          githubToken: ${{ secrets.GITHUB_TOKEN }}
```


## Developer notes

Install the dependencies:
```bash
$ npm install
```

Build the typescript, run the formatter and linter:
```bash
$ npm run build && npm run format && npm run lint
```

Package the code for distribution (uses [ncc](https://github.com/zeit/ncc)):
```bash
$ npm run package
```

Run the tests :heavy_check_mark:
```bash
$ npm test
```
The tests use [nock](https://github.com/nock/nock) to mock GitHub API responses, no real requests are made so manual testing is still required.

Shortcut:
```bash
$ npm run all
```

Actions are run from GitHub repos so you must checkin the packed `dist` folder:
```bash
$ npm run all
$ git add dist
$ git commit
$ git push origin main
```
