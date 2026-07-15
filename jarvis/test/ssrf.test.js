import test from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateIp, isForbiddenHostname, assertPublicHttpUrl } from '../server/util/ssrf.js';

test('private IPv4 detection', () => {
  for (const ip of ['127.0.0.1', '10.0.0.5', '192.168.1.1', '172.16.0.1', '172.31.255.255', '169.254.169.254', '0.0.0.0', '100.64.0.1']) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '203.113.131.1']) {
    assert.equal(isPrivateIp(ip), false, ip);
  }
});

test('private IPv6 detection', () => {
  assert.equal(isPrivateIp('::1'), true);
  assert.equal(isPrivateIp('fe80::1'), true);
  assert.equal(isPrivateIp('fd12:3456::1'), true);
  assert.equal(isPrivateIp('::ffff:127.0.0.1'), true);
  assert.equal(isPrivateIp('2606:4700::1111'), false);
});

test('forbidden hostnames', () => {
  assert.equal(isForbiddenHostname('localhost'), true);
  assert.equal(isForbiddenHostname('foo.local'), true);
  assert.equal(isForbiddenHostname('metadata.internal'), true);
  assert.equal(isForbiddenHostname('127.0.0.1'), true);
  assert.equal(isForbiddenHostname('example.com'), false);
});

test('assertPublicHttpUrl rejects bad protocols and internal targets', async () => {
  await assert.rejects(() => assertPublicHttpUrl('ftp://example.com/x'));
  await assert.rejects(() => assertPublicHttpUrl('file:///etc/passwd'));
  await assert.rejects(() => assertPublicHttpUrl('http://localhost:8080/admin'));
  await assert.rejects(() => assertPublicHttpUrl('http://127.0.0.1/'));
  await assert.rejects(() => assertPublicHttpUrl('http://169.254.169.254/latest/meta-data/'));
  await assert.rejects(() => assertPublicHttpUrl('http://[::1]/'));
  await assert.rejects(() => assertPublicHttpUrl('http://user:pass@example.com/'));
  await assert.rejects(() => assertPublicHttpUrl('not a url'));
});
