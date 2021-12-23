import * as core from '@actions/core'
import * as github from '@actions/github'

// Broken due to https://github.com/octokit/rest.js/issues/35
// import {RestEndpointMethodTypes} from '@octokit/plugin-rest-endpoint-methods'
// type PrResponseT = RestEndpointMethodTypes['pulls']['get']['response']
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
type PrResponseT = any

type Octokit = ReturnType<typeof github.getOctokit>

const commentText = ':point_left: Launch a binder notebook on this branch'
const commentUpdate =
  'I will automatically update this comment whenever this PR is modified'

export function parseBoolean(
  input: string | boolean | null | undefined,
  defaultValue: boolean
): boolean {
  if (typeof input === 'boolean') {
    return input
  }
  if (input === null || input === undefined || input === '') {
    return defaultValue
  }
  if (input.toLowerCase() === 'true') {
    return true
  }
  if (input.toLowerCase() === 'false') {
    return false
  }
  throw new Error(`Invalid boolean value: ${input}`)
}

interface BinderCommentParameters {
  binderUrl: string
  token: string
  owner: string
  repo: string
  prNumber: number
  query: string | null
  environmentRepo: string | null
  urlpath: string | null
  updateDescription: boolean
  persistentLink: boolean
}

function binderEnvironmentUrl(
  binderUrl: string,
  environmentRepo: string | null,
  pr: PrResponseT,
  persistentLink: boolean
): string {
  if (environmentRepo) {
    return `${binderUrl}/v2/${environmentRepo}`
  } else {
    if (!pr.data.head.repo) {
      throw new Error('Could not get repo')
    }
    const version = persistentLink ? pr.data.head.sha : pr.data.head.ref
    return `${binderUrl}/v2/gh/${pr.data.head.repo.full_name}/${version}`
  }
}

function binderQuery(
  environmentRepo: string | null,
  pr: PrResponseT,
  urlpath: string | null,
  query: string | null,
  persistentLink: boolean
): string {
  if (!pr.data.head.repo) {
    throw new Error('Could not get repo')
  }
  const version = persistentLink ? pr.data.head.sha : pr.data.head.ref
  const params = new URLSearchParams()

  if (environmentRepo) {
    const gitpull = new URLSearchParams()
    gitpull.append('repo', pr.data.head.repo.html_url)
    gitpull.append('branch', version)
    if (urlpath) {
      gitpull.append('urlpath', urlpath)
    }
    params.append('urlpath', `git-pull?${gitpull}`)
  } else {
    if (urlpath) {
      params.append('urlpath', urlpath)
    }
  }

  const queryString = params.toString()
  if (queryString) {
    if (query) {
      return `?${queryString}&${query}`
    }
    return `?${queryString}`
  }
  if (query) {
    return `?${query}`
  }
  return ''
}

export async function addBinderComment({
  binderUrl,
  token,
  owner,
  repo,
  prNumber,
  query,
  environmentRepo,
  urlpath,
  updateDescription,
  persistentLink
}: BinderCommentParameters): Promise<string | null> {
  const ownerRepo = {
    owner,
    repo
  }

  // https://github.com/actions/toolkit/tree/main/packages/github
  const octokit = github.getOctokit(token)

  const pr = await octokit.rest.pulls.get({
    ...ownerRepo,
    pull_number: prNumber
  })

  if (!pr.data.head.repo) {
    throw new Error('Could not get repo')
  }
  const useSha = persistentLink
  const binderRepoUrl = binderEnvironmentUrl(
    binderUrl,
    environmentRepo,
    pr,
    useSha
  )
  const suffix = binderQuery(environmentRepo, pr, urlpath, query, useSha)
  const version = persistentLink
    ? `for commit ${pr.data.head.sha}`
    : pr.data.head.ref
  const binderComment = `[![Binder](${binderUrl}/badge_logo.svg)](${binderRepoUrl}${suffix}) ${commentText} ${version}`

  let updated
  if (updateDescription) {
    updated = await updatePrDescription(
      octokit,
      ownerRepo,
      prNumber,
      binderComment,
      pr
    )
  } else {
    updated = await addOrUpdateComment(
      octokit,
      ownerRepo,
      prNumber,
      binderComment,
      pr
    )
  }
  if (updated) {
    return binderComment
  }
  return null
}

async function addOrUpdateComment(
  octokit: Octokit,
  ownerRepo: {owner: string; repo: string},
  prNumber: number,
  binderComment: string,
  pr: PrResponseT
): Promise<boolean> {
  // TODO: Handle pagination if >100 comments
  const comments = await octokit.rest.issues.listComments({
    ...ownerRepo,
    issue_number: prNumber
  })
  const githubActionsComments = comments.data.filter(
    issue =>
      issue.user?.login === 'github-actions[bot]' &&
      issue.body?.match(commentText)
  )

  if (githubActionsComments.length) {
    const comment = githubActionsComments[githubActionsComments.length - 1]
    if (comment.body?.includes(binderComment)) {
      core.debug(
        `Not updating comment ${comment.html_url}, already contains ${binderComment}`
      )
      return false
    }
    core.debug(`Updating comment ${comment.html_url}: ${binderComment}`)
    await octokit.rest.issues.updateComment({
      ...ownerRepo,
      comment_id: comment.id,
      body: `${comment.body}\n\n${binderComment}`
    })
    return true
  } else {
    core.debug(`Creating comment on ${pr.data.html_url}: ${binderComment}`)
    await octokit.rest.issues.createComment({
      ...ownerRepo,
      issue_number: prNumber,
      body: `${binderComment}\n\n${commentUpdate}`
    })
    return true
  }
}

async function updatePrDescription(
  octokit: Octokit,
  ownerRepo: {owner: string; repo: string},
  prNumber: number,
  binderComment: string,
  pr: PrResponseT
): Promise<boolean> {
  if (pr.data.body.includes(binderComment)) {
    core.debug(
      `Not updating PR description ${pr.data.html_url}, already contains ${binderComment}`
    )
    return false
  }
  core.debug(`Updating PR description ${pr.data.html_url}: ${binderComment}`)
  await octokit.rest.pulls.update({
    ...ownerRepo,
    pull_number: prNumber,
    body: `${pr.data.body}\n\n${binderComment}`
  })
  return true
}

export const __private = {
  binderEnvironmentUrl,
  binderQuery
}
