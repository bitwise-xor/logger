import { formActions } from '#lib/server/actions.js';
import { SETTINGS_NOTIFY_SAVES } from '#lib/server/saves.js';
import { readSettings } from '#lib/server/settingsread.js';
import type { SettingsNotify } from '#lib/settings.js';
import type { Actions, PageServerLoad } from './$types';

// Settings > notifications (deploy 111) from GET /api/v1/settings/notify; its saves answer with the fresh tab (view "settings_notify").
export const load: PageServerLoad = async (event) => readSettings<SettingsNotify>(event, 'notify');

export const actions = formActions(SETTINGS_NOTIFY_SAVES, 'settings_notify') as Actions;
