import {access,ApiError,id} from './auth.mjs';
export async function lifecycle(database,identity,projectId,options){
  id(projectId);const keep=options.keepRevisions??100;if(!Number.isInteger(keep)||keep<1||keep>1000)throw new ApiError(400,'Retention must be 1-1000');
  return database.transaction(async client=>{
    const{rows}=await client.query('SELECT document,archived FROM projects WHERE id=$1 FOR UPDATE',[projectId]);await access(client,identity,projectId,'admin');const head=rows[0],document=JSON.parse(head.document);
    if(options.remove){if(!head.archived||options.confirmation!==document.metadata.name||!options.confirmation)throw new ApiError(409,'Archive and exact project-name confirmation required');await client.query('DELETE FROM projects WHERE id=$1',[projectId]);return{removed:true};}
    if(typeof options.archived==='boolean'){await client.query('UPDATE projects SET archived=$2 WHERE id=$1',[projectId,options.archived]);if(options.archived)await client.query('UPDATE shares SET revoked=TRUE WHERE project_id=$1',[projectId]);return{archived:options.archived};}
    const removed=await client.query('DELETE FROM revisions WHERE project_id=$1 AND revision NOT IN (SELECT revision FROM revisions WHERE project_id=$1 ORDER BY revision DESC LIMIT $2) RETURNING revision',[projectId,keep]);
    const references=new Set(),collect=doc=>{for(const ref of doc.evidenceRefs||[])if(ref.blobId)references.add(ref.blobId);};collect(document);
    const revisions=await client.query('SELECT document FROM revisions WHERE project_id=$1',[projectId]);for(const row of revisions.rows)collect(JSON.parse(row.document));
    // Idempotent command receipts retain their original accepted document and evidence.
    const commands=await client.query('SELECT result FROM commands WHERE project_id=$1',[projectId]);for(const row of commands.rows)collect(JSON.parse(row.result).document);
    const evidence=await client.query('SELECT id FROM evidence WHERE project_id=$1',[projectId]);let count=0;for(const row of evidence.rows)if(!references.has(row.id)){await client.query('DELETE FROM evidence WHERE project_id=$1 AND id=$2',[projectId,row.id]);count++;}
    return{revisions:removed.rows.length,evidence:count};
  });
}
