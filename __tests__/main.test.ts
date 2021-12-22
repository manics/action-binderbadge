import {addBinderComment, __private} from '../src/binder'
import nock from 'nock'

beforeEach(() => {
  nock.disableNetConnect()
})

afterEach(() => {
  if (!nock.isDone()) {
    nock.cleanAll()
    throw new Error('Not all nock calls were made')
  }
})

const mockPrData = {
  data: {
    head: {
      repo: {
        full_name: 'test-owner/test-repo',
        html_url: 'https://github.com/test-owner/test-repo'
      },
      sha: 'test-sha'
    },
    html_url: 'https://github.com/test-owner/test-repo/pull/N'
  }
}

test('binderEnvironmentUrl default', () => {
  const binderUrl = 'https://binder.test'
  const environmentRepo = null
  expect(
    __private.binderEnvironmentUrl(binderUrl, environmentRepo, mockPrData)
  ).toBe(`${binderUrl}/v2/gh/test-owner/test-repo/test-sha`)
})

test('binderEnvironmentUrl with pullyMcPullface', () => {
  const binderUrl = 'https://binder.test'
  const environmentRepo = 'gh/test/repo/branch'
  expect(
    __private.binderEnvironmentUrl(binderUrl, environmentRepo, mockPrData)
  ).toBe(`${binderUrl}/v2/${environmentRepo}`)
})

test('binderQuery without pullyMcPullface', () => {
  expect(__private.binderQuery(null, mockPrData, null, null)).toBe('')
  expect(
    __private.binderQuery(null, mockPrData, 'lab/tree/example.ipynb', null)
  ).toBe('?urlpath=lab%2Ftree%2Fexample.ipynb')
  expect(__private.binderQuery(null, mockPrData, null, 'extra=a%25b')).toBe(
    '?extra=a%25b'
  )
  expect(
    __private.binderQuery(
      null,
      mockPrData,
      'lab/tree/example.ipynb',
      'extra=a%25b'
    )
  ).toBe('?urlpath=lab%2Ftree%2Fexample.ipynb&extra=a%25b')
})

test('binderQuery environmentRepo', () => {
  const environmentRepo = 'gh/test/repo/branch'
  expect(__private.binderQuery(environmentRepo, mockPrData, null, null)).toBe(
    '?urlpath=git-pull%3Frepo%3Dhttps%253A%252F%252Fgithub.com%252Ftest-owner%252Ftest-repo%26branch%3Dtest-sha'
  )
  expect(
    __private.binderQuery(environmentRepo, mockPrData, 'rstudio', 'extra=a%25b')
  ).toBe(
    '?urlpath=git-pull%3Frepo%3Dhttps%253A%252F%252Fgithub.com%252Ftest-owner%252Ftest-repo%26branch%3Dtest-sha%26urlpath%3Drstudio&extra=a%25b'
  )
})

const mockParams = {
  binderUrl: 'https://mybinder.org',
  token: 'token',
  owner: 'owner',
  repo: 'repo',
  query: null,
  environmentRepo: null,
  urlpath: null
}

const binderComment1 =
  '[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/owner/repo/abcdef1) :point_left: Launch a binder notebook on this branch for commit abcdef1'
const fullComment1 = `${binderComment1}\n\nI will automatically update this comment whenever this PR is modified`

test('add new comment', async () => {
  nock('https://api.github.com')
    .get('/repos/owner/repo/pulls/1')
    .reply(200, {
      head: {
        repo: {
          full_name: 'owner/repo'
        },
        sha: 'abcdef1'
      },
      html_url: 'https://github.com/owner/repo/pull/1'
    })
  nock('https://api.github.com')
    .get('/repos/owner/repo/issues/1/comments')
    .reply(200, [
      {
        id: 12,
        user: {
          login: 'github-actions[bot]'
        },
        body: 'something else'
      },
      {
        id: 34,
        user: {
          login: 'someone-else'
        },
        body: 'something else'
      }
    ])
  nock('https://api.github.com')
    .post('/repos/owner/repo/issues/1/comments', {body: fullComment1})
    .reply(200)

  const c = await addBinderComment({
    ...mockParams,
    prNumber: 1
  })
  expect(c).toBe(binderComment1)
})

const binderComment2 =
  '[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/owner/repo/9876543) :point_left: Launch a binder notebook on this branch for commit 9876543'
const fullComment2 = `${fullComment1}\n\n${binderComment2}`

