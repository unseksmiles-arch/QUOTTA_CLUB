/** Deterministic fair allocation of one jet-ski day. All timestamps in minutes from midnight. */
export type FairClaim = { id:string; userId:string; startMinute:number; endMinute:number; premiumMinutes:number; totalMinutes:number; priorityTurns:number; eligible:boolean };
export type FairAllocation = {claimId:string;userId:string;startMinute:number;endMinute:number;reason:string};
export function allocateDay(claims:FairClaim[],occupied:{startMinute:number;endMinute:number}[]=[],open=420,close=1080):FairAllocation[]{
 if(open<0||close>1440||close<=open)throw new Error('Janela inválida');
 const candidates=claims.filter(c=>c.eligible&&Number.isInteger(c.startMinute)&&Number.isInteger(c.endMinute)&&c.startMinute>=open&&c.endMinute<=close&&c.startMinute<c.endMinute);
 // One user may file multiple preferences; choose at most one claim per user in this round.
 const ranked=[...candidates].sort((a,b)=>a.premiumMinutes-b.premiumMinutes||a.totalMinutes-b.totalMinutes||a.priorityTurns-b.priorityTurns||a.userId.localeCompare(b.userId)||a.id.localeCompare(b.id));
 const free=Array.from({length:close-open},(_,i)=>!occupied.some(o=>o.startMinute<open+i+1&&o.endMinute>open+i));
 const result:FairAllocation[]=[];const used=new Set<string>();
 // Round robin by 60-minute slices: a claimant cannot monopolize a disputed day.
 // Keep contiguous blocks when possible, honoring requested ranges; unassigned fragments remain free.
 const awarded=new Map<string,number>();
 while(true){let progress=false;
  for(const c of ranked){if(used.has(c.userId)&&!awarded.has(c.id))continue;
   const owned=awarded.get(c.id)??0;
   if(owned>=c.endMinute-c.startMinute)continue;
   let start=-1;
   for(let m=c.startMinute;m+60<=c.endMinute;m+=60){if(m<open||m+60>close)continue; if(Array.from({length:60},(_,k)=>free[m-open+k]).every(Boolean)){start=m;break;}}
   if(start<0)continue;
   for(let m=start;m<start+60;m++)free[m-open]=false;
   result.push({claimId:c.id,userId:c.userId,startMinute:start,endMinute:start+60,reason:'Rodízio por hora: menor uso premium, uso total e prioridade histórica'});
   awarded.set(c.id,owned+60);used.add(c.userId);progress=true;
  }
  if(!progress)break;
 }
 return result.sort((a,b)=>a.startMinute-b.startMinute);
}
export function consolidateAllocations(rows:FairAllocation[]):FairAllocation[]{
 const ordered=[...rows].sort((a,b)=>a.userId.localeCompare(b.userId)||a.startMinute-b.startMinute);
 const out:FairAllocation[]=[];
 for(const r of ordered){const last=out[out.length-1];if(last&&last.userId===r.userId&&last.claimId===r.claimId&&last.endMinute===r.startMinute)last.endMinute=r.endMinute;else out.push({...r});}
 return out.sort((a,b)=>a.startMinute-b.startMinute);
}
