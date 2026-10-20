# LASRP live map

Open **Live Map** in the CAD sidebar after signing in. Responders see their authorized agencies; dispatch/supervisors/management have their configured wider access. Civilians cannot access the map API or its image route.

## Installed artwork

Four original 5355 × 5355 images were downloaded from the officially documented ER:LC map endpoint: `fall_blank`, `fall_postals`, `snow_blank`, `snow_postals`. They are stored in `assets/maps/` with provenance in `SOURCE.txt`. Artwork belongs to Police Roleplay Community / its respective owners. No unrelated map or generated terrain is substituted.

Use the map-image selector to switch seasons or postal labels. Official postal labels are part of the postal image; custom postal pins are separate annotations. `npm run map:fetch` refreshes all four files, validating PNG signatures, dimensions and a 32 MiB limit. The downloader never sends your ER:LC server key. Browser image responses use private caching so the large image is not fetched again on every live refresh.

## Controls

- Drag to pan; wheel or **Zoom in/out** zooms, **Fit map** resets. A focused map supports arrow keys and +/−. Escape cancels a drawing tool. View position survives a live refresh in the same tab.
- Checkboxes filter API players, manual units, incidents, stations, custom postal pins, roadblocks and patrol boundaries. Filters and map variant are remembered in that browser.
- **Find** searches placed overlay labels and visible player/callsign/postal metadata. It does not OCR every printed label from the official image.
- Dispatcher/supervisor: choose **station**, **postal**, or **roadblock**, click the image and complete the form. These create manual CAD annotations, not Roblox objects.
- For a **patrol** boundary, click at least three corners then **Finish boundary**. Choose an agency and label. Zero-area boundaries and off-image points are rejected.
- **Place incident** selects an existing active incident and records its map pin. Legacy unscaled planning-grid coordinates are not automatically shown on the geographic map.
- On-duty responders can **Place my unit**. These square markers are explicitly manual; their location freshness uses the placement timestamp, independently of duty heartbeats.
- Click a feature for details. Dispatch/supervisors can archive it with a reason. Records and audit history are retained.

## Calibrate live player locations

The official location documentation says world origin `(0,0)` is map center, positive X moves right and positive Z moves down. It does **not** document a reliable world-unit-to-image scale. LASRP deliberately does not guess that scale.

1. Configure your real ER:LC API key and wait for a healthy snapshot. Note an exact player's X/Z and their known location on the map. Do not use someone who has moved since the snapshot.
2. As management/owner, choose **Calibrate**, click that exact location and enter its measured X and Z.
3. Repeat for two more known positions spread across the map. The three world positions and three image positions must each form a triangle, rather than lie on a straight line.
4. After the third anchor is saved, supported API positions are projected using the measured affine transform. Verify against a fourth independent position before relying on the alignment. Incorrect measurements produce incorrect placement; re-calibrate when the map changes.
5. **Clear calibration** removes the measured transform after typing CLEAR. Manual overlays remain; live players return to the textual list until calibration is supplied.

Calibration is versioned and persisted in PostgreSQL, separately for demo/production, and audited. No fabricated calibration ships with the project. Player markers without valid/in-bounds coordinates are omitted while their available metadata remains visible in the list. No smooth movement or route interpolation is invented.

## Freshness and verification

The page displays the age and health of the backend's existing ER:LC snapshot; browsing the map does not issue extra PRC polling requests. API markers become faded when unhealthy or more than 120 seconds old. Manual unit pins fade after the configured unit freshness window. Image load failures are reported explicitly.

Build, projection tests, access/privacy/version tests and DOM zoom/placement tests pass. The downloaded postal artwork was visually inspected. Full graphical desktop/mobile browser QA and live calibration remain pending: this environment exposes no controllable browser, and live API credentials/ground-truth positions have not been supplied.

References: [Official map images](https://apidocs.erlc.gg/official-map-images), [Interpreting API locations](https://apidocs.erlc.gg/how-do-i-interpret-the-xyz).
