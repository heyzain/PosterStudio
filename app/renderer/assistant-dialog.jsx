import { useEffect, useRef, useState } from 'react';
import { destinationArtwork } from './artwork-preview.js';
import { assistantError } from './assistant-text.js';
import { destinationLabels } from './destination-labels.js';
import { Dropdown } from './dropdown.jsx';
import { keyDate, plannedTimeLabel } from './local-dates.js';

const schedulePrompt = 'Reschedule this collection’s pending posts every other day starting today.';
const dayFormat = new Intl.DateTimeFormat(undefined, { weekday:'short', day:'numeric', month:'short', year:'numeric' });
const shortDate = new Intl.DateTimeFormat(undefined, { month:'short', day:'numeric', year:'numeric' });
const dateLabel = (value, format = shortDate) => format.format(new Date(value.slice(0,10) + 'T12:00'));
const historyKey = 'poster-studio-assistant-chats-v1';
const newChatId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const assistantIcons = {
  sparkles:'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zm7 11 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z',
  plus:'M12 5v14M5 12h14',
  history:'M3 12a9 9 0 1 0 2.6-6.4L3 8m0-5v5h5m4-1v5l3 2',
  settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0-5v2m0 14v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M3 12h2m14 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  up:'m6 14 6-6 6 6',
  down:'m6 10 6 6 6-6',
  send:'M12 19V5m-7 7 7-7 7 7',
  trash:'M4 7h16m-10 4v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3',
};

function AssistantIcon({ name }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={assistantIcons[name]} /></svg>;
}

