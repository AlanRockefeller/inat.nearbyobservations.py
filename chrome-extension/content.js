// iNaturalist Genus Proximity Finder - Content Script (full)
//
// By Alan Rockefeller - September 24, 2025
// 
// Version 1.0

class iNatGenusProximityFinder {
  constructor() {
    this.button = null;
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
    const existing = document.getElementById('genus-proximity-button');
    if (existing) existing.remove();

    this.button = document.createElement('button');
    this.button.id = 'genus-proximity-button';
    this.button.className = 'genus-proximity-btn';
    this.button.innerHTML = '🔍 Find Nearby Genus';
    this.button.title = 'Find nearby observations of the same genus (or taxon) within 1 km';

    this.button.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleButtonClick();
    });

    // Add an overlayed button for guaranteed visibility
    const buttonWrapper = document.createElement('div');
    buttonWrapper.className = 'genus-proximity-wrapper';

    const label = document.createElement('div');
    label.textContent = 'Find Nearby:';
    label.className = 'genus-proximity-label';

    buttonWrapper.appendChild(label);
    buttonWrapper.appendChild(this.button);
    document.body.appendChild(buttonWrapper);

    console.log('iNat Genus Finder: Button added as positioned overlay');
  }

  async handleButtonClick() {
    this.setButtonLoading(true);
    try {
      const obs = await this.fetchObservationData();
      const {
        latitude,
        longitude,
        chosenTaxonId,
        chosenTaxonName,
        chosenTaxonRank
      } = await this.extractTaxonData(obs);

      const url = this.generateProximityUrl(latitude, longitude, chosenTaxonId, chosenTaxonName);

      // Open the URL directly in a new window
      const newWindow = window.open(url, '_blank');
      if (!newWindow) {
        // Handle pop-up blocker by redirecting the current window
        window.location.href = url;
      }

    } catch (err) {
      console.error('iNat Genus Finder Error:', err);
      alert(`Error: ${err.message || err}`);
    } finally {
      this.setButtonLoading(false);
    }
  }

  setButtonLoading(loading) {
    if (!this.button) return;
    if (loading) {
      this.button.innerHTML = '⏳ Loading...';
      this.button.disabled = true;
    } else {
      this.button.innerHTML = '🔍 Find Nearby Genus';
      this.button.disabled = false;
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

  generateProximityUrl(latitude, longitude, taxonId, taxonName) {
    const params = new URLSearchParams({
      lat: latitude,
      lng: longitude,
      radius: 10,
      subview: 'map'
    });

    // prefer taxon_id when available (more robust)
    if (taxonId) {
      params.set('taxon_id', taxonId);
    } else if (taxonName) {
      params.set('taxon_name', taxonName);
    }

    return `https://www.inaturalist.org/observations?${params.toString()}`;
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
