require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/residents', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM residents ORDER BY is_archived ASC, room_number ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取住民列表失败' });
  }
});

app.get('/api/residents/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM residents WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '住民不存在' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取住民信息失败' });
  }
});

app.post('/api/residents', async (req, res) => {
  try {
    const { name, room_number, is_archived } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: '姓名不能为空' });
    }
    if (!room_number || typeof room_number !== 'string' || !room_number.trim()) {
      return res.status(400).json({ error: '房间号不能为空' });
    }

    const result = await pool.query(
      'INSERT INTO residents (name, room_number, is_archived) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), room_number.trim(), is_archived || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '创建住民失败' });
  }
});

app.put('/api/residents/:id', async (req, res) => {
  try {
    const { name, room_number, is_archived } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: '姓名不能为空' });
    }
    if (!room_number || typeof room_number !== 'string' || !room_number.trim()) {
      return res.status(400).json({ error: '房间号不能为空' });
    }

    const result = await pool.query(
      'UPDATE residents SET name = $1, room_number = $2, is_archived = $3 WHERE id = $4 RETURNING *',
      [name.trim(), room_number.trim(), is_archived, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '住民不存在' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '更新住民失败' });
  }
});

app.post('/api/pain-records', async (req, res) => {
  try {
    const { resident_id, record_date, time_slot, pain_level, used_slow_release } = req.body;

    if (!resident_id || isNaN(parseInt(resident_id, 10))) {
      return res.status(400).json({ error: '住民ID无效' });
    }
    if (!record_date || !/^\d{4}-\d{2}-\d{2}$/.test(record_date)) {
      return res.status(400).json({ error: '日期格式无效，请使用 YYYY-MM-DD' });
    }

    const painLevelNum = Number(pain_level);
    if (!Number.isInteger(painLevelNum) || painLevelNum < 0 || painLevelNum > 10) {
      return res.status(400).json({ error: '疼痛评分必须是0到10之间的整数' });
    }

    const timeSlotNum = Number(time_slot);
    if (!Number.isInteger(timeSlotNum) || ![0, 1, 2, 3].includes(timeSlotNum)) {
      return res.status(400).json({ error: '时段无效' });
    }

    const residentResult = await pool.query(
      'SELECT is_archived FROM residents WHERE id = $1',
      [parseInt(resident_id, 10)]
    );
    if (residentResult.rows.length === 0) {
      return res.status(404).json({ error: '住民不存在' });
    }
    if (residentResult.rows[0].is_archived) {
      return res.status(403).json({ error: '该住民已归档，无法新增记录' });
    }

    const result = await pool.query(
      `INSERT INTO pain_records (resident_id, record_date, time_slot, pain_level, used_slow_release)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (resident_id, record_date, time_slot)
       DO UPDATE SET pain_level = EXCLUDED.pain_level, used_slow_release = EXCLUDED.used_slow_release
       RETURNING *`,
      [parseInt(resident_id, 10), record_date, timeSlotNum, painLevelNum, used_slow_release || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '保存疼痛记录失败' });
  }
});

app.get('/api/residents/:id/pain-records', async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    let query = 'SELECT * FROM pain_records WHERE resident_id = $1';
    let params = [id];

    if (start_date) {
      query += ' AND record_date >= $' + (params.length + 1);
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND record_date <= $' + (params.length + 1);
      params.push(end_date);
    }

    query += ' ORDER BY record_date ASC, time_slot ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取疼痛记录失败' });
  }
});

app.get('/api/residents/:id/med-adjustment-days', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM med_adjustment_days WHERE resident_id = $1 ORDER BY adjust_date ASC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取调药日失败' });
  }
});

app.post('/api/med-adjustment-days', async (req, res) => {
  try {
    const { resident_id, adjust_date, note } = req.body;
    const result = await pool.query(
      `INSERT INTO med_adjustment_days (resident_id, adjust_date, note)
       VALUES ($1, $2, $3)
       ON CONFLICT (resident_id, adjust_date)
       DO UPDATE SET note = EXCLUDED.note
       RETURNING *`,
      [resident_id, adjust_date, note || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '保存调药日失败' });
  }
});

app.delete('/api/med-adjustment-days/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM med_adjustment_days WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '调药日不存在' });
    }
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '删除调药日失败' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`疼痛日记后端服务运行在端口 ${PORT}`);
});
