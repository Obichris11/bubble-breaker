---
aliases:
  - "Plan 01: Skeleton & CI"
tags:
  - bubble-breaker/plan
status: ready
created: 2026-09-27
---
# Plan 01 — Skeleton & CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy app with an empty but fully tooled Angular 22 workspace (strict TS, lint, format, hooks, Vitest with coverage gates, app shell with design tokens and self-hosted font), guarded by GitHub Actions CI, in a public repo whose `main` branch is protected by a ruleset.

**Architecture:** Generate a fresh Angular 22 workspace (zoneless, standalone, Vitest) in a temp folder and copy it over the legacy files on branch `rewrite`. Tooling is configured so the dependency rule from ADR-0002 is lint-enforced before any layer code exists. CI mirrors the local `npm run check`.

**Tech Stack:** Angular 22.2, TypeScript 6.0, Vitest 5 (via `@angular/build:unit-test`), jsdom, ESLint 10 + angular-eslint 22 + typescript-eslint 8, Prettier 3, Husky 9, lint-staged, commitlint, GitHub Actions, CodeQL, Dependabot.

**Spec:** [2026-09-27-bubble-breaker-rewrite-design.md](../specs/2026-09-27-bubble-breaker-rewrite-design.md) · details in [03-architecture.md](../../03-architecture.md), [04-quality.md](../../04-quality.md), [05-cicd.md](../../05-cicd.md)

## Global Constraints

- Node **≥ 24.15** (Angular 22 requirement: `^22.22.3 || ^24.15.0 || >=26.0.0`); `.nvmrc` = `24`.
- TypeScript **6.0.x** (Angular 22 peer range `>=6.0 <6.1`). Do not install TS 7.
- Exactly one unit-test runner: Vitest. No Karma, no Jest.
- Runtime dependencies: Angular packages only. Everything else is a devDependency.
- English only; user-visible strings live in `src/app/strings.ts`.
- Coverage gates: `src/app/engine/**` ≥ 95 %, `src/app/state/**` ≥ 90 %, overall ≥ 80 %.
- Bundle budget: initial 150 kB warning / 200 kB error. Component styles: 4 kB warning / 8 kB error.
- Commits: Conventional Commits; commit email is the GitHub noreply address (already set globally).
- Repo: `github.com/Obichris11/bubble-breaker`. The legacy code is preserved at tag `v0-legacy`.
- Third-party GitHub Actions are pinned by commit SHA:
  - `actions/checkout` v7.0.1 = `3d3c42e5aac5ba805825da76410c181273ba90b1`
  - `actions/setup-node` v7.0.0 = `820762786026740c76f36085b0efc47a31fe5020`
  - `actions/upload-artifact` v7.0.1 = `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a`
  - `amannn/action-semantic-pull-request` v6.1.1 = `48f256284bd46cdaab1048c3721360e808335d50`
  - `github/codeql-action` v4.38.2 = `2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2`

## File Structure (end state of this plan)

```text
bubble-breaker/
  .github/
    workflows/ci.yml             quality + build jobs
    workflows/pr-title.yml       Conventional Commit PR title check
    workflows/codeql.yml         CodeQL (javascript-typescript, actions)
    dependabot.yml               npm + github-actions updates
    pull_request_template.md
  .husky/pre-commit | commit-msg | pre-push
  .nvmrc  .prettierrc.json  .prettierignore  .gitignore
  angular.json  package.json  package-lock.json
  tsconfig.json  tsconfig.app.json  tsconfig.spec.json
  eslint.config.mjs  commitlint.config.mjs  vitest-base.config.mts
  LICENSE  README.md  SECURITY.md  CONTRIBUTING.md
  public/favicon.ico
  src/
    index.html  main.ts
    styles/tokens.css            verbatim copy of docs/design/tokens.css
    styles/base.css              @font-face, page background, box-sizing
    app/
      app.ts  app.html  app.css  app.spec.ts
      app.config.ts  app.routes.ts
      strings.ts
  docs/ …                        unchanged planning docs
```

Removed legacy files: `src/**` (old app), `Dockerfile`, `docker-compose.yml`, `nginx.conf`, `DEPLOYMENT.md`, `jest.config.js`, `.eslintrc.json`, `.prettierrc`, `ngsw-config.json`, `public/manifest.webmanifest`, `public/favicon-*.png`, `.claude/settings.local.json` (untracked + ignored). They come back in a new form in later plans. The old versions stay reachable via tag `v0-legacy`.

