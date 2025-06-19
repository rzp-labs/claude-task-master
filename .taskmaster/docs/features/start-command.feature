Feature: Task Start Command
  As a user of the taskmaster tool
  I want the tool to provide AI code agents with rules to follow when starting a task
  So that they can work more effectively, reducing the need for human intervention and rework

  Background:
    Given the taskmaster tool is initialized with the following configuration:
      | key          | value                                 |
      | startCommand | "task-master task-start --next --id=" |
      | rules        | "follow the rules"                    |

# Goal

The goal of the task start phase is to ensure that the code agent has all the necessary information and resources to begin working on the task effectively. At the end of this phase, we should be confident that the code agent is ready to start working on the task and has a clear understanding of what needs to be done.

## Helpful pre-task behaviors:
- Analyzing the full context before starting to code, including project architecture, dependencies, and existing patterns to ensure proper integration with the codebase
- Breaking complex tasks into smaller, digestible pieces to make them more manageable and reduce the likelihood of errors
- Exploreing  relevant files and documentation first to gain a comprehensive understanding of the system before writing any code
- Requesting clarification when task requirements are ambiguous or incomplete rather than making assumptions
- Considering multiple solution approaches and evaluate their trade-offs before selecting the most appropriate one
- Identifying potential edge cases and failure points early in the planning process
- Following established coding standards and patterns specific to the project to maintain consistency
- Establishing clear boundaries and interfaces for the code being developed to maintain system integrity
- Creating a structured plan before implementation, outlining the steps needed to complete the task effectively
- Generating code incrementally with regular validation rather than producing large blocks at once
- Including comments and documentation that explain the reasoning behind implementation choices
- Implemening valid, behavior-driven error handling and validation

## Unhelpful pre-task behaviors:

- Jumping straight to coding without fully understanding the requirements or context of the task
- Ignoring project-specific constraints or requirements that might affect the implementation
- Making assumptions about unclear requirements instead of seeking clarification
- Overlooking existing code patterns or architectural decisions that should be followed
- Taking on overly broad or ambiguous tasks without breaking them down into manageable components
- Failing to consider alternative approaches or solutions to the problem at hand
- Neglecting to identify potential edge cases or failure scenarios during planning
- Rushing through the design phase to get to implementation quickly
- Generating code with hallucinated functions or libraries that don't actually exist in the project
- Introducing unnecessary complexity or over-engineering simple solutions
- Creating code with poor error handling or inadequate validation of inputs and outputs
- Producing code that doesn't follow project conventions or established patterns
- Providing vague or insufficient explanations for implementation decisions
- Resisting or ignoring feedback on generated code or suggested improvements
- Failing to highlight limitations or potential issues in the generated solution
- Overwhelming developers with excessive information or unnecessarily complex explanations
- Introducing security vulnerabilities through insecure coding practices or outdated patterns
- Creating solutions that don't scale well as the project's complexity grows
- Producing code with hidden dependencies or side effects not made clear

## Pre-task actions
1. update the task status to `in-progress`
2. use `worktree-list` to check if a worktree for the task already exists. If you find a worktree for the task, move to the next priotized task via `next`
3. use `worktree-create` to create a worktree for the task
4. `cd` into the worktree directory
5. use `sequential-thinking` for 20 throughts to list our your assumptions
6. use `repomix` to read relevant information from the repository vital for the task.
7, review the task complexity scores
8. use `code-reasoning: feature planning` to develop an execution plan for the task
9. create N sub-tasks based on the complexity-report using the information you gathereed from `repomix`
10. update the first sub-task status to `in-progress`


Feature: Task Done Command
  As a user of the taskmaster tool
  I want the tool to provide AI code agents with rules to follow when completing a task
  So that they will execute critical post-task actions, reducing the need for human intervention and rework

  Background:
    Given the taskmaster tool is initialized with the following configuration:
      | key         | value                         |
      | doneCommand | "task-master task-done --id=" |
      | rules       | "follow the rules"            |


# Goal

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