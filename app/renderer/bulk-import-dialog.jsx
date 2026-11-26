import { useRef, useState } from 'react';
import { Dropdown } from './dropdown.jsx';
import { WorkspaceDialog } from './workspace-dialog.jsx';

export function BulkImportDialog({ collection, chooseCsv, chooseFolder, saveTemplate, previewCsv, importCsv, close, source }) {
  const [csv, setCsv] = useState(null);
  const [mapping, setMapping] = useState({});
  const [selected, setSelected] = useState([]);
  const [preview, setPreview] = useState(null);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  async function run(label, action) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(label);
    setError('');
    try { await action(); }
    catch (failure) { setError(failure.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')); }
    finally { inFlight.current = false; setPending(''); }
  }

  function selectCsv() {
    return run('Opening CSV…', async () => {
      const next = await chooseCsv();
      if (!next) return;
      setCsv(next);
      setMapping(next.mapping);
      setSelected(next.groups.map(group => group.id));
      setPreview(null);
    });
  }

  function selectFolder() {
    return run('Opening folder…', async () => {
      const root = await chooseFolder(csv.token);
      if (!root) return;
      setCsv({ ...csv, root });
      setPreview(null);
    });
  }

  function review() {
    return run('Checking rows and copying preview files…', async () => {
      setPreview(null);
      setPreview(await previewCsv(csv.token, mapping, selected));
    });
  }

  const errors = preview?.rows.filter(row => row.errors.length).length ?? 0;
  const duplicates = preview?.rows.filter(row => row.duplicate).length ?? 0;
  const cancel = () => run('Closing…', () => close(csv?.token));
  const headerOptions = csv && [['-1','Skip column'], ...csv.headers.map((header,index) => [String(index), (index + 1) + '. ' + header])];
  return (
    <WorkspaceDialog className="bulk-import-dialog" title="Bulk add posts" close={cancel} pending={Boolean(pending)}>
      <p>Import a CSV UTF-8 into <strong>{collection.name}</strong>. Each row becomes a draft.</p>
      <div className="actions bulk-file-actions">
        <button type="button" className="button secondary" disabled={Boolean(pending)} onClick={() => run('Saving template…', saveTemplate)}>Download template</button>
        <button type="button" className={'button ' + (csv ? 'secondary' : 'primary')} disabled={Boolean(pending)} onClick={selectCsv}>{csv ? 'Change CSV' : 'Choose CSV'}</button>
      </div>
      {csv && <>
        <p className="bulk-file-name"><strong>{csv.name}</strong></p>
        <div className="bulk-import-folder">
          <div><strong>Folder for relative paths</strong><div>{csv.root}</div></div>
          <button type="button" className="button secondary" disabled={Boolean(pending)} onClick={selectFolder}>Change folder</button>
        </div>
        <p className="bulk-hint">Use a filename, a path inside this folder, or a full local path in an image column. Preview reads the files listed in the CSV and makes local copies.</p>
        <details key={csv.token} open={csv.mapping.title < 0 || undefined}>
          <summary>Map columns</summary>
          <div className="bulk-mapping">
            {csv.columns.map(({key,label}) => (
              <div key={key}><span>{label}{key === 'title' ? ' (required)' : ''}</span>
                <Dropdown label={label} options={headerOptions} value={String(mapping[key])} disabled={Boolean(pending)}
                  onValueChange={value => { setMapping(previous => ({ ...previous, [key]:Number(value) })); setPreview(null); }} />
              </div>
            ))}
          </div>
        </details>
        {csv.groups.length > 0 && <fieldset disabled={Boolean(pending)} className="bulk-destinations">
          <legend>Default destinations</legend>
          <div>{csv.groups.map(({id,name}) => (
            <label key={id}><input type="checkbox" checked={selected.includes(id)} onChange={event => {
              setSelected(event.target.checked ? [...selected,id] : selected.filter(value => value !== id));
              setPreview(null);
            }} />{name}</label>
          ))}</div>
          {mapping.destinations >= 0 && <small>Set destinations for an individual row using their names, separated by semicolons.</small>}
        </fieldset>}
      </>}
      {preview && <section aria-label="Import preview">
        <h3>{preview.rows.length} {preview.rows.length === 1 ? 'post' : 'posts'} in preview</h3>
        {errors > 0 && <p className="error">{errors} {errors === 1 ? 'row needs' : 'rows need'} attention. Fix the CSV and choose it again.</p>}
        {duplicates > 0 && <p>{duplicates} {duplicates === 1 ? 'row repeats a title' : 'rows repeat titles'}. Review these before importing.</p>}
        <ol className="bulk-preview-list">
          {preview.rows.map(row => <li key={row.line}>
            <div><small>Line {row.line}</small><strong>{row.title || 'Untitled'}</strong>
              <small>{row.destinations.join(', ') || 'No destinations'}</small>
              {row.duplicate && <small>Possible duplicate title</small>}
              {row.errors.map((message,index) => <small className="error" key={index}>{message}</small>)}
            </div>
            {!!row.images.length && <div className="bulk-preview-images">
              {row.images.map(({id,name,label},index) => <img key={index} src={source(id,'small')} alt={label + ' · ' + name} title={label + ' · ' + name} loading="lazy" />)}
            </div>}
          </li>)}
        </ol>
      </section>}
      {error && <p role="alert" className="error">{error}</p>}
      {pending && <p role="status">{pending}</p>}
      <div className="actions bulk-import-footer">
        <button type="button" className="button secondary" disabled={Boolean(pending)} onClick={cancel}>Cancel</button>
        {csv && (preview?.valid
          ? <button type="button" className="button primary" disabled={Boolean(pending)}
              onClick={() => run('Importing drafts…', () => importCsv(csv.token))}>Import {preview.rows.length} {preview.rows.length === 1 ? 'draft' : 'drafts'}</button>
          : <button type="button" className="button primary" disabled={Boolean(pending) || mapping.title < 0} onClick={review}>Preview posts</button>)}
      </div>
    </WorkspaceDialog>
  );
}
