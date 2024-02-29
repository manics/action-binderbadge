import {addBinderComment, parseBoolean, __private} from '../src/binder'
import {MockAgent, MockClient, setGlobalDispatcher} from 'undici'

let mockAgent: MockAgent<MockAgent.Options>
let mockClient: MockClient

beforeEach(() => {
  mockAgent = new MockAgent({connections: 1})
  mockAgent.disableNetConnect()
  setGlobalDispatcher(mockAgent)
  mockClient = mockAgent.get('https://api.github.com')
})

afterEach(() => {
  mockAgent.assertNoPendingInterceptors()
  mockAgent.close()
})

test('parseBoolean', () => {
  expect(parseBoolean(true, false)).toBe(true)
  expect(parseBoolean(false, true)).toBe(false)

  expect(parseBoolean(null, true)).toBe(true)
  expect(parseBoolean(null, false)).toBe(false)

  expect(parseBoolean('tRuE', false)).toBe(true)
  expect(parseBoolean('FaLsE', true)).toBe(false)
  expect(parseBoolean('', false)).toBe(false)
  expect(parseBoolean('', true)).toBe(true)

  expect(() => parseBoolean('other', false)).toThrow(Error)
})

function mockPrResponse(
  owner: string,
  repo: string,
  sha: string,
  ref: string,
  prNumber: number,
  body: string = 'PR description'
) {
  return {
    head: {
      repo: {
        full_name: `${owner}/${repo}`,
        html_url: `https://github.com/${owner}/${repo}`
      },
      ref: ref,
      sha: sha
    },
    html_url: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
    body: body
  }
}

function mockCommentResponse(commentId: number, login: string, body: string) {
  return {
    id: commentId,
    user: {
      login: login
    },
    body: body,
    html_url: `https://github.com/<example>/<example>/issues/0#issuecomment-${commentId}`
  }
}

const mockPrData = {
  data: mockPrResponse('test-owner', 'test-repo', 'test-sha', 'test-branch', 0)
}

test('binderEnvironmentUrl default', () => {
  const binderUrl = 'https://binder.test'
  const environmentRepo = null
  expect(
    __private.binderEnvironmentUrl(binderUrl, environmentRepo, mockPrData, true)
  ).toBe(`${binderUrl}/v2/gh/test-owner/test-repo/test-sha`)
  expect(
    __private.binderEnvironmentUrl(
      binderUrl,
      environmentRepo,
      mockPrData,
      false
    )
  ).toBe(`${binderUrl}/v2/gh/test-owner/test-repo/test-branch`)
})

test('binderEnvironmentUrl with pullyMcPullface', () => {
  const binderUrl = 'https://binder.test'
  const environmentRepo = 'gh/test/repo/branch'
  expect(
    __private.binderEnvironmentUrl(binderUrl, environmentRepo, mockPrData, true)
  ).toBe(`${binderUrl}/v2/${environmentRepo}`)
})

test('binderQuery without pullyMcPullface', () => {
  expect(__private.binderQuery(null, mockPrData, null, null, true)).toBe('')
  expect(
    __private.binderQuery(
      null,
      mockPrData,
      'lab/tree/example.ipynb',
      null,
      true
    )
  ).toBe('?urlpath=lab%2Ftree%2Fexample.ipynb')
  expect(
    __private.binderQuery(null, mockPrData, null, 'extra=a%25b', true)
  ).toBe('?extra=a%25b')
  expect(
    __private.binderQuery(
      null,
      mockPrData,
      'lab/tree/example.ipynb',
      'extra=a%25b',
      true
    )
  ).toBe('?urlpath=lab%2Ftree%2Fexample.ipynb&extra=a%25b')
})

test('binderQuery with pullyMcPullface', () => {
  const environmentRepo = 'gh/test/repo/branch'
  expect(
    __private.binderQuery(environmentRepo, mockPrData, null, null, true)
  ).toBe(
    '?urlpath=git-pull%3Frepo%3Dhttps%253A%252F%252Fgithub.com%252Ftest-owner%252Ftest-repo%26branch%3Dtest-sha'
  )
  expect(
    __private.binderQuery(environmentRepo, mockPrData, null, null, false)
  ).toBe(
    '?urlpath=git-pull%3Frepo%3Dhttps%253A%252F%252Fgithub.com%252Ftest-owner%252Ftest-repo%26branch%3Dtest-branch'
  )
  expect(
    __private.binderQuery(
      environmentRepo,
      mockPrData,
      'rstudio',
      'extra=a%25b',
      true
    )
  ).toBe(
    '?urlpath=git-pull%3Frepo%3Dhttps%253A%252F%252Fgithub.com%252Ftest-owner%252Ftest-repo%26branch%3Dtest-sha%26urlpath%3Drstudio&extra=a%25b'
  )
  expect(
    __private.binderQuery(
      environmentRepo,
      mockPrData,
      'rstudio',
      'extra=a%25b',
      false
    )
  ).toBe(
    '?urlpath=git-pull%3Frepo%3Dhttps%253A%252F%252Fgithub.com%252Ftest-owner%252Ftest-repo%26branch%3Dtest-branch%26urlpath%3Drstudio&extra=a%25b'
  )
})

