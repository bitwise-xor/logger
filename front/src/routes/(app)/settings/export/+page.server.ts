import { readSettings } from '#lib/server/read.js';
import { EXPORT_REFUSED_COOKIE, refusedText, type SettingsExport } from '#lib/settings.js';
import type { PageServerLoad } from './$types';

// Settings > Export (deploy 111) from GET /api/v1/settings/export. The download itself is a plain form POST to ./download (no form
// action: the answer is the file); ?failed=1 is its way back when the file could not be made. Core 37: ?refused=1 when the door
// refused the authenticator code; its words come in a cookie that is read once here (and only with ?refused=1).
export const load: PageServerLoad = async (event) => {
  const refused = event.url.searchParams.get('refused') === '1' ? refusedText(event.cookies.get(EXPORT_REFUSED_COOKIE)) : null;
  if (event.cookies.get(EXPORT_REFUSED_COOKIE) !== undefined) event.cookies.delete(EXPORT_REFUSED_COOKIE, { path: '/', secure: true });
  return {
    ...(await readSettings<SettingsExport>(event, 'export')),
    failed: event.url.searchParams.get('failed') === '1',
    refused,
  };
};
