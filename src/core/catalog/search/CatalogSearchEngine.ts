import { DeviceCatalogItem } from '../../types';
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
  private _itemSearchText: Map<string, string> = new Map();
  private _itemTokens: Map<string, Set<string>> = new Map();

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
    this._itemSearchText.clear();
    this._itemTokens.clear();

    for (const item of items) {
      if (item) {
        this.indexItem(item);
      }
    }
  }

  indexItem(item: DeviceCatalogItem): void {
    this._items.push(item);

    const textToTokenize = [
      item.id,
      item.name,
      item.category,
      item.manufacturer,
      item.modelTag || '',
      item.desc || '',
      ...item.ports.map((p) => `${p.name} ${p.type} ${p.speed || ''}`),
      ...(item.rearPorts || []).map((p) => `${p.name} ${p.type} ${p.speed || ''}`)
    ].join(' ');

    const docTokens = tokenizeDoc(textToTokenize);
    this._itemTokens.set(item.id, new Set(docTokens));
    this._itemSearchText.set(
      item.id,
      (docTokens.join(' ') + ' ' + foldTurkish(textToTokenize)).toLowerCase()
    );
  }

  addCustomItem(item: DeviceCatalogItem): void {
    this.addCustomDevice(item);
  }

  addCustomDevice(item: DeviceCatalogItem): void {
    this.removeCustomDevice(item.id);
    this.indexItem(item);
  }

  removeCustomItem(id: string): void {
    this.removeCustomDevice(id);
  }

  removeCustomDevice(deviceId: string): void {
    const idx = this._items.findIndex((d) => d.id === deviceId);
    if (idx !== -1) {
      this._items.splice(idx, 1);
    }
    this._itemSearchText.delete(deviceId);
    this._itemTokens.delete(deviceId);
  }

  search(
    queryOrOptions?: string | CatalogFilterOptions,
    extraOptions?: CatalogFilterOptions,
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

    const cleanQuery = (query || '').trim();
    const queryFolded = foldTurkish(cleanQuery).toLowerCase();
    const queryTerms = tokenizeQuery(cleanQuery);

    const favSet =
      favoritesOnly && favoriteIds
        ? favoriteIds instanceof Set
          ? favoriteIds
          : new Set(favoriteIds)
        : null;

    const results = this._items.filter((item) => {
      // 1. Query matching
      if (cleanQuery.length > 0) {
        const itemText = this._itemSearchText.get(item.id) || '';
        const itemTokens = this._itemTokens.get(item.id);

        for (const term of queryTerms) {
          let matches = itemText.includes(term);
          if (!matches && itemTokens) {
            for (const tok of itemTokens) {
              if (tok.startsWith(term) || tok.includes(term)) {
                matches = true;
                break;
              }
            }
          }
          if (!matches) return false;
        }
      }

      // 2. Category Filter
      if (category && category !== 'all') {
        const catKey = foldTurkish(category).toLowerCase();
        const itemCat = foldTurkish(item.category || '').toLowerCase();
        if (catKey === 'patch') {
          if (itemCat !== 'patch-panel' && itemCat !== 'patch') return false;
        } else if (catKey === 'fiber') {
          if (itemCat !== 'fiber-switch' && itemCat !== 'fiber') return false;
        } else if (itemCat !== catKey) {
          return false;
        }
      }

      // 3. Manufacturer Filter
      if (manufacturer && manufacturer !== 'all') {
        const mfrKey = foldTurkish(manufacturer).toLowerCase();
        const itemMfr = foldTurkish(item.manufacturer || '').toLowerCase();
        if (itemMfr !== mfrKey) return false;
      }

      // 4. U-Height Filter
      if (uHeight !== undefined && uHeight !== 'all') {
        if (typeof uHeight === 'number') {
          if (item.u !== uHeight) return false;
        } else if (uHeight === '5+' || uHeight === '5U+') {
          if ((item.u || 1) < 5) return false;
        } else {
          const parsed = parseInt(String(uHeight), 10);
          if (!isNaN(parsed) && item.u !== parsed) return false;
        }
      }

      // 5. Port Type Filter
      if (portType && portType !== 'all') {
        const pTypeKey = portType.toLowerCase();
        const allPorts = [...item.ports, ...(item.rearPorts || [])];
        if (!allPorts.some((p) => p.type.toLowerCase() === pTypeKey)) {
          return false;
        }
      }

      // 6. PoE Filter
      if (poeOnly) {
        if (!item.ports.some((p) => p.poe === true)) return false;
      }

      // 7. Favorites Filter
      if (favSet && !favSet.has(item.id)) {
        return false;
      }

      return true;
    });

    // 8. Relevance Ranking (if text query was provided)
    if (cleanQuery.length > 0) {
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

    if (idFolded === queryFolded) score += 100;
    if (nameFolded === queryFolded) score += 80;
    if (nameFolded.startsWith(queryFolded)) score += 50;
    if (tagFolded === queryFolded) score += 40;
    if (nameFolded.includes(queryFolded)) score += 30;

    for (const term of queryTerms) {
      if (nameFolded.includes(term)) score += 15;
      if (idFolded.includes(term)) score += 10;
      if (tagFolded.includes(term)) score += 10;
    }

    return score;
  }
}
