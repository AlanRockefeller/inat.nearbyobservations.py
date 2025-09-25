# Nearby iNaturalist Genus Finder 

Note:   You'll probably want to use the browser extension rather than calling this manually - see README.browser-extension.md

Ever been on an iNaturalist observation page and wondered what else is around from the same genus?   This tool makes it easy to check - I like to use it to see what other people have identified nearby observations as, or if someone gives you an ID, find nearby observations that it also might apply to.


## What it does

Ever found a cool creature on iNaturalist and wondered, "Are there any others of its kind nearby?" Well, this little Python script is here to help you find out!

It's called `nearby.py`, and it's designed to be your go-to tool for exploring the local biodiversity of a specific genus.

## What Does It Do? 

Basically, you give it an iNaturalist observation (either its ID number or a link to it), and it does a few things:

1.  **Grabs the Details:** It fetches the full data for that observation from iNaturalist.
2.  **Gets the Location:** It figures out exactly where that observation was made (latitude and longitude).
3.  **Identifies the Genus:** This is the clever part! It tries its best to figure out the genus of the creature you observed. It's pretty smart about it, checking the observation's own classification, its ancestors, and even doing a quick search on iNaturalist if needed.
4.  **Generates a Search Link:** Once it knows the genus and the location, it creates a special link that you can click. This link takes you straight to iNaturalist's website, showing you *all* observations of that *same genus* within a 1-kilometer radius of your original observation. Super handy for local species surveys or just satisfying your curiosity!

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
*   It specifically looks for observations within a 1km radius (`radius=1`) and requests the map view (`subview=map`) on iNaturalist.

## Contributing 

This is a simple script, but feel free to fork it, improve it, or report any bugs!    Bug reports and feature requests should be sent to the gmail account alanrockefeller.

