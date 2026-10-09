use base64::{engine::general_purpose::STANDARD, Engine};
use rusqlite::{params, Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{collections::{BTreeMap, HashSet}, fs, io::Write, path::PathBuf, sync::Mutex};

const STORES: &[&str] = &["projects", "log", "revisions", "evidence", "leases", "meta", "recovery"];
const MAX_ATTACHMENT: usize = 20 * 1024 * 1024;
#[derive(Clone, Serialize, Deserialize)]
pub struct Row { pub key: Value, pub value: Value }
#[derive(Serialize)]
pub struct Snapshot { pub version: i64, pub rows: BTreeMap<String, Vec<Row>> }
pub struct Repository { connection: Connection, root: PathBuf }
pub struct NativeRepository(pub Mutex<Repository>);
type Result<T> = std::result::Result<T, String>;
fn err(error: impl std::fmt::Display) -> String { error.to_string() }
fn stores_valid(stores: impl Iterator<Item = impl AsRef<str>>) -> Result<()> {
    for store in stores { if !STORES.contains(&store.as_ref()) { return Err("Unknown repository store".into()); } }
    Ok(())
}
fn digest(bytes: &[u8]) -> String { format!("{:x}", Sha256::digest(bytes)) }
fn valid_hash(hash: &str) -> bool { hash.len() == 64 && hash.bytes().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()) }

