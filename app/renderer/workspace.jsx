import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { CollectionWizard } from './collection-wizard.jsx';
import { CollectionSettings } from './collection-settings.jsx';
import { DestinationDialog } from './destination-dialog.jsx';
import { PlanDialog } from './plan-dialog.jsx';
import { PostEditor } from './post-editor.jsx';
import { WindowControls } from './window-title-bar.jsx';

const WorkspaceAction = createContext(null);
const paths = {
  calendar: 'M4 6h16v15H4z M8 3v6 M16 3v6 M4 11h16',
  right: 'm9 6 6 6-6 6',
  search: 'M15.5 15.5 20 20 M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0z',
  copy: 'M8 8h12v12H8z M4 16V4h12',
  moon: 'M20 15a9 9 0 0 1-11-11 9 9 0 1 0 11 11z',
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
};
const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });

function Icon({ path }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={path} /></svg>;
}

function Action({ name, value, className = 'button', children, ...props }) {
  const dispatch = useContext(WorkspaceAction);
  return <button type="button" className={className} onClick={() => dispatch(name, value)} {...props}>{children}</button>;
}

function Header({ screen, light, icons }) {
  const themeLabel = light ? 'Switch to dark mode' : 'Switch to light mode';
  return (
    <header className="studio-toolbar">
      <div className="toolbar-inner">
        <Action name="home" className="brand plain"><img src="../assets/logo.svg" alt="" />Poster Studio</Action>
        <nav className="studio-nav" aria-label="Poster Studio">
          <Action name="home" aria-current={screen !== 'calendar' ? 'page' : undefined}><Icon path={icons.folder} />Collections</Action>
          <Action name="calendar" aria-current={screen === 'calendar' ? 'page' : undefined}><Icon path={paths.calendar} />Calendar</Action>
        </nav>
        <div className="header-actions">
          <Action name="theme" className="chrome-button theme-button" aria-label={themeLabel} title={themeLabel}><Icon path={light ? paths.moon : paths.sun} /></Action>
          <WindowControls />
        </div>
      </div>
    </header>
  );
}

function CollectionIcon({ collection, icons, source }) {
  return collection.icon ? <img className="mini-logo" alt="" src={source(collection.icon)} /> : <Icon path={icons[collection.mark] ?? icons.folder} />;
}

function PlatformBadge({ destination, icons, solidIcons, source }) {
  const { type, name, icon } = destination;
  return (
    <span className="badge platform" data-platform={type}>
      <span className={solidIcons[type] && !icon ? 'platform-icon solid' : 'platform-icon'}>
        {icon ? <img src={source(icon)} alt="" /> : <Icon path={solidIcons[type] ?? icons[type] ?? icons.website} />}
      </span>
      {name}
    </span>
  );
}

function Empty({ title, children }) {
  return <div className="empty"><h3>{title}</h3>{children}</div>;
}

function PageHeading({ title, subtitle, children }) {
  return <header className="page-head"><div><h1>{title}</h1>{subtitle && <p className="subtle">{subtitle}</p>}</div>{children}</header>;
}

function PostDate({ post }) {
  return post.created && <time dateTime={post.created}>{dateFormat.format(new Date(post.created))}</time>;
}

function Artwork({ asset, source, fallback, post = false }) {
  return <span className={'cover' + (post ? ' post-cover' : '')}>{asset ? <img src={source(asset)} alt="" /> : fallback}</span>;
}

function Card({ name, value, label, title, metadata, platforms, icon, children, ...visuals }) {
  return (
    <Action name={name} value={value} className={'card' + (name === 'view-item' ? ' collection-post' : '')} aria-label={label}>
      {children}
      <span className="card-info">
        <span className="card-label">
          <span><strong className="card-name">{icon}{title}</strong><span className="count">{metadata}</span></span>
          <span className="open-icon"><Icon path={paths.right} /></span>
        </span>
        {platforms.length > 0 && <span className="platforms">
          {platforms.map(destination => <PlatformBadge key={destination.id} destination={destination} {...visuals} />)}
        </span>}
      </span>
    </Action>
  );
}

function Archived({ entries, name, restore }) {
  return entries.length > 0 && (
    <details className="collection-destinations archive-list">
      <summary>Archived {name} ({entries.length})</summary>
      {entries.map(entry => (
        <div className="row" key={entry.id}><span>{entry.name ?? entry.title}</span><Action name={restore} value={entry.id} className="button quiet">Restore</Action></div>
      ))}
    </details>
  );
}

