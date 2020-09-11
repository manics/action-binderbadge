import {addBinderComment} from './binder'
import * as core from '@actions/core'
import * as github from '@actions/github'

// Set secret `ACTIONS_RUNNER_DEBUG=true` `ACTIONS_STEP_DEBUG=true` to enable debug comments

async function run(): Promise<void> {
  try {
    const payload = JSON.stringify(github.context.payload, undefined, 2)
    core.debug(`Event payload: ${payload}`)

    if (!github.context.eventName.startsWith('pull_request')) {
      core.setFailed(`Event not supported: ${github.context.eventName}`)
      return
    }

    const prNumber = github.context.issue.number
    const githubToken = core.getInput('githubToken')
    const query = core.getInput('query')
    const binderUrl = core.getInput('binderUrl')

    const binderComment = addBinderComment({
      binderUrl,
      token: githubToken,
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      prNumber,
      query
    })

    core.setOutput('binderComment', binderComment)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
