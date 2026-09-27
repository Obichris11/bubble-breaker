---
aliases:
  - Planning index
  - Bubble Breaker docs
tags:
  - bubble-breaker/index
  - bubble-breaker/planning
created: 2026-09-27
---
# Bubble Breaker — Planning Docs

Ground-up rewrite of Bubble Breaker, planned in theory before any code. Each phase produced one document, reviewed and approved in order.

> [!TIP]
> Start with the [design spec](superpowers/specs/2026-09-27-bubble-breaker-rewrite-design.md): scope, key decisions, traceability and milestones on one page.

| Phase | Document | Status |
|---|---|---|
| 0 | [Legacy inventory](00-legacy-inventory.md) | accepted |
| 1 | [Ruleset](01-rules.md) | accepted |
| 2 | [UX & visual design](02-ux.md) · [design handoff](design/README.md) | accepted |
| 3 | [Architecture](03-architecture.md) · [ADRs](adr/README.md) | accepted |
| 4 | [Quality strategy](04-quality.md) | accepted |
| 5 | [CI/CD & repo governance](05-cicd.md) | accepted |
| 6 | [Deployment & operations](06-deployment.md) | accepted |
| 7 | [Design spec](superpowers/specs/2026-09-27-bubble-breaker-rewrite-design.md) | in review |

## Using these docs in Obsidian

- Open `docs/` (or the repo root) as a vault. `.obsidian/` is git-ignored.
- Links are standard Markdown relative links so they work on GitHub and in Obsidian (set *Files & Links → New link format* to *Relative path to file* and turn off *Use [[Wikilinks]]* to keep new links GitHub-compatible).
- Every note has `aliases`, `tags` (`bubble-breaker/*`) and `status` properties for search, graph and Bases/Dataview queries.
- Diagrams are Mermaid, and callouts use `> [!NOTE]`-style syntax; both render in Obsidian and on GitHub.
- The iCloud vault `ChrisVault/Bubble Breaker/` holds a one-way copy (repo = source of truth). Refresh it after doc changes:

```bash
rsync -a --exclude '.DS_Store' ~/Projects/claude_kot/bubble-breaker/docs/ ~/Library/Mobile\ Documents/iCloud~md~obsidian/Documents/ChrisVault/Bubble\ Breaker/
```
