import { formActions } from '#lib/server/actions.js';
import { SETTINGS_DEVICES_SAVES } from '#lib/server/saves.js';
import { readSettings } from '#lib/server/read.js';
import type { SettingsDevices } from '#lib/settings.js';
import type { Actions, PageServerLoad } from './$types';

// Settings > devices (deploy 111) from GET /api/v1/settings/devices; its saves answer with the fresh tab (view "settings_devices").
export const load: PageServerLoad = async (event) => readSettings<SettingsDevices>(event, 'devices');

export const actions = formActions(SETTINGS_DEVICES_SAVES, 'settings_devices') as Actions;
