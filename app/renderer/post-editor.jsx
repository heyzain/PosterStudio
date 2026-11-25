import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { useRef, useState } from 'react';
import { destinationArtwork } from './artwork-preview.js';
import { useDraftAssets } from './draft-assets.js';
import { Dropdown } from './dropdown.jsx';
import { localDateTime } from './local-dates.js';
import { WorkspaceDialog } from './workspace-dialog.jsx';

const dateInput = value => value?.length === 10 ? value + 'T00:00' : value ?? '';

function Field({ label, description, children }) {
  return <label className="field"><span>{label}</span>{children}{description && <small>{description}</small>}</label>;
}

function AssetButtons({ value, artwork, update, pick, pending }) {
  return (
    <div className="inline">
      <small>{value === 'shared' ? 'Shared artwork' : value?.name ?? 'No file selected'}</small>
      <button type="button" className="button" disabled={pending} onClick={() => pick('file', update)}>Choose file</button>
      <button type="button" className="button" disabled={pending} onClick={() => pick('image', update)}>Choose image</button>
      <button type="button" className="button" disabled={!artwork || pending} onClick={() => update('shared')}>Use shared artwork</button>
      {value && <button type="button" className="button quiet" onClick={() => update(null)}>Clear</button>}
    </div>
  );
}

function DestinationField({ definition, value, update, artwork, pick, pending }) {
  const { label, description, type, maxLength, options, required } = definition;
  const title = label + (required ? ' *' : '');
  if (type === 'file') {
    return <div className="field" role="group" aria-label={title}><span>{title}</span>
      <AssetButtons {...{ value, artwork, update, pick, pending }} />{description && <small>{description}</small>}</div>;
  }
  const setValue = event => update(event.target.value);
  let control;
  switch (type) {
    case 'checkbox':
      control = <input type="checkbox" checked={Boolean(value)} onChange={event => update(event.target.checked)} />;
      break;
    case 'select':
      control = <Dropdown value={value || 'none'} disabled={pending} onValueChange={option => update(option === 'none' ? '' : option)}
        options={[
          ['none', 'Choose.'],
          ...options.filter(option => !option.archived || option.id === value).map(option =>
            [option.id, option.label + (option.archived ? ' (archived)' : '')]),
        ]} />;
      break;
    case 'long':
    case 'tags':
      control = <textarea rows={type === 'long' ? 3 : 2} maxLength={type === 'long' ? maxLength ?? 40000 : undefined}
        placeholder={type === 'tags' ? 'Separate tags with commas or new lines' : `Enter ${label.toLowerCase()}`} value={value ?? ''} onChange={setValue} />;
      break;
    default:
      control = <input type={{ datetime: 'datetime-local', number: 'number', url: 'url' }[type] ?? 'text'}
        step={type === 'number' ? 'any' : undefined} maxLength={type === 'text' ? maxLength ?? 1000 : undefined}
        placeholder={type === 'url' ? 'https://example.com' : type === 'datetime' ? undefined : `Enter ${label.toLowerCase()}`}
        value={value ?? ''} onChange={setValue} />;
  }
  return <Field label={title} description={description}>{control}</Field>;
}

function fieldInput(definition, value) {
  if (definition.type === 'tags') return value?.join(', ') ?? '';
  if (definition.type === 'datetime') return dateInput(value);
  return value;
}

function storedValue(definition, value, previous) {
  if (definition.type === 'file' || definition.type === 'checkbox') return value ?? null;
  if (value == null || !String(value).trim()) return null;
  if (definition.type === 'datetime') return value === dateInput(previous) ? previous : value;
  if (definition.type === 'tags') return value.split(/[,\n]+/).map(tag => tag.trim()).filter(Boolean);
  if (definition.type === 'number') return Number(value);
  if (definition.type === 'url') return value.trim();
  return value;
}

function destinationDraft(destination, record) {
  const values = { ...record?.values };
  for (const definition of destination.fields.filter(field => !field.archived)) {
    values[definition.id] = fieldInput(definition, Object.hasOwn(values, definition.id) ? values[definition.id] : definition.defaultValue);
  }
  return {
    id: destination.id, status: 'draft', url: '', selected: true, ...record, values,
    planned: dateInput(record?.planned), published: dateInput(record?.published),
  };
}

