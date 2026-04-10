export function isReplyTargetCompatible(existingReplyTo?: string, incomingReplyTo?: string): boolean {
  if (existingReplyTo == null || incomingReplyTo == null) {
    return true;
  }
  return existingReplyTo === incomingReplyTo;
}
