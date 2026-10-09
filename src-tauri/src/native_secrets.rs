// Credentials are scoped to this application and never read back into the webview.
#[tauri::command]
pub fn repository_secret(provider: String, action: String, secret: Option<String>) -> Result<bool, String> {
    if !["netbox", "jev"].contains(&provider.as_str()) { return Err("Unsupported credential provider".into()); }
    #[cfg(windows)]
    {
        let entry = keyring::Entry::new("rack-studio.integrations", &provider).map_err(|_| "Credential store unavailable")?;
        match action.as_str() {
            "set" => {
                let secret = secret.ok_or("Missing credential")?;
                if secret.is_empty() || secret.len() > 4096 { return Err("Invalid credential length".into()); }
                entry.set_password(&secret).map_err(|_| "Credential write failed")?;
                Ok(true)
            }
            "remove" => match entry.delete_credential() {
                Ok(()) | Err(keyring::Error::NoEntry) => Ok(false),
                Err(_) => Err("Credential removal failed".into())
            },
            "status" => match entry.get_password() {
                Ok(_) => Ok(true), Err(keyring::Error::NoEntry) => Ok(false),
                Err(_) => Err("Credential read failed".into())
            },
            _ => Err("Unsupported credential action".into())
        }
    }
    #[cfg(not(windows))]
    { let _ = (action, secret); Err("Native credentials are supported on Windows only".into()) }
}