export function PostEditor({ collection, item, initialDestination, close, save, pickAsset, discardDraftAssets, showArtwork, artworkProgress, source, statusLabels, renderBadge }) {
  const trackAsset = useDraftAssets(discardDraftAssets);
  const [draft, setDraft] = useState(() => {
    const initial = !item && collection.destinations.find(destination => destination.id === initialDestination);
    return {
      title: '', stage: 'draft', master: '', notes: '', artwork: null, ...item,
      records: item ? item.records.map(record => destinationDraft(
        collection.destinations.find(destination => destination.id === record.id), record,
      )) : initial ? [destinationDraft(initial)] : [],
    };
  });
  const [active, setActive] = useState(initialDestination);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const selected = draft.records.filter(record => record.selected);
  const record = selected.find(entry => entry.id === active) ?? selected[0];
  const destination = collection.destinations.find(entry => entry.id === record?.id);
  const platformArtwork = destinationArtwork(destination, record);
  const previewAsset = platformArtwork ?? draft.artwork;
  const savedRecord = item?.records.find(entry => entry.selected && entry.id === record?.id);
  const needsPublishedDate = record?.status === 'published' &&
    (savedRecord?.status !== 'published' || Boolean(savedRecord.published || (savedRecord.planned && !record.planned)));
  const canRevealArtwork = previewAsset && item &&
    (item.artwork === previewAsset || destinationArtwork(destination, savedRecord) === previewAsset);
  const artworkTarget = canRevealArtwork && { collectionId: collection.id, itemId: item.id, assetId: previewAsset };
  const revealProgress = artworkTarget && artworkProgress(artworkTarget);
  const available = collection.destinations.filter(entry => entry.enabled || item?.records.some(previous => previous.id === entry.id && previous.selected));
  const title = item ? 'Edit post' : 'Add post';
  const update = (key, value) => setDraft(previous => ({ ...previous, [key]: value }));
  const updateRecord = (id, change) => setDraft(previous => ({
    ...previous, records: previous.records.map(entry => entry.id === id ? change(entry) : entry),
  }));
  const updatePublication = (key, value) => updateRecord(record.id, entry => ({ ...entry, [key]: value }));

  function updateStatus(status) {
    updateRecord(record.id, entry => ({
      ...entry, status,
      published: status === 'published' && !entry.published ? localDateTime() : entry.published,
    }));
  }

  function toggle(entry, checked) {
    if (checked) setActive(entry.id);
    setDraft(previous => {
      const existing = previous.records.find(channel => channel.id === entry.id);
      if (!existing) return { ...previous, records: [...previous.records, destinationDraft(entry)] };
      return { ...previous, records: previous.records.map(channel => channel.id === entry.id ? { ...channel, selected: checked } : channel) };
    });
  }

  async function perform(operation) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError('');
    try { await operation(); }
    catch (failure) { setError(failure.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')); }
    finally { inFlight.current = false; setPending(false); }
  }

  function pick(kind, apply) {
    return perform(async () => {
      const asset = await trackAsset(pickAsset(kind));
      if (asset) apply(asset);
    });
  }

  function submit(event) {
    event.preventDefault();
    void perform(() => {
      const records = draft.records.map(entry => {
        if (!entry.selected) return { id: entry.id, selected: false };
        const previous = item?.records.find(channel => channel.id === entry.id);
        const definitions = collection.destinations.find(channel => channel.id === entry.id).fields;
        const values = { ...entry.values };
        for (const definition of definitions.filter(field => !field.archived)) {
          values[definition.id] = storedValue(definition, values[definition.id], previous?.values[definition.id]);
        }
        return {
          ...entry, values,
          planned: entry.planned === dateInput(previous?.planned) ? previous?.planned ?? '' : entry.planned,
          published: entry.published === dateInput(previous?.published) ? previous?.published ?? '' : entry.published,
        };
      });
      return save(collection.id, { ...draft, records }, record?.id);
    });
  }

  return (
    <WorkspaceDialog className="react-post-editor" title={title} close={close} pending={pending}>
      <form onSubmit={submit}>
        <div className="post-editor-top">
          <section className="post-art">
            <h3>Shared artwork <small>Optional</small></h3>
            <div className="post-art-stage">{previewAsset
              ? <img src={source(previewAsset)} alt={platformArtwork ? `${destination.name} artwork preview` : 'Shared artwork preview'} />
              : <p>No artwork selected</p>}</div>
            {platformArtwork && <p className="subtle">Previewing {destination.name} artwork</p>}
            <div className="actions post-art-actions">
              <button type="button" className="button" disabled={pending} onClick={() => pick('image', asset => update('artwork', asset.id))}>{draft.artwork ? 'Replace shared image' : 'Choose shared image'}</button>
              {draft.artwork && <button type="button" className="button quiet" disabled={pending} onClick={() => update('artwork', null)}>Remove shared image</button>}
              {artworkTarget && <button type="button" className="button quiet" disabled={pending || Boolean(revealProgress)}
                aria-busy={Boolean(revealProgress) || undefined} onClick={() => showArtwork(artworkTarget)}>{revealProgress ?? 'Show in folder'}</button>}
            </div>
          </section>
          <section className="fields" aria-label="Post details">
            <Field label="Title"><input autoFocus required maxLength={150} placeholder="e.g. Zavi in the Snow" value={draft.title} onChange={event => update('title', event.target.value)} /></Field>
            <Field label="Creative stage"><Dropdown options={[[ 'draft', 'Draft' ], [ 'ready', 'Ready' ]]} value={draft.stage}
              disabled={pending} onValueChange={stage => update('stage', stage)} /></Field>
            <Field label="Master text (optional)"><textarea rows="2" maxLength={40000} placeholder="Write the copy you'll adapt for each platform" value={draft.master} onChange={event => update('master', event.target.value)} /></Field>
            <Field label="Internal notes (optional)"><textarea rows="2" maxLength={20000} placeholder="Ideas, reminders, or approvals" value={draft.notes} onChange={event => update('notes', event.target.value)} /></Field>
          </section>
        </div>
        <section className="post-publishing">
          <h3>Publishing destinations <small>Optional</small></h3>
          {available.length ? <div className="post-destination-choices">{available.map(entry => (
            <label className="check destination-choice" key={entry.id}>
              <input type="checkbox" disabled={pending} checked={selected.some(channel => channel.id === entry.id)} onChange={event => toggle(entry, event.target.checked)} />
              {entry.name}
            </label>
          ))}</div> : <p className="subtle">Add destinations in collection settings.</p>}
          {record && <>
            <ToggleGroup.Root className="platform-options" type="single" aria-label="Destination to edit" value={record.id}
              disabled={pending} onValueChange={value => value && setActive(value)}>
              {selected.map(channel => <ToggleGroup.Item key={channel.id} className="button" value={channel.id}>
                {renderBadge(collection.destinations.find(entry => entry.id === channel.id))}
              </ToggleGroup.Item>)}
            </ToggleGroup.Root>
            <fieldset className="post-destination fields" key={record.id}>
              <legend>{destination.name}</legend>
              {destination.fields.filter(definition => !definition.archived).map(definition =>
                <DestinationField key={definition.id} definition={definition} value={record.values[definition.id]} artwork={draft.artwork}
                  pick={pick} pending={pending} update={value => updateRecord(record.id, entry => ({ ...entry, values: { ...entry.values, [definition.id]: value } }))} />)}
              <div className="columns">
                <Field label="Publishing status"><Dropdown options={Object.entries(statusLabels)} value={record.status}
                  disabled={pending} onValueChange={updateStatus} /></Field>
                <Field label="Planned for"><input type="datetime-local" value={record.planned} onChange={event => updatePublication('planned', event.target.value)} /></Field>
                <Field label="Published at"><input type="datetime-local" required={needsPublishedDate} value={record.published} onChange={event => updatePublication('published', event.target.value)} /></Field>
                <Field label="Published URL"><input type="url" placeholder="https://example.com/post" value={record.url ?? ''} onChange={event => updatePublication('url', event.target.value)} /></Field>
              </div>
            </fieldset>
          </>}
        </section>
        {error && <p className="error" role="alert">{error}</p>}
        <footer className="wizard-actions">
          <button type="button" className="button quiet" disabled={pending} onClick={close}>Cancel</button>
          <button className="button primary" disabled={pending}>{item ? 'Save changes' : 'Add post'}</button>
        </footer>
      </form>
    </WorkspaceDialog>
  );
}
