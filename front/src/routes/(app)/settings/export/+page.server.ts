import { readSettings } from '#lib/server/settingsread.js';
import type { SettingsExport } from '#lib/settings.js';
import type { PageServerLoad } from './$types';

// Settings > Export (deploy 111) from GET /api/v1/settings/export. The download itself is a plain form POST to ./download (no form
// action: the answer is the file); ?failed=1 is its way back when the file could not be made.
export const load: PageServerLoad = async (event) => ({
  ...(await readSettings<SettingsExport>(event, 'export')),
  failed: event.url.searchParams.get('failed') === '1',
});
