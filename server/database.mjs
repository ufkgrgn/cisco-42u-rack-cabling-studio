import {Pool} from 'pg';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export function postgres(connectionString){
  const pool=new Pool({connectionString,max:10});
  return{query:(...args)=>pool.query(...args),async transaction(work){const client=await pool.connect();try{await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}},close:()=>pool.end()};
}
export async function migrate(database){const source=await readFile(new URL('./migrations/001_workspace.sql',import.meta.url),'utf8'),fingerprint=createHash('sha256').update(source).digest('hex');await database.transaction(async client=>{
  await client.query('CREATE TABLE IF NOT EXISTS workspace_schema(version INTEGER PRIMARY KEY, fingerprint TEXT NOT NULL)');
  await client.query('LOCK TABLE workspace_schema IN EXCLUSIVE MODE');
  const{rows}=await client.query('SELECT version,fingerprint FROM workspace_schema ORDER BY version');
  if(rows.some(row=>row.version!==1)||rows[0]&&rows[0].fingerprint!==fingerprint)throw new Error('Unsupported or modified workspace migration; preserve database and restore matching release');
  if(!rows.length){await client.query(source);await client.query('INSERT INTO workspace_schema VALUES($1,$2)',[1,fingerprint]);}
});}
