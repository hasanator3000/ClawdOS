-- Migration 009: Task duration support
-- Adds start_date and start_time columns for duration-based tasks

begin;

alter table core.task
  add column if not exists start_date date,
  add column if not exists start_time time;

create index if not exists task_start_date_idx
  on core.task (workspace_id, start_date)
  where start_date is not null;

commit;
