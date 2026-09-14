import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Toolbar } from './components/Toolbar';
import { Viewport } from './components/Viewport';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { setupKeyboardShortcuts } from '../core/state/historyStore';
import { IndexedDBStorageEngine } from '../core/persistence/indexeddb';
import { useProjectStore, DEFAULT_INITIAL_PROJECT } from '../core/state/projectStore';

export const App: React.FC = () => {
  const [sidebarTab, setSidebarTab] = useState<'catalog' | 'wizard' | 'schedule' | 'inspector'>('catalog');
  const { setProject } = useProjectStore();

  // 1. Keyboard shortcuts (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z)
  useEffect(() => {
    const cleanup = setupKeyboardShortcuts();
    return cleanup;
  }, []);

  // 2. Startup crash recovery from IndexedDB WAL
  useEffect(() => {
    if (typeof indexedDB === 'undefined') return;

    const storage = new IndexedDBStorageEngine('current');
    storage
      .recoverOnStartup(DEFAULT_INITIAL_PROJECT)
      .then((res) => {
        if (res.recovered && res.project) {
          console.log(`WAL Crash Recovery: Replayed ${res.replayedCount} operations.`);
          setProject(res.project);
        }
      })
      .catch(console.error);

    return () => {
      storage.close();
    };
  }, [setProject]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0b0f19] text-gray-100 overflow-hidden font-sans">
      {/* Top Application Header */}
      <Header />

      {/* Main Studio Body: Sidebar + Viewport + Toolbars */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Side: Hardware Catalog & Wizards */}
        <Sidebar activeTab={sidebarTab} onSelectTab={setSidebarTab} />

        {/* Center: Canvas Viewport & Floating Toolbars */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-[#070a10]">
          <Toolbar />
          <Viewport />
        </div>
      </div>

      {/* Bottom Status Bar */}
      <StatusBar />
    </div>
  );
};
