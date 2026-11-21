/**
 * What the server's log says about an error (Web 66, 21.11.2026: `handleError` in hooks.server.ts): the kind of error and the route
 * id only ("/(app)/food", the route's pattern, never the address with its query), never the error's words or any value, which could
 * hold what the owner typed or a health value.
 */
import { DoorError } from './door.js';

const CODE = /^[a-z_]{1,30}$/;
const NAME = /^[A-Za-z]{1,40}$/;

export interface Caught {
  kind: string;
  error: unknown;
}

/** A one-line description: "logger. error: <kind> on <route id>". */
export function errorLine(caught: Caught, routeId: string | null | undefined): string {
  return `logger. error: ${errorKind(caught)} on ${routeId ?? '(no route)'}`;
}

export function errorKind({ kind, error }: Caught): string {
  const e = (error ?? {}) as { status?: unknown };
  const status = typeof e.status === 'number' && Number.isInteger(e.status) ? ` ${e.status}` : '';
  if (kind === 'framework' || kind === 'app' || kind === 'validation') return `${kind}${status}`;
  if (error instanceof DoorError) return `door ${CODE.test(error.code) ? error.code : 'error'}${status && error.status ? ` ${error.status}` : ''}`;
  const name = error instanceof Error ? error.name : typeof error;
  return `unknown ${NAME.test(name) ? name : 'Error'}`;
}
