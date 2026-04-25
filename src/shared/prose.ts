export function scrubLlmProse(text: string): string {
  return text.replace(/\s+—\s+/g, ". ").replace(/—/g, ", ");
}
