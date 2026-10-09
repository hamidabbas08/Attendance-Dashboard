import Link from 'next/link';
import { Avatar, Select } from '../ui';

const ROLE_LABEL: Record<string, string> = {
  platform_admin: 'Platform Admin', company_owner: 'Owner', company_admin: 'Admin', cto: 'CTO',
  hr_manager: 'HR Manager', operations_manager: 'Operations Manager', manager: 'Manager',
  team_lead: 'Team Lead', product_manager: 'Product Manager', developer: 'Developer',
  business_developer: 'Business Developer', designer: 'Designer', employee: 'Employee',
};

interface Employee {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role?: string;
  roles?: string[];
  status?: string;
}

export function EmployeeHeader({
  employee, showYearSelect, year, years, onYear,
}: {
  employee: Employee | null | undefined;
  showYearSelect: boolean;
  year: number;
  years: number[];
  onYear: (y: number) => void;
}) {
  const roles = employee?.roles?.length ? employee.roles : employee?.role ? [employee.role] : [];
  const roleText = roles.map((r) => ROLE_LABEL[r] ?? r).join(', ');

  return (
    <>
      <Link href="/team" className="text-muted text-sm hover:text-fg">← Back to Team</Link>

      <div className="surface p-5 my-4 flex items-center gap-4 flex-wrap">
        <Avatar src={employee?.avatarUrl} name={employee?.name ?? '?'} size={56} />
        <div className="min-w-0">
          <div className="text-xl font-bold truncate">{employee?.name ?? '…'}</div>
          <div className="text-muted text-sm truncate">{employee?.email || '—'}</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {roleText && <span className="pill pill-leave">{roleText}</span>}
            {employee?.status === 'terminated' && <span className="pill pill-absent">terminated</span>}
          </div>
        </div>
        {showYearSelect && (
          <div className="ml-auto">
            <Select
              label="Year"
              value={year}
              onChange={(e) => onYear(Number(e.target.value))}
              options={years.map((y) => ({ value: y, label: y }))}
            />
          </div>
        )}
      </div>
    </>
  );
}
