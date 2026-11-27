import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { attachmentArtwork, destinationArtwork } from './artwork-preview.js';
import { CollectionWizard } from './collection-wizard.jsx';
import { BulkImportDialog } from './bulk-import-dialog.jsx';
import { CollectionSettings } from './collection-settings.jsx';
import { DestinationDialog } from './destination-dialog.jsx';
import { destinationLabels } from './destination-labels.js';
import { Dropdown } from './dropdown.jsx';
import { plannedDateLabel, plannedTimeLabel } from './local-dates.js';
import { PlanDialog } from './plan-dialog.jsx';
import { PostEditor } from './post-editor.jsx';
import { WindowControls } from './window-title-bar.jsx';
import { WorkspaceDialog } from './workspace-dialog.jsx';

const WorkspaceAction = createContext(null);
const paths = {
  calendar: 'M4 6h16v15H4z M8 3v6 M16 3v6 M4 11h16',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M12 7v5l3 2',
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

function Action({ name, value, className = 'button', children, disabled, ...props }) {
  const { dispatch, actionProgress } = useContext(WorkspaceAction);
  const progress = actionProgress(name, value);
  return <button type="button" className={className} onClick={() => dispatch(name, value)} {...props}
    disabled={disabled || Boolean(progress)} aria-busy={Boolean(progress) || undefined}>{progress ?? children}</button>;
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

function PlatformBadge({ destination, label = destination.name, icons, solidIcons, source }) {
  const { type, icon } = destination;
  return (
    <span className="badge platform" data-platform={type}>
      <span className={solidIcons[type] && !icon ? 'platform-icon solid' : 'platform-icon'}>
        {icon ? <img src={source(icon)} alt="" /> : <Icon path={solidIcons[type] ?? icons[type] ?? icons.website} />}
      </span>
      <span className="destination-label">{label}</span>
    </span>
  );
}

function Empty({ title, children, className = '' }) {
  return <div className={`empty ${className}`}><h3>{title}</h3>{children}</div>;
}

function PageHeading({ title, subtitle, children }) {
  return <header className="page-head"><div><h1>{title}</h1>{subtitle && <p className="subtle">{subtitle}</p>}</div>{children}</header>;
}

function PostDate({ post }) {
  return post.created && <time dateTime={post.created}>{dateFormat.format(new Date(post.created))}</time>;
}

function Artwork({ asset, source, fallback, alt = '', post = false, thumbnail = false }) {
  return <span className={'cover' + (post ? ' post-cover' : '')}>{asset
    ? <img src={source(asset, thumbnail ? 'cover' : undefined)} alt={alt} loading={thumbnail ? 'lazy' : undefined} decoding={thumbnail ? 'async' : undefined} />
    : fallback}</span>;
}

function Card({ name, value, label, title, metadata, platforms, platformLabels, icon, children, ...visuals }) {
  return (
    <Action name={name} value={value} className={'card' + (name === 'view-item' ? ' collection-post' : '')} aria-label={label}>
      {children}
      <span className="card-info">
        <span className="card-label">
          <span><strong className="card-name">{icon}{title}</strong><span className="count">{metadata}</span></span>
          <span className="open-icon"><Icon path={paths.right} /></span>
        </span>
        {platforms.length > 0 && <span className="platforms">
          {platforms.map(destination => <PlatformBadge key={destination.id} destination={destination} label={platformLabels.get(destination.id)} {...visuals} />)}
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

function PostRow({ name, value, post, children, trailing, icons, source }) {
  return (
    <Action name={name} value={value} className="post-card">
      {post.artwork ? <img src={source(post.artwork, 'small')} alt="" loading="lazy" decoding="async" /> : <span className="post-thumb-empty"><Icon path={icons.image} /></span>}
      <span><strong className="post-card-title">{post.title}</strong>{children}</span>
      {trailing}
      <Icon path={paths.right} />
    </Action>
  );
}

function RecentPosts({ collections, activeItems, ...visuals }) {
  const [sort, setSort] = useState('newest');
  const entries = useMemo(() => {
    const posts = collections.flatMap(collection => activeItems(collection).map(post => ({ collection, post })));
    const direction = sort === 'newest' ? -1 : 1;
    return posts.sort((a, b) => direction * (a.post.created ?? '').localeCompare(b.post.created ?? '')).slice(0, 6);
  }, [collections, activeItems, sort]);
  return (
    <section className="recent-posts" aria-labelledby="recent-posts-title">
      <div className="recent-posts-header">
        <h2 id="recent-posts-title">Recent posts</h2>
        <Dropdown className="post-sort" label="Sort recent posts" value={sort} onValueChange={setSort}
          options={[[ 'newest', 'Newest first' ], [ 'oldest', 'Oldest first' ]]} />
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
  const active = useMemo(() => collections.filter(collection => !collection.archived), [collections]);
  const matches = active.filter(collection =>
    [collection.name, collection.description, ...collection.destinations.map(destination => destination.name)]
      .some(value => value?.toLowerCase().includes(query.trim().toLowerCase())));
  return (
    <>
      <PageHeading title="Collections">
        <div className="actions">
          <Action name="choose-backup" className="button secondary">Restore backup</Action>
          <Action name="create" className="button primary"><Icon path={visuals.icons.plus} />Create collection</Action>
        </div>
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
                  platforms={collection.destinations.filter(destination => destination.enabled)} platformLabels={destinationLabels(collection.destinations)}
                  icon={<span className="collection-badge"><CollectionIcon collection={collection} {...visuals} /></span>} {...visuals}>
                  <Artwork asset={cover} source={visuals.source} thumbnail fallback={<CollectionIcon collection={collection} {...visuals} />} />
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
  const noFilter = 'no-filter';
  return (
    <label className="filter-control">{label}
      <Dropdown className="filter-dropdown" value={value || noFilter} onValueChange={choice => onChange(choice === noFilter ? '' : choice)}
        options={choices.map(([choice, text]) => [choice || noFilter, text])} />
    </label>
  );
}

function CollectionDestinations({ destinations, ...visuals }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <button type="button" className="button secondary" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Destinations <span className="destination-count">{destinations.length}</span>
      </button>
      {open && <WorkspaceDialog className="destinations-dialog" title="Publishing destinations" close={close}>
        <ul className="destination-summary">
          {destinations.map(destination => (
            <li className="row" key={destination.id}>
              <div>
                <PlatformBadge destination={destination} {...visuals} />
                {destination.url && <small className="destination-detail">{destination.url}</small>}
                <small className="destination-detail">{destination.fields.filter(field => !field.archived).map(field => field.label).join(' · ') || 'No active fields'}</small>
              </div>
              {!destination.enabled && <small>Disabled</small>}
            </li>
          ))}
        </ul>
        <footer className="wizard-actions">
          <button type="button" className="button" onClick={close}>Close</button>
        </footer>
      </WorkspaceDialog>}
    </>
  );
}

function Collection({ collection, selected, posts, filteredPosts, search, filter, sort, statusLabels, countLabel, updatePosts, choosePlatform, status, postNumber, publicationProgress, ...visuals }) {
  const clearFilters = () => { updatePosts({ search: '', filter: 'all' }); choosePlatform(''); };
  const labels = destinationLabels(collection.destinations);
  return (
    <>
      <Action name="home" className="button secondary back"><Icon path={visuals.icons.back} />All collections</Action>
      <PageHeading title={<><span className="collection-badge"><CollectionIcon collection={collection} {...visuals} /></span>{collection.name}</>}>
        <div className="actions">
          {collection.destinations.length > 0 && <CollectionDestinations destinations={collection.destinations} {...visuals} />}
          <Action name="settings" className="button secondary">Collection settings</Action>
          <Action name="bulk-import" className="button secondary">Bulk add</Action>
          <Action name="new-item" className="button primary"><Icon path={visuals.icons.plus} />Add post</Action>
        </div>
      </PageHeading>
      {collection.description && <p className="collection-description">{collection.description}</p>}
      <div className="view-filters">
        <label className="filter-control">Find posts<input type="search" placeholder="Title, copy, tags, notes, or number" value={search} onChange={event => updatePosts({ search: event.target.value })} /></label>
        <FilterControl label="Platform" value={selected?.id ?? ''} onChange={choosePlatform} choices={[[ '', 'All posts' ], ...collection.destinations.filter(destination => destination.enabled).map(destination => [destination.id, labels.get(destination.id)])]} />
        <FilterControl label="Status" value={filter} onChange={filter => updatePosts({ filter })} choices={[[ 'all', 'Any status' ], ...Object.entries(statusLabels), ...(!selected ? [['partial', 'Partially published']] : [])]} />
        <FilterControl label="Sort" value={sort} onChange={sort => updatePosts({ sort })} choices={[[ 'newest', 'Newest first' ], [ 'oldest', 'Oldest first' ], [ 'title', 'Title A–Z' ], [ 'updated', 'Recently edited' ]]} />
      </div>
      <p className="results-count post-result-count" role="status">{countLabel(filteredPosts.length, 'post')}</p>
      {filteredPosts.length ? <div className="collection-posts">
        {filteredPosts.map(post => (
          <Card key={post.id} name="view-item" value={post.id} label={'Open ' + post.title} title={post.title}
            metadata={<>Post {postNumber(post)} · <PostDate post={post} /> · {status(post) === 'partial' ? publicationProgress(post) : statusLabels[status(post)]}</>}
            platforms={collection.destinations.filter(destination => post.records.some(record => record.selected && record.id === destination.id))} platformLabels={labels} {...visuals}>
            <Artwork asset={post.artwork} source={visuals.source} post thumbnail fallback={<Icon path={visuals.icons.image} />} />
          </Card>
        ))}
      </div> : <Empty className="collection-empty" title={posts.length ? 'No matching posts' : 'No posts yet'}>
        {posts.length ? <button type="button" className="button secondary" onClick={clearFilters}>Clear filters</button> : <Action name="new-item" className="button secondary">Add post</Action>}
      </Empty>}
      <Archived entries={collection.items.filter(post => post.archived)} name="posts" restore="restore-item" />
    </>
  );
}

function Copy({ value, label = 'Copy', accessibleLabel }) {
  const { dispatch } = useContext(WorkspaceAction);
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

function PostText({ value, label }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const textRef = useRef(null);
  const id = useId();
  useEffect(() => {
    if (expanded) return;
    const text = textRef.current;
    const measure = () => setOverflows(text.scrollHeight > text.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(text);
    return () => observer.disconnect();
  }, [expanded, value]);

  return <>
    <div ref={textRef} id={id} className={expanded ? undefined : 'post-text-preview'}>{value}</div>
    {(overflows || expanded) && <button type="button" className="button quiet post-text-toggle" aria-expanded={expanded}
      aria-controls={id} aria-label={`${expanded ? 'Show less of' : 'Show more of'} ${label}`} onClick={() => setExpanded(!expanded)}>
      {expanded ? 'Show less' : 'Show more'}
    </button>}
  </>;
}

function PostField({ label, type, options, value, item, collectionId, source, previewAsset }) {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return null;
  if (type === 'file' && value === 'shared' && !item.artwork) return null;
  let display = value;
  let imageAsset;
  if (type === 'checkbox') display = value ? 'Yes' : 'No';
  if (type === 'select') display = options.find(option => option.id === value)?.label ?? value;
  if (type === 'file') {
    display = value === 'shared' ? 'Shared artwork' : value.name;
    imageAsset = value === 'shared' ? item.artwork : attachmentArtwork(value);
  }
  const tags = Array.isArray(display) ? display : undefined;
  return (
    <div className="post-field">
      <dt>{label}{imageAsset
        ? <Action name="show-artwork" value={{ collectionId, itemId: item.id, assetId: imageAsset }}
            className="button quiet copy-control" aria-label={`Show ${label} in folder`}>Show in folder</Action>
        : <Copy value={tags ? tags.join(', ') : String(display)} label={tags ? 'Copy all' : type === 'file' ? 'Copy name' : 'Copy'} accessibleLabel={'Copy ' + label.toLowerCase()} />}</dt>
      <dd>
        {tags ? <span className="copy-tags">{tags.map(tag => <Copy key={tag} value={tag} label={tag} accessibleLabel={'Copy tag ' + tag} />)}</span>
          : type === 'long' || type === 'text' ? <PostText value={display} label={label} /> : display}
        {imageAsset && imageAsset !== previewAsset && <img className="field-image" src={source(imageAsset)} alt={label} />}
      </dd>
    </div>
  );
}

function PublishAction({ collection, item, record }) {
  const published = record.status === 'published';
  return <Action name={published ? 'undo-published' : 'mark-published'} value={[collection.id, item.id, record.id].join(':')}
    className={published ? 'button quiet' : 'button'}>{published ? 'Undo published' : 'Mark published'}</Action>;
}

function PostDetail({ postView, itemStatus, postNumber, statusLabels, publicationProgress, ...visuals }) {
  const { item, collection, destinationId, backLabel } = postView;
  const labels = destinationLabels(collection.destinations);
  const channels = item.records.filter(record => record.selected).flatMap(record => {
    const destination = collection.destinations.find(entry => entry.id === record.id);
    return destination ? [{ record, destination }] : [];
  });
  const channel = channels.find(({ record }) => record.id === destinationId) ?? channels[0];
  const platformArtwork = destinationArtwork(channel?.destination, channel?.record);
  const previewAsset = platformArtwork ?? item.artwork;
  const destinationLabel = labels.get(channel?.destination.id);
  const artworkAlt = platformArtwork ? `${item.title} artwork for ${destinationLabel}` : `Shared artwork for ${item.title}`;
  const hasNotes = item.master || item.notes;
  const status = itemStatus(item);
  return (
    <div className="post-screen">
      <Action name="back-to-posts" className="button secondary back"><Icon path={visuals.icons.back} />{backLabel}</Action>
      <PageHeading title={item.title} subtitle={['Post ' + postNumber(item), collection.name, status === 'partial' ? publicationProgress(item) : statusLabels[status]].join(' · ')}>
        <div className="actions">
          <Action name="archive-item" value={item.id} className="button quiet danger">Archive</Action>
          <Action name="export-item" value={item.id} className="button secondary">Export post</Action>
          <Action name="edit-item" value={item.id} className="button primary">Edit post</Action>
        </div>
      </PageHeading>
      <div className={'post-detail' + (channel ? '' : ' post-without-platforms')}>
        <section className="post-artwork-pane" aria-labelledby="post-artwork-title">
          <h2 id="post-artwork-title" className="destination-label">{platformArtwork ? destinationLabel + ' artwork' : 'Artwork'}</h2>
          <figure className="detail-cover">
            <Artwork asset={previewAsset} source={visuals.source} alt={artworkAlt} post fallback={<Icon path={visuals.icons.image} />} />
            {item.created && <figcaption>Added <PostDate post={item} /></figcaption>}
          </figure>
          {previewAsset && <div className="actions post-art-actions">
            <Action name="show-artwork" value={{ collectionId: collection.id, itemId: item.id, assetId: previewAsset }}>Show in folder</Action>
          </div>}
          {hasNotes && <dl className="post-fields">
            <PostField label="Master text" type="long" value={item.master} />
            <PostField label="Internal notes" type="long" value={item.notes} />
          </dl>}
        </section>
        {channel && <section className="post-settings" aria-labelledby="post-platforms">
          <h2 id="post-platforms">Platforms</h2>
          <ToggleGroup.Root className="platform-options" type="single" aria-labelledby="post-platforms" value={channel.record.id}
            onValueChange={value => value && visuals.dispatchAction('preview-destination', value)}>
            {channels.map(({ destination }) => (
              <ToggleGroup.Item className="button" key={destination.id} value={destination.id} aria-controls="post-fields">
                <PlatformBadge destination={destination} label={labels.get(destination.id)} {...visuals} />
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
          <div className="post-publication">
            <p className="publish-meta">
              {statusLabels[channel.record.status]}
              {channel.record.planned && <> · <strong className="post-planned-date">
                Planned <time dateTime={channel.record.planned}>{plannedDateLabel(channel.record.planned)}</time>
              </strong></>}
              {channel.record.published && <> · Published <time dateTime={channel.record.published}>{channel.record.published.replace('T', ' ')}</time></>}
            </p>
            <PublishAction collection={collection} item={item} record={channel.record} />
          </div>
          <dl className="post-fields" id="post-fields">
            {channel.destination.fields.filter(field => !field.archived).map(field =>
              <PostField key={`${channel.record.id}:${field.id}`} {...field} value={channel.record.values[field.id]}
                item={item} collectionId={collection.id} source={visuals.source} previewAsset={previewAsset} />)}
            <PostField label="Published URL" value={channel.record.url} />
          </dl>
        </section>}
      </div>
    </div>
  );
}

function Calendar({ monthTitle, destinationChoices, labels, collections, calendarCollection, calendarDestination, updateCalendar, days, heading, rows, statusLabels, countLabel, ...visuals }) {
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
              aria-current={today ? 'date' : undefined} aria-label={key + ', ' + countLabel(count, 'publication')} aria-pressed={selected} aria-controls="calendar-agenda">
              <time dateTime={key}>{date}</time>
              {count > 0 && <span className="day-count" aria-hidden="true">{count}<span className="day-count-word">{count === 1 ? 'publication' : 'publications'}</span></span>}
            </Action>
          ))}
        </div>
      </div>
      <section className="calendar-agenda" id="calendar-agenda" aria-labelledby="agenda-title">
        <div className="agenda-heading"><h2 id="agenda-title">{heading}</h2><p role="status">{countLabel(rows.length, 'publication')}</p></div>
        {rows.length ? <ul className="agenda-list">
          {rows.map(({ collection, item, record, destination, date, time }) => {
            const key = [collection.id, item.id, destination.id].join(':');
            const published = record.status === 'published';
            return <li className="agenda-item" key={key}>
              <PostRow name="calendar-item" value={key} post={item}
                trailing={<PlatformBadge destination={destination} label={labels.get(destination.id)} {...visuals} />} {...visuals}>
                <span className="post-card-meta">{collection.name}</span>
                <span className="post-card-meta agenda-publication">
                  {time && (!published || record.published) &&
                    <time className={published ? undefined : 'agenda-deadline'} dateTime={date + 'T' + time}>
                      {!published && <Icon path={paths.clock} />}{time}
                    </time>}
                  {!time && !published && <span>{plannedTimeLabel}</span>}
                  <span className="agenda-status" data-status={record.status}>{statusLabels[record.status]}</span>
                  {published && record.planned && record.planned !== record.published &&
                    <span>Planned <time dateTime={record.planned}>{plannedDateLabel(record.planned)}</time></span>}
                </span>
              </PostRow>
              <PublishAction collection={collection} item={item} record={record} />
            </li>;
          })}
        </ul> : <p className="empty">No publications for this date.</p>}
      </section>
    </>
  );
}

function BackupPreview({ name, description, posts, archivedPosts, destinations, files, close, restore, countLabel }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  async function confirmRestore() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError('');
    try { await restore(); }
    catch (failure) { setError(failure.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')); }
    finally { inFlight.current = false; setPending(false); }
  }

  return (
    <WorkspaceDialog className="plan-dialog" title="Restore collection backup" close={close} pending={pending}>
      <div className="block wizard-inset fields destination-label">
        <h3>{name}</h3>
        {description && <p className="subtle">{description}</p>}
        <p>{[countLabel(posts, 'post'), archivedPosts ? `${archivedPosts} archived` : '', countLabel(files, 'file')].filter(Boolean).join(' · ')}</p>
        <p className="subtle">{destinations.length ? destinations.join(', ') : 'No publishing destinations'}</p>
      </div>
      <p className="subtle">This restores the backup as a separate collection.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <footer className="wizard-actions">
        <button type="button" className="button quiet" disabled={pending} onClick={close}>Cancel</button>
        <button type="button" className="button primary" disabled={pending} aria-busy={pending || undefined} onClick={confirmRestore}>{pending ? 'Restoring…' : 'Restore as new collection'}</button>
      </footer>
    </WorkspaceDialog>
  );
}

export function Workspace({ screen, light, collection, calendar, postView, ready, error, dispatchAction, actionProgress, collectionEditor, settings, destinationTool, postEditor, plan, backupPreview, bulkImport, pickAsset, fetchIcon, discardDraftAssets, destinationPresets, savedWebsites, settingsNotice, ...props }) {
  return (
    <WorkspaceAction.Provider value={{ dispatch:dispatchAction, actionProgress }}>
      <div className="studio-app">
        <div className="studio-toolbar-dock">
          <Header screen={screen} light={light} icons={props.icons} />
        </div>
        <main id="page" className="studio-main min-w-0">
          {error ? <Empty title="Could not open your workspace"><p>{error}</p></Empty> :
            !ready ? <p className="empty" role="status">Opening your workspace.</p> :
            <div hidden={Boolean(postView)}>
              {screen === 'calendar' ? <Calendar {...props} {...calendar} /> :
                collection ? <Collection key={collection.id} collection={collection} {...props} /> : <Collections {...props} />}
            </div>}
          {postView && <PostDetail key={postView.item.id} postView={postView} dispatchAction={dispatchAction} {...props} />}
          {collectionEditor && <CollectionWizard {...collectionEditor}
            pickAsset={pickAsset} fetchIcon={fetchIcon} discardDraftAssets={discardDraftAssets} destinations={destinationPresets} websites={savedWebsites} source={props.source}
            renderBadge={destination => <PlatformBadge destination={destination} {...props} />}
            renderMark={collection => <CollectionIcon collection={collection} {...props} />} />}
          {settings && collection && <CollectionSettings collection={collection} presets={destinationPresets}
            notice={settingsNotice}
            close={() => dispatchAction('close-settings')} dispatch={dispatchAction} actionProgress={actionProgress}
            renderBadge={destination => <PlatformBadge destination={destination} {...props} />} />}
          {destinationTool && <DestinationDialog {...destinationTool} pickAsset={pickAsset} fetchIcon={fetchIcon} discardDraftAssets={discardDraftAssets}
            renderBadge={destination => <PlatformBadge destination={destination} {...props} />} />}
          {postEditor && <PostEditor {...postEditor} pickAsset={pickAsset} discardDraftAssets={discardDraftAssets} source={props.source} statusLabels={props.statusLabels}
            showArtwork={(asset, onError) => dispatchAction('show-artwork', asset, onError)} artworkProgress={asset => actionProgress('show-artwork', asset)}
            renderBadge={(destination, label) => <PlatformBadge destination={destination} label={label} {...props} />} />}
          {plan && <PlanDialog {...plan} postNumber={props.postNumber} />}
          {backupPreview && <BackupPreview {...backupPreview} countLabel={props.countLabel} />}
          {bulkImport && <BulkImportDialog {...bulkImport} source={props.source} />}
        </main>
      </div>
    </WorkspaceAction.Provider>
  );
}
