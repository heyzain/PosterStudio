import { useState } from 'react';
import { Dropdown } from './dropdown.jsx';
import { useDraftAssets } from './draft-assets.js';
import { WorkspaceDialog } from './workspace-dialog.jsx';

const dateInput = value => value?.length === 10 ? value + 'T00:00' : value ?? '';

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

const noDefault = 'none';
const defaultPlaceholders = { text:'Optional starting text', number:'e.g. 0', url:'https://example.com' };

function FieldArrow({ down = false }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={down ? 'M12 5v14m-5-5 5 5 5-5' : 'M12 19V5m-5 5 5-5 5 5'} /></svg>;
}

function DefaultValue({ type, value }) {
  if (type === 'checkbox') return <input type="checkbox" name="default" defaultChecked={Boolean(value)} />;
  if (type === 'file') return <Dropdown name="default" defaultValue={value === 'shared' ? value : noDefault} options={[[noDefault, 'None'], ['shared', 'Use shared artwork']]} />;
  if (type === 'tags' || type === 'long') return <textarea name="default" rows="2" maxLength={type === 'long' ? 40000 : undefined}
    placeholder={type === 'tags' ? 'e.g. design, portfolio' : 'Optional starting text'}
    defaultValue={type === 'tags' ? value?.join(', ') : value} />;
  return <input name="default" type={{ number:'number', datetime:'datetime-local', url:'url' }[type] ?? 'text'}
    placeholder={defaultPlaceholders[type]}
    step={type === 'number' ? 'any' : undefined} maxLength={type === 'text' ? 1000 : undefined}
    defaultValue={type === 'datetime' ? dateInput(value) : value ?? ''} />;
}

function FieldEditor({ field, fieldLabels, perform, save, back }) {
  const [type, setType] = useState(field?.type ?? 'text');
  const [options, setOptions] = useState(() => field?.options ?? []);
  const defaultIndex = options.findIndex(option => option.id && option.id === field?.defaultValue);
  const updateOption = (index, change) => setOptions(previous => previous.map((option, position) => position === index ? { ...option, ...change } : option));
  function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = { type, label:data.get('label'), description:data.get('description'), required:data.has('required') };
    for (const key of ['min','max','maxLength']) if (data.get(key)) value[key] = Number(data.get(key));
    if (type === 'select') {
      value.options = options;
      const selected = data.get('default');
      if (selected && selected !== noDefault) value.defaultOptionIndex = Number(selected);
    } else {
      const raw = data.get('default');
      value.defaultValue = type === 'checkbox' ? data.has('default') :
        !raw?.trim() || (type === 'file' && raw === noDefault) ? null : type === 'number' ? Number(raw) :
          type === 'tags' ? raw.split(/[,\n]+/).map(tag => tag.trim()).filter(Boolean) : raw;
    }
    void perform(() => save(field?.id, value));
  }
  return <form className="fields" onSubmit={submit}>
    <div><button type="button" className="button quiet" onClick={back}>Back to fields</button></div>
    <Field label="Label"><input name="label" required maxLength={100} placeholder="e.g. Headline" defaultValue={field?.label} /></Field>
    <Field label="Description"><input name="description" maxLength={500} placeholder="What should go in this field?" defaultValue={field?.description} /></Field>
    <Field label="Type"><Dropdown options={Object.entries(fieldLabels)} value={type} disabled={Boolean(field)} onValueChange={setType} /></Field>
    <label className="check"><input type="checkbox" name="required" defaultChecked={field?.required} />Required for Ready and Scheduled</label>
    {type === 'number' && <div className="columns">
      <Field label="Minimum"><input name="min" type="number" step="any" placeholder="No minimum" defaultValue={field?.min} /></Field>
      <Field label="Maximum"><input name="max" type="number" step="any" placeholder="No maximum" defaultValue={field?.max} /></Field>
    </div>}
    {['text','long'].includes(type) && <Field label="Maximum length"><input name="maxLength" type="number" min="1" max="40000" placeholder="e.g. 100 characters" defaultValue={field?.maxLength} /></Field>}
    {type === 'select' ? <div className="block">
      <h3>Options</h3>
      {options.map((option,index) => <div className="option-row" key={option.id ?? index}>
        <input aria-label="Option label" required maxLength={100} placeholder="e.g. Featured" value={option.label} onChange={event => updateOption(index,{label:event.target.value})} />
        <label className="check"><input type="checkbox" checked={Boolean(option.archived)} onChange={event => updateOption(index,{archived:event.target.checked})} />Archived</label>
      </div>)}
      <div><button type="button" className="button" onClick={() => setOptions(previous => [...previous,{label:'',archived:false}])}>Add option</button></div>
      <Field label="Default option"><Dropdown name="default" defaultValue={defaultIndex < 0 ? noDefault : String(defaultIndex)}
        options={[[noDefault, 'No default'], ...options.map((option, index) => [String(index), option.label || 'Option ' + (index + 1)])]} /></Field>
    </div> : <Field label="Default"><DefaultValue key={type} type={type} value={field?.defaultValue} /></Field>}
    <div className="wizard-actions"><button className="button primary">Save field</button></div>
  </form>;
}

