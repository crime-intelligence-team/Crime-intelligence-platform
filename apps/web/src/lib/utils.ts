// Simple utility to merge class names (replaces clsx/cn for minimal deps)
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
