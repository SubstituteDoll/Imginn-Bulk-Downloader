- [x] Consumed links list
  * ~~size is forced to be 1.5 lines, but the entire list is select and copyable just in case.~~
  * ~~The list should be populated from the last consumed link to the oldest consumed link.~~
  * ~~"Visited URLs" label that disappears on cursor hover.~~

- [x] Pull post date
  * ~~Post date is grabbable from the html directly~~

- [ ] Display post date in the popup ui
  * ~~Between the Previews and the Download Button~~
  * fix: issue #19

- [ ] Download and display previews in the preview area on page load
  * the smaller version pics are directly accessible from the html

- [ ] Possibly: Make the entire popup bigger to allow for displaying the preview pictures larger

- [ ] Make the preview pictures selectable
  * Download shouldn't be implemented yet 
  * Selected indices saved from the post

- [ ] Gather links for selected pictures
  * the Instagram CDN links for full resolution pictures are accessible from the html

- [ ] Download from the insta cdn links
  * Save filenames by POSTDATE-POSTTIME_N.jpg or .webp
  * N is the downloaded index, which is separate from the real post's selected index, and is instead just a counter of the downloaded pictures

- [ ] Possibly: Downloaded picture metadata editing
  * Add exif data as the post date and time