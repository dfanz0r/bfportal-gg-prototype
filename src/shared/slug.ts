/**
 * A title as part of an address: lower case, words joined with hyphens.
 * Accented letters lose their accents ("Café" is "cafe"). Letters with no
 * plain form are dropped, so a title in another alphabet may come out empty;
 * the caller supplies a fallback.
 */
export function slugify(text: string) {
  return text
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/ß/g, 'ss')
    .replace(/[øØ]/g, 'o')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[łŁ]/g, 'l')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
