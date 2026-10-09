#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(netbox_transport::NetBoxConnection(std::sync::Mutex::new(None)))
        .setup(|app| {
            let root = app.path().app_data_dir()?.join("project-repository");
            let repository = project_repository::Repository::open(root)
                .map_err(std::io::Error::other)?;
            app.manage(project_repository::NativeRepository(std::sync::Mutex::new(repository)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![project_repository::repository_snapshot,
            project_repository::repository_commit, native_secrets::repository_secret,
            netbox_transport::netbox_configure,netbox_transport::netbox_get,netbox_transport::netbox_forget,catalog_reranker::catalog_rerank,
            workspace_transport::workspace_request])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
mod project_repository;
mod native_secrets;
mod netbox_transport;
mod catalog_reranker;
mod workspace_transport;
use tauri::Manager;
