# Claude RTL Fix

A browser extension that fixes right-to-left (RTL) text rendering for Persian responses in [Claude.ai](https://claude.ai).

Claude's web client does not detect RTL languages and renders everything left-to-right, making Persian (and mixed Persian/English) responses scrambled and unreadable. This extension watches for Persian text in assistant messages and applies the correct `dir="rtl"` direction automatically — without touching English-only responses or code blocks.

---

## Features

- Detects Persian (Farsi) and Arabic-script text using Unicode range matching
- Applies RTL direction per paragraph / heading / list-item — not globally
- Mixed code-switched paragraphs (e.g. Persian explaining a Python function) are handled correctly
- Code blocks (`<pre>`, `<code>`) always remain left-to-right
- Markdown tables with Persian cell content are aligned correctly
- Works on dynamically rendered content and live-streamed responses via `MutationObserver`
- Zero external dependencies, no network requests

---

## Browser Support

| Browser | Support |
| ------- | ------- |
| Chrome 88+ | ✅ Native (Manifest V3) |
| Microsoft Edge 88+ | ✅ Native |
| Opera 74+ | ✅ Native |
| Brave | ✅ Native |
| Firefox 101+ | ✅ Native (MV3) |
| Safari 15.4+ | ✅ Works — requires a one-time Xcode build (see below) |

---

## Installation

### Chrome / Edge / Brave / Opera

1. Go to `chrome://extensions` (or `edge://extensions`, etc.)
2. Enable **Developer mode** (toggle, top-right)
3. Click **Load unpacked**
4. Select this folder (`Claude RTL Fix/`)
5. Visit [claude.ai](https://claude.ai) — Persian responses are now RTL ✓

### Firefox

1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select the `manifest.json` file inside this folder
4. The extension stays active until Firefox restarts

   For a permanent install without the add-ons store, set `xpinstall.signatures.required` to `false` in `about:config`, then pack the folder as a `.zip` and rename it to `.xpi`.

### Safari

Safari requires a one-time Xcode build. You do **not** need a paid Apple Developer account for personal use on your own Mac.

**Requirements:** macOS 12+, Xcode 13+ (free from the App Store)

**Step 1 — Convert the extension:**

```bash
xcrun safari-web-extension-converter \
  "/Users/$(whoami)/Documents/Claude RTL Fix" \
  --project-location ~/Desktop \
  --app-name "ClaudeRTLFix" \
  --bundle-identifier "com.local.claude-rtl-fix"
```

This generates a full Xcode project on your Desktop.

**Step 2 — Build and install:**

1. Open the generated `.xcodeproj` in Xcode
2. Set the scheme to **My Mac** (not a simulator)
3. Press **⌘R** to build and run — a small macOS wrapper app launches
4. Quit the wrapper app (it only needs to run once to register the extension)

**Step 3 — Enable in Safari:**

1. Open **Safari → Settings → Extensions**
2. Check the box next to **ClaudeRTLFix**
3. Click **Always Allow on claude.ai** when prompted

The extension is now permanently installed. You don't need to rebuild or run the wrapper app again unless you update the extension's source files.

**Rebuilding after updates:** If you pull new changes from this repo, repeat Steps 1–3. The Xcode project and app will be overwritten.

---

## How it works

`content.js` injects a `MutationObserver` that watches every DOM change on Claude.ai. For each block-level element (`<p>`, headings, `<li>`, `<blockquote>`, `<td>`, `<th>`, etc.) it:

1. Extracts text content, stripping any nested `<code>` / `<pre>` elements
2. Calculates the fraction of "significant" characters (non-whitespace, non-digit, non-ASCII-punctuation) that fall in Unicode RTL script ranges (U+0600–U+06FF and related blocks)
3. If that fraction exceeds **15%**, sets `dir="rtl"` on the element
4. After processing list items, aligns the parent `<ul>/<ol>` so that bullet and number markers appear on the right side
5. Removes its own attributes if re-evaluation finds the element is no longer RTL (e.g., during an edit)

The 15% threshold is intentionally low to catch paragraphs that open in Persian and switch to English mid-sentence.

---

## Files

```text
Claude RTL Fix/
├── manifest.json         # WebExtension Manifest V3
├── content.js            # RTL detection + MutationObserver logic
├── styles.css            # direction/text-align overrides
├── icons/
│   ├── create-icons.html # Open in browser to regenerate icon PNGs
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── LICENSE
└── README.md
```

---

## Contributing

Pull requests welcome. If Claude.ai updates its DOM structure and the extension stops working, please open an issue with a screenshot and the selector path to the message container.

---

## License

MIT — see [LICENSE](LICENSE)
