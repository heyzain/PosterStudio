import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { createContext, useContext, useRef, useSyncExternalStore } from 'react';

const WorkspaceAction = createContext(null);

function Icon({ path }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={path} /></svg>;
}

function Action({ name, value, className = 'button', children, ...props }) {
  const dispatch = useContext(WorkspaceAction);
  return <button type="button" className={className} onClick={() => dispatch(name, value)} {...props}>{children}</button>;
}

function Header({ screen, light, icons }) {
  return (
    <header className="topbar">
      <Action name="home" className="brand plain">
        <img src="../assets/logo.svg" alt="" /><strong>Poster Studio</strong>
      </Action>
      <nav aria-label="Workspace">
        <Action name="home" className="nav plain" aria-current={screen !== 'calendar' ? 'page' : undefined}>
          <Icon path={icons.folder} /> Collections
        </Action>
        <Action name="calendar" className="nav plain" aria-current={screen === 'calendar' ? 'page' : undefined}>
          <Icon path="M4 6h16v15H4z M8 3v6 M16 3v6 M4 11h16" /> Calendar
        </Action>
      </nav>
      <Action name="theme" className="button quiet">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
          <circle cx="12" cy="12" r="4" />
        </svg>
        <span>{light ? 'Dark mode' : 'Light mode'}</span>
      </Action>
    </header>
  );
}

function CollectionIcon({ collection, icons, source }) {
  return collection.icon ? <img alt="" src={source(collection.icon)} /> : <Icon path={icons[collection.mark] ?? icons.folder} />;
}

function PlatformBadge({ destination, icons, solidIcons, source, full = false }) {
  const { type, name, icon } = destination;
  return (
    <span className="badge platform" data-platform={type} title={name}>
      <span className={solidIcons[type] && !icon ? 'platform-icon solid' : 'platform-icon'}>
        {icon ? <img src={source(icon)} alt="" /> : <Icon path={solidIcons[type] ?? icons[type] ?? icons.website} />}
      </span>
      <span className={full ? undefined : 'sr-only'}>{name}</span>
    </span>
  );
}

function Empty({ title, children }) {
  return <div className="empty"><h3>{title}</h3>{children}</div>;
}

function Collections({ collections, activeItems, countLabel, ...visuals }) {
  const active = collections.filter(collection => !collection.archived);
  const archived = collections.filter(collection => collection.archived);
  return (
    <>
      <section className="collections-section" aria-labelledby="collections-title">
        <header className="page-head">
          <div><h1 id="collections-title">Collections</h1><p className="text-muted">{countLabel(active.length, 'collection')}</p></div>
          <Action name="create" className="button primary"><Icon path={visuals.icons.plus} />Create collection</Action>
        </header>
        {active.length ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,258px),1fr))] gap-[22px]">
            {active.map(collection => {
              const posts = activeItems(collection);
              const cover = collection.cover || posts.find(post => post.artwork)?.artwork;
              const platforms = collection.destinations.filter(destination => destination.enabled);
              return (
                <Action key={collection.id} name="open-collection" value={collection.id} className="tile collection-tile" aria-label={'Open ' + collection.name}>
                  <span className="collection-cover" data-mark={collection.mark ?? 'folder'}>
                    {cover ? <img src={visuals.source(cover)} alt="" /> : <span className="cover-paper"><CollectionIcon collection={collection} {...visuals} /></span>}
                  </span>
                  <span className="collection-info">
                    <span className="collection-icon"><CollectionIcon collection={collection} {...visuals} /></span>
                    <span className="collection-meta"><strong>{collection.name}</strong><small>{countLabel(posts.length, 'post')}</small></span>
                    <span className="open-arrow"><Icon path={visuals.icons.arrow} /></span>
                  </span>
                  <span className="collection-platforms badges">
                    {platforms.length ? platforms.map(destination => <PlatformBadge key={destination.id} destination={destination} full {...visuals} />) : <small>No publishing destinations</small>}
                  </span>
                </Action>
              );
            })}
          </div>
        ) : <Empty title="No collections yet"><p className="text-muted">Create a collection for a series, a portfolio, or a project.</p></Empty>}
      </section>
      {archived.length > 0 && (
        <details className="archive-panel">
          <summary>Archived collections ({archived.length})</summary>
          {archived.map(collection => <div className="row" key={collection.id}><span>{collection.name}</span><Action name="restore-collection" value={collection.id}>Restore</Action></div>)}
        </details>
      )}
    </>
  );
}

