import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const {createMockApi}=await server.ssrLoadModule('/src/demo/engine.ts');
 const {mockDatabase}=await server.ssrLoadModule('/src/demo/database.ts');
 const {approveDemoPayment,readPayment}=await server.ssrLoadModule('/src/demo/payments.ts');
 const {previewUsers}=await server.ssrLoadModule('/src/preview/user.ts');
 const api=createMockApi(), user=previewUsers.company;
 const draft=api.execute({user,method:'POST',url:'/api/v1/test-requests',body:{equipmentId:44}}).envelope.data;
 const state=mockDatabase.read(), request=state.requests.find(r=>r.id===draft.id);
 request.status='SCHEDULING';request.estimatedFee={amount:250000,updatedAt:'2026-11-24T00:00:00Z'};mockDatabase.write(state);
 assert.equal(readPayment(draft.id,user),null);
 assert.throws(()=>approveDemoPayment(draft.id,{...user,id:888},250000),e=>e.status===403);
 assert.throws(()=>approveDemoPayment(draft.id,user,1),e=>e.status===409);
 assert.throws(()=>approveDemoPayment(draft.id,user,250000,true),e=>e.code==='DEMO_PAYMENT_FAILED');
 assert.equal(readPayment(draft.id,user),null);
 const receipt=approveDemoPayment(draft.id,user,250000);
 assert.equal(receipt.status,'APPROVED_DEMO');
 assert.equal(approveDemoPayment(draft.id,user,250000).id,receipt.id);
 assert.equal(mockDatabase.read().payments.length,1);
 assert.equal(mockDatabase.read().requests.find(r=>r.id===draft.id).status,'SCHEDULING');
 const changed=mockDatabase.read();changed.requests.find(r=>r.id===draft.id).estimatedFee={amount:300000,updatedAt:'2026-11-25T00:00:00Z'};mockDatabase.write(changed);
 assert.equal(readPayment(draft.id,user),null);
 assert.throws(()=>approveDemoPayment(draft.id,user,250000),e=>e.status===409);
 console.log('PASS: DEMO-only payment ownership, quote mismatch, failure without receipt, idempotent approval, quote invalidation and no booking/status side effects');
} finally {await server.close();}
