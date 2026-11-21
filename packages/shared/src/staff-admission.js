import {db} from './database.js';
import {infractionConfig} from '../../../config/infractions.js';
export async function disciplineAdmission(memberId,guildId=infractionConfig.guildId){const[row]=await db.$queryRawUnsafe('SELECT "data" FROM "StaffDisciplineState" WHERE "guildId"=$1 AND "memberId"=$2',guildId,memberId);return row?.data;}
export async function assertNotStaffBlacklisted(memberId,guildId=infractionConfig.guildId){const state=await disciplineAdmission(memberId,guildId);if(state?.blacklisted)throw Error('This member has an active staff blacklist and cannot be accepted into staff.');}
