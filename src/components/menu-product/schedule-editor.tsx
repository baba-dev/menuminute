"use client";
import type { Schedule } from "@/modules/menu-product/contracts";
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function ScheduleEditor({
  value,
  onChange,
}: {
  value: Schedule | null;
  onChange: (s: Schedule | null) => void;
}) {
  return (
    <div className="stack">
      <label className="row">
        <input
          type="checkbox"
          checked={value === null}
          onChange={(e) => onChange(e.target.checked ? null : { weekly: [], exceptions: [] })}
        />
        Available all the time
      </label>
      {value && (
        <>
          <p>Times follow each outlet’s timezone. An end before the start continues overnight.</p>
          {value.weekly.map((w, i) => (
            <div className="row" key={i}>
              <label className="field">
                Day
                <select
                  aria-label={`Service day ${i + 1}`}
                  value={w.day}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      weekly: value.weekly.map((v, j) =>
                        j === i ? { ...v, day: Number(e.target.value) } : v
                      ),
                    })
                  }
                >
                  {days.map((d, n) => (
                    <option key={d} value={n}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Start
                <input
                  type="time"
                  aria-label={`Start time ${i + 1}`}
                  value={w.start}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      weekly: value.weekly.map((v, j) =>
                        j === i ? { ...v, start: e.target.value } : v
                      ),
                    })
                  }
                />
              </label>
              <label className="field">
                End
                <input
                  type="time"
                  aria-label={`End time ${i + 1}`}
                  value={w.end}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      weekly: value.weekly.map((v, j) =>
                        j === i ? { ...v, end: e.target.value } : v
                      ),
                    })
                  }
                />
              </label>
              <label className="row">
                <input
                  type="checkbox"
                  checked={w.allDay}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      weekly: value.weekly.map((v, j) =>
                        j === i ? { ...v, allDay: e.target.checked } : v
                      ),
                    })
                  }
                />
                All day
              </label>
              <button
                type="button"
                aria-label={`Remove service window ${i + 1}`}
                onClick={() =>
                  onChange({ ...value, weekly: value.weekly.filter((_, j) => j !== i) })
                }
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...value,
                weekly: [...value.weekly, { day: 1, start: "09:00", end: "22:00", allDay: false }],
              })
            }
          >
            Add service window
          </button>
          <h3>Date exceptions</h3>
          {value.exceptions.map((ex, i) => (
            <div key={i} className="panel stack">
              <div className="row">
                <label className="field">
                  Date
                  <input
                    type="date"
                    value={ex.date}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        exceptions: value.exceptions.map((v, j) =>
                          j === i ? { ...v, date: e.target.value } : v
                        ),
                      })
                    }
                  />
                </label>
                <label className="row">
                  <input
                    type="checkbox"
                    checked={ex.closed}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        exceptions: value.exceptions.map((v, j) =>
                          j === i
                            ? {
                                ...v,
                                closed: e.target.checked,
                                windows: e.target.checked
                                  ? []
                                  : [{ start: "09:00", end: "22:00", allDay: false }],
                              }
                            : v
                        ),
                      })
                    }
                  />
                  Closed on this date
                </label>
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...value, exceptions: value.exceptions.filter((_, j) => j !== i) })
                  }
                >
                  Remove date exception
                </button>
              </div>
              {!ex.closed &&
                ex.windows.map((w, k) => (
                  <div className="row" key={k}>
                    {(["start", "end"] as const).map((field) => (
                      <label className="field" key={field}>
                        {field === "start" ? "Start" : "End"}
                        <input
                          type="time"
                          value={w[field]}
                          onChange={(e) =>
                            onChange({
                              ...value,
                              exceptions: value.exceptions.map((v, j) =>
                                j === i
                                  ? {
                                      ...v,
                                      windows: v.windows.map((x, n) =>
                                        n === k ? { ...x, [field]: e.target.value } : x
                                      ),
                                    }
                                  : v
                              ),
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                ))}
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...value,
                exceptions: [
                  ...value.exceptions,
                  { date: new Date().toISOString().slice(0, 10), closed: true, windows: [] },
                ],
              })
            }
          >
            Add date exception
          </button>
        </>
      )}
    </div>
  );
}
