'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

test('calendar and collection filters track publication state across workspace changes',async t => {
  const destinations = [{id:'fb',name:'Facebook',enabled:true,fields:[]},{id:'li',name:'LinkedIn',enabled:true,fields:[]}];
  const scheduled = (id,planned) => ({id,selected:true,status:'scheduled',planned,published:'',values:{}});
  const published = {id:'li',selected:true,status:'published',planned:'2026-11-01T09:00',published:'2026-11-02T11:00',values:{}};
  const item = (id,number,records) => ({id,number,title:'Same title',stage:'draft',records});
  const first = {id:'first',name:'First',destinations,items:[
    item('mixed',1,[published,scheduled('fb','2026-11-02')]),
    item('only-published',2,[published]),
    item('outside',3,[scheduled('fb','2026-10-26T07:00')]),
    {...item('archived',4,[scheduled('fb','2026-11-02T07:00')]),archived:true},
  ]};
  const second = {id:'second',name:'Second',destinations:[{...destinations[0],id:'other'}],items:[
    item('legacy',1,[{...published,id:'other',planned:'2026-11-02T12:00',published:''}]),
  ]};
  const initial = {collections:[first,second],websites:[],presets:{},types:[]};
  const globals = {
    window:{studio:{getState:async () => initial,archiveCollection:async () => ({...initial,collections:[{...first,archived:true},second]})}},
    document:{querySelector:() => ({}),documentElement:{dataset:{}}},
    localStorage:{getItem:() => null},
    confirm:() => true,
  };
  for (const [name,value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis,name);
    Object.defineProperty(globalThis,name,{value,configurable:true});
    t.after(() => {
      if (previous) Object.defineProperty(globalThis,name,previous);
      else delete globalThis[name];
    });
  }

  const {connectWorkspace} = await import('../app/workspace-ui.js');
  let view;
  await connectWorkspace(props => { view = props; });
  const dispatch = view.dispatchAction;
  await dispatch('open-collection','first');
  view.updatePosts({filter:'scheduled'});
  assert.deepEqual(view.filteredPosts.map(post => post.id),['outside','mixed']);
  assert.equal(view.status(first.items[0]),'partial');
  assert.equal(view.publicationProgress(first.items[0]),'1 of 2 published');
  view.updatePosts({filter:'partial'});
  assert.deepEqual(view.filteredPosts.map(post => post.id),['mixed']);
  view.choosePlatform('li');
  view.updatePosts({filter:'scheduled'});
  assert.deepEqual(view.filteredPosts,[]);

  await dispatch('calendar');
  await dispatch('day','2026-11-02');
  const count = day => view.calendar.days.find(cell => cell.key === day).count;
  assert.equal(view.calendar.days.length,42);
  assert.equal(count('2026-10-26'),1);
  assert.equal(count('2026-11-01'),0);
  assert.equal(count('2026-11-02'),4);
  assert.deepEqual(view.calendar.rows.map(row => row.time),['','11:00','11:00','12:00']);
  view.calendar.updateCalendar({collection:'first'});
  view.calendar.updateCalendar({destination:'fb'});
  assert.equal(count('2026-11-02'),1);
  await dispatch('open-collection','first');
  await dispatch('archive-collection');
  await dispatch('calendar');
  assert.equal(view.calendar.calendarCollection,'');
  assert.equal(view.calendar.calendarDestination,'');
  assert.equal(count('2026-11-02'),1);
  assert.deepEqual(view.calendar.rows.map(row => row.item.id),['legacy']);
});
