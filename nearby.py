#!/usr/bin/env python3
"""
iNaturalist Genus Proximity Finder

This script takes an iNaturalist observation number or URL as input,
extracts the GPS coordinates and genus information, then generates a URL
to find all observations of the same genus within 1km of that location.

By Alan Rockefeller

September 24, 2025

Version 1.0
"""

import requests
import re
import sys
import argparse
from urllib.parse import urlparse, parse_qs

INATURALIST_API_URL = "https://api.inaturalist.org/v1"
INATURALIST_OBSERVATIONS_URL = "https://www.inaturalist.org/observations"

# --- Helper Functions ---

def extract_observation_id(input_string: str) -> str:
    """
    Extracts an iNaturalist observation ID from a given input string.

    The input can be a direct observation ID (as a string of digits) or a URL
    pointing to an iNaturalist observation. It supports various URL formats,
    including those with 'inaturalist.org', 'inaturalist.ca', and different
    path or query parameter structures.

    Args:
        input_string: The observation ID or URL string to parse.

    Returns:
        The extracted observation ID as a string.

    Raises:
        ValueError: If the observation ID cannot be extracted from the input string.
    """
    if input_string.isdigit():
        return input_string

    try:
        parsed_url = urlparse(input_string)
        
        # Check query parameters first (e.g., ?observation_id=12345)
        query_params = parse_qs(parsed_url.query)
        if 'observation_id' in query_params and query_params['observation_id'][0].isdigit():
            return query_params['observation_id'][0]

        # Check path segments for /observations/ID pattern
        path_segments = parsed_url.path.split('/')
        # Filter out empty strings from split, e.g., from leading/trailing slashes
        path_segments = [segment for segment in path_segments if segment]

        if 'observations' in path_segments:
            obs_index = path_segments.index('observations')
            if obs_index + 1 < len(path_segments) and path_segments[obs_index + 1].isdigit():
                return path_segments[obs_index + 1]
        
        # Handle cases like inaturalist.org/observations/12345 directly in path
        if len(path_segments) >= 2 and path_segments[-2] == 'observations' and path_segments[-1].isdigit():
            return path_segments[-1]

    except Exception:
        # If URL parsing fails or doesn't yield an ID, fall through to regex
        pass 

    # Fallback to regex for patterns not covered by urlparse or for simpler inputs
    # These patterns are more specific to known iNaturalist domains
    patterns = [
        r'inaturalist\.org/observations/(\d+)',
        r'inaturalist\.ca/observations/(\d+)',
    ]

    for pattern in patterns:
        match = re.search(pattern, input_string)
        if match:
            return match.group(1)

    raise ValueError(f"Could not extract observation ID from: {input_string}")


def get_observation_data(obs_id: str) -> dict:
    """
    Fetches observation data from the iNaturalist API for a given observation ID.

    Args:
        obs_id: The iNaturalist observation ID as a string.

    Returns:
        A dictionary containing the observation data.

    Raises:
        ValueError: If the API request fails, returns an error status, or if no
                    observation is found for the given ID.
    """
    url = f"{INATURALIST_API_URL}/observations/{obs_id}"
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        if not data.get('results'): # Use .get for safer access
            raise ValueError(f"No observation found with ID: {obs_id}")
        
        return data['results'][0]
    
    except requests.RequestException as e:
        raise ValueError(f"Error fetching data from iNaturalist API: {e}")


def debug_print_taxonomy(taxon: dict, debug: bool = False) -> None:
    """
    Prints detailed taxonomy information if the debug flag is enabled.

    This function is useful for troubleshooting genus detection issues by
    displaying the main taxon's details, its ancestors, and its direct parent.

    Args:
        taxon: A dictionary representing the taxonomic information of an observation.
        debug: A boolean flag to enable or disable debug printing. Defaults to False.
    """
    if not debug:
        return
        
    print("\n=== DEBUG: Taxonomy Information ===")
    print(f"Main taxon:")
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
        print(f"\nDirect parent:")
        print(f"  Name: {parent.get('name')}")
        print(f"  Rank: {parent.get('rank')}")
        print(f"  ID: {parent.get('id')}")
    
    print("=== END DEBUG ===\n")


