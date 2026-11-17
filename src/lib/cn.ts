type ClassValue = string | false | null | undefined;

/** Tiny class-name joiner — keeps component class lists readable without extra dependencies. */
export function cn(...values: readonly ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
