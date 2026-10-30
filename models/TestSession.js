const db = require('../config/db');

class TestSession {
  static async create({ userId, videoId, profileId, simBandwidthKbps, simLatencyMs, simCacheHitProb,
                         measurementMode = 'SIMULATED', testDurationSec = 30 }) {
    const [result] = await db.execute(
      `INSERT INTO test_sessions
       (user_id, video_id, profile_id, sim_bandwidth_kbps, sim_latency_ms, sim_cache_hit_prob,
        measurement_mode, test_duration_sec, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'running')`,
      [userId || null, videoId || null, profileId || null,
       simBandwidthKbps, simLatencyMs, simCacheHitProb,
       measurementMode, testDurationSec]
    );
    return { sessionId: result.insertId };
  }

  static async findAll({ limit = 50, offset = 0, profileId } = {}) {
    let query = `
      SELECT
        ts.*,
        vs.title AS video_title,
        np.profile_name,
        u.username
      FROM test_sessions ts
      LEFT JOIN video_samples vs  ON ts.video_id  = vs.video_id
      LEFT JOIN network_profiles np ON ts.profile_id = np.profile_id
      LEFT JOIN users u ON ts.user_id = u.user_id
    `;
    const params = [];
    if (profileId) {
      query += ' WHERE ts.profile_id = ?';
      params.push(profileId);
    }
    query += ' ORDER BY ts.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const [rows] = await db.execute(query, params);
    return rows;
  }

  static async findById(sessionId) {
    const [rows] = await db.execute(
      `SELECT ts.*, vs.title AS video_title, vs.stream_url,
              np.profile_name, u.username
       FROM test_sessions ts
       LEFT JOIN video_samples vs    ON ts.video_id  = vs.video_id
       LEFT JOIN network_profiles np ON ts.profile_id = np.profile_id
       LEFT JOIN users u             ON ts.user_id   = u.user_id
       WHERE ts.session_id = ?`,
      [sessionId]
    );
    return rows[0] || null;
  }

  static async updateStatus(sessionId, status) {
    await db.execute('UPDATE test_sessions SET status = ? WHERE session_id = ?', [status, sessionId]);
  }

  static async count(profileId) {
    let query = 'SELECT COUNT(*) AS total FROM test_sessions';
    const params = [];
    if (profileId) {
      query += ' WHERE profile_id = ?';
      params.push(profileId);
    }
    const [rows] = await db.execute(query, params);
    return rows[0].total;
  }
}

module.exports = TestSession;

