const db = require('../config/db');

class PlaybackEvent {
  static async findBySession(sessionId, playerType) {
    let query = `SELECT * FROM playback_events WHERE session_id = ?`;
    const params = [sessionId];
    if (playerType) {
      query += ' AND player_type = ?';
      params.push(playerType);
    }
    query += ' ORDER BY elapsed_sec ASC';
    const [rows] = await db.execute(query, params);
    return rows;
  }

  static async create(eventData) {
    const {
      sessionId, playerType, eventType, elapsedSec,
      resolutionLabel = 'unknown', bufferLevelSec = 0,
      simulatedDelayMs = 0, isCacheHit = false
    } = eventData;

    const [result] = await db.execute(
      `INSERT INTO playback_events
       (session_id, player_type, event_type, elapsed_sec, resolution_label,
        buffer_level_sec, simulated_delay_ms, is_cache_hit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, playerType, eventType, elapsedSec, resolutionLabel,
       bufferLevelSec, simulatedDelayMs, isCacheHit ? 1 : 0]
    );
    return result.insertId;
  }

  static async getTimeSeriesForChart(sessionId) {
    const [rows] = await db.execute(
      `SELECT player_type, elapsed_sec, buffer_level_sec, resolution_label, simulated_delay_ms, is_cache_hit
       FROM playback_events
       WHERE session_id = ? AND event_type IN ('SEGMENT_FETCH', 'BUFFER_STALL', 'BUFFER_RESUME', 'QUALITY_SWITCH')
       ORDER BY elapsed_sec ASC`,
      [sessionId]
    );
    return rows;
  }
}

module.exports = PlaybackEvent;

