import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { Layout } from './pages/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Employees } from './pages/Employees';
import { Attendance } from './pages/Attendance';
import { MyAttendance } from './pages/MyAttendance';
import { Shifts } from './pages/Shifts';
import { Reports } from './pages/Reports';
import { SlackSettings } from './pages/SlackSettings';
import { ClaudeAssistant } from './pages/ClaudeAssistant';
import { P } from './permissions';
import { ReactNode } from 'react';

function Guard({ perm, children }: { perm: string; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(perm)) return <div className="card">403 — You do not have access to this page.</div>;
  return <>{children}</>;
}

export function App() {
  const { me, loading } = useAuth();

  if (loading) return <div className="login">Loading…</div>;
  if (!me) return <Login />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/my-attendance" element={<Guard perm={P.ATTENDANCE_VIEW_OWN}><MyAttendance /></Guard>} />
        <Route path="/employees" element={<Guard perm={P.EMPLOYEES_VIEW}><Employees /></Guard>} />
        <Route path="/attendance" element={<Guard perm={P.ATTENDANCE_VIEW_ALL}><Attendance /></Guard>} />
        <Route path="/shifts" element={<Guard perm={P.SHIFTS_VIEW}><Shifts /></Guard>} />
        <Route path="/reports" element={<Guard perm={P.REPORTS_VIEW}><Reports /></Guard>} />
        <Route path="/slack" element={<Guard perm={P.SLACK_VIEW}><SlackSettings /></Guard>} />
        <Route path="/assistant" element={<Guard perm={P.CLAUDE_QUERY_OWN}><ClaudeAssistant /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
