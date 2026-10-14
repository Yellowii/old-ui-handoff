import {requestJSON,resolveAsset} from './handoff/services.js';

import {createIcons, Mic, Play, Pause, X} from 'lucide';
import './skin-voices.css';
import {chooseVoiceClip} from './voice-random.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons = root => createIcons({icons:{Mic,Play,Pause,X},root});
const statusLabel = status => status === 'bank-unresolved' || status === 'missing-media' ? '音频资源缺失' : '事件待适配';

export function voiceRows(data, skinId) {
  const config = data?.skins?.[String(skinId)];
  if (!config) return [];
  return data.categories.flatMap(category => (config[category] || []).map((id, index) => ({
    ...data.voices[String(id)], category,
    label:(data.categoryLabels[category] || category).replace('{}', String(index + 1)),
  })));
}

export class SkinVoicePanel {
  constructor(toast) {
    this.toast = toast;
    this.token = 0;
    this.skin = null;
    this.active = null;
    this.recent = new Map();
    this.objectId = 0;
    this.button = document.createElement('button');
    this.button.id = 'skin-voice-open';
    this.button.className = 'icon-btn glass';
    this.button.title = this.button.ariaLabel = '角色语音';
    this.button.innerHTML = '<i data-lucide="mic"></i>';
    document.querySelector('.stage-actions').prepend(this.button);
    this.dialog = document.createElement('dialog');
    this.dialog.id = 'skin-voice-dialog';
    this.dialog.dataset.sourcePanel = 'gui2/person_bag_voice.csb';
    this.dialog.innerHTML = `<div class="voice-heading"><h2>角色语音</h2><button id="skin-voice-close" class="icon-btn" title="关闭" aria-label="关闭语音"><i data-lucide="x"></i></button></div>
      <div class="voice-language"><span id="skin-voice-name"></span><span>中文</span></div><audio id="skin-voice-audio" controls preload="none" aria-label="角色语音播放器"></audio><div id="skin-voice-list"></div>`;
    document.body.append(this.dialog);
    this.audio = this.dialog.querySelector('audio');
    this.list = this.dialog.querySelector('#skin-voice-list');
    this.button.onclick = () => this.open();
    this.dialog.querySelector('#skin-voice-close').onclick = () => this.close();
    this.dialog.addEventListener('click', e => {if (e.target === this.dialog) this.close();});
    this.dialog.addEventListener('close', () => this.stop());
    this.dialog.addEventListener('cancel', () => this.stop());
    this.list.onclick = e => {
      const button = e.target.closest('[data-voice-id]');
      if (button && !button.disabled) this.play(button.dataset.voiceId);
    };
    for (const event of ['play','pause','ended']) this.audio.addEventListener(event, () => this.updatePlayback());
    this.audio.addEventListener('error', () => {
      if (this.audio.hasAttribute('src')) this.toast('语音载入失败', true);
      this.updatePlayback();
    });
    document.addEventListener('visibilitychange', () => {if (document.hidden) this.stop();});
    icons(this.dialog);icons(this.button);
  }

  async load() {
    if (this.data) return;
    if (!this.loading) this.loading = (async () => {
      const response = await requestJSON('/data/skin-voices.json');
      if (!response.ok) throw new Error('语音目录未发布');
      this.data = await response.json();
      // These images are the exact paths referenced by person_bag_voice.csb.
      const assets = await requestJSON('/data/bag-assets.json');
      if (assets.ok) {
        const images = (await assets.json()).images;
        this.images = Object.fromEntries(['bg_voice.png','bg_voice_normal.png','btn_voice_play.png','btn_voice_play1.png']
          .map(name => [name, images['gui2/bag/new_bag/voice/' + name]?.url]));
        if (this.images['bg_voice.png']) this.dialog.style.backgroundImage = `url("${this.images['bg_voice.png']}")`;
        if (this.images['bg_voice_normal.png']) this.dialog.style.setProperty('--voice-row-image', `url("${this.images['bg_voice_normal.png']}")`);
      }
    })().finally(() => {this.loading = null;});
    await this.loading;
  }

  modelChanged(item) {
    this.stop();
    ++this.objectId;
    this.skin = item?.businessCategoryId === 'skin' ? item : null;
    this.button.disabled = !this.skin;
    if (this.dialog.open) this.dialog.close();
  }

  async open() {
    if (!this.skin) {this.toast('请先选择角色', true);return;}
    const skin = this.skin;
    try {
      await this.load();
      if (this.skin !== skin) return;
      this.dialog.querySelector('#skin-voice-name').textContent = skin.name;
      const rows = voiceRows(this.data, skin.itemId);
      this.list.innerHTML = rows.map(row => `<button class="voice-row" data-voice-id="${row.id}" aria-label="${esc(row.label)}" aria-pressed="false" ${['ready','ready-random'].includes(row.status) ? '' : 'disabled'}>
        <span class="voice-play">${this.images?.['btn_voice_play.png'] ? `<img src="${esc(this.images['btn_voice_play.png'])}" alt="">` : '<i data-lucide="play"></i>'}</span>
        <span class="voice-label">${esc(row.label)}</span><small>${row.status === 'ready' ? row.duration.toFixed(1) + ' s' : row.status === 'ready-random' ? `${row.clips.length} 段语音` : statusLabel(row.status)}</small></button>`).join('') || '<p class="voice-empty">当前角色没有已配置的中文展示语音</p>';
      icons(this.list);
      if (!this.dialog.open) this.dialog.showModal();
    } catch (error) {this.toast(error.message, true);}
  }

  async play(id) {
    const row = this.data?.voices[id];
    if (!['ready','ready-random'].includes(row?.status)) return;
    const token = ++this.token;
    if (this.active === id && !this.audio.paused) {this.audio.pause();return;}
    if (this.active !== id || this.audio.ended) {
      this.audio.pause();
      this.active = id;
      let clip = row;
      if (row.status === 'ready-random') {
        const key = row.random.key + (row.random.scope === 'global' ? '' : ':' + this.objectId);
        const choice = chooseVoiceClip(row, this.recent.get(key) || []);
        this.recent.set(key, choice.recent);
        clip = choice.clip;
      }
      this.audio.src = await resolveAsset(clip.url,{kind:'audio'}) ?? clip.url;
      this.audio.dataset.mediaId = String(clip.mediaId || clip.media?.mediaId || '');
    }
    try {await this.audio.play();}
    catch (error) {if (token === this.token && error.name !== 'AbortError') this.toast('语音播放失败：' + error.message, true);}
  }

  updatePlayback() {
    this.list.querySelectorAll('[data-voice-id]').forEach(button => {
      const playing = button.dataset.voiceId === this.active && !this.audio.paused;
      button.setAttribute('aria-pressed', String(playing));
      const image = button.querySelector('img');
      if (image && this.images) image.src = this.images[playing ? 'btn_voice_play1.png' : 'btn_voice_play.png'];
    });
  }

  stop() {
    ++this.token;
    this.active = null;
    this.audio.pause();
    this.audio.removeAttribute('src');
    delete this.audio.dataset.mediaId;
    this.audio.load();
    this.updatePlayback();
  }

  close() {
    this.stop();
    this.dialog.close();
  }
}
