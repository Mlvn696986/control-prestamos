import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import publicAssets from '../scripts/public-assets.cjs';

const source = publicAssets.optimizePublicAsset('measurement.js', fs.readFileSync(new URL('../public/measurement.js',import.meta.url),'utf8'));
const attribution = {source:'chatgpt',medium:'referral',campaign_id:'contenido-educativo',content_id:'video-demo'};
const visitor = '2a9c49b8-62ab-4d71-98e2-223fb72110b7';
function harness(url='https://ermif.com/', storage=new Map()) {
  const scripts=[], events={}, cookies=[];
  const document={head:{append:s=>scripts.push(s)},createElement:()=>({}),addEventListener:(n,f)=>events[n]=f,
    set cookie(v){cookies.push(v);},title:'Private client name',referrer:'https://search.invalid/?email=private'};
  const window={};
  const context={window,document,location:new URL(url),URL,URLSearchParams,Date,navigator:{},
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
  vm.runInNewContext(source,context);
  return {api:window.ERMIFAnalytics,window,scripts,events,cookies,storage,
    calls:()=>JSON.parse(JSON.stringify((window.dataLayer||[]).map(x=>[...x])))};
}
test('new public pages send a bounded page name and path only after Google consent',()=>{
  for (const path of ['/control-de-cobranzas/','/ampliaciones-de-prestamos/','/reclamaciones/']) {
    const h=harness('https://ermif.com'+path+'?email=private#private');
    assert.equal(h.scripts.length,0);
    h.api.setConsent(true,attribution);
    assert.equal(h.scripts.length,1);
    const event=h.calls().find(c=>c[0]==='event'&&c[1]==='page_view');
    assert.equal(event[2].page_location,'https://ermif.com'+path);
    assert.ok(!JSON.stringify(h.calls()).includes('private'));
  }
});
test('Google never loads or receives events without explicit additional consent; reject disables it',async()=>{
  const h=harness();h.api.track('page_view');await h.api.milestones(visitor,{sign_up:true});
  assert.equal(h.scripts.length,0);assert.equal(h.calls().length,0);
  h.api.setConsent(false,attribution);assert.equal(h.scripts.length,0);
  h.api.setConsent(true,attribution);assert.equal(h.scripts.length,1);
  const count=h.calls().length;h.api.setConsent(false,attribution);h.api.track('view_plans');
  assert.equal(h.calls().length,count);assert.equal(h.window['ga-disable-G-12SC7RHS97'],true);
  assert.ok(h.cookies.every(c=>c.includes('Max-Age=0')));
});
test('callbacks, local demos, arbitrary classifications and private routes never load Google',()=>{
  for(const url of ['http://127.0.0.1:8787/','https://ermif.com/app/?code=private','https://ermif.com/app/#access_token=private','https://ermif.com/app/?billing=success','https://ermif.com/private-customer/']) {
    const h=harness(url);h.api.setConsent(true,attribution);assert.equal(h.scripts.length,0,url);
  }
  const h=harness();h.api.setConsent(true,{...attribution,source:'private@email.invalid'});assert.equal(h.scripts.length,0);
});
test('fixed titles, clean URLs and allowlisted events prevent business and URL data reaching GA',()=>{
  const h=harness('https://ermif.com/precios/?utm_source=private@example.invalid&customer=private#private');
  h.api.setConsent(true,attribution);h.api.track('view_plans',{email:'private'});h.api.track('private');
  const calls=h.calls();assert.ok(!JSON.stringify(calls).includes('private'));
  const config=calls.find(c=>c[0]==='config')[2];
  assert.equal(config.page_location,'https://ermif.com/precios/');assert.equal(config.page_referrer,'');
  assert.equal(config.send_page_view,false);assert.equal(config.allow_google_signals,false);
  assert.equal(config.allow_ad_personalization_signals,false);
  assert.equal(h.scripts[0].referrerPolicy,'no-referrer');
  h.api.setConsent(true,attribution);assert.equal(h.calls().filter(c=>c[1]==='page_view').length,1);
});
test('verified milestones accept only booleans and deduplicate across reloads without sending IDs',async()=>{
  const storage=new Map();const h=harness('https://ermif.com/app/',storage);h.api.setConsent(true,attribution);
  await h.api.milestones(visitor,{sign_up:true,first_client_created:'yes',first_loan_created:false,subscription_paid:false,email:'private'});
  await h.api.milestones(visitor,{sign_up:true,first_client_created:true,first_loan_created:true,subscription_paid:true});
  const events=h.calls().filter(c=>c[0]==='event').map(c=>c[1]);
  for(const name of ['sign_up','first_client_created','first_loan_created','subscription_paid']) assert.equal(events.filter(e=>e===name).length,1);
  assert.ok(!JSON.stringify(h.calls()).includes(visitor));assert.ok(!JSON.stringify(h.calls()).includes('private'));
  const next=harness('https://ermif.com/app/',storage);next.api.setConsent(true,attribution);
  await next.api.milestones(visitor,{sign_up:true,subscription_paid:true});
  assert.equal(next.calls().filter(c=>c[1]==='subscription_paid').length,0);
});
