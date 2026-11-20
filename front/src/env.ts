// The settings this app reads from its container's environment (compose.yaml). All private: none reaches the browser.
import { defineEnvVars } from '@sveltejs/kit/env';

const orDefault = (fallback: string) => (value: string | undefined) => value || fallback;

export const variables = defineEnvVars({
  DOOR_URL: {
    description: "The core's address inside Docker; the door accepts only the Host logger-v2-core:8000.",
    schema: orDefault('http://logger-v2-core:8000'),
  },
  FRONT_TOKEN: {
    description: 'The service token for the JSON door (the same value as the core has), 32+ characters. Empty: the door is off.',
    schema: (value) => value ?? '',
  },
  APP_URL: {
    description: 'The full web app, linked for everything the trial does not have.',
    schema: orDefault('https://app.19hospitalroad.fyi'),
  },
  HUB_ORIGIN: {
    description: "The hub (the owner's home dashboard), the only other page that may show this app's signed-in pages in a frame.",
    schema: orDefault('https://hub.19hospitalroad.fyi'),
  },
});
