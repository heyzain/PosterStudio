# Poster Studio

A local-first desktop library for organizing poster artwork, writing Instagram and Pinterest content, and planning a publishing calendar. Built with Electron, vanilla JavaScript, HTML, and CSS.

## Features

- Visual poster collection with separate viewing and editing modes.
- Separate Instagram and Pinterest artwork, captions, and publishing dates.
- Draft, ready, and published statuses, plus completion tracking for each platform.
- Calendar and upcoming tasks to plan your content.
- Light mode and neutral charcoal dark mode with sage green accents.
- Responsive layout for smaller desktop windows.
- File-based collections with a remembered folder location.
- Original PNG, JPEG, and WebP artwork, up to 30 MB per image.
- Soft deletion that keeps removed posters in a recovery folder.

Publishing is manual: calendar dates help you plan; the app does not upload or automatically publish to social platforms. No account or cloud service is required. After dependencies are installed, the app works offline.

## Getting started

Install Node.js LTS (Node.js 22 or newer) and Git, then clone the repository:

```sh
git clone https://github.com/heyzain/PosterStudio.git
cd PosterStudio
npm ci
npm start
```

On Windows, you can also double-click `START-WINDOWS.bat`. It installs missing Electron dependencies and starts the app. If installation or launch fails, the window stays open so you can read the error.

On first launch:

1. Click **Choose collection folder** and select a folder for your content. An empty folder is fine; a folder outside the source repository is recommended.
2. Click **New poster**, add your artwork and content, and save.
3. Set publishing dates and mark each platform as posted when you publish manually.
4. Use **Folder** in the top bar to switch collections. The chosen location is remembered between launches.

## Build an installer

Run `npm ci` before building. An internet connection is needed for dependencies and any packaging tools downloaded on the first build.

| Platform | Command | Output |
| --- | --- | --- |
| Windows | `npm run dist:win` | NSIS installer |
| macOS | `npm run dist:mac` | DMG |
| Linux | `npm run dist:linux` | AppImage |

Build on the corresponding operating system. Windows users can double-click `BUILD-WINDOWS.bat` to install dependencies and build the installer.

Artifacts are written to `release/`, which is excluded from Git. Rebuild and reinstall to see source changes in an installed copy. Code signing and notarization are not configured; distributing signed builds requires additional setup.

## Your data

Each collection is a normal folder containing:

```text
MyCollection/
  .poster-studio.json
  Posters/
    001/
      poster.json
      instagram.png
      pinterest.jpg
    002/
      poster.json
  .PosterStudioTrash/
```

- `.poster-studio.json` stores collection ordering and the next poster number.
- Each numbered folder stores poster metadata and original artwork; image extensions depend on the uploaded files.
- Deleted poster folders move to `.PosterStudioTrash/` for manual recovery. Poster numbers are not recycled.
- The collection location is stored in `preferences.json` under Electron's per-user application data directory. Theme preference is stored locally in the renderer.
- Switching collections keeps their contents separate. Back up the entire collection folder to preserve your work.
- Data from earlier browser prototypes is not imported automatically.

The app saves content to your selected collection, so reinstalling the application does not replace that collection. Keep backups before manually editing or restoring collection files.

## Development

| Path | Purpose |
| --- | --- |
| `app/index.html` | UI, styles, themes, and renderer logic |
| `app/main.cjs` | Electron window, native dialogs, and IPC handlers |
| `app/preload.cjs` | Limited bridge between renderer and main process |
| `app/storage.cjs` | Collection validation, image handling, and file persistence |
| `assets/` | Application icons |
| `tests/storage.test.cjs` | Storage and artwork validation tests |

The renderer uses context isolation and sandboxing, with Node integration disabled. Artwork is served through a restricted `poster-media://` protocol. External window creation and navigation are blocked.

Run the storage tests:

```sh
npm test
```

Tests cover collection creation, original image persistence, reopening, schedule updates, completion tracking, soft deletion, numbering, and artwork URL validation. They run with Node.js without launching Electron. Check desktop layout, theme switching, and packaged installers separately on the target operating system.

## Troubleshooting

- **The start script reports missing Node.js:** install Node.js LTS, then reopen your terminal or run the batch file again.
- **Dependency installation fails:** check your connection and proxy settings, then run `npm ci` from the project folder to see the full error.
- **The installed app shows an older design:** rebuild with `npm run dist:win` and install the newly generated installer from `release/`.
- **A collection is on a disconnected drive:** reconnect the drive or choose an available collection folder.

## License

No license has been selected for this repository. Contact the repository owner for permission to reuse or distribute the code.
