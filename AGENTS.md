# Agent Operations Guide

## Build Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

## Validation Commands

```bash
# Type checking
npx tsc --noEmit

# Linting
npm run lint

# Build check (must pass before commit)
npm run build
```

## Database Commands

```bash
# Start database
./scripts/db-up.sh

# Stop database
./scripts/db-down.sh

# Run migrations
node scripts/migrate.mjs

# Create user
node scripts/create-user.mjs <username> <password>

# Bootstrap workspaces
node scripts/bootstrap-workspaces.mjs
```

## Git Workflow

After each successful task:
```bash
git add -A
git commit -m "feat(phase-X): description"
git push
```

Commit message format:
- `feat(phase-X): add feature` - new functionality
- `fix(phase-X): fix bug` - bug fix
- `refactor(phase-X): improve code` - code improvement
- `docs(phase-X): update docs` - documentation

## Project Structure

```
src/
├── app/           # Next.js pages and API routes
├── components/    # React components
├── lib/           # Services and utilities
├── types/         # TypeScript types
└── schemas/       # Zod validation schemas

db/
├── migrations/    # SQL migrations
├── functions/     # PostgreSQL functions
└── schema/        # Schema definitions
```

## Key Files

- `src/app/(app)/layout.tsx` - Main app layout
- `src/components/layout/Sidebar.tsx` - Navigation
- `src/lib/db/index.ts` - Database connection
- `src/lib/auth/session.ts` - Session management
