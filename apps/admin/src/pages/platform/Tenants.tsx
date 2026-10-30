import { useEffect, useState } from 'react';
import {
  Button,
  Form,
  Input,
  Layout,
  Modal,
  Table,
  Typography,
  message,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import { api, type ApiError } from '../../api/client';

type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export function PlatformTenants() {
  const [items, setItems] = useState<Tenant[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const data = await api<{ items: Tenant[] }>('/platform/tenants');
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
    name: string;
    slug: string;
    ownerEmail: string;
    ownerPassword: string;
    ownerDisplayName: string;
  }) {
    try {
      await api('/platform/tenants', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      message.success('已代建租户');
      setOpen(false);
      await load();
    } catch (e) {
      message.error((e as ApiError).message);
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Header style={{ background: '#001529' }}>
        <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
          平台 · 租户代建
        </Typography.Title>
      </Layout.Header>
      <Layout.Content style={{ padding: 24 }}>
        <Button type="primary" onClick={() => setOpen(true)} style={{ marginBottom: 16 }}>
          代建租户
        </Button>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          columns={[
            { title: '名称', dataIndex: 'name' },
            { title: 'Slug', dataIndex: 'slug' },
            { title: '状态', dataIndex: 'status' },
          ]}
        />
        <Modal
          title="代建租户"
          open={open}
          onCancel={() => setOpen(false)}
          footer={null}
          destroyOnClose
        >
          <Form layout="vertical" onFinish={onCreate}>
            <Form.Item name="name" label="租户名称" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="slug" label="Slug" rules={[{ required: true }]}>
              <Input placeholder="小写字母数字与短横线" />
            </Form.Item>
            <Form.Item
              name="ownerDisplayName"
              label="拥有者姓名"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="ownerEmail"
              label="拥有者邮箱"
              rules={[{ required: true, type: 'email' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="ownerPassword"
              label="拥有者密码"
              rules={[{ required: true, min: 8 }]}
            >
              <Input.Password />
            </Form.Item>
            <Button type="primary" htmlType="submit" block>
              创建
            </Button>
          </Form>
        </Modal>
      </Layout.Content>
    </Layout>
  );
}
