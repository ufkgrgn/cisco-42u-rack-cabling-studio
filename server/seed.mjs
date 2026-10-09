import {postgres,migrate} from './database.mjs';
import {id} from './auth.mjs';
const company=id(process.env.WORKSPACE_COMPANY),subject=process.env.WORKSPACE_SUBJECT,role=process.env.WORKSPACE_COMPANY_ROLE||'owner';
if(!subject||subject.length>250||!['owner','member'].includes(role)||!process.env.DATABASE_URL)throw new Error('Set DATABASE_URL, WORKSPACE_COMPANY, WORKSPACE_SUBJECT and optional WORKSPACE_COMPANY_ROLE');
const db=postgres(process.env.DATABASE_URL);
try{await migrate(db);await db.transaction(async client=>{await client.query('INSERT INTO companies VALUES($1,$2) ON CONFLICT(id) DO NOTHING',[company,process.env.WORKSPACE_COMPANY_NAME||company]);await client.query('INSERT INTO company_members VALUES($1,$2,$3) ON CONFLICT(company_id,subject) DO UPDATE SET role=$3',[company,subject,role]);});console.log('Company membership configured.');}finally{await db.close();}
