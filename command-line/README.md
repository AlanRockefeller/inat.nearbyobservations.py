# Genus Proximity Finder for iNaturalist — Command Line

Note:   You'll probably want to use the browser extension rather than calling this manually - see `../browser-extension/README.md`

Ever been on an iNaturalist observation page and wondered what else is around from the same genus?   This tool makes it easy to check - I like to use it to see what other people have identified nearby observations as, or if someone gives you an ID, find nearby observations that it also might apply to.


## What it does

Ever found a cool creature on iNaturalist and wondered, "Are there any others of its kind nearby?" Well, this little Python script is here to help you find out!

It's called `nearby.py`, and it's designed to be your go-to tool for exploring the local biodiversity of a specific genus.

## What Does It Do? 

Basically, you give it an iNaturalist observation (either its ID number or a link to it), and it does a few things:

1.  **Grabs the Details:** It fetches the full data for that observation from iNaturalist.
2.  **Gets the Location:** It figures out exactly where that observation was made (latitude and longitude).
3.  **Identifies the Genus:** This is the clever part! It tries its best to figure out the genus of the creature you observed. It's pretty smart about it, checking the observation's own classification, its ancestors, and even doing a quick search on iNaturalist if needed.
4.  **Generates a Search Link:** Once it knows the genus and the location, it creates a special link that you can click. This link takes you straight to iNaturalist's website, showing you *all* observations of that *same genus* within 10 km of your original observation (32 km if its location is obscured). Super handy for local species surveys or just satisfying your curiosity!

If the observation is identified to a species, complex, section, subgenus, hybrid or anything else inside a genus, it searches the whole genus. If it's only identified to family or higher, it searches that taxon.

## How Do I Use It? 

You probably won't use it - the browser extension is what you'll probably end up using.

It's a command-line tool, so you'll need Python 3 installed and a terminal.

1.  **Save the script:** Make sure you have `nearby.py` saved somewhere on your computer.
2.  **Open your terminal:** Navigate to the directory where you saved `nearby.py`.
3.  **Run the command:**
    ```bash
    python nearby.py <observation_id_or_url>
    ```

    **Examples:**

    *   Using an observation ID:
        ```bash
        python nearby.py 123456789
        ```
    *   Using an iNaturalist URL:
        ```bash
        python nearby.py https://www.inaturalist.org/observations/987654321
        ```
    *   Using a different URL format:
        ```bash
        python nearby.py https://www.inaturalist.org/observations/11223344?some_other_param=value
        ```

4.  **Check the output:** The script will print out the details it found and then give you a shiny new URL to click!

## Search Modes

Like the browser extension's buttons, `--mode` (or `-m`) picks which search to run:

| Mode | Searches for |
|------|--------------|
| `nearby` (default) | Same genus within 10 km (32 km if the location is obscured) |
| `day` | Same genus within 10 km (32 km if obscured), observed on the same day |
| `obs` | Same genus within 32 km in the same month, to find obscured observations made at the same location |
| `big` | Same genus within 1000 km |

```bash
python nearby.py 123456789 --mode day
python nearby.py 123456789 -m big
```

iNaturalist hides an obscured observation's real location by showing a random point in the 0.2° grid cell that contains it, so two observations from the same spot can appear up to about 31 km apart. That's why obscured searches use 32 km.

## Need More Info? (Debug Mode!) 

If the script is having trouble figuring out the genus, or you're just curious about how it works under the hood, you can run it with the `--debug` flag. This will print out a lot more information about the taxonomic data it's looking at.

```bash
python nearby.py <observation_id_or_url> --debug
```

## What's Going On Under the Hood? 

*   It uses Python's `requests` library to talk to the iNaturalist API.
*   `argparse` is used to handle the command-line arguments.
*   `urllib.parse` and `re` (regular expressions) help in extracting the observation ID from various URL formats.
*   The iNaturalist API is queried for observation details and for searching taxa (species, genera, etc.).
*   The generated URL uses iNaturalist's `lat`, `lng`, `radius` and `taxon_id` search parameters, plus `on` (day mode) or `month` (obs mode), and opens the map view (`subview=map`).
*   It needs Python 3.10 or newer.

## Contributing 

This is a simple script, but feel free to fork it, improve it, or report any bugs!    Bug reports and feature requests should be sent to the gmail account alanrockefeller.

