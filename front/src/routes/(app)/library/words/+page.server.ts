import { formActions } from '#lib/server/actions.js';
import { readDoor } from '#lib/server/read.js';
import { WORDS_SAVES } from '#lib/server/saves.js';
import { viewOf, type Words } from '#lib/words.js';
import type { Actions, PageServerLoad } from './$types';

// Library > Foods > Words (core item 24) from GET /api/v1/food/words?q=&shared=1. The search is cut at 60 characters here, so the door's
// 400 is never asked for. readDoor: the session renewed, a gone session to the sign-in and back here, any other trouble as a plain
// message (ProblemCard).
export const load: PageServerLoad = async (event) => {
  const view = viewOf(event.url.searchParams);
  const list = await readDoor<Words>(event, '/food/words', 'words', { q: view.q || undefined, shared: view.shared ? '1' : undefined });
  return { words: list.read, view, undo: list.undo, problem: list.problem ?? (list.missing ? 'trouble' : null) };
};

/** A word's Remove, and Undo: each answers with the fresh list (view "words"). */
export const actions = formActions(WORDS_SAVES, 'words') as Actions;
