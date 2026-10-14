(function () {
  'use strict';

  const style = document.createElement('style');
  style.textContent = `
    .cascading-text .cw-word {
      opacity: 0;
      display: inline-block;
      transform: translate3d(0, 0.18em, 0);
      filter: blur(5px);
      transition:
        opacity 750ms ease,
        transform 900ms cubic-bezier(0.16, 1, 0.3, 1),
        filter 750ms ease;
      transition-delay: var(--cw-delay, 0ms);
      backface-visibility: hidden;
    }
    .cascading-text.cw-visible .cw-word {
      opacity: 1;
      transform: translate3d(0, 0, 0);
      filter: blur(0);
    }
    @media (prefers-reduced-motion: reduce) {
      .cascading-text .cw-word,
      .cascading-text.cw-visible .cw-word {
        opacity: 1;
        transform: none;
        filter: none;
        transition: none;
      }
    }
  `;
  document.head.appendChild(style);

  const selector = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'li', 'figcaption', 'blockquote',
    'a', 'button', 'label',
    '.mono', '.title', '.meta', '.code', '.sub',
    '.stat', '.wordmark', '.foot-brand', '.proprietor',
    '.nav-link', '.hero-subtitle', '.section-description', '.text-content',
    '.studio-name', '.carousel-hint', '.album-title', '.album-meta',
    '.foot-bottom', '.details', '.wc-album', '.wc-title',
    '.filter-chip', '.highlight-toggle'
  ].join(',');
  const excludedTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION']);
  const processed = new WeakSet();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let observer = null;

  function isExcluded(element) {
    return element.closest('.no-text-reveal, [hidden], [aria-hidden="true"]');
  }

  function revealImmediately(element) {
    element.classList.add('cascading-text', 'cw-visible');
  }

  function wrapWords(element) {
    if (processed.has(element) || isExcluded(element) || !element.textContent.trim()) return;
    processed.add(element);

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent || excludedTags.has(parent.tagName) || isExcluded(parent)) return NodeFilter.FILTER_REJECT;
        const interactive = parent.closest('a, button, input, textarea, select, script, style, svg, code, pre, .cw-word');
        if (interactive && interactive !== element) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    let wordIndex = 0;
    textNodes.forEach(node => {
      const fragment = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach(part => {
        if (!part.trim()) {
          fragment.appendChild(document.createTextNode(part));
          return;
        }
        const word = document.createElement('span');
        word.className = 'cw-word';
        word.textContent = part;
        word.style.setProperty('--cw-delay', `${Math.min(wordIndex * 35, 350)}ms`);
        fragment.appendChild(word);
        wordIndex++;
      });
      node.parentNode.replaceChild(fragment, node);
    });

    if (!wordIndex) return;
    element.classList.add('cascading-text');
    if (reduceMotion || !observer) revealImmediately(element);
    else observer.observe(element);
  }

  function prepareRoot(root) {
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    const candidates = [];
    if (root.matches(selector)) candidates.push(root);
    candidates.push(...root.querySelectorAll(selector));
    candidates.forEach(wrapWords);
  }

  function revealAll() {
    document.querySelectorAll('.cascading-text').forEach(revealImmediately);
  }

  try {
    if (!reduceMotion && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries, currentObserver) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('cw-visible');
          currentObserver.unobserve(entry.target);
        });
      }, { threshold: 0.05, rootMargin: '0px 0px -20px 0px' });
    }

    prepareRoot(document.body);

    if ('MutationObserver' in window) {
      const mutations = new MutationObserver(records => {
        records.forEach(record => record.addedNodes.forEach(prepareRoot));
      });
      mutations.observe(document.body, { childList: true, subtree: true });
    }
  } catch (error) {
    revealAll();
  }
})();
