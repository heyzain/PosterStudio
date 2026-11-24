import { useSyncExternalStore } from 'react';

const windowControls = window.studioWindow;

function WindowButton({ action, label, children }) {
  return (
    <button
      type="button"
      className="chrome-button"
      data-window-action={action}
      aria-label={label}
      title={label}
      onClick={() => windowControls.control(action)}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">{children}</svg>
    </button>
  );
}

function NativeWindowControls() {
  const maximized = useSyncExternalStore(windowControls.subscribe, windowControls.isMaximized);

  return (
      <div className="window-controls" role="group" aria-label="Window controls">
        <WindowButton action="minimize" label="Minimize">
          <path d="M3 8h10" />
        </WindowButton>
        <WindowButton action="toggle-maximize" label={maximized ? 'Restore down' : 'Maximize'}>
          {maximized
            ? <path d="M6 4V2.5h7.5V10H12M2.5 6h7.5v7.5H2.5z" />
            : <rect x="3" y="3" width="10" height="10" rx=".5" />}
        </WindowButton>
        <WindowButton action="close" label="Close">
          <path d="m4 4 8 8m0-8-8 8" />
        </WindowButton>
      </div>
  );
}

export const WindowControls = windowControls ? NativeWindowControls : () => null;
