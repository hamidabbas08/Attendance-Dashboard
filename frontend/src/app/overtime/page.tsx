'use client';

import { Guard } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { P } from '../../lib/permissions';
import { PersonalOvertime } from '../../components/overtime/PersonalOvertime';
import { TeamOvertime } from '../../components/overtime/TeamOvertime';

function Switcher() {
  const { can } = useAuth();
  return can('attendance:view_all') ? <TeamOvertime /> : <PersonalOvertime />;
}

export default function Page() {
  return (
    <Guard perm={P.ATTENDANCE_VIEW_OWN}>
      <Switcher />
    </Guard>
  );
}
