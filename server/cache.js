'use strict';

/**
 * Lightweight in-memory TTL cache for AI responses.
 *
 * Why in-memory (no Redis):
 * - Single Render instance, no multi-node concerns yet.
 * - Memory budget is small (max ~500 entries × ~5 KB ≈ 2.5 MB).
 * - Adding Redis would mean another paid service for marginal benefit.
 *
 * Cache misses on Render restart are acceptable — first-of-day cache fills
 * organically and the goal is to dedupe repeat requests within a session,
 * not provide warm cache across deploys.
 */

const DEFAULT_MAX_ENTRIES = 500;

class TtlCache {
  constructor(maxEntries = DEFAULT_MAX_ENTRIES) {
    this.maxEntries = maxEntries;
    this.store = new Map(); // insertion order = LRU-ish for our purposes
    this.hits = 0;
    this.misses = 0;
  }

  /** Returns the cached value if present and not expired, else null. */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return null;
    }
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      this.misses += 1;
      return null;
    }
    // Refresh LRU position by re-inserting.
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits += 1;
    return entry.value;
  }

  /** Sets a value with TTL in milliseconds. */
  set(key, value, ttlMs) {
    if (this.store.size >= this.maxEntries) {
      // Evict the oldest entry (first inserted).
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  size() {
    return this.store.size;
  }

  stats() {
    const total = this.hits + this.misses;
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? Number((this.hits / total).toFixed(3)) : 0,
    };
  }
}

/**
 * Builds a stable cache key from an arbitrary request payload.
 *
 * Sorts object keys recursively so {a:1, b:2} and {b:2, a:1} produce the same
 * key. Also normalizes strings (trim + lowercase) for case-insensitive cache
 * hits on common fields like dish names and ingredients.
 */
function canonicalKey(prefix, payload) {
  const normalized = normalize(payload);
  return `${prefix}::${stableStringify(normalized)}`;
}

function normalize(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) {
      const v = normalize(value[k]);
      if (v === null || v === undefined || v === '') continue;
      out[k] = v;
    }
    return out;
  }
  return null;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
  return `{${parts.join(',')}}`;
}

module.exports = { TtlCache, canonicalKey };
