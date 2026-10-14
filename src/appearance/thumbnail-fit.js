// Trim transparent source margins once, then CSS fits the full asset inside its slot.
const cache=new Map();
export function fitThumbnail(url) {
  if(!url)return Promise.resolve(url);
  if(cache.has(url))return cache.get(url);
  const promise=new Promise(resolve=>{
    const image=new Image();image.onload=()=>{
      try {
        const canvas=document.createElement('canvas');const scale=Math.min(1,384/Math.max(image.naturalWidth,image.naturalHeight));
        canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
        const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);
        const {data}=ctx.getImageData(0,0,canvas.width,canvas.height);let left=canvas.width,top=canvas.height,right=-1,bottom=-1;
        for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]>12){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
        if(right<left){resolve(url);return;}
        const out=document.createElement('canvas');out.width=right-left+1;out.height=bottom-top+1;out.getContext('2d').drawImage(canvas,left,top,out.width,out.height,0,0,out.width,out.height);resolve(out.toDataURL());
      }catch{resolve(url);}
    };image.onerror=()=>resolve(url);image.src=url;
  });
  cache.set(url,promise);if(cache.size>512)cache.delete(cache.keys().next().value);return promise;
}
