import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectEvidence } from '../apps/api/src/evidence.js';
test('evidence allowlist checks extensions, signatures, UTF-8 and size boundaries',()=>{
 assert.equal(inspectEvidence(Buffer.from('Fictional note'),'note.txt'),'text/plain');
 assert.equal(inspectEvidence(Buffer.from('89504e470d0a1a0a00000000','hex'),'photo.png'),'image/png');
 assert.equal(inspectEvidence(Buffer.from('%PDF-1.7\n'),'report.pdf'),'application/pdf');
 assert.throws(()=>inspectEvidence(Buffer.alloc(0),'empty.txt'));
 assert.throws(()=>inspectEvidence(Buffer.from('<script>'),'image.png'));
 assert.throws(()=>inspectEvidence(Buffer.from('x'),'../../note.txt'));
 assert.throws(()=>inspectEvidence(Buffer.from([255,0]),'bad.txt'));
 assert.throws(()=>inspectEvidence(Buffer.alloc(8*1024*1024+1),'huge.txt'));
});
