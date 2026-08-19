/**
 * MarkovGenerator - Flexible n-gram text generator
 * 
 * Supports both word-level and character-level tokenization with adjustable order.
 * 
 * Usage:
 *   const generator = new MarkovGenerator();
 *   generator.train(corpus);
 *   const output = generator.generate({ length: 100, mode: 'word', order: 3 });
 */

class MarkovGenerator {
  constructor() {
    this.corpus = '';
    this.wordTokens = [];
    this.charTokens = [];
    this.modelCache = new Map(); // key: `${mode}-${order}`, value: model
  }

  /**
   * Train on a corpus. Accepts various JSON formats or plain text.
   * @param {string|object|array} data - The corpus to train on
   */
  train(data) {
    this.corpus = this._normalizeCorpus(data);
    this.wordTokens = this._tokenize(this.corpus, 'word');
    this.charTokens = this._tokenize(this.corpus, 'char');
    this.modelCache.clear();
  }

  /**
   * Add more text to the existing corpus and retrain.
   * @param {string|object|array} data - Additional corpus data
   */
  addToCorpus(data) {
    const newText = this._normalizeCorpus(data);
    this.corpus += ' ' + newText;
    this.wordTokens = this._tokenize(this.corpus, 'word');
    this.charTokens = this._tokenize(this.corpus, 'char');
    this.modelCache.clear();
  }

  /**
   * Generate text as a stream (generator function).
   * Yields one token at a time, runs indefinitely until stopped.
   * @param {string} mode - 'word' or 'char'
   * @param {number} order - N-gram size (1-10)
   * @yields {{ token: string, mode: string }}
   */
  *generateStream(mode = 'word', order = 2) {
    if (!this.corpus) return;
    
    order = Math.max(1, Math.min(10, order));
    const tokens = mode === 'word' ? this.wordTokens : this.charTokens;
    
    if (tokens.length < order) return;

    const model = this._getOrBuildModel(mode, order);
    let current = this._randomStart(tokens, order);

    // Yield initial tokens
    for (const token of current) {
      yield { token, mode };
    }

    while (true) {
      const key = current.join('\x00');
      const candidates = model.get(key);

      if (!candidates || candidates.length === 0) {
        current = this._randomStart(tokens, order);
        continue;
      }

      const next = candidates[Math.floor(Math.random() * candidates.length)];
      yield { token: next, mode };
      current = [...current.slice(1), next];
    }
  }

  /**
   * Generate text as a stream with full candidate information for visualization.
   * Yields the chosen token plus all candidates and their frequencies.
   * @param {string} mode - 'word' or 'char'
   * @param {number} order - N-gram size (1-10)
   * @yields {{ token: string, mode: string, context: string[], candidates: Array<{token: string, count: number, frequency: number}>, isInitial: boolean }}
   */
  *generateStreamWithCandidates(mode = 'word', order = 2) {
    if (!this.corpus) return;
    
    order = Math.max(1, Math.min(10, order));
    const tokens = mode === 'word' ? this.wordTokens : this.charTokens;
    
    if (tokens.length < order) return;

    const model = this._getOrBuildModel(mode, order);
    let current = this._randomStart(tokens, order);

    // Yield initial tokens (no candidates for these - they're the seed)
    for (const token of current) {
      yield { token, mode, context: [], candidates: [], isInitial: true };
    }

    while (true) {
      const key = current.join('\x00');
      const candidatesList = model.get(key);

      if (!candidatesList || candidatesList.length === 0) {
        current = this._randomStart(tokens, order);
        continue;
      }

      // Count frequencies of each candidate token
      const counts = new Map();
      for (const c of candidatesList) {
        counts.set(c, (counts.get(c) || 0) + 1);
      }

      // Convert to array with frequency info
      const totalCount = candidatesList.length;
      const candidates = Array.from(counts.entries())
        .map(([token, count]) => ({
          token,
          count,
          frequency: count / totalCount
        }))
        .sort((a, b) => b.count - a.count); // Sort by frequency descending

      // Pick one weighted by frequency (same as original - random from the list)
      const next = candidatesList[Math.floor(Math.random() * candidatesList.length)];
      
      yield { 
        token: next, 
        mode, 
        context: [...current],
        candidates,
        isInitial: false
      };
      
      current = [...current.slice(1), next];
    }
  }

