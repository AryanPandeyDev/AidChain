CREATE TABLE event_sync_cursor (
    id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    last_block  BIGINT NOT NULL DEFAULT 0
);
INSERT INTO event_sync_cursor (last_block) VALUES (0);
