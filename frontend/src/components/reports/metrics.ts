import { Counts } from '../dashboard/metrics';

export const attended = (c: Counts) => c.present + c.late;
export const rate = (c: Counts) => (attended(c) + c.absent > 0 ? Math.round((attended(c) / (attended(c) + c.absent)) * 100) : 0);
