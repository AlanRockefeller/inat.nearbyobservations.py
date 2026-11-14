#!/usr/bin/env python3
"""
Genus Proximity Finder for iNaturalist (command-line version)

This script takes an iNaturalist observation number or URL as input,
works out the observation's location and genus, then prints a URL that
finds observations of the same genus near that location.

It mirrors the browser extension, including its search modes:

  nearby  same genus within 10 km (32 km if the location is obscured)
  day     same genus within 10 km (32 km if obscured), observed on the same day
  obs     same genus within 32 km in the same month, to find obscured
          observations made at the same location
  big     same genus within 1000 km

By Alan Rockefeller

November 12, 2026

Version 1.3
"""

import argparse
import re
import sys
from urllib.parse import parse_qs, urlencode, urlparse

import requests

INATURALIST_API_URL = "https://api.inaturalist.org/v1"
INATURALIST_OBSERVATIONS_URL = "https://www.inaturalist.org/observations"
REQUEST_TIMEOUT = 30  # seconds

# iNaturalist rank_level of a genus. Anything with a lower level (subgenus,
# section, complex, species, hybrid, subspecies, variety, form...) sits inside
# a genus and gets promoted to it.
GENUS_RANK_LEVEL = 20

# Used only when the API response has no rank_level.
BELOW_GENUS_RANKS = {
    'subgenus', 'section', 'subsection', 'complex',
    'species', 'hybrid', 'subspecies', 'variety', 'form', 'infrahybrid', 'infraspecies',
}

# Search radii in km.
RADIUS_DEFAULT = 10
# iNaturalist obscures a location by replacing it with a random point inside
# the 0.2° x 0.2° grid cell that contains the true location. Two observations
# made at the same spot can therefore be shown up to one cell diagonal apart
# (about 31.4 km at the equator, less elsewhere). 32 km is the smallest whole
# radius that covers that worst case.
RADIUS_OBSCURED = 32
RADIUS_BIG = 1000

MODES = ('nearby', 'day', 'obs', 'big')

# --- Helper Functions ---

def extract_observation_id(input_string: str) -> str:
    """
    Extracts an iNaturalist observation ID from a given input string.

    The input can be a direct observation ID (as a string of digits) or a URL
    pointing to an iNaturalist observation. It supports various URL formats,
    including those with 'inaturalist.org', 'inaturalist.ca', and different
    path or query parameter structures.

    Raises:
        ValueError: If the observation ID cannot be extracted from the input string.
    """
    input_string = input_string.strip()
    if input_string.isdigit():
        return input_string

    try:
        parsed_url = urlparse(input_string)

        # Check query parameters first (e.g., ?observation_id=12345)
        query_params = parse_qs(parsed_url.query)
        if 'observation_id' in query_params and query_params['observation_id'][0].isdigit():
            return query_params['observation_id'][0]

        # Check path segments for /observations/ID pattern
        path_segments = [segment for segment in parsed_url.path.split('/') if segment]
        if 'observations' in path_segments:
            obs_index = path_segments.index('observations')
            if obs_index + 1 < len(path_segments) and path_segments[obs_index + 1].isdigit():
                return path_segments[obs_index + 1]
    except Exception:
        # If URL parsing fails or doesn't yield an ID, fall through to regex
        pass

    # Fallback to regex for inputs without a scheme, e.g. "inaturalist.org/observations/123"
    match = re.search(r'inaturalist\.[a-z.]+/observations/(\d+)', input_string)
    if match:
        return match.group(1)

    raise ValueError(f"Could not extract observation ID from: {input_string}")


