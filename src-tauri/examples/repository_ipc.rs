// Headless native IPC fixture used by the frontend contract tests; no production command.
#[path = "../src/project_repository.rs"]
mod project_repository;
use std::io::{self, Read};
fn main() {
    let result = (|| -> Result<serde_json::Value, String> {
        let root = std::env::args().nth(1).ok_or("Missing fixture directory")?;
        let mut input = String::new(); io::stdin().read_to_string(&mut input).map_err(|e| e.to_string())?;
        let input: serde_json::Value = serde_json::from_str(&input).map_err(|e| e.to_string())?;
        let mut repository = project_repository::Repository::open(root.into())?;
        let args = &input["args"];
        match input["command"].as_str() {
            Some("repository_snapshot") => serde_json::to_value(repository.snapshot(serde_json::from_value(args["stores"].clone()).map_err(|e| e.to_string())?)?).map_err(|e| e.to_string()),
            Some("repository_commit") => {
                repository.commit(args["expected"].as_i64().ok_or("Invalid version")?, serde_json::from_value(args["rows"].clone()).map_err(|e| e.to_string())?)?;
                Ok(serde_json::Value::Null)
            }
            _ => Err("Unsupported fixture operation".into())
        }
    })();
    println!("{}", match result { Ok(value) => serde_json::json!({"value":value}), Err(error) => serde_json::json!({"error":error}) });
}
