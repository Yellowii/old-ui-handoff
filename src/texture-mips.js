import {LinearMipmapLinearFilter} from 'three';

export function applySourceMips(texture,levels,images){
  if(!Array.isArray(levels)||!levels.length||levels.length!==images.length)throw new Error('Invalid source mip chain');
  const width=images[0].width,height=images[0].height;
  if(levels.length!==Math.floor(Math.log2(Math.max(width,height)))+1)throw new Error('Incomplete source mip chain');
  images.forEach((image,i)=>{
    if(levels[i].level!==i||image.width!==Math.max(1,width>>i)||image.height!==Math.max(1,height>>i)||levels[i].width!==image.width||levels[i].height!==image.height)throw new Error('Source mip dimensions mismatch');
  });
  texture.image=images[0];texture.mipmaps=images;texture.generateMipmaps=false;texture.minFilter=LinearMipmapLinearFilter;texture.needsUpdate=true;
  return texture;
}
