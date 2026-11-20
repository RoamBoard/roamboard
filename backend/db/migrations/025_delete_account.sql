-- Account removal cascades through owned Boards and user-scoped relationships.
ALTER TABLE friendship DROP CONSTRAINT FK_friendship_0;
ALTER TABLE friendship ADD CONSTRAINT FK_friendship_0
  FOREIGN KEY (requester_user_id) REFERENCES app_user (user_id) ON DELETE CASCADE;
ALTER TABLE friendship DROP CONSTRAINT FK_friendship_1;
ALTER TABLE friendship ADD CONSTRAINT FK_friendship_1
  FOREIGN KEY (recipient_user_id) REFERENCES app_user (user_id) ON DELETE CASCADE;

ALTER TABLE user_language DROP CONSTRAINT FK_user_language_0;
ALTER TABLE user_language ADD CONSTRAINT FK_user_language_0
  FOREIGN KEY (user_id) REFERENCES app_user (user_id) ON DELETE CASCADE;
ALTER TABLE user_tag DROP CONSTRAINT FK_user_tag_0;
ALTER TABLE user_tag ADD CONSTRAINT FK_user_tag_0
  FOREIGN KEY (user_id) REFERENCES app_user (user_id) ON DELETE CASCADE;

ALTER TABLE board DROP CONSTRAINT FK_board_0;
ALTER TABLE board ADD CONSTRAINT FK_board_0
  FOREIGN KEY (owner_user_id) REFERENCES app_user (user_id) ON DELETE CASCADE;
ALTER TABLE board_member DROP CONSTRAINT FK_board_member_1;
ALTER TABLE board_member ADD CONSTRAINT FK_board_member_1
  FOREIGN KEY (user_id) REFERENCES app_user (user_id) ON DELETE CASCADE;
ALTER TABLE saved_boards DROP CONSTRAINT FK_saved_boards_1;
ALTER TABLE saved_boards ADD CONSTRAINT FK_saved_boards_1
  FOREIGN KEY (user_id) REFERENCES app_user (user_id) ON DELETE CASCADE;
ALTER TABLE saved_activities DROP CONSTRAINT FK_saved_activities_0;
ALTER TABLE saved_activities ADD CONSTRAINT FK_saved_activities_0
  FOREIGN KEY (user_id) REFERENCES app_user (user_id) ON DELETE CASCADE;

-- Account deletion checks whether activity locations remain in use.
CREATE INDEX ix_activity_location ON activity (location_id)
  WHERE location_id IS NOT NULL;

-- Older Board edits and deletions left location rows without a Board or activity.
-- Every persisted location comes from Board content, so these rows have no owner
-- or remaining content and can be removed before account deletion is enabled.
DELETE FROM location l
WHERE NOT EXISTS (SELECT 1 FROM board b WHERE b.primary_location_id=l.location_id)
  AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.location_id=l.location_id);

-- A referenced legacy image may outlive its uploader. The account service
-- clears private capture metadata before deleting the user.
ALTER TABLE uploaded_image ALTER COLUMN uploaded_by_user_id DROP NOT NULL;
ALTER TABLE uploaded_image DROP CONSTRAINT FK_uploaded_image_0;
ALTER TABLE uploaded_image ADD CONSTRAINT FK_uploaded_image_0
  FOREIGN KEY (uploaded_by_user_id) REFERENCES app_user (user_id) ON DELETE SET NULL;

-- Minimal provider cleanup records survive the account row and upload intents.
CREATE TABLE account_asset_cleanup (
  storage_key VARCHAR(500) PRIMARY KEY,
  eligible_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempted_at TIMESTAMPTZ
);
CREATE INDEX ix_account_asset_cleanup_due
  ON account_asset_cleanup (eligible_at, attempted_at);
