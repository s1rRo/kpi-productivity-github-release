-- Update privacy settings to include new fields
-- This migration updates existing users' privacy settings to include the new fields

-- Update existing users to have the new privacy settings
UPDATE users 
SET privacySettings = '{"showProgress":true,"showGoals":true,"showAchievements":true,"allowFriendRequests":true,"allowTeamInvites":true,"showOnlineStatus":true}'
WHERE privacySettings = '{"showProgress":true,"showGoals":true,"showAchievements":true}';

-- Update any other existing privacy settings to include the new fields
UPDATE users 
SET privacySettings = json_set(
  json_set(
    json_set(privacySettings, '$.allowFriendRequests', true),
    '$.allowTeamInvites', true
  ),
  '$.showOnlineStatus', true
)
WHERE json_extract(privacySettings, '$.allowFriendRequests') IS NULL;