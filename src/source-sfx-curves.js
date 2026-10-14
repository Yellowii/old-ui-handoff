const f32 = Math.fround;

// Shader updates 2b7e810 receive f32(node.time / node.lifespan). Keep this
// separate from source particle gravity/spin curves, which consume age.
export function sourceSfxShaderPhase(time, lifespan) {
  return f32(f32(time) / f32(lifespan));
}

function makeFrames(frames, parseValue) {
  const sorted = new Map();
  for (const frame of frames) {
    const time = f32(Number(frame.Time));
    if (!Number.isFinite(time)) throw new TypeError('Finite source keyframe time required');
    // Native insertion replaces the equal-time range before inserting a key.
    sorted.set(time, {time, value: parseValue(frame.Value)});
  }
  return [...sorted.values()].sort((a, b) => a.time - b.time);
}

function prepareTime(time, changeType, frames) {
  time = f32(time);
  if (Number.isNaN(time)) throw new TypeError('NaN curve phase is not supported');
  // Native reader starts both bounds at zero, then extends them per insertion.
  const first = Math.min(0, frames[0].time), last = Math.max(0, frames.at(-1).time);
  if (changeType === 0) return Math.min(last, Math.max(first, time));
  const span = f32(last - first);
  if (!(span > 0) || !Number.isFinite(time)) throw new RangeError('Finite phase and positive repeating curve span required');
  if (changeType === 1 || changeType === 2) time = Math.min(time, 1);
  if (changeType === 1 || changeType === 3) {
    const remainder = f32(f32(time - first) % span);
    return f32(remainder + (time < first ? last : first));
  }
  // The native ping-pong branch does not re-add first after reflection.
  const twice = f32(span + span);
  const phase = f32(Math.abs(f32(time - first)) % twice);
  return phase > span ? f32(twice - phase) : phase;
}

function interval(frames, time) {
  let low = 0, high = frames.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (frames[mid].time > time) high = mid;
    else low = mid + 1;
  }
  return low;
}

export function createSourceSfxFloatCurve({attributes = {}, frames}) {
  const change = Number(attributes.ChangeType ?? 0), interpolation = Number(attributes.Interpolator ?? 0);
  if (![0, 1, 2, 3, 4].includes(change) || ![0, 1].includes(interpolation)) {
    throw new RangeError('Unsupported source curve enum');
  }
  const keys = makeFrames(frames, value => {
    const parsed = f32(Number(value));
    if (!Number.isFinite(parsed)) throw new TypeError('Finite source scalar value required');
    return parsed;
  });
  return time => {
    if (!keys.length) return 0;
    if (keys.length === 1) return keys[0].value;
    time = prepareTime(time, change, keys);
    const upper = interval(keys, time);
    if (upper === 0) return keys[0].value;
    if (upper === keys.length) return keys.at(-1).value;
    const left = keys[upper - 1], right = keys[upper];
    const phase = f32(f32(time - left.time) / f32(right.time - left.time));
    const delta = f32(right.value - left.value);
    if (interpolation === 0) return f32(left.value + f32(phase * delta));
    const doubled = f32(phase + phase);
    const offset = doubled < 1
      ? f32(doubled * f32(doubled * f32(delta * 0.5)))
      : f32(f32(delta * -0.5) * f32(f32(f32(doubled - 1) * f32(doubled - 3)) - 1));
    return f32(left.value + offset);
  };
}

// Input is native packed ARGB, not an unproven conversion of BXML arrays.
// 2b6edc8 interpolates bytes via 2abe518 and then shader update emits RGBA.
export function createSourceSfxPackedColorCurve({attributes = {}, frames}) {
  const change = Number(attributes.ChangeType ?? 0);
  if (![0, 1, 2, 3, 4].includes(change)) throw new RangeError('Unsupported source color curve enum');
  const keys = makeFrames(frames, value => {
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new TypeError('Native packed ARGB required');
    return value;
  });
  const rgba = packed => [16, 8, 0, 24].map(shift => f32(((packed >>> shift) & 255) / 255));
  return time => {
    if (!keys.length) return [1, 1, 1, 1];
    if (keys.length === 1) return rgba(keys[0].value);
    time = prepareTime(time, change, keys);
    const upper = interval(keys, time);
    if (upper === 0) return rgba(keys[0].value);
    if (upper === keys.length) return rgba(keys.at(-1).value);
    const left = keys[upper - 1], right = keys[upper];
    const phase = f32(f32(time - left.time) / f32(right.time - left.time));
    return [16, 8, 0, 24].map(shift => {
      const a = (left.value >>> shift) & 255, b = (right.value >>> shift) & 255;
      const value = f32(a + f32((b - a) * phase));
      return f32(Math.trunc(Math.max(0, Math.min(255, value))) / 255);
    });
  };
}

// Resolve FloatKeyFrame references within one Uniforms section. Texture and
// color bindings are returned to the caller explicitly, never silently baked.
export function bindSourceSfxScalarUniforms(orderedNodes, uniformsPath, materialBinding) {
  const curves = new Map();
  for (const node of orderedNodes) {
    if (node.path.slice(0, node.path.lastIndexOf('/')) === uniformsPath) {
      curves.set(node.path.slice(uniformsPath.length + 1).replace(/\[\d+\]$/, ''), node);
    }
  }
  const scalar = [], remaining = [];
  for (const node of orderedNodes) {
    if (!node.path.startsWith(`${uniformsPath}/Variables[`)) continue;
    const {Name: name, Type: type, Value: reference} = node.attributes;
    if (!name) continue;
    if (type !== 'FloatKeyFrame') {remaining.push(node);continue;}
    const curve = curves.get(reference);
    if (!curve) throw new Error(`Missing source curve ${reference} for ${name}`);
    scalar.push({name, sample: createSourceSfxFloatCurve(curve)});
  }
  return {count: scalar.length, remaining, update(time, lifespan) {
    const phase = sourceSfxShaderPhase(time, lifespan), values = {};
    for (const {name, sample} of scalar) values[name] = sample(phase);
    materialBinding.setParameters(values);
  }};
}
