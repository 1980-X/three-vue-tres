import { useState } from 'react';
import { Button, Card, Form, Input, Tabs, Typography, message } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, type ApiError } from '../api/client';

export function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(false);

  async function onMember(values: {
    email: string;
    password: string;
    tenantSlug: string;
  }) {
    setLoading(true);
    try {
      await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      const next = params.get('next') || '/';
      navigate(next, { replace: true });
    } catch (e) {
      message.error((e as ApiError).message || '登录失败');
    } finally {
      setLoading(false);
    }
  }

  async function onPlatform(values: { email: string; password: string }) {
    setLoading(true);
    try {
      await api('/auth/platform/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      navigate('/platform/tenants', { replace: true });
    } catch (e) {
      message.error((e as ApiError).message || '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#f5f5f5',
      }}
    >
      <Card title="展馆管理登录" style={{ width: 420 }}>
        <Tabs
          items={[
            {
              key: 'member',
              label: '租户成员',
              children: (
                <Form layout="vertical" onFinish={onMember}>
                  <Form.Item
                    name="tenantSlug"
                    label="租户标识"
                    rules={[{ required: true, message: '请输入租户 slug' }]}
                  >
                    <Input placeholder="例如 acme" />
                  </Form.Item>
                  <Form.Item
                    name="email"
                    label="邮箱"
                    rules={[{ required: true, type: 'email' }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item
                    name="password"
                    label="密码"
                    rules={[{ required: true }]}
                  >
                    <Input.Password />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading} block>
                    登录
                  </Button>
                </Form>
              ),
            },
            {
              key: 'platform',
              label: '平台超管',
              children: (
                <Form layout="vertical" onFinish={onPlatform}>
                  <Form.Item
                    name="email"
                    label="邮箱"
                    rules={[{ required: true, type: 'email' }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item
                    name="password"
                    label="密码"
                    rules={[{ required: true }]}
                  >
                    <Input.Password />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading} block>
                    登录
                  </Button>
                  <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
                    超管登录后进入租户代建。
                  </Typography.Paragraph>
                </Form>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
