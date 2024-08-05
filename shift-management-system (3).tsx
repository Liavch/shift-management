import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sun, Moon, ThumbsUp, ThumbsDown } from 'lucide-react';

const ShiftManagementSystem = () => {
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [newEmployee, setNewEmployee] = useState({ name: '', isSenior: false, isSabbathObservant: false });
  const [schedule, setSchedule] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startShiftType, setStartShiftType] = useState('morning');
  const [endShiftType, setEndShiftType] = useState('evening');

  useEffect(() => {
    if (startDate && endDate) {
      generateShifts(new Date(startDate), new Date(endDate), startShiftType, endShiftType);
    }
  }, [startDate, endDate, startShiftType, endShiftType]);

  const generateShifts = (start, end, startType, endType) => {
    const newShifts = [];
    const current = new Date(start);
    let isFirstDay = true;
    let isLastDay = false;

    while (current <= end) {
      isLastDay = current.toDateString() === end.toDateString();

      if (isFirstDay) {
        if (startType === 'morning') {
          newShifts.push({ date: current.toISOString().split('T')[0], type: 'day' });
          newShifts.push({ date: current.toISOString().split('T')[0], type: 'night' });
        } else {
          newShifts.push({ date: current.toISOString().split('T')[0], type: 'night' });
        }
        isFirstDay = false;
      } else if (isLastDay) {
        if (endType === 'morning') {
          newShifts.push({ date: current.toISOString().split('T')[0], type: 'day' });
        } else {
          newShifts.push({ date: current.toISOString().split('T')[0], type: 'day' });
          newShifts.push({ date: current.toISOString().split('T')[0], type: 'night' });
        }
      } else {
        newShifts.push({ date: current.toISOString().split('T')[0], type: 'day' });
        newShifts.push({ date: current.toISOString().split('T')[0], type: 'night' });
      }

      current.setDate(current.getDate() + 1);
    }
    setShifts(newShifts);
  };

  const addEmployee = () => {
    if (newEmployee.name.trim()) {
      setEmployees([...employees, { ...newEmployee, id: Date.now(), constraints: [], preferences: [], lastShift: null }]);
      setNewEmployee({ name: '', isSenior: false, isSabbathObservant: false });
    }
  };

  const toggleConstraint = (employeeId, shiftId) => {
    setEmployees(employees.map(emp => {
      if (emp.id === employeeId) {
        const constraints = emp.constraints.includes(shiftId)
          ? emp.constraints.filter(c => c !== shiftId)
          : [...emp.constraints, shiftId];
        return { ...emp, constraints, preferences: emp.preferences.filter(p => p !== shiftId) };
      }
      return emp;
    }));
  };

  const togglePreference = (employeeId, shiftId) => {
    setEmployees(employees.map(emp => {
      if (emp.id === employeeId) {
        const preferences = emp.preferences.includes(shiftId)
          ? emp.preferences.filter(p => p !== shiftId)
          : [...emp.preferences, shiftId];
        return { ...emp, preferences, constraints: emp.constraints.filter(c => c !== shiftId) };
      }
      return emp;
    }));
  };

  const assignShifts = () => {
    let newSchedule = [];
    let employeesWorkload = employees.map(emp => ({ ...emp, shiftCount: 0 }));

    shifts.forEach((shift, index) => {
      const shiftId = shift.date + shift.type;
      const neededSeniors = shift.type === 'day' ? 1 : 1;
      const neededJuniors = shift.type === 'day' ? 2 : 1;

      let assigned = { seniors: [], juniors: [] };

      const isAvailable = (emp) => {
        const lastShiftDate = emp.lastShift ? new Date(emp.lastShift) : new Date(0);
        const currentShiftDate = new Date(shift.date);
        const hoursSinceLastShift = (currentShiftDate - lastShiftDate) / (1000 * 60 * 60);
        return !emp.constraints.includes(shiftId) && hoursSinceLastShift >= 12;
      };

      const isSabbath = (date) => {
        const day = new Date(date).getDay();
        return day === 5 || day === 6; // Friday or Saturday
      };

      const assignWithPreference = (pool, needed, assignedList) => {
        const sortedPool = [...pool].sort((a, b) => {
          const aHasPreference = a.preferences.includes(shiftId);
          const bHasPreference = b.preferences.includes(shiftId);
          if (aHasPreference !== bHasPreference) return bHasPreference - aHasPreference;
          return a.shiftCount - b.shiftCount;
        });

        while (assignedList.length < needed && sortedPool.length > 0) {
          const emp = sortedPool.shift();
          if (isAvailable(emp)) {
            if (emp.isSabbathObservant && isSabbath(shift.date)) {
              // If it's a Sabbath-observant employee and it's Sabbath,
              // we need to check if we can assign both Friday night and Saturday morning shifts
              const fridayNightShift = shifts[index - 1];
              const saturdayMorningShift = shifts[index + 1];
              if (fridayNightShift && saturdayMorningShift &&
                  fridayNightShift.date === shift.date && saturdayMorningShift.date === shift.date &&
                  isAvailable(emp) && !emp.constraints.includes(fridayNightShift.date + fridayNightShift.type) &&
                  !emp.constraints.includes(saturdayMorningShift.date + saturdayMorningShift.type)) {
                assignedList.push(emp.id);
                emp.shiftCount += 2;
                emp.lastShift = saturdayMorningShift.date;
              }
            } else {
              assignedList.push(emp.id);
              emp.shiftCount++;
              emp.lastShift = shift.date;
            }
          }
        }
      };

      const availableSeniors = employeesWorkload.filter(emp => emp.isSenior && isAvailable(emp));
      const availableJuniors = employeesWorkload.filter(emp => !emp.isSenior && isAvailable(emp));

      assignWithPreference(availableSeniors, neededSeniors, assigned.seniors);
      assignWithPreference(availableJuniors, neededJuniors, assigned.juniors);

      if (assigned.juniors.length < neededJuniors) {
        assignWithPreference(availableSeniors, neededJuniors - assigned.juniors.length, assigned.juniors);
      }

      newSchedule.push({ ...shift, assigned });
    });

    setSchedule(newSchedule);
  };

  const getHebrewWeekday = (dateString) => {
    const days = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];
    const date = new Date(dateString);
    return days[date.getDay()];
  };

  return (
    <div className="p-4 text-right" dir="rtl">
      <h1 className="text-2xl font-bold mb-4">מערכת ניהול משמרות</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">הוספת עובד</h2>
        <input
          type="text"
          placeholder="שם העובד"
          value={newEmployee.name}
          onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
          className="border p-2 ml-2"
        />
        <label className="mr-2">
          <input
            type="checkbox"
            checked={newEmployee.isSenior}
            onChange={(e) => setNewEmployee({...newEmployee, isSenior: e.target.checked})}
            className="mr-1"
          />
          עובד בכיר
        </label>
        <label className="mr-2">
          <input
            type="checkbox"
            checked={newEmployee.isSabbathObservant}
            onChange={(e) => setNewEmployee({...newEmployee, isSabbathObservant: e.target.checked})}
            className="mr-1"
          />
          שומר שבת
        </label>
        <button onClick={addEmployee} className="bg-blue-500 text-white p-2 rounded mr-2">הוסף עובד</button>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">בחירת טווח תאריכים לשיבוץ</h2>
        <div className="flex items-center mb-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border p-2 ml-2"
          />
          <select
            value={startShiftType}
            onChange={(e) => setStartShiftType(e.target.value)}
            className="border p-2 ml-2"
          >
            <option value="morning">משמרת בוקר</option>
            <option value="evening">משמרת ערב</option>
          </select>
        </div>
        <div className="flex items-center">
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border p-2 ml-2"
          />
          <select
            value={endShiftType}
            onChange={(e) => setEndShiftType(e.target.value)}
            className="border p-2 ml-2"
          >
            <option value="morning">משמרת בוקר</option>
            <option value="evening">משמרת ערב</option>
          </select>
        </div>
      </div>

      {employees.length > 0 && shifts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2">אילוצים והעדפות עובדים</h2>
          <p className="mb-2">
            סמן <ThumbsDown className="inline text-red-500" size={16} /> עבור משמרות שהעובד <strong>אינו יכול</strong> לעבוד בהן.
            סמן <ThumbsUp className="inline text-green-500" size={16} /> עבור משמרות שהעובד <strong>מעדיף</strong> לעבוד בהן.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 sticky right-0 bg-gray-100 z-10">שם העובד</th>
                  {shifts.map(shift => (
                    <th key={shift.date + shift.type} className="border p-2 text-center">
                      {new Date(shift.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}
                      <br />
                      {getHebrewWeekday(shift.date)}
                      <br />
                      {shift.type === 'day' ? <Sun className="inline" size={16} /> : <Moon className="inline" size={16} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map(employee => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="border p-2 sticky right-0 bg-white z-10">
                      {employee.name} ({employee.isSenior ? 'בכיר' : 'זוטר'})
                      {employee.isSabbathObservant && ' (שומר שבת)'}
                    </td>
                    {shifts.map(shift => {
                      const shiftId = shift.date + shift.type;
                      return (
                        <td key={shiftId} className="border p-2 text-center">
                          <button
                            onClick={() => toggleConstraint(employee.id, shiftId)}
                            className={`mr-1 p-1 rounded ${employee.constraints.includes(shiftId) ? 'bg-red-500 text-white' : 'bg-gray-200'}`}
                          >
                            <ThumbsDown size={16} />
                          </button>
                          <button
                            onClick={() => togglePreference(employee.id, shiftId)}
                            className={`ml-1 p-1 rounded ${employee.preferences.includes(shiftId) ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
                          >
                            <ThumbsUp size={16} />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button 
        onClick={assignShifts} 
        className="bg-green-500 text-white p-2 rounded mb-4"
        disabled={employees.length === 0 || shifts.length === 0}
      >
        שבץ משמרות
      </button>

      {schedule.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2">לוח שיבוצים</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">תאריך</th>
                <th className="border p-2">יום בשבוע</th>
                <th className="border p-2">סוג משמרת</th>
                <th className="border p-2">עובדים משובצים</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((shift, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="border p-2">{new Date(shift.date).toLocaleDateString('he-IL')}</td>
                  <td className="border p-2">{getHebrewWeekday(shift.date)}</td>
                  <td className="border p-2">
                    {shift.type === 'day' ? 
                      <><Sun className="inline mr-1" size={16} /> בוקר</> : 
                      <><Moon className="inline mr-1" size={16} /> ערב</>
                    }
                  </td>
                  <td className="border p-2">
                     {[...shift.assigned.seniors, ...shift.assigned.juniors]
                      .map(id => {
                        const emp = employees.find(e => e.id === id);
                        return emp ? (
                          <span key={id} className="mr-2">
                            {emp.name}
                            {emp.preferences.includes(shift.date + shift.type) && 
                              <ThumbsUp className="inline text-green-500 ml-1" size={16} />
                            }
                            {emp.isSabbathObservant && (getHebrewWeekday(shift.date) === 'יום שישי' || getHebrewWeekday(shift.date) === 'שבת') && 
                              ' (שבת)'
                            }
                          </span>
                        ) : null;
                      })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ShiftManagementSystem
