import {WebSocketServer} from 'ws';
import * as Y from 'yjs';
import {access,ApiError} from './auth.mjs';
export class Collaboration{
  constructor(server,database,authenticate,origins=['http://localhost:5173','http://127.0.0.1:5173','http://tauri.localhost','https://tauri.localhost','tauri://localhost']){
    this.db=database;this.auth=authenticate;this.rooms=new Map();this.wss=new WebSocketServer({server,path:'/api/collaboration',maxPayload:256*1024});
    this.wss.on('connection',(socket,request)=>{
      if(request.headers.origin&&!origins.includes(request.headers.origin)){socket.close(4403,'Origin rejected');return;}
      let identity,projectId,queue=Promise.resolve();const deadline=setTimeout(()=>socket.close(4401,'Authenticate first'),5000);
      const permissions=setInterval(()=>{if(identity)access(this.db,identity,projectId,'read').catch(()=>socket.close(4403,'Project access revoked'));},10000);permissions.unref();
      socket.on('message',raw=>{queue=queue.then(async()=>{
        const message=JSON.parse(raw.toString());
        if(!identity){if(message.type!=='join'||typeof message.token!=='string')throw new ApiError(401,'Authentication required');identity=await this.auth(message.token);projectId=message.projectId;await access(this.db,identity,projectId,'read');clearTimeout(deadline);socket.identity=identity;socket.projectId=projectId;
          const room=await this.room(projectId);room.sockets.add(socket);socket.send(JSON.stringify({type:'annotations',update:Buffer.from(Y.encodeStateAsUpdate(room.doc)).toString('base64')}));await this.broadcast(projectId,{type:'presence',subjects:[...room.sockets].map(s=>s.identity.subject)});return;}
        await access(this.db,identity,projectId,message.type==='annotations'?'annotate':'read');
        if(message.type==='annotations')await this.annotation(identity,projectId,message.update);
        else if(message.type!=='presence')throw new ApiError(400,'Unsupported collaboration message');
      }).catch(error=>{socket.close(error.status===403?4403:4401,'Workspace message rejected');});});
      socket.on('close',()=>{clearTimeout(deadline);clearInterval(permissions);Promise.resolve(this.rooms.get(projectId)).then(room=>{if(room){room.sockets.delete(socket);return this.broadcast(projectId,{type:'presence',subjects:[...room.sockets].map(s=>s.identity.subject)});}}).catch(()=>{});});
    });
  }
  async room(projectId){
    if(!this.rooms.has(projectId)){
      // Install a promise before awaiting I/O so concurrent joins cannot create split rooms.
      const pending=(async()=>{const doc=new Y.Doc();const{rows}=await this.db.query('SELECT state FROM annotations WHERE project_id=$1',[projectId]);if(rows.length)Y.applyUpdate(doc,new Uint8Array(rows[0].state));return{doc,sockets:new Set(),queue:Promise.resolve()};})();this.rooms.set(projectId,pending);
      try{this.rooms.set(projectId,await pending);}catch(error){this.rooms.delete(projectId);throw error;}
    }
    return this.rooms.get(projectId);
  }
  async annotation(identity,projectId,encoded){
    if(typeof encoded!=='string'||encoded.length>350000)throw new ApiError(400,'Annotation limit');
    const room=await this.room(projectId);const next=room.queue.catch(()=>{}).then(async()=>{
      await this.db.transaction(async client=>{
        await client.query('SELECT id FROM projects WHERE id=$1 FOR UPDATE',[projectId]);await access(client,identity,projectId,'annotate');
        const doc=new Y.Doc();
        const{rows}=await client.query('SELECT state FROM annotations WHERE project_id=$1',[projectId]);if(rows.length)Y.applyUpdate(doc,new Uint8Array(rows[0].state));
        Y.applyUpdate(doc,Buffer.from(encoded,'base64'));
        if([...doc.share.keys()].some(key=>key!=='annotations'))throw new ApiError(400,'Only annotations use CRDT');
        const notes=doc.getMap('annotations');if(notes.size>1000||[...notes.entries()].some(([key,value])=>!/^[a-zA-Z0-9_-]{1,160}$/.test(key)||typeof value!=='string'||value.length>4000))throw new ApiError(400,'Invalid annotation');
        const state=Buffer.from(Y.encodeStateAsUpdate(doc));if(state.length>1024*1024)throw new ApiError(400,'Annotation state limit');
        await client.query('INSERT INTO annotations VALUES($1,$2) ON CONFLICT(project_id) DO UPDATE SET state=$2',[projectId,state]);
        // The room changes only after SQL commit succeeds.
        return state;
      }).then(state=>Y.applyUpdate(room.doc,state));
      await this.broadcast(projectId,{type:'annotations',update:Buffer.from(Y.encodeStateAsUpdate(room.doc)).toString('base64')});
    });room.queue=next;return next;
  }
  async broadcast(projectId,message){
    const room=await this.room(projectId);
    for(const socket of room.sockets){try{await access(this.db,socket.identity,projectId,'read');if(socket.readyState===1)socket.send(JSON.stringify(message));}catch{socket.close(4403,'Project access revoked');}}
  }
  async close(){for(const socket of this.wss.clients)socket.close();await new Promise(resolve=>this.wss.close(resolve));for(const room of this.rooms.values())(await room).doc.destroy();}
}
