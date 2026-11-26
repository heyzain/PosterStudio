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
4. Plan dates in the editor or Calendar. After sharing manually, mark each destination Published. Search posts by title, copy, tags, notes, or number. The collection view shows progress when only some destinations are published.

Website icons can be fetched from eligible public websites, uploaded, or set to the default globe. The workspace and manual publishing tools work offline.

### Bulk add posts

Open a collection and choose **Bulk add**. Download its CSV template or map the columns from an existing CSV UTF-8. Use one row per post with a **Post title**. The **Shared image** column and destination file columns accept a filename, a relative path such as `images/cover.png`, or a full local path such as `F:\Artwork\cover.png`. Relative paths use the CSV's folder by default. Use **Change folder** to select a different base.

Choose the default destinations for the batch. To override them for one row, enter names such as `Facebook; Pinterest` in the **Destinations** column. Leave a platform's image field blank to use its collection default. Put captions containing commas, quotes, or line breaks in quoted CSV cells, or let your spreadsheet export them. Preview the rows and fix any errors before importing. Poster Studio copies the referenced files and saves the batch as new drafts in the selected collection.

## Local files and recovery

V2 stores metadata and original files in `workspace-v2/` in the application's per-user data directory. Earlier Poster Studio folders are outside the V2 workspace.

**Open collection folder** in Collection settings opens `Collections/<collection>/`. **Show in folder** on a saved post reveals its artwork under that folder's `Posts/<number> - <title>/` directory. Poster Studio creates these readable copies when you use the artwork action and preserves existing files if you replace artwork or edit a copy. Collection or post renames can create a new folder on the next reveal. Use the post editor to change the artwork shown in the app.

Archive a collection or item to hide it from active views. Restore collections from the Collections home and restore items in their collection settings. Item numbers are scoped to the collection.

Uploads stay in a draft folder until you save. Closing an editor discards unused draft uploads. In **Collection settings**, **Clean unused files** moves unreferenced files from the workspace asset library to the system trash after confirmation. Saved and archived content stays available, including files for disabled destinations and artwork copies opened in Explorer.

**Export collection backup** writes `collection.json` and its referenced `assets/` to a new folder in the selected location. The same format is available for one post. From Collections, choose **Restore backup**, select the JSON file, review the preview, and choose **Restore as new collection**. If the name is already in use, the restored collection gets a suffix. Keep the exported assets folder beside the JSON file. To back up or restore your complete V2 workspace, quit the app and copy or restore the whole `workspace-v2/` directory. Keep a copy of the current directory before restoring.

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