def find_genus_id_by_name(genus_name: str, debug: bool = False) -> int:
    """
    Finds a genus ID by searching for the genus name using the iNaturalist API.

    It queries the iNaturalist taxa endpoint for entries matching the provided
    genus name with the rank 'genus' and 'is_active' set to true. It prioritizes
    exact matches and returns the ID of the first exact match found.

    Args:
        genus_name: The name of the genus to search for.
        debug: A boolean flag to enable debug output during the search. Defaults to False.

    Returns:
        The iNaturalist ID of the genus as an integer.

    Raises:
        ValueError: If an API error occurs or if no exact match for the genus is found.
    """
    if debug:
        print(f"Searching for genus ID for: {genus_name}")
        
    url = f"{INATURALIST_API_URL}/taxa"
    params = {
        'q': genus_name,
        'rank': 'genus',
        'is_active': 'true'
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        results = data.get('results', [])
        if debug:
            print(f"Found {len(results)} results for genus search")
        
        # Look for exact match among results
        exact_matches = [res for res in results if res.get('name') == genus_name and res.get('rank') == 'genus']
        
        if not exact_matches:
            raise ValueError(f"No exact match found for genus '{genus_name}'")
        
        # If multiple exact matches, pick the first one.
        chosen_match = exact_matches[0]
        
        if debug:
            print(f"Found exact match: {chosen_match['name']} (ID: {chosen_match['id']}, Rank: {chosen_match['rank']})")
        return chosen_match['id']
    
    except requests.RequestException as e:
        raise ValueError(f"Error searching for genus ID: {e}")


def extract_coordinates_and_genus(obs_data: dict, debug: bool = False) -> tuple[float, float, int, str]:
    """
    Extracts GPS coordinates and determines the genus from observation data.

    It first retrieves the 'location' field for latitude and longitude.
    Then, it attempts to identify the genus using several strategies:
    1. If the observation's taxon is already a genus, it uses that.
    2. If the observation's taxon has a scientific name (e.g., "Homo sapiens"),
       it extracts the first word as a potential genus and searches for it.
       This includes checking the taxon's ancestors and performing an API search.
    3. If the observation is a species and has a parent taxon that is a genus,
       it uses that parent genus.

    Args:
        obs_data: A dictionary containing the iNaturalist observation data.
        debug: A boolean flag to enable debug output for taxonomy analysis. Defaults to False.

    Returns:
        A tuple containing:
        - latitude (float): The latitude of the observation.
        - longitude (float): The longitude of the observation.
        - genus_id (int): The iNaturalist ID of the determined genus.
        - genus_name (str): The name of the determined genus.

    Raises:
        ValueError: If coordinates or taxonomic information are missing, invalid,
                    or if the genus cannot be determined.
    """
    # Get coordinates
    location = obs_data.get('location')
    if not location:
        raise ValueError("This observation doesn't have GPS coordinates available")
    
    # Location is in "lat,lng" format
    try:
        lat_str, lng_str = location.split(',')
        latitude = float(lat_str)
        longitude = float(lng_str)
    except ValueError:
        raise ValueError(f"Invalid location format: {location}")
    
    # Get genus information
    taxon = obs_data.get('taxon')
    if not taxon:
        raise ValueError("This observation doesn't have taxonomic information")
    
    # Print debug info
    debug_print_taxonomy(taxon, debug)
    
    # --- Genus Detection Logic ---
    genus_id = None
    genus_name = None
    
    if debug:
        print("Starting genus detection...")
    
    # Case 1: The observation's taxon is itself a genus
    if taxon.get('rank') == 'genus':
        genus_id = taxon.get('id')
        genus_name = taxon.get('name')
        if debug:
            print(f"Observation taxon is a genus: {genus_name} (ID: {genus_id})")
    
    # Case 2: Extract genus from scientific name (e.g., "Homo sapiens")
    if not genus_id and taxon.get('name'):
        scientific_name = taxon['name']
        if debug:
            print(f"Attempting to extract genus from scientific name: {scientific_name}")
        
        # For binomial names, first word is usually genus
        if ' ' in scientific_name and not scientific_name.startswith('×'): # Exclude hybrid names
            potential_genus_name = scientific_name.split()[0]
            
            # Check if this potential genus name exists in the ancestors list as a genus
            for ancestor in taxon.get('ancestors', []):
                if ancestor.get('name') == potential_genus_name and ancestor.get('rank') == 'genus':
                    genus_id = ancestor.get('id')
                    genus_name = potential_genus_name
                    if debug:
                        print(f"Found genus in ancestors by name: {genus_name} (ID: {genus_id})")
                    break
            
            # If still not found in ancestors, try API search for the potential genus name
            if not genus_id:
                try:
                    genus_id = find_genus_id_by_name(potential_genus_name, debug)
                    genus_name = potential_genus_name
                    if debug:
                        print(f"Found genus via API search: {genus_name} (ID: {genus_id})")
                except ValueError as e: # Catch specific error from find_genus_id_by_name
                    if debug:
                        print(f"API search for genus '{potential_genus_name}' failed: {e}")
                except Exception as e: # Catch other unexpected errors
                    if debug:
                        print(f"Unexpected error during API search for genus '{potential_genus_name}': {e}")

    # Case 3: If genus still not found, try to find it from the taxon's direct parent if it's a species
    if not genus_id and taxon.get('rank') == 'species' and taxon.get('parent'):
        parent_taxon = taxon['parent']
        if parent_taxon.get('rank') == 'genus':
            genus_id = parent_taxon.get('id')
            genus_name = parent_taxon.get('name')
            if debug:
                print(f"Found genus from direct parent (species observation): {genus_name} (ID: {genus_id})")

    # Final check and error if genus could not be determined
    if not genus_name or not genus_id:
        print("Failed to determine genus. Here's the available taxonomic info:")
        debug_print_taxonomy(taxon, True) # Ensure debug info is printed if we fail
        raise ValueError("Could not determine genus for this observation")
    
    if debug:
        print(f"Final determined genus: {genus_name} (ID: {genus_id})")
    
    return latitude, longitude, genus_id, genus_name


def generate_genus_proximity_url(latitude: float, longitude: float, genus_id: int, genus_name: str) -> str:
    """
    Generates a URL to search for iNaturalist observations of a specific genus within a 1km radius.

    The URL is constructed for the iNaturalist website, including latitude, longitude,
    radius, map view, and the target genus ID.

    Args:
        latitude: The latitude of the center point for the search.
        longitude: The longitude of the center point for the search.
        genus_id: The iNaturalist ID of the genus to search for.
        genus_name: The name of the genus (used for display in the output message).

    Returns:
        A string representing the generated iNaturalist search URL.
    """
    
    # Parameters for the search - match the working format
    params = {
        'lat': latitude,
        'lng': longitude,
        'radius': 1,  # 1 kilometer radius
        'subview': 'map',
        'taxon_id': genus_id
    }
    
    # Build URL with parameters
    param_string = '&'.join([f"{key}={value}" for key, value in params.items()])
    full_url = f"{INATURALIST_OBSERVATIONS_URL}?{param_string}"
    
    return full_url


def main() -> None:
    """
    Main function to parse command-line arguments, fetch observation data,
    determine genus and location, and generate a proximity search URL.

    It uses argparse to handle the observation ID/URL input and a debug flag.
    It orchestrates calls to other functions for data extraction and URL generation.
    Error handling is included for various stages of the process.
    """
    parser = argparse.ArgumentParser(
        description='Find all observations of the same genus within 1km of a given iNaturalist observation'
    )
    parser.add_argument('observation', 
                       help='iNaturalist observation ID or URL')
    parser.add_argument('--debug', 
                       action='store_true', 
                       help='Enable debug output to troubleshoot taxonomy issues')
    
    args = parser.parse_args()
    
    try:
        # Extract observation ID
        obs_id = extract_observation_id(args.observation)
        print(f"Processing observation ID: {obs_id}")
        
        # Get observation data
        print("Fetching observation data...")
        obs_data = get_observation_data(obs_id)
        
        if args.debug:
            print(f"\nRaw observation data keys: {list(obs_data.keys())}")
        
        # Extract coordinates and genus
        latitude, longitude, genus_id, genus_name = extract_coordinates_and_genus(obs_data, args.debug)
        
        print(f"\nObservation Details:")
        # Safely access species name
        species_name = obs_data.get('taxon', {}).get('name', 'N/A')
        print(f"  Species: {species_name}")
        print(f"  Genus: {genus_name}")
        print(f"  Location: {latitude:.6f}, {longitude:.6f}")
        
        # Generate proximity URL
        proximity_url = generate_genus_proximity_url(latitude, longitude, genus_id, genus_name)
        
        print(f"\nGenerated URL to find all {genus_name} observations within 1km:")
        print(proximity_url)
        
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
