// Images and scene configurations stay in IndexedDB, not in the migration data.
let connection;
async function database(){
  connection ||= new Promise((resolve,reject)=>{
    const request=indexedDB.open('neox23-ui-scenes',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('scenes',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });return connection;
}
export async function sceneRecords(mode,record){
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('scenes',mode==='read'?'readonly':'readwrite'),store=tx.objectStore('scenes');
    const request=mode==='read'?store.getAll():mode==='delete'?store.delete(record):store.put(record);let result;
    request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
}
