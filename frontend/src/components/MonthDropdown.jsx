import React from 'react';

const MonthDropdown = ({ value, onChange, className = "form-select" }) => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const years = [2025, 2026, 2027];

  return (
    <select className={className} value={value} onChange={onChange}>
      <option value="">All Months</option>
      {years.map(year => (
        <optgroup key={year} label={year}>
          {months.map((m, index) => {
            const mm = String(index + 1).padStart(2, '0');
            const val = `${year}-${mm}`;
            return (
              <option key={val} value={val}>{m} {year}</option>
            );
          })}
        </optgroup>
      ))}
    </select>
  );
};

export default MonthDropdown;
