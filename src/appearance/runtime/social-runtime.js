const RESOURCE_STATES = [
  'discovered', 'indexed', 'extracted', 'normalized', 'converted',
  'validated', 'published', 'blocked', 'needs-review',
];

export const RUNTIME_STATES = Object.freeze({
  PREPARED: 'prepared',
  RUNNING: 'running',
  PAUSED: 'paused',
  STOPPING: 'stopping',
  IDLE: 'idle',
});

export const RESOURCE_STATUS = Object.freeze(RESOURCE_STATES.reduce((out, state) => {
  out[state.replace('-', '_').toUpperCase()] = state;
  return out;
}, {}));

export const RUNTIME_CONTRACT_FAMILIES = Object.freeze({
  timing: 'timing-contract',
  distance: 'distance-contract',
  modifier: 'modifier-contract',
  camera: 'camera-contract',
  sfx: 'sfx-contract',
  roleAttachment: 'role-specific-extra-layout-contract',
});

export const PLAYBACK_RATE_RANGE = Object.freeze({min: 0, max: 4, default: 1});
export const DISTANCE_CONTRACT_VERSION = 'pair-separation-v1';

export function normalizePlaybackRate(value, {min = PLAYBACK_RATE_RANGE.min, max = PLAYBACK_RATE_RANGE.max, fallback = PLAYBACK_RATE_RANGE.default} = {}) {
  const rate = Number(value);
  if (!Number.isFinite(rate)) return fallback;
  return Math.min(max, Math.max(min, rate));
}

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const list = value => Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : [];
const clone = value => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));

function positionOf(value) {
  if (Array.isArray(value)) {
    const coordinates = value.slice(0, 3).map(Number);
    return coordinates.length >= 3 && coordinates.every(Number.isFinite) ? coordinates : null;
  }
  if (!value || typeof value !== 'object') return null;
  const coordinates = ['x', 'y', 'z'].map(key => Number(value[key]));
  return coordinates.every(Number.isFinite) ? coordinates : null;
}

export function measurePairSeparation(senderPosition, receiverPosition) {
  const sender = positionOf(senderPosition), receiver = positionOf(receiverPosition);
  if (!sender || !receiver) return null;
  return Math.hypot(...sender.map((value, index) => value - receiver[index]));
}

