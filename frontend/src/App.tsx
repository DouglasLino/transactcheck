import { useState } from 'react';
import type { ViewId } from './types';
import { AppLayout } from './components/AppLayout';
import { UploadPage } from './pages/UploadPage';
import { DashboardPage } from './pages/DashboardPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { RulesPage } from './pages/RulesPage';

export default function App() {
  const [view, setView] = useState<ViewId>('upload');
  return <AppLayout view={view} onNavigate={setView}>
    {view === 'upload' && <UploadPage onNavigate={setView} />}
    {view === 'dashboard' && <DashboardPage />}
    {view === 'transactions' && <TransactionsPage />}
    {view === 'diagnostics' && <DiagnosticsPage />}
    {view === 'rules' && <RulesPage />}
  </AppLayout>;
}

