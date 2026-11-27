import { describe, expect, it } from 'vitest';
import { hasHomeAnchor, markHomeReturn, rememberHomeAnchor, takeHomeReturn, type HomeAnchor } from './home-return';

const tile: HomeAnchor = { path: '/karten/warnungen', index: 0, top: 412, scrollY: 980 };

describe('Rückkehr an die Stelle der geöffneten Kachel', () => {
  it('kehrt nach dem Schliessen an die Stelle zurück, an der die Kachel geöffnet wurde', () => {
    rememberHomeAnchor(tile);
    markHomeReturn();
    expect(takeHomeReturn()).toEqual(tile);
  });

  it('zeigt die Übersicht von oben, wenn die Kachel nicht mit dem X geschlossen wurde', () => {
    rememberHomeAnchor(tile);
    expect(takeHomeReturn()).toBeNull();
    expect(hasHomeAnchor()).toBe(false);
  });

  it('springt nur einmal zurück', () => {
    rememberHomeAnchor(tile);
    markHomeReturn();
    takeHomeReturn();
    markHomeReturn();
    expect(takeHomeReturn()).toBeNull();
  });

  it('merkt sich jeweils die zuletzt geöffnete Kachel', () => {
    rememberHomeAnchor(tile);
    rememberHomeAnchor({ ...tile, path: '/karten/radar', scrollY: 120 });
    markHomeReturn();
    expect(takeHomeReturn()?.path).toBe('/karten/radar');
  });
});
