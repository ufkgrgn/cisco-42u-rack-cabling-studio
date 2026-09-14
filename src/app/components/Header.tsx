import React from 'react';
import { useProjectStore } from '../../core/state/projectStore';
import { useHistoryStore } from '../../core/state/historyStore';
import { exportProjectToJson, importProjectFromJson } from '../../core/persistence/export-import';
import { Server, RotateCcw, RotateCw, Download, Upload, Trash2 } from 'lucide-react';

export const Header: React.FC = () => {
  const { project, setProject, reset } = useProjectStore();
  const { undo, redo, canUndo, canRedo } = useHistoryStore();

  const handleExportJson = async () => {
    try {
      const json = await exportProjectToJson(project);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    }
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const content = reader.result as string;
      const res = await importProjectFromJson(content);
      if (res.success && res.project) {
        setProject(res.project);
      } else {
        const msg = res.errors?.map(err => `${err.path}: ${err.message}`).join('\n') || 'Unknown import error';
        alert(`Import rejected:\n${msg}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="h-14 bg-[#111827] border-b border-[#374151] flex items-center justify-between px-4 z-20 select-none">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded bg-[#049fd9] text-white">
          <Server className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-wide text-white flex items-center gap-2">
            Cisco 42U Digital Rack Studio
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1f2937] text-[#38bdf8] font-mono font-normal">
              EIA-310-D
            </span>
          </h1>
          <p className="text-[11px] text-gray-400">{project.name}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Undo / Redo */}
        <div className="flex items-center gap-1 border-r border-[#374151] pr-3 mr-1">
          <button
            onClick={() => undo()}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded hover:bg-[#1f2937] disabled:opacity-30 text-gray-300 disabled:cursor-not-allowed transition"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => redo()}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className="p-1.5 rounded hover:bg-[#1f2937] disabled:opacity-30 text-gray-300 disabled:cursor-not-allowed transition"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Import / Export / Reset */}
        <label
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs bg-[#1f2937] hover:bg-[#374151] text-gray-200 cursor-pointer transition border border-transparent hover:border-[#4b5563]"
          title="Import JSON Project"
        >
          <Upload className="w-3.5 h-3.5 text-[#38bdf8]" />
          <span>Import</span>
          <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
        </label>

        <button
          onClick={handleExportJson}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs bg-[#1f2937] hover:bg-[#374151] text-gray-200 transition border border-transparent hover:border-[#4b5563]"
          title="Export Signed Project JSON"
        >
          <Download className="w-3.5 h-3.5 text-[#10b981]" />
          <span>Export</span>
        </button>

        <button
          onClick={() => {
            if (confirm('Reset workspace to empty default rack?')) {
              reset();
            }
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs bg-[#1f2937] hover:bg-rose-950/60 text-rose-300 hover:text-rose-200 transition border border-transparent hover:border-rose-800"
          title="Reset Workspace"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>
    </header>
  );
};
