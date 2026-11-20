import { randomUUID } from 'node:crypto';
export const initialState = () => ({ mode: 'OFFLINE', current: null, vote: null, voteHistory: [], history: [], panel: null, lastStats: null, confirmations: {}, lastLowAt: null });
export const label = mode => ({ OFFLINE: 'Offline', VOTING: 'Voting', ONLINE: 'Online', LOW_ACTIVITY: 'Low Activity', SHUTTING_DOWN: 'Shutting Down' })[mode] || 'Unavailable';
// Called only inside a locked PostgreSQL transaction. Discord delivery happens afterwards.
export function transition(input, action, actorId, config, now = Date.now()) {
  const state = structuredClone(input), before = state.mode, events = [];
  const event = (kind, extra = {}) => { const e = { id: randomUUID(), kind, actorId, data: { before, after: state.mode, sessionId: state.current?.id ?? null, at: now, ...extra } }; events.push(e); return e; };
  const closeVote = reason => { if (state.vote && !state.vote.closed) { state.vote.closed = true; state.vote.closeReason = reason; state.voteHistory.push(structuredClone(state.vote)); } };
  switch (action.type) {
    case 'vote':
      if (state.current || state.mode === 'SHUTTING_DOWN') throw Error('A session is already active.');
      if (state.vote && !state.vote.closed) throw Error('A session vote is already active.');
      state.mode = 'VOTING'; state.vote = { id: randomUUID(), hostId: actorId, threshold: action.threshold ?? config.settings.requiredVotes, voters: [], createdAt: now, closed: false, notified: false, messageId: null };
      if (!Number.isInteger(state.vote.threshold) || state.vote.threshold < 1 || state.vote.threshold > 1000) throw Error('Required votes must be between 1 and 1000.');
      event('vote', { voteId: state.vote.id }); break;
    case 'ballot': {
      const vote = state.vote;
      if (state.mode !== 'VOTING' || !vote || vote.closed || vote.id !== action.voteId) throw Error('This session vote is closed.');
      const i = vote.voters.indexOf(actorId); if (i < 0) vote.voters.push(actorId); else vote.voters.splice(i, 1);
      if (vote.voters.length >= vote.threshold && !vote.notified) { vote.notified = true; event('threshold', { voteId: vote.id, hostId: vote.hostId, votes: vote.voters.length, threshold: vote.threshold }); }
      break;
    }
    case 'cancel':
      if (!state.vote || state.vote.closed || state.vote.id !== action.voteId) throw Error('This session vote is already closed.');
      closeVote('Cancelled by staff'); state.mode = 'OFFLINE'; event('cancel', { voteId: state.vote.id }); break;
    case 'start':
      if (state.current || ['ONLINE', 'LOW_ACTIVITY', 'SHUTTING_DOWN'].includes(state.mode)) throw Error('A session is already active.');
      closeVote('Session started'); state.mode = 'ONLINE'; state.lastLowAt = null;
      state.current = { id: randomUUID(), hostId: actorId, startedAt: now, endedAt: null, endedBy: null };
      event('start', { current: structuredClone(state.current) }); break;
    case 'low':
      if (!state.current || !['ONLINE', 'LOW_ACTIVITY'].includes(state.mode)) throw Error('Start a session before announcing low activity.');
      if (state.lastLowAt && now - state.lastLowAt < config.settings.lowCooldownMs) throw Error('Please wait five minutes between low-activity announcements.');
      state.lastLowAt = now; state.mode = 'LOW_ACTIVITY'; event('low'); break;
    case 'confirm':
      if (!state.current || !['ONLINE', 'LOW_ACTIVITY'].includes(state.mode)) throw Error('There is no active session to shut down.');
      state.confirmations = Object.fromEntries(Object.entries(state.confirmations).filter(([, c]) => c.expires > now));
      state.confirmations[action.id] = { actorId, sessionId: state.current.id, expires: now + 120000, reason: action.reason || 'Staff ended the session' }; break;
    case 'shutdown': {
      const c = state.confirmations[action.id];
      if (!c || c.actorId !== actorId || c.expires <= now || c.sessionId !== state.current?.id || !['ONLINE', 'LOW_ACTIVITY'].includes(state.mode)) throw Error('This confirmation expired or belongs to someone else. Request shutdown again.');
      state.confirmations = {}; closeVote('Session ended'); state.mode = 'SHUTTING_DOWN';
      Object.assign(state.current, { endedAt: now, endedBy: actorId, finalStats: state.lastStats, reason: c.reason }); event('shutdown', { current: structuredClone(state.current) }); break;
    }
    case 'finalize':
      if (state.mode === 'SHUTTING_DOWN' && state.current?.id === action.sessionId) { state.history.push(state.current); state.current = null; state.mode = 'OFFLINE'; }
      break;
    case 'stats': state.lastStats = action.stats; break;
    case 'vote-message': if (state.vote?.id === action.voteId) state.vote.messageId = action.messageId; break;
    case 'vote-finalized':
      if (state.vote?.id === action.voteId) state.vote.controlsFinalized = true;
      for (const vote of state.voteHistory) if (vote.id === action.voteId) vote.controlsFinalized = true;
      break;
    case 'panel': state.panel = action.panel; if (action.repaired) event('panel'); break;
    case 'error': event('error', { message: action.message }); break;
    default: throw Error('Unknown session action.');
  }
  return { state, events };
}
