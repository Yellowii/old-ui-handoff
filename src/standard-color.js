import {scalar,vector,f,rgb} from './t107-frame.js';

// Original standard_char::GetRawData/GetOpacity and standard_common::GetAlbedo.
// The texture must be loaded as raw data; conversion happens exactly once here.
export function standardColor(p,macros,quality,char){
 const change=scalar(macros.CHAR_CHANGE_COLOR,char?1:0),ugc=char?scalar(macros.ENABLE_UGC_COLOR,0):0;
 if([change,ugc].some(v=>![0,1].includes(v)))throw Error('Unknown standard color permutation');
 const base=vector(p.BaseColor,[1,1,1,1]),color7=vector(p.Color7,[1,1,1,1]),tint=scalar(p.TintValue,1);
 const linear=x=>quality<2?`pow(max(vec3(0.),${x}),vec3(2.2))`:`((${x})*(${x}))`;
 let color;
 if(char){
  color=`vec3 neoStdColor=${linear('neoStdRaw.rgb')};`;
  if(change)color+=`neoStdColor=dot(neoStdColor,vec3(.2125,.7154,.0721))*${linear(rgb(base))};`;
  else if(ugc)color+=`float neoStdRegion=step(neoStdRaw.a,.35)-step(neoStdRaw.a,.3);neoStdColor=mix(neoStdColor,${linear(`(neoStdRegion*${rgb(color7)})`)},neoStdRegion);`;
 }else{
  const raw=change?'vec3(dot(neoStdRaw.rgb,vec3(.2125,.7154,.0721)))':'neoStdRaw.rgb';
  color=`vec3 neoStdColor=${linear(`(${raw}*${rgb(base)})`)};`;
 }
 return `vec4 neoStdRaw=texture2D(map,vMapUv);${color}
 diffuseColor.rgb=neoStdColor*${f(tint)};
 diffuseColor.a=opacity*${f(base[3])}${ugc?'':'*neoStdRaw.a'};
 vec4 neoRawColor=diffuseColor;`;
}
