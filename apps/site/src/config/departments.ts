import { images, type ImageAsset } from './images';
import {invites} from './invites';
export interface Department {
  slug: string; short: string; name: string; category: string; motto: string; overview: string;
  invite: string|null; image: ImageAsset; accent: string; responsibilities: string[];
  units: {name: string; description: string}[]; academy: string[]; proposedRanks: string[];
}
// Public editorial content only. Illustrative pathways are explicitly labeled, not a live roster.
export const departments: Department[] = [
  {slug:'lapd',short:'LAPD',name:'Los Angeles Police Department',category:'CITY OPERATIONS',motto:'A city worth protecting.',accent:'#79a9ff',image:images.lapd,invite:invites.lapd,
    overview:'Bring thoughtful, believable policing to the streets of our ER:LC community. LAPD is the home for city patrol, traffic enforcement, and coordinated scene response.',
    responsibilities:['City patrol and community interaction','Traffic stops and collision response','Scene security and interagency coordination'],
    units:[{name:'Patrol operations',description:'The foundation of consistent city policing and first response.'},{name:'Traffic services',description:'A focus on road safety, collision scenes, and realistic vehicle enforcement.'},{name:'Specialized response',description:'Specialist pathways are subject to department leadership approval.'}],
    academy:['Community rules and roleplay standards','Radio etiquette and CAD orientation','Traffic stops and scenario-based patrol'],proposedRanks:['Recruit','Officer','Field Training Officer','Sergeant','Lieutenant','Command staff']},
  {slug:'lasd',short:'LASD',name:"Los Angeles County Sheriff's Department",category:'COUNTY OPERATIONS',motto:'Beyond the city limits.',accent:'#79a9ff',image:images.lasd,invite:invites.lasd,
    overview:'Serve the wider county through patient, professional deputy roleplay. Work rural roads, support neighboring agencies, and bring continuity to complex county incidents.',
    responsibilities:['County and rural patrol','Mutual aid and scene assistance','Coordinated county incident response'],
    units:[{name:'County patrol',description:'Deputy operations across the wider roleplay district.'},{name:'Traffic enforcement',description:'Safe, consistent enforcement along county routes.'},{name:'Special operations',description:'Future specialist assignments will be published by department command.'}],
    academy:['County patrol fundamentals','Radio coordination and mutual aid','Scenario assessment and de-escalation'],proposedRanks:['Recruit Deputy','Deputy','Senior Deputy','Sergeant','Lieutenant','Command staff']},
  {slug:'lafd',short:'LAFD',name:'Los Angeles Fire Department',category:'FIRE & RESCUE',motto:'Ready when it matters.',accent:'#79a9ff',image:images.lafd,invite:invites.lafd,
    overview:'Create meaningful fire, rescue, and medical roleplay. LAFD brings calm communication and organized teamwork to the moments that shape a session.',
    responsibilities:['Fire suppression roleplay','Rescue and emergency medical scenarios','Joint scene management and public safety'],
    units:[{name:'Engine operations',description:'Coordinated fire response and apparatus teamwork.'},{name:'Rescue services',description:'Patient, structured rescue scenarios with other agencies.'},{name:'Medical response',description:'Fictional medical roleplay, patient handoffs, and scene communication.'}],
    academy:['Apparatus and station orientation','Scene safety and incident coordination','Fictional fire and medical scenarios'],proposedRanks:['Cadet','Firefighter','Engineer','Lieutenant','Captain','Command staff']},
  {slug:'dot',short:'LDOT',name:'Los Angeles Department of Transportation',category:'ROAD SERVICES',motto:'Keep the county moving.',accent:'#79a9ff',image:images.dot,invite:invites.dot,
    overview:'Make every road scene more immersive. Transportation members support recovery, road maintenance, and traffic management across the LASRP community.',
    responsibilities:['Vehicle recovery and roadside assistance','Work zones and road maintenance roleplay','Traffic support at multiagency incidents'],
    units:[{name:'Roadside operations',description:'Recovery and assistance that add depth to everyday roleplay.'},{name:'Road maintenance',description:'Organized work zones and repair scenarios.'},{name:'Traffic management',description:'Traffic support in cooperation with public safety agencies.'}],
    academy:['Safe vehicle recovery scenarios','Work-zone setup and communication','Interagency incident support'],proposedRanks:['Trainee','Operator','Senior Operator','Supervisor','Operations Manager','Department leadership']},
  {slug:'chp',short:'CHP',name:'California Highway Patrol',category:'HIGHWAY OPERATIONS',motto:'A new chapter on the highway.',accent:'#79a9ff',image:images.chp,invite:invites.chp,
   overview:'A planned department for highway-focused ER:LC roleplay. Leadership, recruitment, and operational information have not been published yet.',responsibilities:[],units:[],academy:[],proposedRanks:[]},
];
