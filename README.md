# Imginn-Bulk-Downloader
From a list of Imginn URLs, prompts and downloads high-resolution version of the images from each page.

## Limitation
This add-on is tested for Firefox only. Theoretically, the WebExtension standard should make this work with Chrome as well, but there are a lot of Firefox only hacks done (ex. the newtab behavior and the background script declaration).

## Usage
1. Prepare a list of `imginn.com` links to visit. 
    * Tested to work with `imginn.com/p/` links (individual posts), proceed at your own discretion for other types of pages.
    * Put one link per line. It can do a basic sanitization of removing whitespaces between links, but no guarantees.
    * Have a copy of the original list handy. By design, this add-on is not going to help you go back to a previously visited link for a re-do.
2. Start a new tab.
3. Push the Start button, and then the "Next URL" button.
    * It will load the link at the top and remove it from the list.
    * (unimplemented) The consumed links can be found in the small list at the bottom. If you want to go back for some reason, it should be there.
4. (unimplemented) From the preview window, select the pictures the full versions of which you would like to download.
5. Files will be saved into the Download folder under "(username)/POSTDATE-POSTTIME_N".
    * Username is the username of the post
    * Post date and time are pulled from the post itself.
6. !CRUCIAL! Check the download folder itself against the post webpage, and ensure that any and all pictures you would have liked to download are actually there.
7. Push the "Next URL" button, and repeat the above steps until all links are done.

## Installation
I currently have no plans to publish this add-on. To use it, navigate to `about:debugging` on Firefox, then use the `Load Temporary Add-on...` button to load the `manifest.json` file from this repo.