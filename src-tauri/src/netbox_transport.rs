use reqwest::{Client, Url};
use serde_json::Value;
use std::sync::Mutex;
pub struct NetBoxConnection(pub Mutex<Option<String>>);
fn base(value: &str) -> Result<Url,String> {
    let mut url=Url::parse(value).map_err(|_|"Invalid NetBox address")?;
    if url.scheme()!="https" || !url.username().is_empty() || url.password().is_some() || url.query().is_some() || url.fragment().is_some() {
        return Err("NetBox requires an HTTPS address without credentials".into());
    }
    url.set_path(&format!("{}/",url.path().trim_end_matches('/')));
    Ok(url)
}
fn page(base_url:&str,value:&str)->Result<Url,String>{
    let base=base(base_url)?;let url=Url::parse(value).map_err(|_|"Invalid NetBox page")?;
    let allowed=["sites","racks","devices","interfaces","cables"].map(|name|format!("{}api/dcim/{name}/",base.path()));
    if url.origin()!=base.origin() || !allowed.contains(&url.path().to_owned()) || !url.username().is_empty() || url.password().is_some() || url.fragment().is_some(){return Err("NetBox page outside configured scope".into());}
    Ok(url)
}
#[tauri::command]
pub fn netbox_configure(state:tauri::State<NetBoxConnection>,base_url:String,secret:String)->Result<(),String>{
    let url=base(&base_url)?.to_string();
    if secret.len()>4096 || secret.contains(['\r','\n']){return Err("Invalid NetBox credential".into());}
    #[cfg(windows)]
    {
        let entry=keyring::Entry::new("rack-studio.netbox",&url).map_err(|_|"Credential store unavailable")?;
        if secret.is_empty(){entry.get_password().map_err(|_|"NetBox credential unavailable")?;}else{entry.set_password(&secret).map_err(|_|"Credential write failed")?;}
        *state.0.lock().map_err(|_|"NetBox lock unavailable")?=Some(url);
        Ok(())
    }
    #[cfg(not(windows))]
    {let _=(state,url,secret);Err("Native NetBox credentials require Windows".into())}
}
#[tauri::command]
pub fn netbox_forget(state:tauri::State<NetBoxConnection>,base_url:String)->Result<(),String>{
    let url=base(&base_url)?.to_string();
    #[cfg(windows)]
    {match keyring::Entry::new("rack-studio.netbox",&url).map_err(|_|"Credential store unavailable")?.delete_credential(){Ok(())|Err(keyring::Error::NoEntry)=>{},Err(_)=>return Err("Credential removal failed".into())};let mut configured=state.0.lock().map_err(|_|"NetBox lock unavailable")?;if configured.as_deref()==Some(&url){*configured=None;}Ok(())}
    #[cfg(not(windows))]
    {let _=(state,url);Err("Native NetBox credentials require Windows".into())}
}
#[tauri::command]
pub async fn netbox_get(state:tauri::State<'_,NetBoxConnection>,url:String)->Result<Value,String>{
    let configured=state.0.lock().map_err(|_|"NetBox lock unavailable")?.clone().ok_or("Configure NetBox first")?;
    let url=page(&configured,&url)?;
    #[cfg(windows)]
    let secret=keyring::Entry::new("rack-studio.netbox",&configured).map_err(|_|"Credential store unavailable")?
        .get_password().map_err(|_|"NetBox credential unavailable")?;
    #[cfg(not(windows))]
    let secret=String::new();
    let client=Client::builder().redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(15)).build().map_err(|_|"NetBox client unavailable")?;
    let response=client.get(url).header("Authorization",format!("Token {secret}")).header("Accept","application/json")
        .send().await.map_err(|_|"NetBox network failure or timeout")?;
    if !response.status().is_success(){return Err(format!("NetBox HTTP {}",response.status().as_u16()));}
    if response.content_length().is_some_and(|size|size>8*1024*1024){return Err("NetBox response too large".into());}
    // Stream the body with a strict bound, including chunked responses without Content-Length.
    let mut response=response;let mut bytes=Vec::new();
    while let Some(chunk)=response.chunk().await.map_err(|_|"NetBox response interrupted")?{
        if bytes.len()+chunk.len()>8*1024*1024{return Err("NetBox response too large".into());}bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes).map_err(|_|"Invalid NetBox JSON".into())
}
#[cfg(test)]
mod tests{
    use super::*;
    #[test]fn scope_rejects_secret_redirect_targets_and_write_routes(){
        assert!(base("http://example.com").is_err());assert!(base("https://token@example.com").is_err());
        assert!(page("https://example.com/netbox","https://evil.test/netbox/api/dcim/devices/").is_err());
        assert!(page("https://example.com/netbox","https://example.com/netbox/api/users/tokens/").is_err());
        assert!(page("https://example.com/netbox","https://example.com/netbox/api/dcim/devices/1/").is_err());
        assert!(page("https://example.com/netbox","https://example.com/netbox/api/dcim/devices/?offset=200").is_ok());
    }
}
