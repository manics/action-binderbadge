import * as core from '@actions/core'
import * as github from '@actions/github'
import {addBinderComment, parseBoolean} from './binder'

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
    const environmentRepo = core.getInput('environmentRepo')
    const urlpath = core.getInput('urlpath')
    const updateDescription = parseBoolean(
      core.getInput('updateDescription'),
      false
    )
    const persistentLink = parseBoolean(core.getInput('persistentLink'), true)

    core.debug(`prNumber: ${prNumber}`)
    core.debug(`query: ${query}`)
    core.debug(`binderUrl: ${binderUrl}`)
    core.debug(`environmentRepo: ${environmentRepo}`)
    core.debug(`urlpath: ${urlpath}`)
    core.debug(`updateDescription: ${updateDescription}`)
    core.debug(`persistentLink: ${persistentLink}`)

    const binderComment = addBinderComment({
      binderUrl,
      token: githubToken,
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      prNumber,
      query,
      environmentRepo,
      urlpath,
      updateDescription,
      persistentLink
    })

    core.setOutput('binderComment', binderComment)
    // https://devblogs.microsoft.com/typescript/announcing-typescript-4-4/#use-unknown-catch-variables
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed(String(error))
    }
  }
}

run()

export const __private = {
  parseBoolean
}