impl Repository {
    pub fn open(root: PathBuf) -> Result<Self> {
        fs::create_dir_all(root.join("attachments")).map_err(err)?;
        fs::create_dir_all(root.join("staging")).map_err(err)?;
        let mut connection = Connection::open(root.join("projects.sqlite3")).map_err(err)?;
        connection.busy_timeout(std::time::Duration::from_secs(5)).map_err(err)?;
        connection.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;").map_err(err)?;
        let tx = connection.transaction_with_behavior(TransactionBehavior::Immediate).map_err(err)?;
        let version: i64 = tx.query_row("PRAGMA user_version", [], |row| row.get(0)).map_err(err)?;
        if version > 1 { return Err("Unsupported repository migration version".into()); }
        if version == 0 {
            tx.execute_batch(include_str!("../migrations/001_repository.sql")).map_err(err)?;
        }
        tx.commit().map_err(err)?;
        let mut repository = Self { connection, root };
        repository.reconcile()?;
        Ok(repository)
    }
    pub fn snapshot(&mut self, stores: Vec<String>) -> Result<Snapshot> {
        stores_valid(stores.iter())?;
        let tx = self.connection.transaction().map_err(err)?;
        let version = tx.query_row("SELECT version FROM repository_state WHERE id=1", [], |row| row.get(0)).map_err(err)?;
        let mut rows = BTreeMap::new();
        for store in stores {
            let mut statement = tx.prepare("SELECT key_json,value_json FROM records WHERE store=?1 ORDER BY key_json").map_err(err)?;
            let raw = statement.query_map([&store], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))).map_err(err)?;
            let mut values = Vec::new();
            for item in raw {
                let (key, value) = item.map_err(err)?;
                let mut value: Value = serde_json::from_str(&value).map_err(err)?;
                if store == "evidence" {
                    let hash = value.get("fileHash").and_then(Value::as_str).ok_or("Missing attachment hash")?;
                    if !valid_hash(hash) { return Err("Invalid attachment hash".into()); }
                    let final_path = self.root.join("attachments").join(hash);
                    let bytes = fs::read(if final_path.exists() { final_path } else { self.root.join("staging").join(hash) }).map_err(err)?;
                    if digest(&bytes) != hash { return Err("Attachment integrity failure".into()); }
                    value.as_object_mut().ok_or("Invalid attachment")?.insert("data".into(), Value::String(STANDARD.encode(bytes)));
                    value.as_object_mut().unwrap().remove("fileHash");
                }
                values.push(Row { key: serde_json::from_str(&key).map_err(err)?, value });
            }
            rows.insert(store, values);
        }
        tx.commit().map_err(err)?;
        Ok(Snapshot { version, rows })
    }
    pub fn commit(&mut self, expected: i64, mut rows: BTreeMap<String, Vec<Row>>) -> Result<()> {
        stores_valid(rows.keys())?;
        // Attachment data is validated before changing any durable DB reference.
        let mut files = BTreeMap::new();
        for (store, entries) in &mut rows {
            let mut keys = HashSet::new();
            for row in entries {
                if !row.key.is_string() && !row.key.is_array() { return Err("Invalid repository key".into()); }
                if !keys.insert(row.key.to_string()) { return Err("Duplicate repository key".into()); }
                if store == "evidence" {
                    let value = row.value.as_object_mut().ok_or("Invalid attachment")?;
                    let data = value.remove("data").ok_or("Missing attachment data")?;
                    let data = data.as_str().ok_or("Invalid attachment data")?;
                    if data.len() > 28 * 1024 * 1024 { return Err("Attachment size limit".into()); }
                    let bytes = STANDARD.decode(data).map_err(err)?;
                    if bytes.len() > MAX_ATTACHMENT { return Err("Attachment size limit".into()); }
                    let hash = digest(&bytes);
                    if value.get("sha256").and_then(Value::as_str) != Some(hash.as_str()) { return Err("Attachment hash mismatch".into()); }
                    value.insert("fileHash".into(), Value::String(hash.clone()));
                    files.insert(hash, bytes);
                }
            }
        }
        let tx = self.connection.transaction_with_behavior(TransactionBehavior::Immediate).map_err(err)?;
        let version: i64 = tx.query_row("SELECT version FROM repository_state WHERE id=1", [], |row| row.get(0)).map_err(err)?;
        if version != expected { return Err("Repository conflict: reload the durable project".into()); }
        for (hash, bytes) in &files {
            let final_path = self.root.join("attachments").join(hash);
            if final_path.exists() {
                if digest(&fs::read(&final_path).map_err(err)?) != *hash { return Err("Attachment integrity failure".into()); }
            } else {
                let staged = self.root.join("staging").join(hash);
                let mut file = fs::File::create(&staged).map_err(err)?;
                file.write_all(bytes).map_err(err)?;
                file.sync_all().map_err(err)?;
            }
        }
        for (store, entries) in rows {
            tx.execute("DELETE FROM records WHERE store=?1", [&store]).map_err(err)?;
            for row in entries {
                tx.execute("INSERT INTO records(store,key_json,value_json) VALUES (?1,?2,?3)", params![store, row.key.to_string(), row.value.to_string()]).map_err(err)?;
            }
        }
        tx.execute("UPDATE repository_state SET version=version+1 WHERE id=1", []).map_err(err)?;
        tx.commit().map_err(err)?;
        // If interrupted here, startup finalizes every committed staged attachment.
        self.reconcile()
    }
    fn reconcile(&mut self) -> Result<()> {
        // Hold the writer lock while checking references and deleting unreferenced managed files.
        let tx = self.connection.transaction_with_behavior(TransactionBehavior::Immediate).map_err(err)?;
        let mut hashes = HashSet::new();
        {
            let mut statement = tx.prepare("SELECT value_json FROM records WHERE store='evidence'").map_err(err)?;
            for value in statement.query_map([], |row| row.get::<_, String>(0)).map_err(err)? {
                let value: Value = serde_json::from_str(&value.map_err(err)?).map_err(err)?;
                let hash = value.get("fileHash").and_then(Value::as_str).ok_or("Missing attachment hash")?;
                if !valid_hash(hash) { return Err("Invalid attachment hash".into()); }
                hashes.insert(hash.to_owned());
            }
        }
        for hash in &hashes {
            let final_path = self.root.join("attachments").join(hash);
            let staged = self.root.join("staging").join(hash);
            if !final_path.exists() {
                let bytes = fs::read(&staged).map_err(err)?;
                if digest(&bytes) != *hash { return Err("Staged attachment integrity failure".into()); }
                fs::rename(&staged, &final_path).map_err(err)?;
            }
            if digest(&fs::read(final_path).map_err(err)?) != *hash { return Err("Attachment integrity failure".into()); }
        }
        for directory in ["staging", "attachments"] {
            for entry in fs::read_dir(self.root.join(directory)).map_err(err)? {
                let entry = entry.map_err(err)?;
                let name = entry.file_name().to_string_lossy().into_owned();
                if valid_hash(&name) && entry.file_type().map_err(err)?.is_file()
                    && (directory == "staging" || !hashes.contains(&name)) {
                    fs::remove_file(entry.path()).map_err(err)?;
                }
            }
        }
        tx.commit().map_err(err)
    }
}

