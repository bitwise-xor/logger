import { dayLine } from '#lib/format.js';
import type { PageServerLoad } from './$types';

// Step A: an empty Today. Its cards come with GET /api/v1/day in step B (deploy 79).
export const load: PageServerLoad = () => ({ dayLine: dayLine(new Date()) });
