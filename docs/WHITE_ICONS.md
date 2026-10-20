# Custom white Discord icons

The default renderer removes colorful Unicode pictographs from panel titles, buttons and select labels. It uses `◆` while custom icons are unconfigured. This is a monochrome text fallback, not a promise that ordinary Unicode emoji render white.

1. Create or obtain white glyphs on transparent backgrounds that you have permission to use. Export small transparent PNGs. Keep the supplied LA logo separate from functional icons.
2. In your Discord guild, upload the PNGs as custom emoji using names such as `shield`, `cad`, `radio`, `ticket`, `application`, `check`, `close`, `warning`, `clock`, `document` and `settings`.
3. Enable Discord Developer Mode, copy the emoji ID, and paste only the numerical ID into the corresponding `emojis` property of `config/ids.ts`.
4. Restart the bot. `config/icons.ts` formats a valid configured ID as `<:name:ID>`; missing/invalid IDs remain `◆`.

The bot must be able to use the custom emoji in the destination guild. No placeholder/fake IDs are sent. This release uses the configured shield icon for the standard title mark; additional names are centralized for future topic-specific expansion. No generated raster icon pack is included.
