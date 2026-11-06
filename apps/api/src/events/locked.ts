/** A schedule is locked once it has any completion or evidence: its timing can no longer change. Expects the schedule aliased as `s`. */
export const LOCKED_SQL = `(EXISTS (SELECT 1 FROM event_completions c WHERE c.schedule_id = s.id)
     OR EXISTS (SELECT 1 FROM evidences e WHERE e.schedule_id = s.id))`;
