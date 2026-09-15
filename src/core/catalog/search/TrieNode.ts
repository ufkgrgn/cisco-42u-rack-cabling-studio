import { FastBitSet } from './FastBitSet';

/**
 * Prefix Trie Node for fast token lookup and prefix matching
 */
export class TrieNode {
  public children: Map<string, TrieNode> = new Map();
  public bitset: FastBitSet = new FastBitSet();
  public isEndOfToken: boolean = false;

  insert(token: string, docIndex: number, charIndex: number = 0): void {
    this.bitset.set(docIndex);
    if (charIndex >= token.length) {
      this.isEndOfToken = true;
      return;
    }

    const char = token.charAt(charIndex);
    let child = this.children.get(char);
    if (!child) {
      child = new TrieNode();
      this.children.set(char, child);
    }

    child.insert(token, docIndex, charIndex + 1);
  }

  searchPrefix(prefix: string, charIndex: number = 0): TrieNode | null {
    if (charIndex >= prefix.length) {
      return this;
    }

    const char = prefix.charAt(charIndex);
    const child = this.children.get(char);
    if (!child) return null;

    return child.searchPrefix(prefix, charIndex + 1);
  }

  collectSubtreeBitset(dest: FastBitSet): void {
    dest.or(this.bitset, dest);
    for (const child of this.children.values()) {
      child.collectSubtreeBitset(dest);
    }
  }
}
