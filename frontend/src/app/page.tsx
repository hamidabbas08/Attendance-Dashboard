'use client';

import { useAuth } from '../lib/auth';
import { P } from '../lib/permissions';
import { CompanyDashboard } from '../components/dashboard/CompanyDashboard';
import { EmployeeHome } from '../components/dashboard/EmployeeHome';

export default function DashboardPage() {
  const { me, can } = useAuth();
  const year = new Date().getUTCFullYear();

  if (!can(P.REPORTS_VIEW)) return <EmployeeHome name={me?.name ?? ''} />;
  return <CompanyDashboard year={year} name={me?.name ?? ''} company={me?.companyName ?? ''} />;
}
