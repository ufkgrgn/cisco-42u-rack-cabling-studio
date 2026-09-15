import { DeviceCatalogItem } from '../../types';
import { FastBitSet } from './FastBitSet';
import { TrieNode } from './TrieNode';
import { tokenizeDoc, tokenizeQuery, foldTurkish } from './turkishNormalizer';

export interface CatalogFilterOptions {
  query?: string;
  category?: string;
  manufacturer?: string;
  uHeight?: number | string;
  portType?: string;
  poeOnly?: boolean;
  favoritesOnly?: boolean;
  favoriteIds?: Set<string> | string[];
}

export class CatalogSearchEngine {
  private _items: DeviceCatalogItem[] = [];
  private _idToIndex: Map<string, number> = new Map();
  private _trieRoot: TrieNode = new TrieNode();

  // Facet Bitsets (normalized lowercase keys)
  private _categoryBitsets: Map<string, FastBitSet> = new Map();
  private _manufacturerBitsets: Map<string, FastBitSet> = new Map();
  private _uHeightBitsets: Map<number, FastBitSet> = new Map();
  private _portTypeBitsets: Map<string, FastBitSet> = new Map();
  private _poeBitset: FastBitSet = new FastBitSet();
  private _allBitset: FastBitSet = new FastBitSet();

  constructor(items: DeviceCatalogItem[] = []) {
    if (items.length > 0) {
      this.reindex(items);
    }
  }

  get totalItems(): number {
    return this._items.length;
  }

