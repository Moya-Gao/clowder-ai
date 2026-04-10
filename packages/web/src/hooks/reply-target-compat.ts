export function isReplyTargetCompatible(existingReplyTo?: string, incomingReplyTo?: string): boolean {
  return (existingReplyTo ?? null) === (incomingReplyTo ?? null);
}
