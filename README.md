# Genus Proximity Finder for iNaturalist — Browser Extension version 1.3

Ever been on an iNaturalist observation page and wondered what else is around from the same genus?   This browser extension makes it easy to check - I like to use it to see what other people have identified nearby observations as, or if someone gives you an ID, find nearby observations that it also might apply to.


## What it does

Basically, when you're looking at an observation on iNaturalist, this extension adds a button. Click it, and it'll try its best to figure out the genus (or a higher taxonomic group if genus is tricky) of that observation. Then it'll open up a new iNaturalist search page showing you other observations of that same genus within a 10 km radius. Super useful for finding related species or just exploring what else is nearby.

![Screenshot](screenshot.jpg)

## How to Install

Since this is a browser extension, you'll need to load it manually into your browser (like Chrome or Firefox).

1.  **Download/Clone:** Get the extension files onto your computer.
2.  **Open Extension Management:**
    *   **Chrome:** Go to `chrome://extensions/`
    *   **Firefox (140 or newer):** Go to `about:debugging#/runtime/this-firefox`.
3.  **Enable Developer Mode (Chrome only):** Toggle the "Developer mode" switch in the top right.
4.  **Load Unpacked:**
    *   **Chrome:** Click the "Load unpacked" button in the top left and select the `browser-extension` folder.
    *   **Firefox:** Click "Load Temporary Add-on..." and select the `manifest.json` file in the `browser-extension` folder. Firefox removes temporary add-ons when it restarts; see [`browser-extension/README.md`](browser-extension/README.md) for a permanent install on Firefox Developer Edition, Nightly or ESR.

Your extension should now be active!

There's also a command-line version in [`command-line/`](command-line/README.md) that prints the same search URLs.

## How to Use It

1.  Navigate to any observation page on [iNaturalist.org] - for example https://www.inaturalist.org/observations/313200882.
2.  Look for a green button that says **"🔍 Find Nearby"**. It usually pops up near the top of the page.
3.  Click that button!
4.  A new tab will open showing you iNaturalist observations of the same genus nearby. 


If the observation is identified to species level, the extension tries to find and use the genus for the search. If the observation is identified as a higher level taxon, it'll show nearby observations of that taxon.



--Alan Rockefeller
November 10, 2025
