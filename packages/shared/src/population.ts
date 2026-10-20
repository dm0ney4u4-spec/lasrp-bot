export interface PopulationState {since:number;lastSeen:number;alerted:boolean;below:boolean}
export function populationObservation(previous:PopulationState|undefined,players:number,threshold:number,waitMinutes:number,now:number){
 if(!Number.isFinite(players)||players<0||!Number.isFinite(now))return {state:previous,alert:false};
 if(players>=threshold)return {state:{since:now,lastSeen:now,alerted:false,below:false},alert:false};
 const current=!previous||!previous.below||now-previous.lastSeen>90000||now<previous.lastSeen?{since:now,lastSeen:now,alerted:false,below:true}:{...previous,lastSeen:now};
 const alert=!current.alerted&&now-current.since>=waitMinutes*60000;
 return {state:{...current,alerted:current.alerted||alert},alert};
}
