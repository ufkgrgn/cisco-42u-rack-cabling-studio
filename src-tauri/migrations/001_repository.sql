CREATE TABLE records (
    store TEXT NOT NULL CHECK(store IN ('projects','log','revisions','evidence','leases','meta','recovery')),
    key_json TEXT NOT NULL CHECK(json_valid(key_json)),
    value_json TEXT NOT NULL CHECK(json_valid(value_json)),
    PRIMARY KEY(store,key_json)
);
CREATE TABLE repository_state (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL);
INSERT INTO repository_state VALUES (1,0);
PRAGMA user_version=1;
