export function buildProbeHeaders(apiKey: string): Record<string, string> {
  return { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
}

export async function readProbeError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  return text.slice(0, 400);
}

export function isInvalidModelProbeError(errorText: string): boolean {
  return /(invalid model|model[^a-z0-9]*(not found|does not exist|unsupported))/i.test(errorText);
}