  reindex(items: DeviceCatalogItem[]): void {
    this._items = [];
    this._idToIndex.clear();
    this._trieRoot = new TrieNode();
    this._categoryBitsets.clear();
    this._manufacturerBitsets.clear();
    this._uHeightBitsets.clear();
    this._portTypeBitsets.clear();
    this._poeBitset = new FastBitSet(items.length);
    this._allBitset = new FastBitSet(items.length);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item) {
        this.indexItem(item, i);
      }
    }
  }

  indexItem(item: DeviceCatalogItem, index?: number): void {
    const idx = index !== undefined ? index : this._items.length;
    if (index === undefined) {
      this._items.push(item);
    } else {
      this._items[idx] = item;
    }

    this._idToIndex.set(item.id, idx);
    this._allBitset.set(idx);

    // 1. Index searchable text tokens
    const textToTokenize = [
      item.id,
      item.name,
      item.category,
      item.manufacturer,
      item.modelTag || '',
      item.desc || '',
      ...item.ports.map(p => `${p.name} ${p.type} ${p.speed || ''}`),
      ...(item.rearPorts || []).map(p => `${p.name} ${p.type} ${p.speed || ''}`)
    ].join(' ');

    const tokens = tokenizeDoc(textToTokenize);
    for (const token of tokens) {
      this._trieRoot.insert(token, idx);
    }

    // 2. Index Category facet
    const catKey = foldTurkish(item.category || '').toLowerCase();
    if (catKey) {
      let catBitset = this._categoryBitsets.get(catKey);
      if (!catBitset) {
        catBitset = new FastBitSet(Math.max(this._items.length, 64));
        this._categoryBitsets.set(catKey, catBitset);
      }
      catBitset.set(idx);
    }

    // 3. Index Manufacturer facet
    const mfrKey = foldTurkish(item.manufacturer || '').toLowerCase();
    if (mfrKey) {
      let mfrBitset = this._manufacturerBitsets.get(mfrKey);
      if (!mfrBitset) {
        mfrBitset = new FastBitSet(Math.max(this._items.length, 64));
        this._manufacturerBitsets.set(mfrKey, mfrBitset);
      }
      mfrBitset.set(idx);
    }

    // 4. Index U-Height facet
    if (item.u) {
      let uBitset = this._uHeightBitsets.get(item.u);
      if (!uBitset) {
        uBitset = new FastBitSet(Math.max(this._items.length, 64));
        this._uHeightBitsets.set(item.u, uBitset);
      }
      uBitset.set(idx);
    }

    // 5. Index Port Types facet
    const allPorts = [...item.ports, ...(item.rearPorts || [])];
    const portTypes = new Set(allPorts.map(p => p.type.toLowerCase()));
    for (const pType of portTypes) {
      let pBitset = this._portTypeBitsets.get(pType);
      if (!pBitset) {
        pBitset = new FastBitSet(Math.max(this._items.length, 64));
        this._portTypeBitsets.set(pType, pBitset);
      }
      pBitset.set(idx);
    }

    // 6. Index PoE facet
    const hasPoe = item.ports.some(p => p.poe === true);
    if (hasPoe) {
      this._poeBitset.set(idx);
    }
  }

  addCustomItem(item: DeviceCatalogItem): void {
    const existingIdx = this._idToIndex.get(item.id);
    if (existingIdx !== undefined) {
      this._items[existingIdx] = item;
      this.reindex(this._items);
    } else {
      this.indexItem(item);
    }
  }

  addCustomDevice(item: DeviceCatalogItem): void {
    this.addCustomItem(item);
  }

  removeCustomItem(id: string): void {
    const filtered = this._items.filter(item => item.id !== id);
    if (filtered.length !== this._items.length) {
      this.reindex(filtered);
    }
  }

  removeCustomDevice(id: string): void {
    this.removeCustomItem(id);
  }

  search(
    queryOrOptions?: string | CatalogFilterOptions,
    extraOptions?: Omit<CatalogFilterOptions, 'query'>,
    favorites?: Set<string> | string[]
  ): DeviceCatalogItem[] {
    let options: CatalogFilterOptions;
    if (typeof queryOrOptions === 'string') {
      options = {
        ...(extraOptions || {}),
        query: queryOrOptions,
        favoriteIds: favorites ?? extraOptions?.favoriteIds
      };
    } else {
      options = queryOrOptions || {};
    }

    const {
      query,
      category,
      manufacturer,
      uHeight,
      portType,
      poeOnly,
      favoritesOnly,
      favoriteIds
    } = options;

    let resultBitset: FastBitSet | null = null;

    // 1. Text search via Prefix Trie
    const cleanQuery = (query || '').trim();
    if (cleanQuery.length > 0) {
      const terms = tokenizeQuery(cleanQuery);
      if (terms.length > 0) {
        resultBitset = new FastBitSet(this._items.length);
        resultBitset.setAll();

        for (const term of terms) {
          const node = this._trieRoot.searchPrefix(term);
          if (!node) {
            // Term not matched anywhere -> 0 matches
            return [];
          }
          resultBitset = resultBitset.and(node.bitset);
          if (resultBitset.count() === 0) {
            return [];
          }
        }
      }
    }

    if (!resultBitset) {
      resultBitset = this._allBitset.clone();
    }

    // 2. Category Facet Filter
    if (category && category !== 'all') {
      const catKey = foldTurkish(category).toLowerCase();
      // Also support aliased category lookups (e.g. 'fiber' -> 'fiber-switch', 'patch' -> 'patch-panel')
      let catBitset = this._categoryBitsets.get(catKey);
      if (!catBitset) {
        if (catKey === 'patch') catBitset = this._categoryBitsets.get('patch-panel');
        else if (catKey === 'fiber') catBitset = this._categoryBitsets.get('fiber-switch');
      }

      if (catBitset) {
        resultBitset = resultBitset.and(catBitset);
      } else {
        return [];
      }
    }

    // 3. Manufacturer Facet Filter
    if (manufacturer && manufacturer !== 'all') {
      const mfrKey = foldTurkish(manufacturer).toLowerCase();
      const mfrBitset = this._manufacturerBitsets.get(mfrKey);
      if (mfrBitset) {
        resultBitset = resultBitset.and(mfrBitset);
      } else {
        return [];
      }
    }

    // 4. U-Height Facet Filter
    if (uHeight !== undefined && uHeight !== 'all') {
      if (typeof uHeight === 'number') {
        const uBitset = this._uHeightBitsets.get(uHeight);
        if (uBitset) {
          resultBitset = resultBitset.and(uBitset);
        } else {
          return [];
        }
      } else if (uHeight === '5+' || uHeight === '5U+') {
        const highUBitset = new FastBitSet(this._items.length);
        for (const [u, bitset] of this._uHeightBitsets.entries()) {
          if (u >= 5) {
            highUBitset.or(bitset, highUBitset);
          }
        }
        resultBitset = resultBitset.and(highUBitset);
      } else {
        const parsed = parseInt(String(uHeight), 10);
        if (!isNaN(parsed)) {
          const uBitset = this._uHeightBitsets.get(parsed);
          if (uBitset) {
            resultBitset = resultBitset.and(uBitset);
          } else {
            return [];
          }
        }
      }
    }

    // 5. Port Type Facet Filter
    if (portType && portType !== 'all') {
      const pTypeKey = portType.toLowerCase();
      const pBitset = this._portTypeBitsets.get(pTypeKey);
      if (pBitset) {
        resultBitset = resultBitset.and(pBitset);
      } else {
        return [];
      }
    }

    // 6. PoE Filter
    if (poeOnly) {
      resultBitset = resultBitset.and(this._poeBitset);
    }

    // 7. Favorites Filter
    if (favoritesOnly && favoriteIds) {
      const favSet = favoriteIds instanceof Set ? favoriteIds : new Set(favoriteIds);
      const favBitset = new FastBitSet(this._items.length);
      for (const favId of favSet) {
        const idx = this._idToIndex.get(favId);
        if (idx !== undefined) {
          favBitset.set(idx);
        }
      }
      resultBitset = resultBitset.and(favBitset);
    }

    const matchedIndices = resultBitset.toArray();
    if (matchedIndices.length === 0) {
      return [];
    }

    const results: DeviceCatalogItem[] = [];
    for (const idx of matchedIndices) {
      const item = this._items[idx];
      if (item) {
        results.push(item);
      }
    }

    // 8. Relevance Ranking (if text query was provided)
    if (cleanQuery.length > 0) {
      const queryFolded = foldTurkish(cleanQuery).toLowerCase();
      const queryTerms = tokenizeQuery(cleanQuery);

      results.sort((a, b) => {
        const scoreA = this.calculateScore(a, queryFolded, queryTerms);
        const scoreB = this.calculateScore(b, queryFolded, queryTerms);
        return scoreB - scoreA;
      });
    }

    return results;
  }

  private calculateScore(item: DeviceCatalogItem, queryFolded: string, queryTerms: string[]): number {
    let score = 0;
    const idFolded = foldTurkish(item.id).toLowerCase();
    const nameFolded = foldTurkish(item.name).toLowerCase();
    const tagFolded = foldTurkish(item.modelTag || '').toLowerCase();

    // Exact ID
    if (idFolded === queryFolded) score += 100;
    // Exact Name
    if (nameFolded === queryFolded) score += 80;
    // Starts with Name
    if (nameFolded.startsWith(queryFolded)) score += 50;
    // Exact Model Tag
    if (tagFolded === queryFolded) score += 40;

    // Contains in Name
    if (nameFolded.includes(queryFolded)) score += 30;

    // Individual term hits
    for (const term of queryTerms) {
      if (nameFolded.includes(term)) score += 15;
      if (idFolded.includes(term)) score += 10;
      if (tagFolded.includes(term)) score += 10;
    }

    return score;
  }
}