---

### Task 0: Local prerequisites (user action)

**Files:** none

- [ ] **Step 1: Upgrade Node to 24 LTS ≥ 24.15**

```bash
brew install node@24
```

Or with nvm: `nvm install 24 && nvm alias default 24`.

- [ ] **Step 2: Upgrade git**

```bash
brew install git
```

Open a new terminal afterwards so the Homebrew git comes first on `PATH`.

- [ ] **Step 3: Verify**

Run: `node -v && git --version && git config user.email`
Expected: `v24.15.0` or higher; `git version 2.5x` or higher; `64216949+Obichris11@users.noreply.github.com`.

---

### Task 1: Replace legacy files with a fresh Angular 22 workspace

**Files:**
- Delete: legacy files listed under "File Structure"
- Create: the generated workspace files (`angular.json`, `package.json`, `tsconfig*.json`, `src/**`, `public/favicon.ico`, `.editorconfig`, `.vscode/*`)
- Modify: `.gitignore`

**Interfaces:**
- Produces: npm scripts `start`, `build`, `test` (as generated); the `ng test` target using `@angular/build:unit-test` with the Vitest runner.

- [ ] **Step 1: Generate the workspace in a temp folder**

```bash
cd "$TMPDIR" && rm -rf bb-new
npx -y @angular/cli@22.2 new bubble-breaker --directory bb-new \
  --style=css --routing --ssr=false --zoneless --test-runner=vitest \
  --skip-git --skip-install --package-manager=npm --interactive=false
ls bb-new
```

Expected: `angular.json package.json src public tsconfig.json tsconfig.app.json tsconfig.spec.json README.md .editorconfig .gitignore .vscode`, possibly plus AI-config files. If an AI-config file such as `.claude/CLAUDE.md` or `AGENTS.md` was generated, delete it from `bb-new`. Project guidance lives in `docs/`.

- [ ] **Step 2: Remove the legacy files from the repo**

```bash
cd ~/Projects/claude_kot/bubble-breaker
git checkout rewrite
git rm -r -q src public Dockerfile docker-compose.yml nginx.conf DEPLOYMENT.md jest.config.js \
  .eslintrc.json .prettierrc ngsw-config.json angular.json package.json package-lock.json \
  tsconfig.json tsconfig.app.json tsconfig.spec.json README.md .vscode .editorconfig
git rm -q --cached .claude/settings.local.json
rm -rf node_modules dist coverage .angular
git status --short | head
```

Expected: only `D` lines. `docs/` and `.gitignore` are untouched.

- [ ] **Step 3: Copy the generated workspace in**

```bash
rsync -a --exclude .gitignore "$TMPDIR/bb-new/" ./
cat "$TMPDIR/bb-new/.gitignore" > .gitignore
printf '\n# Local tooling\n.claude/\n\n# Obsidian\n.obsidian/\n.trash/\n' >> .gitignore
```

This replaces `.gitignore` with the Angular one plus the local tooling and Obsidian entries (the old Obsidian lines are re-added here).

- [ ] **Step 4: Install and run the generated checks**

```bash
npm install
npm run build
npx ng test --watch=false
```

Expected: the build succeeds and writes `dist/bubble-breaker/browser`. Tests: 1 file with 2 tests passing (the generated `app.spec.ts`). If the test builder complains that no DOM environment is installed, run `npm i -D jsdom` and re-run.

- [ ] **Step 5: Confirm zoneless and no zone.js**

