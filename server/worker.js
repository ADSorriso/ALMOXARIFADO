const kinds=new Set(['orders','vehicles','oil','tires','filters']);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const parse=async request=>{try{return await request.json()}catch{return null}};
 function validRecord(kind,item){if(!item||typeof item!=='object'||Array.isArray(item))return false;if(typeof item.id!=='string'||item.id.length>100)return false;if(JSON.stringify(item).length>20000)return false;const required={orders:['date','requester','department','item','quantity'],vehicles:['prefix','plate','model','department','mileage'],oil:['vehicle','date','mileage','oilType'],tires:['vehicle','date','mileage','position'],filters:['code','name','category','application']};return required[kind].every(k=>String(item[k]??'').trim().length>0)}
 const validOrderNumber=value=>typeof value==='string'&&/^[A-Za-z0-9-]{1,32}$/.test(value);
 async function duplicateOrderNumber(db,owner,number,id){const rows=await db.prepare("SELECT id FROM fleet_records WHERE owner_id=? AND kind='orders' AND json_extract(payload,'$.number')=? AND id<>? LIMIT 1").bind(owner,number,id).first();return Boolean(rows)}
const validLayout=(value,category)=>typeof value==='string'&&(/^[24](,[24]){1,5}$/.test(value)||(category==='motorcycle'&&value==='1,1'));
const validWheel=(layout,id)=>{if(typeof id!=='string')return false;const sizes=String(layout||'2,4').split(',').map(Number);const match=/^E([1-6])-([LRC])([12])$/.exec(id);if(!match)return false;const axle=Number(match[1]),side=match[2],slot=Number(match[3]);return axle<=sizes.length&&(sizes[axle-1]===1?side==='C'&&slot===1:side!=='C'&&slot<=sizes[axle-1]/2)};
async function api(request,env,url){
 const owner=request.headers.get('oai-authenticated-user-id');
 if(!owner)return json({error:'Acesso não autenticado.'},401);
 if(!env.DB)return json({error:'Banco de dados indisponível.'},503);
 const path=url.pathname.split('/').filter(Boolean),method=request.method;
 try{
  if(path.length===2&&path[1]==='state'&&method==='GET'){
   const results=await env.DB.prepare('SELECT kind,payload FROM fleet_records WHERE owner_id=? ORDER BY created_at ASC').bind(owner).all();
   const state={orders:[],vehicles:[],oil:[],tires:[],filters:[],settings:{organization:'Almoxarifado',orderPrefix:'PED'}};
   for(const row of results.results){if(kinds.has(row.kind)){try{state[row.kind].push(JSON.parse(row.payload))}catch{}}}
   const settings=await env.DB.prepare('SELECT payload FROM fleet_settings WHERE owner_id=?').bind(owner).first();
   if(settings){try{state.settings={...state.settings,...JSON.parse(settings.payload)}}catch{}}
   return json(state);
  }
  if(path[1]==='records'&&path.length===3&&method==='POST'&&kinds.has(path[2])){
   const kind=path[2],item=await parse(request);
   if(!validRecord(kind,item))return json({error:'Preencha os campos obrigatórios.'},400);
   if(kind==='vehicles'&&!validLayout(item.axleLayout||'2,4',item.category))return json({error:'Informe os pneus por eixo (moto: 1,1; demais: 2,4 ou 2,4,4).'},400);
   if(kind==='vehicles'&&(!/^[0-9]{1,20}$/.test(String(item.patrimony||''))))return json({error:'Informe o número da plaqueta do patrimônio.'},400);
   if(kind==='vehicles'){
    const duplicate=await env.DB.prepare("SELECT id FROM fleet_records WHERE owner_id=? AND kind='vehicles' AND json_extract(payload,'$.patrimony')=? LIMIT 1").bind(owner,item.patrimony).first();
    if(duplicate)return json({error:'Já existe um veículo com esta plaqueta patrimonial.'},409);
   }
   if(kind==='oil'||kind==='tires'){
    const linked=await env.DB.prepare('SELECT payload FROM fleet_records WHERE owner_id=? AND kind=? AND id=?').bind(owner,'vehicles',item.vehicle).first();
    if(!linked)return json({error:'Veículo não encontrado.'},400);
    if(kind==='tires'&&!validWheel(JSON.parse(linked.payload).axleLayout,item.position))return json({error:'Posição de pneu inválida para os eixos deste veículo.'},400);
   }
   if(kind==='orders'){
    await env.DB.prepare('INSERT OR IGNORE INTO fleet_sequences(owner_id,last_number) VALUES(?,0)').bind(owner).run();
    const seq=await env.DB.prepare('UPDATE fleet_sequences SET last_number=last_number+1 WHERE owner_id=? RETURNING last_number').bind(owner).first();
    const settings=await env.DB.prepare('SELECT payload FROM fleet_settings WHERE owner_id=?').bind(owner).first();
    let prefix='PED';try{prefix=JSON.parse(settings?.payload||'{}').orderPrefix||'PED'}catch{}
    item.seq=seq.last_number;
    const proposed=String(item.manualNumber||'').trim();
    item.number=proposed||String(prefix).replace(/[^A-Z0-9-]/gi,'').slice(0,10)+'-'+String(seq.last_number).padStart(4,'0');
    if(!validOrderNumber(item.number))return json({error:'Número inválido: use letras, números ou hífen.'},400);
    if(await duplicateOrderNumber(env.DB,owner,item.number,item.id))return json({error:'Já existe um pedido com este número.'},409);
   }
   await env.DB.prepare('INSERT INTO fleet_records(owner_id,kind,id,payload) VALUES(?,?,?,?)').bind(owner,kind,item.id,JSON.stringify(item)).run();
   return json({record:item},201);
  }
  if(path[1]==='records'&&path[2]==='orders'&&path.length===4&&method==='PATCH'){
   const data=await parse(request);if(!['Pendente','Em andamento','Atendido'].includes(data?.status))return json({error:'Status inválido.'},400);
   const row=await env.DB.prepare('SELECT payload FROM fleet_records WHERE owner_id=? AND kind=? AND id=?').bind(owner,'orders',path[3]).first();
   if(!row)return json({error:'Pedido não encontrado.'},404);
   const item=JSON.parse(row.payload);item.status=data.status;
   await env.DB.prepare('UPDATE fleet_records SET payload=? WHERE owner_id=? AND kind=? AND id=?').bind(JSON.stringify(item),owner,'orders',path[3]).run();
   return json({record:item});
  }
  if(path[1]==='records'&&path[2]==='orders'&&path.length===4&&method==='PUT'){
   const input=await parse(request);
   if(!validRecord('orders',input)||input.id!==path[3])return json({error:'Pedido inválido ou incompleto.'},400);
   if(!Array.isArray(input.items)||input.items.length>60||input.items.some(x=>!x||typeof x.description!=='string'))return json({error:'Relação de itens inválida.'},400);
   const existing=await env.DB.prepare('SELECT payload FROM fleet_records WHERE owner_id=? AND kind=? AND id=?').bind(owner,'orders',path[3]).first();
   if(!existing)return json({error:'Pedido não encontrado.'},404);
   const original=JSON.parse(existing.payload);
   const number=String(input.manualNumber||input.number||original.number).trim();
   if(!validOrderNumber(number))return json({error:'Número inválido: use letras, números ou hífen.'},400);
   if(await duplicateOrderNumber(env.DB,owner,number,input.id))return json({error:'Já existe um pedido com este número.'},409);
   const updated={...input,number,manualNumber:number,seq:original.seq,status:input.status||original.status};
   await env.DB.prepare('UPDATE fleet_records SET payload=? WHERE owner_id=? AND kind=? AND id=?').bind(JSON.stringify(updated),owner,'orders',updated.id).run();
   return json({record:updated});
  }
  if(path[1]==='records'&&path[2]==='vehicles'&&path.length===4&&method==='PATCH'){
   const data=await parse(request);
   const row=await env.DB.prepare('SELECT payload FROM fleet_records WHERE owner_id=? AND kind=? AND id=?').bind(owner,'vehicles',path[3]).first();
   if(!row)return json({error:'Veículo não encontrado.'},404);
   const item=JSON.parse(row.payload);if(!validLayout(data?.axleLayout,item.category))return json({error:'Configuração de pneus incompatível com este veículo.'},400);item.axleLayout=data.axleLayout;
   await env.DB.prepare('UPDATE fleet_records SET payload=? WHERE owner_id=? AND kind=? AND id=?').bind(JSON.stringify(item),owner,'vehicles',path[3]).run();
   return json({record:item});
  }
  if(path[1]==='settings'&&path.length===2&&method==='PUT'){
   const data=await parse(request);if(!data||typeof data.organization!=='string'||typeof data.orderPrefix!=='string')return json({error:'Configuração inválida.'},400);
   const settings={organization:data.organization.trim().slice(0,100),orderPrefix:data.orderPrefix.toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,10)};
   if(!settings.organization||!settings.orderPrefix)return json({error:'Configuração incompleta.'},400);
   await env.DB.prepare('INSERT INTO fleet_settings(owner_id,payload) VALUES(?,?) ON CONFLICT(owner_id) DO UPDATE SET payload=excluded.payload').bind(owner,JSON.stringify(settings)).run();
   return json({settings});
  }
  return json({error:'Rota não encontrada.'},404);
 }catch(err){console.error('Fleet API error',err);return json({error:'Não foi possível concluir a operação.'},500)}
}
export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return api(request,env,url);if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method Not Allowed',{status:405});const pathname=url.pathname==='/'?'/index.html':url.pathname;const asset=ASSETS[pathname];if(!asset)return new Response('Not Found',{status:404});return new Response(request.method==='HEAD'?null:asset.body,{headers:{'content-type':asset.type,'cache-control':'no-cache','x-content-type-options':'nosniff'}})}};
