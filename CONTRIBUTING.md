# Contributing to Pulse Assessment

## Development Setup

### Prerequisites
- Node.js 24+
- `dt-app` CLI v1.8+ (installed via `npm`)
- Access to a Dynatrace SaaS tenant

### Getting Started
```bash
npm install
npm run start   # Starts dev server with hot reload
```

## Development Workflow

### Local Development
```bash
npm run start
```
Opens in browser connected to the tenant configured in `app.config.json`.

### Build
```bash
npm run build
```

### Deploy
```bash
npm run deploy
```

### Switching Tenants
Update `environmentUrl` in `app.config.json`:
```json
"environmentUrl": "https://YOUR_TENANT.apps.dynatrace.com"
```

## Code Structure

| Directory | Purpose |
|---|---|
| `ui/app/queries.ts` | DQL criteria definitions — add/modify criteria here |
| `ui/app/data/criterionTiers.ts` | Tier classification (Foundation/Best Practice/Excellence) |
| `ui/app/data/criterionImportance.ts` | Importance descriptions per criterion |
| `ui/app/data/criterionRemediation.ts` | Remediation text per criterion |
| `ui/app/remediationActions.ts` | Remediation actions with doc URLs |
| `ui/app/hooks/useCoverageData.ts` | Query execution engine and scoring logic |
| `ui/app/hooks/useAssessmentHistory.ts` | Snapshot persistence (localStorage + Document Store) |
| `ui/app/pages/CoverageAssessment.tsx` | Main assessment page |
| `ui/app/pages/ComparisonPage.tsx` | Evolution Over Time page |

## Adding a New Criterion

1. **Define the DQL query** in `queries.ts` within the appropriate capability array:
   ```ts
   { id: 'x99', label: 'My new criterion (%)', query: 'fetch ... | summarize count()' }
   ```
   For ratio-based criteria, add `queryB` for the denominator.

2. **Add the tier** in `data/criterionTiers.ts`:
   ```ts
   x99: 'bestPractice',
   ```

3. **Add importance text** in `data/criterionImportance.ts`:
   ```ts
   x99: 'Explanation of why this criterion matters.',
   ```

4. **Add remediation text** in `data/criterionRemediation.ts`:
   ```ts
   x99: 'Steps to fix or improve this criterion.',
   ```

5. **Add remediation action** in `remediationActions.ts`:
   ```ts
   x99: { action: 'Enable feature X', docUrl: 'https://docs.dynatrace.com/...', docLabel: 'Feature X docs' },
   ```

6. **Test** by running `npm run start` and verifying the new criterion appears in the assessment.

## Coding Standards

- **TypeScript strict mode** — No `any` types where avoidable
- **React hooks** — All business logic in custom hooks under `hooks/`
- **Strato components** — Use Dynatrace Strato design system for UI
- **DQL queries** — Always include `| limit` or `| summarize` to bound result size
- **No external API calls** — All data comes from Dynatrace Grail via DQL

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new criterion for XYZ coverage
fix: correct DQL query for AI span coverage
docs: update scoring model documentation
refactor: extract chart rendering to component
```

## Versioning

Version is maintained in `app.config.json` under `"version"`. Bump on every release:
- **Patch** (x.y.Z): Bug fixes, query adjustments
- **Minor** (x.Y.0): New criteria, new features
- **Major** (X.0.0): Breaking changes to scoring model or data format
