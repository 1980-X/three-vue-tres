import { useEffect, useState } from 'react';
import { Button, Layout, Table, Typography, message } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

type ProjectRow = {
  id: string;
  name: string;
  role: string;
  createdAt: string;
};

export function Projects() {
  const [items, setItems] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api<{ items: ProjectRow[] }>('/api/projects')
      .then((data) => setItems(data.items))
      .catch((e: Error) => message.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    navigate('/login', { replace: true });
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#001529',
        }}
      >
        <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
          展馆管理
        </Typography.Title>
        <Button type="link" style={{ color: '#fff' }} onClick={logout}>
          退出
        </Button>
      </Layout.Header>
      <Layout.Content style={{ padding: 24 }}>
        <Typography.Title level={3}>项目列表</Typography.Title>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          pagination={false}
          columns={[
            { title: '名称', dataIndex: 'name' },
            { title: '角色', dataIndex: 'role' },
            {
              title: '操作',
              render: (_, row) => (
                <>
                  <Link to={`/projects/${row.id}/venues`} style={{ marginRight: 12 }}>
                    展馆
                  </Link>
                  <Link to={`/projects/${row.id}/assets`}>资产</Link>
                </>
              ),
            },
          ]}
        />
      </Layout.Content>
    </Layout>
  );
}
