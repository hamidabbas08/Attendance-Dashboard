'use client';

import { useAuth } from '../../lib/auth';
import { ui } from '../../lib/ui';

const ROLE_LABEL: Record<string, string> = {
  company_owner: 'Owner',
  hr_manager: 'HR Manager',
  employee: 'Employee',
  platform_admin: 'Platform Admin',
};

export default function MyProfile() {
  const { me } = useAuth();
  if (!me) return null;

  const rows: [string, string][] = [
    ['Name', me.name ?? '—'],
    ['Email', me.email ?? '—'],
    ['Company', me.companyName ?? '—'],
    ['Role', me.roles.map((r) => ROLE_LABEL[r] ?? r).join(', ')],
  ];

  return (
    <>
      <h2 className={ui.h2}>My Profile</h2>
      <div className={`${ui.card} max-w-md`}>
        <table className="w-full">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <td className="py-2 text-muted text-sm w-28">{k}</td>
                <td className="py-2 text-sm">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted text-sm">
        You can only see your own profile and attendance. Company-wide data is restricted to
        managers and owners.
      </p>
    </>
  );
}
