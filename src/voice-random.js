// Wwise Normal + Step: weighted selection excluding the source's recent-play window.
// Shuffle, continuous and nested containers are excluded by the source publisher.
export function chooseVoiceClip(row, recent = [], random = Math.random) {
  if (row.status !== 'ready-random' || row.random?.mode !== 'normal-step') throw new Error('Unsupported random voice');
  const count = row.random.avoidRepeat;
  if (!Number.isInteger(count) || count < 0 || count >= row.clips.length) throw new Error('Invalid source avoidance');
  if (row.clips.some(c => !Number.isFinite(c.weight) || c.weight <= 0)) throw new Error('Invalid source weight');
  const excluded = new Set(count ? recent.slice(-count) : []);
  const pool = row.clips.filter(clip => !excluded.has(clip.soundId));
  const total = pool.reduce((sum, clip) => sum + clip.weight, 0);
  const unit = random();
  if (!(unit >= 0 && unit < 1) || total <= 0) throw new Error('Invalid voice selection state');
  let target = unit * total;
  const selected = pool.find(clip => (target -= clip.weight) < 0) || pool.at(-1);
  return {clip:selected, recent:count ? [...recent, selected.soundId].slice(-count) : []};
}
