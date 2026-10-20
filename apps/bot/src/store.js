import fs from 'node:fs';
import path from 'node:path';

// Single-process, atomic durable storage. Keep the data directory on persistent disk.
export class Store {
  constructor(file = 'data/community.json') {
    this.file = file;
    this.data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { guilds: {} };
  }
  guild(id) {
    return this.data.guilds[id] ??= { config: { community: 'Los Angeles State Roleplay', staffRoles: [], managementRoles: [], departmentRoles: [], selfRoles: [], weeklyMinutes: 120, requirements: 'Complete training and follow the staff handbook.', applications: {}, priority: 'Normal roleplay; no active priority restrictions.', maxPlayers: 40 }, templates: {}, history: [], acknowledgments: {}, cases: {}, tickets: {}, applications: {}, shifts: {}, votes: {}, published: {}, schedules: {}, records: {}, sessions: [] };
  }
  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(`${this.file}.tmp`, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    fs.renameSync(`${this.file}.tmp`, this.file);
  }
  change(id, actor, kind, value) {
    this.guild(id).history.push({ at: new Date().toISOString(), actor, kind, value: structuredClone(value) });
    this.save();
  }
}
