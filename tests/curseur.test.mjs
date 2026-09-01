import { test } from "node:test";
import assert from "node:assert/strict";
import { positionPoignee, horsPoignee } from "../docs/curseur.js";

const P = 32; // largeur de poignée, en pixels
const L = 332; // largeur du curseur

test("la poignée reste dans le curseur aux deux extrémités", () => {
  assert.equal(positionPoignee(0, 90, 0, L, P), P / 2, "au minimum");
  assert.equal(positionPoignee(0, 90, 90, L, P), L - P / 2, "au maximum");
  assert.equal(positionPoignee(0, 90, 45, L, P), L / 2, "au milieu");
});

test("la position est proportionnelle à la valeur", () => {
  const a = positionPoignee(10, 60, 20, L, P);
  const b = positionPoignee(10, 60, 30, L, P);
  const c = positionPoignee(10, 60, 40, L, P);
  assert.ok(Math.abs((b - a) - (c - b)) < 1e-9, "pas régulier");
  assert.ok(a < b && b < c, "croissante");
});

test("bornes dégénérées sans division par zéro", () => {
  assert.equal(positionPoignee(5, 5, 5, L, P), P / 2, "min égal au max");
  assert.equal(positionPoignee(0, 90, -10, L, P), P / 2, "valeur sous le minimum");
  assert.equal(positionPoignee(0, 90, 200, L, P), L - P / 2, "valeur au-dessus du maximum");
});

test("une prise sur la poignée est acceptée, une prise sur la piste refusée", () => {
  const t = 10;
  const centre = positionPoignee(0, 90, 30, L, P);
  assert.ok(!horsPoignee(0, 90, 30, L, centre, P, t), "pile sur la poignée");
  assert.ok(!horsPoignee(0, 90, 30, L, centre + P / 2 + t - 1, P, t), "au bord de la tolérance");
  assert.ok(horsPoignee(0, 90, 30, L, centre + P / 2 + t + 1, P, t), "juste au-delà");
  assert.ok(horsPoignee(0, 90, 30, L, 5, P, t), "à l'autre bout de la piste");
});

test("la zone acceptée fait au moins un pouce de large", () => {
  // Recommandation courante pour une cible tactile : environ 48 px.
  const t = 10;
  const centre = positionPoignee(0, 90, 45, L, P);
  let n = 0;
  for (let x = 0; x <= L; x++) if (!horsPoignee(0, 90, 45, L, x, P, t)) n++;
  assert.ok(n >= 48, `zone de prise de ${n} px, trop étroite au doigt`);
  assert.ok(n < L / 3, `zone de ${n} px, si large que la restriction ne sert plus`);
  assert.ok(Math.abs(centre - L / 2) < 1e-9, "centrée sur la poignée");
});
