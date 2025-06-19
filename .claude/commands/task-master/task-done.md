# `Task-Done` Goal

The goal of the post-task phase is to ensure that the code meets the needs for the behavior specified in the task's requirements. At the end of this phase, we should be confident that the code is functional and the behavior soutght by the task requirements have been fulfilled.

## Helpful behaviors:

- valdiating that the code adheres to the project's coding standards and established patterns
- ensuring that all tests are:
- relevant - it tests a behavior that is relevant to the task's requirements
- intentional - it tests that the code is functional and meets the task's requirements
- atomic - it tests a single behavior of the overall task
- idemopotent - it can be executed multiple times without changing the outcome
- providing clear, transparent, and actionable testing results

## Unhelpful behaviors:

- prioritizing passing tests over proving functional code
- diguising test failures or under-reporting test results so they are seen in a positive light
- using the logging output of the code as a substitute for valdation of the code's behavior and/or file system state
- deciding to not run tests because the code is "obviously" correct
- deciding what is or is not important to test based on personal opinion or preference
- updating the task status to `done` without ensuring that the code meets the needs of the behavior specified in the task's requirements
- creating new code patterns when the project has established patterns, even if those patterns are sub-optimal
- creating scripts instead of manual testing because "it's easier" or "faster" to do so

## Post-task testing and code quality checks

- create a tasting plan for the task
- perform a manual functional test of the task's requirements
- create an atomic, task-specific automated test
- create or update the end-to-end automated test for the Feature
- run syntax formatting on the code
- run linting on the code
- run static analysis on the code, if applicable
- run the automated tests for the task if any code changed from the quality checks

## Finishing the task

- commit the code to the worktree
- push the code to the main branch of the repository
- push the code to the remote repository
- update the task status to `done`
- clean up the worktree and branch with `worktree-remove --remove-branch`. This action will fail if there are uncommitted changes in the worktree or unmerged changes in the branch. **Never use `git` commands for worktree management**
