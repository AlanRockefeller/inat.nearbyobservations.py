// iNaturalist Genus Proximity Finder - Content Script (full)
//
// By Alan Rockefeller - November 9, 2026
//
// Version 1.2

// iNaturalist rank_level of a genus. Anything with a lower level (subgenus,
// section, complex, species, hybrid, subspecies, variety, form...) sits inside
// a genus and gets promoted to it.
const GENUS_RANK_LEVEL = 20;

// Used only when the API response has no rank_level.
const BELOW_GENUS_RANKS = [
  'subgenus', 'section', 'subsection', 'complex',
  'species', 'hybrid', 'subspecies', 'variety', 'form', 'infrahybrid', 'infraspecies'
];

// Search radii in km.
const RADIUS_DEFAULT = 10;
// iNaturalist obscures a location by replacing it with a random point inside
// the 0.2° x 0.2° grid cell that contains the true location. Two observations
// made at the same spot can therefore be shown up to one cell diagonal apart
// (about 31.4 km at the equator, less elsewhere). 32 km is the smallest whole
// radius that covers that worst case.
const RADIUS_OBSCURED = 32;
const RADIUS_BIG = 1000;

class iNatGenusProximityFinder {
  constructor() {
    this.button = null;
    this.allButtons = [];
    this.status = null;
    this.observationId = null;
    this.init();
  }

  init() {
    // The manifest also matches pages such as /observations/identify, which
    // have no observation ID. Do nothing there.
    this.extractObservationId();
    if (!this.observationId) return;
    this.createButton();
  }

  extractObservationId() {
    const match = window.location.pathname.match(/\/observations\/(\d+)/);
    if (match) {
      this.observationId = match[1];
    }
  }