export function validateMinimumSeparation(actionOrNormalized, senderPosition, receiverPosition) {
  const action = actionOrNormalized?.placement ? actionOrNormalized : normalizeSocialAction(actionOrNormalized);
  const required = finite(action.placement?.motionMinDistance, -1);
  if (required < 0) return {required, actual: null, passed: true, status: 'not-required'};
  const actual = measurePairSeparation(senderPosition, receiverPosition);
  if (actual == null) return {required, actual: null, passed: false, status: 'missing-position'};
  return {required, actual, passed: actual + 1e-6 >= required, status: actual + 1e-6 >= required ? 'passed' : 'below-threshold'};
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function statusOf(value) {
  return RESOURCE_STATES.includes(value) ? value : 'needs-review';
}

export function buildResourcePackage({version, manifest = {}, resources = []} = {}) {
  if (!version || typeof version !== 'string') throw new Error('resource package version is required');
  const knownIds = new Set((manifest.resources || resources).map(row => String(typeof row === 'object' ? row.id : row)));
  const normalized = resources.map(row => {
    const id = String(row?.id ?? '');
    const known = knownIds.has(id);
    return {
      ...clone(row),
      id,
      status: statusOf(row?.status),
      known,
    };
  });
  return freeze({
    schemaVersion: 1,
    version,
    manifest: freeze({
      ...clone(manifest),
      schemaVersion: Number(manifest.schemaVersion || 1),
      version,
      resources: [...knownIds],
    }),
    resources: normalized,
  });
}

export class VersionedResourceCatalog {
  constructor({maxVersions = 4} = {}) {
    this.maxVersions = Math.max(1, Number(maxVersions) || 4);
    this.versions = new Map();
    this.order = [];
    this.activeVersion = null;
    this.invalidated = new Set();
  }

  stage(resourcePackage) {
    const packageValue = resourcePackage?.schemaVersion ? resourcePackage : buildResourcePackage(resourcePackage);
    if (!packageValue.version) throw new Error('resource package version is required');
    this.versions.set(packageValue.version, packageValue);
    this.order = [packageValue.version, ...this.order.filter(version => version !== packageValue.version)];
    while (this.order.length > this.maxVersions) {
      const index = [...this.order].reverse().findIndex(version => version !== this.activeVersion);
      if (index < 0) break;
      const evicted = this.order.splice(this.order.length - 1 - index, 1)[0];
      this.versions.delete(evicted);
    }
    return packageValue;
  }

  async load({manifest, catalog, manifestUrl, catalogUrl, fetchImpl = globalThis.fetch} = {}) {
    const read = async (value, url, label) => {
      if (value !== undefined) return value;
      if (!url || typeof fetchImpl !== 'function') throw new Error(`${label} is required`);
      const response = await fetchImpl(url, {cache: 'no-store'});
      if (!response.ok) throw new Error(`${label} load failed: ${response.status}`);
      return response.json();
    };
    const manifestValue = await read(manifest, manifestUrl, 'resource manifest');
    const catalogValue = await read(catalog, catalogUrl, 'resource catalog');
    const resources = Array.isArray(catalogValue) ? catalogValue : catalogValue.resources || catalogValue.items || [];
    return this.stage(buildResourcePackage({version: manifestValue.version, manifest: manifestValue, resources}));
  }

  publish(version) {
    const packageValue = this.versions.get(version);
    if (!packageValue) throw new Error(`resource package is not staged: ${version}`);
    const published = packageValue.resources.filter(row => row.known && row.status === 'published');
    if (!published.length) throw new Error(`resource package has no published resources: ${version}`);
    this.invalidated.delete(version);
    this.activeVersion = version;
    return this.snapshot();
  }

  switch(version) {
    if (this.invalidated.has(version)) throw new Error(`resource package is invalidated: ${version}`);
    return this.publish(version);
  }

  invalidate(version) {
    if (!this.versions.has(version)) throw new Error(`resource package is not staged: ${version}`);
    this.invalidated.add(version);
    if (this.activeVersion === version) {
      const fallback = this.order.find(candidate => candidate !== version && this.#publishable(candidate));
      this.activeVersion = fallback || null;
    }
    return this.snapshot();
  }

  rollback(version) {
    if (version) return this.switch(version);
    const fallback = this.order.find(candidate => candidate !== this.activeVersion && this.#publishable(candidate));
    if (!fallback) throw new Error('no previous resource package is available');
    return this.switch(fallback);
  }

  invalidateCache(version = this.activeVersion) {
    return {version, cacheKey: version ? `runtime:${version}` : null, invalidated: Boolean(version)};
  }

  get(id, {version = this.activeVersion} = {}) {
    const packageValue = this.versions.get(version);
    if (!packageValue || this.invalidated.has(version)) return undefined;
    const row = packageValue.resources.find(item => item.known && item.id === String(id) && item.status === 'published');
    return row ? clone(row) : undefined;
  }

  snapshot() {
    return {
      activeVersion: this.activeVersion,
      stagedVersions: [...this.order],
      invalidatedVersions: [...this.invalidated],
      activeResourceCount: this.activeVersion ? this.versions.get(this.activeVersion)?.resources.filter(row => row.known && row.status === 'published').length || 0 : 0,
    };
  }

  #publishable(version) {
    const packageValue = this.versions.get(version);
    return Boolean(packageValue && !this.invalidated.has(version) && packageValue.resources.some(row => row.known && row.status === 'published'));
  }
}

function durationSeconds(action) {
  if (finite(action?.max_time_duration) > 0) return finite(action.max_time_duration);
  if (finite(action?.animation_duration) > 0) return finite(action.animation_duration) / 30;
  if (finite(action?.special_status_frames) > 0) return finite(action.special_status_frames) / 30;
  return 0;
}

const VERIFIED_CAMERA_PAIRS = new Set([
  '0,0',
  '-180,180',
  '180,-180',
  '60,-60',
  '180,0',
]);

function contractGaps(action) {
  const gaps = [];
  if (finite(action?.modifier_id) !== 0) gaps.push(RUNTIME_CONTRACT_FAMILIES.modifier);
  if (finite(action?.motion_min_distance, -1) >= 0 && action?.distance_contract !== DISTANCE_CONTRACT_VERSION)
    gaps.push(RUNTIME_CONTRACT_FAMILIES.distance);
  const cameraAngles = [action?.send_camera_angle, action?.receive_camera_angle].map(value => finite(value, 0));
  const cameraPairKnown = VERIFIED_CAMERA_PAIRS.has(`${cameraAngles[0]},${cameraAngles[1]}`);
  const cameraSemanticsMissing = finite(action?.camera_height_offset) !== 0 ||
    finite(action?.camera_target_dist) !== 0 || Boolean(action?.banned_text) ||
    Boolean(action?.is_need_set_send_and_receive_angle) || Boolean(action?.no_auto_move);
  if (!cameraPairKnown || cameraSemanticsMissing) gaps.push(RUNTIME_CONTRACT_FAMILIES.camera);
  if (action?.special_sfx_path || action?.special_sfx_socket) gaps.push(RUNTIME_CONTRACT_FAMILIES.sfx);
  const roleOffsets = action?.role_extra_model_offsets || action?.roleExtraModelOffsets;
  if (roleOffsets && Object.keys(roleOffsets).length) gaps.push(RUNTIME_CONTRACT_FAMILIES.roleAttachment);
  return [...new Set(gaps)];
}

export function normalizeSocialAction(action) {
  if (!action || action.id == null) throw new Error('social action id is required');
  const normalized = {
    ...clone(action),
    id: String(action.id),
    durationSeconds: durationSeconds(action),
    sendBuffInMotion: list(action.send_buff_conf_in_motion ? [action.send_buff_conf_in_motion] : []),
    sendBuffAfterMotion: list(action.send_buff_conf_after_motion),
    receiveBuffAfterMotion: list(action.receive_buff_conf_after_motion),
    forceSpecialStatus: Boolean(action.is_force_special_status),
    preStartMotion: action.send_animation_before_real_start || null,
    timing: {
      mode: finite(action.max_time_duration) > 0 ? 'hard-stop-seconds' : finite(action.animation_duration) > 0 ? 'authored-30fps-duration' : 'caller-owned',
      maxTimeDuration: finite(action.max_time_duration),
      animationDurationFrames: finite(action.animation_duration),
      modifierId: finite(action.modifier_id),
    },
    placement: {
      motionDistance: finite(action.motion_distance),
      motionMinDistance: finite(action.motion_min_distance, -1),
      noAutoMove: Boolean(action.no_auto_move),
      minimumSeparation: {
        value: finite(action.motion_min_distance, -1),
        unit: 'world-units',
        coordinateSpace: 'pair-world-position',
        application: 'runtime-minimum-separation',
        evaluation: 'before-interaction-and-during-approach',
        symmetry: 'sender-receiver-pair',
        thresholdBehavior: 'motion-min-distance-is-independent-from-authored-motion-distance',
        lifecycle: 'pause-freezes; stop/reselect-cleanup; return-idle-restores',
        failure: 'reject-below-threshold-and-do-not-fallback-to-motion-distance',
        contract: action.distance_contract || null,
      },
    },
    camera: {
      sendAngle: finite(action.send_camera_angle),
      receiveAngle: finite(action.receive_camera_angle),
      heightOffset: finite(action.camera_height_offset),
      targetDistance: finite(action.camera_target_dist),
    },
    sfx: {path: action.special_sfx_path || null, socket: action.special_sfx_socket || null},
    contractGaps: contractGaps(action),
  };
  if (!normalized.send_motion && !normalized.receive_motion && normalized.durationSeconds <= 0)
    throw new Error(`social action has no runtime behavior: ${normalized.id}`);
  return freeze(normalized);
}

const noopEffects = Object.freeze({
  emit() {},
  apply() {},
  remove() {},
});

export class SocialRuntimeBridge {
  constructor({catalog = null, effects = noopEffects, clock = null} = {}) {
    this.catalog = catalog;
    this.effects = {...noopEffects, ...(effects || {})};
    this.clock = clock || {now: () => Date.now()};
    this.session = null;
    this.sequence = 0;
  }

  prepare(actionOrId, actors = {senderId: 'sender', receiverId: 'receiver'}) {
    if (this.session && this.session.state !== RUNTIME_STATES.IDLE) this.stop({returnIdle: false});
    const source = typeof actionOrId === 'object' ? actionOrId : this.catalog?.get(actionOrId);
    if (!source) throw new Error(`social action is not published: ${actionOrId}`);
    const action = normalizeSocialAction(source);
    const separation = validateMinimumSeparation(action, actors.senderPosition, actors.receiverPosition);
    const contractGaps = [...action.contractGaps];
    if (separation.required >= 0 && (!action.distance_contract || !separation.passed) && !contractGaps.includes(RUNTIME_CONTRACT_FAMILIES.distance))
      contractGaps.push(RUNTIME_CONTRACT_FAMILIES.distance);
    const session = {
      id: `${action.id}:${++this.sequence}`,
      action,
      senderId: String(actors.senderId ?? 'sender'),
      receiverId: String(actors.receiverId ?? 'receiver'),
      state: RUNTIME_STATES.PREPARED,
      elapsed: 0,
      applied: new Map(),
      events: [],
      startedAt: null,
      finished: false,
      contractGaps,
      distanceValidation: separation,
      playbackRate: PLAYBACK_RATE_RANGE.default,
    };
    this.session = session;
    this.#emit('prepare', {actionId: action.id});
    if (session.contractGaps.length) this.#emit('contract-review', {gaps: [...session.contractGaps], policy: 'fail-closed'});
    else if (separation.required >= 0) this.#emit('distance-validated', separation);
    return this.snapshot();
  }

  start() {
    const session = this.#requireSession();
    if (session.contractGaps.includes(RUNTIME_CONTRACT_FAMILIES.distance))
      throw new Error('social minimum separation is not satisfied');
    if (session.contractGaps.includes(RUNTIME_CONTRACT_FAMILIES.camera))
      throw new Error('social camera or SFX contract is not satisfied');
    if (session.contractGaps.includes(RUNTIME_CONTRACT_FAMILIES.modifier))
      throw new Error('social modifier contract is not satisfied');
    if (session.state === RUNTIME_STATES.RUNNING) return this.snapshot();
    if (session.finished) return this.snapshot();
    if (session.state !== RUNTIME_STATES.PREPARED && session.state !== RUNTIME_STATES.PAUSED)
      throw new Error(`cannot start from ${session.state}`);
    if (session.state === RUNTIME_STATES.PREPARED) {
      session.startedAt = this.clock.now();
      if (session.action.preStartMotion) this.#emit('pre-start', {motion: session.action.preStartMotion, actorId: session.senderId});
      if (session.action.forceSpecialStatus) {
        this.#apply('forced-status', session.senderId, 'special');
        this.#apply('forced-status', session.receiverId, 'special');
      }
      for (const buff of session.action.sendBuffInMotion) this.#apply('buff', session.senderId, buff, 'in-motion');
      this.#emit('start', {durationSeconds: session.action.durationSeconds});
      this.#emit('motion-start', {actorId: session.senderId, motion: session.action.send_motion, role: 'send'});
      this.#emit('motion-start', {actorId: session.receiverId, motion: session.action.receive_motion, role: 'receive'});
    } else this.#emit('resume', {elapsed: session.elapsed});
    session.state = RUNTIME_STATES.RUNNING;
    return this.snapshot();
  }

  update(deltaSeconds) { return this.tick(deltaSeconds); }

  setRate(value) {
    const session = this.#requireSession();
    const previous = session.playbackRate;
    session.playbackRate = normalizePlaybackRate(value);
    if (previous !== session.playbackRate) this.#emit('rate-change', {previous, rate: session.playbackRate});
    return this.snapshot();
  }

  seek(value, {unit = 'seconds'} = {}) {
    const session = this.#requireSession();
    const requested = Math.max(0, finite(value));
    const duration = session.action.durationSeconds;
    const elapsed = unit === 'fraction' && duration > 0
      ? Math.min(duration, requested * duration)
      : duration > 0 ? Math.min(duration, requested) : requested;
    if (session.finished && elapsed < duration) this.#removeAfterMotionEffects();
    session.elapsed = elapsed;
    if (duration > 0 && elapsed >= duration) {
      session.elapsed = duration;
      if (session.state === RUNTIME_STATES.RUNNING) this.#finishMotion();
      else if (!session.finished) {
        session.finished = true;
        this.#applyAfterMotionEffects();
        this.#emit('motion-end', {elapsed: session.elapsed});
      }
    } else {
      session.finished = false;
    }
    this.#emit('seek', {value: requested, unit, elapsed: session.elapsed});
    return this.snapshot();
  }

  tick(deltaSeconds) {
    const session = this.#requireSession();
    if (session.state !== RUNTIME_STATES.RUNNING) return this.snapshot();
    const delta = Math.max(0, finite(deltaSeconds));
    session.elapsed += delta;
    this.#emit('tick', {deltaSeconds: delta, elapsed: session.elapsed});
    if (session.action.durationSeconds > 0 && session.elapsed >= session.action.durationSeconds) this.#finishMotion();
    return this.snapshot();
  }

  pause() {
    const session = this.#requireSession();
    if (session.state !== RUNTIME_STATES.RUNNING) return this.snapshot();
    session.state = RUNTIME_STATES.PAUSED;
    this.#emit('pause', {elapsed: session.elapsed});
    return this.snapshot();
  }

  resume() { return this.start(); }

  reselect(actionOrId, actors) {
    this.stop({returnIdle: false});
    return this.prepare(actionOrId, actors);
  }

  stop({returnIdle = true} = {}) {
    const session = this.session;
    if (!session || session.state === RUNTIME_STATES.IDLE) return this.snapshot();
    session.state = RUNTIME_STATES.STOPPING;
    this.#emit('stop', {elapsed: session.elapsed});
    this.cleanup();
    if (session.playbackRate !== PLAYBACK_RATE_RANGE.default) {
      session.playbackRate = PLAYBACK_RATE_RANGE.default;
      this.#emit('rate-reset', {rate: PLAYBACK_RATE_RANGE.default});
    }
    if (returnIdle) {
      session.state = RUNTIME_STATES.IDLE;
      this.#emit('return-idle', {});
    } else this.session = null;
    return this.snapshot();
  }

  cleanup() {
    const session = this.#requireSession();
    for (const [key, effect] of session.applied) {
      this.effects.remove({...effect, key, sessionId: session.id});
    }
    session.applied.clear();
    this.#emit('cleanup', {});
    return this.snapshot();
  }

  snapshot() {
    const session = this.session;
    if (!session) return {state: RUNTIME_STATES.IDLE, actionId: null, elapsed: 0, durationSeconds: 0, playbackRate: PLAYBACK_RATE_RANGE.default, normalizedRate: PLAYBACK_RATE_RANGE.default, appliedEffects: [], events: []};
    return {
      state: session.state,
      sessionId: session.id,
      actionId: session.action.id,
      elapsed: session.elapsed,
      durationSeconds: session.action.durationSeconds,
      playbackRate: session.playbackRate,
      normalizedRate: session.playbackRate,
      timing: clone(session.action.timing),
      camera: clone(session.action.camera),
      sfx: clone(session.action.sfx),
      placement: clone(session.action.placement),
      contractGaps: [...session.contractGaps],
      distanceValidation: clone(session.distanceValidation || {required: -1, actual: null, passed: true, status: 'not-required'}),
      appliedEffects: [...session.applied.values()].map(effect => ({...effect})),
      events: session.events.map(event => ({...event})),
    };
  }

  #requireSession() {
    if (!this.session) throw new Error('social runtime is not prepared');
    return this.session;
  }

  #emit(type, payload) {
    const session = this.session;
    if (!session) return;
    const event = {type, at: this.clock.now(), ...payload};
    session.events.push(event);
    this.effects.emit({...event, sessionId: session.id, actionId: session.action.id});
  }

  #apply(kind, actorId, value, phase = 'start') {
    const session = this.#requireSession();
    const key = `${kind}:${actorId}:${value}:${phase}`;
    if (session.applied.has(key)) return;
    const effect = {kind, actorId, value, phase};
    session.applied.set(key, effect);
    this.effects.apply({...effect, key, sessionId: session.id, actionId: session.action.id});
    this.#emit('effect-apply', effect);
  }

  #applyAfterMotionEffects() {
    const session = this.#requireSession();
    for (const buff of session.action.sendBuffAfterMotion) this.#apply('buff', session.senderId, buff, 'after-motion');
    for (const buff of session.action.receiveBuffAfterMotion) this.#apply('buff', session.receiverId, buff, 'after-motion');
  }

  #removeAfterMotionEffects() {
    const session = this.#requireSession();
    for (const [key, effect] of session.applied) {
      if (effect.phase !== 'after-motion') continue;
      this.effects.remove({...effect, key, sessionId: session.id, actionId: session.action.id});
      session.applied.delete(key);
      this.#emit('effect-remove', effect);
    }
  }

  #finishMotion() {
    const session = this.#requireSession();
    if (session.state !== RUNTIME_STATES.RUNNING) return;
    session.elapsed = session.action.durationSeconds;
    session.finished = true;
    this.#applyAfterMotionEffects();
    this.#emit('motion-end', {elapsed: session.elapsed});
    session.state = RUNTIME_STATES.PAUSED;
  }
}

