import { ProjectV3, ProjectSchemaV3 } from './schemas';
import { calculateChecksum } from './export-import';

export interface WALEntry {
  seq?: number;
  projectId: string;
  revision: number;
  action: string;
  delta: any;
  checksum: string;
  timestamp: number;
}

export interface ProjectSnapshotRecord {
  projectId: string;
  revision: number;
  lastSeq: number;
  data: ProjectV3;
  checksum: string;
  timestamp: number;
}

export interface RecoveryResult {
  recovered: boolean;
  replayedCount: number;
  lastAction?: string;
  project: ProjectV3;
}

export class IndexedDBStorageEngine {
  private static DB_NAME = 'cisco-rack-studio-v3';
  private static DB_VERSION = 1;

  private dbPromise: Promise<IDBDatabase> | null = null;
  private writeQueue: Promise<any> = Promise.resolve();
  private checkpointTimer: any = null;
  private currentRevision = 0;
  private uncommittedWALCount = 0;

  constructor(private activeProjectId: string = 'current') {}

  /**
   * Initializes or returns the open IndexedDB instance.
   */
  public async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB is not available in the current environment.');
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(IndexedDBStorageEngine.DB_NAME, IndexedDBStorageEngine.DB_VERSION);

      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', { keyPath: 'projectId' });
        }
        if (!db.objectStoreNames.contains('wal')) {
          const walStore = db.createObjectStore('wal', { keyPath: 'seq', autoIncrement: true });
          walStore.createIndex('by_project_seq', ['projectId', 'seq']);
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB could not be opened.'));
    });

    return this.dbPromise;
  }

  /**
   * Enqueues an operation into the sequential async write queue (Mutex).
   */
  private runExclusive<T>(operation: (db: IDBDatabase) => Promise<T>): Promise<T> {
    const nextInQueue = this.writeQueue.then(async () => {
      const db = await this.getDB();
      return operation(db);
    });
    this.writeQueue = nextInQueue.catch(() => {});
    return nextInQueue;
  }

  /**
   * Writes a WAL entry immediately with high throughput.
   */
  public async logAction(action: string, delta: any, projectSnapshot: ProjectV3): Promise<number> {
    this.currentRevision++;
    this.uncommittedWALCount++;

    const timestamp = Date.now();
    const payloadStr = JSON.stringify({ action, delta, rev: this.currentRevision, timestamp });
    const checksum = await calculateChecksum(payloadStr);

    const entry: WALEntry = {
      projectId: this.activeProjectId,
      revision: this.currentRevision,
      action,
      delta,
      checksum,
      timestamp
    };

    const seq = await this.runExclusive(db => new Promise<number>((resolve, reject) => {
      const tx = db.transaction(['wal'], 'readwrite');
      const store = tx.objectStore('wal');
      const req = store.add(entry);

      tx.oncomplete = () => resolve(req.result as number);
      tx.onerror = () => reject(tx.error);
    }));

    // Trigger debounced checkpoint
    this.scheduleCheckpoint(projectSnapshot);

    // If WAL grows beyond 10 items without idle time, force immediate checkpoint
    if (this.uncommittedWALCount >= 10) {
      this.forceCheckpoint(projectSnapshot);
    }

    return seq;
  }

  /**
   * Schedules a debounced full snapshot checkpoint (1500ms inactivity).
   */
  private scheduleCheckpoint(project: ProjectV3): void {
    if (this.checkpointTimer) clearTimeout(this.checkpointTimer);
    this.checkpointTimer = setTimeout(() => {
      this.forceCheckpoint(project).catch(console.error);
    }, 1500);
  }

  /**
   * Internal checkpoint implementation executed within an active runExclusive transaction.
   */
  private async _doCheckpoint(db: IDBDatabase, project: ProjectV3): Promise<void> {
    const projectJson = JSON.stringify(project);
    const checksum = await calculateChecksum(projectJson);

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['snapshots', 'wal', 'meta'], 'readwrite');
      const snapStore = tx.objectStore('snapshots');
      const walStore = tx.objectStore('wal');
      const metaStore = tx.objectStore('meta');

      const record: ProjectSnapshotRecord = {
        projectId: this.activeProjectId,
        revision: this.currentRevision,
        lastSeq: 0,
        data: project,
        checksum,
        timestamp: Date.now()
      };

      snapStore.put(record);
      metaStore.put({ key: 'last_checkpoint', revision: this.currentRevision, timestamp: Date.now() });

      // Compaction: Clear committed WAL entries for this project
      const index = walStore.index('by_project_seq');
      const range = IDBKeyRange.bound([this.activeProjectId, 0], [this.activeProjectId, Number.MAX_SAFE_INTEGER]);
      const cursorReq = index.openCursor(range);

      cursorReq.onsuccess = (e: any) => {
        const cursor = e.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => {
        this.uncommittedWALCount = 0;
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Commits a full ProjectSchemaV3 snapshot and compacts (prunes) replayed WAL entries.
   */
  public forceCheckpoint(project: ProjectV3): Promise<void> {
    if (this.checkpointTimer) {
      clearTimeout(this.checkpointTimer);
      this.checkpointTimer = null;
    }

    return this.runExclusive(db => this._doCheckpoint(db, project));
  }

  /**
   * Crash Recovery: Replays outstanding WAL entries on top of the last snapshot.
   */
  public async recoverOnStartup(fallbackDefaultProject: ProjectV3): Promise<RecoveryResult> {
    return this.runExclusive(async db => {
      // 1. Fetch latest snapshot
      const snapshot: ProjectSnapshotRecord | null = await new Promise(res => {
        const tx = db.transaction(['snapshots'], 'readonly');
        const req = tx.objectStore('snapshots').get(this.activeProjectId);
        req.onsuccess = () => res(req.result || null);
        req.onerror = () => res(null);
      });

      let currentProject = snapshot ? snapshot.data : fallbackDefaultProject;
      if (snapshot) {
        this.currentRevision = snapshot.revision;
      }

      // 2. Fetch pending WAL entries
      const pendingWAL: WALEntry[] = await new Promise(res => {
        const tx = db.transaction(['wal'], 'readonly');
        const index = tx.objectStore('wal').index('by_project_seq');
        const range = IDBKeyRange.bound([this.activeProjectId, 0], [this.activeProjectId, Number.MAX_SAFE_INTEGER]);
        const req = index.getAll(range);
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => res([]);
      });

      if (pendingWAL.length === 0) {
        return {
          recovered: false,
          replayedCount: 0,
          project: currentProject
        };
      }

      // 3. Replay WAL entries sequentially
      let replayedCount = 0;
      let lastAction = '';

      for (const entry of pendingWAL) {
        // Integrity check
        const payloadStr = JSON.stringify({ action: entry.action, delta: entry.delta, rev: entry.revision, timestamp: entry.timestamp });
        const calcCheck = await calculateChecksum(payloadStr);
        if (calcCheck !== entry.checksum) {
          console.warn(`WAL integrity violation detected (Seq: ${entry.seq}). Aborting replay.`);
          break;
        }

        // Apply mutation
        currentProject = this.applyDelta(currentProject, entry.action, entry.delta);
        replayedCount++;
        lastAction = entry.action;
        this.currentRevision = entry.revision;
      }

      // 4. Checkpoint the recovered state and truncate WAL without re-entrant deadlock
      await this._doCheckpoint(db, currentProject);

      return {
        recovered: true,
        replayedCount,
        lastAction,
        project: currentProject
      };
    });
  }

  /**
   * Deterministic reducer to apply replayed WAL actions to the project.
   */
  private applyDelta(state: ProjectV3, action: string, delta: any): ProjectV3 {
    const copy: ProjectV3 = JSON.parse(JSON.stringify(state));
    switch (action) {
      case 'DEVICE_MOUNT': {
        const rack = copy.racks.find(r => r.id === delta.rackId);
        if (rack) {
          rack.devices.push(delta.device);
        }
        break;
      }
      case 'DEVICE_REMOVE': {
        for (const r of copy.racks) {
          r.devices = r.devices.filter(d => d.instanceId !== delta.instanceId);
        }
        copy.cables = copy.cables.filter(
          c => c.from.deviceInstanceId !== delta.instanceId && c.to.deviceInstanceId !== delta.instanceId
        );
        break;
      }
      case 'DEVICE_MOVE': {
        const targetRack = copy.racks.find(r => r.id === delta.targetRackId);
        for (const r of copy.racks) {
          const idx = r.devices.findIndex(d => d.instanceId === delta.instanceId);
          if (idx !== -1) {
            const [dev] = r.devices.splice(idx, 1);
            if (dev && targetRack) {
              dev.rackId = delta.targetRackId;
              dev.startU = delta.newStartU;
              if (delta.face) dev.face = delta.face;
              targetRack.devices.push(dev);
            }
            break;
          }
        }
        break;
      }
      case 'CABLE_ADD': {
        copy.cables.push(delta.cable);
        break;
      }
      case 'CABLE_REMOVE': {
        copy.cables = copy.cables.filter(c => c.id !== delta.cableId);
        break;
      }
      case 'RACK_RESIZE': {
        const rack = copy.racks.find(r => r.id === delta.rackId);
        if (rack) {
          rack.totalU = delta.newTotalU;
        }
        break;
      }
      case 'SNAPSHOT_SYNC': {
        return ProjectSchemaV3.parse(delta.project);
      }
      default:
        console.warn(`Unknown WAL action skipped: ${action}`);
    }
    return ProjectSchemaV3.parse(copy);
  }

  public close(): void {
    if (this.checkpointTimer) {
      clearTimeout(this.checkpointTimer);
      this.checkpointTimer = null;
    }
    if (this.dbPromise) {
      this.dbPromise.then(db => db.close()).catch(() => {});
      this.dbPromise = null;
    }
  }
}
