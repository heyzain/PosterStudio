import { useRef, useState } from 'react';
import { destinationLabels } from './destination-labels.js';
import { Dropdown } from './dropdown.jsx';
import { WorkspaceDialog } from './workspace-dialog.jsx';

export function PlanDialog({ entries, date, close, save, postNumber }) {
  const [postId, setPostId] = useState(entries[0]?.item.id);
  const [destinationId, setDestinationId] = useState();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const entry = entries.find(({ item }) => item.id === postId);
  const destination = entry?.destinations.find(candidate => candidate.id === destinationId) ?? entry?.destinations[0];
  const labels = destinationLabels(entry?.collection.destinations ?? []);

  async function submit(event) {
    event.preventDefault();
    if (inFlight.current || !destination) return;
    const data = new FormData(event.currentTarget);
    inFlight.current = true;
    setPending(true);
    setError('');
    try { await save({ ...entry, destination }, data.get('date')); }
    catch (failure) { setError(failure.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')); }
    finally { inFlight.current = false; setPending(false); }
  }

  return (
    <WorkspaceDialog className="plan-dialog" title="Plan a post" close={close} pending={pending}>
      <form onSubmit={submit}>
        {entries.length ? <div className="fields">
          <label className="field"><span>Post</span>
            <Dropdown value={postId} disabled={pending} onValueChange={id => { setPostId(id); setDestinationId(undefined); setError(''); }}
              options={entries.map(({ collection, item }) => [item.id, `${collection.name} · ${postNumber(item)} · ${item.title}`])} />
          </label>
          <label className="field"><span>Destination</span>
            <Dropdown value={destination?.id} disabled={pending} onValueChange={id => { setDestinationId(id); setError(''); }}
              options={entry.destinations.map(candidate => [candidate.id, labels.get(candidate.id)])} />
          </label>
          <label className="field"><span>Date and time</span><input name="date" type="datetime-local" defaultValue={date + 'T09:00'} disabled={pending} required /></label>
        </div> : <p className="subtle">No posts can be planned with these filters. Try clearing the filters, or add a post and enable a destination in its collection.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <footer className="wizard-actions">
          <button type="button" className={entries.length ? 'button quiet' : 'button'} disabled={pending} onClick={close}>{entries.length ? 'Cancel' : 'Close'}</button>
          {entries.length > 0 && <button className="button primary" disabled={pending}>Save plan</button>}
        </footer>
      </form>
    </WorkspaceDialog>
  );
}
