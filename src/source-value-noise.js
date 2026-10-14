// Identical random/noise functions in djlw_hair.hlsl and hdcb_inner.hlsl.
export const sourceValueNoise = `
float neoSourceRandom(vec2 st){
  return fract(sin(dot(st,vec2(12.0,78.0)))*43758.0);
}
float neoSourceNoise(vec2 st){
  vec2 i=floor(st),f=fract(st),u=f*f*(3.0-2.0*f);
  float a=neoSourceRandom(i),b=neoSourceRandom(i+vec2(1.0,0.0));
  float c=neoSourceRandom(i+vec2(0.0,1.0)),d=neoSourceRandom(i+vec2(1.0));
  return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;
}
`;
