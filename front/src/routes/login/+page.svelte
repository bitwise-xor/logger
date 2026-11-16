<script lang="ts">
  import { enhance } from '$app/forms';
  import ProblemCard from '#lib/components/ProblemCard.svelte';
  import ThemeButton from '#lib/components/ThemeButton.svelte';
  import { Button } from '#lib/components/ui/button/index.js';
  import { Input } from '#lib/components/ui/input/index.js';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
  let busy = $state(false);
  // Step F: the door off or the core down, seen before you type (the page's load) or at the sign-in itself (the form's answer).
  const problem = $derived(form?.problem ?? data.problem);
</script>

<svelte:head><title>Sign in · Logger</title></svelte:head>

<div class="mx-auto flex min-h-dvh w-full max-w-[380px] flex-col justify-center gap-3 p-5">
  <div class="flex items-center justify-between gap-3">
    <h1 class="m-0 text-[15px] font-semibold">Logger</h1>
    <ThemeButton />
  </div>
  <main class="flex flex-col gap-3">
    {#if problem}<ProblemCard kind={problem} where="signin" appHref="{data.appUrl}/web/" />{/if}
    <form
      method="POST"
      class="flex flex-col gap-3 rounded-card border border-line bg-panel p-4"
      use:enhance={() => {
        busy = true;
        return async ({ update }) => {
          await update({ reset: false });
          busy = false;
        };
      }}
    >
      <!-- There is one user: a fixed, hidden name lets a password manager file the password. -->
      <input
        type="text"
        name="username"
        value="logger"
        autocomplete="username"
        class="sr-only"
        tabindex="-1"
        aria-hidden="true"
        readonly
      />
      <label for="password" class="text-[13px] font-semibold text-muted">Password</label>
      <Input
        id="password"
        name="password"
        type="password"
        autocomplete="current-password"
        required
        aria-invalid={form?.message ? 'true' : undefined}
        aria-describedby="login-message"
      />
      <label for="code" class="text-[13px] font-semibold text-muted">Code from the authenticator</label>
      <Input
        id="code"
        name="code"
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength={12}
        required
        class="num"
        aria-describedby="login-message"
      />
      <Button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      <!-- Always there, so the form does not jump when a message appears. -->
      <p id="login-message" class="m-0 min-h-5 font-medium" role="alert">{form?.problem ? '' : (form?.message ?? '')}</p>
    </form>
  </main>
  <p class="m-0 text-[13px] text-muted">
    A trial of the new look. Everything is still in the <a href="{data.appUrl}/web/">full app</a>.
  </p>
</div>
