# Poster Studio

Poster Studio is a local-first Electron workspace for preparing posts and planning publication. Create a collection for a poster series, portfolio, or other project. Reuse a shared image and master text while keeping destination-specific copy and publishing progress separate.

## Getting started

Install Node.js 22.12 or later and run these commands in the repository.

```sh
npm ci
npm start
```

Electron downloads its platform binary on the first launch if it is missing from the local cache.

Windows users can open `START-WINDOWS.bat` to build and run the current source. To update an installed copy, build and run a new installer.

1. Choose **Create collection** and set its name and optional cover.
2. Open **Settings** to add Facebook, Instagram, Pinterest, LinkedIn, YouTube, X, Threads, or a custom website. **Manage fields** lets you add, edit, reorder, and archive fields.
3. Choose **Add content**. Add shared artwork and copy, select the destinations for that item, then fill their platform fields.
4. Plan dates in the editor or Calendar. After sharing manually, mark each destination Published. Open an item to copy individual fields or tags, or export the item with its assets.

Website icons can be fetched from eligible public websites, uploaded, or set to the default globe. The workspace and manual publishing tools work offline.

## Local files and recovery

V2 starts with a fresh workspace in the application's per-user data directory, under `workspace-v2/`. It uses `workspace.json` for metadata and `assets/` for original images and attached files. **Settings → Open storage folder** opens that location. Earlier Poster Studio folders are outside the V2 workspace.

**Show in folder** on a saved post reveals its artwork under `Collections/<collection>/Posts/<number> - <title>/`. Poster Studio creates these readable copies when you use the action and preserves existing files if you replace artwork or edit a copy. Collection or post renames can create a new folder on the next reveal. Use the post editor to change the artwork shown in the app.

Archive a collection or item to hide it from active views. Restore collections from the Collections home and restore items in their collection settings. Item numbers are scoped to the collection.

Uploads stay in a draft folder until you save. Closing an editor discards unused draft uploads. In **Collection settings**, **Clean unused files** moves unreferenced files from the workspace asset library to the system trash after confirmation. Saved and archived content stays available, including files for disabled destinations and artwork copies opened in Explorer.

**Export collection backup** writes a JSON snapshot and its referenced assets to a new folder in the selected location. The same format is available for one item. To back up or restore your complete V2 workspace, quit the app and copy or restore the whole `workspace-v2/` directory. Keep a copy of the current directory before restoring.

## Development

| Path | Purpose |
| --- | --- |
| `app/renderer/` | React workspace screens, Tailwind utilities, and Radix platform selector |
| `app/workspace-ui.js`, `app/workspace.css` | Workspace actions, native dialogs, and shared styles |
| `app/workspace.cjs` | Local persistence, asset references, and exports |
| `app/destinations.cjs` | Destination presets and configurable field validation |
| `app/main.cjs`, `app/workspace-preload.cjs` | Electron window, native dialogs, and IPC |
| `app/website-icons.cjs` | Bounded public favicon retrieval |
| `app/index.html` | Standalone browser demo |
| `tests/` | Storage, schema, publishing, and favicon checks |

Run `npm test` for the Node tests. `npm run build:renderer` compiles the React and Tailwind assets. Start and installer commands build them automatically.

## Build an installer

| Platform | Command | Output |
| --- | --- | --- |
| Windows | `npm run dist:win` | NSIS installer |
| macOS | `npm run dist:mac` | DMG |
| Linux | `npm run dist:linux` | AppImage |

Build on the target operating system. On Windows, `BUILD-WINDOWS.bat` installs missing dependencies and builds the installer. Artifacts are written to `release/`. Code signing and notarization require separate configuration.

## License

Contact the repository owner for permission to reuse or distribute the code.