const mockParams = {
  binderUrl: 'https://mybinder.org',
  token: 'token',
  owner: 'owner',
  repo: 'repo',
  query: null,
  environmentRepo: null,
  urlpath: null,
  updateDescription: false,
  persistentLink: true
}

const binderComment1 =
  '[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/owner/repo/abcdef1) :point_left: Launch a binder notebook on this branch for commit abcdef1'
const fullComment1 = `${binderComment1}\n\nI will automatically update this comment whenever this PR is modified`

const binderComment2 =
  '[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/owner/repo/9876543) :point_left: Launch a binder notebook on this branch for commit 9876543'
const fullComment2 = `${fullComment1}\n\n${binderComment2}`

const binderCommentBranch =
  '[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/owner/repo/ref-branch) :point_left: Launch a binder notebook on this branch ref-branch'

const defaultReplyHeaders = {
  headers: {'Content-Type': 'application/json; charset=utf-8'}
}

test('add new comment', async () => {
  mockClient
    .intercept({path: '/repos/owner/repo/pulls/1'})
    .reply(
      200,
      mockPrResponse('owner', 'repo', 'abcdef1', 'branch', 1),
      defaultReplyHeaders
    )
  mockClient
    .intercept({path: '/repos/owner/repo/issues/1/comments'})
    .reply(
      200,
      [
        mockCommentResponse(12, 'github-actions[bot]', 'something else'),
        mockCommentResponse(34, 'someone-else', 'something else')
      ],
      defaultReplyHeaders
    )
  mockClient
    .intercept({
      method: 'POST',
      path: '/repos/owner/repo/issues/1/comments',
      body: JSON.stringify({body: fullComment1})
    })
    .reply(200)

  const c = await addBinderComment({
    ...mockParams,
    prNumber: 1
  })
  expect(c).toBe(binderComment1)
})

test('update existing comment', async () => {
  mockClient
    .intercept({path: '/repos/owner/repo/pulls/2'})
    .reply(
      200,
      mockPrResponse('owner', 'repo', '9876543', 'branch', 2),
      defaultReplyHeaders
    )
  mockClient
    .intercept({path: '/repos/owner/repo/issues/2/comments'})
    .reply(
      200,
      [
        mockCommentResponse(56, 'github-actions[bot]', fullComment1),
        mockCommentResponse(78, 'someone-else', 'something else')
      ],
      defaultReplyHeaders
    )
  mockClient
    .intercept({
      method: 'PATCH',
      path: '/repos/owner/repo/issues/comments/56',
      body: JSON.stringify({body: fullComment2})
    })
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

  mockClient
    .intercept({path: '/repos/owner/repo/pulls/3'})
    .reply(
      200,
      mockPrResponse('owner', 'repo', 'a1b2c3d', 'branch', 3),
      defaultReplyHeaders
    )
  mockClient
    .intercept({path: '/repos/owner/repo/issues/3/comments'})
    .reply(
      200,
      [mockCommentResponse(90, 'someone-else', 'something else')],
      defaultReplyHeaders
    )
  mockClient
    .intercept({
      method: 'POST',
      path: '/repos/owner/repo/issues/3/comments',
      body: JSON.stringify({body: fullLabComment})
    })
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

  mockClient
    .intercept({path: '/repos/owner/repo/pulls/4'})
    .reply(
      200,
      mockPrResponse('owner', 'repo', 'a1b2c3d', 'branch', 4),
      defaultReplyHeaders
    )
  mockClient
    .intercept({path: '/repos/owner/repo/issues/4/comments'})
    .reply(
      200,
      [mockCommentResponse(91, 'someone-else', 'something else')],
      defaultReplyHeaders
    )
  mockClient
    .intercept({
      method: 'POST',
      path: '/repos/owner/repo/issues/4/comments',
      body: JSON.stringify({body: fullLabComment})
    })
    .reply(200)

  const c = await addBinderComment({
    ...mockParams,
    prNumber: 4,
    urlpath: 'lab'
  })
  expect(c).toBe(binderLabComment)
})

