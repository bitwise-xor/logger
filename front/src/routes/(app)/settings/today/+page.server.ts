import { formActions } from '#lib/server/actions.js';
import { SETTINGS_TODAY_SAVES } from '#lib/server/saves.js';
import { readSettings } from '#lib/server/settingsread.js';
import type { SettingsToday } from '#lib/settings.js';
import type { Actions, PageServerLoad } from './$types';

// Settings > today (deploy 111) from GET /api/v1/settings/today; its saves answer with the fresh tab (view "settings_today").
export const load: PageServerLoad = async (event) => readSettings<SettingsToday>(event, 'today');

export const actions = formActions(SETTINGS_TODAY_SAVES, 'settings_today') as Actions;
