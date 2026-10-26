"use client";

import { Clock3, Copy, CalendarDays } from "lucide-react";
import type { Schedule } from "@/modules/menu-product/contracts";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const dayWindow = (day: number, start = "09:00", end = "21:00") => ({day,start,end,allDay:false});
type Mode = "business" | "service";

/**
 * Hours are explicitly "not configured" until the operator opts in.
 * A null schedule MUST NOT be interpreted as open 24/7.
 * Overnight intervals (e.g. 18:00–02:00) are supported by the shared Schedule contract.
 */
export function BusinessHoursEditor({ value,onChange,mode = "business" }:{
 value: Schedule | null;
 onChange: (next: Schedule | null) => void;
 mode?: Mode;
}) {
 const caption = mode === "business" ? "Restaurant opening hours" : "Order acceptance hours";
 const updateDay = (day:number, window: ReturnType<typeof dayWindow> | null) => {
   const existing = value ?? {weekly:[],exceptions:[]};
   const weekly = existing.weekly.filter(x=>x.day!==day);
   if (window) weekly.push(window);
   weekly.sort((a,b)=>a.day-b.day);
   onChange({...existing,weekly});
 };
 const getDay = (day:number) => value?.weekly.find(x=>x.day===day);
 return (
  <section className="wizard-hours" aria-label={caption}>
   <div className="wizard-hours-heading"><Clock3 size={18} aria-hidden="true" /><strong>{caption}</strong>
     <span className="wizard-counter">Optional · editable later</span>
   </div>
   {value===null ? (
     <div className="wizard-hours-empty">
       <p>Not configured. We'll never assume the restaurant is open 24 hours.</p>
       <button className="wizard-back-btn" type="button"
         onClick={()=>onChange({weekly:[1,2,3,4,5,6,0].map(d=>dayWindow(d)),exceptions:[]})}>
         <CalendarDays size={15} aria-hidden="true" /> Set hours
       </button>
     </div>
   ):(
   <>
    <div className="wizard-hours-actions">
      <button type="button" onClick={()=>onChange({...value,weekly:DAYS.map((_,d)=>dayWindow(d))})}>Every day · 9 AM–9 PM</button>
      <button type="button" onClick={()=>onChange({...value,weekly:[1,2,3,4,5].map(d=>dayWindow(d))})}>Weekdays only</button>
      <button type="button" onClick={()=>onChange({...value,weekly:[]})}>Mark all closed</button>
      <button type="button" onClick={()=>onChange(null)}>Clear hours</button>
    </div>
    <div className="wizard-hours-days">
      {DAYS.map((name,day)=>{
        const w=getDay(day),open=Boolean(w);
        return <div className="wizard-hours-day" key={day}>
          <label className="wizard-hours-day-label"><input type="checkbox" checked={open}
            onChange={e=>updateDay(day,e.target.checked?dayWindow(day):null)} />
            <span>{name}</span></label>
          {w?<>
            <input aria-label={`${name} opens at`} type="time" value={w.start}
              onChange={e=>updateDay(day,{...w,start:e.target.value})} />
            <span aria-hidden="true">to</span>
            <input aria-label={`${name} closes at`} type="time" value={w.end}
              onChange={e=>updateDay(day,{...w,end:e.target.value})} />
          </>:<span className="wizard-counter">Closed</span>}
        </div>;
      })}
    </div>
    <button className="wizard-hours-copy" type="button" disabled={!getDay(1)}
      onClick={()=>{const monday=getDay(1);if(!monday)return;
        const other=value.weekly.filter(w=>w.day===0||w.day===6);
        onChange({...value,weekly:[...other,...[1,2,3,4,5].map(d=>({...monday,day:d}))]});}}>
      <Copy size={15} aria-hidden="true"/> Copy Monday to weekdays
    </button>
    <p className="wizard-counter">Times use the outlet timezone. Closing earlier than opening means after midnight.
    Holiday exceptions and split shifts can be refined later in service settings.</p>
   </>
   )}
  </section>
 );
}
