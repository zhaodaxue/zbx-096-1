import React, { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  getResidents,
  getPainRecords,
  getMedAdjustmentDays,
  saveMedAdjustmentDay,
  deleteMedAdjustmentDay,
} from '../api.js';

const TIME_SLOT_LABELS = ['晨间', '午间', '傍晚', '夜间'];
const TIME_SLOT_COLORS = ['#667eea', '#f59e0b', '#10b981', '#ef4444'];

const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六'];

function NursePage() {
  const [residents, setResidents] = useState([]);
  const [selectedResident, setSelectedResident] = useState(null);
  const [painRecords, setPainRecords] = useState([]);
  const [medDays, setMedDays] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [activeTab, setActiveTab] = useState('chart');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadResidents();
  }, []);

  useEffect(() => {
    if (selectedResident) {
      loadData();
    }
  }, [selectedResident, currentMonth]);

  const loadResidents = async () => {
    try {
      const data = await getResidents();
      setResidents(data);
      if (data.length > 0) {
        setSelectedResident(data[0]);
      }
    } catch (err) {
      console.error('加载住民列表失败:', err);
    }
  };

  const loadData = async () => {
    if (!selectedResident) return;
    try {
      setLoading(true);
      const startDate = dayjs().subtract(14, 'day').format('YYYY-MM-DD');
      const endDate = dayjs().format('YYYY-MM-DD');

      const [painData, medData] = await Promise.all([
        getPainRecords(selectedResident.id, startDate, endDate),
        getMedAdjustmentDays(selectedResident.id),
      ]);
      setPainRecords(painData);
      setMedDays(medData);
    } catch (err) {
      console.error('加载数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const date = dayjs().subtract(i, 'day');
      const dateStr = date.format('YYYY-MM-DD');
      const dayRecords = painRecords.filter((r) => r.record_date === dateStr);
      const dayItem = {
        date: date.format('MM-DD'),
        fullDate: dateStr,
      };
      TIME_SLOT_LABELS.forEach((label, idx) => {
        const rec = dayRecords.find((r) => r.time_slot === idx);
        dayItem[label] = rec ? rec.pain_level : null;
      });
      const hasMedDay = medDays.some((m) => m.adjust_date === dateStr);
      if (hasMedDay) {
        dayItem.medDay = true;
      }
      days.push(dayItem);
    }
    return days;
  }, [painRecords, medDays]);

  const medDaySet = useMemo(() => {
    const set = new Set();
    medDays.forEach((m) => set.add(m.adjust_date));
    return set;
  }, [medDays]);

  const avgPainByDate = useMemo(() => {
    const map = {};
    painRecords.forEach((r) => {
      if (!map[r.record_date]) {
        map[r.record_date] = { total: 0, count: 0 };
      }
      map[r.record_date].total += r.pain_level;
      map[r.record_date].count++;
    });
    Object.keys(map).forEach((k) => {
      map[k] = Math.round((map[k].total / map[k].count) * 10) / 10;
    });
    return map;
  }, [painRecords]);

  const handleToggleMedDay = async (dateStr) => {
    if (!selectedResident) return;
    try {
      setMessage('');
      const existing = medDays.find((m) => m.adjust_date === dateStr);
      if (existing) {
        await deleteMedAdjustmentDay(existing.id);
        setMessage('已取消调药日标记');
      } else {
        await saveMedAdjustmentDay({
          resident_id: selectedResident.id,
          adjust_date: dateStr,
          note: '',
        });
        setMessage('已标记为医生调药日');
      }
      loadData();
    } catch (err) {
      setMessage(err.response?.data?.error || '操作失败');
    }
  };

  const renderCalendar = () => {
    const year = currentMonth.year();
    const month = currentMonth.month();
    const firstDay = dayjs(new Date(year, month, 1));
    const startWeekday = firstDay.day();
    const daysInMonth = currentMonth.daysInMonth();
    const today = dayjs().format('YYYY-MM-DD');

    const cells = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push(<div key={`empty-${i}`} className="calendar-day empty" />);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = dayjs(new Date(year, month, d)).format('YYYY-MM-DD');
      const isToday = dateStr === today;
      const isMedDay = medDaySet.has(dateStr);
      const avgPain = avgPainByDate[dateStr];

      cells.push(
        <div
          key={d}
          className={`calendar-day ${isToday ? 'today' : ''} ${isMedDay ? 'med-day' : ''}`}
          onClick={() => handleToggleMedDay(dateStr)}
          title={isMedDay ? '点击取消调药日' : '点击标记为调药日'}
        >
          <span className="calendar-day-number">{d}</span>
          {avgPain !== undefined && (
            <span className="calendar-day-pain">痛 {avgPain}</span>
          )}
        </div>
      );
    }

    return cells;
  };

  return (
    <div>
      <h2 className="page-title">护士端 - 疼痛监控</h2>

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
            background: '#d4edda',
            color: '#155724',
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
            <h3 style={{ marginBottom: '1rem' }}>{selectedResident.name}</h3>
            <div className="tabs">
              <div
                className={`tab ${activeTab === 'chart' ? 'active' : ''}`}
                onClick={() => setActiveTab('chart')}
              >
                近14天疼痛曲线
              </div>
              <div
                className={`tab ${activeTab === 'calendar' ? 'active' : ''}`}
                onClick={() => setActiveTab('calendar')}
              >
                调药日历
              </div>
            </div>

            {activeTab === 'chart' && (
              <div>
                {loading ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>加载中...</div>
                ) : (
                  <div className="chart-container">
                    <h4 style={{ marginBottom: '1rem', color: '#555' }}>
                      近14天各时段疼痛评分 (0-10分)
                    </h4>
                    <div style={{ width: '100%', height: 400 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                          <YAxis
                            domain={[0, 10]}
                            tick={{ fontSize: 12 }}
                            label={{ value: '疼痛评分', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                          />
                          <Tooltip />
                          <Legend />
                          {chartData
                            .filter((d) => d.medDay)
                            .map((d) => (
                              <ReferenceLine
                                key={d.fullDate}
                                x={d.date}
                                stroke="#ffc107"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                label={{ value: '调药', position: 'top', fill: '#ffc107', fontSize: 11 }}
                              />
                            ))}
                          {TIME_SLOT_LABELS.map((label, idx) => (
                            <Line
                              key={label}
                              type="monotone"
                              dataKey={label}
                              stroke={TIME_SLOT_COLORS[idx]}
                              strokeWidth={2}
                              dot={{ r: 4 }}
                              activeDot={{ r: 6 }}
                              connectNulls={true}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="legend">
                      <div className="legend-item">
                        <div className="legend-color med-day-color" />
                        <span>虚线 = 医生调药日</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'calendar' && (
              <div>
                <div className="calendar-nav">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setCurrentMonth(currentMonth.subtract(1, 'month'))}
                  >
                    ← 上月
                  </button>
                  <h4 style={{ margin: 0 }}>
                    {currentMonth.format('YYYY年 MM月')}
                  </h4>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setCurrentMonth(currentMonth.add(1, 'month'))}
                  >
                    下月 →
                  </button>
                </div>

                <div className="calendar">
                  {WEEK_DAYS.map((d) => (
                    <div key={d} className="calendar-header">{d}</div>
                  ))}
                  {renderCalendar()}
                </div>

                <div className="legend">
                  <div className="legend-item">
                    <div className="legend-color today-color" />
                    <span>今天</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-color med-day-color" />
                    <span>医生调药日（点击切换标记）</span>
                  </div>
                  <div className="legend-item">
                    <span>"痛 X" = 当日平均疼痛评分</span>
                  </div>
                </div>

                <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
                  <strong>使用说明：</strong>
                  <ul style={{ margin: '0.5rem 0 0 1.5rem', color: '#555', lineHeight: 1.8 }}>
                    <li>点击日历中的任意日期，即可将该日标记或取消为「医生调药日」</li>
                    <li>标记为调药日的日期会显示黄色背景</li>
                    <li>疼痛曲线图中的黄色虚线对应调药日，便于观察调药前后的疼痛变化</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default NursePage;
