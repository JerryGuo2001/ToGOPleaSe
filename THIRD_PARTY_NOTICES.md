# Third-party notices

## Zork I

Original game by Marc Blank, Dave Lebling, Bruce Daniels and Tim Anderson, published by Infocom. The unmodified game displays its original Infocom copyright and trademark notice. The original downloaded files remain in `zork/zork1-develop/`.

The executable is the exact [Zork I release 119 / serial 880429](https://eblong.com/infocom/gamefiles/zork1-r119-s880429.z3) from Andrew Plotkin's [Infocom catalog](https://eblong.com/infocom/). The separately bundled [matching archival source](https://eblong.com/infocom/sources/zork1-r119.zip) includes the Microsoft 2025 MIT license, retained at `game/source-r119/LICENSE`. The user's original MIT license remains at `zork/zork1-develop/LICENSE`. These upstream notices are retained; the experiment's root license does not replace them.

`js/story-schema.js` derives object identity and attribute metadata from the matching archival source and original executable. Source provenance and file hashes are in `game/PROVENANCE.json`. The current development source at [the-infocom-files/zork1](https://github.com/the-infocom-files/zork1) is preserved separately and is not assumed to be the original executable's build input.

## ifvms.js ZVM

[ifvms.js](https://github.com/curiousdannii/ifvms.js), version 1.1.6, commit `6ac63e6b61144d4353a168df16c4ad5c22526f88`.

Copyright (c) 2011–2017 Dannii Willis and other contributors. MIT license retained at `vendor/ifvms/LICENSE`; contributor list retained at `vendor/ifvms/CONTRIBUTORS`. `vendor/ifvms/src/` is unmodified upstream source. `vendor/ifvms/zvm.js` is its esbuild-generated ES module. The experiment supplies a text-only Glk host and uses the interpreter's existing seeded RNG; it does not replace its opcode implementation.

## Development dependencies

Playwright, esbuild and csv-parse are pinned in `package-lock.json`. They are development/test tools and are not loaded by participants. Their packages retain their upstream license files.
