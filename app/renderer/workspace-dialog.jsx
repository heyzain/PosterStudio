import { useEffect, useRef } from 'react';

export function WorkspaceDialog({ className = '', title, close, pending, children }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog ref={dialog} className={'workspace-dialog ' + className} aria-label={title} onCancel={event => {
      event.preventDefault();
      if (!pending) close();
    }}>
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}
