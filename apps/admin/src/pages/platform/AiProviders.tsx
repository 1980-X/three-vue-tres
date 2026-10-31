import { useEffect, useState } from 'react';
import {
  Button,
  Form,
  Input,
  Layout,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Typography,
  message,
} from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { api, type ApiError } from '../../api/client';

type Provider = {
  id: string;
  kind: 'llm' | 'mesh';
  vendor: string;
  name: string;
  baseUrl: string;
  models: string[];
  enabled: boolean;
  isDefault: boolean;
  apiKeyLast4: string;
};

export function AiProviders() {
  const [items, setItems] = useState<Provider[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const data = await api<{ items: Provider[] }>('/platform/ai/providers');
      setItems(data.items);
    } catch (e) {
      message.error((e as ApiError).message);
      if ((e as ApiError).status === 401 || (e as ApiError).status === 403) {
        navigate('/login', { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(values: {
    kind: 'llm' | 'mesh';
    vendor: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    models: string;
    isDefault: boolean;
  }) {
    try {
      await api('/platform/ai/providers', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          models: values.models
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      message.success('已保存');
      setOpen(false);
      await load();
    } catch (e) {
      message.error((e as ApiError).message);
    }
  }

  async function onProbe(id: string) {
    try {
      const r = await api<{ ok: boolean; detail: string }>(
        `/platform/ai/providers/${id}/probe`,
        { method: 'POST', body: '{}' },
      );
      message.success(r.detail || '连通正常');
    } catch (e) {
      message.error((e as ApiError).message);
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Header style={{ background: '#001529' }}>
        <Space>
          <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
            平台 · AI 厂商配置
          </Typography.Title>
          <Link to="/platform/tenants" style={{ color: '#91d5ff' }}>
            租户代建
          </Link>
          <Link to="/" style={{ color: '#91d5ff' }}>
            项目
          </Link>
        </Space>
      </Layout.Header>
      <Layout.Content style={{ padding: 24 }}>
        <Button type="primary" onClick={() => setOpen(true)} style={{ marginBottom: 16 }}>
          添加配置
        </Button>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          columns={[
            { title: '类型', dataIndex: 'kind', width: 80 },
            { title: '厂商', dataIndex: 'vendor' },
            { title: '名称', dataIndex: 'name' },
            { title: 'Base URL', dataIndex: 'baseUrl', ellipsis: true },
            {
              title: '模型',
              dataIndex: 'models',
              render: (m: string[]) => (m ?? []).join(', '),
            },
            { title: 'Key末四位', dataIndex: 'apiKeyLast4', width: 100 },
            {
              title: '默认',
              dataIndex: 'isDefault',
              width: 70,
              render: (v: boolean) => (v ? '是' : ''),
            },
            {
              title: '操作',
              render: (_, row) => (
                <Button size="small" onClick={() => void onProbe(row.id)}>
                  测连通
                </Button>
              ),
            },
          ]}
        />
      </Layout.Content>
      <Modal title="添加 AI 配置" open={open} onCancel={() => setOpen(false)} footer={null}>
        <Form
          layout="vertical"
          onFinish={onCreate}
          initialValues={{ kind: 'llm', vendor: 'deepseek', isDefault: false }}
        >
          <Form.Item name="kind" label="类型" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'llm', label: 'LLM' },
                { value: 'mesh', label: '生 3D' },
              ]}
            />
          </Form.Item>
          <Form.Item name="vendor" label="厂商标识" rules={[{ required: true }]}>
            <Input placeholder="deepseek / zhipu / kimi / hunyuan / openai_compatible" />
          </Form.Item>
          <Form.Item name="name" label="显示名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="baseUrl" label="Base URL" rules={[{ required: true, type: 'url' }]}>
            <Input placeholder="https://api.deepseek.com" />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="models" label="模型（逗号分隔）">
            <Input placeholder="deepseek-chat" />
          </Form.Item>
          <Form.Item name="isDefault" label="设为默认" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            保存
          </Button>
        </Form>
      </Modal>
    </Layout>
  );
}