function readChats() {
  try {
    const parsed = JSON.parse(localStorage.getItem(historyKey) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(chat => chat && typeof chat.id === 'string' && typeof chat.title === 'string' &&
      Number.isFinite(chat.updated) && typeof chat.scope === 'string' && Array.isArray(chat.turns))
      .map(chat => ({...chat, turns:chat.turns.filter(turn => turn && typeof turn === 'object').map(turn => {
        const result = turn.result;
        const validAgenda = result?.type === 'agenda' && typeof result.date === 'string' && Number.isFinite(Date.parse(result.date)) && typeof result.collectionId === 'string';
        const validHistory = result?.type === 'history' && typeof result.destination === 'string' && Number.isFinite(result.undated) &&
          (result.post === null || (result.post && typeof result.post.title === 'string' && typeof result.post.date === 'string' &&
            (!result.post.date || Number.isFinite(Date.parse(result.post.date))) && Array.isArray(result.post.others) &&
            result.post.others.every(other => other && typeof other.id === 'string' && typeof other.name === 'string' && typeof other.status === 'string')));
        const validSchedule = result?.type === 'schedule' && typeof result.name === 'string' && Number.isFinite(result.postCount) &&
          Number.isInteger(result.intervalDays) && typeof result.start === 'string' && Number.isFinite(Date.parse(result.start)) &&
          Array.isArray(result.rows) && result.rows.every(row => row && typeof row.title === 'string' && typeof row.destination === 'string' &&
            typeof row.planned === 'string' && (!row.planned || Number.isFinite(Date.parse(row.planned))) && typeof row.before === 'string' &&
            (!row.before || Number.isFinite(Date.parse(row.before))));
        const safeResult = validAgenda || validHistory || validSchedule ? result : null;
        if (safeResult?.type === 'schedule' && safeResult.token) safeResult.token = undefined;
        return {prompt:typeof turn.prompt === 'string' ? turn.prompt : '', result:safeResult,
          applied:turn.applied === true};
      }).filter(turn => turn.prompt || turn.result !== undefined)}))
      .slice(0, 50);
  } catch { return []; }
}

function saveChats(chats) {
  const safeChats = chats.slice(0, 50).map(chat => ({...chat, turns:chat.turns.map(turn => {
    if (turn.result?.type !== 'schedule' || !turn.result.token) return turn;
    return {...turn, result:{...turn.result, token:undefined}};
  })}));
  try { localStorage.setItem(historyKey, JSON.stringify(safeChats)); } catch { /* Keep the current chat usable when storage is unavailable. */ }
}

function PlannedDate({ value }) {
  return value ? <time dateTime={value}>{dateLabel(value)}{value.length > 10 && ' · ' + value.slice(11)}</time> : 'Unscheduled';
}

function Agenda({ result, assistant, source, close }) {
  const rows = assistant.publications(result.date, result.collectionId);
  const labels = new Map();
  for (const { collection } of rows) {
    if (!labels.has(collection.id)) labels.set(collection.id, destinationLabels(collection.destinations));
  }
  return <section className="assistant-result" aria-label="Pending publications">
    <h3>{dateLabel(result.date, dayFormat)}</h3>
    <p className="subtle">{rows.length ? `${rows.length} pending publication${rows.length === 1 ? '' : 's'}` : 'No pending publications for this date.'}</p>
    {rows.length > 0 && <ul className="assistant-agenda">
      {rows.map(({ collection, item, record, destination, time }) => {
        const artwork = destinationArtwork(destination, record) ?? item.artwork;
        return <li key={[collection.id, item.id, destination.id].join(':')}>
          <button type="button" className="assistant-post" onClick={() => {
            close();
            assistant.openPost(collection.id, item.id, destination.id);
          }}>
            {artwork && <img src={source(artwork, 'small')} alt="" loading="lazy" />}
            <span><strong>{item.title}</strong><small>{collection.name} · {labels.get(collection.id).get(destination.id)} · {time || plannedTimeLabel}</small></span>
            <span className="assistant-open-label">Open post</span>
          </button>
        </li>;
      })}
    </ul>}
  </section>;
}

function SchedulePreview({ result }) {
  const { rows, name, postCount, intervalDays, start } = result;
  const postsChanged = new Set(rows.map(row => row.itemId)).size;
  return <section className="assistant-result" aria-label="Schedule preview">
    <h3>{name}</h3>
    {rows.length ? <>
      <p className="subtle">{postsChanged} of {postCount} posts to update · {intervalDays === 1 ? 'Daily' : `Every ${intervalDays} days`} from {dateLabel(start)}</p>
      <ul className="assistant-preview">
        {rows.map(row => <li key={row.itemId + ':' + row.destinationId}>
          <strong>#{String(row.number).padStart(3,'0')} {row.title}</strong>
          <span className="subtle">{row.destination}</span>
          <div className="assistant-dates"><PlannedDate value={row.before} /><span aria-label="to">→</span><strong><PlannedDate value={row.planned} /></strong></div>
        </li>)}
      </ul>
    </> : <p className="subtle">{postCount ? 'Pending posts already match these dates.' : 'There are no planned or ready publications to reschedule.'}</p>}
  </section>;
}

function PublicationHistory({ result, collections, assistant, source, close }) {
  const { post, undated, destination } = result;
  const collection = collections.find(entry => entry.id === post?.collectionId && !entry.archived);
  const item = collection?.items.find(entry => entry.id === post.itemId && !entry.archived);
  const channel = collection?.destinations.find(entry => entry.id === post.destinationId);
  const record = item?.records.find(entry => entry.id === post.destinationId);
  const artwork = destinationArtwork(channel, record) ?? item?.artwork;
  const labels = destinationLabels(collection?.destinations ?? []);
  const statuses = {published:'Published', scheduled:'Scheduled', ready:'Ready', draft:'Draft'};
  return <section className="assistant-result" aria-label="Publication history">
    <h3>{post ? `Latest on ${labels.get(post.destinationId) ?? post.destination}` : `Publication history for ${destination}`}</h3>
    {post ? <>
      <p className="subtle">{post.date ? <>{post.actual ? 'Published ' : 'Planned date for this published post ' }<PlannedDate value={post.date} /></> : 'Publication date unavailable.'}</p>
      {post.date && undated > 0 && <p className="subtle">{undated} other published {undated === 1 ? 'entry has' : 'entries have'} no date to compare.</p>}
      <div className="assistant-agenda">
        {item ? <button type="button" className="assistant-post" onClick={() => {
          close();
          assistant.openPost(post.collectionId, post.itemId, post.destinationId);
        }}>
          {artwork && <img src={source(artwork, 'small')} alt="" loading="lazy" />}
          <span><strong>{post.title}</strong><small>{post.collectionName}</small></span>
          <span className="assistant-open-label">Open post</span>
        </button> : <p className="subtle">{post.title} · {post.collectionName}</p>}
      </div>
      {post.others.length ? <>
        <p className="subtle">Other destinations for this post</p>
        <ul className="assistant-preview">
          {post.others.map(other => <li key={other.id}>
            <span>{labels.get(other.id) ?? other.name} · {statuses[other.status] ?? other.status}
              {other.published && <> · <PlannedDate value={other.published} /></>}</span>
          </li>)}
        </ul>
      </> : <p className="subtle">This post has one destination.</p>}
    </> : <p className="subtle">{undated ? 'Published posts exist, but their dates are missing, so the latest one is unclear.' : 'No published posts found for this destination.'}</p>}
  </section>;
}

export function AssistantDialog({ assistant, collections, source, expanded, setExpanded, settingsVersion, openSettings }) {
  const activeCollections = collections.filter(collection => !collection.archived);
  const [selected, setSelected] = useState(assistant.collectionId || (activeCollections.length === 1 ? activeCollections[0].id : 'none'));
  const [configured, setConfigured] = useState(null);
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState([]);
  const [chats, setChats] = useState(readChats);
  const [chatId, setChatId] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const feed = useRef(null);
  const composer = useRef(null);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => assistant.settings()).then(result => { if (active) setConfigured(result.configured); },
      failure => { if (active) { setConfigured(false); setError(assistantError(failure)); } });
    return () => { active = false; };
  }, [settingsVersion]);

  useEffect(() => {
    if (!chatId && !turns.length) setSelected(assistant.collectionId || (activeCollections.length === 1 ? activeCollections[0].id : 'none'));
  }, [assistant.collectionId, chatId, turns.length]);

  useEffect(() => {
    const list = feed.current;
    const last = list?.lastElementChild;
    if (last) list.scrollTop += last.getBoundingClientRect().top - list.getBoundingClientRect().top - list.clientTop;
  }, [turns.length, chatId]);

  useEffect(() => { saveChats(chats); }, [chats]);

  useEffect(() => {
    if (!chatId || !turns.length || busy) return;
    const chat = {id:chatId, title:turns.find(turn => turn.prompt)?.prompt?.slice(0, 56) || 'Today’s posts',
      updated:Date.now(), scope:selected, turns};
    setChats(previous => [chat, ...previous.filter(entry => entry.id !== chatId)].slice(0, 50));
  }, [chatId, turns, selected, busy]);

  function startChat() {
    if (busy) return;
    setChatId('');
    setTurns([]);
    setSelected(assistant.collectionId || (activeCollections.length === 1 ? activeCollections[0].id : 'none'));
    setInput('');
    setPreview('');
    setError('');
    setShowHistory(false);
  }

  function openChat(chat) {
    if (busy) return;
    setChatId(chat.id);
    setSelected(chat.scope || 'none');
    setTurns(chat.turns);
    setPreview('');
    setError('');
    setShowHistory(false);
  }

  function deleteChat(id) {
    if (busy) return;
    setChats(previous => previous.filter(chat => chat.id !== id));
    if (chatId === id) startChat();
  }

  async function send(message) {
    const value = message.trim();
    if (busy || !configured || !value) return;
    setShowHistory(false);
    const requestChatId = chatId || newChatId();
    if (!chatId) setChatId(requestChatId);
    const turn = { prompt:value };
    const messages = [...turns.filter(entry => entry.prompt).map(entry => entry.prompt), value].slice(-6);
    setTurns(previous => [...previous, turn]);
    setInput('');
    setPreview('');
    setError('');
    setBusy('asking');
    try {
      const result = await assistant.ask(messages, selected === 'none' ? '' : selected);
      setTurns(previous => previous.map(entry => entry === turn ? { ...entry, result } : entry));
      setPreview(result?.token ?? '');
    } catch (failure) {
      setTurns(previous => previous.filter(entry => entry !== turn));
      if (!turns.length) {
        setChats(previous => previous.filter(chat => chat.id !== requestChatId));
        setChatId('');
      }
      setInput(previous => previous || value);
      setError(assistantError(failure));
    } finally { setBusy(''); }
  }

  async function applyPreview() {
    if (busy || !preview) return;
    setBusy('applying');
    setError('');
    try {
      await assistant.apply(preview);
      setTurns(previous => previous.map(entry => entry.result?.token === preview ? { ...entry, applied:true } : entry));
    } catch (failure) { setError(assistantError(failure)); }
    finally { setPreview(''); setBusy(''); }
  }

  return <section className={'assistant-dock' + (expanded ? ' is-expanded' : '')} aria-label="Studio Assistant">
    <div className="assistant-reveal" aria-hidden={!expanded}>
    <div className="assistant-reveal-inner">
    {expanded && <>
      <header className="assistant-panel-header">
        <div className="assistant-brand"><span className="assistant-mark" aria-hidden="true">✧</span><span><strong>Studio Assistant</strong><small>{selected === 'none' ? 'All collections' : activeCollections.find(collection => collection.id === selected)?.name ?? 'All collections'} · Saved on this device</small></span></div>
        <div className="assistant-panel-actions">
          <button className="button secondary assistant-new-chat" type="button" disabled={Boolean(busy)} onClick={startChat}><AssistantIcon name="plus" />New chat</button>
          <button className="assistant-icon-button" type="button" aria-label="Chat history" aria-pressed={showHistory} onClick={() => setShowHistory(value => !value)}><AssistantIcon name="history" /></button>
          <button className="assistant-icon-button" type="button" aria-label="Assistant settings" onClick={openSettings}><AssistantIcon name="settings" /></button>
          <button className="assistant-icon-button" type="button" aria-label="Collapse assistant" onClick={() => setExpanded(false)}><AssistantIcon name="down" /></button>
        </div>
      </header>
      {showHistory ? <div className="assistant-history-view">
        <div className="assistant-history-heading"><h3>Chat history</h3><span>On this device</span></div>
        {chats.length ? <ul className="assistant-history-list">{chats.map(chat => <li key={chat.id}>
          <button className="assistant-history-item" type="button" onClick={() => openChat(chat)}>
            <span><strong>{chat.title}</strong><small>{new Date(chat.updated).toLocaleString()} · {chat.turns.length * 2} messages</small></span>
          </button>
          <button type="button" className="assistant-delete-chat" aria-label={`Delete ${chat.title}`} disabled={Boolean(busy)} onClick={() => deleteChat(chat.id)}><AssistantIcon name="trash" /></button>
        </li>)}</ul> : <p className="subtle">Your chats will appear here.</p>}
      </div> : <>
        <div className="assistant-context">
          <div className="assistant-scope"><span>Collection context</span>
            <Dropdown label="Collection context" value={selected} disabled={Boolean(busy)} options={[
              ['none', 'Choose a collection'], ...activeCollections.map(collection => [collection.id, collection.name]),
            ]} onValueChange={value => { setSelected(value); setPreview(''); }} />
          </div>
        </div>
        <div className="assistant-feed" ref={feed} aria-label="Conversation">
          {!turns.length && <div className="assistant-welcome"><h3>What’s on your schedule?</h3>
            <p className="subtle">See pending publications, find your last post on a platform, or preview new dates for a collection.</p>
          </div>}
          {turns.map(({ prompt, result, applied }, index) => <div className="assistant-turn" key={index}>
            {prompt && <p className="assistant-message">{prompt}</p>}
            {result === undefined && <p className="assistant-writing-status" role="status"><span className="assistant-writing-dots" aria-hidden="true"><i /><i /><i /></span>Thinking…</p>}
            {result === null && <p className="subtle" role="status">Try asking what’s due on a date, when you last posted on a platform, or how to space a collection’s posts.</p>}
            {result?.type === 'agenda' && <Agenda {...{result, assistant, source, close:() => setExpanded(false)}} />}
            {result?.type === 'history' && <PublicationHistory {...{result, collections, assistant, source, close:() => setExpanded(false)}} />}
            {result?.type === 'schedule' && <SchedulePreview result={result} />}
            {result?.type === 'schedule' && result.rows.length > 0 && !result.token && !applied &&
              <p className="subtle">Saved preview only. Ask again to create a fresh preview before applying.</p>}
            {applied && <p className="assistant-saved" role="status">Changes saved to Calendar.</p>}
          </div>)}
        </div>
        <div className="assistant-composer">
          {preview && <div className="actions assistant-preview-actions">
            <button type="button" className="button quiet" onClick={() => setPreview('')} disabled={Boolean(busy)}>Discard preview</button>
            <button type="button" className="button primary" onClick={applyPreview} disabled={Boolean(busy)}>{busy === 'applying' ? 'Applying…' : 'Apply changes'}</button>
          </div>}
          <div className="assistant-shortcuts">
            <button type="button" className="button quiet" disabled={Boolean(busy)} onClick={() => {
              if (!chatId) setChatId(newChatId());
              setError(''); setPreview('');
              setTurns(previous => [...previous, { result:{type:'agenda', date:keyDate(new Date()), collectionId:''} }]);
            }}>Today’s posts</button>
            {configured && <button type="button" className="button quiet" disabled={Boolean(busy)} onClick={() => {
              setInput(schedulePrompt); composer.current?.focus();
            }}>Space posts every other day</button>}
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          {configured === false && <p className="subtle">Add an OpenRouter key in Settings to send chat messages. Today’s posts are available now.</p>}
        </div>
      </>}
    </>}
    </div>
    </div>
    <form className={'assistant-input' + (expanded ? ' assistant-input-expanded' : '')} onSubmit={event => {
      event.preventDefault(); if (!expanded) setExpanded(true); void send(input);
    }}>
      {!expanded && <span className="assistant-spark"><AssistantIcon name="sparkles" /></span>}
      <textarea ref={composer} aria-label="Ask anything about your posts" rows={expanded ? 2 : 1} maxLength={1200} value={input}
        placeholder="Ask anything about your posts…" onChange={event => setInput(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault(); if (!expanded) setExpanded(true); void send(input);
          }
        }} />
      {!expanded && <button type="button" className="assistant-icon-button assistant-expand" aria-label="Expand assistant" onClick={() => setExpanded(true)}><AssistantIcon name="up" /></button>}
      <button className="button primary assistant-send" disabled={Boolean(busy) || !input.trim() || !configured} aria-label="Send message">{busy === 'asking' ? '…' : <AssistantIcon name="send" />}</button>
    </form>
  </section>;
}