function PostRow({ name, value, post, children, icons, source }) {
  return (
    <Action name={name} value={value} className="post-card">
      {post.artwork ? <img src={source(post.artwork)} alt="" /> : <span className="post-thumb-empty"><Icon path={icons.image} /></span>}
      <span><strong className="post-card-title">{post.title}</strong>{children}</span><Icon path={paths.right} />
    </Action>
  );
}

function RecentPosts({ collections, activeItems, ...visuals }) {
  const [sort, setSort] = useState('newest');
  const entries = collections.flatMap(collection => activeItems(collection).map(post => ({ collection, post })));
  const direction = sort === 'newest' ? -1 : 1;
  entries.sort((a, b) => direction * (a.post.created ?? '').localeCompare(b.post.created ?? ''));
  return (
    <section className="recent-posts" aria-labelledby="recent-posts-title">
      <div className="recent-posts-header">
        <h2 id="recent-posts-title">Recent posts</h2>
        <select className="post-sort" aria-label="Sort recent posts" value={sort} onChange={event => setSort(event.target.value)}>
          <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
        </select>
      </div>
      {entries.length ? <ul className="recent-list">
        {entries.map(({ collection, post }) => (
          <li key={post.id}>
            <PostRow name="recent-item" value={collection.id + ':' + post.id} post={post} {...visuals}>
              <span className="post-card-meta">{collection.name} · <PostDate post={post} /></span>
            </PostRow>
          </li>
        ))}
      </ul> : <Empty title="No posts yet" />}
    </section>
  );
}

function Collections({ collections, activeItems, countLabel, ...visuals }) {
  const [query, setQuery] = useState('');
  const active = collections.filter(collection => !collection.archived);
  const matches = active.filter(collection =>
    [collection.name, collection.description, ...collection.destinations.map(destination => destination.name)]
      .some(value => value?.toLowerCase().includes(query.trim().toLowerCase())));
  return (
    <>
      <PageHeading title="Collections">
        <Action name="create" className="button primary"><Icon path={visuals.icons.plus} />Create collection</Action>
      </PageHeading>
      <div className="collections-workspace">
        <section className="collection-library" aria-label="Collection library">
          <div className="library-tools">
            <p className="results-count" role="status">{countLabel(matches.length, 'collection')}</p>
            <label className="search"><Icon path={paths.search} /><input type="search" aria-label="Find collections" placeholder="Find collections…" value={query} onChange={event => setQuery(event.target.value)} /></label>
          </div>
          <div className="collections">
            {matches.map(collection => {
              const posts = activeItems(collection);
              const cover = collection.cover || posts.find(post => post.artwork)?.artwork;
              return (
                <Card key={collection.id} name="open-collection" value={collection.id} label={'Open ' + collection.name}
                  title={collection.name} metadata={countLabel(posts.length, 'post')}
                  platforms={collection.destinations.filter(destination => destination.enabled)}
                  icon={<span className="collection-badge"><CollectionIcon collection={collection} {...visuals} /></span>} {...visuals}>
                  <Artwork asset={cover} source={visuals.source} fallback={<CollectionIcon collection={collection} {...visuals} />} />
                </Card>
              );
            })}
            {!matches.length && <Empty title={active.length ? 'No collections match your search' : 'No collections yet'} />}
          </div>
        </section>
        <RecentPosts collections={active} activeItems={activeItems} {...visuals} />
      </div>
      <Archived entries={collections.filter(collection => collection.archived)} name="collections" restore="restore-collection" />
    </>
  );
}

