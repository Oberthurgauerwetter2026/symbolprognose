import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { initialSumMetric } from './station-view';

describe('Summen-Startansicht', () => {
  it('startet ohne Auswahl mit Temperatur', () => {
    assert.equal(initialSumMetric(), 'temperature');
  });
  it('erhält eine ausdrücklich gewählte Messgrösse', () => {
    assert.equal(initialSumMetric('rain'), 'rain');
    assert.equal(initialSumMetric('wind'), 'wind');
  });
});