Run: `grep -rn "zone" src/app/app.config.ts package.json angular.json`
Expected: no `zone.js` dependency and no `provideZoneChangeDetection`. `app.config.ts` contains only `provideBrowserGlobalErrorListeners()` and `provideRouter(routes)`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: replace legacy app with fresh Angular 22 workspace"
```

---

### Task 2: Pin Node, tighten TypeScript and Angular compiler

**Files:**
- Create: `.nvmrc`
- Modify: `package.json` (add `engines`), `tsconfig.json`

**Interfaces:**
- Produces: the strict compiler settings every later plan relies on (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).

- [ ] **Step 1: Add `.nvmrc` and `engines`**

```bash
echo "24" > .nvmrc
npm pkg set engines.node=">=24.15.0" engines.npm=">=11"
```

- [ ] **Step 2: Verify the TypeScript version**

Run: `npx tsc -v`
Expected: `Version 6.0.x`. If it is 7.x, run `npm i -D typescript@~6.0.0`.

- [ ] **Step 3: Extend `tsconfig.json`**

In `compilerOptions`, keep all generated keys and make sure these are present with these values:

```json
"strict": true,
"noImplicitOverride": true,
"noPropertyAccessFromIndexSignature": true,
"noImplicitReturns": true,
"noFallthroughCasesInSwitch": true,
"noUncheckedIndexedAccess": true,
"exactOptionalPropertyTypes": true,
"forceConsistentCasingInFileNames": true
```

In `angularCompilerOptions`:

```json
"enableI18nLegacyMessageIdFormat": false,
"strictInjectionParameters": true,
"strictInputAccessModifiers": true,
"strictTemplates": true,
"extendedDiagnostics": { "defaultCategory": "error" }
```

- [ ] **Step 4: Verify that build and tests still pass**

Run: `npm run build && npx ng test --watch=false`
Expected: both succeed. If the generated `app.spec.ts` fails under `noUncheckedIndexedAccess`, fix it with optional chaining (`compiled.querySelector('h1')?.textContent`).

- [ ] **Step 5: Commit**

```bash
git add .nvmrc package.json package-lock.json tsconfig.json src
git commit -m "build: pin node 24 and enable strictest compiler options"
```

---

### Task 3: Prettier and ESLint with the layer dependency rule

**Files:**
- Create: `.prettierrc.json`, `.prettierignore`, `eslint.config.mjs`
- Modify: `package.json` (scripts, devDependencies), `angular.json` (lint target added by `ng add`)

**Interfaces:**
- Produces: `npm run lint`, `npm run format`, `npm run format:check`, `npm run typecheck`.
- Produces the layer rule (ADR-0002), enforced from now on:

| Files in | May not import |
|---|---|
| `src/app/engine/**` | `@angular/*`, `rxjs`, or anything under `state`, `platform`, `ui` |
| `src/app/platform/**` | `state`, `ui` |
| `src/app/state/**` | `ui` |
| `src/app/ui/**` | `platform`; `engine` for types only |

- [ ] **Step 1: Install tooling**

```bash
npx ng add angular-eslint@22 --skip-confirmation
npm i -D prettier@^3 eslint-config-prettier@^10 typescript-eslint@^8 @eslint/js
```

`ng add` creates an `eslint.config.js` and a `lint` target. The next step replaces the config.

- [ ] **Step 2: Write `eslint.config.mjs`, delete the generated `eslint.config.js`**

```bash
rm -f eslint.config.js
```

```js
// eslint.config.mjs
// @ts-check
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import prettier from 'eslint-config-prettier/flat';

const layer = (forbidden, message) => ({
  '@typescript-eslint/no-restricted-imports': [
    'error',
    { patterns: forbidden.map((regex) => ({ regex, message, allowTypeImports: false })) },
  ],
});

export default defineConfig(
  { ignores: ['dist/', 'coverage/', '.angular/', 'docs/', 'node_modules/'] },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      angular.configs.tsRecommended,
      prettier,
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'bb', style: 'kebab-case' },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'bb', style: 'camelCase' },
      ],
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-exports': ['error', { restrictDefaultExports: { direct: true } }],
    },
  },
  {
    files: ['**/*.spec.ts', '**/testing/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    files: ['src/app/engine/**/*.ts'],
    rules: layer(
      ['^@angular/', '^rxjs', '(^|/)(state|platform|ui)(/|$)'],
      'engine is pure TypeScript: no Angular, RxJS, state, platform or ui imports (ADR-0002).',
    ),
  },
  {
    files: ['src/app/platform/**/*.ts'],
    rules: layer(['(^|/)(state|ui)(/|$)'], 'platform must not import state or ui (ADR-0002).'),
  },
  {
    files: ['src/app/state/**/*.ts'],
    rules: layer(['(^|/)ui(/|$)'], 'state must not import ui (ADR-0002).'),
  },
  {
    files: ['src/app/ui/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            { regex: '(^|/)platform(/|$)', message: 'ui must not import platform (ADR-0002).' },
            {
              regex: '(^|/)engine(/|$)',
              message: 'ui may import engine types only (ADR-0002).',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
  },
);
```

`eslint.config.mjs` itself is not linted as TypeScript (only `**/*.ts` and `**/*.html` are matched).

- [ ] **Step 3: Rename the root selector prefix to `bb`**

In `angular.json` set `projects.bubble-breaker.prefix` to `"bb"`. In `src/app/app.ts` change `selector: 'app-root'` to `selector: 'bb-root'`, and in `src/index.html` change `<app-root></app-root>` to `<bb-root></bb-root>`. Also add `changeDetection: ChangeDetectionStrategy.OnPush` to the `@Component` in `app.ts`, and import `ChangeDetectionStrategy` from `@angular/core`.

- [ ] **Step 4: Write the Prettier config**

`.prettierrc.json`:

```json
{
  "singleQuote": true,
  "printWidth": 100,
  "overrides": [{ "files": "*.html", "options": { "parser": "angular" } }]
}
```

`.prettierignore`:

```text
dist/
coverage/
.angular/
docs/
package-lock.json
```

If `package.json` contains a generated `"prettier"` block, remove it: `npm pkg delete prettier`.

- [ ] **Step 5: Add scripts**

```bash
npm pkg set scripts.lint="eslint ." \
  scripts.format="prettier --write ." \
  scripts.format:check="prettier --check ." \
  scripts.typecheck="tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.spec.json --noEmit"
```

- [ ] **Step 6: Format and lint everything**

Run: `npm run format && npm run lint && npm run typecheck`
Expected: exits 0. Fix any reported issue in the generated files (typically an OnPush or selector-prefix complaint).

- [ ] **Step 7: Prove the layer rule works (probe, not committed)**

```bash
mkdir -p src/app/engine
printf "import { signal } from '@angular/core';\nexport const probe = signal(1);\n" > src/app/engine/lint-probe.ts
npx eslint src/app/engine/lint-probe.ts; echo "exit=$?"
rm -r src/app/engine
```

Expected: an error from `@typescript-eslint/no-restricted-imports` with the message "engine is pure TypeScript…" and `exit=1`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "build: add eslint with layer rules and prettier"
```

---

### Task 4: Vitest configuration with per-layer coverage gates

**Files:**
- Create: `vitest-base.config.mts`, `src/test-setup.ts`
- Modify: `angular.json` (test target options), `package.json` (scripts, devDependencies)

**Interfaces:**
- Produces: `npm test` (single run), `npm run test:watch`, `npm run test:ci` (with coverage + thresholds). Plans 02 and 03 rely on the per-folder thresholds.
- Produces devDependencies for later plans: `fast-check`, `@testing-library/angular`, `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom` (DOM matchers such as `toHaveTextContent`, registered globally), `@vitest/coverage-v8`, `jsdom`.

- [ ] **Step 1: Install test tooling**

```bash
npm i -D @vitest/coverage-v8 jsdom fast-check@^4 @testing-library/angular@^19 @testing-library/dom@^10 @testing-library/user-event@^14 @testing-library/jest-dom@^6
```

Create `src/test-setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 2: Write `vitest-base.config.mts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov'],
      include: ['src/app/**/*.ts'],
      exclude: [
        'src/app/**/*.spec.ts',
        'src/app/**/testing/**',
        'src/test-setup.ts',
        'src/app/app.config.ts',
        'src/app/app.routes.ts',
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
        'src/app/engine/**': { lines: 95, statements: 95, functions: 95, branches: 95 },
        'src/app/state/**': { lines: 90, statements: 90, functions: 90, branches: 90 },
      },
    },
  },
});
```

- [ ] **Step 3: Point the Angular test target at it**

In `angular.json` → `projects.bubble-breaker.architect.test.options` add:

```json
"runnerConfig": "vitest-base.config.mts",
"setupFiles": ["src/test-setup.ts"]
```

- [ ] **Step 4: Add scripts**

```bash
npm pkg set scripts.test="ng test --watch=false" \
  scripts.test:watch="ng test" \
  scripts.test:ci="ng test --watch=false --coverage" \
  scripts.check="npm run lint && npm run format:check && npm run typecheck && npm test"
