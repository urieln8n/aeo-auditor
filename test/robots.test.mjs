import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analizarRobots, permitido } from '../src/robots.mjs';

const robots = analizarRobots(`
User-agent: Applebot-Extended
Disallow: /

User-agent: Applebot
Allow: /

User-agent: Google
Disallow: /privado

User-agent: *
Allow: /
`);

const casos = [
  ['Applebot', '/', true],
  ['Applebot-Extended', '/', false],
  ['Googlebot', '/', true],
  ['Googlebot', '/privado', false],
  ['OtroBot', '/', true],
];

for (const [ua, ruta, esperado] of casos) {
  test(`${ua} ${ruta} → ${esperado ? 'permitido' : 'bloqueado'}`, () => {
    assert.equal(permitido(robots, ua, ruta), esperado);
  });
}

test('Disallow vacío permite todo', () => {
  assert.equal(permitido(analizarRobots('User-agent: *\nDisallow:'), 'GPTBot', '/'), true);
});

test('Sin robots.txt todo está permitido', () => {
  assert.equal(permitido(analizarRobots(''), 'OAI-SearchBot', '/'), true);
});

test('Comodines y $', () => {
  const r = analizarRobots('User-agent: *\nDisallow: /*.pdf$\nAllow: /');
  assert.equal(permitido(r, 'X', '/doc.pdf'), false);
  assert.equal(permitido(r, 'X', '/doc.pdf?x=1'), true);
});
