import * as core from '@actions/core'
import * as github from '@actions/github'

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
}

export async function addBinderComment({
  binderUrl,
  token,
  owner,
  repo,
  prNumber,
  query
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
  const suffix = query ? `?${query}` : ''
  const binderComment = `[![Binder](${binderUrl}/badge_logo.svg)](${binderUrl}/v2/gh/${pr.data.head.repo.full_name}/${pr.data.head.sha}${suffix}) ${commentText} ${pr.data.head.sha}`

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
