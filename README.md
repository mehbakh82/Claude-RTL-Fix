# Claude RTL Fix

A browser extension that fixes right-to-left (RTL) text rendering for Persian responses in [Claude.ai](https://claude.ai).

Claude's web client does not detect RTL languages and renders all text left-to-right, making Persian (and mixed Persian/English) responses scrambled and hard to read. This extension watches for Persian text in assistant messages and applies the correct `dir="rtl"` direction automatically — without touching English-only responses or code blocks.

---

## Features

- Detects Persian (Farsi) and Arabic-script text using Unicode range matching
- Applies RTL direction per paragraph/heading/list-item — not globally
- Mixed code-switched paragraphs (Persian + English) are handled correctly
- Code blocks (`<pre>`, `<code>`) always remain left-to-right
- Works on dynamically rendered content and live-streamed responses via MutationObserver
- Zero external dependencies, no network requests

---

## Browser Support

| Browser | Support |
|---------|---------|
| Chrome 88+ | ✅ Native (Manifest V3) |
| Microsoft Edge 88+ | ✅ Native |
| Opera 74+ | ✅ Native |
| Brave | ✅ Native |
| Firefox 101+ | ✅ Native (MV3) |
| Safari 15.4+ | ⚠️ Requires Xcode conversion (see below) |

---

## Installation

### Step 1 — Generate icons (one-time)

Open `icons/create-icons.html` in any browser, download the three PNG files it generates, and save them into the `icons/` folder:

```
icons/icon16.png
icons/icon48.png
icons/icon128.png
```

### Step 2 — Load as unpacked extension

#### Chrome / Edge / Brave / Opera

1. Go to `chrome://extensions` (or `edge://extensions`, etc.)
2. Enable **Developer mode** (toggle, top-right)
3. Click **Load unpacked**
4. Select this folder (`Claude RTL Fix/`)
5. Visit [claude.ai](https://claude.ai) — Persian responses are now RTL

#### Firefox

1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select the `manifest.json` file inside this folder
4. The extension stays active until Firefox restarts

   For a permanent install without the Mozilla Add-ons store, set `xpinstall.signatures.required` to `false` in `about:config` and pack the extension as a `.zip` renamed to `.xpi`.

#### Safari

Safari requires conversion via Xcode:

```bash
# Requires Xcode 13+ and macOS 12+
xcrun safari-web-extension-converter "/path/to/Claude RTL Fix" \
  --project-location ~/Desktop \
  --app-name "ClaudeRTLFix"
```

Open the generated Xcode project, build it, then enable the extension in Safari → Settings → Extensions.

---

## How it works

`content.js` injects a `MutationObserver` that watches every change to the Claude.ai DOM. For each block-level element (`<p>`, headings, `<li>`, `<blockquote>`, etc.) it:

1. Extracts text content, stripping any nested `<code>` / `<pre>` elements
2. Calculates the fraction of "significant" characters (non-whitespace, non-digit, non-ASCII-punctuation) that fall in Unicode RTL script ranges (U+0600–U+06FF and related blocks)
3. If that fraction exceeds 15%, sets `dir="rtl"` on the element
4. After processing list items, realigns the parent `<ul>/<ol>` so bullet/number markers appear on the correct side
5. Removes its own attributes if re-evaluation later finds the element is no longer RTL (e.g., the threshold is no longer met)

The 15% threshold is intentionally low to catch paragraphs that start in Persian and switch to English mid-sentence.

---

## Files

```
Claude RTL Fix/
├── manifest.json         # WebExtension Manifest V3
├── content.js            # RTL detection + MutationObserver logic
├── styles.css            # direction/text-align overrides
├── icons/
│   ├── create-icons.html # Open in browser to generate icon PNGs
│   ├── icon16.png        # Generated icon (16×16)
│   ├── icon48.png        # Generated icon (48×48)
│   └── icon128.png       # Generated icon (128×128)
└── README.md
```

---

## Contributing

Pull requests welcome. If Claude.ai changes its DOM structure and the extension stops working, please open an issue with a screenshot and the selector path to the message container.

---

## License

MIT
