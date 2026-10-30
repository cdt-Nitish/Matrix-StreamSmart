const db = require('../config/db');

class VideoSample {
  static async findAll() {
    const [rows] = await db.execute(
      'SELECT * FROM video_samples WHERE is_active = TRUE ORDER BY video_id'
    );
    return rows;
  }

  static async findById(videoId) {
    const [rows] = await db.execute('SELECT * FROM video_samples WHERE video_id = ?', [videoId]);
    return rows[0] || null;
  }

  static async create({ title, streamUrl, availableTiers = '240p,360p,480p,720p,1080p', durationSec = 60 }) {
    const [result] = await db.execute(
      'INSERT INTO video_samples (title, stream_url, available_tiers, duration_sec) VALUES (?, ?, ?, ?)',
      [title, streamUrl, availableTiers, durationSec]
    );
    return { videoId: result.insertId, title, streamUrl, availableTiers, durationSec };
  }

  static async update(videoId, { title, streamUrl, availableTiers, durationSec, isActive }) {
    const fields = [];
    const values = [];
    if (title !== undefined)         { fields.push('title = ?');            values.push(title); }
    if (streamUrl !== undefined)     { fields.push('stream_url = ?');       values.push(streamUrl); }
    if (availableTiers !== undefined){ fields.push('available_tiers = ?');  values.push(availableTiers); }
    if (durationSec !== undefined)   { fields.push('duration_sec = ?');     values.push(durationSec); }
    if (isActive !== undefined)      { fields.push('is_active = ?');        values.push(isActive ? 1 : 0); }
    if (fields.length === 0) return null;
    values.push(videoId);
    await db.execute(`UPDATE video_samples SET ${fields.join(', ')} WHERE video_id = ?`, values);
    return VideoSample.findById(videoId);
  }

  static async delete(videoId) {
    await db.execute('UPDATE video_samples SET is_active = FALSE WHERE video_id = ?', [videoId]);
  }
}

module.exports = VideoSample;

