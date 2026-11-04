# Fernando Quijada · Portfolio

Plain HTML, CSS, and JavaScript. No build step, so it runs on GitHub Pages as is.

```
index.html                         the drink menu plus every section (About, Projects, Experience, Interests, Let's connect)
projects/ultrasound-water-tank.html  first case study
assets/css/style.css               all styles (Latte and Espresso themes)
assets/js/main.js                  theme switch, the drink menu and brewing animation, the glass you drink as you scroll, lightbox
assets/img/                        headshot and project images
resume/Fernando_Quijada_Resume.pdf
.nojekyll                          tells GitHub Pages to serve files as they are
```

## Put it on GitHub Pages (about 15 minutes)

1. Create a free account at github.com. Your site address will use your username, so pick it with care (for example `fernandoquijada`).
2. Click **New repository**. Name it exactly `<your-username>.github.io`, set it to **Public**, and click **Create repository**.
3. On the new repository page, click **uploading an existing file**. Drag in everything inside this `site` folder (the files and the `assets`, `projects`, and `resume` folders), not the `site` folder itself. Click **Commit changes**.
4. Go to **Settings → Pages**. Under "Build and deployment", set Source to **Deploy from a branch**, branch **main**, folder **/ (root)**, and click **Save**.
5. Wait a minute or two, then open `https://<your-username>.github.io`. That's the link for your application.

Note: `.nojekyll` starts with a dot, so your computer may hide it. The site works without it, so don't worry if it doesn't upload.

## Updating

- Edit a file on github.com (pencil icon) and commit. The site updates in about a minute.
- New project: copy `projects/ultrasound-water-tank.html`, change the text and images, and add a card for it in the Projects section (`id="projects"`) of `index.html`.
- Each section opens from a link like `yourname.github.io/#projects` (also `#about`, `#experience`, `#interests`, `#connect`, and `#all` for everything on one page). Links with a `#` skip the brewing animation.
- New resume: replace `resume/Fernando_Quijada_Resume.pdf` with a file of the same name.

## Brewing animation style

`index.html` brews each drink from above. To show the milk pitcher (or kettle) pouring from the side and then tilting up to the top view, add this line inside `<head>`:

```html
<meta name="brew-style" content="side">
```
