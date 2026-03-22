# Agent instructions

Guidance for autonomous coding agents working in this repository.

## Github context
- When asked about Github issue, pr, job etc., you can use gh cli to get more context

## Tests

- When changes affect behavior, contracts, or user flows, **add or update automated tests** as appropriate.
- Cover **unit tests** for logic, services, and components where the project already uses them.
- Cover **end-to-end (e2e) tests** when the change touches integration across apps, APIs, or critical user journeys and e2e coverage exists or is clearly warranted.

## Pull requests and CI

- When work maps to a **GitHub issue**, **link it in the pull request** so the issue **closes automatically on merge**. Use a closing keyword in the PR description (for example `Fixes #123`, `Closes #123`, or `Resolves #123`), or otherwise ensure the PR is associated with the issue per repository conventions.
- After **creating a pull request**, **monitor its status** using the **GitHub CLI** (`gh`), for example checks and mergeability.
- If checks fail or the PR reports problems, **investigate, fix the underlying issues**, push updates, and **re-check** until the PR is in a good state (or the failure is clearly external and documented).
