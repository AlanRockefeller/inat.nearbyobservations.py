// iNaturalist Genus Proximity Finder - Content Script (full)
//
// By Alan Rockefeller - November 10, 2025
//
// Version 1.2

class iNatGenusProximityFinder {
  constructor() {
    this.button = null;
    this.allButtons = [];
    this.observationId = null;
    this.init();
  }

  init() {
    console.log('iNat Genus Finder: Extension initializing...');
    this.setup();

    const observer = new MutationObserver(() => {
      this.setup();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  setup() {
    // Prevent running setup multiple times
    if (this.button) {
      return;
    }
    console.log('iNat Genus Finder: Setting up extension...');
    console.log('Current URL:', window.location.href);

    this.extractObservationId();
    console.log('Extracted observation ID:', this.observationId);

    if (this.observationId) {
      this.createButton();
    } else {
      console.log('iNat Genus Finder: No observation ID found, not adding button');
    }
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
    this.button.title = 'Find nearby observations of the same genus (or taxon) within 10 km';

    this.button.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleSearch('default');
    });

    // Add an overlayed button for guaranteed visibility
    const buttonWrapper = document.createElement('div');
    buttonWrapper.id = 'genus-proximity-button-wrapper';
    buttonWrapper.className = 'genus-proximity-wrapper';

    const label = document.createElement('div');
//    label.textContent = 'Find Nearby:';
    label.className = 'genus-proximity-label';

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
    buttonWrapper.appendChild(label);
    buttonWrapper.appendChild(this.button);

    // Small buttons row: day, Obs, big
    const smallRow = document.createElement('div');
    smallRow.className = 'genus-proximity-small-row';

    this.allButtons = [this.button];

    const modes = [
      { label: 'day', mode: 'day', title: 'Same genus, same day, 10 km' },
      { label: 'Obs', mode: 'obscured', title: 'Same genus, same month, obscured-friendly 32 km' },
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
    document.body.appendChild(buttonWrapper);

    console.log('iNat Genus Finder: Button added as positioned overlay');
  }

  async handleSearch(mode) {
    this.setAllButtonsLoading(true);
    try {
      const obs = await this.fetchObservationData();
      const {
        latitude,
        longitude,
        chosenTaxonId,
        chosenTaxonName,
        chosenTaxonRank
      } = await this.extractTaxonData(obs);

      const url = this.buildSearchUrl(mode, obs, latitude, longitude, chosenTaxonId, chosenTaxonName);

      const newWindow = window.open(url, '_blank');
      if (!newWindow) {
        // Handle pop-up blocker by redirecting the current window
        window.location.href = url;
      }

    } catch (err) {
      console.error('iNat Genus Finder Error:', err);
      alert(`Error: ${err.message || err}`);
    } finally {
      this.setAllButtonsLoading(false);
    }
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

  // Extract the appropriate taxon to use:
  // - If the observation is species (or lower), try to promote to genus (preferred behavior)
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

    // 2) If identified to species/subspecies/etc., try to find genus
    else if (['species', 'subspecies', 'variety', 'form', 'infraspecies'].includes(rank) || rank.includes('species')) {
      console.log('Observation identified to species-level; trying to promote to genus.');

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

      // (c) if parent_id present, fetch it
      if (!chosenTaxon.id && taxon.parent_id) {
        try {
          const parentResp = await fetch(`https://api.inaturalist.org/v1/taxa/${taxon.parent_id}`);
          if (parentResp.ok) {
            const parentData = await parentResp.json();
            const parentTaxon = parentData.results && parentData.results[0];
            if (parentTaxon && parentTaxon.rank && parentTaxon.rank.toLowerCase() === 'genus') {
              setChosenTaxon(parentTaxon, 'genus');
              console.log('Found genus via parent_id fetch:', chosenTaxon.name);
            }
          }
        } catch (err) {
          console.warn('Parent fetch failed:', err);
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

      // (e) fallback to species itself if no genus could be found
      if (!chosenTaxon.id) {
        setChosenTaxon(taxon, rank || 'species');
        console.warn('Could not determine genus — falling back to species taxon:', chosenTaxon.name);
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
      chosenTaxonName: chosenTaxon.name,
      chosenTaxonRank: chosenTaxon.rank
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

    switch (mode) {
      case 'default':
        params.set('radius', 10);
        break;

      case 'day': {
        params.set('radius', 10);
        // Use observed_on (date the observation was made in the observer's local time).
        // Falls back to created_at (upload date) if observed_on is unavailable.
        const dayDate = this.getObservedDate(obs);
        if (dayDate) params.set('on', dayDate);
        break;
      }

      case 'obscured': {
        // iNaturalist obscures coordinates by randomizing within a 0.2° x 0.2° box
        // (±0.1° in each direction). Max displacement from true location ≈ 15.7 km
        // (diagonal of the ±0.1° square). If both the current and target observations
        // are obscured, their displayed points can be up to ~31.4 km apart even when
        // the true locations are identical. 32 km is the smallest integer radius that
        // covers this worst case.
        params.set('radius', 32);
        const month = this.getObservedMonth(obs);
        if (month) params.set('month', month);
        // No geoprivacy filter — iNat search includes obscured observations by
        // default. Their coordinates are randomized but they still appear in
        // geographic searches; the expanded radius accounts for the coordinate shift.
        break;
      }

      case 'big':
        params.set('radius', 1000);
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

  capitalizeFirstLetter(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Minimal escaping helpers
  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  escapeAttribute(str) {
    return String(str).replace(/"/g, '&quot;');
  }
}

// Initialize when page loads
new iNatGenusProximityFinder();
