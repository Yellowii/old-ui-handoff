import {getHandoffServices} from './services.js';

export function isReviewedEffect(profile, effect) {
  const entries = getHandoffServices().runtimePolicy?.reviewedEffects?.[profile];
  const path = effect?.path, sha256 = effect?.source?.sha256;
  return typeof path === 'string' && path.length > 0 && typeof sha256 === 'string' && /^[a-f0-9]{64}$/.test(sha256)
    && Array.isArray(entries) && entries.some(entry => entry?.path === path && entry.sha256 === sha256);
}

export function runtimeContract(name) {
  const read = () => {
    const value = getHandoffServices().runtimePolicy?.materialContracts?.[name];
    if (!value) throw new Error(`Host material contract required: ${name}`);
    return value;
  };
  return new Proxy({}, {
    get: (_, key) => read()[key],
    ownKeys: () => Reflect.ownKeys(read()),
    getOwnPropertyDescriptor: (_, key) => ({configurable:true,enumerable:true,value:read()[key]}),
  });
}
