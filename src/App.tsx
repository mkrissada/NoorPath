import { AthkarView } from './components/athkar/AthkarView';
import { AudioLibraryView } from './components/audio/AudioLibraryView';
import { DashboardView } from './components/dashboard/DashboardView';
import { HadithView } from './components/hadith/HadithView';
import { HifzView } from './components/hifz/HifzView';
import { AppShell } from './components/layout/AppShell';
import { MushafView } from './components/mushaf/MushafView';
import { ReaderView } from './components/reader/ReaderView';
import { SettingsView } from './components/settings/SettingsView';
import { AppProvider, useApp } from './context/AppContext';
import { AudioProvider } from './context/AudioContext';

function NoorPathRouter() {
  const { activeTab } = useApp();

  return (
    <AppShell>
      {activeTab === 'dashboard' && <DashboardView />}
      {activeTab === 'reader' && <ReaderView />}
      {activeTab === 'mushaf' && <MushafView />}
      {activeTab === 'hifz' && <HifzView />}
      {activeTab === 'audio' && <AudioLibraryView />}
      {activeTab === 'hadith' && <HadithView />}
      {activeTab === 'athkar' && <AthkarView />}
      {activeTab === 'settings' && <SettingsView />}
    </AppShell>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AudioProvider>
        <NoorPathRouter />
      </AudioProvider>
    </AppProvider>
  );
}
