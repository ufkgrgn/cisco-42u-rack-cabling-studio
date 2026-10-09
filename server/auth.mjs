import {jwtVerify,createRemoteJWKSet} from 'jose';
export class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
export function oidc({issuer,audience,jwks,keys}){
  if(!issuer||!audience||(!keys&&!jwks))throw new Error('OIDC issuer, audience and JWKS configuration required');
  const resolver=keys||createRemoteJWKSet(new URL(jwks));
  return async token=>{try{const {payload}=await jwtVerify(token,resolver,{issuer,audience,algorithms:['RS256','ES256'],requiredClaims:['sub','exp','iat']});if(typeof payload.sub!=='string'||payload.sub.length>250)throw new Error();return{subject:payload.sub,expiresAt:payload.exp*1000};}catch{throw new ApiError(401,'Authentication required');}};
}
export async function access(client,identity,projectId,action='read'){
  if(identity.expiresAt&&identity.expiresAt<=Date.now())throw new ApiError(401,'Authentication expired');
  const {rows}=await client.query('SELECT p.company_id,m.role FROM projects p JOIN project_members m ON m.project_id=p.id JOIN company_members c ON c.company_id=p.company_id AND c.subject=m.subject WHERE p.id=$1 AND m.subject=$2',[projectId,identity.subject]);
  if(!rows.length)throw new ApiError(404,'Project unavailable');
  const role=rows[0].role;
  const allowed={read:['owner','designer','technician','viewer'],export:['owner','designer','technician'],design:['owner','designer'],field:['owner','designer','technician'],annotate:['owner','designer','technician'],admin:['owner']};
  if(!allowed[action]?.includes(role))throw new ApiError(403,'Project permission denied');return rows[0];
}
export function id(value){if(typeof value!=='string'||!/^[a-zA-Z0-9_-]{1,160}$/.test(value))throw new ApiError(400,'Invalid identifier');return value;}
