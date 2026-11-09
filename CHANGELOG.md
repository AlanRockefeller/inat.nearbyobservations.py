# Changelog

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
