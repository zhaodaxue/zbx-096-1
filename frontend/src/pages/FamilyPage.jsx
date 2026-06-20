import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import dayjs from 'dayjs';
import { getResidents, getPainRecords, savePainRecord } from '../api.js';

const TIME_SLOTS = [
  { id: 0, label: '晨间 (06:00-10:00)', short: '晨' },
  { id: 1, label: '午间 (10:00-14:00)', short: '午' },
  { id: 2, label: '傍晚 (14:00-18:00)', short: '昏' },
  { id: 3, label: '夜间 (18:00-22:00)', short: '夜' },
];

const STRIP_DAYS = 14;

const normalizeDate = (d) => dayjs(d).format('YYYY-MM-DD');

const getPainColorClass = (level) => {
  if (level === undefined || level === null || level === '') return '';
  const n = Number(level);
  if (isNaN(n)) return '';
  return `pain-${Math.round(n)}`;
};

function FamilyPage() {
  const [residents, setResidents] = useState([]);
  const [selectedResident, setSelectedResident] = useState(null);
  const [recordDate, setRecordDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [allRecords, setAllRecords] = useState({});
  const [originalRecords, setOriginalRecords] = useState({});
  const [saving, setSaving] = useState({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const hasUnsavedRef = useRef(false);

  const stripDates = useMemo(() => {
    const dates = [];
    for (let i = STRIP_DAYS - 1; i >= 0; i--) {
      dates.push(dayjs().subtract(i, 'day').format('YYYY-MM-DD'));
    }
    return dates;
  }, []);

  const dayRecords = useMemo(() => {
    const d = normalizeDate(recordDate);
    return allRecords[d] || {};
  }, [allRecords, recordDate]);

  const hasUnsavedChanges = useMemo(() => {
    const d = normalizeDate(recordDate);
    const orig = originalRecords[d] || {};
    const curr = allRecords[d] || {};
    for (let i = 0; i < 4; i++) {
      const o = orig[i];
      const c = curr[i];
      if (!o && !c) continue;
      if (!o && c && (c.pain_level !== undefined || c.used_slow_release)) return true;
      if (o && !c) return true;
      if (o && c) {
        if (o.pain_level !== c.pain_level) return true;
        if (!!o.used_slow_release !== !!c.used_slow_release) return true;
      }
    }
    return false;
  }, [allRecords, originalRecords, recordDate]);

  useEffect(() => {
    hasUnsavedRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    loadResidents();
  }, []);

  useEffect(() => {
    if (selectedResident) {
      loadAllRecords();
    }
  }, [selectedResident]);

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

  const loadAllRecords = async () => {
    if (!selectedResident) return;
    try {
      setLoading(true);
      const startDate = stripDates[0];
      const endDate = stripDates[stripDates.length - 1];
      const data = await getPainRecords(selectedResident.id, startDate, endDate);

      const recordMap = {};
      const origMap = {};
      data.forEach((r) => {
        const d = normalizeDate(r.record_date);
        if (!recordMap[d]) recordMap[d] = {};
        if (!origMap[d]) origMap[d] = {};
        recordMap[d][r.time_slot] = { ...r };
        origMap[d][r.time_slot] = { ...r };
      });
      setAllRecords(recordMap);
      setOriginalRecords(origMap);
    } catch (err) {
      console.error('加载记录失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const confirmDiscard = useCallback((message) => {
    if (!hasUnsavedRef.current) return true;
    return window.confirm(message || '当前有未保存的修改，确定要离开吗？');
  }, []);

  const handleSelectResident = (resident) => {
    if (selectedResident?.id === resident.id) return;
    if (!confirmDiscard('切换住民会丢失当前未保存的修改，确定继续吗？')) return;
    setSelectedResident(resident);
    setRecordDate(dayjs().format('YYYY-MM-DD'));
    setMessage('');
  };

  const handleDateChange = (newDate) => {
    const target = normalizeDate(newDate);
    if (target === normalizeDate(recordDate)) return;
    if (!confirmDiscard('切换日期会丢失当前未保存的修改，确定继续吗？')) return;
    setRecordDate(target);
    setMessage('');
  };

  const handleStripDayClick = (dateStr) => {
    if (dateStr === normalizeDate(recordDate)) return;
    if (!confirmDiscard('切换日期会丢失当前未保存的修改，确定继续吗？')) return;
    setRecordDate(dateStr);
    setMessage('');
  };

  const handlePainChange = (timeSlot, value) => {
    if (selectedResident?.is_archived) return;
    const d = normalizeDate(recordDate);
    setAllRecords((prev) => {
      const dayData = { ...(prev[d] || {}) };
      dayData[timeSlot] = {
        ...dayData[timeSlot],
        pain_level: parseInt(value, 10),
        used_slow_release: dayData[timeSlot]?.used_slow_release || false,
      };
      return { ...prev, [d]: dayData };
    });
  };

  const handleSlowReleaseChange = (timeSlot, checked) => {
    if (selectedResident?.is_archived) return;
    const d = normalizeDate(recordDate);
    setAllRecords((prev) => {
      const dayData = { ...(prev[d] || {}) };
      dayData[timeSlot] = {
        ...dayData[timeSlot],
        pain_level: dayData[timeSlot]?.pain_level ?? 0,
        used_slow_release: checked,
      };
      return { ...prev, [d]: dayData };
    });
  };

  const handleSave = async (timeSlot) => {
    if (!selectedResident) return;
    if (selectedResident.is_archived) {
      setMessage('该住民已归档，无法新增记录');
      return;
    }

    const d = normalizeDate(recordDate);
    const record = allRecords[d]?.[timeSlot];
    if (!record || record.pain_level === undefined) {
      setMessage('请先填写疼痛评分');
      return;
    }

    try {
      setSaving((prev) => ({ ...prev, [timeSlot]: true }));
      setMessage('');

      const saved = await savePainRecord({
        resident_id: selectedResident.id,
        record_date: d,
        time_slot: timeSlot,
        pain_level: record.pain_level,
        used_slow_release: record.used_slow_release,
      });

      setAllRecords((prev) => {
        const dayData = { ...(prev[d] || {}) };
        dayData[timeSlot] = { ...saved };
        return { ...prev, [d]: dayData };
      });
      setOriginalRecords((prev) => {
        const dayData = { ...(prev[d] || {}) };
        dayData[timeSlot] = { ...saved };
        return { ...prev, [d]: dayData };
      });

      setMessage(`[${TIME_SLOTS.find((t) => t.id === timeSlot).label}] 保存成功`);
    } catch (err) {
      setMessage(err.response?.data?.error || '保存失败');
    } finally {
      setSaving((prev) => ({ ...prev, [timeSlot]: false }));
    }
  };

  const isDayFull = (dateStr) => {
    const dayData = allRecords[dateStr];
    if (!dayData) return false;
    for (let i = 0; i < 4; i++) {
      const rec = dayData[i];
      if (!rec || rec.id === undefined || rec.id === null) return false;
    }
    return true;
  };

  const getSlotPainLevel = (dateStr, slotId) => {
    const dayData = allRecords[dateStr];
    const rec = dayData?.[slotId];
    if (!rec) return null;
    return rec.pain_level;
  };

  const isToday = (dateStr) => dateStr === dayjs().format('YYYY-MM-DD');

  const formatStripDate = (dateStr) => {
    const d = dayjs(dateStr);
    return {
      month: d.format('M月'),
      day: d.format('D'),
      weekday: ['日', '一', '二', '三', '四', '五', '六'][d.day()],
    };
  };

  return (
    <div>
      <h2 className="page-title">家属端 - 疼痛日记记录</h2>

      <h3 style={{ marginBottom: '1rem' }}>选择住民</h3>
      <div className="resident-grid">
        {residents.map((r) => (
          <div
            key={r.id}
            className={`resident-card ${selectedResident?.id === r.id ? 'selected' : ''} ${r.is_archived ? 'archived' : ''}`}
            onClick={() => handleSelectResident(r)}
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
        <>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>近14日填报总览</h3>
              {selectedResident.is_archived && (
                <span className="archived-badge">已归档，仅可浏览</span>
              )}
            </div>

            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>加载中...</div>
            ) : (
              <div className="strip-container">
                <div className="strip-header">
                  <div className="strip-corner"></div>
                  {stripDates.map((d) => {
                    const info = formatStripDate(d);
                    const full = isDayFull(d);
                    const active = d === normalizeDate(recordDate);
                    return (
                      <div
                        key={d}
                        className={`strip-day-header ${active ? 'active' : ''} ${full ? 'full-day' : ''} ${isToday(d) ? 'today' : ''}`}
                        onClick={() => handleStripDayClick(d)}
                      >
                        <div className="strip-weekday">{info.weekday}</div>
                        <div className="strip-date">{info.month}{info.day}日</div>
                        {full && <div className="strip-full-badge">已满</div>}
                      </div>
                    );
                  })}
                </div>

                <div className="strip-rows">
                  {TIME_SLOTS.map((slot) => (
                    <div key={slot.id} className="strip-row">
                      <div className="strip-slot-label">{slot.short}</div>
                      {stripDates.map((d) => {
                        const pain = getSlotPainLevel(d, slot.id);
                        const active = d === normalizeDate(recordDate);
                        const full = isDayFull(d);
                        return (
                          <div
                            key={d}
                            className={`strip-cell ${active ? 'active' : ''} ${full ? 'full-cell' : ''} ${pain !== null ? 'filled' : ''}`}
                            onClick={() => handleStripDayClick(d)}
                          >
                            {pain !== null ? (
                              <span className={`strip-pain-value ${getPainColorClass(pain)}`}>
                                {pain}
                              </span>
                            ) : (
                              <span className="strip-empty">—</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <div className="strip-legend">
                  <div className="legend-item">
                    <div className="legend-color today-color" style={{ border: '2px solid #667eea' }} />
                    <span>今天</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-color" style={{ background: '#e8f5e9', border: '1px solid #66bb6a' }} />
                    <span>当日4时段全部已填</span>
                  </div>
                  <div className="legend-item">
                    <span>点击任意日期切换下方表单</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3 style={{ margin: 0 }}>
                {selectedResident.name} - {dayjs(recordDate).format('YYYY年MM月DD日')}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {hasUnsavedChanges && (
                  <span style={{ color: '#e67e22', fontSize: '0.875rem' }}>
                    ⚠ 有未保存修改
                  </span>
                )}
                <input
                  type="date"
                  value={recordDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  style={{ maxWidth: '180px' }}
                />
              </div>
            </div>

            <div className="time-slots">
              {TIME_SLOTS.map((slot) => {
                const record = dayRecords[slot.id];
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
        </>
      )}
    </div>
  );
}

export default FamilyPage;
