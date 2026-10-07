/** Keep scene projection separate from one atomic, validated domain edit. */
export function installProjectCommandBridge(engine) {
  const state = engine.state;
  const load = engine.loadTopologyFromProject.bind(engine);
  engine.loadTopologyFromProject = function (project) {
    state.projectProjection = true;
    try { return load(project); }
    finally {
      state.projectProjection = false;
      // Refresh only the compatibility cache; projection must never create a domain command.
      if (state.projectDocument) {
        try { localStorage.setItem('cisco_rack_studio_3d_state', JSON.stringify({
          version: '3.2.0', projectDocument: state.projectDocument,
          rackHeightU: state.rackHeightU, racks: state.racks, activeRackId: state.activeRackId,
          devices: state.devices, cables: state.cables,
          portGeometryOverrides: state.projectDocument.topology.portGeometryOverrides || {}
        })); } catch (error) { state.lastCacheError = error.message; }
      }
    }
  };
  state.restoreProjectScene = project => engine.loadTopologyFromProject(project);
  const toast = engine.showToast.bind(engine);
  engine.showToast = function (...args) {
    if (state.projectBatchDepth > 0) { state.projectToasts.push(args); return; }
    return toast(...args);
  };
  engine.runProjectEdit = function (edit) {
      if (state.projectProjection) return edit();
      const nested = state.projectBatchDepth > 0;
      if (!nested) state.projectToasts = [];
      state.projectBatchDepth = (state.projectBatchDepth || 0) + 1;
      let result;
      try { result = edit(); }
      catch (error) {
        if (!nested) state.restoreProjectScene(window.RackStudio.ProjectDocument.capture(window.RackStudio.STATE));
        throw error;
      } finally { state.projectBatchDepth--; }
      if (!nested && !state.autoSave()) {
        state.projectToasts = [];
        engine.showToast(state.lastSaveError);
        return false;
      }
      if (!nested) for (const args of state.projectToasts.splice(0)) toast(...args);
      return result;
  };
  for (const name of ['mountDevice', 'removeDevice', 'moveDevice', 'connectPorts', 'updatePortConfig',
    'updateCable', 'removeCable', 'updateDeviceConfig', 'updateDeviceMetadata', 'setRackHeight', 'loadPresetMDF']) {
    const edit = engine[name]?.bind(engine);
    if (!edit) continue;
    engine[name] = function (...args) {
      if (name === 'setRackHeight' && args[1]?.preview) return edit(...args);
      return engine.runProjectEdit(() => edit(...args));
    };
  }
}
