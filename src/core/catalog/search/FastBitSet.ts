/**
 * FastBitSet: High-performance 32-bit Uint32Array bitset
 * Provides sub-microsecond set operations (AND, OR, NOT) across catalog items.
 */

export class FastBitSet {
  private _words: Uint32Array;
  private _size: number;

  constructor(size: number = 256) {
    this._size = Math.max(size, 1);
    const wordCount = Math.ceil(this._size / 32);
    this._words = new Uint32Array(wordCount);
  }

  get size(): number {
    return this._size;
  }

  get wordCount(): number {
    return this._words.length;
  }

  get words(): Uint32Array {
    return this._words;
  }

  ensureCapacity(size: number): void {
    if (size <= this._size) return;
    this._size = size;
    const requiredWords = Math.ceil(size / 32);
    if (requiredWords > this._words.length) {
      const newWords = new Uint32Array(Math.max(requiredWords, this._words.length * 2));
      newWords.set(this._words);
      this._words = newWords;
    }
  }

  set(index: number): void {
    if (index < 0) return;
    this.ensureCapacity(index + 1);
    const wordIdx = index >>> 5; // index / 32
    const bitIdx = index & 31;   // index % 32
    const current = this._words[wordIdx] ?? 0;
    this._words[wordIdx] = current | (1 << bitIdx);
  }

  clear(index: number): void {
    if (index < 0 || index >= this._size) return;
    const wordIdx = index >>> 5;
    const bitIdx = index & 31;
    if (wordIdx < this._words.length) {
      const current = this._words[wordIdx] ?? 0;
      this._words[wordIdx] = current & ~(1 << bitIdx);
    }
  }

  has(index: number): boolean {
    if (index < 0 || index >= this._size) return false;
    const wordIdx = index >>> 5;
    const bitIdx = index & 31;
    if (wordIdx >= this._words.length) return false;
    const current = this._words[wordIdx] ?? 0;
    return (current & (1 << bitIdx)) !== 0;
  }

  setAll(): void {
    const fullWords = Math.floor(this._size / 32);
    for (let i = 0; i < fullWords; i++) {
      this._words[i] = 0xffffffff;
    }
    const remainder = this._size % 32;
    if (remainder > 0 && fullWords < this._words.length) {
      this._words[fullWords] = (1 << remainder) - 1;
    }
    for (let i = fullWords + (remainder > 0 ? 1 : 0); i < this._words.length; i++) {
      this._words[i] = 0;
    }
  }

  clearAll(): void {
    this._words.fill(0);
  }

  and(other: FastBitSet, dest?: FastBitSet): FastBitSet {
    const target = dest || new FastBitSet(Math.min(this._size, other.size));
    const maxWords = Math.min(this._words.length, other.wordCount, target.wordCount);
    for (let i = 0; i < maxWords; i++) {
      const w1 = this._words[i] ?? 0;
      const w2 = other.words[i] ?? 0;
      target.words[i] = w1 & w2;
    }
    for (let i = maxWords; i < target.wordCount; i++) {
      target.words[i] = 0;
    }
    return target;
  }

  andNot(other: FastBitSet, dest?: FastBitSet): FastBitSet {
    const target = dest || new FastBitSet(this._size);
    target.ensureCapacity(this._size);
    const minWords = Math.min(this._words.length, other.wordCount, target.wordCount);
    for (let i = 0; i < minWords; i++) {
      const w1 = this._words[i] ?? 0;
      const w2 = other.words[i] ?? 0;
      target.words[i] = w1 & (~w2);
    }
    if (this._words.length > other.wordCount && target.wordCount > other.wordCount) {
      const remaining = Math.min(this._words.length, target.wordCount);
      for (let i = other.wordCount; i < remaining; i++) {
        target.words[i] = this._words[i] ?? 0;
      }
    }
    return target;
  }

  or(other: FastBitSet, dest?: FastBitSet): FastBitSet {
    const newSize = Math.max(this._size, other.size);
    const target = dest || new FastBitSet(newSize);
    target.ensureCapacity(newSize);
    const minWords = Math.min(this._words.length, other.wordCount);
    for (let i = 0; i < minWords; i++) {
      const w1 = this._words[i] ?? 0;
      const w2 = other.words[i] ?? 0;
      target.words[i] = w1 | w2;
    }
    if (this._words.length > minWords) {
      for (let i = minWords; i < this._words.length; i++) {
        target.words[i] = this._words[i] ?? 0;
      }
    } else if (other.wordCount > minWords) {
      for (let i = minWords; i < other.wordCount; i++) {
        target.words[i] = other.words[i] ?? 0;
      }
    }
    return target;
  }

  not(dest?: FastBitSet): FastBitSet {
    const target = dest || new FastBitSet(this._size);
    target.ensureCapacity(this._size);
    const fullWords = Math.floor(this._size / 32);
    for (let i = 0; i < fullWords; i++) {
      const w = this._words[i] ?? 0;
      target.words[i] = ~w;
    }
    const remainder = this._size % 32;
    if (remainder > 0 && fullWords < target.wordCount) {
      const w = this._words[fullWords] ?? 0;
      const mask = (1 << remainder) - 1;
      target.words[fullWords] = (~w) & mask;
    }
    return target;
  }

  clone(): FastBitSet {
    const copy = new FastBitSet(this._size);
    copy._words.set(this._words);
    return copy;
  }

  count(): number {
    let sum = 0;
    for (let i = 0; i < this._words.length; i++) {
      let v = this._words[i] ?? 0;
      while (v !== 0) {
        v &= (v - 1);
        sum++;
      }
    }
    return sum;
  }

  toArray(): number[] {
    const result: number[] = [];
    for (let i = 0; i < this._size; i++) {
      const wordIdx = i >>> 5;
      const bitIdx = i & 31;
      const current = this._words[wordIdx] ?? 0;
      if (wordIdx < this._words.length && (current & (1 << bitIdx)) !== 0) {
        result.push(i);
      }
    }
    return result;
  }
}
