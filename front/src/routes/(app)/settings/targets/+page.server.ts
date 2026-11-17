import { formActions } from '#lib/server/actions.js';
import { SETTINGS_TARGETS_SAVES } from '#lib/server/saves.js';
import { readSettings } from '#lib/server/settingsread.js';
import type { SettingsTargets } from '#lib/settings.js';
import type { Actions, PageServerLoad } from './$types';

// Settings > targets (deploy 111) from GET /api/v1/settings/targets; its saves answer with the fresh tab (view "settings_targets").
export const load: PageServerLoad = async (event) => readSettings<SettingsTargets>(event, 'targets');

export const actions = formActions(SETTINGS_TARGETS_SAVES, 'settings_targets') as Actions;
