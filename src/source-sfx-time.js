const f32=Math.fround;

// Source SfxBase 0x2b516a4. Return the requested activation change, or null.
// The caller must dispatch the change through its lifecycle, not just set state.
// State 2/3 and source NaN comparison behavior are deliberately preserved.
export function sourceSfxActivationChange({state,time,start,delay,lifespan,endless}){
  time=f32(time);
  const begin=f32(f32(start)+f32(delay));
  const end=f32(begin+f32(lifespan));
  if(state===0){
    if(!(begin<time))return null;
    if(end>time||endless)return true;
  }else if(state===1){
    if(begin>=time||(end<time&&!endless))return false;
  }
  return null;
}

// Source 0x2b5229c: the group expiry check excludes start and ignores nonpositive
// lifespan. This differs from the per-node activation boundary above.
export function sourceSfxGroupExpired({time,delay,lifespan,endless}){
  const elapsed=f32(f32(time)-f32(delay));
  lifespan=f32(lifespan);
  return elapsed>lifespan&&lifespan>0&&!endless;
}
