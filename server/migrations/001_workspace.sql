CREATE TABLE IF NOT EXISTS companies(id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS company_members(company_id TEXT REFERENCES companies(id), subject TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','member')), PRIMARY KEY(company_id,subject));
CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, company_id TEXT REFERENCES companies(id), document TEXT NOT NULL, accepted_revision INTEGER NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE);
CREATE TABLE IF NOT EXISTS project_members(project_id TEXT REFERENCES projects(id) ON DELETE CASCADE, subject TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','designer','technician','viewer')), PRIMARY KEY(project_id,subject));
CREATE TABLE IF NOT EXISTS commands(project_id TEXT REFERENCES projects(id) ON DELETE CASCADE, id TEXT NOT NULL, fingerprint TEXT NOT NULL, accepted_revision INTEGER NOT NULL, actor TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(project_id,id));
CREATE TABLE IF NOT EXISTS revisions(project_id TEXT REFERENCES projects(id) ON DELETE CASCADE, revision INTEGER NOT NULL, document TEXT NOT NULL, actor TEXT NOT NULL, PRIMARY KEY(project_id,revision));
CREATE TABLE IF NOT EXISTS evidence(project_id TEXT REFERENCES projects(id) ON DELETE CASCADE, id TEXT NOT NULL, mime TEXT NOT NULL, hash TEXT NOT NULL, bytes BYTEA NOT NULL, PRIMARY KEY(project_id,id));
CREATE TABLE IF NOT EXISTS annotations(project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE, state BYTEA NOT NULL);
CREATE TABLE IF NOT EXISTS shares(hash TEXT PRIMARY KEY, project_id TEXT REFERENCES projects(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL, revoked BOOLEAN NOT NULL DEFAULT FALSE);