test('add new lab comment with pullyMcPullface using branch', async () => {
  const binderPullQuery =
    '?urlpath=git-pull%3Frepo%3Dhttps%253A%252F%252Fgithub.com%252Fowner%252Frepo%26branch%3Dref-branch%26urlpath%3Dlab'
  const binderLabComment = `[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/envowner/envrepo/branch${binderPullQuery}) :point_left: Launch a binder notebook on this branch ref-branch`
  const fullLabComment = `${binderLabComment}\n\nI will automatically update this comment whenever this PR is modified`

  mockClient
    .intercept({path: '/repos/owner/repo/pulls/5'})
    .reply(
      200,
      mockPrResponse('owner', 'repo', 'a1b2c3d', 'ref-branch', 5),
      defaultReplyHeaders
    )
  mockClient
    .intercept({path: '/repos/owner/repo/issues/5/comments'})
    .reply(
      200,
      [mockCommentResponse(101, 'someone-else', 'something else')],
      defaultReplyHeaders
    )
  mockClient
    .intercept({
      method: 'POST',
      path: '/repos/owner/repo/issues/5/comments',
      body: JSON.stringify({body: fullLabComment})
    })
    .reply(200)

  const c = await addBinderComment({
    ...mockParams,
    prNumber: 5,
    environmentRepo: 'gh/envowner/envrepo/branch',
    urlpath: 'lab',
    persistentLink: false
  })
  expect(c).toBe(binderLabComment)
})

test('avoid duplicating existing comment', async () => {
  mockClient
    .intercept({path: '/repos/owner/repo/pulls/6'})
    .reply(
      200,
      mockPrResponse('owner', 'repo', 'abcdef1', 'branch', 6),
      defaultReplyHeaders
    )
  mockClient
    .intercept({path: '/repos/owner/repo/issues/6/comments'})
    .reply(
      200,
      [
        mockCommentResponse(
          102,
          'github-actions[bot]',
          `Prefix\n${fullComment1}\nSuffix`
        )
      ],
      defaultReplyHeaders
    )
  // PATCH https://api.github.com/repos/owner/repo/issues/comments/102
  // should not be called, if it is it should be caught

  const c = await addBinderComment({
    ...mockParams,
    prNumber: 6
  })
  expect(c).toBe(null)
})

test('add to pr description', async () => {
  const initialDescription = '# PR\n\ndescription'
  mockClient
    .intercept({path: '/repos/owner/repo/pulls/7'})
    .reply(
      200,
      mockPrResponse(
        'owner',
        'repo',
        'abcdef1',
        'branch',
        6,
        initialDescription
      ),
      defaultReplyHeaders
    )
  mockClient
    .intercept({
      path: '/repos/owner/repo/pulls/7',
      method: 'PATCH',
      body: JSON.stringify({body: `${initialDescription}\n\n${binderComment1}`})
    })
    .reply(200)

  const c = await addBinderComment({
    ...mockParams,
    prNumber: 7,
    updateDescription: true
  })
  expect(c).toBe(binderComment1)
})

test('add another to pr description', async () => {
  const initialDescription = `# PR\n\ndescription\n\n${binderComment1}`
  mockClient
    .intercept({path: '/repos/owner/repo/pulls/8'})
    .reply(
      200,
      mockPrResponse(
        'owner',
        'repo',
        '9876543',
        'branch',
        7,
        initialDescription
      ),
      defaultReplyHeaders
    )
  mockClient
    .intercept({
      path: '/repos/owner/repo/pulls/8',
      method: 'PATCH',
      body: JSON.stringify({
        body: `${initialDescription}\n\n${binderComment2}`
      })
    })
    .reply(200)

  const c = await addBinderComment({
    ...mockParams,
    prNumber: 8,
    updateDescription: true
  })
  expect(c).toBe(binderComment2)
})

test('avoid duplicating pr description using branch', async () => {
  const initialDescription = `# PR\n\ndescription\n${binderCommentBranch}`
  mockClient
    .intercept({path: '/repos/owner/repo/pulls/9'})
    .reply(
      200,
      mockPrResponse(
        'owner',
        'repo',
        'abcdef1',
        'ref-branch',
        9,
        initialDescription
      ),
      defaultReplyHeaders
    )
  // PATCH https://api.github.com/repos/owner/repo/pulls/9
  // should not be called, if it is it should be caught

  const c = await addBinderComment({
    ...mockParams,
    prNumber: 9,
    updateDescription: true,
    persistentLink: false
  })
  expect(c).toBe(null)
})
