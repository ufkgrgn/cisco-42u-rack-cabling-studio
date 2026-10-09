use serde_json::Value;
#[tauri::command]
pub async fn workspace_request(path:String,method:String,body:Value,token:String)->Result<Value,String>{
    if token.is_empty()||token.len()>16384||token.contains(['\r','\n']){return Err("Invalid workspace token".into());}
    // This local development transport never forwards credentials to arbitrary hosts.
    if !path.starts_with("/projects")||path.contains(['?','#','\\'])||path.contains("..")||path.len()>1000{return Err("Invalid workspace route".into());}
    let method=match method.as_str(){"GET"=>reqwest::Method::GET,"POST"=>reqwest::Method::POST,"PUT"=>reqwest::Method::PUT,"DELETE"=>reqwest::Method::DELETE,_=>return Err("Invalid workspace method".into())};
    if body.to_string().len()>32*1024*1024{return Err("Workspace request limit".into());}
    let client=reqwest::Client::builder().redirect(reqwest::redirect::Policy::none()).timeout(std::time::Duration::from_secs(15)).build().map_err(|_|"Workspace client unavailable")?;
    let mut request=client.request(method,format!("http://127.0.0.1:8787/api{path}")).bearer_auth(token);
    if !body.is_null(){request=request.json(&body);}
    let mut response=request.send().await.map_err(|_|"Local workspace unavailable")?;let status=response.status();let mut bytes=Vec::new();
    while let Some(chunk)=response.chunk().await.map_err(|_|"Workspace response interrupted")?{if bytes.len()+chunk.len()>48*1024*1024{return Err("Workspace response limit".into());}bytes.extend_from_slice(&chunk);}
    let value:Value=serde_json::from_slice(&bytes).map_err(|_|"Invalid workspace response")?;
    if !status.is_success(){return Err(format!("Workspace HTTP {}: {}",status.as_u16(),value["error"].as_str().unwrap_or("Request rejected")));}Ok(value)
}
