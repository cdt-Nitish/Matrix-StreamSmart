const db = require('../config/db');

class PlayerMetric {
  static async findBySession(sessionId) {
    const [rows] = await db.execute(
      'SELECT * FROM player_metrics WHERE session_id = ? ORDER BY player_type',
      [sessionId]
    );
    return rows;
  }

  static async upsert(sessionId, playerType, metrics) {
    const {
      startupDelayMs = 0,
      stallCount = 0,
      totalStallDurationSec = 0,
      avgBitrateKbps = 0,
      qualitySwitches = 0,
      cacheHits = 0,
      cacheMisses = 0
    } = metrics;

    const [existing] = await db.execute(
      'SELECT metric_id FROM player_metrics WHERE session_id = ? AND player_type = ?',
      [sessionId, playerType]
    );

    if (existing.length > 0) {
      await db.execute(
        `UPDATE player_metrics SET
          startup_delay_ms = ?, stall_count = ?, total_stall_duration_sec = ?,
          avg_bitrate_kbps = ?, quality_switches = ?, cache_hits = ?, cache_misses = ?
         WHERE session_id = ? AND player_type = ?`,
        [startupDelayMs, stallCount, totalStallDurationSec, avgBitrateKbps,
         qualitySwitches, cacheHits, cacheMisses, sessionId, playerType]
      );
    } else {
      await db.execute(
        `INSERT INTO player_metrics
         (session_id, player_type, startup_delay_ms, stall_count, total_stall_duration_sec,
          avg_bitrate_kbps, quality_switches, cache_hits, cache_misses)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [sessionId, playerType, startupDelayMs, stallCount, totalStallDurationSec,
         avgBitrateKbps, qualitySwitches, cacheHits, cacheMisses]
      );
    }
  }
}

module.exports = PlayerMetric;

