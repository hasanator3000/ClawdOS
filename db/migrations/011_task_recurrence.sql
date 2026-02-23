-- Phase 10: Recurring Tasks
-- Add recurrence_rule JSONB column to task table
-- Rule format: { "type": "daily"|"weekly"|"monthly"|"custom", "interval": 1, "weekdays": [1,3,5] }

alter table core.task
  add column recurrence_rule jsonb default null;

comment on column core.task.recurrence_rule is
  'Repeat pattern: {type, interval, weekdays?}. NULL = no recurrence.';
