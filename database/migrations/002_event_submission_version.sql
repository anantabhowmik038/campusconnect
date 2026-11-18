BEGIN;

-- Existing events start at version 0. Every F04 submission advances the version.
ALTER TABLE events
  ADD COLUMN submission_version INTEGER NOT NULL DEFAULT 0
    CHECK (submission_version >= 0);

COMMIT;
