import { useEffect, useState } from 'react';
import { Button, Form, Input, Layout, Modal, Space, Table, Typography, message } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type ApiError } from '../api/client';

type VenueRow = {
  id: string;
  title: string;
  status: string;
  tracks: { id: string; title: string; trackKind: string; isPrimary: boolean }[];
};

export function Venues() {
  const { projectId = '' } = useParams();
  const [items, setItems] = useState<VenueRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const data = await api<{ items: VenueRow[] }>(
        `/api/projects/${projectId}/venues`,
      );
      setItems(data.items);
    } catch (e) {
      message.error((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [projectId]);

  async function onCreate(values: { title: string }) {
    try {
      const venue = await api<{ id: string }>(
        `/api/projects/${projectId}/venues`,
        { method: 'POST', body: JSON.stringify(values) },
      );
      setOpen(false);
      navigate(`/projects/${projectId}/venues/${venue.id}`);
    } catch (e) {
      message.error((e as ApiError).message);
    }
  }

  return (
    <Layout style={{ minHeight: '100vh', padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Link to="/">← 项目</Link>
        <Link to={`/projects/${projectId}/assets`}>资产库</Link>
      </Space>
      <Typography.Title level={3}>展馆列表</Typography.Title>
      <Button type="primary" onClick={() => setOpen(true)} style={{ marginBottom: 16 }}>
        新建展馆
      </Button>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        columns={[
          {
            title: '标题',
            dataIndex: 'title',
            render: (t: string, row) => (
              <Link to={`/projects/${projectId}/venues/${row.id}`}>{t}</Link>
            ),
          },
          { title: '状态', dataIndex: 'status' },
          {
            title: '轨数',
            render: (_, row) => row.tracks?.length ?? 0,
          },
        ]}
      />
      <Modal title="新建展馆" open={open} onCancel={() => setOpen(false)} footer={null} destroyOnClose>
        <Form layout="vertical" onFinish={onCreate}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            创建
          </Button>
        </Form>
      </Modal>
    </Layout>
  );
}
