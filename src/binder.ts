import * as core from '@actions/core'
import * as github from '@actions/github'

// Broken due to https://github.com/octokit/rest.js/issues/35
// import {RestEndpointMethodTypes} from '@octokit/plugin-rest-endpoint-methods'
// type PrResponseT = RestEndpointMethodTypes['pulls']['get']['response']
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
type PrResponseT = any

const commentText =
  ':point_left: Launch a binder notebook on this branch for commit'
const commentUpdate =
  'I will automatically update this comment whenever this PR is modified'

interface BinderCommentParameters {
  binderUrl: string
  token: string
  owner: string
  repo: string
  prNumber: number
  query: string | null
  environmentRepo: string | null
  urlpath: string | null
}

function binderEnvironmentUrl(
  binderUrl: string,
  environmentRepo: string | null,
  pr: PrResponseT
): string {
  if (environmentRepo) {
    return `${binderUrl}/v2/${environmentRepo}`
  } else {
    if (!pr.data.head.repo) {
      throw new Error('Could not get repo')
    }
    return `${binderUrl}/v2/gh/${pr.data.head.repo.full_name}/${pr.data.head.sha}`
  }
}

function binderQuery(
  environmentRepo: string | null,
  pr: PrResponseT,
  urlpath: string | null,
  query: string | null
): string {
  if (!pr.data.head.repo) {
    throw new Error('Could not get repo')
  }
  const params = new URLSearchParams()

  if (environmentRepo) {
    const gitpull = new URLSearchParams()
    gitpull.append('repo', pr.data.head.repo.html_url)
    gitpull.append('branch', pr.data.head.sha)
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
  urlpath
}: BinderCommentParameters): Promise<string> {
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
  const binderRepoUrl = binderEnvironmentUrl(binderUrl, environmentRepo, pr)
  const suffix = binderQuery(environmentRepo, pr, urlpath, query)
  const binderComment = `[![Binder](${binderUrl}/badge_logo.svg)](${binderRepoUrl}${suffix}) ${commentText} ${pr.data.head.sha}`

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
    core.debug(`Updating comment ${comment.html_url}: ${binderComment}`)
    await octokit.rest.issues.updateComment({
      ...ownerRepo,
      comment_id: comment.id,
      body: `${comment.body}\n\n${binderComment}`
    })
  } else {
    core.debug(`Creating comment on ${pr.data.html_url}: ${binderComment}`)
    await octokit.rest.issues.createComment({
      ...ownerRepo,
      issue_number: prNumber,
      body: `${binderComment}\n\n${commentUpdate}`
    })
  }

  return binderComment
}

export const __private = {
  binderEnvironmentUrl,
  binderQuery
}