function FilterControl({ label, choices, value, onChange }) {
  return (
    <label className="filter-control">{label}
      <select value={value} onChange={event => onChange(event.target.value)}>
        {choices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
  );
}

function Collection({ collection, selected, posts, filteredPosts, search, filter, sort, statusLabels, countLabel, updatePosts, choosePlatform, status, postNumber, ...visuals }) {
  const clearFilters = () => { updatePosts({ search: '', filter: 'all' }); choosePlatform(''); };
  return (
    <>
      <Action name="home" className="button quiet back"><Icon path={visuals.icons.back} />All collections</Action>
      <PageHeading title={<><span className="collection-badge"><CollectionIcon collection={collection} {...visuals} /></span>{collection.name}</>}>
        <div className="actions"><Action name="settings" className="button quiet wizard-secondary">Collection settings</Action>
          <Action name="new-item" className="button primary"><Icon path={visuals.icons.plus} />Add post</Action></div>
      </PageHeading>
      {collection.description && <p className="collection-description">{collection.description}</p>}
      {collection.destinations.length > 0 && (
        <details className="collection-destinations">
          <summary>Publishing destinations ({collection.destinations.length})</summary>
          {collection.destinations.map(destination => (
            <div className="row" key={destination.id}>
              <div><PlatformBadge destination={destination} {...visuals} />
                {destination.url && <small className="destination-detail">{destination.url}</small>}
                <small className="destination-detail">{destination.fields.filter(field => !field.archived).map(field => field.label).join(' · ') || 'No active fields'}</small>
              </div>
              {!destination.enabled && <small>Disabled</small>}
            </div>
          ))}
        </details>
      )}
      <div className="view-filters">
        <label className="filter-control">Find posts<input type="search" placeholder="Title, text, notes, or number" value={search} onChange={event => updatePosts({ search: event.target.value })} /></label>
        <FilterControl label="Platform" value={selected?.id ?? ''} onChange={choosePlatform} choices={[[ '', 'All posts' ], ...collection.destinations.filter(destination => destination.enabled).map(destination => [destination.id, destination.name])]} />
        <FilterControl label="Status" value={filter} onChange={filter => updatePosts({ filter })} choices={[[ 'all', 'Any status' ], ...Object.entries(statusLabels)]} />
        <FilterControl label="Sort" value={sort} onChange={sort => updatePosts({ sort })} choices={[[ 'newest', 'Newest first' ], [ 'oldest', 'Oldest first' ], [ 'title', 'Title A–Z' ], [ 'updated', 'Recently edited' ]]} />
      </div>
      <p className="results-count post-result-count" role="status">{countLabel(filteredPosts.length, 'post')}</p>
      {filteredPosts.length ? <div className="collection-posts">
        {filteredPosts.map(post => (
          <Card key={post.id} name="view-item" value={post.id} label={'Open ' + post.title} title={post.title}
            metadata={<>Post {postNumber(post)} · <PostDate post={post} /> · {statusLabels[status(post)]}</>}
            platforms={collection.destinations.filter(destination => post.records.some(record => record.selected && record.id === destination.id))} {...visuals}>
            <Artwork asset={post.artwork} source={visuals.source} post fallback={<Icon path={visuals.icons.image} />} />
          </Card>
        ))}
      </div> : <Empty title={posts.length ? 'No matching posts' : 'No posts yet'}>
        {posts.length ? <button type="button" className="button quiet" onClick={clearFilters}>Clear filters</button> : <Action name="new-item" className="button quiet">Add post</Action>}
      </Empty>}
      <Archived entries={collection.items.filter(post => post.archived)} name="posts" restore="restore-item" />
    </>
  );
}

function Copy({ value, label = 'Copy', accessibleLabel }) {
  const dispatch = useContext(WorkspaceAction);
  const [copied, setCopied] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    if (!await dispatch('copy', value)) return;
    clearTimeout(timer.current);
    setCopied(true);
    timer.current = setTimeout(() => setCopied(false), 1400);
  }
  return <button type="button" onClick={copy} className="button quiet copy-control" aria-label={accessibleLabel} data-copied={copied || undefined}>
    <Icon path={paths.copy} />{copied ? 'Copied' : label}
  </button>;
}

function PostField({ label, type, options, value, item, source }) {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return null;
  if (type === 'file' && value === 'shared' && !item.artwork) return null;
  let display = value;
  let image;
  if (type === 'checkbox') display = value ? 'Yes' : 'No';
  if (type === 'select') display = options.find(option => option.id === value)?.label ?? value;
  if (type === 'file') {
    display = value === 'shared' ? 'Shared artwork' : value.name;
    const asset = value === 'shared' ? item.artwork : value.id;
    if (asset && /\.(png|jpe?g|webp)$/i.test(asset)) image = source(asset);
  }
  const tags = Array.isArray(display) ? display : undefined;
  return (
    <div className="post-field">
      <dt>{label}<Copy value={tags ? tags.join(', ') : String(display)} label={tags ? 'Copy all' : type === 'file' ? 'Copy name' : 'Copy'} accessibleLabel={'Copy ' + label.toLowerCase()} /></dt>
      <dd>
        {tags ? <span className="copy-tags">{tags.map(tag => <Copy key={tag} value={tag} label={tag} accessibleLabel={'Copy tag ' + tag} />)}</span> : display}
        {image && <img className="field-image" src={image} alt={label} />}
      </dd>
    </div>
  );
}

