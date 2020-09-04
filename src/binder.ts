import * as core from '@actions/core'
import * as github from '@actions/github'

const commentText =
  ':point_left: Launch a binder notebook on this branch for commit'
const commentUpdate =
  'I will automatically update this comment whenever this PR is modified'

export async function addBinderComment(
  token: string,
  owner: string,
  repo: string,
  prNumber: number
): Promise<string> {
  const ownerRepo = {
    owner,
    repo
  }

  // https://github.com/actions/toolkit/tree/main/packages/github
  const octokit = github.getOctokit(token)

  const pr = await octokit.pulls.get({
    ...ownerRepo,
    pull_number: prNumber
  })

  const binderComment = `[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/${pr.data.head.repo.full_name}/${pr.data.head.sha}) ${commentText} ${pr.data.head.sha}`

  // TODO: Handle pagination if >100 comments
  const comments = await octokit.issues.listComments({
    ...ownerRepo,
    issue_number: prNumber
  })
  const githubActionsComments = comments.data.filter(
    issue =>
      issue.user.login === 'github-actions[bot]' &&
      issue.body.match(commentText)
  )

  if (githubActionsComments.length) {
    const comment = githubActionsComments[githubActionsComments.length - 1]
    core.debug(`Updating comment ${comment.html_url}: ${binderComment}`)
    await octokit.issues.updateComment({
      ...ownerRepo,
      comment_id: comment.id,
      body: `${comment.body}\n\n${binderComment}`
    })
  } else {
    core.debug(`Creating comment on ${pr.data.html_url}: ${binderComment}`)
    await octokit.issues.createComment({
      ...ownerRepo,
      issue_number: prNumber,
      body: `${binderComment}\n\n${commentUpdate}`
    })
  }

  return binderComment
}
