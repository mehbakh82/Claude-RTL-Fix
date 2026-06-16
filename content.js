(function () {
  'use strict';

  // Persian / Arabic Unicode ranges (escape sequences, encoding-safe):
  //   U+0600-06FF  Arabic block — Farsi/Persian alphabet lives here
  //   U+0750-077F  Arabic Supplement
  //   U+08A0-08FF  Arabic Extended-A
  //   U+FB50-FDFF  Arabic Presentation Forms-A
  //   U+FE70-FEFF  Arabic Presentation Forms-B
  const RTL_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;

  // Fraction of "significant" (non-whitespace, non-digit, non-ASCII-punct)
  // characters that must be RTL before we flip a block. 0.15 handles
  // heavily code-switched text like "در Python می‌توانید از..."
  // without creating false-positives on English-only paragraphs.
  const RTL_THRESHOLD = 0.15;

  // Block-level elements we inspect and potentially flip
  const BLOCK_SEL = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, dt, dd';

  // Ancestor elements whose subtrees we must never touch:
  // code blocks, form inputs, navigation, dialogs
  const SKIP_ANCESTOR_SEL =
    'pre, code, [contenteditable="true"], textarea, input, ' +
    'nav, header, footer, aside, [role="navigation"], ' +
    '[role="menubar"], [role="toolbar"], [role="dialog"]';

  // Attributes we stamp on elements we own, so we can remove our changes later
  const RTL_MARKER  = 'data-rtl-fix';
  const LIST_MARKER = 'data-rtl-fix-list';

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns the text content of `el` with all <pre>/<code> descendants
   * stripped, so code tokens don't skew the RTL character ratio.
   */
  function textWithoutCode(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('pre, code').forEach((n) => n.remove());
    return clone.textContent || '';
  }

  /**
   * Fraction of "significant" characters (not whitespace, digits, or common
   * ASCII punctuation/symbols) that fall in an RTL Unicode range.
   */
  function rtlRatio(text) {
    const significant = text.replace(
      /[\s\d!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g,
      ''
    );
    if (!significant.length) return 0;
    const hits = (significant.match(RTL_REGEX) || []).length;
    return hits / significant.length;
  }

  // ---------------------------------------------------------------------------
  // Core per-element logic
  // ---------------------------------------------------------------------------

  function applyRTL(el) {
    if (el.closest(SKIP_ANCESTOR_SEL)) return;

    const ratio = rtlRatio(textWithoutCode(el));

    if (ratio >= RTL_THRESHOLD) {
      if (el.getAttribute('dir') !== 'rtl') el.setAttribute('dir', 'rtl');
      if (!el.hasAttribute(RTL_MARKER))     el.setAttribute(RTL_MARKER, '');
    } else if (el.hasAttribute(RTL_MARKER)) {
      el.removeAttribute('dir');
      el.removeAttribute(RTL_MARKER);
    }
  }

  /**
   * After processing <li> elements, align the parent <ul>/<ol> to match the
   * majority of its children so that bullet/number markers land on the right.
   */
  function reconcileLists(root) {
    const lists = root.querySelectorAll ? root.querySelectorAll('ul, ol') : [];
    lists.forEach((list) => {
      if (list.closest(SKIP_ANCESTOR_SEL)) return;
      const items    = [...list.querySelectorAll(':scope > li')];
      if (!items.length) return;
      const rtlCount = items.filter((li) => li.hasAttribute(RTL_MARKER)).length;
      if (rtlCount / items.length > 0.5) {
        list.setAttribute('dir', 'rtl');
        list.setAttribute(LIST_MARKER, '');
      } else if (list.hasAttribute(LIST_MARKER)) {
        list.removeAttribute('dir');
        list.removeAttribute(LIST_MARKER);
      }
    });
  }

  function processSubtree(root) {
    if (root.matches && root.matches(BLOCK_SEL)) applyRTL(root);
    if (root.querySelectorAll) {
      root.querySelectorAll(BLOCK_SEL).forEach(applyRTL);
    }
    reconcileLists(root);
  }

  // ---------------------------------------------------------------------------
  // MutationObserver — SPA navigation + live-streamed responses
  // ---------------------------------------------------------------------------

  let charDataTimer = null;

  const observer = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      if (mut.type === 'childList') {
        for (const node of mut.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          processSubtree(node);
        }
      } else if (mut.type === 'characterData') {
        // Walk up from the changed text node to the nearest block ancestor,
        // then re-evaluate. Debounced because streaming fires rapidly.
        const target = mut.target;
        clearTimeout(charDataTimer);
        charDataTimer = setTimeout(() => {
          let el = target.parentElement;
          while (el && el !== document.body) {
            if (el.matches && el.matches(BLOCK_SEL)) {
              applyRTL(el);
              const list = el.closest('ul, ol');
              if (list) reconcileLists(list.parentElement || list);
              break;
            }
            el = el.parentElement;
          }
        }, 80);
      }
    }
  });

  observer.observe(document.body, {
    childList:     true,
    subtree:       true,
    characterData: true,
  });

  // Initial pass over whatever is already rendered
  processSubtree(document.body);
})();
