import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHomeReturnTransition, hasHomeAnchor, markHomeReturn, rememberHomeAnchor, startDesktopHomeReturn, takeHomeReturn, type HomeAnchor } from './home-return';

const tile: HomeAnchor = { path: '/karten/warnungen', index: 0, top: 412, scrollY: 980 };

describe('Rückkehr an die Stelle der geöffneten Kachel', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('hält den Desktop-Kartenaufbau bis zum Ende des Rückübergangs zurück', async () => {
    let finish = () => {};
    const finished = new Promise<void>(resolve => { finish = resolve; });
    const add = vi.fn();
    const remove = vi.fn();
    const update = vi.fn(async () => {});
    vi.stubGlobal('document', { documentElement: { classList: { add, remove } }, startViewTransition: (callback: () => Promise<void>) => { void callback(); return { finished }; } });
    rememberHomeAnchor(tile);
    startDesktopHomeReturn(update);
    expect(update).toHaveBeenCalledOnce();
    expect(takeHomeReturn()).toEqual(tile);
    expect(getHomeReturnTransition()).not.toBeNull();
    expect(remove).not.toHaveBeenCalled();
    const pending = getHomeReturnTransition();
    finish();
    await pending;
    expect(getHomeReturnTransition()).toBeNull();
    expect(add).toHaveBeenCalledWith('desktop-home-return');
    expect(remove).toHaveBeenCalledWith('desktop-home-return');
  });

  it('kehrt auch ohne View-Transition-Unterstützung an dieselbe Kachel zurück', () => {
    vi.stubGlobal('document', {});
    const update = vi.fn(async () => {});
    rememberHomeAnchor(tile);
    startDesktopHomeReturn(update);
    expect(update).toHaveBeenCalledOnce();
    expect(getHomeReturnTransition()).toBeNull();
    expect(takeHomeReturn()).toEqual(tile);
  });
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
