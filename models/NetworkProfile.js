const db = require('../config/db');

class NetworkProfile {
  static async findAll() {
    const [rows] = await db.execute('SELECT * FROM network_profiles ORDER BY bandwidth_kbps');
    return rows;
  }

  static async findById(profileId) {
    const [rows] = await db.execute('SELECT * FROM network_profiles WHERE profile_id = ?', [profileId]);
    return rows[0] || null;
  }

  static async create({ profileName, bandwidthKbps, latencyMs, packetLossPct = 0, cacheHitProb = 0.5 }) {
    const [result] = await db.execute(
      `INSERT INTO network_profiles (profile_name, bandwidth_kbps, latency_ms, packet_loss_pct, cache_hit_prob)
       VALUES (?, ?, ?, ?, ?)`,
      [profileName, bandwidthKbps, latencyMs, packetLossPct, cacheHitProb]
    );
    return { profileId: result.insertId, profileName, bandwidthKbps, latencyMs, packetLossPct, cacheHitProb };
  }

  static async update(profileId, data) {
    const fields = [];
    const values = [];
    const map = {
      profileName:   'profile_name',
      bandwidthKbps: 'bandwidth_kbps',
      latencyMs:     'latency_ms',
      packetLossPct: 'packet_loss_pct',
      cacheHitProb:  'cache_hit_prob'
    };
    for (const [key, col] of Object.entries(map)) {
      if (data[key] !== undefined) {
        fields.push(`${col} = ?`);
        values.push(data[key]);
      }
    }
    if (fields.length === 0) return null;
    values.push(profileId);
    await db.execute(`UPDATE network_profiles SET ${fields.join(', ')} WHERE profile_id = ?`, values);
    return NetworkProfile.findById(profileId);
  }

  static async delete(profileId) {
    await db.execute('DELETE FROM network_profiles WHERE profile_id = ?', [profileId]);
  }
}

module.exports = NetworkProfile;

