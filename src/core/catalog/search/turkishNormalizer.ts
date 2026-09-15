/**
 * Turkish Diacritic Normalization and Tokenization Engine
 * F3.5 Sub-100ms Fuzzy Search & Filter Engine
 */

/**
 * Folds Turkish diacritics and converts to lowercase ASCII:
 * ç/Ç -> c, ğ/Ğ -> g, ı/I/İ/i -> i, ö/Ö -> o, ş/Ş -> s, ü/Ü -> u
 */
export function foldTurkish(text: string): string {
  if (!text) return '';
  return text
    .replace(/\u0130/g, 'i') // Turkish capital dotted I (İ) -> i
    .replace(/I/g, 'i')       // ASCII capital I -> i
    .replace(/\u0131/g, 'i') // Turkish small dotless i (ı) -> i
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritical marks
    .replace(/\u0131/g, 'i')
    .toLowerCase();
}

/**
 * Normalizes any string to lowercase ASCII alphanumeric with spaces.
 */
export function normalizeCatalogText(input: string): string {
  const folded = foldTurkish(input);
  return folded.replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Tokenizes a document string for search indexing.
 * Generates both whitespace/punctuation delimited tokens AND compact alphanumeric tokens
 * for hyphenated/dotted identifiers (e.g., 'ISR-4431' -> ['isr', '4431', 'isr4431']).
 */
export function tokenizeDoc(text: string): string[] {
  if (!text) return [];
  const folded = foldTurkish(text);
  const rawTokens = folded.split(/[^a-z0-9]+/i).filter(t => t.length > 0);
  const tokenSet = new Set<string>(rawTokens);

  // Add compact alphanumeric representations for consecutive tokens (e.g. 'cisco-catalyst-3850' or 'isr-4431')
  // Also look for hyphens/underscores/slashes in the original folded string
  const compoundMatches = folded.match(/[a-z0-9]+(?:[-_./][a-z0-9]+)+/g);
  if (compoundMatches) {
    for (const match of compoundMatches) {
      const compact = match.replace(/[^a-z0-9]/g, '');
      if (compact.length > 0 && compact.length <= 40) {
        tokenSet.add(compact);
      }
    }
  }

  return Array.from(tokenSet);
}

/**
 * Tokenizes a user query string into individual folded search terms.
 */
export function tokenizeQuery(query: string): string[] {
  if (!query) return [];
  const folded = foldTurkish(query);
  return folded
    .split(/[^a-z0-9]+/i)
    .map(t => t.trim())
    .filter(t => t.length > 0);
}
