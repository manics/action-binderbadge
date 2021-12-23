# BinderHub badge GitHub Action

[![build-test](https://github.com/manics/action-binderbadge/workflows/build-test/badge.svg)](https://github.com/manics/action-binderbadge/actions)

Automatically comment on GitHub pull requests with a link to launch the PR on https://mybinder.org or some other [Binderhub](https://github.com/jupyterhub/binderhub).

If the action has already commented on a PR and further changes are made the comment will be updated to avoid excessive notifications of new comments.

## Required input parameters

- `githubToken`: The GitHub token, required so this action can comment on pull requests.

## Optional input parameters

- `binderUrl`: Optionally specify an alternative BinderHub instead of mybinder.org.
  The URL `<binderUrl>/badge_logo.svg` must exist, and will be used as the badge for linking.
- `query`: Optional query string to pass to the launched server, for example use `urlpath=lab` to launch JupyterLab.
- `binderUrl`: BinderHub base URL if not using https://mybinder.org
- `environmentRepo`: If set then the current repository is used to supply the content for [nbgitpuller](https://jupyterhub.github.io/nbgitpuller/),
  and the environment is built using `environmentRepo`.
  Must be in the form `<repo-type>/<repo>/<version>`,
  e.g. `gist/manics/c34db392c2bd2eb133c58c83c59358a1/HEAD`.
  The environment repo must include nbgitpuller.
- `urlpath`: Optional URL path to pass to the launched server, for example `lab/tree/example.ipynb` or `rstudio`
- `updateDescription`: If `true` then append the comment to the description instead of in a new comment, default `false`
- `persistentLink`: If `true` (default) then the commit SHA will be used and the comment will be updated on subsequent runs, if `false` the branch name will be used

## Examples

Comment on a PR with a persistent link to launch a commit on mybinder.org, update the comment if more commits are pushed:

```yaml
name: binder-badge
on:
  pull_request_target:

jobs:
  badge:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      issues: write
      pull-requests: write
    steps:
      - uses: manics/action-binderbadge@main
        with:
          githubToken: ${{ secrets.GITHUB_TOKEN }}
```

Append a nbgitpuller mybinder link to the pull request description and open JupyterLab.
Note that nbgitpuller does not support persistent links using git commit, so you must set `persistentLink: false` to use the branch name.

```yaml
name: binder-badge-nbgitpuller
on:
  pull_request_target:

jobs:
  badge:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      issues: write
      pull-requests: write
    steps:
      - uses: manics/action-binderbadge@main
        with:
          githubToken: ${{ secrets.GITHUB_TOKEN }}
          environmentRepo: gist/manics/c34db392c2bd2eb133c58c83c59358a1/HEAD
          updateDescription: true
          urlpath: lab
          persistentLink: false
```

## Developer notes

Install the dependencies:

```bash
$ npm install
```

Compile Typescript, run the formatter and linter:

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

Actions are run from GitHub repos so the packed `dist` folder must be updated and committed.

There is a [GitHub workflow to automatically update `dist`](./.github/workflows/test-and-update.yml) on a branch.
Alternatively you can manually update the `dist` folder and commit it:

```bash
$ npm run all
$ git add dist
$ git commit
$ git push origin main
```

Note that you must use the same environment (including Node version) used in the GitHub workflow since it checks that `dist` is up to date.
This ensures mismatching code isn't pushed to `dist`.
