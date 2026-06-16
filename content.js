(function () {
  'use strict';

  // Persian / Arabic Unicode ranges — u flag enables full Unicode mode:
  //   U+0600-06FF  Arabic block (Farsi/Persian alphabet lives here)
  //   U+0750-077F  Arabic Supplement
  //   U+08A0-08FF  Arabic Extended-A
  //   U+FB50-FDFF  Arabic Presentation Forms-A
  //   U+FE70-FEFF  Arabic Presentation Forms-B
  const RTL_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/gu;

  // Fraction of "significant" (non-whitespace, non-digit, non-ASCII-punct)
  // characters that must be RTL before we flip a block. 0.15 handles
  // heavily code-switched text like "در Python می‌توانید از..."
  // without creating false-positives on English-only paragraphs.
  const RTL_THRESHOLD = 0.15;

  // Block-level elements we inspect and potentially flip.
  // td/th included so Markdown tables with Persian content render RTL.
  const BLOCK_SEL = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, dt, dd, td, th';

  // Ancestor elements whose subtrees we must never flip:
  // code blocks, form inputs, navigation chrome, dialogs.
  const SKIP_ANCESTOR_SEL =
    'pre, code, [contenteditable="true"], textarea, input, ' +
    'nav, header, footer, aside, [role="navigation"], ' +
    '[role="menubar"], [role="toolbar"], [role="dialog"]';

  // Attributes we stamp on elements we own, so we can undo our changes later.
  const RTL_MARKER  = 'data-rtl-fix';      // element is RTL (we set dir="rtl")
  const LIST_MARKER = 'data-rtl-fix-list'; // list container is RTL (majority RTL items)
  const LTR_MARKER  = 'data-rtl-fix-ltr';  // LTR item inside an RTL list (we set dir="ltr"
                                            // explicitly so it overrides the parent dir="rtl")

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  // Returns text of `el` with all <pre>/<code> descendants stripped,
  // so code tokens don't skew the RTL character ratio.
  function textWithoutCode(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('pre, code').forEach((n) => n.remove());
    return clone.textContent || '';
  }

  // Fraction of "significant" characters that are RTL script.
  function rtlRatio(text) {
    const significant = text.replace(
      /[\s\d!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g,
      ''
    );
    if (!significant.length) return 0;
    // Reset lastIndex before each use: RTL_REGEX is a shared /g instance.
    RTL_REGEX.lastIndex = 0;
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
      // If this element was previously marked as an LTR override inside an RTL
      // list, that's now stale — it became RTL, so drop the LTR override.
      if (el.hasAttribute(LTR_MARKER))      el.removeAttribute(LTR_MARKER);
    } else if (el.hasAttribute(RTL_MARKER)) {
      el.removeAttribute('dir');
      el.removeAttribute(RTL_MARKER);
      // Note: if this element is still inside an RTL list, reconcileList will
      // re-add dir="ltr" + LTR_MARKER on the next reconcile pass.
    }
  }

  // Reconciles ONE list: aligns <ul>/<ol> dir to match the majority of its
  // direct <li> children. If the list becomes RTL, explicitly anchors any
  // LTR children with dir="ltr" so they don't inherit the parent direction.
  function reconcileList(list) {
    if (list.closest(SKIP_ANCESTOR_SEL)) return;
    const items    = [...list.querySelectorAll(':scope > li')];
    if (!items.length) return;
    const rtlCount = items.filter((li) => li.hasAttribute(RTL_MARKER)).length;

    if (rtlCount / items.length > 0.5) {
      list.setAttribute('dir', 'rtl');
      list.setAttribute(LIST_MARKER, '');

      // Minority LTR items must be explicitly anchored to dir="ltr";
      // otherwise they inherit dir="rtl" from the parent and become unreadable.
      items.forEach((li) => {
        if (!li.hasAttribute(RTL_MARKER) && !li.hasAttribute(LTR_MARKER)
            && !li.getAttribute('dir')) {
          li.setAttribute('dir', 'ltr');
          li.setAttribute(LTR_MARKER, '');
        }
      });
    } else {
      if (list.hasAttribute(LIST_MARKER)) {
        list.removeAttribute('dir');
        list.removeAttribute(LIST_MARKER);
      }
      // Remove LTR anchors we added — the parent is now LTR so they're no
      // longer fighting an inherited dir="rtl".
      items.forEach((li) => {
        if (li.hasAttribute(LTR_MARKER)) {
          li.removeAttribute('dir');
          li.removeAttribute(LTR_MARKER);
        }
      });
    }
  }

  // Reconciles all lists within `root`, plus `root` itself if it is a list.
  function reconcileLists(root) {
    if (root.matches?.('ul, ol')) reconcileList(root);
    root.querySelectorAll?.('ul, ol').forEach(reconcileList);
  }

  // ---------------------------------------------------------------------------
  // Subtree processor — called for initial scan and every added node
  // ---------------------------------------------------------------------------

  function processSubtree(root) {
    // If root itself is a target block, process it.
    if (root.matches?.(BLOCK_SEL)) applyRTL(root);

    // Process all descendant blocks.
    root.querySelectorAll?.(BLOCK_SEL).forEach(applyRTL);

    // Reconcile all lists in this subtree (including root if it is a list).
    reconcileLists(root);

    // If root is a <li>, its parent <ul>/<ol> was not reached by reconcileLists
    // above (querySelectorAll only descends, never ascends). Reconcile it now.
    if (root.tagName === 'LI') {
      const parent = root.parentElement;
      if (parent?.matches?.('ul, ol')) reconcileList(parent);
    }
  }

  // ---------------------------------------------------------------------------
  // MutationObserver — handles SPA navigation and streamed responses
  // ---------------------------------------------------------------------------

  // Accumulate all characterData targets during the debounce window so that
  // multiple simultaneously-streaming paragraphs are all re-evaluated.
  const pendingCharData = new Set();
  let charDataTimer = null;

  function flushCharData() {
    for (const target of pendingCharData) {
      let el = target.parentElement;
      while (el && el !== document.body) {
        if (el.matches?.(BLOCK_SEL)) {
          applyRTL(el);
          // Reconcile the nearest ancestor list if this block is a list item.
          const list = el.closest('ul, ol');
          if (list) reconcileList(list);
          break;
        }
        el = el.parentElement;
      }
    }
    pendingCharData.clear();
  }

  const observer = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      if (mut.type === 'childList') {
        for (const node of mut.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          processSubtree(node);
        }
      } else if (mut.type === 'characterData') {
        pendingCharData.add(mut.target);
        clearTimeout(charDataTimer);
        charDataTimer = setTimeout(flushCharData, 80);
      }
    }
  });

  observer.observe(document.body, {
    childList:     true,
    subtree:       true,
    characterData: true,
  });

  // Initial pass over whatever is already in the DOM.
  processSubtree(document.body);
})();
