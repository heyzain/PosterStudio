import { useEffect, useRef, useState } from 'react';
import { Dropdown } from './dropdown.jsx';
import { useDraftAssets } from './draft-assets.js';
import { WorkspaceDialog } from './workspace-dialog.jsx';

const marks = [['folder', 'Folder'], ['story', 'Story'], ['code', 'Code'], ['photo', 'Photo']];

export function CollectionWizard({ collection, close, save, pickAsset, fetchIcon, discardDraftAssets, destinations, websites, source, renderBadge, renderMark }) {
  const trackAsset = useDraftAssets(discardDraftAssets);
  const detailsForm = useRef(null);
  const websiteUrlInput = useRef(null);
  const stepHeading = useRef(null);
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(() => ({
    name: collection?.name ?? '', description: collection?.description ?? '', mark: collection?.mark ?? 'folder',
    cover: collection?.cover ?? null, icon: collection?.icon ?? null,
  }));
  const [presets, setPresets] = useState([]);
  const [savedSites, setSavedSites] = useState([]);
  const [customSites, setCustomSites] = useState([]);
  const [websiteOpen, setWebsiteOpen] = useState(false);
  const [websiteName, setWebsiteName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [websiteDescription, setWebsiteDescription] = useState('');
  const [websiteIcon, setWebsiteIcon] = useState(null);
  const [iconStatus, setIconStatus] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (step === 2) stepHeading.current?.focus();
  }, [step]);

  const update = (key, value) => setDraft(previous => ({ ...previous, [key]: value }));
  const toggle = (set, value) => set(previous => previous.includes(value) ? previous.filter(entry => entry !== value) : [...previous, value]);

  async function withPicker(task) {
    setPending(true);
    setError('');
    try {
      await task();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setPending(false);
    }
  }

  function pick(key, kind) {
    return withPicker(async () => {
      const asset = await trackAsset(pickAsset(kind));
      if (asset) update(key, asset.id);
    });
  }

  function closeWebsite() {
    setWebsiteOpen(false);
    setWebsiteName('');
    setWebsiteUrl('');
    setWebsiteDescription('');
    setWebsiteIcon(null);
    setIconStatus('');
  }

  function addWebsite(event) {
    event.preventDefault();
    setError('');
    try {
      const url = new URL(websiteUrl.trim());
      const name = websiteName.trim();
      if (!name || !['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('Enter a name and an HTTP or HTTPS website URL.');
      }
      if (customSites.some(site => site.url === url.href) || websites.some(site => savedSites.includes(site.id) && site.url === url.href)) {
        throw new Error('This website is already selected.');
      }
      setCustomSites(previous => [...previous, { name, url: url.href, description: websiteDescription, icon: websiteIcon }]);
      closeWebsite();
    } catch (failure) {
      setError(failure.message);
    }
  }

  async function submit() {
    if (step === 1) {
      if (!detailsForm.current.reportValidity() || !draft.name.trim()) {
        if (!draft.name.trim()) setError('Collection name is required.');
        return;
      }
      if (!collection) {
        setError('');
        setStep(2);
        return;
      }
    }
    setPending(true);
    setError('');
    try {
      await save(collection ? draft : {
        ...draft,
        destinations: [
          ...presets.map(type => ({ type })),
          ...savedSites.map(id => ({ type: 'website', profile: { id } })),
          ...customSites.map(profile => ({ type: 'website', profile })),
        ],
      });
    } catch (failure) {
      setError(failure.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''));
    } finally {
      setPending(false);
    }
  }

  return (
    <WorkspaceDialog className="collection-wizard" title={collection ? 'Edit collection' : 'Create collection'} close={close} pending={pending}>
        {!collection && <ol className="wizard-steps" aria-label="Collection setup">
          <li aria-current={step === 1 ? 'step' : undefined}><span>1</span>Collection details</li>
          <li aria-current={step === 2 ? 'step' : undefined}><span>2</span>Publishing destinations</li>
        </ol>}
        {error && <p className="error" role="alert">{error}</p>}
        {step === 1 ? (
          <form ref={detailsForm} id="collection-details-form" className="fields" onSubmit={event => { event.preventDefault(); void submit(); }}>
            <label className="field"><span>Collection name</span><input autoFocus required maxLength={100} placeholder="e.g. My Portfolio" value={draft.name} onChange={event => update('name', event.target.value)} /></label>
            <label className="field"><span>Description</span><textarea rows="3" maxLength={1000} placeholder="What goes in this collection?" value={draft.description} onChange={event => update('description', event.target.value)} /></label>
            <div className="cover-field wizard-cover">
              <div className="fields">
                <h3>Cover image <small>Optional</small></h3>
                <div className="actions">
                  <button type="button" className="button" disabled={pending} onClick={() => pick('cover', 'image')}>{draft.cover ? 'Replace cover' : 'Choose cover'}</button>
                  {draft.cover && <button type="button" className="button quiet" onClick={() => update('cover', null)}>Remove</button>}
                </div>
                <small>Square, portrait, and landscape images are supported.</small>
              </div>
              <div className="cover-placeholder">{draft.cover ? <img src={source(draft.cover)} alt="Collection cover preview" /> : 'No cover selected'}</div>
            </div>
            <div className="block wizard-inset">
              <label className="field"><span>Collection icon</span>
                <Dropdown options={marks} value={draft.mark} disabled={pending} onValueChange={mark => update('mark', mark)} />
              </label>
              <div className="actions">
                <span className="collection-badge">{renderMark(draft)}</span>
                <button type="button" className="button" disabled={pending} onClick={() => pick('icon', 'icon')}>Upload logo</button>
                {draft.icon && <button type="button" className="button quiet" onClick={() => update('icon', null)}>Remove logo</button>}
              </div>
            </div>
          </form>
        ) : (
          <section className="fields" aria-label="Publishing destinations">
            <h3 ref={stepHeading} tabIndex={-1}>Publishing destinations <small>Optional</small></h3>
            <div className="destination-options">
              {destinations.map(destination => <button type="button" className="button destination-option" key={destination.type} aria-pressed={presets.includes(destination.type)} onClick={() => toggle(setPresets, destination.type)}>{renderBadge(destination)}</button>)}
              {websites.map(site => <button type="button" className="button destination-option" key={site.id} aria-pressed={savedSites.includes(site.id)} onClick={() => toggle(setSavedSites, site.id)}>{renderBadge({ ...site, type: 'website' })}</button>)}
            </div>
            {customSites.length > 0 && <div className="block wizard-inset">{customSites.map(site => (
              <div className="row" key={site.url}><div>{renderBadge({ ...site, type: 'website' })}<small className="destination-detail">{site.url}</small></div><button type="button" className="button quiet" onClick={() => setCustomSites(previous => previous.filter(entry => entry !== site))}>Remove</button></div>
            ))}</div>}
            {websiteOpen ? (
              <form className="block" onSubmit={addWebsite}>
                <label className="field"><span>Website name</span><input required maxLength={100} value={websiteName} onChange={event => setWebsiteName(event.target.value)} /></label>
                <label className="field"><span>Website URL</span><input ref={websiteUrlInput} required type="url" maxLength={2048} placeholder="https://example.com" value={websiteUrl} onChange={event => { setWebsiteUrl(event.target.value); setWebsiteIcon(null); setIconStatus(''); }} /></label>
                <label className="field"><span>Description (optional)</span><textarea rows="2" maxLength={500} value={websiteDescription} onChange={event => setWebsiteDescription(event.target.value)} /></label>
                <div className="actions">
                  {renderBadge({ name: 'Website icon', type: 'website', icon: websiteIcon })}
                  <button type="button" className="button" disabled={pending} onClick={() => {
                    if (!websiteUrlInput.current.reportValidity()) return;
                    void withPicker(async () => {
                      const icon = await trackAsset(fetchIcon(websiteUrl));
                      setWebsiteIcon(icon?.id ?? null);
                      setIconStatus(icon ? 'Favicon selected.' : 'Favicon unavailable.');
                    });
                  }}>Fetch favicon</button>
                  <button type="button" className="button" disabled={pending} onClick={() => withPicker(async () => {
                    const icon = await trackAsset(pickAsset('icon'));
                    if (icon) { setWebsiteIcon(icon.id); setIconStatus('Uploaded icon selected.'); }
                  })}>Upload icon</button>
                  {websiteIcon && <button type="button" className="button quiet" disabled={pending} onClick={() => { setWebsiteIcon(null); setIconStatus('Globe icon selected.'); }}>Use globe</button>}
                </div>
                <p className="picker-status" role="status">{iconStatus}</p>
                <div className="actions"><button type="button" className="button quiet" disabled={pending} onClick={closeWebsite}>Cancel website</button><button type="submit" className="button" disabled={pending}>Add website</button></div>
              </form>
            ) : <div><button type="button" className="button quiet" onClick={() => setWebsiteOpen(true)}>Add custom website</button></div>}
          </section>
        )}
        <footer className="wizard-actions">
          <button type="button" className="button quiet" disabled={pending} onClick={close}>Cancel</button>
          {step === 2 && <button type="button" className="button quiet" disabled={pending} onClick={() => { setError(''); setStep(1); }}>Back</button>}
          {step === 1
            ? <button type="submit" form="collection-details-form" className="button primary" disabled={pending}>{collection ? 'Save changes' : 'Next: destinations'}</button>
            : <button type="button" className="button primary" disabled={pending || websiteOpen} onClick={submit}>Create collection</button>}
        </footer>
    </WorkspaceDialog>
  );
}