```

- [ ] **Step 5: Run with coverage**

Run: `npm run test:ci`
Expected: tests pass, a coverage summary prints, and `coverage/` is created (already in `.gitignore` from the Angular template; if not, add `/coverage`).

- [ ] **Step 6: Prove the thresholds are enforced (probe, not committed)**

```bash
mkdir -p src/app/engine
printf "export function untested(a: number): number {\n  return a > 1 ? a : -a;\n}\n" > src/app/engine/coverage-probe.ts
npm run test:ci; echo "exit=$?"
rm -r src/app/engine
```

Expected: a threshold failure for `src/app/engine/**` (0 % < 95 %) and a non-zero `exit=`.
- **If it passes anyway,** the builder ignored the runner config's coverage block. In that case add to `angular.json` test options: `"coverage": true`, `"coverageInclude": ["src/app/**/*.ts"]` and `"coverageThresholds": { "lines": 80, "statements": 80, "functions": 80, "branches": 80 }`. Then add a CI step in Task 7 that runs `npx vitest run --config vitest-base.config.mts --coverage` limited to `src/app/engine` and `src/app/state`.
- **Document** whichever mechanism worked in `docs/04-quality.md` (Gates section) as part of this commit.

- [ ] **Step 7: Run the full local check**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "test: configure vitest with jsdom and per-layer coverage gates"
```

---

### Task 5: App shell with design tokens, self-hosted font and central strings

**Files:**
- Create: `src/styles/tokens.css` (verbatim copy), `src/styles/base.css`, `src/app/strings.ts`
- Modify: `angular.json` (styles, assets), `src/index.html`, `src/app/app.ts`, `src/app/app.html`, `src/app/app.css`, `src/app/app.spec.ts`
- Delete: `src/styles.css`

**Interfaces:**
- Produces: `STRINGS` constant (`src/app/strings.ts`) that every UI plan extends; CSS custom properties `--bb-*` available globally; font files served at `/fonts/noto-sans-latin-{400,700}-normal.woff2`.

- [ ] **Step 1: Write the failing test**

Replace `src/app/app.spec.ts` with:

```ts
import { render, screen } from '@testing-library/angular';
import { App } from './app';
import { STRINGS } from './strings';

