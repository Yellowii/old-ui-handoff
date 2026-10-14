import {getHandoffServices} from './handoff/services.js';
const view=new DataView(new ArrayBuffer(4)),F=Math.fround;
export function sourceInverseSqrt(x){
 const table=getHandoffServices().runtimePolicy?.nstbRsqrtTable;
 if(!Array.isArray(table)||table.length!==512||table.some(v=>!Number.isInteger(v)))throw Error('Provide runtimePolicy.nstbRsqrtTable (512 uint32 values)');
 x=F(x);if(x===0)return 0;view.setFloat32(0,x,true);const bits=view.getUint32(0,true),exp=(bits>>>23)&255;if(!(x>0)||!exp||exp===255)throw Error("Unsupported inverse sqrt input");
 const power=exp-127,parity=((power%2)+2)%2;view.setUint32(0,table[parity*256+((bits&0x7fffff)>>>15)],true);let y=F(view.getFloat32(0,true)*2**(-Math.floor(power/2)));
 for(let i=0;i<2;i++)y=F(y*F((3-F(y*x)*y)/2));return y;
}
