export interface Employee {
  id: string;
  name: string;
  email: string;
  slackUserId: string | null;
  role: string;
  roles?: string[];
  status: string;
  terminatedAt?: string | null;
  avatarUrl?: string | null;
}

export const ROLE_OPTIONS = [
  { value: 'company_owner', label: 'Owner' },
  { value: 'company_admin', label: 'Admin' },
  { value: 'cto', label: 'CTO' },
  { value: 'hr_manager', label: 'HR Manager' },
  { value: 'operations_manager', label: 'Operations Manager' },
  { value: 'manager', label: 'Manager' },
  { value: 'team_lead', label: 'Team Lead' },
  { value: 'product_manager', label: 'Product Manager' },
  { value: 'developer', label: 'Developer' },
  { value: 'business_developer', label: 'Business Developer' },
  { value: 'designer', label: 'Designer' },
  { value: 'employee', label: 'Employee' },
];
export const roleLabel = (v: string) => ROLE_OPTIONS.find((o) => o.value === v)?.label ?? v;
export const rolesOf = (e: Employee): string[] =>
  e.roles && e.roles.length ? e.roles : e.role ? [e.role] : ['employee'];
