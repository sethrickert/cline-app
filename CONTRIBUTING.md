# Contributing to Cline Chat

Thank you for helping improve Cline Chat. Bug fixes, documentation, tests, accessibility improvements, and focused feature additions are welcome.

## Before you start

- Search the existing issues and pull requests to avoid duplicate work.
- Open a feature request before starting a large feature, architecture change, new provider integration, or security-sensitive change.
- Report vulnerabilities privately through GitHub's **Report a vulnerability** option rather than a public issue.
- Keep Cline Chat Windows-only and dark-only unless a project decision explicitly changes those product requirements.
- Never commit credentials, Cline tokens, updater private keys, personal data, or real conversation history.

## Development workflow

1. Fork the repository.
2. Create a focused branch from the latest `main`, such as `fix/image-paste` or `feature/model-search`.
3. Install dependencies with `pnpm install`.
4. Make the smallest coherent change and add or update tests where practical.
5. Run the required checks:

   ```powershell
   pnpm check
   pnpm run audit
   ```

6. For desktop, sidecar, attachment, authentication, update, or Windows-integration changes, also run the relevant Windows app flow locally.
7. Open a pull request and complete the template.

## Pull request expectations

- Explain the user-visible problem and the chosen solution.
- Link the issue the pull request addresses when one exists.
- Include before-and-after screenshots for visual changes.
- Document any behavior, setup, dependency, or security changes.
- Keep unrelated formatting or refactors out of the pull request.
- Disclose meaningful AI assistance and confirm that you reviewed and tested the resulting code.

Pull requests must pass the Windows workflow, receive the code owner's approval, and resolve review conversations before merging. Approved changes are squash-merged to keep `main` readable.

## Project boundaries

- This is an independent, unofficial client and must not imply endorsement by Cline Bot Inc.
- Cline SDK and service behavior should be represented accurately and attributed appropriately.
- Autonomous SDK tool execution is outside the current chat-focused safety boundary.
- Changes involving authentication, credentials, local file access, updates, or executable processes require extra security review.

By contributing, you agree that your contribution is licensed under this repository's MIT License.
