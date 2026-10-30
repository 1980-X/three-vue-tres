import { useEffect, useState } from 'react';
import {
  Button,
  Form,
  Input,
  InputNumber,
  Layout,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Typography,
  message,
} from 'antd';
import { Link, useParams } from 'react-router-dom';
import { api, type ApiError } from '../api/client';
import { DraftPreview } from '../components/DraftPreview';

type Track = {
  id: string;
  title: string;
  trackKind: string;
  isPrimary: boolean;
  sortOrder: number;
  hotspots: { id: string; title: string; payloadJson: unknown; sortOrder: number }[];
  tours: { id: string; title: string; stepsJson: unknown }[];
};

type Venue = {
  id: string;
  title: string;
  tracks: Track[];
};

export function VenueEditor() {
  const { projectId = '', venueId = '' } = useParams();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [trackId, setTrackId] = useState<string>();
  const [trackOpen, setTrackOpen] = useState(false);
  const [hotspotOpen, setHotspotOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  async function load() {
    try {
      const data = await api<Venue>(`/api/venues/${venueId}`);
      setVenue(data);
      setTrackId((prev) => prev ?? data.tracks.find((t) => t.isPrimary)?.id ?? data.tracks[0]?.id);
    } catch (e) {
      message.error((e as ApiError).message);
    }
  }

  useEffect(() => {
    void load();
  }, [venueId]);

  const track = venue?.tracks.find((t) => t.id === trackId);

  async function saveTitle(values: { title: string }) {
    try {
      await api(`/api/venues/${venueId}`, {
        method: 'PATCH',
        body: JSON.stringify(values),
      });
      message.success('已保存');
      await load();
    } catch (e) {
      message.error((e as ApiError).message);
    }
  }

  async function createTrack(values: {
    title: string;
    trackKind: string;
    isPrimary?: boolean;
  }) {
    try {
      await api(`/api/venues/${venueId}/tracks`, {
        method: 'POST',
        body: JSON.stringify(values),
      });
      setTrackOpen(false);
      await load();
    } catch (e) {
      message.error((e as ApiError).message);
    }
  }

  async function setPrimary(id: string) {
    try {
      await api(`/api/venues/${venueId}/tracks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPrimary: true }),
      });
      await load();
    } catch (e) {
      message.error((e as ApiError).message);
    }
  }

  async function deleteTrack(id: string) {
    try {
      await api(`/api/venues/${venueId}/tracks/${id}`, { method: 'DELETE' });
      setTrackId(undefined);
      await load();
    } catch (e) {
      message.error((e as ApiError).message);
    }
  }

  async function createHotspot(values: { title: string; yaw?: number; pitch?: number }) {
    if (!trackId) return;
    try {
      await api(`/api/venues/${venueId}/tracks/${trackId}/hotspots`, {
        method: 'POST',
        body: JSON.stringify({
          title: values.title,
          payloadJson: { yaw: values.yaw ?? 0, pitch: values.pitch ?? 0 },
        }),
      });
      setHotspotOpen(false);
      await load();
    } catch (e) {
      message.error((e as ApiError).message);
    }
  }

  async function deleteHotspot(id: string) {
    if (!trackId) return;
    await api(`/api/venues/${venueId}/tracks/${trackId}/hotspots/${id}`, {
      method: 'DELETE',
    });
    await load();
  }

  async function createTour(values: { title: string }) {
    if (!trackId) return;
    try {
      await api(`/api/venues/${venueId}/tracks/${trackId}/tours`, {
        method: 'POST',
        body: JSON.stringify({
          title: values.title,
          stepsJson: (track?.hotspots ?? []).map((h) => ({ hotspotId: h.id })),
        }),
      });
      setTourOpen(false);
      await load();
    } catch (e) {
      message.error((e as ApiError).message);
    }
  }

  async function deleteTour(id: string) {
    if (!trackId) return;
    await api(`/api/venues/${venueId}/tracks/${trackId}/tours/${id}`, {
      method: 'DELETE',
    });
    await load();
  }

  if (!venue) {
    return <Layout style={{ padding: 24 }}>加载中…</Layout>;
  }

  return (
    <Layout style={{ minHeight: '100vh', padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Link to={`/projects/${projectId}/venues`}>← 展馆列表</Link>
        <Link to={`/projects/${projectId}/assets`}>资产库</Link>
      </Space>
      <Typography.Title level={3}>编辑展馆</Typography.Title>
      <Form
        layout="inline"
        initialValues={{ title: venue.title }}
        onFinish={saveTitle}
        style={{ marginBottom: 24 }}
      >
        <Form.Item name="title" rules={[{ required: true }]}>
          <Input style={{ width: 280 }} />
        </Form.Item>
        <Button type="primary" htmlType="submit">
          保存标题
        </Button>
      </Form>

      <Tabs
        items={[
          {
            key: 'tracks',
            label: '轨',
            children: (
              <>
                <Button type="primary" onClick={() => setTrackOpen(true)} style={{ marginBottom: 12 }}>
                  添加轨
                </Button>
                <Table
                  rowKey="id"
                  dataSource={venue.tracks}
                  pagination={false}
                  columns={[
                    { title: '标题', dataIndex: 'title' },
                    { title: '类型', dataIndex: 'trackKind' },
                    {
                      title: 'Primary',
                      render: (_, row) => (row.isPrimary ? '是' : '否'),
                    },
                    {
                      title: '操作',
                      render: (_, row) => (
                        <Space>
                          <Button size="small" onClick={() => setTrackId(row.id)}>
                            选中
                          </Button>
                          {!row.isPrimary && (
                            <Button size="small" onClick={() => setPrimary(row.id)}>
                              设为主轨
                            </Button>
                          )}
                          <Button size="small" danger onClick={() => deleteTrack(row.id)}>
                            删除
                          </Button>
                        </Space>
                      ),
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: 'hotspots',
            label: '热点',
            children: (
              <>
                <Typography.Paragraph>
                  当前轨：{track ? `${track.title} (${track.trackKind})` : '请先选轨'}
                </Typography.Paragraph>
                <Button
                  type="primary"
                  disabled={!trackId}
                  onClick={() => setHotspotOpen(true)}
                  style={{ marginBottom: 12 }}
                >
                  添加热点
                </Button>
                <Table
                  rowKey="id"
                  dataSource={track?.hotspots ?? []}
                  pagination={false}
                  columns={[
                    { title: '标题', dataIndex: 'title' },
                    {
                      title: 'payload',
                      dataIndex: 'payloadJson',
                      render: (v) => JSON.stringify(v),
                    },
                    {
                      title: '操作',
                      render: (_, row) => (
                        <Button size="small" danger onClick={() => deleteHotspot(row.id)}>
                          删除
                        </Button>
                      ),
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: 'tours',
            label: '导览',
            children: (
              <>
                <Button
                  type="primary"
                  disabled={!trackId}
                  onClick={() => setTourOpen(true)}
                  style={{ marginBottom: 12 }}
                >
                  添加导览
                </Button>
                <Table
                  rowKey="id"
                  dataSource={track?.tours ?? []}
                  pagination={false}
                  columns={[
                    { title: '标题', dataIndex: 'title' },
                    {
                      title: '步骤',
                      dataIndex: 'stepsJson',
                      render: (v) => JSON.stringify(v),
                    },
                    {
                      title: '操作',
                      render: (_, row) => (
                        <Button size="small" danger onClick={() => deleteTour(row.id)}>
                          删除
                        </Button>
                      ),
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: 'preview',
            label: '预览',
            children: <DraftPreview venueId={venueId} />,
          },
        ]}
      />

      <Modal title="添加轨" open={trackOpen} onCancel={() => setTrackOpen(false)} footer={null} destroyOnClose>
        <Form layout="vertical" onFinish={createTrack}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="trackKind" label="类型" initialValue="panorama" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'panorama', label: '全景' },
                { value: 'scene3d', label: '3D' },
              ]}
            />
          </Form.Item>
          <Form.Item name="isPrimary" label="设为主轨" initialValue={false}>
            <Select
              options={[
                { value: false, label: '否' },
                { value: true, label: '是' },
              ]}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            创建
          </Button>
        </Form>
      </Modal>

      <Modal title="添加热点" open={hotspotOpen} onCancel={() => setHotspotOpen(false)} footer={null} destroyOnClose>
        <Form layout="vertical" onFinish={createHotspot}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="yaw" label="yaw">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="pitch" label="pitch">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            创建
          </Button>
        </Form>
      </Modal>

      <Modal title="添加导览" open={tourOpen} onCancel={() => setTourOpen(false)} footer={null} destroyOnClose>
        <Form layout="vertical" onFinish={createTour}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Typography.Paragraph type="secondary">
            默认把当前轨热点按顺序写入 stepsJson。
          </Typography.Paragraph>
          <Button type="primary" htmlType="submit" block>
            创建
          </Button>
        </Form>
      </Modal>
    </Layout>
  );
}
