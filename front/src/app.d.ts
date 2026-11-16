// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {
    interface Locals {
      /** The session cookie's token, when it looks like one. Checked with the door by the (app) layout. */
      session: string | null;
    }
  }
}

export {};
