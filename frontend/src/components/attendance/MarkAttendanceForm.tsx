'use client';

import { FormEvent, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { Button, DatePicker, Input, Select } from '../ui';
import { ui } from '../../lib/ui';
import { Employee, today } from './calc';

// Sentinel status value: selecting it in the Status dropdown switches the form
// into "declare a company holiday" mode instead of recording one employee's
// attendance.
const COMPANY_HOLIDAY = '__company_holiday__';

export function MarkAttendanceForm({
  employees, canDeclareHoliday, onSaved,
}: {
  employees: Employee[]; canDeclareHoliday: boolean; onSaved: () => void;
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState('present');
  const [holidayName, setHolidayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isHoliday = status === COMPANY_HOLIDAY;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isHoliday) {
        if (!holidayName.trim()) return;
        await api('/api/holidays', { method: 'POST', body: JSON.stringify({ date, name: holidayName.trim() }) });
        setHolidayName('');
      } else {
        await api('/api/attendance', { method: 'PUT', body: JSON.stringify({ employeeId, date, status }) });
      }
      onSaved();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={ui.card}>
      <form className="flex flex-wrap items-end gap-3" onSubmit={submit}>
        {isHoliday ? (
          // Holiday mode: no specific employee — it's the whole company, so the
          // Employee picker is replaced by the holiday's name.
          <div className="min-w-[220px] flex-1">
            <Input
              label="Holiday name"
              placeholder="e.g. Eid ul-Fitr, Independence Day"
              value={holidayName}
              onChange={(e) => setHolidayName(e.target.value)}
              required
            />
          </div>
        ) : (
          <div className="min-w-[180px]">
            <Select
              label="Employee"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
              placeholder="Select…"
              options={employees.map((e) => ({ value: e.id, label: e.name }))}
            />
          </div>
        )}
        <DatePicker label="Date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={[
            ...['present', 'late', 'absent', 'leave', 'half_day', 'off_day', 'holiday'].map((s) => ({
              value: s, label: s.replace('_', ' '),
            })),
            ...(canDeclareHoliday ? [{ value: COMPANY_HOLIDAY, label: 'Company holiday (everyone)' }] : []),
          ]}
        />
        <Button disabled={busy}>
          {busy ? 'Saving…' : isHoliday ? 'Mark holiday' : 'Mark attendance'}
        </Button>
        {error && <div className={ui.error}>{error}</div>}
      </form>
    </div>
  );
}
