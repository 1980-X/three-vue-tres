import { useEffect, useState } from 'react';
import {
  Button,
  Layout,
  Select,
  Space,
  Table,
  Typography,
  Upload,
  message,
} from 'antd';
import { Link, useParams } from 'react-router-dom';
import { api, type ApiError } from '../api/client';

type AssetRow = {
  id: string;
  title: string;
  kind: string;
  mime: string;
  byteSize: string;
  sha256: string;
};

export function Assets() {
  const { projectId = '' } = useParams();
  const [items, setItems] = useState<AssetRow[]>([]);
  const [kind, setKind] = useState('panorama_image');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await api<{ items: AssetRow[] }>(
        `/api/projects/${projectId}/assets`,
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

  async function onUpload(file: File) {
    const form = new FormData();
    form.append('title', file.name);
    form.append('kind', kind);
    form.append('file', file);
    const res = await fetch(`/api/projects/${projectId}/assets`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      message.error(body?.error?.message ?? '上传失败');
      return false;
    }
    message.success('上传成功');
    await load();
    return false;
  }

  async function onDelete(id: string) {
    try {
      await api(`/api/projects/${projectId}/assets/${id}`, { method: 'DELETE' });
      message.success('已删除');
      await load();
    } catch (e) {
      message.error((e as ApiError).message);
    }
  }

  return (
    <Layout style={{ minHeight: '100vh', padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Link to="/">← 项目</Link>
        <Link to={`/projects/${projectId}/venues`}>展馆</Link>
      </Space>
      <Typography.Title level={3}>资产库</Typography.Title>
      <Space style={{ marginBottom: 16 }}>
        <Select
          value={kind}
          style={{ width: 180 }}
          onChange={setKind}
          options={[
            { value: 'panorama_image', label: '全景图' },
            { value: 'panorama_video', label: '全景视频' },
            { value: 'scene_package', label: '场景包' },
            { value: 'audio', label: '音频' },
            { value: 'other', label: '其他' },
          ]}
        />
        <Upload beforeUpload={onUpload} showUploadList={false}>
          <Button type="primary">上传</Button>
        </Upload>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        columns={[
          { title: '标题', dataIndex: 'title' },
          { title: '类型', dataIndex: 'kind' },
          { title: 'MIME', dataIndex: 'mime' },
          { title: '大小', dataIndex: 'byteSize' },
          {
            title: '操作',
            render: (_, row) => (
              <Button danger size="small" onClick={() => onDelete(row.id)}>
                删除
              </Button>
            ),
          },
        ]}
      />
    </Layout>
  );
}