  createButton() {
    // remove existing
    const existing = document.getElementById('genus-proximity-button-wrapper');
    if (existing) existing.remove();

    this.button = document.createElement('button');
    this.button.id = 'genus-proximity-button';
    this.button.className = 'genus-proximity-btn';
    this.button.innerHTML = '🔍 Find Nearby';
    this.button.title = 'Find nearby observations of the same genus (or taxon) within 10 km (32 km if the location is obscured)';

    this.button.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleSearch('default');
    });

    // Add an overlayed button for guaranteed visibility
    const buttonWrapper = document.createElement('div');
    buttonWrapper.id = 'genus-proximity-button-wrapper';
    buttonWrapper.className = 'genus-proximity-wrapper';

    const closeButton = document.createElement('button');
    closeButton.id = 'genus-proximity-close-button';
    closeButton.innerHTML = '&times;';
    closeButton.title = 'Hide this panel';
    closeButton.setAttribute('aria-label', 'Close');
    closeButton.type = 'button';
    closeButton.addEventListener('click', () => {
      buttonWrapper.style.display = 'none';
    });

    buttonWrapper.appendChild(closeButton);
    buttonWrapper.appendChild(this.button);

    // Small buttons row: day, Obs, big
    const smallRow = document.createElement('div');
    smallRow.className = 'genus-proximity-small-row';

    this.allButtons = [this.button];

    const modes = [
      { label: 'day', mode: 'day', title: 'Same genus, same day, 10 km (32 km if the location is obscured)' },
      { label: 'Obs', mode: 'obscured', title: 'Same genus, same month, 32 km (for obscured locations)' },
      { label: 'big', mode: 'big', title: 'Same genus, 1000 km radius' },
    ];

    for (const { label: text, mode, title } of modes) {
      const btn = document.createElement('button');
      btn.className = 'genus-proximity-btn-small';
      btn.textContent = text;
      btn.title = title;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleSearch(mode);
      });
      smallRow.appendChild(btn);
      this.allButtons.push(btn);
    }

    buttonWrapper.appendChild(smallRow);

    // Notes and errors are shown here instead of in a blocking alert().
    this.status = document.createElement('div');
    this.status.className = 'genus-proximity-status';
    this.status.setAttribute('role', 'status');
    this.status.hidden = true;
    buttonWrapper.appendChild(this.status);

    document.body.appendChild(buttonWrapper);
  }

  async handleSearch(mode) {
    this.setAllButtonsLoading(true);
    this.showStatus(null);
    try {
      const obs = await this.fetchObservationData();
      const {
        latitude,
        longitude,
        chosenTaxonId,
        chosenTaxonName
      } = await this.extractTaxonData(obs);

      const url = this.buildSearchUrl(mode, obs, latitude, longitude, chosenTaxonId, chosenTaxonName);

      const newWindow = window.open(url, '_blank');
      if (!newWindow) {
        // Handle pop-up blocker by redirecting the current window
        window.location.href = url;
        return;
      }

      if (obs.obscured && (mode === 'default' || mode === 'day')) {
        this.showStatus(
          `This location is obscured, so the search used ${RADIUS_OBSCURED} km instead of ${RADIUS_DEFAULT} km.`
        );
      }
    } catch (err) {
      console.error('iNat Genus Finder Error:', err);
      this.showStatus(err.message || String(err), true);
    } finally {
      this.setAllButtonsLoading(false);
    }
  }

  // Show a note (or an error) inside the panel. Pass null to clear it.
  showStatus(message, isError = false) {
    if (!this.status) return;
    this.status.textContent = message || '';
    this.status.hidden = !message;
    this.status.classList.toggle('genus-proximity-status-error', Boolean(message) && isError);
  }

  setAllButtonsLoading(loading) {
    for (const btn of this.allButtons) {
      btn.disabled = loading;
    }
    if (this.button) {
      this.button.innerHTML = loading ? '⏳ Loading...' : '🔍 Find Nearby';
    }
  }

  async fetchObservationData() {
    if (!this.observationId) throw new Error('No observation ID available');
    const url = `https://api.inaturalist.org/v1/observations/${this.observationId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch observation data (${response.status})`);
    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      throw new Error(`No observation found with ID: ${this.observationId}`);
    }
    return data.results[0];
  }

  // True when the taxon sits inside a genus (subgenus, section, complex,
  // species, hybrid, subspecies, variety, form...).
  isBelowGenus(taxon) {
    if (typeof taxon.rank_level === 'number') {
      return taxon.rank_level < GENUS_RANK_LEVEL;
    }
    const rank = (taxon.rank || '').toLowerCase();
    return BELOW_GENUS_RANKS.includes(rank) || rank.includes('species');
  }

  // Extract the appropriate taxon to use:
  // - If the observation is below genus (species, complex, section, etc.), promote to genus
  // - If genus, use genus
  // - If higher than genus (family/order/etc.), use that taxon as-is
  async extractTaxonData(obsData) {
    // coordinates: prefer obsData.location if present, otherwise geojson
    let latitude = null, longitude = null;
    if (obsData.location) {
      const parts = obsData.location.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length === 2) {
        latitude = parseFloat(parts[0]);
        longitude = parseFloat(parts[1]);
      }
    }
    if ((latitude === null || longitude === null) && obsData.geojson && Array.isArray(obsData.geojson.coordinates)) {
      longitude = obsData.geojson.coordinates[0];
      latitude = obsData.geojson.coordinates[1];
    }
    if (latitude === null || longitude === null || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      throw new Error("This observation doesn't have usable GPS coordinates available");
    }

    const taxon = obsData.taxon;
    if (!taxon) {
      throw new Error("This observation doesn't have taxonomic information");
    }

    console.log('Taxon data:', taxon);

    let chosenTaxon = {
      id: null,
      name: null,
      rank: null,
    };

    const rank = (taxon.rank || '').toLowerCase();

    const setChosenTaxon = (t, r) => {
      chosenTaxon.id = t.id;
      chosenTaxon.name = t.name;
      chosenTaxon.rank = r;
    };

    // 1) If the taxon itself is genus -> use it
    if (rank === 'genus') {
      setChosenTaxon(taxon, 'genus');
      console.log('Using taxon (genus):', chosenTaxon.name, chosenTaxon.id);
    }

    // 2) If identified below genus (species, complex, section, subgenus, etc.), try to find genus
    else if (this.isBelowGenus(taxon)) {
      console.log('Observation identified below genus; trying to promote to genus.');

      // (a) check ancestors array (most reliable)
      if (Array.isArray(taxon.ancestors) && taxon.ancestors.length) {
        const genAnc = taxon.ancestors.find(a => a && a.rank && a.rank.toLowerCase() === 'genus');
        if (genAnc) {
          setChosenTaxon(genAnc, 'genus');
          console.log('Found genus in ancestors:', chosenTaxon.name);
        }
      }

      // (b) check parent object
      if (!chosenTaxon.id && taxon.parent && taxon.parent.rank && taxon.parent.rank.toLowerCase() === 'genus') {
        setChosenTaxon(taxon.parent, 'genus');
        console.log('Found genus in parent object:', chosenTaxon.name);
      }

      // (c) fetch the taxon itself, which includes its full ancestor list
      if (!chosenTaxon.id && taxon.id) {
        try {
          const taxonResp = await fetch(`https://api.inaturalist.org/v1/taxa/${taxon.id}`);
          if (taxonResp.ok) {
            const taxonData = await taxonResp.json();
            const fullTaxon = taxonData.results && taxonData.results[0];
            const ancestors = (fullTaxon && fullTaxon.ancestors) || [];
            const genAnc = ancestors.find(a => a && a.rank && a.rank.toLowerCase() === 'genus');
            if (genAnc) {
              setChosenTaxon(genAnc, 'genus');
              console.log('Found genus via taxon fetch:', chosenTaxon.name);
            }
          }
        } catch (err) {
          console.warn('Taxon fetch failed:', err);
        }
      }

      // (d) attempt to extract first word of scientific name and search API for genus
      if (!chosenTaxon.id) {
        const scientificName = (taxon.name || '').trim();
        if (scientificName && !scientificName.startsWith('×') && scientificName.includes(' ')) {
          const potentialGenus = scientificName.split(/\s+/)[0].trim(); // <-- correct split
          console.log('Potential genus extracted from name:', potentialGenus);
          try {
            const foundId = await this.findGenusIdByName(potentialGenus);
            chosenTaxon.id = foundId;
            chosenTaxon.name = potentialGenus;
            chosenTaxon.rank = 'genus';
            console.log('Found genus via taxa search:', chosenTaxon.name, foundId);
          } catch (err) {
            console.warn('Could not find genus via taxa search:', err);
          }
        }
      }

      // (e) fallback to the taxon itself if no genus could be found
      if (!chosenTaxon.id) {
        setChosenTaxon(taxon, rank || 'species');
        console.warn('Could not determine genus — falling back to the observation taxon:', chosenTaxon.name);
      }
    }

    // 3) If taxon is higher than genus (family/order/etc.), just use that taxon
    else {
      setChosenTaxon(taxon, rank || 'taxon');
      console.log('Using higher-level taxon as provided:', chosenTaxon.rank, chosenTaxon.name);
    }

    console.log('Final chosen taxon:', { chosenTaxonName: chosenTaxon.name, chosenTaxonId: chosenTaxon.id, chosenTaxonRank: chosenTaxon.rank, latitude, longitude });
    return {
      latitude,
      longitude,
      chosenTaxonId: chosenTaxon.id,
      chosenTaxonName: chosenTaxon.name
    };
  }

  // Search taxa endpoint for an exact/close genus match
  async findGenusIdByName(genusName) {
    const url = 'https://api.inaturalist.org/v1/taxa';
    const params = new URLSearchParams({
      q: genusName,
      rank: 'genus',
      is_active: 'true',
      per_page: '50'
    });

    const response = await fetch(`${url}?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to search for genus');
    }

    const data = await response.json();
    const lower = genusName.toLowerCase();

    // exact case-insensitive match
    let match = (data.results || []).find(r => r.rank && r.rank.toLowerCase() === 'genus' && r.name && r.name.toLowerCase() === lower);
    if (match) return match.id;

    // startsWith fallback
    match = (data.results || []).find(r => r.rank && r.rank.toLowerCase() === 'genus' && r.name && r.name.toLowerCase().startsWith(lower));
    if (match) return match.id;

    throw new Error(`No match found for genus '${genusName}'`);
  }

  buildSearchUrl(mode, obs, latitude, longitude, taxonId, taxonName) {
    const params = new URLSearchParams({
      lat: latitude,
      lng: longitude,
      subview: 'map'
    });

    if (taxonId) {
      params.set('taxon_id', taxonId);
    } else if (taxonName) {
      params.set('taxon_name', taxonName);
    }

    // An obscured observation is shown at a random point near its true
    // location, so a 10 km search around that point can miss everything that
    // was really nearby. Widen the search for those.
    const nearbyRadius = obs.obscured ? RADIUS_OBSCURED : RADIUS_DEFAULT;

    switch (mode) {
      case 'default':
        params.set('radius', nearbyRadius);
        break;

      case 'day': {
        params.set('radius', nearbyRadius);
        // Use observed_on (date the observation was made in the observer's local time).
        // Falls back to created_at (upload date) if observed_on is unavailable.
        const dayDate = this.getObservedDate(obs);
        if (dayDate) params.set('on', dayDate);
        break;
      }

      case 'obscured': {
        // No geoprivacy filter — iNat search includes obscured observations by
        // default. Their coordinates are randomized but they still appear in
        // geographic searches; the wider radius accounts for the coordinate shift.
        params.set('radius', RADIUS_OBSCURED);
        const month = this.getObservedMonth(obs);
        if (month) params.set('month', month);
        break;
      }

      case 'big':
        params.set('radius', RADIUS_BIG);
        break;
    }

    return `https://www.inaturalist.org/observations?${params.toString()}`;
  }

  // Returns YYYY-MM-DD string, or null.
  // Prefers observed_on (observer's local date); falls back to created_at (upload timestamp).
  getObservedDate(obs) {
    if (obs.observed_on) return obs.observed_on;
    if (obs.created_at) return obs.created_at.slice(0, 10);
    return null;
  }

  // Returns month number (1-12), or null.
  getObservedMonth(obs) {
    if (obs.observed_on_details && obs.observed_on_details.month) {
      return obs.observed_on_details.month;
    }
    const date = this.getObservedDate(obs);
    if (date) {
      const month = parseInt(date.slice(5, 7), 10);
      if (month >= 1 && month <= 12) return month;
    }
    return null;
  }
}

// Initialize when page loads
new iNatGenusProximityFinder();
