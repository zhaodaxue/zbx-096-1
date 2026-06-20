import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { getResidents, getPainRecords, savePainRecord } from '../api.js';

const TIME_SLOTS = [
  { id: 0, label: '晨间 (06:00-10:00)' },
  { id: 1, label: '午间 (10:00-14:00)' },
  { id: 2, label: '傍晚 (14:00-18:00)' },
  { id: 3, label: '夜间 (18:00-22:00)' },
];

function FamilyPage() {
  const [residents, setResidents] = useState([]);
  const [selectedResident, setSelectedResident] = useState(null);
  const [recordDate, setRecordDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [records, setRecords] = useState({});
  const [saving, setSaving] = useState({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadResidents();
  }, []);

  useEffect(() => {
    if (selectedResident) {
      loadRecords();
    }
  }, [selectedResident, recordDate]);

  const loadResidents = async () => {
    try {
      const data = await getResidents();
      setResidents(data);
      if (data.length > 0) {
        setSelectedResident(data.find((r) => !r.is_archived) || data[0]);
      }
    } catch (err) {
      console.error('加载住民列表失败:', err);
    }
  };

  const loadRecords = async () => {
    if (!selectedResident) return;
    try {
      const data = await getPainRecords(selectedResident.id, recordDate, recordDate);
      const recordMap = {};
      data.forEach((r) => {
        recordMap[r.time_slot] = r;
      });
      setRecords(recordMap);
    } catch (err) {
      console.error('加载记录失败:', err);
    }
  };

  const handlePainChange = (timeSlot, value) => {
    setRecords((prev) => ({
      ...prev,
      [timeSlot]: {
        ...prev[timeSlot],
        pain_level: parseInt(value, 10),
        used_slow_release: prev[timeSlot]?.used_slow_release || false,
      },
    }));
  };

  const handleSlowReleaseChange = (timeSlot, checked) => {
    setRecords((prev) => ({
      ...prev,
      [timeSlot]: {
        ...prev[timeSlot],
        pain_level: prev[timeSlot]?.pain_level ?? 0,
        used_slow_release: checked,
      },
    }));
  };

  const handleSave = async (timeSlot) => {
    if (!selectedResident) return;
    if (selectedResident.is_archived) {
      setMessage('该住民已归档，无法新增记录');
      return;
    }

    const record = records[timeSlot];
    if (!record || record.pain_level === undefined) {
      setMessage('请先填写疼痛评分');
      return;
    }

    try {
      setSaving((prev) => ({ ...prev, [timeSlot]: true }));
      setMessage('');
      await savePainRecord({
        resident_id: selectedResident.id,
        record_date: recordDate,
        time_slot: timeSlot,
        pain_level: record.pain_level,
        used_slow_release: record.used_slow_release,
      });
      setMessage(`[${TIME_SLOTS.find((t) => t.id === timeSlot).label}] 保存成功`);
      await loadRecords();
    } catch (err) {
      setMessage(err.response?.data?.error || '保存失败');
    } finally {
      setSaving((prev) => ({ ...prev, [timeSlot]: false }));
    }
  };

  const getPainColorClass = (level) => {
    if (level === undefined || level === null) return '';
    return `pain-${level}`;
  };

  return (
    <div>
      <h2 className="page-title">家属端 - 疼痛日记记录</h2>

      <div className="card">
        <div className="form-group">
          <label>记录日期</label>
          <input
            type="date"
            value={recordDate}
            onChange={(e) => setRecordDate(e.target.value)}
            style={{ maxWidth: '300px' }}
          />
        </div>
      </div>

      <h3 style={{ marginBottom: '1rem' }}>选择住民</h3>
      <div className="resident-grid">
        {residents.map((r) => (
          <div
            key={r.id}
            className={`resident-card ${selectedResident?.id === r.id ? 'selected' : ''} ${r.is_archived ? 'archived' : ''}`}
            onClick={() => setSelectedResident(r)}
          >
            <div className="resident-card-header">
              <span className="resident-name">{r.name}</span>
              {r.is_archived && <span className="archived-badge">已归档</span>}
            </div>
            <div className="resident-room">房间号: {r.room_number}</div>
          </div>
        ))}
      </div>

      {message && (
        <div
          style={{
            background: message.includes('成功') ? '#d4edda' : '#f8d7da',
            color: message.includes('成功') ? '#155724' : '#721c24',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            marginBottom: '1rem',
          }}
        >
          {message}
        </div>
      )}

      {selectedResident && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>
            {selectedResident.name} - {dayjs(recordDate).format('YYYY年MM月DD日')}
            {selectedResident.is_archived && (
              <span className="archived-badge" style={{ marginLeft: '0.5rem' }}>已归档，仅可浏览</span>
            )}
          </h3>

          <div className="time-slots">
            {TIME_SLOTS.map((slot) => {
              const record = records[slot.id];
              const painLevel = record?.pain_level ?? 0;
              return (
                <div key={slot.id} className="time-slot">
                  <div className="time-slot-title">{slot.label}</div>

                  <div className="pain-input-wrapper">
                    <label>疼痛评分:</label>
                    <input
                      type="range"
                      className="pain-slider"
                      min="0"
                      max="10"
                      value={painLevel}
                      onChange={(e) => handlePainChange(slot.id, e.target.value)}
                      disabled={selectedResident.is_archived}
                    />
                    <span className={`pain-value ${getPainColorClass(painLevel)}`}>
                      {painLevel}
                    </span>
                  </div>

                  <div className="checkbox-wrapper" style={{ marginBottom: '0.75rem' }}>
                    <input
                      type="checkbox"
                      id={`slow_${slot.id}`}
                      checked={record?.used_slow_release || false}
                      onChange={(e) => handleSlowReleaseChange(slot.id, e.target.checked)}
                      disabled={selectedResident.is_archived}
                    />
                    <label htmlFor={`slow_${slot.id}`}>追加缓释剂</label>
                  </div>

                  {!selectedResident.is_archived && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleSave(slot.id)}
                      disabled={saving[slot.id]}
                    >
                      {saving[slot.id] ? '保存中...' : '保存此时段'}
                    </button>
                  )}

                  {record?.id && !saving[slot.id] && (
                    <span style={{ marginLeft: '0.5rem', color: '#28a745', fontSize: '0.875rem' }}>
                      ✓ 已记录
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default FamilyPage;
