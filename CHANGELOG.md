# Changelog

## 1.3 - 2026-11-12

### Added

- Firefox support: the manifest now has a Firefox add-on ID, a minimum version (Firefox 140) and a data collection declaration, so the extension can be signed by Mozilla and installed permanently. It passes `web-ext lint` with no warnings.
- The command-line tool has the extension's search modes: `--mode nearby|day|obs|big` (or `-m`).
- The extension runs on iNaturalist network sites such as `mexico.inaturalist.org`, and opens searches on the site you're on.
- `build-zip.sh` also builds `dist/genus-proximity-finder-<version>.zip`, with `manifest.json` at the top level, for uploading to addons.mozilla.org or the Chrome Web Store.

### Changed

- Renamed to **Genus Proximity Finder for iNaturalist**, following Mozilla's add-on naming policy, which discourages names that start with another brand.
- The command-line tool now matches the extension:
  - It searches 10 km instead of 1 km, and 32 km when the location is obscured.
  - Complex, section, subgenus and hybrid identifications search the whole genus.
  - Family-level and higher identifications search that taxon instead of failing.
  - It falls back to the observation's GeoJSON point when `location` is missing, and API requests time out after 30 seconds.
- The extension sets button labels with `textContent` instead of `innerHTML`, and only logs its step-by-step taxon lookup to the console when `DEBUG` is turned on in `content.js`.
- The Firefox install instructions now cover permanent installs on Developer Edition, Nightly and ESR, and no longer suggest turning off signature checks on regular Firefox, where that setting has no effect.

## 1.2 - 2026-11-09

### Added

- Three smaller buttons below **Find Nearby**:
  - **day** — same genus within 10 km, observed on the same day.
  - **Obs** — same genus within 32 km in the same month, to find obscured observations made at the same location.
  - **big** — same genus within 1000 km.

- PNG icons, so Chrome shows the extension's icon instead of a placeholder.
- `build-zip.sh` to rebuild `browser-extension.zip`.

### Changed

- Observations identified to a complex, section, subgenus or hybrid now search the whole genus, like species already did.
- **Find Nearby** and **day** search 32 km instead of 10 km when the observation's location is obscured, and the panel says so.
- Errors are shown inside the panel instead of in a pop-up alert.
- The panel moves left in a narrow window instead of ending up off-screen.
- Removed the unused `activeTab` and `www.inaturalist.org` host permissions.

### Fixed

- The panel is no longer drawn on top of an observation photo when the photo is expanded.
- The extension no longer keeps re-running its setup on pages without an observation, such as Identify.

## 1.1 - 2025-11-10

### Added

- Added a close button to the extension's UI to allow users to hide it.
