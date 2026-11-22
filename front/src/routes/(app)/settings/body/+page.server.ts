import { formActions } from '#lib/server/actions.js';
import { SETTINGS_BODY_SAVES } from '#lib/server/saves.js';
import { readSettings } from '#lib/server/read.js';
import type { SettingsBody } from '#lib/settings.js';
import type { Actions, PageServerLoad } from './$types';

// Settings > body (deploy 111) from GET /api/v1/settings/body; its saves answer with the fresh tab (view "settings_body").
export const load: PageServerLoad = async (event) => readSettings<SettingsBody>(event, 'body');

export const actions = formActions(SETTINGS_BODY_SAVES, 'settings_body') as Actions;
