import {CubeTexture,DataTexture,RGBAFormat,UnsignedByteType,HalfFloatType,LinearFilter,LinearMipmapLinearFilter,NoColorSpace} from 'three';
import {requestJSON} from './handoff/services.js';
import {DDSLoader} from 'three/addons/loaders/DDSLoader.js';

// DDSLoader owns format decoding and +X/-X/+Y/-Y/+Z/-Z face order.
export function parseSourceCube(buffer){
  if(buffer.byteLength<128)throw new Error('Truncated cube DDS header');
  const view=new DataView(buffer),h=Array.from({length:32},(_,i)=>view.getUint32(i*4,true));
  const width=h[4],count=h[2]&0x20000?Math.max(1,h[7]):1,half=h[20]===4&&h[21]===113;
  const rgba=h[20]===0x41&&h[21]===0&&h[22]===32&&h[23]===0xff0000&&h[24]===0xff00&&h[25]===0xff&&h[26]===0xff000000;
  const rgb=h[20]===0x40&&h[21]===0&&h[22]===24&&h[23]===0xff0000&&h[24]===0xff00&&h[25]===0xff&&h[26]===0;
  if(h[0]!==0x20534444||h[1]!==124||h[19]!==32||!width||width!==h[3]||(h[28]&0xfe00)!==0xfe00||h[28]&0x200000||count>Math.floor(Math.log2(width))+1)throw new Error('Invalid source cube DDS');
  if(!half&&!rgba&&!rgb)throw new Error('Unsupported source cube format');
  const bpp=half?8:rgb?3:4,faceBytes=Array.from({length:count},(_,i)=>Math.max(1,width>>i)**2*bpp).reduce((a,b)=>a+b,0);
  if(buffer.byteLength!==128+faceBytes*6)throw new Error('Incomplete cube mip payload');
  if(!((h[2]&8&&h[5]===width*bpp)||(h[2]&0x80000&&h[5]===width*width*bpp)))throw new Error('Unsupported cube pitch');
  let mipmaps;
  if(half){
    // Microsoft DDS FourCC 113 is R16G16B16A16_FLOAT, absent from Three's DDSLoader.
    let offset=128;mipmaps=[];
    for(let face=0;face<6;face++)for(let level=0;level<count;level++){
      const size=Math.max(1,width>>level),data=new Uint16Array(size*size*4);
      for(let i=0;i<data.length;i++)data[i]=view.getUint16(offset+i*2,true);
      offset+=data.byteLength;mipmaps.push({data,width:size,height:size});
    }
  }else mipmaps=new DDSLoader().parse(buffer,true).mipmaps;
  const type=half?HalfFloatType:UnsignedByteType;
  const image=(face,level)=>{const m=mipmaps[face*count+level];return new DataTexture(m.data,m.width,m.height,RGBAFormat,type);};
  const cube=new CubeTexture(Array.from({length:6},(_,i)=>image(i,0)));cube.type=type;
  cube.mipmaps=Array.from({length:count-1},(_,level)=>({image:Array.from({length:6},(_,face)=>image(face,level+1))}));
  cube.colorSpace=NoColorSpace;cube.flipY=false;cube.generateMipmaps=false;
  cube.minFilter=count>1?LinearMipmapLinearFilter:LinearFilter;cube.magFilter=LinearFilter;cube.needsUpdate=true;
  return cube;
}

export async function loadSourceCube(url){
  const response=await requestJSON(url);if(!response.ok)throw new Error(`Cube HTTP ${response.status}`);
  return parseSourceCube(await response.arrayBuffer());
}
