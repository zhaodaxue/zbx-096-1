import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getResident, createResident, updateResident } from '../api.js';

function ResidentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    name: '',
    room_number: '',
    is_archived: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEdit) {
      loadResident();
    }
  }, [id]);

  const loadResident = async () => {
    try {
      setLoading(true);
      const data = await getResident(id);
      setFormData(data);
    } catch (err) {
      setError('加载住民信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('请输入姓名');
      return;
    }
    if (!formData.room_number.trim()) {
      setError('请输入房间号');
      return;
    }

    try {
      setLoading(true);
      if (isEdit) {
        await updateResident(id, formData);
      } else {
        await createResident(formData);
      }
      navigate('/residents');
    } catch (err) {
      setError(err.response?.data?.error || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEdit) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <h2 className="page-title">{isEdit ? '编辑住民' : '新增住民'}</h2>
      <div className="card" style={{ maxWidth: '600px' }}>
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ background: '#f8d7da', color: '#721c24', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label>姓名 *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="请输入姓名"
            />
          </div>

          <div className="form-group">
            <label>房间号 *</label>
            <input
              type="text"
              name="room_number"
              value={formData.room_number}
              onChange={handleChange}
              placeholder="请输入房间号，如 101"
            />
          </div>

          <div className="form-group">
            <div className="checkbox-wrapper">
              <input
                type="checkbox"
                id="is_archived"
                name="is_archived"
                checked={formData.is_archived}
                onChange={handleChange}
              />
              <label htmlFor="is_archived">已归档（归档后仅可浏览，不可新增记录）</label>
            </div>
          </div>

          <div className="btn-group">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '保存中...' : '保存'}
            </button>
            <Link to="/residents" className="btn btn-secondary">
              取消
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ResidentForm;
