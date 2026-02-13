-- Performance indexes for news feed

-- Tab filtering: news_source_tab lookups by tab_id (PK is source_id, tab_id — need reverse)
CREATE INDEX IF NOT EXISTS news_source_tab_tab_idx
  ON content.news_source_tab(tab_id);

-- Pagination: composite index for cursor-based ORDER BY + WHERE
CREATE INDEX IF NOT EXISTS news_item_ws_published_idx
  ON content.news_item(workspace_id, published_at DESC NULLS LAST, id);