#[tauri::command]
pub fn repository_snapshot(state: tauri::State<NativeRepository>, stores: Vec<String>) -> Result<Snapshot> {
    state.0.lock().map_err(|_| "Repository lock unavailable")?.snapshot(stores)
}
#[tauri::command]
pub fn repository_commit(state: tauri::State<NativeRepository>, expected: i64, rows: BTreeMap<String, Vec<Row>>) -> Result<()> {
    state.0.lock().map_err(|_| "Repository lock unavailable")?.commit(expected, rows)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn root() -> PathBuf {
        std::env::temp_dir().join(format!("rack-studio-test-{}-{}", std::process::id(), std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()))
    }
    fn rows(store: &str, value: Value) -> BTreeMap<String, Vec<Row>> {
        BTreeMap::from([(store.into(), vec![Row { key: json!("fixture"), value }])])
    }
    #[test]
    fn atomic_conflict_and_reopen() {
        let root = root();
        {
            let mut first = Repository::open(root.clone()).unwrap();
            let mut second = Repository::open(root.clone()).unwrap();
            first.commit(0, rows("projects", json!({"document":{"projectId":"fixture"}}))).unwrap();
            assert!(second.commit(0, rows("projects", json!({"lost":true}))).unwrap_err().contains("conflict"));
            let state = second.snapshot(vec!["projects".into()]).unwrap();
            assert_eq!(state.version, 1);
            assert_eq!(state.rows["projects"][0].value["document"]["projectId"], "fixture");
            assert!(first.commit(1, rows("invalid", json!(null))).is_err());
            // Invalid evidence rejects the entire batch, including its project head.
            let mut batch = rows("projects", json!({"lost":true}));
            batch.extend(rows("evidence", json!({"data":"aGVsbG8=", "sha256":"incorrect"})));
            assert!(first.commit(1, batch).is_err());
        }
        {
            let mut reopened = Repository::open(root.clone()).unwrap();
            assert_eq!(reopened.snapshot(vec!["projects".into()]).unwrap().version, 1);
        }
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn staged_commit_recovery_and_orphan_cleanup() {
        let root = root(); let hash = digest(b"hello"); let orphan = digest(b"orphan");
        {
            let mut repository = Repository::open(root.clone()).unwrap();
            repository.commit(0, rows("evidence", json!({"data":"aGVsbG8=", "sha256":hash,"mime":"text/plain"}))).unwrap();
            // Recreate shutdown after SQL commit, before attachment finalization.
            fs::rename(root.join("attachments").join(&hash), root.join("staging").join(&hash)).unwrap();
            fs::write(root.join("staging").join(&orphan), b"orphan").unwrap();
            fs::write(root.join("attachments").join(&orphan), b"orphan").unwrap();
        }
        {
            let mut repository = Repository::open(root.clone()).unwrap();
            let snapshot = repository.snapshot(vec!["evidence".into()]).unwrap();
            assert_eq!(snapshot.rows["evidence"][0].value["data"], "aGVsbG8=");
            assert!(root.join("attachments").join(&hash).exists());
            assert!(!root.join("staging").join(&orphan).exists());
            assert!(!root.join("attachments").join(&orphan).exists());
        }
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn migration_rollback_and_future_schema_rejection() {
        let root = root(); fs::create_dir_all(&root).unwrap();
        {
            let connection = Connection::open(root.join("projects.sqlite3")).unwrap();
            connection.execute_batch("BEGIN; CREATE TABLE interrupted(x); PRAGMA user_version=1; ROLLBACK;").unwrap();
        }
        {
            let repository = Repository::open(root.clone()).unwrap();
            assert_eq!(repository.connection.query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0)).unwrap(), 1);
            repository.connection.execute_batch("PRAGMA user_version=99;").unwrap();
        }
        assert!(Repository::open(root.clone()).is_err());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn corrupted_attachment_blocks_open_without_erasing_files() {
        let root = root(); let hash = digest(b"hello");
        {
            let mut repository = Repository::open(root.clone()).unwrap();
            repository.commit(0, rows("evidence", json!({"data":"aGVsbG8=", "sha256":hash,"mime":"text/plain"}))).unwrap();
        }
        fs::write(root.join("attachments").join(&hash), b"bad").unwrap();
        assert!(Repository::open(root.clone()).is_err());
        assert!(root.join("attachments").join(&hash).exists());
        fs::remove_dir_all(root).unwrap();
    }
}
