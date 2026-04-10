export function isReplyTargetCompatible(existingReplyTo?: string, incomingReplyTo?: string): boolean {
  if (existingReplyTo == null) {
    return true;
  }
  return existingReplyTo === (incomingReplyTo ?? null);
}
