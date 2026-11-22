import { formActions } from '#lib/server/actions.js';
import { SETTINGS_COACH_SAVES } from '#lib/server/saves.js';
import { readSettings } from '#lib/server/read.js';
import type { SettingsCoach } from '#lib/settings.js';
import type { Actions, PageServerLoad } from './$types';

// Settings > coach (deploy 111) from GET /api/v1/settings/coach; its saves answer with the fresh tab (view "settings_coach").
export const load: PageServerLoad = async (event) => readSettings<SettingsCoach>(event, 'coach');

export const actions = formActions(SETTINGS_COACH_SAVES, 'settings_coach') as Actions;
