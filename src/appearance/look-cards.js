const names=[['skin','角色','char.svg'],['headwear','头饰','headwear.svg'],['facewear','面饰','facedec.svg'],['waistwear','腰饰','belt.svg'],['backwear','背包','backpack.svg'],['hair','发型','cap.svg'],['upper','上装','shirt.svg'],['lower','下装','pants.svg'],['yoyo','呦呦','Toy.svg']];
const icons={
 'char.svg':new URL('./assets/char.svg',import.meta.url).href,
 'headwear.svg':new URL('./assets/headwear.svg',import.meta.url).href,
 'facedec.svg':new URL('./assets/facedec.svg',import.meta.url).href,
 'belt.svg':new URL('./assets/belt.svg',import.meta.url).href,
 'backpack.svg':new URL('./assets/backpack.svg',import.meta.url).href,
 'cap.svg':new URL('./assets/cap.svg',import.meta.url).href,
 'shirt.svg':new URL('./assets/shirt.svg',import.meta.url).href,
 'pants.svg':new URL('./assets/pants.svg',import.meta.url).href,
 'Toy.svg':new URL('./assets/Toy.svg',import.meta.url).href,
};
export function renderLookCard(card,look,items,thumbnail){
  card.classList.add('ui-look-card');card.replaceChildren();
  const title=document.createElement('div');title.className='ui-look-title';title.textContent=look.name;
  const grid=document.createElement('div');grid.className='ui-look-slots';card.append(title,grid);
  const virtual=[];
  for(const [category,label,icon]of names){
    const saved=look.entries.find(entry=>items.find(item=>item.id===entry.id)?.businessCategoryId===category);
    const item=saved&&items.find(item=>item.id===saved.id),variant=item?.variants.find(v=>v.id===saved.variantId);
    const slot=document.createElement('span');slot.className='ui-look-slot';slot.dataset.slot=category;slot.title=item?`${label} · ${item.name}`:`${label} · 空槽`;slot.setAttribute('aria-label',slot.title);
    if(item&&variant){
      slot.classList.add('item','is-filled');slot.dataset.id=`${item.id}@${variant.id}`;
      const host=document.createElement('span');host.className='item-image';const image=new Image();image.alt=item.name;
      const source=thumbnail(slot.dataset.id)||item.thumbnail;if(source)image.src=source;else image.hidden=true;
      host.append(image);slot.append(host);virtual.push({...item,id:slot.dataset.id,thumbnail:source||null,variants:[{...variant,isDefault:true}]});
    }else{
      const placeholder=document.createElement('span');placeholder.setAttribute('aria-hidden','true');placeholder.style.setProperty('--slot-icon',`url("${icons[icon]}")`);placeholder.className='ui-slot-placeholder';slot.append(placeholder);
    }
    grid.append(slot);
  }
  return virtual;
}