export function DestinationDialog({ mode, destination, websites, fieldLabels, close, pickAsset, fetchIcon, discardDraftAssets, saveWebsite, saveIcon, changeField, renderBadge }) {
  const trackAsset = useDraftAssets(discardDraftAssets);
  const [field, setField] = useState(undefined);
  const [icon, setIcon] = useState(mode === 'icon' ? destination.icon : null);
  const [iconChoice, setIconChoice] = useState('');
  const [iconStatus, setIconStatus] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const titles = { icon:'Change destination icon', website:'Add custom website', fields:destination?.name + ' fields' };
  async function perform(task) {
    if (pending) return;
    setPending(true);
    setError('');
    try { await task(); }
    catch (failure) { setError(failure.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'')); }
    finally { setPending(false); }
  }
  const upload = () => perform(async () => {
    const result = await trackAsset(pickAsset('icon'));
    if (result) { setIcon(result.id); setIconChoice('upload'); setIconStatus('Uploaded icon selected.'); }
  });
  const resetIcon = () => { setIcon(null); setIconChoice('default'); setIconStatus('Default icon selected.'); };
  const openField = value => { setError(''); setField(value); };
  const title = field !== undefined ? field ? 'Edit field' : 'Add field' : titles[mode];
  return <WorkspaceDialog className="collection-wizard" title={title} close={close} pending={pending}>
    {error && <p className="error" role="alert">{error}</p>}
    <fieldset className="dialog-controls" disabled={pending}>
      {mode === 'fields' && (field !== undefined
        ? <FieldEditor field={field} fieldLabels={fieldLabels} perform={perform} back={() => openField(undefined)} save={async (id,value) => {
          await changeField(id,'save',value); openField(undefined);
        }} />
        : <div className="fields">
          <div className="actions">
            <button type="button" className="button quiet" onClick={close}>Back to settings</button>
            <button type="button" className="button primary" onClick={() => openField(null)}>Add field</button>
          </div>
          {destination.fields.length ? <div className="block wizard-inset">
            {destination.fields.map((entry,index) => <div className="row" key={entry.id}>
              <div><strong>{entry.label}</strong><small className="destination-detail">{fieldLabels[entry.type]}{entry.archived && ' · Archived'}</small></div>
              <div className="actions">
                <button type="button" className="button" onClick={() => openField(entry)}>Edit</button>
                {destination.fields.length > 1 && <>
                  <button type="button" className="button quiet field-order" disabled={index === 0} aria-label={'Move ' + entry.label + ' up'} onClick={() => perform(() => changeField(entry.id,'up'))}><FieldArrow /></button>
                  <button type="button" className="button quiet field-order" disabled={index === destination.fields.length - 1} aria-label={'Move ' + entry.label + ' down'} onClick={() => perform(() => changeField(entry.id,'down'))}><FieldArrow down /></button>
                </>}
                <button type="button" className="button quiet" onClick={() => perform(() => changeField(entry.id,entry.archived ? 'restore' : 'archive'))}>{entry.archived ? 'Restore' : 'Archive'}</button>
              </div>
            </div>)}
          </div> : <p className="subtle">Add fields for the content you prepare for this destination.</p>}
        </div>)}
      {mode === 'icon' && <div className="fields">
        {renderBadge({...destination,icon})}
        <div className="actions"><button type="button" className="button" onClick={upload}>Upload icon</button><button type="button" className="button quiet" onClick={resetIcon}>Use default</button></div>
        <p className="picker-status" role="status">{iconStatus}</p>
        <div className="wizard-actions"><button type="button" className="button quiet" onClick={close}>Cancel</button><button type="button" className="button primary" onClick={() => perform(() => saveIcon(icon))}>Save icon</button></div>
      </div>}
      {mode === 'website' && <div className="fields">
        {websites.length > 0 && <form className="block wizard-inset" onSubmit={event => {
          event.preventDefault();
          const id = new FormData(event.currentTarget).get('site');
          void perform(() => saveWebsite({id}));
        }}>
          <Field label="Saved website"><Dropdown name="site" defaultValue={websites[0].id} options={websites.map(site => [site.id, site.name])} /></Field>
          <div><button className="button">Add saved website</button></div>
        </form>}
        <form className="fields" onSubmit={event => {
          event.preventDefault();
          const {name,url,description} = Object.fromEntries(new FormData(event.currentTarget));
          void perform(async () => saveWebsite({name,url,description,icon:iconChoice ? icon : (await trackAsset(fetchIcon(url)))?.id ?? null}));
        }}>
          <Field label="Website name"><input name="name" required maxLength={100} placeholder="e.g. My portfolio" /></Field>
          <Field label="Website URL"><input name="url" required type="url" maxLength={2048} placeholder="https://example.com" onChange={() => {
            if (iconChoice === 'fetched') { setIcon(null); setIconChoice(''); setIconStatus(''); }
          }} /></Field>
          <Field label="Description (optional)"><textarea name="description" rows="2" maxLength={500} placeholder="What do you publish here?" /></Field>
          <div className="block wizard-inset">
            {renderBadge({name:'Website icon',type:'website',icon})}
            <div className="actions"><button type="button" className="button" onClick={event => {
              const url = event.currentTarget.form.elements.url;
              if (url.reportValidity()) void perform(async () => {
                const result = await trackAsset(fetchIcon(url.value));
                setIcon(result?.id ?? null); setIconChoice('fetched'); setIconStatus(result ? 'Favicon selected.' : 'Favicon unavailable.');
              });
            }}>Fetch favicon</button><button type="button" className="button" onClick={upload}>Upload icon</button><button type="button" className="button quiet" onClick={resetIcon}>Use globe</button></div>
            <p className="picker-status" role="status">{iconStatus}</p>
          </div>
          <div className="wizard-actions"><button type="button" className="button quiet" onClick={close}>Cancel</button><button className="button primary">Add website</button></div>
        </form>
      </div>}
    </fieldset>
  </WorkspaceDialog>;
}