test('update existing comment', async () => {
  nock('https://api.github.com')
    .get('/repos/owner/repo/pulls/2')
    .reply(200, {
      head: {
        repo: {
          full_name: 'owner/repo'
        },
        sha: '9876543'
      },
      html_url: 'https://github.com/owner/repo/pull/2'
    })
  nock('https://api.github.com')
    .get('/repos/owner/repo/issues/2/comments')
    .reply(200, [
      {
        id: 56,
        user: {
          login: 'github-actions[bot]'
        },
        body: fullComment1
      },
      {
        id: 78,
        user: {
          login: 'someone-else'
        },
        body: 'something else'
      }
    ])
  nock('https://api.github.com')
    .patch('/repos/owner/repo/issues/comments/56', {body: fullComment2})
    .reply(200)

  const c = await addBinderComment({
    ...mockParams,
    prNumber: 2
  })
  expect(c).toBe(binderComment2)
})

test('add new lab comment using query', async () => {
  const binderLabComment =
    '[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/owner/repo/a1b2c3d?urlpath=lab) :point_left: Launch a binder notebook on this branch for commit a1b2c3d'
  const fullLabComment = `${binderLabComment}\n\nI will automatically update this comment whenever this PR is modified`

  nock('https://api.github.com')
    .get('/repos/owner/repo/pulls/3')
    .reply(200, {
      head: {
        repo: {
          full_name: 'owner/repo'
        },
        sha: 'a1b2c3d'
      }
      ,
      html_url: 'https://github.com/owner/repo/pull/3'
    })
  nock('https://api.github.com')
    .get('/repos/owner/repo/issues/3/comments')
    .reply(200, [
      {
        id: 90,
        user: {
          login: 'someone-else'
        },
        body: 'something else'
      }
    ])
  nock('https://api.github.com')
    .post('/repos/owner/repo/issues/3/comments', {body: fullLabComment})
    .reply(200)

  const c = await addBinderComment({
    ...mockParams,
    prNumber: 3,
    query: 'urlpath=lab'
  })
  expect(c).toBe(binderLabComment)
})

test('add new lab comment using urlpath', async () => {
  const binderLabComment =
    '[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/owner/repo/a1b2c3d?urlpath=lab) :point_left: Launch a binder notebook on this branch for commit a1b2c3d'
  const fullLabComment = `${binderLabComment}\n\nI will automatically update this comment whenever this PR is modified`

  nock('https://api.github.com')
    .get('/repos/owner/repo/pulls/4')
    .reply(200, {
      head: {
        repo: {
          full_name: 'owner/repo'
        },
        sha: 'a1b2c3d'
      },
      html_url: 'https://github.com/owner/repo/pull/4'
    })
  nock('https://api.github.com')
    .get('/repos/owner/repo/issues/4/comments')
    .reply(200, [
      {
        id: 91,
        user: {
          login: 'someone-else'
        },
        body: 'something else'
      }
    ])
  nock('https://api.github.com')
    .post('/repos/owner/repo/issues/4/comments', {body: fullLabComment})
    .reply(200)

  const c = await addBinderComment({
    ...mockParams,
    prNumber: 4,
    urlpath: 'lab'
  })
  expect(c).toBe(binderLabComment)
})

test('add new lab comment with pullyMcPullface', async () => {
  const binderPullQuery =
    '?urlpath=git-pull%3Frepo%3Dhttps%253A%252F%252Fgithub.com%252Fowner%252Frepo%26branch%3Da1b2c3d%26urlpath%3Dlab'
  const binderLabComment = `[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/envowner/envrepo/branch${binderPullQuery}) :point_left: Launch a binder notebook on this branch for commit a1b2c3d`
  const fullLabComment = `${binderLabComment}\n\nI will automatically update this comment whenever this PR is modified`

  nock('https://api.github.com')
    .get('/repos/owner/repo/pulls/5')
    .reply(200, {
      head: {
        repo: {
          full_name: 'owner/repo',
          html_url: 'https://github.com/owner/repo'
        },
        sha: 'a1b2c3d'
      },
      html_url: 'https://github.com/owner/repo/pull/5'
    })
  nock('https://api.github.com')
    .get('/repos/owner/repo/issues/5/comments')
    .reply(200, [
      {
        id: 101,
        user: {
          login: 'someone-else'
        },
        body: 'something else'
      }
    ])
  nock('https://api.github.com')
    .post('/repos/owner/repo/issues/5/comments', {body: fullLabComment})
    .reply(200)

  const c = await addBinderComment({
    ...mockParams,
    prNumber: 5,
    environmentRepo: 'gh/envowner/envrepo/branch',
    urlpath: 'lab'
  })
  expect(c).toBe(binderLabComment)
})
