export function PlannedDateFields({ value, onChange, disabled, required, label = 'Planned date' }) {
  const [date, time = ''] = value.split('T');
  const setPlan = (day, hour) => onChange(day && hour ? `${day}T${hour}` : day);

  return <div className="columns items-start">
    <label className="field"><span>{label}</span>
      <input type="date" value={date} required={required} disabled={disabled} onChange={event => setPlan(event.target.value, time)} />
    </label>
    <div className="field">
      <label className="field"><span>Time (optional)</span>
        <input type="time" value={time} disabled={disabled || !date} onChange={event => setPlan(date, event.target.value)} />
      </label>
      {time && <div><button type="button" className="button quiet" disabled={disabled} onClick={() => setPlan(date, '')}>Clear time</button></div>}
    </div>
  </div>;
}