def api_get(path: str, params: dict | None = None) -> dict:
    """GET an iNaturalist API endpoint and return the decoded JSON."""
    response = requests.get(f"{INATURALIST_API_URL}/{path}", params=params, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()


def get_observation_data(obs_id: str) -> dict:
    """
    Fetches observation data from the iNaturalist API for a given observation ID.

    Raises:
        ValueError: If the API request fails or no observation is found.
    """
    try:
        data = api_get(f"observations/{obs_id}")
    except requests.RequestException as e:
        raise ValueError(f"Error fetching data from iNaturalist API: {e}")

    if not data.get('results'):
        raise ValueError(f"No observation found with ID: {obs_id}")
    return data['results'][0]


def debug_print_taxonomy(taxon: dict, debug: bool = False) -> None:
    """Prints the taxon, its ancestors and its parent when debug is on."""
    if not debug:
        return

    print("\n=== DEBUG: Taxonomy Information ===")
    print("Main taxon:")
    print(f"  ID: {taxon.get('id')}")
    print(f"  Name: {taxon.get('name')}")
    print(f"  Rank: {taxon.get('rank')}")
    print(f"  Rank Level: {taxon.get('rank_level')}")

    if taxon.get('ancestors'):
        print(f"\nAncestors ({len(taxon['ancestors'])}):")
        for i, ancestor in enumerate(taxon['ancestors']):
            print(f"  {i}: {ancestor.get('name')} ({ancestor.get('rank')}) [ID: {ancestor.get('id')}]")

    if taxon.get('parent'):
        parent = taxon['parent']
        print("\nDirect parent:")
        print(f"  Name: {parent.get('name')}")
        print(f"  Rank: {parent.get('rank')}")
        print(f"  ID: {parent.get('id')}")

    print("=== END DEBUG ===\n")


def find_genus_id_by_name(genus_name: str, debug: bool = False) -> int:
    """
    Finds a genus ID by searching the iNaturalist taxa endpoint for the name.

    Prefers a case-insensitive exact match, then a genus whose name starts
    with the given name.

    Raises:
        ValueError: If an API error occurs or no matching genus is found.
    """
    if debug:
        print(f"Searching for genus ID for: {genus_name}")

    try:
        data = api_get("taxa", {'q': genus_name, 'rank': 'genus', 'is_active': 'true', 'per_page': 50})
    except requests.RequestException as e:
        raise ValueError(f"Error searching for genus ID: {e}")

    genera = [r for r in data.get('results', [])
              if (r.get('rank') or '').lower() == 'genus' and r.get('name')]
    if debug:
        print(f"Found {len(genera)} genus results")

    lower = genus_name.lower()
    match = (next((r for r in genera if r['name'].lower() == lower), None)
             or next((r for r in genera if r['name'].lower().startswith(lower)), None))
    if not match:
        raise ValueError(f"No match found for genus '{genus_name}'")

    if debug:
        print(f"Found match: {match['name']} (ID: {match['id']})")
    return match['id']


def is_below_genus(taxon: dict) -> bool:
    """True when the taxon sits inside a genus (subgenus, section, complex,
    species, hybrid, subspecies, variety, form...)."""
    rank_level = taxon.get('rank_level')
    if isinstance(rank_level, (int, float)):
        return rank_level < GENUS_RANK_LEVEL
    rank = (taxon.get('rank') or '').lower()
    return rank in BELOW_GENUS_RANKS or 'species' in rank


def find_genus_ancestor(ancestors) -> dict | None:
    """Returns the genus in a list of ancestor taxa, or None."""
    for ancestor in ancestors or []:
        if ancestor and (ancestor.get('rank') or '').lower() == 'genus':
            return ancestor
    return None


def extract_coordinates(obs_data: dict) -> tuple[float, float]:
    """
    Returns (latitude, longitude) from the observation's 'location' field,
    falling back to its GeoJSON point.

    Raises:
        ValueError: If the observation has no usable coordinates.
    """
    location = obs_data.get('location')
    if location:
        parts = [p.strip() for p in location.split(',') if p.strip()]
        if len(parts) == 2:
            try:
                return float(parts[0]), float(parts[1])
            except ValueError:
                pass

    coords = (obs_data.get('geojson') or {}).get('coordinates')
    if isinstance(coords, list) and len(coords) == 2:
        try:
            return float(coords[1]), float(coords[0])
        except (TypeError, ValueError):
            pass

    raise ValueError("This observation doesn't have usable GPS coordinates available")


def choose_taxon(taxon: dict, debug: bool = False) -> tuple[int | None, str, str]:
    """
    Picks the taxon to search for, returning (taxon_id, name, rank):

    - genus: used as-is
    - below genus (species, complex, section, subgenus, hybrid...): promoted
      to its genus, found from the ancestors, the parent, a fetch of the
      taxon's full ancestry, or a search for the first word of its name
    - above genus (family, order...): used as-is
    - falls back to the taxon itself if no genus can be found
    """
    debug_print_taxonomy(taxon, debug)
    rank = (taxon.get('rank') or '').lower()

    if rank == 'genus':
        return taxon.get('id'), taxon.get('name'), 'genus'

    if not is_below_genus(taxon):
        if debug:
            print(f"Using higher-level taxon as provided: {rank} {taxon.get('name')}")
        return taxon.get('id'), taxon.get('name'), rank or 'taxon'

    if debug:
        print("Observation identified below genus; trying to promote to genus.")

    # (a) ancestors array on the observation's taxon
    genus = find_genus_ancestor(taxon.get('ancestors'))
    if genus and debug:
        print(f"Found genus in ancestors: {genus.get('name')}")

    # (b) parent object
    if not genus:
        parent = taxon.get('parent') or {}
        if (parent.get('rank') or '').lower() == 'genus':
            genus = parent
            if debug:
                print(f"Found genus in parent object: {genus.get('name')}")

    # (c) fetch the taxon itself, which includes its full ancestor list
    if not genus and taxon.get('id'):
        try:
            results = api_get(f"taxa/{taxon['id']}").get('results') or []
            if results:
                genus = find_genus_ancestor(results[0].get('ancestors'))
                if genus and debug:
                    print(f"Found genus via taxon fetch: {genus.get('name')}")
        except requests.RequestException as e:
            if debug:
                print(f"Taxon fetch failed: {e}")

    if genus:
        return genus.get('id'), genus.get('name'), 'genus'

    # (d) search for the first word of the scientific name
    scientific_name = (taxon.get('name') or '').strip()
    if scientific_name and not scientific_name.startswith('×') and ' ' in scientific_name:
        potential_genus = scientific_name.split()[0]
        if debug:
            print(f"Potential genus extracted from name: {potential_genus}")
        try:
            return find_genus_id_by_name(potential_genus, debug), potential_genus, 'genus'
        except ValueError as e:
            if debug:
                print(f"Could not find genus via taxa search: {e}")

    # (e) fall back to the taxon itself
    print(f"Note: could not determine the genus, so searching for {taxon.get('name')} instead.")
    return taxon.get('id'), taxon.get('name'), rank or 'species'


def get_observed_date(obs: dict) -> str | None:
    """YYYY-MM-DD the observation was made, falling back to its upload date."""
    if obs.get('observed_on'):
        return obs['observed_on']
    if obs.get('created_at'):
        return obs['created_at'][:10]
    return None


def get_observed_month(obs: dict) -> int | None:
    """Month number (1-12) the observation was made, or None."""
    month = (obs.get('observed_on_details') or {}).get('month')
    if month:
        return month
    date = get_observed_date(obs)
    if date:
        try:
            month = int(date[5:7])
        except ValueError:
            return None
        if 1 <= month <= 12:
            return month
    return None


def search_radius(mode: str, obscured: bool) -> int:
    """Search radius in km for a mode. 'nearby' and 'day' widen to
    RADIUS_OBSCURED when the observation's location is obscured."""
    if mode == 'big':
        return RADIUS_BIG
    if mode == 'obs' or obscured:
        return RADIUS_OBSCURED
    return RADIUS_DEFAULT


def build_search_url(mode: str, obs: dict, latitude: float, longitude: float,
                     taxon_id: int | None, taxon_name: str) -> str:
    """Builds the iNaturalist observation search URL for a mode."""
    params = {'lat': latitude, 'lng': longitude, 'subview': 'map'}
    if taxon_id:
        params['taxon_id'] = taxon_id
    elif taxon_name:
        params['taxon_name'] = taxon_name

    params['radius'] = search_radius(mode, bool(obs.get('obscured')))

    if mode == 'day':
        date = get_observed_date(obs)
        if date:
            params['on'] = date
    elif mode == 'obs':
        # No geoprivacy filter: iNat search includes obscured observations by
        # default, and the wider radius accounts for their coordinate shift.
        month = get_observed_month(obs)
        if month:
            params['month'] = month

    return f"{INATURALIST_OBSERVATIONS_URL}?{urlencode(params)}"


def describe_search(mode: str, obs: dict, taxon_name: str, radius: int) -> str:
    """One-line description of what the URL searches for."""
    text = f"all {taxon_name} observations within {radius} km"
    if mode == 'day':
        date = get_observed_date(obs)
        if date:
            text += f" observed on {date}"
    elif mode == 'obs':
        month = get_observed_month(obs)
        if month:
            text += f" observed in month {month}"
    return text


def main() -> None:
    parser = argparse.ArgumentParser(
        description='Find observations of the same genus near a given iNaturalist observation.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "modes:\n"
            f"  nearby  same genus within {RADIUS_DEFAULT} km ({RADIUS_OBSCURED} km if the location is obscured)\n"
            f"  day     same genus within {RADIUS_DEFAULT} km ({RADIUS_OBSCURED} km if obscured), same day\n"
            f"  obs     same genus within {RADIUS_OBSCURED} km, same month (finds obscured observations)\n"
            f"  big     same genus within {RADIUS_BIG} km"
        ),
    )
    parser.add_argument('observation', help='iNaturalist observation ID or URL')
    parser.add_argument('-m', '--mode', choices=MODES, default='nearby',
                        help='search mode (default: nearby)')
    parser.add_argument('--debug', action='store_true',
                        help='Enable debug output to troubleshoot taxonomy issues')
    args = parser.parse_args()

    try:
        obs_id = extract_observation_id(args.observation)
        print(f"Processing observation ID: {obs_id}")

        print("Fetching observation data...")
        obs_data = get_observation_data(obs_id)
        if args.debug:
            print(f"\nRaw observation data keys: {list(obs_data.keys())}")

        latitude, longitude = extract_coordinates(obs_data)
        taxon = obs_data.get('taxon')
        if not taxon:
            raise ValueError("This observation doesn't have taxonomic information")
        taxon_id, taxon_name, taxon_rank = choose_taxon(taxon, args.debug)

        obscured = bool(obs_data.get('obscured'))
        radius = search_radius(args.mode, obscured)

        print("\nObservation Details:")
        print(f"  Taxon: {taxon.get('name', 'N/A')}")
        print(f"  Searching: {taxon_name} ({taxon_rank})")
        print(f"  Location: {latitude:.6f}, {longitude:.6f}" + (" (obscured)" if obscured else ""))

        if obscured and args.mode in ('nearby', 'day'):
            print(f"\nThis location is obscured, so the search uses {RADIUS_OBSCURED} km "
                  f"instead of {RADIUS_DEFAULT} km.")

        url = build_search_url(args.mode, obs_data, latitude, longitude, taxon_id, taxon_name)
        print(f"\nGenerated URL to find {describe_search(args.mode, obs_data, taxon_name, radius)}:")
        print(url)

    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        if args.debug:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