describe('App shell', () => {
  it('shows the app title in the title bar', async () => {
    await render(App);
    expect(screen.getByRole('banner')).toHaveTextContent(STRINGS.appTitle);
  });

  it('uses "Bubble Breaker" as the app title', () => {
    expect(STRINGS.appTitle).toBe('Bubble Breaker');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL. `./strings` cannot be resolved.

- [ ] **Step 3: Create `src/app/strings.ts`**

```ts
/** All user-visible copy (ADR-0008). Components never hard-code text. */
export const STRINGS = {
  appTitle: 'Bubble Breaker',
} as const;
```

- [ ] **Step 4: Replace the generated root component**

`src/app/app.ts`:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { STRINGS } from './strings';

@Component({
  selector: 'bb-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly strings = STRINGS;
}
```

`src/app/app.html`:

```html
<div class="app-window">
  <header class="title-bar">{{ strings.appTitle }}</header>
  <main class="content"><router-outlet /></main>
</div>
```

`src/app/app.css`:

```css
:host {
  display: block;
  height: 100dvh;
}
.app-window {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bb-face);
}
.title-bar {
  height: var(--bb-titlebar-h);
  display: flex;
  align-items: center;
  padding: 0 var(--bb-space-4);
  background: linear-gradient(90deg, var(--bb-title-from), var(--bb-title-to));
  color: var(--bb-title-text);
  font: 700 var(--bb-fs-m) / 1 var(--bb-font);
}
.content {
  flex: 1;
  background: var(--bb-board-bg);
}
```

This is a placeholder shell. Plan 05 replaces it with the real chrome components.

- [ ] **Step 5: Add global styles and the font**

```bash
mkdir -p src/styles
cp docs/design/tokens.css src/styles/tokens.css
rm src/styles.css
npm i -D @fontsource/noto-sans@^5
```

`src/styles/base.css`:

```css
@font-face {
  font-family: 'Noto Sans';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/noto-sans-latin-400-normal.woff2') format('woff2');
}
@font-face {
  font-family: 'Noto Sans';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('/fonts/noto-sans-latin-700-normal.woff2') format('woff2');
}
*,
*::before,
*::after {
  box-sizing: border-box;
}
html,
body {
  margin: 0;
  height: 100%;
  font-family: var(--bb-font);
  font-size: var(--bb-fs-m);
  color: var(--bb-text);
  background: var(--bb-face);
  -webkit-text-size-adjust: 100%;
}
@media (pointer: fine) {
  body {
    background: var(--bb-desktop);
  }
}
```

In `angular.json` → `projects.bubble-breaker.architect.build.options`:

```json
"styles": ["src/styles/tokens.css", "src/styles/base.css"],
"assets": [
  { "glob": "**/*", "input": "public" },
  {
    "glob": "noto-sans-latin-{400,700}-normal.woff2",
    "input": "node_modules/@fontsource/noto-sans/files",
    "output": "fonts"
  }
]
```

Also add `"styles": ["src/styles/tokens.css", "src/styles/base.css"]` to the `test` target options if the test target has its own `styles` entry.

- [ ] **Step 6: Update `src/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Bubble Breaker</title>
    <base href="/" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0A246A" />
    <meta name="description" content="A tribute to the classic pocket-computer puzzle game." />
    <link rel="icon" type="image/x-icon" href="favicon.ico" />
  </head>
  <body>
    <bb-root></bb-root>
  </body>
</html>
```

Restore the legacy favicon: `git show v0-legacy:public/favicon.ico > public/favicon.ico`.

- [ ] **Step 7: Run tests and build**

Run: `npm test && npm run build && ls dist/bubble-breaker/browser/fonts`
Expected: tests pass; the build succeeds within budgets; the listing shows `noto-sans-latin-400-normal.woff2  noto-sans-latin-700-normal.woff2`.

- [ ] **Step 8: Visual smoke check**

Run: `npm start`, open `http://localhost:4200`.
Expected: a navy gradient title bar reading "Bubble Breaker" in Noto Sans, a white content area, and no console errors. Stop the server.

- [ ] **Step 9: Commit**

```bash
npm run format
git add -A
git commit -m "feat: add app shell with design tokens, self-hosted font and strings"
```

---

### Task 6: Git hooks and commit message linting

**Files:**
- Create: `.husky/pre-commit`, `.husky/commit-msg`, `.husky/pre-push`, `commitlint.config.mjs`
- Modify: `package.json` (`prepare` script, `lint-staged` block, devDependencies)

**Interfaces:**
- Produces: local enforcement of lint/format on commit, Conventional Commit messages, and unit tests on push.

- [ ] **Step 1: Install**

```bash
npm i -D husky@^9 lint-staged @commitlint/cli @commitlint/config-conventional
npx husky init
```

- [ ] **Step 2: Write the hooks**

```bash
echo "npx lint-staged" > .husky/pre-commit
echo 'npx --no -- commitlint --edit "$1"' > .husky/commit-msg
echo "npm test" > .husky/pre-push
```

`commitlint.config.mjs`:

```js
export default { extends: ['@commitlint/config-conventional'] };
```

- [ ] **Step 3: Configure lint-staged**

```bash
npm pkg set 'lint-staged[*.ts][0]=eslint --fix' 'lint-staged[*.ts][1]=prettier --write' \
  'lint-staged[*.{html,css,json,yml,yaml}][0]=prettier --write'
```

- [ ] **Step 4: Verify that a bad commit message is rejected**

```bash
git add -A
git commit -m "added hooks"; echo "exit=$?"
```

Expected: commitlint errors (`subject may not be empty`, `type may not be empty`) and a non-zero `exit=`.

- [ ] **Step 5: Commit properly**

```bash
git commit -m "build: add husky hooks, lint-staged and commitlint"
```

Expected: the pre-commit hook runs lint-staged and the commit succeeds.

---

### Task 7: GitHub Actions CI, CodeQL, PR title check, Dependabot

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/pr-title.yml`, `.github/workflows/codeql.yml`, `.github/dependabot.yml`

**Interfaces:**
- Produces check names used by the ruleset in Task 8: `quality`, `build`, `pr-title`, `Analyze (javascript-typescript)`, `Analyze (actions)`.
- Produces artifact `dist` (uploaded by `build`), consumed by later plans' `e2e`, `lighthouse` and `docker` jobs.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main, rewrite]

permissions: {}

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    name: quality
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check
      - run: npm run typecheck
      - run: npm run test:ci
      - uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        if: always()
        with:
          name: coverage
          path: coverage/
          retention-days: 14

  build:
    name: build
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: dist
          path: dist/bubble-breaker/browser/
          retention-days: 7
```

Husky's `prepare` script is a no-op in CI when `.git` hooks can't be installed, so no change is needed. If `npm ci` fails on `husky`, set `HUSKY: 0` as a job `env`.

- [ ] **Step 2: Write `.github/workflows/pr-title.yml`**

```yaml
name: PR title

on:
  pull_request:
    types: [opened, edited, synchronize, reopened]

permissions: {}

jobs:
  pr-title:
    name: pr-title
    runs-on: ubuntu-latest
    permissions:
      pull-requests: read
    steps:
      - uses: amannn/action-semantic-pull-request@48f256284bd46cdaab1048c3721360e808335d50 # v6.1.1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 3: Write `.github/workflows/codeql.yml`**

```yaml
name: CodeQL

on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - cron: '23 4 * * 1'

permissions: {}

jobs:
  analyze:
    name: Analyze (${{ matrix.language }})
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    strategy:
      fail-fast: false
      matrix:
        language: [javascript-typescript, actions]
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: github/codeql-action/init@2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2 # v4.38.2
        with:
          languages: ${{ matrix.language }}
          build-mode: none
      - uses: github/codeql-action/analyze@2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2 # v4.38.2
        with:
          category: /language:${{ matrix.language }}
```

- [ ] **Step 4: Write `.github/dependabot.yml`**

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 10
    commit-message:
      prefix: chore
      include: scope
    groups:
      angular:
        patterns: ['@angular/*', '@angular-devkit/*', '@schematics/*', 'angular-eslint']
      test-tooling:
        patterns:
          ['vitest', '@vitest/*', 'jsdom', 'fast-check', '@testing-library/*', '@playwright/*']
      lint-format:
        patterns:
          [
            'eslint',
            '@eslint/*',
            'typescript-eslint',
            'eslint-config-prettier',
            'prettier',
            '@commitlint/*',
            'husky',
            'lint-staged',
          ]
    ignore:
      - dependency-name: '@angular/*'
        update-types: ['version-update:semver-major']
      - dependency-name: '@angular-devkit/*'
        update-types: ['version-update:semver-major']
      - dependency-name: 'typescript'
        update-types: ['version-update:semver-major', 'version-update:semver-minor']

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    commit-message:
      prefix: ci
    groups:
      actions:
        patterns: ['*']
```

TypeScript minor updates are ignored because Angular 22 pins TypeScript to `>=6.0 <6.1`. They arrive with `ng update`.

- [ ] **Step 5: Validate the YAML locally**

Run: `npx prettier --check .github`
Expected: all files pass. Fix formatting with `npx prettier --write .github` if needed.

- [ ] **Step 6: Commit and push**

```bash
git add .github
git commit -m "ci: add ci, codeql, pr-title workflows and dependabot"
git push
```

- [ ] **Step 7: Verify CI on GitHub**

Run: `gh run list --branch rewrite --limit 3` and then `gh run watch` for the CI run.
Expected: workflow `CI` succeeds with jobs `quality` and `build` green. CodeQL does not run on `rewrite`; it runs from the first PR onward.

---

### Task 8: Repository governance: public repo, `main`, ruleset

**Files:**
- Create: `LICENSE`, `README.md`, `SECURITY.md`, `CONTRIBUTING.md`, `.github/pull_request_template.md`

**Interfaces:**
- Produces: default branch `main`, protected by ruleset "main". All later plans merge into `main` via PR.

> [!WARNING]
> Steps 3–7 change the public GitHub repository: visibility, default branch, deletion of `master`, and rules. **Ask the user for explicit confirmation before each of those steps.**

- [ ] **Step 1: Write the repository files**

`LICENSE`: the standard MIT license text with the line `Copyright (c) 2026 Christopher John`.

`README.md`:

```markdown
# Bubble Breaker

A tribute to the pocket-computer puzzle classic Jawbreaker / Bubble Breaker, rebuilt as an installable, offline web app.

> Status: rewrite in progress (v2). Legacy version: tag `v0-legacy`.

## Rules in one breath

Tap a group of two or more touching balls of the same color to highlight it, tap again to burst it. Points = n × (n − 1). Balls fall down, empty columns close up to the right. The game ends when no two touching balls share a color.

## Development

Requires Node ≥ 24.15 (see `.nvmrc`).

    npm ci
    npm start          # dev server on http://localhost:4200
    npm run check      # lint, format check, typecheck, unit tests
    npm run test:ci    # unit tests with coverage gates

## Docs

Planning, rules, UX, architecture and decisions live in [`docs/`](docs/README.md).

## License

MIT. Not affiliated with any original publisher.
```

`SECURITY.md`:

```markdown
# Security Policy

Please report vulnerabilities privately via GitHub: **Security → Report a vulnerability** on this repository. Do not open public issues for security problems. You can expect a first response within 7 days.
```

`CONTRIBUTING.md`:

```markdown
# Contributing

- Branch from `main`, open a PR. PR titles follow Conventional Commits (`feat: …`, `fix: …`).
- `npm run check` must pass locally; CI enforces the same gates plus coverage.
- Definition of Done: see [docs/04-quality.md](docs/04-quality.md#definition-of-done-per-pr).
- New runtime dependencies need an ADR in [docs/adr](docs/adr/README.md).
```

`.github/pull_request_template.md`:

```markdown
## What

## Why

## Checklist

- [ ] Behavior matches docs/01-rules and docs/02-ux (or docs updated / ADR added)
- [ ] Tests at the lowest level that proves the behavior
- [ ] Keyboard + screen-reader path checked for UI changes
- [ ] No new runtime dependency without an ADR
```

Commit and push:

```bash
npx prettier --write README.md SECURITY.md CONTRIBUTING.md .github/pull_request_template.md
git add LICENSE README.md SECURITY.md CONTRIBUTING.md .github/pull_request_template.md
git commit -m "docs: add readme, license, security policy and contributing guide"
git push
```

- [ ] **Step 2: Wait for CI to be green on `rewrite`**

Run: `gh run watch $(gh run list --branch rewrite --limit 1 --json databaseId -q '.[0].databaseId')`
Expected: success.

- [ ] **Step 3: Make the repository public (confirm first)**

```bash
gh repo edit Obichris11/bubble-breaker --visibility public --accept-visibility-change-consequences
```

Expected: `gh repo view Obichris11/bubble-breaker --json visibility -q .visibility` prints `PUBLIC`.

- [ ] **Step 4: Repo merge settings and security features (confirm first)**

```bash
gh api -X PATCH repos/Obichris11/bubble-breaker \
  -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true -f squash_merge_commit_title=PR_TITLE \
  -f squash_merge_commit_message=PR_BODY \
  -f 'security_and_analysis[secret_scanning][status]=enabled' \
  -f 'security_and_analysis[secret_scanning_push_protection][status]=enabled'
gh api -X PUT repos/Obichris11/bubble-breaker/vulnerability-alerts
gh api -X PUT repos/Obichris11/bubble-breaker/automated-security-fixes
gh api -X PUT repos/Obichris11/bubble-breaker/private-vulnerability-reporting
```

Expected: each command exits 0.

- [ ] **Step 5: Create `main` and make it the default (confirm first)**

```bash
git push origin rewrite:main
gh repo edit Obichris11/bubble-breaker --default-branch main
```

Expected: `gh repo view --json defaultBranchRef -q .defaultBranchRef.name` prints `main`.

- [ ] **Step 6: Delete `master` (confirm first; legacy remains at tag `v0-legacy`)**

```bash
git ls-remote --tags origin v0-legacy
git push origin --delete master
git branch -D master
```

Expected: the tag line prints before the deletion; the deletion succeeds.

- [ ] **Step 7: Create the ruleset on `main` (confirm first)**

Write `$TMPDIR/ruleset.json`:

```json
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [{ "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" }],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "required_linear_history" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["squash"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "quality" },
          { "context": "build" },
          { "context": "pr-title" },
          { "context": "Analyze (javascript-typescript)" },
          { "context": "Analyze (actions)" }
        ]
      }
    }
  ]
}
```

```bash
gh api -X POST repos/Obichris11/bubble-breaker/rulesets --input "$TMPDIR/ruleset.json"
```

Expected: JSON response with `"enforcement": "active"`. Actor id 5 is the repository Admin role (emergency bypass, per 05).

- [ ] **Step 8: Prove the ruleset with a tiny PR**

```bash
git checkout main && git pull
git checkout -b chore/verify-ruleset
printf '\n' >> CONTRIBUTING.md
git commit -am "chore: verify branch ruleset"
git push -u origin chore/verify-ruleset
gh pr create --fill --title "chore: verify branch ruleset"
gh pr checks --watch
```

Expected: `quality`, `build`, `pr-title`, `Analyze (javascript-typescript)` and `Analyze (actions)` all run and pass, and the PR shows as mergeable with squash only. Merge it with `gh pr merge --squash --delete-branch`. Then run `git checkout main && git pull && git branch -D rewrite`, and delete the remote branch: `git push origin --delete rewrite`.

- [ ] **Step 9: Update the roadmap**

In `docs/superpowers/plans/2026-09-27-00-roadmap.md`, set Plan 01's status to `done`. Commit that on a branch `docs/plan-01-done` and merge it by PR.

---

## Done when

- `npm run check` and `npm run test:ci` pass locally on Node ≥ 24.15.
- On GitHub: the repo is public, `main` is the default branch, `master` is gone, and tag `v0-legacy` exists.
- Ruleset "main" is active, and a PR shows the 5 required checks green before merge.
- The app shell renders the title bar in Noto Sans with the design tokens; the build is within budget.