function Options({ choices }) {
  return choices.map(([value, label]) => <option key={value} value={value}>{label}</option>);
}

const narrowPlatformLayout = () => window.matchMedia('(max-width: 760px)');
function subscribeToPlatformLayout(onChange) {
  const query = narrowPlatformLayout();
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function PlatformSelector({ destinations, posts, selected, platformRecord, choosePlatform, ...visuals }) {
  const compact = useSyncExternalStore(subscribeToPlatformLayout, () => narrowPlatformLayout().matches);
  return (
    <aside className="platform-panel" aria-labelledby="platforms-title">
      <h2 id="platforms-title">Platforms</h2>
      <ToggleGroup.Root className="platform-list" type="single" orientation={compact ? 'horizontal' : 'vertical'}
        aria-labelledby="platforms-title" value={selected?.id ?? 'all'} onValueChange={value => value && choosePlatform(value === 'all' ? '' : value)}>
        <ToggleGroup.Item value="all" className="platform-link plain">
          <span className="platform-name"><Icon path={visuals.icons.photo} />All posts</span>
          <span className="platform-count" aria-hidden="true">{posts.length}</span>
        </ToggleGroup.Item>
        {destinations.map(destination => (
          <ToggleGroup.Item key={destination.id} value={destination.id} className="platform-link plain">
            <PlatformBadge destination={destination} full {...visuals} />
            <span className="platform-count" aria-hidden="true">{posts.filter(post => platformRecord(post, destination.id)).length}</span>
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      <Action name="settings" className="button quiet platform-manage">Manage platforms</Action>
    </aside>
  );
}

function Status({ value, statusLabels }) {
  return <span className={'pill ' + value}>{statusLabels[value]}</span>;
}

function PostGrid({ filteredPosts, collection, selected, status, statusLabels, postNumber, search, filter, clearFilters, ...visuals }) {
  if (!filteredPosts.length) {
    const narrowed = Boolean(search.trim() || filter !== 'all');
    return (
      <Empty title={narrowed ? 'No matching posts' : 'No posts yet'}>
        <p className="text-muted">{narrowed ? 'Try a different search or status.' : selected ? 'Add a post for ' + selected.name + ' to get started.' : 'Add your first post to this collection.'}</p>
        {narrowed ? <button type="button" className="button" onClick={clearFilters}>Clear filters</button> : <Action name="new-item">Add post</Action>}
      </Empty>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,210px),1fr))] gap-4 [@media(max-width:540px)]:grid-cols-[repeat(auto-fill,minmax(min(100%,155px),1fr))] [@media(max-width:540px)]:gap-[10px]">
      {filteredPosts.map(post => {
        const destinations = selected ? [] : post.records.filter(record => record.selected)
          .map(record => collection.destinations.find(destination => destination.id === record.id)).filter(Boolean);
        return (
          <Action name="view-item" value={post.id} key={post.id} className="tile post-tile">
            <span className={post.artwork ? 'art has-image' : 'art'}>{post.artwork ? <img src={visuals.source(post.artwork)} alt="" /> : postNumber(post)}</span>
            <span className="tile-info">
              <span className="post-meta"><small>Post {postNumber(post)}</small><Status value={status(post)} statusLabels={statusLabels} /></span>
              <strong>{post.title}</strong>
              {destinations.length > 0 && <span className="badges">{destinations.map(destination => <PlatformBadge key={destination.id} destination={destination} {...visuals} />)}</span>}
            </span>
          </Action>
        );
      })}
    </div>
  );
}

function Collection({ collection, selected, posts, filteredPosts, search, filter, sort, statusLabels, countLabel, updatePosts, ...other }) {
  const searchInput = useRef(null);

  function clearFilters() {
    updatePosts({ search: '', filter: 'all' });
    searchInput.current?.focus();
  }

  return (
    <>
      <Action name="home" className="plain back"><Icon path={other.icons.back} />Collections</Action>
      <header className="page-head collection-header">
        <div className="collection-heading">
          <span className="collection-icon"><CollectionIcon collection={collection} {...other} /></span>
          <div><h1>{collection.name}</h1>{collection.description && <p className="text-muted">{collection.description}</p>}</div>
        </div>
        <div className="actions"><Action name="settings" className="button quiet">Collection settings</Action><Action name="new-item" className="button primary">Add post</Action></div>
      </header>
      <div className="collection-workspace">
        <PlatformSelector destinations={collection.destinations.filter(destination => destination.enabled)} posts={posts} selected={selected} {...other} />
        <section className="min-w-0" aria-labelledby="posts-title">
          <div className="post-heading"><h2 id="posts-title">{selected?.name ?? 'All posts'}</h2><small aria-live="polite">{countLabel(filteredPosts.length, 'post')}</small></div>
          <div className="toolbar post-toolbar">
            <div className="inline">
              <input ref={searchInput} type="search" aria-label="Search posts" placeholder="Search posts" value={search} onChange={event => updatePosts({ search: event.target.value })} />
              <select aria-label="Filter by status" value={filter} onChange={event => updatePosts({ filter: event.target.value })}>
                <Options choices={[[ 'all', 'All statuses' ], ...Object.entries(statusLabels)]} />
              </select>
            </div>
            <select aria-label="Sort posts" value={sort} onChange={event => updatePosts({ sort: event.target.value })}>
              <Options choices={[[ 'newest', 'Newest first' ], [ 'oldest', 'Oldest first' ], [ 'title', 'Title A–Z' ], [ 'updated', 'Recently edited' ]]} />
            </select>
          </div>
          <PostGrid {...other} {...{ filteredPosts, collection, selected, statusLabels, search, filter, clearFilters }} />
        </section>
      </div>
    </>
  );
}

function Calendar({ monthTitle, destinationChoices, collections, calendarCollection, calendarDestination, updateCalendar, days, heading, rows, statusLabels }) {
  return (
    <>
      <header className="page-head"><h1>Calendar</h1><Action name="plan" className="button primary">Plan a post</Action></header>
      <div className="toolbar">
        <div className="actions">
          <Action name="prev-month" aria-label="Previous month">‹</Action>
          <strong>{monthTitle}</strong>
          <Action name="next-month" aria-label="Next month">›</Action>
          <Action name="today" className="button quiet">Today</Action>
        </div>
        <div className="actions">
          <select aria-label="Calendar collection" value={calendarCollection} onChange={event => updateCalendar({ collection: event.target.value })}>
            <Options choices={[[ '', 'All collections' ], ...collections.map(collection => [collection.id, collection.name])]} />
          </select>
          <select aria-label="Calendar destination" value={calendarDestination} onChange={event => updateCalendar({ destination: event.target.value })}>
            <Options choices={[[ '', 'All destinations' ], ...destinationChoices]} />
          </select>
        </div>
      </div>
      <div className="calendar">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(label => <div className="weekday" key={label}>{label}</div>)}
        {days.map(({ date, key, count, today, outside, selected }) => (
          <Action key={key} name="day" value={key} className={['day', today && 'today', outside && 'outside'].filter(Boolean).join(' ')}
            aria-label={key + (count ? ', ' + count + (count === 1 ? ' post' : ' posts') : '')} aria-pressed={selected}>
            <span>{date}</span>{count > 0 && <small className="pill">{count}</small>}
          </Action>
        ))}
      </div>
      <section className="block agenda" aria-labelledby="agenda-title">
        <h2 id="agenda-title">{heading}</h2>
        {rows.length ? rows.map(({ collection, item, record, destination, time }) => {
          const key = [collection.id, item.id, destination.id].join(':');
          const published = record.status === 'published';
          return (
            <div className="row" key={key}>
              <div>
                <Action name="calendar-item" className="plain back" value={key}>{item.title}</Action>
                <br /><small>{collection.name} · {destination.name}{time ? ' · ' + time : ''}</small>
              </div>
              <div className="actions">
                <Status value={record.status} statusLabels={statusLabels} />
                <Action name={published ? 'undo-published' : 'mark-published'} value={key} className="button quiet">{published ? 'Undo published' : 'Mark published'}</Action>
              </div>
            </div>
          );
        }) : <p className="text-muted">No posts on this date.</p>}
      </section>
    </>
  );
}

export function Workspace({ screen, light, collection, calendar, ready, error, dispatchAction, ...props }) {
  return (
    <WorkspaceAction.Provider value={dispatchAction}>
      <div className="shell">
        <Header screen={screen} light={light} icons={props.icons} />
        <main id="page" className="min-w-0 text-ink">
          {error ? <Empty title="Could not open your workspace"><p className="text-muted">{error}</p></Empty> :
            !ready ? <p className="empty" role="status">Opening your workspace.</p> :
            screen === 'calendar' ? <Calendar {...props} {...calendar} /> :
            collection ? <Collection key={collection.id} collection={collection} {...props} /> :
            <Collections {...props} />}
        </main>
      </div>
    </WorkspaceAction.Provider>
  );
}
