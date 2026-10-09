import {createServer} from 'node:http';
import {ApiError} from './auth.mjs';
import {lifecycle} from './lifecycle.mjs';
export function httpServer({projects,authenticate,onCommand=()=>{}}){
  return createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    try{
      const url=new URL(req.url,'http://localhost'),parts=url.pathname.split('/').filter(Boolean);
      if(parts[0]!=='api')throw new ApiError(404,'Route unavailable');
      if(parts[1]==='shares'&&req.method==='GET'){send(res,200,await projects.shared(parts[2]||''));return;}
      const bearer=req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];if(!bearer)throw new ApiError(401,'Authentication required');
      const identity=await authenticate(bearer);
      if(parts[1]!=='projects')throw new ApiError(404,'Route unavailable');
      const projectId=parts[2],action=parts[3];let result;
      if(!projectId&&req.method==='GET')result=await projects.list(identity);
      else if(!projectId&&req.method==='POST'){const body=await read(req);result=await projects.create(identity,body.companyId,body.document,body.evidence);}
      else if(!action&&req.method==='GET')result=await projects.get(identity,projectId);
      else if(action==='commands'&&req.method==='POST'){result=await projects.command(identity,projectId,await read(req));try{await onCommand(projectId,result);}catch{/* Durable acceptance does not depend on live delivery. */}}
      else if(action==='members'&&req.method==='PUT'){const body=await read(req);result=await projects.members(identity,projectId,body.subject,body.role);}
      else if(action==='members'&&req.method==='GET')result=await projects.listMembers(identity,projectId);
      else if(action==='lifecycle'&&req.method==='POST')result=await lifecycle(projects.db,identity,projectId,await read(req));
      else if(action==='revisions'&&req.method==='GET')result=await projects.revisions(identity,projectId);
      else if(action==='export'&&req.method==='GET')result=await projects.get(identity,projectId,'export');
      else if(action==='evidence'&&req.method==='POST')result=await projects.putEvidence(identity,projectId,await read(req));
      else if(action==='evidence'&&req.method==='GET'){const value=await projects.evidence(identity,projectId,parts[4]);result={mime:value.mime,sha256:value.hash,data:Buffer.from(value.bytes).toString('base64')};}
      else if(action==='shares'&&req.method==='POST')result=await projects.share(identity,projectId,(await read(req)).days);
      else if(action==='shares'&&req.method==='GET')result=await projects.listShares(identity,projectId);
      else if(action==='shares'&&req.method==='DELETE')result=await projects.revokeShare(identity,projectId,parts[4]);
      else throw new ApiError(404,'Route unavailable');
      send(res,200,result??{ok:true});
    }catch(error){send(res,error.status||500,{error:error.status?error.message:'Server operation failed'});}
  });
}
function send(res,status,value){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value));}
async function read(req){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>32*1024*1024)throw new ApiError(413,'Request too large');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'),(key,value)=>{if(['__proto__','constructor','prototype'].includes(key))throw new Error();return value;});}catch{throw new ApiError(400,'Invalid JSON');}}
