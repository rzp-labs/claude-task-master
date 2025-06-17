Help create a Product Requirements Document (PRD) for a new project.

Guide the user through PRD creation:

1. **Project Discovery**
   Ask key questions to understand the project:

   ```
   Let's create a PRD for your project! I'll ask a few questions:

   1. What type of application? (web app, CLI, library, API, mobile, etc.)
   2. What problem does it solve?
   3. Who are the primary users?
   4. What programming language would you prefer?
   5. Any specific frameworks or technologies in mind?
   ```

2. **Gather Requirements**
   Based on project type, ask relevant questions:

   **For Web Applications:**

   - Frontend framework preferences?
   - Need authentication?
   - Database requirements?
   - Real-time features?
   - Third-party integrations?

   **For CLIs:**

   - Command structure?
   - Input/output formats?
   - Platform compatibility?
   - Distribution method?

   **For Libraries:**

   - Target audience (developers)?
   - API design preferences?
   - Language bindings needed?
   - Backwards compatibility?

3. **Feature Exploration**

   ```
   What are the core features? (I'll help you think through this)

   For example, for a task management app:
   ✓ Create/edit/delete tasks
   ✓ Assign priorities and due dates
   ✓ User authentication
   ✓ Team collaboration
   ✓ Notifications

   What features does your [PROJECT_TYPE] need?
   ```

4. **Technical Requirements**
   Explore technical needs:

   - Performance requirements
   - Scalability needs
   - Security considerations
   - Deployment target (cloud, on-premise, etc.)
   - Budget constraints
   - Timeline expectations

5. **Generate PRD Structure**
   Create a comprehensive PRD:

   ```markdown
   # [Project Name] - Product Requirements Document

   ## Executive Summary

   [Brief overview based on discovery]

   ## Problem Statement

   [What problem this solves]

   ## Target Users

   [User personas and use cases]

   ## Functional Requirements

   ### Core Features

   [List of must-have features]

   ### Nice-to-Have Features

   [Future enhancements]

   ## Technical Requirements

   - Language: [Detected/Chosen]
   - Framework: [Recommended based on needs]
   - Database: [If applicable]
   - Authentication: [Method]
   - Deployment: [Target platform]

   ## Non-Functional Requirements

   - Performance: [Metrics]
   - Security: [Requirements]
   - Scalability: [Expectations]
   - Accessibility: [Standards]

   ## Success Criteria

   [How to measure success]

   ## Timeline

   - MVP: [Estimate]
   - Full Release: [Estimate]

   ## Constraints

   [Budget, technical, time constraints]
   ```

6. **Review and Refine**

   ```
   Here's the PRD I've created. Would you like to:
   1. Add more features
   2. Adjust technical choices
   3. Modify timeline/scope
   4. Save and proceed with initialization

   I can also generate user stories if helpful!
   ```

7. **Save PRD**
   Write to file:

   ```bash
   # Save as requirements.md or custom name
   requirements.md
   docs/PRD.md
   .taskmaster/docs/project-prd.md
   ```

8. **Seamless Transition**
   After PRD creation:

   ```
   ✅ PRD saved to requirements.md

   Ready to initialize your project with Task Master?

   Run: /task-master:init requirements.md

   This will:
   - Set up your [LANGUAGE] project
   - Configure [SELECTED_TOOLS]
   - Generate development tasks
   - Create project structure
   ```

9. **Alternative Flows**
   Support different starting points:

   **From Example:**
   "Show me PRD examples for [common app types]"

   **From Similar Project:**
   "Create PRD similar to [popular app]"

   **From User Stories:**
   "I have user stories, help me create a PRD"

10. **Smart Suggestions**
    Based on project type, suggest:
    - Common features often forgotten
    - Security considerations
    - Performance optimizations
    - Accessibility requirements
    - Testing strategies

This command helps users who are starting from scratch or need help articulating their project vision into a structured PRD that Task Master can then use for initialization!
