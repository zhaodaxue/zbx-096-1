import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getResidents } from '../api.js';

const TIME_SLOTS = [
  { id: 0, label: '晨间 (06:00-10:00)' },
  { id: 1, label: '午间 (10:00-14:00)' },
  { id: 2, label: '傍晚 (14:00-18:00)' },
  { id: 3, label: '夜间 (18:00-22:00)' },
];

function ResidentList() {
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResidents();
  }, []);

  const loadResidents = async () => {
    try {
      const data = await getResidents();
      setResidents(data);
    } catch (err) {
      console.error('加载住民列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="page-title">加载中...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 className="page-title" style={{ margin: 0 }}>住民档案</h2>
        <Link to="/residents/new" className="btn btn-primary">
          + 新增住民
        </Link>
      </div>

      <div className="resident-grid">
        {residents.map((r) => (
          <div
            key={r.id}
            className={`resident-card ${r.is_archived ? 'archived' : ''}`}
          >
            <div className="resident-card-header">
              <span className="resident-name">{r.name}</span>
              {r.is_archived && <span className="archived-badge">已归档</span>}
            </div>
            <div className="resident-room">房间号: {r.room_number}</div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <Link to={`/residents/${r.id}/edit`} className="btn btn-secondary btn-sm">
                编辑
              </Link>
            </div>
          </div>
        ))}
      </div>

      {residents.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: '#999' }}>
          暂无住民数据
        </div>
      )}
    </div>
  );
}

export default ResidentList;
