# LASRP public media library

Use only approved, original ER:LC imagery and supplied LASRP branding. Blueprint SVGs are labeled illustrations, never game screenshots.

Folders: `homepage`, `departments`, `lapd`, `lasd`, `lafd`, `dot`, `applications`, `staff`, `cad`, `sessions`, `community`, `training`, `brand`.

Edit `src/config/images.ts` to replace any asset; each entry supports `src`, descriptive `alt`, `position` (CSS object-position), and an optional optimized `webp` alternative. For example:

```ts
lapd: { src: '/images/lapd/patrol.jpg', webp: '/images/lapd/patrol.webp', alt: 'Two LASRP patrol units at an ER:LC city intersection', position: '65% center' }
```

Use 1800–2400px wide heroes and 800–1200px gallery images. Export WebP from your image editor with a JPEG/PNG fallback. Prefer heroes below 400KB and card images below 150KB. Never upscale low-resolution images. `Asset` applies responsive cropping, lazy loading except hero/logo, WebP fallback, and an error fallback. A broken fallback is hidden without an error loop. The image carousel has manual controls and no automatic motion.

Leadership photos should be approved before publication. Do not put staff names, screenshots of private CAD data, or personal information in placeholders.

`npm run media:prepare` from `apps/site` refreshes copies of branding, regenerates the original placeholder illustrations, and exports WebP banner variants with sharp. `npm run media:optimize` re-exports only the branded PNG variants. Originals remain unchanged. The supplied website banners compress to about 18–33KB each. Do not rerun preparation over replacement files named `hero.svg`; place final media under new names and point image configuration to them.
