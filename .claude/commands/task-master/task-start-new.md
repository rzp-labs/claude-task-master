# `task-master task-start`

Start working on task #$ARGUMENTS by setting up everything needed for successful implementation.

Prepare comprehensively to begin task implementation:

## `Task-Start` Goal

The goal of the task start phase is to ensure that the code agent has all the necessary information, resources, and understanding to begin working on the task effectively. At the end of this phase, we should be confident that the code agent is ready to start implementation with a clear understanding of requirements, constraints, and success criteria.

## Helpful Pre-Task Behaviors

### Analysis and Planning

- Analyze the full context before starting to code, including project architecture, dependencies, existing patterns, and integration requirements
- Break complex tasks into smaller, manageable components with clear deliverables and success criteria
- Explore relevant files, documentation, and code examples to gain comprehensive understanding of the system
- Request clarification when task requirements are ambiguous, incomplete, or potentially conflicting
- Consider multiple solution approaches and evaluate their trade-offs in terms of performance, maintainability, and complexity
- Identify potential edge cases, failure points, and integration challenges early in the planning process

### Code Quality and Standards

- Follow established coding standards, patterns, and conventions specific to the project and programming language
- Establish clear boundaries, interfaces, and contracts for the code being developed
- Create a structured implementation plan with clear milestones and validation checkpoints
- Generate code incrementally with regular testing and validation rather than producing large blocks at once
- Include meaningful comments and documentation that explain the reasoning behind implementation choices
- Implement robust, behavior-driven error handling and input validation

### Communication and Documentation

- Provide clear explanations of design decisions and their rationale
- Document assumptions, limitations, and potential risks associated with the chosen approach
- Maintain transparency about implementation progress and any blockers encountered
- Proactively communicate when requirements need adjustment or clarification

## Unhelpful Pre-Task Behaviors

### Poor Planning and Analysis

- Jumping straight to coding without fully understanding requirements, context, or existing system architecture
- Ignoring project-specific constraints, requirements, or architectural decisions that affect implementation
- Making assumptions about unclear requirements instead of seeking proper clarification
- Overlooking existing code patterns, libraries, or established solutions that should be leveraged
- Taking on overly broad or ambiguous tasks without proper decomposition into manageable components
- Failing to consider alternative approaches or validate the chosen solution against requirements

### Code Quality Issues

- Rushing through the design phase to begin implementation without proper planning
- Generating code with hallucinated functions, libraries, or APIs that don't exist in the project
- Introducing unnecessary complexity, over-engineering, or premature optimization
- Creating code with poor error handling, inadequate validation, or insufficient testing considerations
- Producing code that doesn't follow project conventions, patterns, or established standards
- Implementing solutions that don't scale appropriately or consider future maintenance needs

### Communication and Process Issues

- Providing vague or insufficient explanations for implementation decisions and trade-offs
- Resisting or ignoring feedback on generated code or suggested improvements
- Failing to highlight limitations, risks, or potential issues in the proposed solution
- Overwhelming stakeholders with excessive technical details or unnecessarily complex explanations
- Introducing security vulnerabilities through insecure coding practices or outdated patterns
- Creating solutions with hidden dependencies, side effects, or undocumented behaviors

## Pre-Task Actions

> **ALL PRE-TASK ACTIONS ARE REQUIRED PRIOR TO STARTING**

### Environment Setup

Use `task master worktree-list` to check if a worktree for the task already exists
If an active worktree exists, move to the next prioritized task via `next`
Update the task status to `in-progress`
Use `task master worktree-create` tool to create a dedicated worktree for the task
Navigate (`cd`) into the worktree directory
Verify the environment is properly configured and dependencies are available

### Requirements Analysis

> **focus only on your specific task, not the all tasks**

Use `sequential-thinking` for 20 thought to document key assumptions about the task, requirements, and implementation approach that **must** be validated
Use `repomix` to gather and analyze relevant repository information vital for the task
Review any existing task complexity scores and assessments located in `.taskmaster/reports/task-complexity-report_{current_tag}`
Identify and document any unclear requirements or potential blockers

### Planning and Design

Use `code-reasoning: feature planning` to develop a comprehensive execution plan for the task
Use `add_subtask` to create sub-tasks based on the `complexity-report` and information gathered from `repomix` directly to `.taskmaster/tasks/tasks.json`
Define clear success criteria and validation approaches for each sub-task
Identify dependencies, risks, and mitigation strategies

### Implementation Preparation

Update the first sub-task status to `in-progress`
Validate that all necessary resources and information are available
Confirm the implementation approach aligns with project standards and requirements

### Prepare to Begin Implementation

Create a summary of your research and plan for implementation
Request approval to begin and wait for the user's response

> Note: If any pre-task action fails or reveals blocking issues, pause implementation and seek guidance before proceeding.
