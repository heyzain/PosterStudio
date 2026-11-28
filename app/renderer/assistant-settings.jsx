import { useEffect, useState } from 'react';
import { WorkspaceDialog } from './workspace-dialog.jsx';
import { assistantError } from './assistant-text.js';

export function AssistantSettings({ assistant, close }) {
  const [settings, setSettings] = useState(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    assistant.settings().then(result => { if (active) setSettings(result); },
      failure => { if (active) setError(assistantError(failure)); });
    return () => { active = false; };
  }, []);

  async function save(remove = false) {
    const key = value.trim();
    if (pending || (!remove && !key)) return;
    setPending(true);
    setError('');
    setNotice('');
    try {
      await assistant.saveKey(remove ? '' : key);
      setSettings(previous => ({ ...previous, configured:!remove }));
      setValue('');
      setNotice(remove ? 'OpenRouter key removed.' : 'OpenRouter key saved.');
    } catch (failure) { setError(assistantError(failure)); }
    finally { setPending(false); }
  }

  return <WorkspaceDialog title="Settings" className="assistant-settings" close={close} pending={pending}>
    <form className="assistant-settings-form" onSubmit={event => { event.preventDefault(); void save(); }}>
      <section className="assistant-settings-card" aria-labelledby="openrouter-heading">
        <div className="assistant-settings-heading">
          <h3 id="openrouter-heading">OpenRouter</h3>
          {settings && <span className="assistant-key-status">{settings.configured ? 'Key saved' : 'No key saved'}</span>}
        </div>
        <p className="subtle">Ask Poster Studio uses OpenRouter’s free model router. Messages you send go to OpenRouter. Post data stays on this device.</p>
        <label className="field">
          <span>API key</span>
          <input type="password" autoComplete="off" spellCheck={false} maxLength={250}
            placeholder={settings?.configured ? 'Enter a replacement key' : 'Paste your OpenRouter API key'}
            value={value} onChange={event => setValue(event.target.value)} disabled={!settings?.secureStorage || pending} />
        </label>
        {settings && !settings.secureStorage && <p className="subtle">Secure key storage is unavailable on this device.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="subtle" role="status">{notice}</p>}
      </section>
      <div className="actions assistant-settings-actions">
        {settings?.configured && <button type="button" className="button quiet" disabled={pending} onClick={() => save(true)}>Remove key</button>}
        <button type="button" className="button" disabled={pending} onClick={close}>Done</button>
        <button className="button primary" disabled={pending || !settings?.secureStorage || !value.trim()}>{pending ? 'Saving…' : 'Save key'}</button>
      </div>
    </form>
  </WorkspaceDialog>;
}
