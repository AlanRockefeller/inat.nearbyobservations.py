# iNaturalist Genus Proximity Finder (Browser Extension)

When you’re viewing an observation on **iNaturalist**, this extension adds a button that helps you quickly find **other nearby observations from the same genus** (or the closest taxonomic level available).

It’s handy for:
- Seeing what similar observations nearby have been identified as
- Checking if an ID suggestion makes sense in that area
- Exploring related species around an observation

---

## What you’ll see / what it does

On an iNaturalist observation page, the extension adds a green button:

**🔍 Find Nearby**

When you click it:
1. The extension looks at the observation’s identification (genus if possible).
2. It opens a **new iNaturalist search tab** showing other observations of that same group **within 10 km**.

If the observation isn’t identified to genus, it will use a higher group (family/order/etc.) when needed.

---

## Before you start (important)

This extension is **not** installed from the Chrome Web Store or Firefox Add-ons store.  
That means you install it manually from the files, one time.

You will need:
- A computer (Windows / Mac / Linux)
- Chrome (or a Chrome-based browser) **or** Firefox
- The extension folder on your computer (downloaded from GitHub or provided as a ZIP)

---

## Step 1 — Get the extension files onto your computer

### Option A: Download as a ZIP (easiest)
1. Download the project as a ZIP file.
2. Unzip it (extract it) somewhere you can find again, like your Desktop.

✅ **You should end up with a folder** that contains a subfolder named:

`browser-extension`

---

## Step 2 — Install in Chrome (or Edge / Brave)

1. Open Chrome.
2. In the address bar, type:  
   `chrome://extensions`  
   and press **Enter**.
3. Turn on **Developer mode** (top-right switch).
4. Click **Load unpacked**.
5. Select the folder named **`browser-extension`**.

✅ **You should now see the extension appear in your extensions list.**  
If it worked, it will have a name and an “Enabled” toggle.

### If Chrome says it can’t load it
- Make sure you selected the **`browser-extension`** folder itself (not the parent folder).
- Make sure the folder contains a `manifest.json` file inside it.

---

## Step 3 — Install in Firefox (temporary install)

Firefox allows this extension as a **temporary add-on**, which means:
- It works immediately
- But you may need to re-load it after restarting Firefox

To install:

1. Open Firefox.
2. In the address bar, type:  
   `about:debugging#/runtime/this-firefox`  
   and press **Enter**.
3. Click **Load Temporary Add-on…**
4. Open the **`browser-extension`** folder.
5. Select the file named **`manifest.json`**.

✅ **You should see the extension listed as a temporary add-on.**

> Note: Some Firefox setups restrict unsigned extensions more strictly than others. If you run into a “signing” or “not allowed” error, tell me what the message says and I’ll help you choose the safest workaround.

---

## How to use it

1. Go to any iNaturalist observation page. Example:  
   https://www.inaturalist.org/observations/313200882
2. Look near the top of the page for a green button:  
   **🔍 Find Nearby**
3. Click it.
4. A new tab opens with a search for nearby observations of the same genus (or nearest taxon).

✅ If a new iNaturalist search tab opens, it’s working.

---

## Troubleshooting (quick fixes)

**I don’t see the green button**
- Refresh the iNaturalist page (Ctrl+R / Cmd+R)
- Make sure the extension is **enabled**
- Open an observation page on `https://www.inaturalist.org/observations/...` (it won’t appear on other sites)

**It installed, but nothing happens when I click**
- Check if your browser blocked popups from iNaturalist (allow popups for the site)
- Try a different observation page

---

—Alan Rockefeller  
February 16, 2026
