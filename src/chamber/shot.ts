let take: (() => string) | null = null;

export function registerShot(fn: (() => string) | null) {
  take = fn;
}

export function takeShot() {
  return take ? take() : null;
}
