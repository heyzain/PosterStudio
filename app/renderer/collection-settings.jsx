import { WorkspaceDialog } from './workspace-dialog.jsx';

export function CollectionSettings({ collection, presets, notice, close, dispatch, renderBadge }) {
  const action = (label, name, value, variant = '') => (
    <button type="button" className={`button ${variant}`} onClick={() => dispatch(name, value)}>{label}</button>
  );
  const available = presets.filter(preset => !collection.destinations.some(destination => destination.type === preset.type));
  const archived = collection.items.filter(item => item.archived);
  return (
    <WorkspaceDialog className="collection-wizard" title="Collection settings" close={close}>
      {notice && <p className="subtle" role="status">{notice}</p>}
      <div className="fields">
        <section className="block wizard-inset">
          <div className="collection-settings-row row">
            <div><h3>{collection.name}</h3>{collection.description && <p className="subtle">{collection.description}</p>}</div>
            {action('Edit details', 'edit-collection')}
          </div>
        </section>
        <section className="fields" aria-label="Publishing destinations">
          <h3>Publishing destinations</h3>
          {available.length > 0 && <div className="destination-options">
            {available.map(preset => <button type="button" className="button destination-option" key={preset.type}
              onClick={() => dispatch('add-preset', preset.type)} aria-label={'Add ' + preset.name}>{renderBadge(preset)}<span aria-hidden="true">+</span></button>)}
          </div>}
          <div>{action('+ Add custom website', 'add-website')}</div>
          {collection.destinations.length > 0 && <div className="block wizard-inset collection-settings-list">
            {collection.destinations.map(destination => <div className="collection-settings-row row" key={destination.id}>
              <div className="collection-settings-destination">
                {renderBadge(destination)}{!destination.enabled && <small>Disabled</small>}
                {destination.url && <small className="destination-detail">{destination.url}</small>}
              </div>
              <div className="actions" role="group" aria-label={destination.url || destination.name}>
                {action('Manage fields', 'manage-fields', destination.id)}
                {action('Change icon', 'destination-icon', destination.id, 'quiet')}
                {action(destination.enabled ? 'Disable' : 'Enable', 'toggle-destination', destination.id, 'quiet')}
              </div>
            </div>)}
          </div>}
        </section>
        <section className="block wizard-inset">
          <h3>Local storage</h3>
          <div className="actions">{action('Open storage folder', 'open-storage')}{action('Export collection backup', 'export-collection')}</div>
        </section>
        {archived.length > 0 && <section className="block wizard-inset">
          <h3>Archived posts</h3>
          {archived.map(item => <div className="row" key={item.id}><span>{item.title}</span>{action('Restore', 'restore-item', item.id)}</div>)}
        </section>}
      </div>
      <footer className="wizard-actions">
        {action('Archive collection', 'archive-collection', undefined, 'quiet danger')}
        <button type="button" className="button" onClick={close}>Close</button>
      </footer>
    </WorkspaceDialog>
  );
}
