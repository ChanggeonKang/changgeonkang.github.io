# changgeonkang.github.io

Personal academic page for Changgeon Kang — Ph.D. student, Sensing Intelligence and
Cyber-Physical Security (CyPhy) Lab, School of Computing, KAIST.

Live at <https://changgeonkang.github.io/>.

## Layout

```
index.html              the whole site — one static page, no build step, no JavaScript
photo.jpg               portrait, 390x567
CV_ChanggeonKang.pdf    linked from the page; replace this file to update the CV
.nojekyll               tells GitHub Pages to serve the files as-is
```

Editing `index.html` and pushing to `main` is the whole deploy. GitHub Pages picks the
change up within a minute or so.

## Editing notes

Sections, in page order: identity strip · Publications · Education · Teaching Experience ·
Honor and Awards.

**Adding a publication.** Copy an existing `<article class="pub">` block. The two pills are
`bdg-v` (venue) and `bdg-s` (status); the running number in `.n` counts down, so the newest
paper carries the highest number. Your own name is wrapped in `<b>` in the author list.

**Teaching Experience** is grouped by course, not by role — a course taught twice is named
once, with each term and role listed beneath it. Keep that shape when adding a term, rather
than repeating the course title.

**The portrait.** The identity strip pins both grid tracks (`116px minmax(0,380px)`) so the
photo's bottom edge lands on the "School of Computing, KAIST" line. Those two numbers are
load-bearing and depend on each other: 380px is a width at which the lab name always takes
two lines, which fixes the text block at 169px, which is exactly the height 116px of photo
resolves to through the 390:567 aspect ratio.

Do **not** switch either track to `auto` or `1fr` to "let it size itself". That reintroduces
a circular dependency — photo width ← row height ← text height ← text width ← photo width —
which no layout mode resolves reliably. It was measured failing three ways: flex with
`align-self:stretch` collapsed the photo to 1px wide; grid `auto 1fr` settled one pass short
(148px row around 169px of text) so the links rode up over the last line; and grid
`auto minmax(0,380px)` converged at some widths but let the photo drive the row at others,
reaching 304x442 at an 820px viewport.

If you replace the portrait with one of a different shape, update the `aspect-ratio` in
`.v5 .photo` and then re-pick the pair of numbers together.

## Alternate design

A second design (`Panel` — fixed identity rail on the left, content scrolling on the right)
is kept on the `design-alternates` branch as `panel.html`. It is not served from `main`.

```bash
git show design-alternates:panel.html > panel.html
```
