use serde::{Deserialize,Serialize};
use serde_json::{json,Value};
#[derive(Deserialize)]
pub struct Candidate{ id:String,model:String,name:String,description:String,source:Option<Value> }
#[derive(Serialize)]
pub struct Ranked{ scores:Vec<Value>,model:String,usage:Value }
fn request(query:&str,candidates:&[Candidate])->Result<Value,String>{
    if query.is_empty()||query.len()>1000||candidates.is_empty()||candidates.len()>20{return Err("Invalid catalog shortlist".into());}
    let mut questions=serde_json::Map::new();let mut ids=std::collections::HashSet::new();let mut state=Vec::new();
    for(index,candidate)in candidates.iter().enumerate(){
        if candidate.id.len()>160||!ids.insert(&candidate.id)||candidate.model.len()>500||candidate.name.len()>500||candidate.description.len()>2000||candidate.source.as_ref().is_some_and(|value|value.to_string().len()>4000){return Err("Invalid catalog candidate".into());}
        state.push(json!({"id":candidate.id,"model":candidate.model,"name":candidate.name,"description":candidate.description,"source":candidate.source}));
        questions.insert(format!("candidate_{index}"),json!({"type":"noul","instructions":format!("Does `candidates[{index}]` match the user's hardware request in `query`? Use only supplied catalog facts. Unknown required specifications are not a match. Do not infer compatibility or invent hardware specifications."),"criteria":{"true":"Candidate satisfies the request based on supplied catalog evidence","false":"Candidate is irrelevant, incompatible, or lacks required evidence"}}));
    }
    Ok(json!({"model":"jev-latest","state":{"query":query,"candidates":state},"questions":questions}))
}
#[tauri::command]
pub async fn catalog_rerank(query:String,candidates:Vec<Candidate>)->Result<Ranked,String>{
    let body=request(&query,&candidates)?;
    #[cfg(windows)]
    let secret=keyring::Entry::new("rack-studio.integrations","jev").map_err(|_|"Credential store unavailable")?.get_password().map_err(|_|"AI credential unavailable")?;
    #[cfg(not(windows))]
    let secret=String::new();
    let client=reqwest::Client::builder().redirect(reqwest::redirect::Policy::none()).timeout(std::time::Duration::from_millis(1500)).build().map_err(|_|"AI client unavailable")?;
    let response=client.post("https://api.typesafe.ai/v1/systemone").bearer_auth(secret).json(&body).send().await.map_err(|_|"AI network timeout or failure")?;
    if !response.status().is_success(){return Err(format!("AI HTTP {}",response.status().as_u16()));}
    let mut response=response;let mut bytes=Vec::new();
    while let Some(chunk)=response.chunk().await.map_err(|_|"AI response interrupted")?{if bytes.len()+chunk.len()>256*1024{return Err("AI response limit".into());}bytes.extend_from_slice(&chunk);}
    let response:Value=serde_json::from_slice(&bytes).map_err(|_|"Invalid AI response")?;let mut scores=Vec::new();
    for(index,candidate)in candidates.iter().enumerate(){let answer=&response["answers"][format!("candidate_{index}")];let score=answer["noul"].as_f64().ok_or("Missing AI score")?;
        if answer["type"]!="noul"||!(0.0..=1.0).contains(&score){return Err("Invalid AI score".into());}scores.push(json!({"id":candidate.id,"score":score}));}
    Ok(Ranked{scores,model:response["model"].as_str().unwrap_or("unknown").into(),usage:response["usage"].clone()})
}
#[cfg(test)]mod tests{use super::*;#[test]fn only_shortlisted_public_catalog_is_sent(){
    let candidate=Candidate{id:"model".into(),model:"MODEL".into(),name:"Switch".into(),description:"24 ports".into(),source:None};
    let body=request("24 port switch",&[candidate]).unwrap();assert_eq!(body["state"]["candidates"].as_array().unwrap().len(),1);assert!(body["state"].get("project").is_none());assert!(request("",&[]).is_err());
}}
