-- Notifications per address (17.11.2026, deploy 110): a push subscription remembers which front end turned it on, so a nudge's
-- link opens the right pages on that device (nudges.deliver, nudges.link_for):
--   'app'     the web app at app. (/web/push/subscribe; every row before this deploy): links unchanged (/web/...)
--   'logger'  the new front end at logger. (the JSON door's POST /api/v1/push/subscribe): /web/ becomes /, the Notifications tab
--             /settings/notifications, any other /web/ page (the gratitude list) the full app's absolute address
-- One VAPID key serves both; the endpoint stays unique (each origin's browser subscription has its own). core_rw's table-wide
-- grants on push_subscriptions cover the new column.
ALTER TABLE push_subscriptions ADD COLUMN origin text NOT NULL DEFAULT 'app' CHECK (origin IN ('app', 'logger'));
