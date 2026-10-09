import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchEmails, consumeEmailEvents } from '../src/email-dispatcher.mjs';
import worker from '../src/worker.js';
const row={id:'one',lease_token:'lease',event_key:'claim_received:one',recipient:'test@example.invalid',subject:'ERMIF - Solicitud',payload:{claimCode:'TEST-01'}};
function setup(send, finish=async()=>true) {
 let queue=[row]; const calls=[];
 return { calls,env:{EMAIL_MODE:'enabled',EMAIL_OUTBOX_VERSION:'2',EMAIL_REPLY_TO:'support@example.invalid',EMAIL:{send}},
 rpc:async(name,args)=>{calls.push({name,args});return name==='email_claim_next' ? (queue.length?[queue.shift()]:[]) : finish(args);} };
}
test('una aceptación registra el ID y no afirma entrega',async()=>{
 const t=setup(async m=>{assert.equal(m.from.email,'notificaciones@ermif.com');assert.equal(m.replyTo,'support@example.invalid');return {messageId:'cf-id'};});
 assert.equal((await dispatchEmails(t.env,t.rpc)).accepted,1);
 assert.equal(t.calls[1].args.p_status,'accepted');assert.equal(t.calls[1].args.p_message_id,'cf-id');
});
test('solo los rechazos temporales conocidos se reintentan',async()=>{
 for(const [code,status] of [['E_RATE_LIMIT_EXCEEDED','retry'],['E_DAILY_LIMIT_EXCEEDED','retry'],['E_RECIPIENT_SUPPRESSED','error'],['E_INTERNAL_SERVER_ERROR','unknown'],['timeout','unknown']]) {
 const t=setup(async()=>{throw Object.assign(new Error('datos privados'),{code});}); await dispatchEmails(t.env,t.rpc);
 assert.equal(t.calls[1].args.p_status,status);assert.ok(!t.calls[1].args.p_error.includes('privados')); }
});
test('no duplica envío cuando falla guardar la aceptación',async()=>{
 let sends=0;const t=setup(async()=>{sends++;return {messageId:'cf-id'};},async()=>{throw new Error('base offline');});
 await assert.rejects(dispatchEmails(t.env,t.rpc));assert.equal(sends,1);assert.equal(t.calls.length,2);
});
test('datos inválidos fallan antes de llamar al proveedor',async()=>{
 let sends=0;const t=setup(async()=>{sends++;});const rpc=async(n,a)=>n==='email_claim_next' ? (t.calls.length?[]:(t.calls.push(1),[{...row,recipient:'bad\r\nBcc:x@x.test'}])) : (assert.equal(a.p_status,'error'),true);
 await dispatchEmails(t.env,rpc);assert.equal(sends,0);
});
test('modo local o desactivado no llama a DB ni proveedor',async()=>{
 const fail=()=>{throw new Error('red prohibida');};
 await dispatchEmails({EMAIL_MODE:'disabled'},fail);
 await dispatchEmails({EMAIL_MODE:'enabled',ENVIRONMENT:'local'},fail);
 await worker.scheduled({}, {ENVIRONMENT:'local',EMAIL_MODE:'enabled'});
 await worker.queue({messages:[]},{ENVIRONMENT:'local'});
});
test('eventos de entrega validan cuenta, origen y cola y no exponen contenido',async()=>{
 let ack=0,retry=0;const calls=[];
 const env={EMAIL_EVENTS_QUEUE:'email-events',CLOUDFLARE_ACCOUNT_ID:'acct'};
 const event={type:'cf.email.sending.message.delivered',source:{type:'email.sending',domain:'ermif.com'},payload:{eventId:'e1',messageId:'cf-id',subject:'privado'},metadata:{accountId:'acct',eventSchemaVersion:1,eventTimestamp:'2026-10-08T10:00:00Z'}};
 const message=body=>({body,ack:()=>ack++,retry:()=>retry++});
 await consumeEmailEvents({queue:'email-events',messages:[message(event),message({...event,source:{domain:'other.test'}})]},env,async(n,a)=>calls.push(a));
 assert.equal(ack,2);assert.equal(calls.length,1);assert.equal(calls[0].p_status,'delivered');assert.equal(calls[0].subject,undefined);
 await consumeEmailEvents({queue:'email-events',messages:[message(event)]},env,async()=>{throw new Error();});assert.equal(retry,1);
 await assert.rejects(consumeEmailEvents({queue:'wrong',messages:[]},env,async()=>{}));
});
test('panel y respuestas requieren sesión antes de consultar datos',async()=>{
 for(const [path,method] of [['/api/admin/legal','GET'],['/api/admin/privacidad/id/respond','POST'],['/api/admin/reclamaciones/id/respond','POST']]) {
 const res=await worker.fetch(new Request('https://example.invalid'+path,{method}),{SUPABASE_SERVICE_ROLE_KEY:'fake'});assert.equal(res.status,401); }
});

test('un usuario sin permisos no puede consultar el correo ni responder privacidad',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async url=>{calls++;return Response.json(String(url).includes('/auth/v1/user')?{id:'user'}:[{id:'user',is_admin:false}]);};
 try {
  const res=await worker.fetch(new Request('https://example.invalid/api/admin/privacidad/id/respond',{method:'POST',headers:{Authorization:'Bearer fake'},body:'{}'}),{SUPABASE_SERVICE_ROLE_KEY:'fake'});
  assert.equal(res.status,403);assert.equal(calls,2);
 }finally{globalThis.fetch=original;}
});
test('una respuesta que no se guarda no puede preparar correo',async()=>{
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,options={})=>{
  const path=String(url);calls.push({path,method:options.method});
  if(path.includes('/auth/v1/user'))return Response.json({id:'admin'});
  if(path.includes('/profiles?'))return Response.json([{is_admin:true}]);
  if(options.method==='PATCH')return Response.json({message:'Simulación de fallo al guardar'},{status:503});
  if(path.includes('/claim_book_entries?'))return Response.json([{id:'claim',claim_code:'C1',email:'test@example.invalid',response_version:0}]);
  throw new Error('Consulta inesperada');
 };
 try {
  const res=await worker.fetch(new Request('https://example.invalid/api/admin/reclamaciones/claim/respond',{method:'POST',headers:{Authorization:'Bearer fake'},body:JSON.stringify({response:'Respuesta de prueba'})}),{SUPABASE_SERVICE_ROLE_KEY:'fake',EMAIL_OUTBOX_VERSION:'2'});
  assert.equal(res.status,503);assert.equal(calls.some(c=>c.path.includes('email_outbox')),false);
 }finally{globalThis.fetch=original;}
});
test('respuesta concurrente devuelve conflicto y no crea un segundo correo',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(url,options={})=>{
  if(String(url).includes('/auth/v1/user'))return Response.json({id:'admin'});
  if(String(url).includes('/profiles?'))return Response.json([{is_admin:true}]);
  if(options.method==='PATCH'){assert.match(String(url),/response_version=eq\.2/);return Response.json([]);}
  if(String(url).includes('/claim_book_entries?'))return Response.json([{id:'claim',claim_code:'C1',response_version:2}]);
  throw new Error('No debe registrar correos');
 };
 try {
  const res=await worker.fetch(new Request('https://example.invalid/api/admin/reclamaciones/claim/respond',{method:'POST',headers:{Authorization:'Bearer fake'},body:JSON.stringify({response:'Respuesta de prueba'})}),{SUPABASE_SERVICE_ROLE_KEY:'fake',EMAIL_OUTBOX_VERSION:'2'});
  assert.equal(res.status,409);
 }finally{globalThis.fetch=original;}
});
