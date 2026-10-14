import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { configureHandoffServices } from '../src/handoff/services.js';

// Node has no stylesheet loader. Ignore only this known side-effect CSS import;
// all playback code and JS dependencies are the actual exported modules.
const cssUrl = new URL('../src/skin-voices.css', import.meta.url).href;
const hook = registerHooks({
  load(url, context, nextLoad) {
    if (url === cssUrl) return { format: 'module', source: '', shortCircuit: true };
    return nextLoad(url, context);
  },
});
let ResourceVoices, SkinVoicePanel;
try {
  ({ ResourceVoices } = await import('../src/appearance/resource-voices.js'));
  ({ SkinVoicePanel } = await import('../src/skin-voices.js'));
} finally {
  hook.deregister();
}

class AudioMock {
  paused = true;
  ended = false;
  dataset = {};
  calls = [];
  pause() { this.paused = true; this.calls.push(['pause']); }
  async play() { this.paused = false; this.calls.push(['play', this.src]); }
  removeAttribute(name) { delete this[name]; this.calls.push(['removeAttribute', name]); }
  load() { this.calls.push(['load']); }
}

for (const Panel of [ResourceVoices, SkinVoicePanel]) {
  const name = Panel.name;
  function fixture(t, resolve = () => 'data:audio/ogg;base64,fixture-resolved') {
    const requests = [];
    const messages = [];
    configureHandoffServices({
      assetResolver: (ref, context) => { requests.push({ ref, context }); return resolve(ref, context); },
      catalogProvider: () => assert.fail('playback must not load source catalogs'),
    });
    t.after(() => configureHandoffServices());
    const panel = Object.create(Panel.prototype);
    Object.assign(panel, {
      audio: new AudioMock(), active: null, token: 0, recent: new Map(), objectId: 0,
      language: { value: 'fixture-language' }, list: { querySelectorAll: () => [] },
      message: (...args) => messages.push(args), toast: (...args) => messages.push(args),
      data: { voices: {
        'fixture-voice': { status: 'ready', url: 'fixture:voice', mediaId: 'fixture-media' },
        'fixture-blocked': { status: 'missing-media', url: 'fixture:blocked' },
      } },
    });
    return { panel, requests, messages };
  }

  test(`${name} resolves playable URL with audio context and pause/resume reuses it`, async t => {
    const { panel, requests } = fixture(t);
    await panel.play('fixture-voice');
    assert.deepEqual(requests, [{ ref: { url: 'fixture:voice' }, context: { kind: 'audio' } }]);
    assert.equal(panel.audio.src, 'data:audio/ogg;base64,fixture-resolved');
    assert.equal(panel.audio.paused, false);
    assert.deepEqual(panel.audio.calls.at(-1), ['play', 'data:audio/ogg;base64,fixture-resolved']);
    if (Panel === SkinVoicePanel) assert.equal(panel.audio.dataset.mediaId, 'fixture-media');
    await panel.play('fixture-voice');
    assert.equal(panel.audio.paused, true);
    await panel.play('fixture-voice');
    assert.equal(panel.audio.paused, false);
    assert.equal(requests.length, 1);
    panel.stop();
    assert.equal(panel.active, null);
    assert.equal(panel.audio.src, undefined);
    assert.equal(panel.audio.paused, true);
    assert.deepEqual(panel.audio.calls.slice(-3), [['pause'], ['removeAttribute', 'src'], ['load']]);
    assert.equal(panel.audio.dataset.mediaId, undefined);
  });

  test(`${name} blocks unavailable rows and preserves explicit URL fallback`, async t => {
    const { panel, requests } = fixture(t, () => null);
    await panel.play('fixture-blocked');
    await panel.play('fixture-unknown');
    assert.deepEqual(requests, []);
    assert.deepEqual(panel.audio.calls, []);
    await panel.play('fixture-voice');
    assert.equal(panel.audio.src, 'fixture:voice');
    assert.deepEqual(requests[0].context, { kind: 'audio' });
  });

  test(`${name} resolves the selected synthetic random clip, not its parent row`, async t => {
    const { panel, requests } = fixture(t);
    panel.data.voices['fixture-random'] = {
      status: 'ready-random', random: { key: 'fixture-random-key', scope: 'global', mode: 'normal-step', avoidRepeat: 0 },
      clips: [{ url: 'fixture:random-clip', mediaId: 'fixture-random-media', soundId: 'fixture-sound', weight: 1 }],
    };
    await panel.play('fixture-random');
    assert.deepEqual(requests, [{ ref: { url: 'fixture:random-clip' }, context: { kind: 'audio' } }]);
    assert.equal(panel.audio.calls.at(-1)[0], 'play');
  });
}
