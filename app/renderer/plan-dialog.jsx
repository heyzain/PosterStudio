import { useRef, useState } from 'react';
import { Dropdown } from './dropdown.jsx';
import { WorkspaceDialog } from './workspace-dialog.jsx';

export function PlanDialog({ entries, date, close, save }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  async function submit(event) {
    event.preventDefault();
    if (inFlight.current || !entries.length) return;
    const data = new FormData(event.currentTarget);
    inFlight.current = true;
    setPending(true);
    setError('');
    try { await save(entries[Number(data.get('target'))], data.get('date')); }
    catch (failure) { setError(failure.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')); }
    finally { inFlight.current = false; setPending(false); }
  }

  return (
    <WorkspaceDialog className="plan-dialog" title="Plan a post" close={close} pending={pending}>
      <form onSubmit={submit}>
        {entries.length ? <div className="fields">
          <label className="field"><span>Post and destination</span>
            <Dropdown name="target" defaultValue="0" disabled={pending} required options={entries.map(({ collection, item, destination }, index) =>
              [String(index), `${collection.name} · ${item.title} · ${destination.name}`])} />
          </label>
          <label className="field"><span>Date and time</span><input name="date" type="datetime-local" defaultValue={date + 'T09:00'} required /></label>
        </div> : <p className="subtle">No unpublished posts with a destination match the calendar filters.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <footer className="wizard-actions">
          <button type="button" className={entries.length ? 'button quiet' : 'button'} disabled={pending} onClick={close}>{entries.length ? 'Cancel' : 'Close'}</button>
          {entries.length > 0 && <button className="button primary" disabled={pending}>Save plan</button>}
        </footer>
      </form>
    </WorkspaceDialog>
  );
}
