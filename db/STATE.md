# STATE (ClawdOS)

## Current DB state (2026-02-03)
- Live tables exist in `public`: app_user, workspace, workspace_member, digest, news_item
- RLS enabled on workspace/workspace_member/digest/news_item
- Local auth uses session var `app.user_id` via `public.app_current_user_id()`.

## Migration plan to scalable namespaces
- [x] Step 1: Add module skeletons + schema_registry.yaml
- [x] Step 2: Document current schema in db/schema/*/schema.yaml
- [ ] Step 3: Create migrations for namespace schemas + schema_migration (files only)
- [ ] Step 4: (manual approval) Apply 0001 + 0002 migrations to move tables into core/content
- [ ] Step 5: Update app queries to use core/content schema names

## Next action
Review the migrations:
- db/schema/core/migrations/0001_core_namespaces.sql
- db/schema/core/migrations/0002_move_public_to_namespaces.sql

Then decide when to apply (requires backup).
