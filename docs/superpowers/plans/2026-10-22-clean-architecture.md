# Clean Architecture Refactor

Goal: preserve scanning, history and exports while separating authentication, persistence, domain analysis, HTTP, shared contracts and tests. The requested invalid-session 401/login behavior is the explicit exception to behavior preservation.

- [x] Move implementation by responsibility; move tests to tests/unit and styles to client/styles. Keep server/index.ts as the entrypoint.
- [x] Extract user entity, repository port/adapter, password hasher, authentication service, token service, cookie adapter, auth middleware and credential schemas.
- [x] Use a typed object cache and explicit passwordHash: string | null; repository never receives plaintext passwords.
- [x] Add a provider registry and assessment service, separating provider adapters from application orchestration.
- [x] Extract scanning service from HTTP handlers; isolate pure utilities and shared/public types.
- [x] Return 401 for an invalid supplied credential; handle login navigation in the client, not the repository.
- [x] Replace complex draw.io diagrams with focused Mermaid architecture and sequence diagrams; update documentation.
- [x] Run unit/integration tests, TypeScript, production build and lint; preserve unrelated thesis and gitignore edits.

Baseline: 205 tests / 40 files pass. Work is isolated on codex/clean-architecture. Browser rendering remains unavailable under the previously recorded browser permission policy.
