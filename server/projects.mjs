import {createHash,randomBytes} from 'node:crypto';
import {access,ApiError,id} from './auth.mjs';
import * as domain from './domain.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
function decodeAttachment(value){
  id(value.id);if(typeof value.data!=='string'||value.data.length>28*1024*1024||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.data))throw new ApiError(400,'Invalid evidence encoding');
  const bytes=Buffer.from(value.data,'base64');
  if(bytes.length>20*1024*1024||hash(bytes)!==value.sha256||!['image/jpeg','image/png','image/webp','application/pdf','text/plain','text/csv','application/json'].includes(value.mime))throw new ApiError(400,'Invalid evidence');return{...value,bytes};
}
async function references(client,projectId,doc){for(const ref of doc.evidenceRefs.filter(ref=>ref.blobId)){const{rows}=await client.query('SELECT hash,mime,octet_length(bytes) AS size FROM evidence WHERE project_id=$1 AND id=$2',[projectId,ref.blobId]);if(!rows.length||rows[0].size!==ref.bytes||rows[0].mime!==ref.mime||(ref.sha256&&ref.sha256!==rows[0].hash))throw new ApiError(409,'Project evidence is missing or inconsistent');}}
export class Projects{
  constructor(database){this.db=database;}
  async list(identity){const{rows}=await this.db.query('SELECT p.id,p.accepted_revision,p.company_id FROM projects p JOIN project_members m ON m.project_id=p.id JOIN company_members c ON c.company_id=p.company_id AND c.subject=m.subject WHERE m.subject=$1',[identity.subject]);return rows;}
  async create(identity,company,document,evidence=[]){
    const doc=domain.validate(document);id(doc.projectId);id(company);
    if(!Array.isArray(evidence)||evidence.length>100)throw new ApiError(400,'Initial evidence limit');const files=evidence.map(decodeAttachment);
    return this.db.transaction(async client=>{
      const{rows}=await client.query("SELECT role FROM company_members WHERE company_id=$1 AND subject=$2 FOR SHARE",[company,identity.subject]);
      if(rows[0]?.role!=='owner')throw new ApiError(403,'Company owner permission required');
      await client.query('INSERT INTO projects(id,company_id,document,accepted_revision) VALUES($1,$2,$3,$4)',[doc.projectId,company,JSON.stringify(doc),doc.revision]);
      for(const file of files)await client.query('INSERT INTO evidence VALUES($1,$2,$3,$4,$5)',[doc.projectId,file.id,file.mime,file.sha256,file.bytes]);await references(client,doc.projectId,doc);
      await client.query("INSERT INTO project_members VALUES($1,$2,'owner')",[doc.projectId,identity.subject]);
      await client.query('INSERT INTO revisions VALUES($1,$2,$3,$4)',[doc.projectId,doc.revision,JSON.stringify(doc),identity.subject]);return doc;
    });
  }
  async get(identity,projectId,action='read'){const permission=await access(this.db,identity,id(projectId),action);const{rows}=await this.db.query('SELECT document,accepted_revision,archived FROM projects WHERE id=$1',[projectId]);return{document:JSON.parse(rows[0].document),acceptedRevision:rows[0].accepted_revision,role:permission.role,archived:rows[0].archived};}
  async command(identity,projectId,command){
    return this.db.transaction(async client=>{
      const{rows}=await client.query('SELECT document,accepted_revision,archived FROM projects WHERE id=$1 FOR UPDATE',[id(projectId)]);
      if(!rows.length)throw new ApiError(404,'Project unavailable');
      await access(client,identity,projectId,['ImportObservations','RestoreFieldDraft'].includes(command.type)?'field':'design');
      const supported=['MoveDevice','ConnectCable','ApplyTopology','UpdateProjectDetails','ImportObservations','ApplyObservationDifferences','RestoreProjectDocument','RestoreFieldDraft'];
      if(!supported.includes(command.type))throw new ApiError(400,'Unsupported server command');
      const fingerprint=hash(JSON.stringify(command));
      const old=await client.query('SELECT fingerprint,result FROM commands WHERE project_id=$1 AND id=$2',[projectId,id(command.commandId)]);
      if(old.rows.length){if(old.rows[0].fingerprint!==fingerprint)throw new ApiError(409,'Command identity conflict');return{...JSON.parse(old.rows[0].result),duplicate:true};}
      if(rows[0].archived)throw new ApiError(409,'Archived project is read only');
      let document;try{const current=JSON.parse(rows[0].document);document=command.type==='RestoreFieldDraft'?domain.apply(current,{...command,type:'RestoreProjectDocument',payload:{document:domain.fieldDraft(current,command.payload.document,identity.subject)}}):domain.apply(current,command);}catch(error){throw new ApiError(409,error.message);}
      const result={document,acceptedRevision:document.revision,commandId:command.commandId};
      await references(client,projectId,document);
      await client.query('UPDATE projects SET document=$2,accepted_revision=$3 WHERE id=$1',[projectId,JSON.stringify(document),document.revision]);
      await client.query('INSERT INTO revisions VALUES($1,$2,$3,$4)',[projectId,document.revision,JSON.stringify(document),identity.subject]);
      await client.query('INSERT INTO commands VALUES($1,$2,$3,$4,$5,$6)',[projectId,command.commandId,fingerprint,document.revision,identity.subject,JSON.stringify(result)]);
      return result;
    });
  }
  async members(identity,projectId,subject,role){
    if(typeof subject!=='string'||!subject||subject.length>250||!['owner','designer','technician','viewer',null].includes(role))throw new ApiError(400,'Invalid membership');
    return this.db.transaction(async client=>{
      await client.query('SELECT id FROM projects WHERE id=$1 FOR UPDATE',[id(projectId)]);
      const permission=await access(client,identity,projectId,'admin');
      if(subject===identity.subject&&role!=='owner')throw new ApiError(409,'Owner cannot revoke their own access');
      const company=await client.query('SELECT subject FROM company_members WHERE company_id=$1 AND subject=$2',[permission.company_id,subject]);
      if(!company.rows.length)throw new ApiError(403,'Target is not a company member');
      if(role===null)await client.query('DELETE FROM project_members WHERE project_id=$1 AND subject=$2',[projectId,subject]);
      else await client.query('INSERT INTO project_members VALUES($1,$2,$3) ON CONFLICT(project_id,subject) DO UPDATE SET role=$3',[projectId,subject,role]);
    });
  }
  async listMembers(identity,projectId){await access(this.db,identity,id(projectId),'admin');return(await this.db.query('SELECT subject,role FROM project_members WHERE project_id=$1 ORDER BY subject',[projectId])).rows;}
  async listShares(identity,projectId){await access(this.db,identity,id(projectId),'admin');return(await this.db.query('SELECT hash AS id,expires_at,revoked FROM shares WHERE project_id=$1 ORDER BY expires_at DESC',[projectId])).rows;}
  async revisions(identity,projectId){await access(this.db,identity,id(projectId),'read');const{rows}=await this.db.query('SELECT revision,document FROM revisions WHERE project_id=$1 ORDER BY revision',[projectId]);return rows.map(row=>({revision:row.revision,document:JSON.parse(row.document)}));}
  async putEvidence(identity,projectId,attachment){
    const {bytes}=decodeAttachment(attachment);
    return this.db.transaction(async client=>{await access(client,identity,id(projectId),'field');
      const previous=await client.query('SELECT hash FROM evidence WHERE project_id=$1 AND id=$2',[projectId,attachment.id]);
      if(previous.rows[0]&&previous.rows[0].hash!==attachment.sha256)throw new ApiError(409,'Evidence identity conflict');
      await client.query('INSERT INTO evidence VALUES($1,$2,$3,$4,$5) ON CONFLICT(project_id,id) DO NOTHING',[projectId,attachment.id,attachment.mime,attachment.sha256,bytes]);return{sha256:attachment.sha256};});
  }
  async evidence(identity,projectId,evidenceId){await access(this.db,identity,id(projectId),'read');const{rows}=await this.db.query('SELECT mime,hash,bytes FROM evidence WHERE project_id=$1 AND id=$2',[projectId,id(evidenceId)]);if(!rows.length)throw new ApiError(404,'Evidence unavailable');return rows[0];}
  async share(identity,projectId,days=1){await access(this.db,identity,id(projectId),'admin');if(!Number.isInteger(days)||days<1||days>7)throw new ApiError(400,'Share duration must be 1-7 days');const token=randomBytes(32).toString('base64url');await this.db.query('INSERT INTO shares VALUES($1,$2,$3,FALSE)',[hash(token),projectId,new Date(Date.now()+days*86400000)]);return{token,shareId:hash(token)};}
  async revokeShare(identity,projectId,shareId){await access(this.db,identity,id(projectId),'admin');await this.db.query('UPDATE shares SET revoked=TRUE WHERE project_id=$1 AND hash=$2',[projectId,shareId]);}
  async shared(token){const{rows}=await this.db.query('SELECT p.document,p.accepted_revision FROM shares s JOIN projects p ON p.id=s.project_id WHERE s.hash=$1 AND NOT s.revoked AND NOT p.archived AND s.expires_at>NOW()',[hash(token)]);if(!rows.length)throw new ApiError(404,'Share unavailable');const doc=JSON.parse(rows[0].document);return{projectId:doc.projectId,revision:rows[0].accepted_revision,name:doc.metadata.name,topology:doc.topology};}
}
