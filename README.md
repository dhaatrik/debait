# Honest Thumbnails for YouTube™

> **Show what's actually in the video.** Automatically replaces clickbait YouTube thumbnails with genuine video frames captured from the exact midpoint (50% halfway mark) of each video, with instant 1-click toggling between the honest frame and the creator's uploaded thumbnail.

---

## ✨ Features

- **🎯 True Halfway Frames**: Automatically replaces misleading custom thumbnails with real frames from halfway through the video (`hq720_2.jpg` in crisp 1280×720 HD with intelligent fallback).
- **⚡ Instant In-Page Navbar Toggle**: Adds a sleek, native-styled switch directly to YouTube's top navigation bar for one-click toggling of the entire page without reloading.
- **🔄 Per-Thumbnail Flip Button**: Curious what the creator's clickbait thumbnail looked like? Hover over any individual video thumbnail to reveal a quick-flip button and toggle just that video.
- **🏷️ "50%" Badge Indicator**: Subtle corner badge clearly marks which thumbnails are displaying the honest midpoint frame.
- **⌨️ Keyboard Shortcut (`Alt + H`)**: Toggle halfway thumbnails on/off on the fly with a single keystroke.
- **🎛️ Extension Popup**: Customize preferences, toggle individual features, and switch between High Definition (720p) and Standard Quality.
- **🛡️ 100% Privacy-Preserving**: Runs entirely inside your browser. Zero tracking, zero external telemetry, zero servers.

---

## 🚀 How to Deploy & Load in Your Browser

This extension is built with **Manifest V3** and runs on any modern Chromium-based browser (Google Chrome, Microsoft Edge, Brave, Opera, Vivaldi, Arc).

### Step 1: Open Extension Management
- **Google Chrome**: Navigate to `chrome://extensions` (or click `⋮` > **Extensions** > **Manage Extensions**).
- **Brave**: Navigate to `brave://extensions`.
- **Microsoft Edge**: Navigate to `edge://extensions`.

### Step 2: Enable Developer Mode
- In the top-right corner of the Extensions page, toggle the **"Developer mode"** switch to **ON**.

### Step 3: Load the Extension
1. Click the **"Load unpacked"** button in the top-left corner.
2. Select the folder containing this extension:
   ```
   E:\E Drive Projects\00 Github\honest-thumbnail
   ```
3. Click **Select Folder**.

### Step 4: Pin & Enjoy!
1. Click the puzzle piece icon (Extensions menu) in your browser toolbar.
2. Click the pin icon next to **Honest Thumbnails for YouTube™**.
3. Open or refresh [youtube.com](https://www.youtube.com). All video thumbnails will now display the halfway frame!

---

## 🎮 How to Use the Toggles

You have 4 easy ways to switch between the halfway frame and the creator's thumbnail:

| Method | Where to find it | What it does |
| :--- | :--- | :--- |
| **Top Bar Switch** | Top navigation bar on YouTube (next to search/profile) | Toggles all thumbnails on the page instantly with 1 click |
| **Keyboard Shortcut** | Press <kbd>Alt</kbd> + <kbd>H</kbd> anywhere on YouTube | Instantly flips all thumbnails between halfway & original |
| **Per-Thumbnail Flip** | Hover your mouse over any video card | Flips only that specific video's thumbnail |
| **Extension Popup** | Click extension icon in browser toolbar | Master toggle and granular customization settings |

---

## 🛠️ How It Works Technically

YouTube automatically captures and stores keyframes from videos on its high-speed image CDN (`i.ytimg.com`):
- `https://i.ytimg.com/vi/<VIDEO_ID>/hq720_2.jpg` — 1280×720 (16:9 HD frame at the 50% midpoint)
- `https://i.ytimg.com/vi/<VIDEO_ID>/hq2.jpg` — 480×360 (universal fallback frame at the 50% midpoint)
- `https://i.ytimg.com/vi/<VIDEO_ID>/2.jpg` — 120×90 (low-bandwidth fallback)

**Honest Thumbnails** uses a lightweight `MutationObserver` and YouTube SPA navigation listener to detect video containers. It preserves the original thumbnail URLs, extracts the 11-character video ID, and seamlessly loads the halfway frame with automatic error-fallback chains. When toggled back, the creator's high-res thumbnail and `srcset` are restored instantly without re-fetching.

---

## 📁 File Structure

```
honest-thumbnail/
├── manifest.json              # Chrome Manifest V3 configuration
├── background.js             # Service worker: settings & keyboard shortcuts
├── content/
│   ├── content.js            # Injected script: thumbnail replacer & masthead toggle
│   └── content.css           # Styling for toggle switch, badges, and flip buttons
├── popup/
│   ├── popup.html            # Extension popup layout
│   ├── popup.css             # Dark theme styling
│   └── popup.js              # Popup controller & state sync
├── icons/
│   ├── icon-16.png           # 16x16 icon
│   ├── icon-48.png           # 48x48 icon
│   └── icon-128.png          # 128x128 icon
├── CHROMEWEBSTORE.md         # Store listing metadata & privacy justifications
└── README.md                 # Documentation and user guide
```

---

## 📄 License
MIT License. Free and open source.
