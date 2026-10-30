const db = require('../config/db');

class User {
  static async findAll() {
    const [rows] = await db.execute('SELECT user_id, username, role, created_at FROM users');
    return rows;
  }

  static async findById(userId) {
    const [rows] = await db.execute('SELECT * FROM users WHERE user_id = ?', [userId]);
    return rows[0] || null;
  }

  static async findByUsername(username) {
    const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
    return rows[0] || null;
  }

  static async create({ username, role = 'tester' }) {
    const [result] = await db.execute(
      'INSERT INTO users (username, role) VALUES (?, ?)',
      [username, role]
    );
    return { userId: result.insertId, username, role };
  }
}

module.exports = User;

