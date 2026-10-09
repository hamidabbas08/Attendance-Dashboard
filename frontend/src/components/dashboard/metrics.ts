export interface Counts {
  present: number; late: number; absent: number; leave: number;
  half_day: number; off_day: number; holiday: number; total: number;
}
export interface EmpRow { employeeId: string; name: string; totals: Counts }
export interface Matrix {
  year: number;
  employees: EmpRow[];
  companyByMonth: Counts[];
  companyTotals: Counts;
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const attended = (c: Counts) => c.present + c.late;
export const rate = (c: Counts) => (attended(c) + c.absent > 0 ? Math.round((attended(c) / (attended(c) + c.absent)) * 100) : null);