export const socialRuntimeContract = Object.freeze({
  schemaVersion: 1,
  lifecycle: ['prepare', 'start', 'tick/update', 'pause/resume', 'seek', 'rate', 'stop', 'cleanup', 'return-idle'],
  effectPhases: ['pre-start', 'start', 'in-motion', 'after-motion', 'cleanup'],
  contractFamilies: RUNTIME_CONTRACT_FAMILIES,
  playbackRate: {name: 'normalized-user-rate', range: PLAYBACK_RATE_RANGE, actorReceiverMustMatch: true},
  distance: {
    value: 'motion_min_distance',
    unit: 'unresolved-source-unit',
    coordinateSpace: 'unresolved-runtime-space',
    evaluation: 'before-interaction-and-during-approach',
    symmetry: 'sender-receiver-pair',
    thresholdBehavior: 'motion-min-distance-is-independent-from-authored-motion-distance',
    lifecycle: 'pause-freezes; stop/reselect-cleanup; return-idle-restores',
    failure: 'hold-pending-and-do-not-fallback-to-motion-distance',
  },
  camera: {
    verifiedPairs: [[0, 0], [-180, 180], [180, -180], [60, -60], [180, 0]],
    fields: ['send_camera_angle', 'receive_camera_angle', 'camera_height_offset', 'camera_target_dist'],
    failure: 'reject-before-motion-and-do-not-fallback-to-viewer-camera',
    lifecycle: 'prepare-contract-review; start-reject; stop-cleanup; return-idle',
  },
  sfx: {
    fields: ['special_sfx_path', 'special_sfx_socket'],
    failure: 'reject-before-motion-until-published-audio-contract-exists',
    lifecycle: 'prepare-contract-review; start-reject; stop-cleanup; return-idle',
  },
  modifier: {
    field: 'modifier_id',
    failure: 'reject-before-motion-until-modifier-effect-contract-exists',
    lifecycle: 'prepare-contract-review; start-reject; stop-cleanup; return-idle',
  },
  timing: ['hard-stop-seconds', 'authored-30fps-duration', 'caller-owned'],
  resourceStates: RESOURCE_STATES,
});