function PublishAction({ collection, item, record }) {
  const published = record.status === 'published';
  return <Action name={published ? 'undo-published' : 'mark-published'} value={[collection.id, item.id, record.id].join(':')} className="button quiet">{published ? 'Undo published' : 'Mark published'}</Action>;
}

function PostDetail({ postView, itemStatus, postNumber, statusLabels, ...visuals }) {
  const { item, collection, destinationId, backLabel } = postView;
  const channels = item.records.filter(record => record.selected).flatMap(record => {
    const destination = collection.destinations.find(entry => entry.id === record.id);
    return destination ? [{ record, destination }] : [];
  });
  const channel = channels.find(({ record }) => record.id === destinationId) ?? channels[0];
  const hasNotes = item.master || item.notes;
  return (
    <div className="post-screen">
      <Action name="back-to-posts" className="button quiet back"><Icon path={visuals.icons.back} />{backLabel}</Action>
      <PageHeading title={item.title} subtitle={['Post ' + postNumber(item), collection.name, statusLabels[itemStatus(item)]].join(' · ')}>
        <div className="actions">
          <Action name="edit-item" value={item.id} className="button primary">Edit post</Action>
          <Action name="export-item" value={item.id} className="button quiet">Export post</Action>
          <Action name="archive-item" value={item.id} className="button quiet danger">Archive</Action>
        </div>
      </PageHeading>
      <div className={'post-detail' + (channel ? '' : ' post-without-platforms')}>
        <section className="post-artwork-pane" aria-labelledby="post-artwork-title">
          <h2 id="post-artwork-title">Artwork</h2>
          <figure className="detail-cover">
            <Artwork asset={item.artwork} source={visuals.source} post fallback={<Icon path={visuals.icons.image} />} />
            {item.created && <figcaption>Added <PostDate post={item} /></figcaption>}
          </figure>
          {hasNotes && <dl className="post-fields">
            <PostField label="Master text" value={item.master} />
            <PostField label="Internal notes" value={item.notes} />
          </dl>}
        </section>
        {channel && <section className="post-settings" aria-labelledby="post-platforms">
          <h2 id="post-platforms">Platforms</h2>
          <ToggleGroup.Root className="platform-options" type="single" aria-labelledby="post-platforms" value={channel.record.id}
            onValueChange={value => value && visuals.dispatchAction('preview-destination', value)}>
            {channels.map(({ destination }) => (
              <ToggleGroup.Item className="button quiet" key={destination.id} value={destination.id} aria-controls="post-fields">
                <PlatformBadge destination={destination} {...visuals} />
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
          <div className="post-publication">
            <p className="publish-meta">{[statusLabels[channel.record.status],
              channel.record.planned && 'Planned ' + channel.record.planned.replace('T', ' '),
              channel.record.published && 'Published ' + channel.record.published.replace('T', ' ')].filter(Boolean).join(' · ')}</p>
            <PublishAction collection={collection} item={item} record={channel.record} />
          </div>
          <dl className="post-fields" id="post-fields">
            {channel.destination.fields.filter(field => !field.archived).map(field =>
              <PostField key={field.id} {...field} value={channel.record.values[field.id]} item={item} source={visuals.source} />)}
            <PostField label="Published URL" value={channel.record.url} />
          </dl>
        </section>}
      </div>
    </div>
  );
}

function Calendar({ monthTitle, destinationChoices, collections, calendarCollection, calendarDestination, updateCalendar, days, heading, rows, statusLabels, countLabel, ...visuals }) {
  return (
    <>
      <PageHeading title="Calendar" subtitle={monthTitle}>
        <div className="cal-nav">
          <Action name="today" className="button quiet calendar-today">Today</Action>
          <Action name="prev-month" className="button quiet" aria-label="Previous month"><Icon path={visuals.icons.back} /></Action>
          <Action name="next-month" className="button quiet" aria-label="Next month"><Icon path={paths.right} /></Action>
        </div>
      </PageHeading>
      <div className="view-filters">
        <FilterControl label="Collection" value={calendarCollection} onChange={collection => updateCalendar({ collection })} choices={[[ '', 'All collections' ], ...collections.map(collection => [collection.id, collection.name])]} />
        <FilterControl label="Platform" value={calendarDestination} onChange={destination => updateCalendar({ destination })} choices={[[ '', 'All platforms' ], ...destinationChoices]} />
        <Action name="plan" className="button primary">Plan a post</Action>
      </div>
      <div className="studio-calendar">
        <div className="cal-head">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(label => <span key={label}>{label}</span>)}</div>
        <div className="cal-grid">
          {days.map(({ date, key, count, today, outside, selected }) => (
            <Action key={key} name="day" value={key} className={'calendar-day' + (outside ? ' day-outside' : '')}
              aria-current={today ? 'date' : undefined} aria-label={key + ', ' + countLabel(count, 'post')} aria-pressed={selected} aria-controls="calendar-agenda">
              <time dateTime={key}>{date}</time>
              {count > 0 && <span className="day-count" aria-hidden="true">{count}<span className="day-count-word">{count === 1 ? 'post' : 'posts'}</span></span>}
            </Action>
          ))}
        </div>
      </div>
      <section className="calendar-agenda" id="calendar-agenda" aria-labelledby="agenda-title">
        <div className="agenda-heading"><h2 id="agenda-title">{heading}</h2><p role="status">{countLabel(rows.length, 'post')}</p></div>
        {rows.length ? <ul className="agenda-list">
          {rows.map(({ collection, item, record, destination, time }) => {
            const key = [collection.id, item.id, destination.id].join(':');
            return <li className="agenda-item" key={key}>
              <PostRow name="calendar-item" value={key} post={item} {...visuals}>
                <span className="post-card-meta">{collection.name} · {destination.name}</span>
                <span className="post-card-meta">{[time, statusLabels[record.status]].filter(Boolean).join(' · ')}</span>
              </PostRow>
              <PublishAction collection={collection} item={item} record={record} />
            </li>;
          })}
        </ul> : <p className="empty">No posts for this date.</p>}
      </section>
    </>
  );
}

export function Workspace({ screen, light, collection, calendar, postView, ready, error, dispatchAction, collectionEditor, settings, destinationTool, postEditor, plan, pickAsset, fetchIcon, destinationPresets, savedWebsites, settingsNotice, ...props }) {
  return (
    <WorkspaceAction.Provider value={dispatchAction}>
      <div className="studio-app">
        <Header screen={screen} light={light} icons={props.icons} />
        <main id="page" className="studio-main min-w-0">
          {error ? <Empty title="Could not open your workspace"><p>{error}</p></Empty> :
            !ready ? <p className="empty" role="status">Opening your workspace.</p> :
            <div hidden={Boolean(postView)}>
              {screen === 'calendar' ? <Calendar {...props} {...calendar} /> :
                collection ? <Collection key={collection.id} collection={collection} {...props} /> : <Collections {...props} />}
            </div>}
          {postView && <PostDetail key={postView.item.id} postView={postView} dispatchAction={dispatchAction} {...props} />}
          {collectionEditor && <CollectionWizard {...collectionEditor}
            pickAsset={pickAsset} fetchIcon={fetchIcon} destinations={destinationPresets} websites={savedWebsites} source={props.source}
            renderBadge={destination => <PlatformBadge destination={destination} {...props} />}
            renderMark={collection => <CollectionIcon collection={collection} {...props} />} />}
          {settings && collection && <CollectionSettings collection={collection} presets={destinationPresets}
            notice={settingsNotice}
            close={() => dispatchAction('close-settings')} dispatch={dispatchAction}
            renderBadge={destination => <PlatformBadge destination={destination} {...props} />} />}
          {destinationTool && <DestinationDialog {...destinationTool} pickAsset={pickAsset} fetchIcon={fetchIcon}
            renderBadge={destination => <PlatformBadge destination={destination} {...props} />} />}
          {postEditor && <PostEditor {...postEditor} pickAsset={pickAsset} source={props.source} statusLabels={props.statusLabels}
            renderBadge={destination => <PlatformBadge destination={destination} {...props} />} />}
          {plan && <PlanDialog {...plan} />}
        </main>
      </div>
    </WorkspaceAction.Provider>
  );
}
