fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "repository_snapshot", "repository_commit", "repository_secret",
            "netbox_configure", "netbox_get", "netbox_forget",
            "catalog_rerank",
            "workspace_request",
        ]),
    )).expect("Tauri capability generation failed");
}