  /**
   * Generate text using the Markov chain.
   * @param {object} options
   * @param {number} options.length - Number of tokens to generate
   * @param {string} options.mode - 'word' or 'char'
   * @param {number} options.order - N-gram size (1-10)
   * @param {string} [options.seed] - Optional starting text
   * @returns {string} Generated text
   */
  generate({ length = 50, mode = 'word', order = 2, seed = null }) {
    if (!this.corpus) {
      throw new Error('No corpus loaded. Call train() first.');
    }

    order = Math.max(1, Math.min(10, order)); // Clamp 1-10
    
    const model = this._getOrBuildModel(mode, order);
    const tokens = mode === 'word' ? this.wordTokens : this.charTokens;
    
    if (tokens.length < order) {
      throw new Error(`Corpus too small for order ${order} in ${mode} mode.`);
    }

    // Determine starting n-gram
    let current;
    if (seed) {
      const seedTokens = this._tokenize(seed, mode);
      if (seedTokens.length >= order) {
        current = seedTokens.slice(-order);
      } else {
        // Pad with random start if seed too short
        current = this._randomStart(tokens, order);
      }
    } else {
      current = this._randomStart(tokens, order);
    }

    const output = [...current];

    for (let i = 0; i < length; i++) {
      const key = current.join('\x00'); // Use null byte as separator
      const candidates = model.get(key);

      if (!candidates || candidates.length === 0) {
        // Dead end - restart from random position
        current = this._randomStart(tokens, order);
        continue;
      }

      const next = candidates[Math.floor(Math.random() * candidates.length)];
      output.push(next);
      current = [...current.slice(1), next];
    }

    // Join output appropriately
    return mode === 'word' ? output.join(' ') : output.join('');
  }

  /**
   * Get or build a model for the given mode and order.
   */
  _getOrBuildModel(mode, order) {
    const cacheKey = `${mode}-${order}`;
    
    if (this.modelCache.has(cacheKey)) {
      return this.modelCache.get(cacheKey);
    }

    const tokens = mode === 'word' ? this.wordTokens : this.charTokens;
    const model = this._buildModel(tokens, order);
    this.modelCache.set(cacheKey, model);
    
    return model;
  }

  /**
   * Build a Markov model from tokens.
   * @param {array} tokens - Array of tokens
   * @param {number} order - N-gram size
   * @returns {Map} Model mapping n-gram keys to arrays of following tokens
   */
  _buildModel(tokens, order) {
    const model = new Map();

    for (let i = 0; i <= tokens.length - order - 1; i++) {
      const gram = tokens.slice(i, i + order);
      const next = tokens[i + order];
      const key = gram.join('\x00');

      if (!model.has(key)) {
        model.set(key, []);
      }
      model.get(key).push(next);
    }

    return model;
  }

  /**
   * Get a random starting n-gram from the tokens.
   */
  _randomStart(tokens, order) {
    const startIndex = Math.floor(Math.random() * (tokens.length - order));
    return tokens.slice(startIndex, startIndex + order);
  }

  /**
   * Tokenize text into words or characters.
   * @param {string} text 
   * @param {string} mode - 'word' or 'char'
   * @returns {array}
   */
  _tokenize(text, mode) {
    if (mode === 'word') {
      return text.split(/\s+/).filter(w => w.length > 0);
    } else {
      // Array.from handles Unicode correctly (emoji, accented chars, etc.)
      return Array.from(text);
    }
  }

  /**
   * Normalize various corpus formats into a plain string.
   * @param {string|object|array} data
   * @returns {string}
   */
  _normalizeCorpus(data) {
    // Plain string
    if (typeof data === 'string') {
      return data;
    }

    // Array of strings
    if (Array.isArray(data) && typeof data[0] === 'string') {
      return data.join(' ');
    }

    // Array of objects with text/content/body field
    if (Array.isArray(data) && typeof data[0] === 'object') {
      return data.map(item => {
        return item.text || item.content || item.body || '';
      }).join(' ');
    }

    // Wrapper object with documents/items/data array
    if (typeof data === 'object' && !Array.isArray(data)) {
      const arr = data.documents || data.items || data.data || data.texts;
      if (arr) {
        return this._normalizeCorpus(arr);
      }
      // Single object with text field
      if (data.text || data.content || data.body) {
        return data.text || data.content || data.body;
      }
    }

    // TODO: Add support for streaming/async corpus loading
    // TODO: Add support for weighted documents
    // TODO: Add support for metadata filtering

    throw new Error('Unrecognized corpus format');
  }

  /**
   * Export the trained state as JSON.
   * @returns {object}
   */
  toJSON() {
    return {
      corpus: this.corpus,
      // Models are not exported - they'll be rebuilt on demand
    };
  }

  /**
   * Import from previously exported JSON.
   * @param {object} json
   */
  static fromJSON(json) {
    const generator = new MarkovGenerator();
    generator.train(json.corpus);
    return generator;
  }

  /**
   * Reset the generator.
   */
  reset() {
    this.corpus = '';
    this.wordTokens = [];
    this.charTokens = [];
    this.modelCache.clear();
  }
}

// Export for Node.js (CommonJS) and browser (ES modules)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MarkovGenerator;
}
export default MarkovGenerator;
