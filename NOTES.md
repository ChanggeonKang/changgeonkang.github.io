# Alternate designs

Archive branch. Nothing here is served — GitHub Pages builds `main` only.

## panel.html — "Panel"

The runner-up to the design now on `main`. Identity rail (portrait, affiliation,
links) fixed on the left, content scrolling on the right; publications as bordered
cards rather than a numbered list. Same content and the same publication record
styling as the live page.

Self-contained: the only external references are `photo.jpg` and
`CV_ChanggeonKang.pdf`, which live on `main`.

To look at it:

```bash
git show design-alternates:panel.html > /tmp/panel.html
```

Then copy `photo.jpg` and `CV_ChanggeonKang.pdf` next to it, or open it and
accept the two broken links.

To promote it to the live site:

```bash
git checkout main
git show design-alternates:panel.html > index.html
git commit -am "Switch to the Panel design"
git push
```
