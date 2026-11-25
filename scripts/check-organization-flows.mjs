import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const {createMockDatabase}=await server.ssrLoadModule('/src/demo/database.ts');
 const {createMockApi}=await server.ssrLoadModule('/src/demo/engine.ts');
 const {previewUsers}=await server.ssrLoadModule('/src/preview/user.ts');
 const {hydrateRequest}=await server.ssrLoadModule('/src/domain/requestComposer.ts');
 const db=createMockDatabase(), api=createMockApi({database:db});
 const a=previewUsers.company,b={...a,id:6,name:'기업 B',email:'b@example.invalid',organization:{id:14,name:'기업 B'}},i=previewUsers.institution,j=previewUsers.university;
 const call=(user,method,path,body={})=>api.execute({user,method,url:'/api/v1'+path,body});
 const ok=(user,method,path,body={})=>{const r=call(user,method,path,body);assert(r.status<400,JSON.stringify(r));return r.envelope.data;};
 const eq=owner=>ok(owner,'POST','/equipment',{name:'QA 상호 대여 장비',testTypes:['VIBRATION'],equipmentType:'TEST'}).id;
 for(const [requester,provider,equipmentId] of [[a,b,eq(b)],[a,i,eq(i)],[i,j,eq(j)]]){
  assert.equal(call(provider,'POST','/test-requests',{equipmentId}).status,400,'Own equipment must not be requested');
  const draft=ok(requester,'POST','/test-requests',{equipmentId});
  const content=hydrateRequest(draft.revision.content,requester,'');
  Object.assign(content,{sample:{name:'QA 시료',quantity:1},schedule:{desiredStartDate:'2027-01-10',desiredEndDate:'2027-01-10'},test:{testTypeCode:'VIBRATION',purpose:'QA 검증'},accounting:{name:'회계',email:'qa@example.invalid'}});
  const saved=ok(requester,'PUT',`/test-requests/${draft.id}/draft`,{version:draft.version,content});
  ok(requester,'POST',`/test-requests/${draft.id}/submit`,{version:saved.version});
  let detail=ok(provider,'GET',`/test-requests/${draft.id}`);
  assert.equal(call(requester,'POST',`/test-requests/${draft.id}/review/start`,{version:detail.version}).status,403,'Requester must not act as provider');
  assert(ok(provider,'GET','/test-requests?box=RECEIVED').content.some(r=>r.id===draft.id));
  assert(!ok(provider,'GET','/test-requests?box=SENT').content.some(r=>r.id===draft.id));
  detail=ok(provider,'POST',`/test-requests/${draft.id}/review/start`,{version:detail.version});
  detail=ok(provider,'PUT',`/test-requests/${draft.id}/estimated-fee`,{version:detail.version,amount:250000,note:'QA DEMO'});
  detail=ok(provider,'POST',`/test-requests/${draft.id}/accept`,{version:detail.version});
  const reservation=ok(requester,'POST',`/test-requests/${draft.id}/reservations`,{version:detail.version,startAt:'2027-01-10T09:00:00+09:00',endAt:'2027-01-10T12:00:00+09:00'});
  detail=ok(provider,'GET',`/test-requests/${draft.id}`);
  assert.equal(call(requester,'POST',`/reservations/${reservation.id}/confirm`,{version:detail.version}).status,403,'Requester must not confirm booking');
  ok(provider,'POST',`/reservations/${reservation.id}/confirm`,{version:detail.version});
  detail=ok(provider,'GET',`/test-requests/${draft.id}`);
  assert.equal(call(provider,'POST',`/test-requests/${draft.id}/complete`,{version:detail.version}).status,409,'Result required before completion');
  detail=ok(provider,'PUT',`/test-requests/${draft.id}/result`,{summary:'QA 시험 결과',reportNo:'QA-DEMO'});
  detail=ok(provider,'POST',`/test-requests/${draft.id}/complete`,{version:detail.version});
  assert.equal(detail.status,'COMPLETED');
  assert.equal(ok(provider,'GET','/dashboard/summary?view=PROVIDER').view,'PROVIDER');
  assert.equal(ok(requester,'GET','/dashboard/summary?view=REQUESTER').view,'REQUESTER');
  const unrelated={...a,id:88,organization:{id:888,name:'타 조직'}};
  assert.equal(call(unrelated,'GET',`/test-requests/${draft.id}`).status,403);
 }
 console.log('PASS: COMPANY→COMPANY, COMPANY→INSTITUTION, INSTITUTION→INSTITUTION; ownership, SENT/RECEIVED, fee, review, booking, result and completion guards');
} finally {await server.close();}
